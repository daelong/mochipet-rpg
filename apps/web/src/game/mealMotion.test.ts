import { describe, it, expect } from 'vitest';
import { mealMotion, locateMealFace } from './mealMotion';
describe('a spoonful of rice', () => {
  it('reaches, scoops, lifts, bites, chews and swallows in order', () => {
    expect([0.1, 0.35, 0.7, 1, 1.3, 1.65, 7.2].map((t) => mealMotion(t).stage)).toEqual([
      'reach',
      'scoop',
      'lift',
      'bite',
      'chew',
      'swallow',
      'finished',
    ]);
    expect(mealMotion(0.7).loaded).toBe(true);
    expect(mealMotion(0.7).lifted).toBeGreaterThan(0);
    expect(mealMotion(1).lifted).toBe(1);
    expect(mealMotion(1).mouthOpen).toBe(1);
    expect(mealMotion(1.3).loaded).toBe(false);
    expect(mealMotion(1.3).chew).toBeGreaterThan(0);
  });
  it('removes one serving per scoop and shows an empty bowl after four bites', () => {
    expect([0, 0.6, 2.35, 4.1, 5.85, 7.2].map((t) => mealMotion(t).servings)).toEqual([
      4, 3, 2, 1, 0, 0,
    ]);
    expect(mealMotion(7.2).eaten).toBe(4);
    for (let i = 0; i < 200; i++) {
      const p = mealMotion(i / 10);
      expect(p.servings).toBeGreaterThanOrEqual(0);
      expect(p.eaten).toBeLessThanOrEqual(4);
    }
  });
  it('derives motion from simulation time and handles invalid times safely', () => {
    expect(mealMotion(1.3)).toEqual(mealMotion(1.3));
    expect(mealMotion(NaN)).toEqual(mealMotion(0));
    expect(mealMotion(-5)).toEqual(mealMotion(0));
  });
});
describe('meal face registration', () => {
  it('finds a small eye pair rather than an outside outline', () => {
    const width = 156,
      height = 162,
      rgba = new Uint8ClampedArray(width * height * 4).fill(255);
    for (const cx of [49, 82])
      for (let y = 108; y < 114; y++)
        for (let x = cx - 2; x <= cx + 2; x++) {
          const i = (y * width + x) * 4;
          rgba[i] = rgba[i + 1] = rgba[i + 2] = 40;
        }
    const face = locateMealFace(rgba, width, height, 'z_rabbit');
    expect(face.x).toBeCloseTo(65.5);
    expect(face.y).toBeGreaterThan(122);
    expect(face.y).toBeLessThan(126);
    expect(face.tint).toBe(0xffffff);
    expect(face.eyes).toHaveLength(2);
    expect(face.eyes![0].y).toBeLessThan(face.y);
  });
  it('uses a safe face fallback for artwork without separated eye pixels', () => {
    const p = locateMealFace(new Uint8ClampedArray(156 * 162 * 4), 156, 162, 'unknown');
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
  it('keeps dark fur on the animated mouth and paws', () => {
    const rgba = new Uint8ClampedArray(156 * 162 * 4);
    for (let i = 0; i < rgba.length; i += 4) rgba.set([72, 72, 96, 255], i);
    const face = locateMealFace(rgba, 156, 162, 'm_INTJ');
    expect(face.tint).toBe(0x484860);
    expect(face.y).toBeCloseTo(162 * 0.7);
  });
});
