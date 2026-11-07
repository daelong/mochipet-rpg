import { afterEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { bindPhaserSurface } from './phaserSurface';
import { isPlayVisible, setMiniWindow } from './playSurface';
class Surface extends EventTarget {
  closed = false;
  document = { hidden: false };
  private next = 0;
  frames = new Map<number, FrameRequestCallback>();
  requestAnimationFrame = (callback: FrameRequestCallback) => {
    const id = ++this.next;
    this.frames.set(id, callback);
    return id;
  };
  cancelAnimationFrame = (id: number) => {
    this.frames.delete(id);
  };
  run() {
    const work = [...this.frames.values()];
    this.frames.clear();
    work.forEach((callback) => callback(100));
  }
}
let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  setMiniWindow(null);
  vi.unstubAllGlobals();
});
function setup() {
  const main = new Surface(),
    mini = new Surface();
  vi.stubGlobal('window', main);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  const loop = {
    sleep: vi.fn(),
    wake: vi.fn(),
    resetDelta: vi.fn(),
    focus: vi.fn(),
    tick: vi.fn(),
  };
  const game = {
    loop,
    scale: { getParentBounds: vi.fn(), refresh: vi.fn() },
    input: { mouse: { onMouseUpWindow: vi.fn() } },
  };
  cleanup = bindPhaserSurface(game as unknown as Phaser.Game, {} as HTMLElement);
  return { main, mini, game, loop };
}
describe('one frame clock across the main and PiP documents', () => {
  it('runs PiP ticks only after sleeping the original clock and cancels them on return', () => {
    const { main, mini, loop } = setup();
    main.run();
    expect(loop.tick).not.toHaveBeenCalled();
    setMiniWindow(mini as unknown as Window);
    expect(loop.sleep).toHaveBeenCalledTimes(1);
    mini.run();
    mini.run();
    expect(loop.tick).toHaveBeenCalledTimes(2);
    setMiniWindow(null);
    expect(mini.frames.size).toBe(0);
    expect(loop.wake).toHaveBeenCalledTimes(1);
    mini.run();
    expect(loop.tick).toHaveBeenCalledTimes(2);
  });
  it('uses the PiP visibility when its opener is hidden and stops when both are hidden', () => {
    const { main, mini, loop } = setup();
    main.document.hidden = true;
    expect(isPlayVisible()).toBe(false);
    setMiniWindow(mini as unknown as Window);
    expect(isPlayVisible()).toBe(true);
    mini.run();
    expect(loop.tick).toHaveBeenCalledTimes(1);
    mini.document.hidden = true;
    expect(isPlayVisible()).toBe(false);
    mini.run();
    expect(loop.tick).toHaveBeenCalledTimes(1);
    mini.document.hidden = false;
    mini.run();
    expect(loop.tick).toHaveBeenCalledTimes(2);
  });
  it('cleans up frame and resize callbacks across repeated open/close transitions', () => {
    const { main, mini, game, loop } = setup();
    for (let i = 0; i < 4; i++) {
      setMiniWindow(mini as unknown as Window);
      mini.run();
      setMiniWindow(null);
      main.run();
    }
    expect(loop.sleep).toHaveBeenCalledTimes(4);
    expect(loop.wake).toHaveBeenCalledTimes(4);
    expect(loop.tick).toHaveBeenCalledTimes(4);
    cleanup!();
    cleanup = undefined;
    expect(main.frames.size).toBe(0);
    expect(mini.frames.size).toBe(0);
    const refreshes = game.scale.refresh.mock.calls.length;
    main.dispatchEvent(new Event('resize'));
    mini.dispatchEvent(new Event('resize'));
    main.run();
    mini.run();
    expect(game.scale.refresh).toHaveBeenCalledTimes(refreshes);
  });
});
