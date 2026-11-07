import { describe, expect, it } from 'vitest';
import { petFacing } from './petFacing';

describe('pet movement and combat facing', () => {
  it('turns on horizontal and diagonal paths in both directions', () => {
    for (const y of [-80, 0, 80]) {
      expect(petFacing('left', { x: 40, y })).toBe('right');
      expect(petFacing('right', { x: -40, y })).toBe('left');
    }
  });
  it('faces the actual movement when approaching an offset beside the opponent', () => {
    expect(petFacing('right', { x: -3, y: 20 }, { x: 10, y: 20 })).toBe('left');
    expect(petFacing('left', { x: 3, y: -20 }, { x: -10, y: -20 })).toBe('right');
  });
  it('turns toward the current opponent even when no movement remains', () => {
    expect(petFacing('left', { x: 0, y: 0 }, { x: 88, y: 0 })).toBe('right');
    expect(petFacing('right', { x: 0, y: 0 }, { x: -88, y: 0 })).toBe('left');
    expect(petFacing('left', { x: 0, y: 0 }, { x: 35, y: -70 })).toBe('right');
  });
  it('keeps its side while idle or moving exactly vertically without flickering', () => {
    for (const side of ['left', 'right'] as const) {
      expect(petFacing(side, { x: 0, y: 0 })).toBe(side);
      expect(petFacing(side, { x: 0, y: -40 }, { x: 80, y: 0 })).toBe(side);
      expect(petFacing(side, { x: 0.00001, y: 40 })).toBe(side);
      expect(petFacing(side, { x: 0, y: 0 }, { x: 0, y: 80 })).toBe(side);
    }
  });
});
