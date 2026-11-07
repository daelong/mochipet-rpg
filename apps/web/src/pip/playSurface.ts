let miniWindow: Window | null = null;
const listeners = new Set<() => void>();
export function getPlayWindow(): Window {
  return miniWindow && !miniWindow.closed ? miniWindow : window;
}
export function isPlayVisible(): boolean {
  return !getPlayWindow().document.hidden;
}
export function isMiniWindowOpen(): boolean {
  return Boolean(miniWindow && !miniWindow.closed);
}
export function subscribeSurface(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setMiniWindow(next: Window | null): void {
  miniWindow = next;
  for (const listener of listeners) listener();
}
