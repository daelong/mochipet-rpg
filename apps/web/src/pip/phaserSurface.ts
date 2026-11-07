import type Phaser from 'phaser';
import { getPlayWindow, isMiniWindowOpen, subscribeSurface } from './playSurface';
/** Use one frame clock, belonging to the document that currently displays the canvas. */
export function bindPhaserSurface(game: Phaser.Game, host: HTMLElement): () => void {
  let active: Window = window;
  let frame: number | null = null;
  let pipClock = false;
  let stopped = false;
  let resizeFrame: number | null = null;
  const resize = () => {
    if (resizeFrame !== null) active.cancelAnimationFrame(resizeFrame);
    resizeFrame = active.requestAnimationFrame(() => {
      resizeFrame = null;
      if (!stopped) {
        game.scale.getParentBounds();
        game.scale.refresh();
      }
    });
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const mouse = game.input.mouse;
  const outside = (event: MouseEvent) => mouse?.onMouseUpWindow(event);
  const update = () => {
    if (frame !== null) active.cancelAnimationFrame(frame);
    frame = null;
    if (resizeFrame !== null) active.cancelAnimationFrame(resizeFrame);
    resizeFrame = null;
    active.removeEventListener('resize', resize);
    active.removeEventListener('mouseup', outside);
    const wasPiP = pipClock;
    active = getPlayWindow();
    pipClock = isMiniWindowOpen();
    active.addEventListener('resize', resize);
    if (pipClock) active.addEventListener('mouseup', outside);
    game.loop.resetDelta();
    if (pipClock) {
      game.loop.sleep();
      game.loop.focus();
      const tick = () => {
        if (stopped || !pipClock) return;
        if (!active.document.hidden) game.loop.tick();
        frame = active.requestAnimationFrame(tick);
      };
      frame = active.requestAnimationFrame(tick);
    } else if (wasPiP) game.loop.wake();
    resize();
  };
  const unsubscribe = subscribeSurface(update);
  update();
  return () => {
    stopped = true;
    unsubscribe();
    observer.disconnect();
    active.removeEventListener('resize', resize);
    active.removeEventListener('mouseup', outside);
    if (frame !== null) active.cancelAnimationFrame(frame);
    if (resizeFrame !== null) active.cancelAnimationFrame(resizeFrame);
    if (pipClock) game.loop.wake();
  };
}
