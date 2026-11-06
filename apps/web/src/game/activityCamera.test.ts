import { describe, it, expect } from 'vitest';
import { HOME_ACTIVITIES } from '@mochi/game-data';
import { activityShot } from './activityCamera';
describe('activity camera framing', () => {
  it.each([
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ])('keeps the pet clear of frame edges at $width x $height', ({ width, height }) => {
    for (const activity of HOME_ACTIVITIES) {
      const tracking = activityShot(width, height, activity, false);
      const closeup = activityShot(width, height, activity, true);
      expect(closeup.zoom).toBeGreaterThan(tracking.zoom);
      expect(closeup.zoom).toBeLessThanOrEqual(2.05);
      expect(closeup.zoom * 132).toBeLessThan(width - 20);
      expect(closeup.zoom * 132).toBeLessThan(height - (height < 500 ? 182 : 260));
      expect(closeup.x).toBe(activity.x);
      expect(Number.isFinite(closeup.y)).toBe(true);
    }
  });
});
