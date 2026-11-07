import { HUNTING_RULES } from '@mochi/game-data';
export interface Point {
  x: number;
  y: number;
}
export interface LocatedEnemy extends Point {
  uid: number;
  hp: number;
}
export function nearestEnemy<T extends LocatedEnemy>(
  enemies: readonly T[],
  origin: Point,
): T | null {
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return null;
  let closest: T | null = null;
  let distance = Infinity;
  for (const enemy of enemies) {
    const next = (enemy.x - origin.x) ** 2 + (enemy.y - origin.y) ** 2;
    if (enemy.hp > 0 && next < distance) {
      closest = enemy;
      distance = next;
    }
  }
  return closest;
}
/** Bounded rejection sampling; a fixed grid fallback also works with a constant RNG. */
export function spawnPosition(existing: readonly Point[], random: () => number): Point {
  const b = HUNTING_RULES.bounds;
  const free = (p: Point) =>
    existing.every((e) => Math.hypot(e.x - p.x, e.y - p.y) >= HUNTING_RULES.minSpacing);
  for (let attempt = 0; attempt < 32; attempt++) {
    const point = {
      x: b.minX + random() * (b.maxX - b.minX),
      y: b.minY + random() * (b.maxY - b.minY),
    };
    if (free(point)) return point;
  }
  for (let y = b.minY; y <= b.maxY; y += 180)
    for (let x = b.minX; x <= b.maxX; x += 180) {
      if (free({ x, y })) return { x, y };
    }
  throw new Error('No free monster spawn position');
}
