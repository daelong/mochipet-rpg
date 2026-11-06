export const MEAL_BITES = 4;
export const BITE_SECONDS = 1.75;
export type MealStage = 'reach' | 'scoop' | 'lift' | 'bite' | 'chew' | 'swallow' | 'finished';
const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
/** All movement follows simulation time, so hiding the tab freezes the spoon too. */
export function mealMotion(elapsed: number) {
  const time = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  const bite = Math.min(MEAL_BITES, Math.floor(time / BITE_SECONDS));
  const t = time % BITE_SECONDS;
  const stage: MealStage =
    bite === MEAL_BITES
      ? 'finished'
      : t < 0.28
        ? 'reach'
        : t < 0.5
          ? 'scoop'
          : t < 0.96
            ? 'lift'
            : t < 1.12
              ? 'bite'
              : t < 1.57
                ? 'chew'
                : 'swallow';
  const lifted =
    stage === 'lift'
      ? ease((t - 0.5) / 0.46)
      : stage === 'bite'
        ? 1
        : stage === 'chew'
          ? 1 - ease((t - 1.12) / 0.45)
          : 0;
  const scooped = bite === MEAL_BITES ? MEAL_BITES : bite + (t >= 0.5 ? 1 : 0);
  const eaten = bite === MEAL_BITES ? MEAL_BITES : bite + (t >= 1.06 ? 1 : 0);
  const chew = stage === 'chew' ? Math.sin(((t - 1.12) / 0.45) * Math.PI * 5) ** 2 : 0;
  return {
    stage,
    bite,
    eaten,
    servings: MEAL_BITES - scooped,
    lifted,
    loaded: bite < MEAL_BITES && t >= 0.4 && t < 1.06,
    mouthOpen: stage === 'bite' ? 1 : chew * 0.35,
    chew,
    lean: stage === 'lift' ? lifted * 2 : stage === 'bite' ? 2 : 0,
  };
}

export interface FaceProfile {
  x: number;
  y: number;
  tint: number;
  eyes?: { x: number; y: number }[];
}
/** Find the pair of small dark eyes in the original PNG, rather than assuming one face height. */
export function locateMealFace(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  character: string,
): FaceProfile {
  const dark = new Set<number>();
  for (let y = Math.floor(height * 0.35); y < height * 0.82; y++)
    for (let x = Math.floor(width * 0.12); x < width * 0.85; x++) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] > 200 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 80)
        dark.add(y * width + x);
    }
  const parts: { x: number; y: number; size: number }[] = [];
  while (dark.size) {
    const start = dark.values().next().value!;
    dark.delete(start);
    const pending = [start],
      group: number[] = [];
    while (pending.length) {
      const p = pending.pop()!;
      group.push(p);
      for (const q of [p - 1, p + 1, p - width, p + width]) if (dark.delete(q)) pending.push(q);
    }
    const xs = group.map((p) => p % width),
      ys = group.map((p) => Math.floor(p / width));
    if (
      group.length >= 7 &&
      group.length <= 85 &&
      Math.max(...xs) - Math.min(...xs) <= 14 &&
      Math.max(...ys) - Math.min(...ys) <= 14
    )
      parts.push({
        x: xs.reduce((a, b) => a + b, 0) / xs.length,
        y: ys.reduce((a, b) => a + b, 0) / ys.length,
        size: group.length,
      });
  }
  let x = width * 0.43,
    y = height * 0.74,
    best = Infinity;
  let eyes: { x: number; y: number }[] = [];
  for (const a of parts)
    for (const b of parts) {
      const gap = b.x - a.x;
      if (gap < width * 0.11 || gap > width * 0.32 || Math.abs(a.y - b.y) > 7) continue;
      const score =
        Math.abs(a.y - b.y) * 8 +
        Math.abs(gap - width * 0.19) * 0.6 +
        Math.abs(Math.log(a.size / b.size)) * 8 +
        Math.abs((a.x + b.x) / 2 - width * 0.43) * 0.15;
      if (score < best) {
        best = score;
        x = (a.x + b.x) / 2;
        eyes = [
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
        ];
        const beak = character === 'z_rooster' || character === 'm_INTP';
        y = (a.y + b.y) / 2 + gap * (beak ? 0.24 : 0.4);
      }
    }
  // The horse has a side-facing muzzle; the owl's dark eye masks join its outlines.
  if (character === 'z_horse') {
    x = width * 0.275;
    y = height * 0.7;
  }
  if (character === 'm_INFJ') {
    x = width * 0.475;
    y = height * 0.64;
  }
  // Glasses connect the cat's eyes to its outline; keep its mouth above the scarf.
  if (character === 'm_INTJ') {
    x = width * 0.43;
    y = height * 0.7;
    eyes = [
      { x: width * 0.34, y: height * 0.65 },
      { x: width * 0.5, y: height * 0.65 },
    ];
  }
  const samples: number[][] = [];
  for (const [dx, dy] of [
    [-7, 2],
    [7, 2],
    [-5, 5],
    [5, 5],
    [0, 6],
  ]) {
    const i =
      (Math.max(0, Math.min(height - 1, Math.round(y + dy))) * width +
        Math.max(0, Math.min(width - 1, Math.round(x + dx)))) *
      4;
    if (pixels[i + 3] > 200 && pixels[i] + pixels[i + 1] + pixels[i + 2] > 120)
      samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }
  const median = (c: number) =>
    samples.length
      ? samples.map((s) => s[c]).sort((a, b) => a - b)[Math.floor(samples.length / 2)]
      : 245;
  return { x, y, tint: (median(0) << 16) | (median(1) << 8) | median(2), eyes };
}
