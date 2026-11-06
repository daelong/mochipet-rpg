export const PAN_THRESHOLD = 7;
export interface PanOrigin {
  x: number;
  y: number;
  scrollX: number;
  scrollY: number;
}
export interface MapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function panMap(
  origin: PanOrigin,
  point: { x: number; y: number },
  zoom: number,
  viewport: { width: number; height: number },
  bounds: MapBounds,
) {
  const clamp = (n: number, start: number, extent: number, view: number) =>
    view >= extent
      ? start + (extent - view) / 2
      : Math.max(start, Math.min(start + extent - view, n));
  return {
    scrollX: clamp(
      origin.scrollX - (point.x - origin.x) / zoom,
      bounds.x,
      bounds.width,
      viewport.width / zoom,
    ),
    scrollY: clamp(
      origin.scrollY - (point.y - origin.y) / zoom,
      bounds.y,
      bounds.height,
      viewport.height / zoom,
    ),
  };
}
export function isMapClick(
  scene: { game: { canvas: HTMLCanvasElement } },
  pointer: { event: { target: EventTarget | null }; getDistance(): number },
) {
  return (
    pointer.event.target === scene.game.canvas &&
    pointer.getDistance() < PAN_THRESHOLD &&
    scene.game.canvas.dataset.pointerDragged !== 'true'
  );
}
