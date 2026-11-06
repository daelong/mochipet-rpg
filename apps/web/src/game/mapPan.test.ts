import { describe, it, expect } from 'vitest';
import { panMap, isMapClick } from './mapPan';
describe('map exploration input', () => {
  const bounds = { x: 0, y: 0, width: 1800, height: 1300 };
  it('moves the view in the opposite world direction at the current zoom', () => {
    const origin = { x: 300, y: 300, scrollX: 500, scrollY: 400 };
    expect(panMap(origin, { x: 400, y: 250 }, 2, { width: 600, height: 400 }, bounds)).toEqual({
      scrollX: 450,
      scrollY: 425,
    });
    expect(panMap(origin, { x: 400, y: 250 }, 1, { width: 600, height: 400 }, bounds)).toEqual({
      scrollX: 400,
      scrollY: 450,
    });
  });
  it('clamps to every map edge and centers a map smaller than the viewport', () => {
    const origin = { x: 0, y: 0, scrollX: 500, scrollY: 400 };
    expect(panMap(origin, { x: 5000, y: 5000 }, 1, { width: 600, height: 400 }, bounds)).toEqual({
      scrollX: 0,
      scrollY: 0,
    });
    expect(panMap(origin, { x: -5000, y: -5000 }, 1, { width: 600, height: 400 }, bounds)).toEqual({
      scrollX: 1200,
      scrollY: 900,
    });
    expect(panMap(origin, { x: 200, y: 100 }, 1, { width: 2000, height: 1500 }, bounds)).toEqual({
      scrollX: -100,
      scrollY: -100,
    });
  });
  it('ignores menu events and suppresses clicks even after a drag returns to its origin', () => {
    const canvas = { dataset: { pointerDragged: 'false' } } as unknown as HTMLCanvasElement;
    const scene = { game: { canvas } };
    const pointer = { event: { target: canvas }, getDistance: () => 2 };
    expect(isMapClick(scene, pointer)).toBe(true);
    canvas.dataset.pointerDragged = 'true';
    expect(isMapClick(scene, pointer)).toBe(false);
    canvas.dataset.pointerDragged = 'false';
    expect(isMapClick(scene, { ...pointer, getDistance: () => 20 })).toBe(false);
    expect(isMapClick(scene, { ...pointer, event: { target: null } })).toBe(false);
  });
});
