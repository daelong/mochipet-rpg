import { create } from 'zustand';
import { GameEngine, defaults, type Snapshot } from '@mochi/shared';
import { SaveRepository } from './storage';
type Access = 'loading' | 'ready' | 'blocked' | 'readonly';
interface GameStore {
  engine: GameEngine;
  snapshot: Snapshot;
  access: Access;
  notice: string;
  saveState: string;
  readyScene: boolean;
}
const initial = new GameEngine(defaults());
export const useGame = create<GameStore>(() => ({
  engine: initial,
  snapshot: initial.snapshot(),
  access: 'loading',
  notice: '',
  saveState: '기록을 읽는 중',
  readyScene: false,
}));
let repository: SaveRepository | undefined;
let ownsLock = false;
export function saveNow() {
  if (!ownsLock || useGame.getState().access !== 'ready' || !repository) return;
  try {
    repository.save(useGame.getState().engine.pet);
    useGame.setState({ saveState: '방금 저장했어요' });
  } catch {
    useGame.setState({
      saveState: '저장 실패 · 재시도 필요',
      notice: '저장하지 못했어요. 이 탭을 유지하고 브라우저 저장 공간과 권한을 확인해 주세요.',
    });
  }
}
export function resetGame(): boolean {
  if (!repository || !ownsLock) return false;
  try {
    const pet = repository.reset();
    installEngine(new GameEngine(pet));
    useGame.setState({
      access: 'ready',
      notice: '초기화 전 기록을 브라우저에 백업했어요.',
      saveState: '새 기록을 저장했어요',
    });
    return true;
  } catch {
    useGame.setState({
      notice: '백업 또는 초기화에 실패했어요. 기존 기록을 확인하고 저장 권한을 점검해 주세요.',
    });
    return false;
  }
}
let unsubscribe: (() => void) | undefined;
function installEngine(engine: GameEngine) {
  unsubscribe?.();
  useGame.setState({ engine, snapshot: engine.snapshot() });
  unsubscribe = engine.subscribe(() => useGame.setState({ snapshot: engine.snapshot() }));
}
/** Web Locks owns the whole play session, so another tab cannot progress or write. */
export function startSession(): () => void {
  let cancelled = false;
  let release: (() => void) | undefined;
  const boot = (owner: boolean) => {
    if (cancelled) return;
    ownsLock = owner;
    try {
      repository = new SaveRepository(window.localStorage);
      const result = repository.load();
      installEngine(new GameEngine(result.pet));
      useGame.setState({
        access: !owner ? 'blocked' : result.readOnly ? 'readonly' : 'ready',
        notice: !owner
          ? '다른 탭에서 모찌가 놀고 있어요. 그 탭을 닫은 뒤 여기를 새로고침해 주세요.'
          : result.message,
        saveState: !owner
          ? '다른 탭에서 관리 중'
          : result.readOnly
            ? '기록 보호 중'
            : '자동 저장 준비 완료',
      });
    } catch {
      useGame.setState({
        access: 'readonly',
        notice: '저장소를 사용할 수 없어요. 브라우저 저장 권한을 확인해 주세요.',
        saveState: '읽기 전용',
      });
    }
  };
  if (!navigator.locks) {
    boot(false);
    useGame.setState({
      notice:
        '이 브라우저에서는 안전한 중복 탭 방지를 지원하지 않아요. 최신 브라우저의 localhost 또는 HTTPS에서 열어 주세요.',
    });
  } else
    void navigator.locks
      .request('mochipet.web.session', { ifAvailable: true }, async (lock) => {
        if (cancelled) return;
        boot(Boolean(lock));
        if (lock)
          await new Promise<void>((resolve) => {
            release = resolve;
          });
      })
      .catch(() => {
        if (!cancelled) boot(false);
      });
  const onHidden = () => {
    const { engine, access } = useGame.getState();
    engine.pause(document.hidden || access !== 'ready');
    if (document.hidden) saveNow();
  };
  const onPageHide = () => saveNow();
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('pagehide', onPageHide);
  const timer = window.setInterval(saveNow, 10000);
  return () => {
    cancelled = true;
    saveNow();
    ownsLock = false;
    release?.();
    unsubscribe?.();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onHidden);
    window.removeEventListener('pagehide', onPageHide);
  };
}
