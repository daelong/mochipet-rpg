export function activityShot(
  width: number,
  height: number,
  point: { x: number; y: number },
  started: boolean,
) {
  const closeZoom = Math.min(width / (width < 600 ? 290 : 550), height / 380, 2.05);
  const zoom = Math.max(0.65, closeZoom * (started ? 1 : 0.8));
  const top = height < 500 ? 52 : 80;
  const bottom = height < 500 ? 130 : 180;
  return { x: point.x, y: point.y - 60 + (bottom - top) / (2 * zoom), zoom };
}
