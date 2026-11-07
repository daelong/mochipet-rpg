import { getPlayWindow, isMiniWindowOpen, setMiniWindow } from './playSurface';
interface DocumentPiP {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
  readonly window: Window | null;
}
type PiPHost = Window & { documentPictureInPicture?: DocumentPiP };
let opening = false;
let generation = 0;
let restore: (() => void) | null = null;
export function supportsMiniWindow(): boolean {
  return (
    window.isSecureContext &&
    window.self === window.top &&
    typeof (window as PiPHost).documentPictureInPicture?.requestWindow === 'function'
  );
}
export function closeMiniWindow(): void {
  generation++;
  const child = isMiniWindowOpen() ? getPlayWindow() : null;
  restore?.();
  child?.close();
}
/** Reparent the existing React root and canvas: no second game, lock, or save owner. */
export async function openMiniWindow(): Promise<void> {
  if (opening) return;
  if (isMiniWindowOpen()) {
    getPlayWindow().focus();
    return;
  }
  if (!supportsMiniWindow())
    throw new Error('지원되는 PC 브라우저의 HTTPS 또는 localhost에서 미니 창을 열 수 있어요.');
  const root = document.getElementById('root');
  const parent = root?.parentNode;
  if (!root || !parent) throw new Error('게임 화면이 아직 준비되지 않았어요.');
  const next = root.nextSibling;
  opening = true;
  const currentGeneration = ++generation;
  let child: Window | undefined;
  let observer: MutationObserver | undefined;
  let placeholder: HTMLElement | undefined;
  const returnFocus = document.activeElement as HTMLElement | null;
  const restoreRoot = () => {
    if (restore !== restoreRoot) return;
    restore = null;
    observer?.disconnect();
    child?.removeEventListener('pagehide', restoreRoot);
    parent.insertBefore(root, next?.parentNode === parent ? next : null);
    root.removeAttribute('data-mini-window');
    placeholder?.remove();
    setMiniWindow(null);
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  try {
    // Must run immediately inside the click handler; do not await work before requesting.
    child = await (window as PiPHost).documentPictureInPicture!.requestWindow({
      width: 420,
      height: 600,
    });
    if (currentGeneration !== generation || !root.isConnected) {
      child.close();
      return;
    }
    const target = child.document;
    target.documentElement.lang = 'ko';
    target.title = '모찌펫 · 미니 펫 창';
    const base = target.createElement('base');
    base.href = document.baseURI;
    target.head.append(base);
    const viewport = target.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    target.head.append(viewport);
    let copies: Node[] = [];
    const copyStyles = () => {
      copies.forEach((node) => node.parentNode?.removeChild(node));
      copies = Array.from(document.querySelectorAll('style,link[rel="stylesheet"]')).map((node) =>
        node.cloneNode(true),
      );
      target.head.append(...copies);
    };
    copyStyles();
    observer = new MutationObserver(copyStyles);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    placeholder = document.createElement('section');
    placeholder.className = 'mini-placeholder';
    placeholder.setAttribute('aria-label', '미니 펫 창 안내');
    const title = document.createElement('h1');
    title.textContent = '작은 창에서 모찌와 놀고 있어요';
    const note = document.createElement('p');
    note.textContent = '이 탭을 열어 두세요. 미니 창을 닫으면 같은 게임 화면이 여기로 돌아와요.';
    const back = document.createElement('button');
    back.className = 'primary';
    back.textContent = '본 화면으로 돌아오기';
    back.onclick = closeMiniWindow;
    placeholder.append(title, note, back);
    parent.insertBefore(placeholder, root);
    restore = restoreRoot;
    root.setAttribute('data-mini-window', 'true');
    target.body.append(root);
    child.addEventListener('pagehide', restoreRoot, { once: true });
    setMiniWindow(child);
    child.focus();
  } catch (error) {
    if (restore === restoreRoot) restoreRoot();
    else {
      observer?.disconnect();
      placeholder?.remove();
    }
    child?.close();
    throw error;
  } finally {
    opening = false;
  }
}
