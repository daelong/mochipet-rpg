import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/game';
import { monsterById } from '@mochi/game-data';
export function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const access = useGame((s) => s.access);
  const enemy = useGame((s) => s.snapshot.enemy);
  const summary = enemy
    ? `${monsterById(enemy.id).name}와 전투 중. 몬스터 HP ${enemy.hp} / ${enemy.maxHp}.`
    : '펫이 산책하거나 쉬고 있는 게임 화면.';
  useEffect(() => {
    if (access === 'loading') return;
    let closed = false;
    let game: { destroy: (removeCanvas: boolean) => void } | undefined;
    import('./MeadowScene')
      .then(({ makeGame }) => {
        if (!closed && host.current) game = makeGame(host.current);
      })
      .catch(() => setError('게임 화면을 불러오지 못했어요. 페이지를 새로고침해 주세요.'));
    return () => {
      closed = true;
      game?.destroy(true);
    };
  }, [access === 'loading']);
  return (
    <div className="game-canvas" ref={host} role="img" aria-label={summary}>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
