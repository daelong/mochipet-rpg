import { useEffect, useRef } from 'react';
import { useGame } from '../state/game';
import { monsterById, homeActivityById } from '@mochi/game-data';
import { mealMotion } from './mealMotion';
import { careMotion } from './careMotion';
export function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const cameraMode = useGame((s) => s.cameraMode);
  const access = useGame((s) => s.access);
  const enemy = useGame((s) => s.snapshot.enemy);
  const place = useGame((s) => s.snapshot.place);
  const activity = useGame((s) => s.snapshot.homeActivity);
  const meal =
    activity?.id === 'meal' && activity.started
      ? mealMotion(homeActivityById('meal')!.seconds - activity.remaining)
      : null;
  const care =
    activity?.started && activity.id !== 'meal'
      ? careMotion(activity.id, homeActivityById(activity.id)!.seconds - activity.remaining)
      : null;
  const summary = enemy
    ? `${monsterById(enemy.id).name}와 전투 중. 몬스터 HP ${enemy.hp} / ${enemy.maxHp}.`
    : place === 'home'
      ? '집 안에서 가구를 이용해 펫을 돌보는 게임 화면.'
      : place === 'yard'
        ? '집 앞 마당에서 펫이 산책하는 게임 화면.'
        : '사냥터에서 펫이 산책하거나 쉬고 있는 게임 화면.';
  useEffect(() => {
    if (access === 'loading') return;
    let closed = false;
    let failed = false;
    let game: { destroy: (removeCanvas: boolean) => void } | undefined;
    useGame.setState({ readyScene: false, sceneError: '' });
    const fail = () => {
      if (closed || failed || useGame.getState().readyScene) return;
      failed = true;
      useGame.setState({ sceneError: '게임 화면을 불러오지 못했어요. 다시 연결해 주세요.' });
      game?.destroy(true);
    };
    const timeout = window.setTimeout(fail, 20000);
    import('./MeadowScene')
      .then(({ makeGame }) => {
        if (!closed && !failed && host.current)
          game = makeGame(host.current, () => {
            if (closed || failed) return;
            window.clearTimeout(timeout);
            useGame.setState({ readyScene: true, sceneError: '' });
          });
      })
      .catch(() => {
        window.clearTimeout(timeout);
        fail();
      });
    return () => {
      closed = true;
      window.clearTimeout(timeout);
      useGame.setState({ readyScene: false });
      game?.destroy(true);
    };
  }, [access === 'loading']);
  return (
    <div
      className="game-canvas"
      ref={host}
      role="img"
      aria-label={
        meal
          ? `식탁에서 밥을 떠서 먹고 있어요. 남은 밥 ${meal.servings}숟갈, 먹은 숟갈 ${meal.eaten}회.`
          : care
            ? care.caption
            : summary
      }
      data-meal-stage={meal?.stage}
      data-meal-servings={meal?.servings}
      data-meal-bites={meal?.eaten}
      data-care-activity={care?.id}
      data-care-phase={care?.phase}
      data-care-foam={care ? care.foam.toFixed(2) : undefined}
      data-care-dust={care?.dust}
      data-care-page={care?.page}
      data-camera-mode={cameraMode}
    ></div>
  );
}
