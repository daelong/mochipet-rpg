import { homeActivityById, type HomeActivityId } from '@mochi/game-data';

export type CareId = Exclude<HomeActivityId, 'meal'>;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
const sequences: Record<CareId, readonly [number, string, string][]> = {
  bath: [
    [0.1, 'soak', '욕조에 앉아 물에 몸을 적셔요'],
    [0.55, 'scrub', '스펀지로 몸을 뽀득뽀득 씻어요'],
    [0.85, 'rinse', '샤워기로 거품을 헹궈요'],
    [1, 'dry', '수건으로 몸을 닦아요'],
  ],
  toilet: [
    [0.12, 'sit', '변기에 편안히 앉아요'],
    [0.58, 'wait', '가림막 뒤에서 볼일을 봐요'],
    [0.72, 'wipe', '휴지를 꺼내 마무리해요'],
    [0.9, 'flush', '레버를 눌러 물을 내려요'],
    [1, 'wash', '작은 세면대에서 손을 씻어요'],
  ],
  play: [
    [0.84, 'catch', '공을 주고받으며 놀아요'],
    [1, 'hug', '곰 인형을 꼭 안아 줘요'],
  ],
  read: [
    [0.1, 'open', '책을 펼쳐 무릎에 올려요'],
    [0.88, 'read', '한 장씩 책장을 넘겨 읽어요'],
    [1, 'close', '읽은 책을 덮어요'],
  ],
  sleep: [
    [0.12, 'settle', '베개에 기대어 이불을 덮어요'],
    [0.9, 'sleep', '이불 속에서 새근새근 잠들어요'],
    [1, 'wake', '이불을 내리고 기지개를 켜요'],
  ],
  clean: [
    [0.7, 'sweep', '빗자루로 먼지를 한곳에 모아요'],
    [0.9, 'collect', '쓰레받기에 먼지를 담아요'],
    [1, 'shine', '깨끗해진 바닥을 살펴봐요'],
  ],
};
/** Driven only by activity simulation time; tab hiding and pause freeze every prop. */
export function careMotion(id: CareId, elapsed: number) {
  const duration = homeActivityById(id)!.seconds;
  const time = Math.max(0, Math.min(duration, Number.isFinite(elapsed) ? elapsed : 0));
  const progress = time / duration;
  let start = 0;
  let [end, phase, caption] = sequences[id][sequences[id].length - 1];
  for (const entry of sequences[id]) {
    [end, phase, caption] = entry;
    if (progress < end || end === 1) break;
    start = end;
  }
  const local = clamp((progress - start) / Math.max(0.001, end - start));
  const stroke = Math.sin(time * 8);
  let x = 0,
    y = 0,
    angle = 0,
    scale = 1;
  let ballX = -32,
    ballY = 8,
    pageTurn = 0;
  if (id === 'bath') {
    y = -16;
    angle = phase === 'scrub' ? stroke * 2 : 0;
  }
  if (id === 'toilet') {
    y = phase === 'wash' ? 0 : 4;
    x = phase === 'wash' ? smooth(local * 3) * 66 : 0;
  }
  if (id === 'play' && phase !== 'hug') {
    const cycle = time % 2.8;
    if (cycle >= 0.45 && cycle < 1.25) {
      phase = 'toss';
      caption = '공을 던지고 눈으로 따라가요';
      const t = (cycle - 0.45) / 0.8;
      ballX = -32 + 120 * t;
      ballY = 8 - 86 * Math.sin(Math.PI * t);
    } else if (cycle >= 1.25 && cycle < 2.4) {
      phase = 'bounce';
      caption = '통통 튀는 공을 다시 받아요';
      const t = (cycle - 1.25) / 1.15;
      ballX = 88 - 120 * t;
      ballY = 8 - Math.abs(Math.sin(Math.PI * 2 * t)) * 24;
    }
    angle = ballX * 0.045;
    y = -Math.max(0, Math.sin(time * 5)) * 5;
  }
  if (id === 'read') {
    const cycle = Math.max(0, time - 1) % 2.1;
    if (phase === 'read' && cycle < 0.65) {
      phase = 'turn';
      caption = '손으로 책장을 넘겨요';
      pageTurn = smooth(cycle / 0.65);
    }
    angle = Math.sin(time * 2) * 2;
  }
  if (id === 'sleep') {
    const sleeping = phase !== 'wake';
    x = sleeping ? -8 : -8 * (1 - smooth(local));
    y = sleeping ? -10 + Math.sin(time * 2) * 0.8 : -10 * (1 - smooth(local));
    angle = sleeping ? -8 : -8 * (1 - smooth(local));
    scale = 1 + Math.sin(time * 2) * 0.012;
  }
  if (id === 'clean') {
    x = phase === 'sweep' ? stroke * 5 : 0;
    angle = phase === 'sweep' ? stroke * 3 : -2;
  }
  return {
    id,
    time,
    progress,
    phase,
    caption,
    local,
    stroke,
    x,
    y,
    angle,
    scale,
    ballX,
    ballY,
    pageTurn,
    page: Math.min(4, Math.max(0, Math.floor((time - 1) / 2.1))),
    foam:
      id === 'bath'
        ? phase === 'scrub'
          ? 0.4 + 0.6 * local
          : phase === 'rinse'
            ? 1 - local
            : 0
        : 0,
    dust: id === 'clean' ? Math.max(0, Math.ceil(8 * (1 - progress / 0.9))) : 0,
    blanket:
      id === 'sleep'
        ? phase === 'settle'
          ? smooth(local)
          : phase === 'wake'
            ? 1 - smooth(local)
            : 1
        : 0,
    texture:
      id === 'sleep' && progress > 0.06 && progress < 0.91 ? ('sleep' as const) : ('idle' as const),
  };
}
export type CarePose = ReturnType<typeof careMotion>;
