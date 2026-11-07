import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  PawPrint,
  ShoppingBag,
  Sparkles,
  BookOpen,
  Settings,
  Leaf,
  Coins,
  ChevronRight,
  Heart,
  Utensils,
  Zap,
  Swords,
  Shield,
  Wind,
  MapPin,
  Check,
  LockKeyhole,
  X,
  Moon,
  CircleHelp,
  CloudOff,
  CheckCircle2,
  Square,
  Pencil,
  Sprout,
  ArrowRight,
  Download,
  House,
  Bath,
  Toilet,
  Bubbles,
  Camera,
  Expand,
  LocateFixed,
  PictureInPicture2,
  Maximize2,
} from 'lucide-react';
import {
  CHARACTERS,
  SHOP,
  SKILLS,
  ZONES,
  HOME_ACTIVITIES,
  HUNTING_RULES,
  homeActivityById,
  characterById,
  monsterById,
  petAsset,
} from '@mochi/game-data';
import { MAX_LEVEL, agility, attack, defense, maxHp, xpForLevel } from '@mochi/shared';
import { GameCanvas } from './game/GameCanvas';
import { careMotion } from './game/careMotion';
import { resetGame, saveNow, startSession, useGame } from './state/game';
import { openMiniWindow, closeMiniWindow, supportsMiniWindow } from './pip/miniWindow';
import { isMiniWindowOpen, subscribeSurface } from './pip/playSurface';
import { BACKUP_KEY, RESET_KEY, SAVE_KEY, HOME_UPGRADE_KEY } from './state/storage';
type Page = 'home' | 'map' | 'pet' | 'shop' | 'skills' | 'journal' | 'settings';
const navigation = [
  { id: 'map', label: '사냥터', icon: MapPin },
  { id: 'pet', label: '나의 친구', icon: PawPrint },
  { id: 'shop', label: '모찌 상점', icon: ShoppingBag },
  { id: 'skills', label: '스킬 도감', icon: Sparkles },
  { id: 'journal', label: '모험 기록', icon: BookOpen },
  { id: 'settings', label: '설정', icon: Settings },
] as const;
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={wide ? 'modal wide' : 'modal'}
      aria-label={title}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Meter({
  label,
  value,
  max = 100,
  color,
  icon,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
  icon: ReactNode;
}) {
  return (
    <div className="meter">
      <div className="meter-line">
        <span>
          {icon}
          {label}
        </span>
        <b>
          {value}
          <small> / {max}</small>
        </b>
      </div>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <i
          style={{
            width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
function CharacterPicker({ onClose }: { onClose: () => void }) {
  const { engine, access } = useGame();
  const [group, setGroup] = useState<'all' | 'zodiac' | 'mbti'>('all');
  const [selected, setSelected] = useState(engine.pet.characterId);
  const chosen = characterById(selected)!;
  const skill = SKILLS.find((s) => s.id === chosen.skillId)!;
  return (
    <Modal title="어떤 친구와 함께할까요?" onClose={onClose} wide>
      <p className="muted">
        28개의 작은 마음, 각자의 특별한 모험. 모습이 바뀌어도 성장 기록은 이어져요.
      </p>
      <div className="filter-tabs" aria-label="캐릭터 분류">
        {[
          ['all', '모든 친구'],
          ['zodiac', '십이지신'],
          ['mbti', 'MBTI 테마'],
        ].map(([id, label]) => (
          <button
            aria-pressed={group === id}
            className={group === id ? 'selected' : ''}
            key={id}
            onClick={() => setGroup(id as typeof group)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="character-grid">
        {CHARACTERS.filter((c) => group === 'all' || c.group === group).map((c) => (
          <button
            key={c.id}
            className={`character-option ${selected === c.id ? 'selected' : ''}`}
            aria-pressed={selected === c.id}
            aria-label={`${c.name} 선택`}
            onClick={() => setSelected(c.id)}
          >
            <img width="80" height="80" src={petAsset(c.id)} alt="" loading="lazy" />
            <b>{c.animal}</b>
            <small>{c.mbti ?? '십이지신'}</small>
            {selected === c.id && <Check size={16} />}
          </button>
        ))}
      </div>
      <div className="character-confirm">
        <div>
          <b>
            {chosen.name} <span className="tag">{skill.name}</span>
          </b>
          <p>
            {chosen.tagline} · 공격 {chosen.stats.attack} / 방어 {chosen.stats.defense}
          </p>
        </div>
        <button
          className="primary"
          disabled={access !== 'ready'}
          onClick={() => {
            engine.choose(selected);
            saveNow();
            onClose();
          }}
        >
          함께 모험하기 <ArrowRight size={16} />
        </button>
      </div>
      <p className="fine-print">
        MBTI는 재미를 위한 캐릭터 테마예요. 성격을 과학적으로 진단하지 않아요.
      </p>
    </Modal>
  );
}
export default function App() {
  const mini = useSyncExternalStore(subscribeSurface, isMiniWindowOpen);
  const miniSupported = supportsMiniWindow();
  const [page, setPage] = useState<Page | null>(null);
  const [picker, setPicker] = useState(false);
  const [help, setHelp] = useState(false);
  const [reset, setReset] = useState(false);
  const [shopFilter, setShopFilter] = useState('all');
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const {
    engine,
    snapshot,
    access,
    notice,
    saveState,
    readyScene,
    sceneError,
    activityCamera,
    cameraMode,
  } = useGame();
  const p = snapshot.pet;
  const char = characterById(p.characterId)!;
  const skill = SKILLS.find((s) => s.id === char.skillId)!;
  const zone = ZONES.find((z) => z.id === p.zoneId)!;
  const enabled = access === 'ready';
  const skillDisabled =
    !enabled ||
    !readyScene ||
    snapshot.paused ||
    snapshot.autoResting ||
    !snapshot.enemy ||
    snapshot.skillCooldown > 0 ||
    snapshot.skillQueued;
  const castSkill = () => setFeedback(engine.requestSkill().message);
  const atHome = snapshot.place === 'home';
  const activity = snapshot.homeActivity ? homeActivityById(snapshot.homeActivity.id)! : null;
  const care =
    snapshot.homeActivity?.started && snapshot.homeActivity.id !== 'meal'
      ? careMotion(snapshot.homeActivity.id, activity!.seconds - snapshot.homeActivity.remaining)
      : null;
  const locationName = atHome ? '우리 집' : snapshot.place === 'yard' ? '집 앞 마당' : zone.name;
  const filming = atHome && Boolean(activity) && activityCamera && !page;
  const [draftName, setDraftName] = useState(p.name);
  const [feedback, setFeedback] = useState('');
  useEffect(startSession, []);
  useEffect(() => setDraftName(p.name), [p.name]);
  useEffect(() => {
    if (snapshot.place !== 'home' && page === 'home') setPage(null);
  }, [snapshot.place, page]);
  const lastEvent = snapshot.events.at(-1);
  useEffect(() => {
    if (lastEvent?.kind === 'notice') setFeedback(lastEvent.message);
  }, [lastEvent?.id]);
  useEffect(() => {
    if (page) panel.current?.focus();
  }, [page]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(''), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  async function enterMiniWindow() {
    if (!enabled || !readyScene) return;
    setPage(null);
    try {
      await openMiniWindow();
    } catch {
      setFeedback('미니 창을 열지 못했어요. 지원되는 PC 브라우저에서 버튼을 다시 눌러 주세요.');
    }
  }
  function returnToMain() {
    window.focus();
    closeMiniWindow();
  }
  function buy(id: string) {
    if (!enabled) return;
    const result = engine.purchase(id);
    setFeedback(result.message);
    if (result.ok) saveNow();
  }
  function closePanel() {
    setPage(null);
    trigger.current?.focus();
  }
  function doHomeActivity(id: string) {
    if (!enabled) return;
    const result = engine.startHomeActivity(id);
    setFeedback(result.message);
    if (result.ok) setPage(null);
  }
  function changePage(id: Page, button: HTMLButtonElement) {
    trigger.current = button;
    if (page === id) closePanel();
    else setPage(id);
    setFeedback('');
  }
  const progress = p.level === MAX_LEVEL ? 100 : Math.round((p.xp / xpForLevel(p.level)) * 100);
  const homeProgress = activity && snapshot.homeActivity && (
    <div className="home-progress glass" role="group" aria-label="집 안 활동 진행">
      <div>
        <span className="activity-emoji">{activity.icon}</span>
        <div>
          <b>{activity.name}</b>
          <p>
            {snapshot.homeActivity.started
              ? `${Math.ceil(snapshot.homeActivity.remaining)}초 남았어요`
              : `${activity.furniture}로 이동 중`}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="활동 취소"
          disabled={!enabled}
          onClick={() => setFeedback(engine.cancelHomeActivity().message)}
        >
          <X size={18} />
        </button>
      </div>
      <div
        className="meter-track"
        role="progressbar"
        aria-label="활동 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((1 - snapshot.homeActivity.remaining / activity.seconds) * 100)}
      >
        <i
          style={{
            width: `${(1 - snapshot.homeActivity.remaining / activity.seconds) * 100}%`,
            background: '#e2d69b',
          }}
        />
      </div>
      <button
        className="camera-view-button"
        onClick={() => {
          useGame.setState({
            activityCamera: !activityCamera,
            ...(!activityCamera ? { cameraMode: 'follow' as const } : {}),
          });
          if (!activityCamera) setPage(null);
        }}
      >
        {activityCamera ? <Expand size={14} /> : <Camera size={14} />}
        {activityCamera ? '방 전체 보기' : '활동 카메라'}
      </button>
    </div>
  );
  return (
    <main
      className="game-shell"
      id="main-content"
      data-place={snapshot.place}
      data-travelling={Boolean(snapshot.travel)}
      data-activity-camera={filming}
      data-camera-mode={cameraMode}
      data-combat-mode={snapshot.hunting ? 'auto' : snapshot.manualCombat ? 'manual' : 'none'}
    >
      <GameCanvas />
      {filming && (
        <div className="activity-broadcast" aria-label="모찌 활동 카메라">
          <div className="broadcast-top">
            <span className="broadcast-mark">
              <i />
              <Camera size={15} />
              <b>{p.name} CAM</b>
            </span>
            <span>
              {snapshot.homeActivity?.started ? '오늘의 작은 순간' : '친구를 따라가는 중'}
            </span>
          </div>
          <div className="broadcast-corners" />
          <div className="broadcast-caption">
            <span>MY LITTLE MOMENT</span>
            <h2>
              {activity!.icon}{' '}
              {snapshot.homeActivity?.started ? activity!.name : `${activity!.furniture}로 가는 길`}
            </h2>
            <p>
              {snapshot.homeActivity?.started
                ? activity!.id === 'meal'
                  ? '냠냠, 맛있게 먹고 있어요'
                  : care?.caption
                : '카메라가 친구를 따라가요'}
            </p>
          </div>
        </div>
      )}
      {!readyScene && (
        <div
          className={`scene-loading${sceneError ? ' scene-load-failed' : ''}`}
          role={sceneError ? 'alert' : undefined}
        >
          {sceneError ? (
            <div>
              <p>{sceneError}</p>
              <button className="game-button" onClick={() => location.reload()}>
                화면 다시 연결
              </button>
            </div>
          ) : (
            '작은 세상을 불러오는 중…'
          )}
        </div>
      )}
      <header className="game-hud" aria-label="모험 상태">
        <button
          className="player-hud glass"
          aria-label="나의 친구 열기"
          aria-expanded={page === 'pet'}
          aria-controls="game-panel"
          onClick={(e) => changePage('pet', e.currentTarget)}
        >
          <span className="portrait">
            <img src={petAsset(p.characterId)} alt="" />
            <span>Lv.{p.level}</span>
          </span>
          <span className="player-info">
            <span className="player-name">
              <b>{p.name}</b>
              <small>{char.animal}</small>
            </span>
            <span className="hud-hp">
              <Heart size={11} fill="currentColor" />
              <span className="hud-track">
                <i style={{ width: `${(p.hp / maxHp(p)) * 100}%` }} />
              </span>
              <b>
                {p.hp}/{maxHp(p)}
              </b>
            </span>
            <span className="xp-label">
              <span>{p.level === MAX_LEVEL ? '싱글 최고 레벨' : 'EXP'}</span>
              <span>{p.level === MAX_LEVEL ? 'MAX' : `${p.xp} / ${xpForLevel(p.level)}`}</span>
            </span>
            <span className="xp-track">
              <i style={{ width: `${progress}%` }} />
            </span>
          </span>
        </button>
        <div className="location-hud">
          <button
            className="location-button glass"
            aria-label="사냥터 열기"
            aria-expanded={page === 'map'}
            aria-controls="game-panel"
            onClick={(e) => changePage('map', e.currentTarget)}
          >
            <MapPin size={16} />
            <span>
              {locationName}
              <small>
                {snapshot.place === 'adventure' ? `Lv.${zone.level}+` : atHome ? 'HOME' : 'YARD'}
              </small>
            </span>
            <ChevronRight size={14} />
          </button>
          <span className="activity-badge">
            <span />
            {snapshot.place === 'adventure' &&
              `몬스터 ${snapshot.enemies.length}/${HUNTING_RULES.maxMonsters} · `}
            {snapshot.travel
              ? '문으로 이동 중'
              : activity
                ? activity.name
                : snapshot.autoResting
                  ? '회복 후 재개'
                  : snapshot.hunting
                    ? '자동 사냥 중'
                    : snapshot.manualCombat
                      ? '수동 공격 중'
                      : snapshot.action === 'sleep'
                        ? '쉬는 중'
                        : '자유 산책'}
          </span>
        </div>
        <div className="coin-wallet glass" aria-label={`보유 코인 ${p.coins}`}>
          <Coins size={19} />
          <b data-testid="coins">{p.coins.toLocaleString()}</b>
        </div>
      </header>
      {atHome && (
        <div className="home-needs" aria-label="집 안 돌봄 상태">
          <span className="glass">
            <Utensils size={13} />
            배부름 <b>{p.hunger}</b>
          </span>
          <span className="glass">
            <Bath size={13} />
            청결 <b data-testid="hygiene">{p.hygiene}</b>
          </span>
          <span className={`glass ${p.toilet >= 70 ? 'need-attention' : ''}`}>
            <Toilet size={13} />
            화장실 <b data-testid="toilet">{p.toilet}</b>
          </span>
          <span className="glass">
            <Bubbles size={13} />방 상태 <b>{p.roomCleanliness}</b>
          </span>
        </div>
      )}
      {(notice || access === 'loading') && (
        <div
          className={`notice glass ${access === 'blocked' || access === 'readonly' ? 'warning' : ''}`}
          role="status"
        >
          <CloudOff size={17} />
          <span>{notice || '친구의 기록을 불러오고 있어요.'}</span>
        </div>
      )}
      <nav className="action-rail" aria-label="돌봄과 전투">
        <button
          className={`game-button ${atHome ? 'active' : ''}`}
          aria-label={atHome ? '집 안 활동' : '집 들어가기'}
          disabled={!enabled}
          onClick={(e) => {
            if (atHome) changePage('home', e.currentTarget);
            else {
              engine.requestTravel('home');
              setPage(null);
            }
          }}
        >
          <House size={22} />
          <span>{atHome ? '집 안 활동' : '우리 집'}</span>
        </button>
        <button
          className={`game-button hunt-button ${snapshot.hunting ? 'stop' : ''}`}
          data-testid="hunt"
          disabled={!enabled || Boolean(snapshot.homeActivity)}
          aria-pressed={snapshot.hunting}
          onClick={(e) => {
            if (!p.chosen) {
              setPicker(true);
              return;
            }
            if (snapshot.place !== 'adventure') {
              if (page !== 'map') changePage('map', e.currentTarget);
              setFeedback('사냥터를 골라 입장해 주세요.');
              return;
            }
            setFeedback(engine.toggleHunt().message);
            setPage(null);
            saveNow();
          }}
        >
          {snapshot.hunting ? <Square size={22} /> : <Swords size={22} />}
          <span>
            {snapshot.place !== 'adventure'
              ? '사냥터 입장'
              : snapshot.hunting
                ? '자동사냥 OFF'
                : '자동사냥 ON'}
          </span>
        </button>
        <button
          className="game-button"
          disabled={!enabled}
          onClick={() => {
            setFeedback(engine.care('pet').message);
            saveNow();
          }}
        >
          <Heart size={22} />
          <span>쓰다듬기</span>
        </button>
        <button
          className="game-button"
          disabled={!enabled}
          onClick={() => {
            setFeedback(engine.care('rest').message);
            saveNow();
          }}
        >
          <Moon size={22} />
          <span>쉬기</span>
        </button>
      </nav>
      <nav className="menu-rail" aria-label="게임 메뉴">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`game-button ${page === id ? 'active' : ''}`}
            aria-label={label}
            aria-expanded={page === id}
            aria-controls="game-panel"
            onClick={(e) => changePage(id, e.currentTarget)}
          >
            <Icon size={22} />
            <span>
              {label === '모찌 상점'
                ? '상점'
                : label === '나의 친구'
                  ? '친구'
                  : label === '스킬 도감'
                    ? '스킬'
                    : label === '모험 기록'
                      ? '기록'
                      : label}
            </span>
          </button>
        ))}
      </nav>
      {atHome && p.chosen && !page && !activity && !snapshot.travel && (
        <div className="home-dock glass" aria-label="집 안 활동 바로가기">
          {HOME_ACTIVITIES.map((a) => (
            <button
              key={a.id}
              className={['meal', 'bath', 'sleep'].includes(a.id) ? '' : 'secondary-activity'}
              disabled={!enabled}
              aria-label={a.name}
              onClick={() => doHomeActivity(a.id)}
            >
              <span>{a.icon}</span>
              <small>{a.name}</small>
            </button>
          ))}
          <button
            className="more-home"
            aria-label="집 안 활동 더 보기"
            onClick={(e) => changePage('home', e.currentTarget)}
          >
            <Sparkles size={20} />
            <small>더 보기</small>
          </button>
        </div>
      )}
      {(atHome || snapshot.place === 'adventure') && !page && p.chosen && !snapshot.travel && (
        <button
          className={`yard-return glass ${activity ? 'during-activity' : ''}`}
          disabled={!enabled}
          onClick={() => {
            engine.requestTravel('yard');
            saveNow();
          }}
        >
          <Leaf size={14} />
          마당으로
        </button>
      )}
      {snapshot.travel && !page && (
        <div className="door-travel glass" role="status" aria-label="문으로 이동 중">
          <House size={20} />
          <span>
            <b>{snapshot.travel.destination === 'home' ? '우리 집으로' : '마당으로'}</b>
            <small>
              {snapshot.travel.stage === 'approach'
                ? '문 앞까지 걸어가고 있어요'
                : '문을 통과하고 있어요'}
            </small>
          </span>
          <button className="outline" disabled={!enabled} onClick={() => engine.cancelTravel()}>
            이동 취소
          </button>
        </div>
      )}
      {page !== 'home' && homeProgress}
      {snapshot.place === 'adventure' && p.chosen && !page && !snapshot.travel && (
        <section className="combat-controls glass" aria-label="전투 조작">
          <div className="combat-target">
            <div>
              <small>
                {snapshot.hunting
                  ? '자동사냥'
                  : snapshot.manualCombat
                    ? '수동 공격 · 처치 후 멈춤'
                    : '직접 사냥하기'}
              </small>
              <b>
                {snapshot.enemy
                  ? `${monsterById(snapshot.enemy.id).name} · ${snapshot.enemy.hp}/${snapshot.enemy.maxHp}`
                  : snapshot.autoResting
                    ? '회복 후 사냥을 재개해요'
                    : '몬스터를 누르면 이동해 공격해요'}
              </b>
            </div>
            {(snapshot.hunting || snapshot.manualCombat) && (
              <button
                className="outline"
                disabled={!enabled}
                onClick={() => setFeedback(engine.cancelAttack().message)}
              >
                <Square size={14} /> 공격 중단
              </button>
            )}
          </div>
          <div className="combat-skill-row">
            <button
              className="cast-skill"
              data-testid="cast-skill"
              aria-label={`스킬 사용: ${skill.name}`}
              disabled={skillDisabled}
              onClick={castSkill}
            >
              <Sparkles size={20} />
              <span>
                <b>{skill.name}</b>
                <small>
                  {snapshot.skillQueued
                    ? '접근 후 사용 대기'
                    : snapshot.skillCooldown > 0
                      ? `재사용 ${snapshot.skillCooldown}초`
                      : '눌러서 스킬 사용'}
                </small>
              </span>
            </button>
            <label className="auto-skill-option">
              <input
                type="checkbox"
                aria-label="자동사냥 시 스킬 자동 사용"
                checked={snapshot.autoSkill}
                disabled={!enabled || !readyScene}
                onChange={(e) => engine.setAutoSkill(e.target.checked)}
              />
              <span>
                자동사냥 시<br />
                스킬 자동 사용
              </span>
            </label>
          </div>
        </section>
      )}
      <div className="world-hint" hidden={atHome && p.chosen}>
        {!p.chosen ? (
          <button
            className="primary welcome-button"
            disabled={!enabled}
            onClick={() => setPicker(true)}
          >
            <PawPrint size={18} />
            친구 선택하기
            <ArrowRight size={17} />
          </button>
        ) : (
          <span className="walk-hint">
            {cameraMode === 'free'
              ? '맵을 끌어 원하는 곳을 둘러보세요'
              : snapshot.place === 'yard'
                ? '우리 집에 들어가 친구를 돌봐 주세요'
                : snapshot.hunting
                  ? snapshot.autoResting
                    ? '회복하면 자동으로 사냥을 이어가요'
                    : '가까운 몬스터를 차례로 자동 공격해요'
                  : '몬스터를 눌러 직접 사냥할 수 있어요'}
          </span>
        )}
      </div>
      <div className="game-meta">
        <span>
          <CheckCircle2 size={12} />
          {saveState}
        </span>
        {cameraMode === 'free' && (
          <button
            className="camera-return glass"
            aria-label="친구 따라가기"
            onClick={() =>
              useGame.setState({
                cameraMode: 'follow',
                activityCamera: Boolean(snapshot.homeActivity),
              })
            }
          >
            <LocateFixed size={16} /> 친구 따라가기
          </button>
        )}
        <button aria-label="도움말" onClick={() => setHelp(true)}>
          <CircleHelp size={18} />
        </button>
      </div>
      <div className={`feedback ${feedback ? 'visible' : ''}`} role="status" aria-live="polite">
        {feedback}
      </div>
      {mini && (
        <nav className="mini-toolbar glass" aria-label="미니 창 조작">
          <button
            disabled={!enabled || Boolean(snapshot.homeActivity)}
            aria-pressed={snapshot.hunting}
            onClick={() => {
              if (!p.chosen) {
                setPicker(true);
                return;
              }
              if (snapshot.place !== 'adventure') {
                setPage('map');
                return;
              }
              setFeedback(engine.toggleHunt().message);
              saveNow();
            }}
          >
            <Swords size={17} />
            <span>
              {snapshot.place !== 'adventure'
                ? '사냥터 입장'
                : snapshot.hunting
                  ? '자동사냥 OFF'
                  : '자동사냥 ON'}
            </span>
          </button>
          <button disabled={!enabled || p.coins < 15} onClick={() => buy('rice')}>
            <Utensils size={17} />
            <span>먹이 · 15코인</span>
          </button>
          <button onClick={returnToMain}>
            <Maximize2 size={17} />
            <span>본 화면으로</span>
          </button>
        </nav>
      )}
      {page && (
        <aside
          className="side-panel glass"
          id="game-panel"
          ref={panel}
          tabIndex={-1}
          aria-labelledby="panel-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              closePanel();
            }
          }}
        >
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">MOCHIPET</span>
              <h1 id="panel-title">
                {page === 'home' ? '집 안 활동' : navigation.find((n) => n.id === page)!.label}
              </h1>
            </div>
            <button className="icon-button" aria-label="패널 닫기" onClick={closePanel}>
              <X size={22} />
            </button>
          </div>
          <div className="panel-content">
            {page === 'home' && (
              <section className="home-panel">
                <p className="muted">
                  가구를 누르거나 활동을 골라 주세요. 모두 무료로 함께할 수 있어요.
                </p>
                <div className="pet-meters home-meters">
                  <Meter
                    label="배부름"
                    value={p.hunger}
                    color="#dfc08b"
                    icon={<Utensils size={14} />}
                  />
                  <Meter
                    label="행복"
                    value={p.happiness}
                    color="#a6bf9c"
                    icon={<Heart size={14} />}
                  />
                  <Meter label="체력" value={p.energy} color="#a9b9ce" icon={<Zap size={14} />} />
                  <Meter label="청결" value={p.hygiene} color="#9dc7bf" icon={<Bath size={14} />} />
                  <Meter
                    label="화장실 욕구"
                    value={p.toilet}
                    color="#d8b78f"
                    icon={<Toilet size={14} />}
                  />
                  <Meter
                    label="방 상태"
                    value={p.roomCleanliness}
                    color="#c4c994"
                    icon={<Bubbles size={14} />}
                  />
                </div>
                {homeProgress}
                <div className="home-activity-list">
                  {HOME_ACTIVITIES.map((a) => (
                    <button
                      key={a.id}
                      aria-label={a.name}
                      disabled={!enabled || Boolean(activity)}
                      onClick={() => doHomeActivity(a.id)}
                    >
                      <span>{a.icon}</span>
                      <div>
                        <b>
                          {a.name}
                          <small>{a.seconds}초</small>
                        </b>
                        <p>{a.description}</p>
                        <small>
                          {a.furniture} · 완료 {p.homeActivities[a.id] ?? 0}회
                        </small>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
                <button
                  className="outline full-width"
                  disabled={!enabled}
                  onClick={() => {
                    engine.requestTravel('yard');
                    closePanel();
                    saveNow();
                  }}
                >
                  <Leaf size={15} />
                  마당으로 나가기
                </button>
                <p className="fine-print">
                  활동은 가구에 도착한 뒤 시작해요. 취소·외출·새로고침하면 완료 보상은 받지 않아요.
                  탭을 숨기면 진행을 멈춰요.
                </p>
              </section>
            )}
            {page === 'map' && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>사냥터에 입장해 모험을 떠나요</h2>
                    <p>몬스터가 최대 5마리 나타나요. 몬스터를 누르거나 자동사냥을 켜 보세요.</p>
                  </div>
                  <span className="small-note">사냥터 4곳</span>
                </div>
                <button
                  className="outline full-width yard-link"
                  disabled={!enabled}
                  onClick={() => {
                    engine.requestTravel('yard');
                    closePanel();
                  }}
                >
                  <House size={16} />집 앞 마당으로
                </button>
                <div className="zone-grid">
                  {ZONES.map((z, i) => {
                    const locked = p.level < z.level;
                    return (
                      <button
                        className={`zone-card zone-${i} ${snapshot.place === 'adventure' && p.zoneId === z.id ? 'selected' : ''}`}
                        key={z.id}
                        disabled={!enabled || locked}
                        onClick={() => {
                          const result = engine.setZone(z.id);
                          setFeedback(result.message);
                          if (result.ok) {
                            closePanel();
                            saveNow();
                          }
                        }}
                        aria-label={`${z.name} 입장 · Lv.${z.level} 이상${locked ? ' · 잠김' : ''}`}
                        aria-pressed={snapshot.place === 'adventure' && p.zoneId === z.id}
                      >
                        <div className="zone-art">
                          <span>{z.emoji}</span>
                          <div className="mini-hill" />
                          {locked && (
                            <span className="zone-lock">
                              <LockKeyhole size={16} />
                            </span>
                          )}
                        </div>
                        <div className="zone-info">
                          <span>
                            <b>{z.name}</b>
                            <small>Lv.{z.level} 이상</small>
                          </span>
                          {snapshot.place === 'adventure' && p.zoneId === z.id ? (
                            <span className="zone-selected">
                              <Check size={13} /> 머무는 중
                            </span>
                          ) : (
                            <span className="zone-selected">
                              {locked ? '레벨 부족' : '입장하기'}
                              <ChevronRight size={16} />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {page === 'shop' && (
              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <h2>친구를 위한 작은 선물</h2>
                    <p>구매한 음식과 장난감은 바로 사용돼요.</p>
                  </div>
                  <div className="filter-tabs">
                    {[
                      ['all', '전체'],
                      ['food', '음식'],
                      ['toy', '장난감'],
                      ['training', '훈련'],
                      ['skill', '스킬'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={shopFilter === id ? 'selected' : ''}
                        aria-pressed={shopFilter === id}
                        onClick={() => setShopFilter(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="shop-grid">
                  {SHOP.filter((i) => shopFilter === 'all' || i.category === shopFilter).map(
                    (item) => {
                      const count = p.purchases[item.id] ?? 0;
                      const capped = Boolean(item.limit && count >= item.limit);
                      return (
                        <article className="shop-item" key={item.id}>
                          <span className={`item-art ${item.category}`}>{item.icon}</span>
                          <div>
                            <h3>{item.name}</h3>
                            <p>{item.description}</p>
                            <small>
                              Lv.{item.level}+{item.limit ? ` · 구매 ${count}/${item.limit}` : ''}
                            </small>
                          </div>
                          <button
                            className="outline"
                            disabled={
                              !enabled || p.coins < item.price || p.level < item.level || capped
                            }
                            aria-label={`${item.name} 구매 ${item.price} 코인`}
                            onClick={() => buy(item.id)}
                          >
                            <Coins size={14} />
                            {capped ? '한도 도달' : item.price}
                          </button>
                        </article>
                      );
                    },
                  )}
                </div>
              </section>
            )}
            {page === 'pet' && (
              <section className="content-section pet-details">
                <div className="section-heading">
                  <div>
                    <h2>{p.name}의 이야기</h2>
                    <p>{char.tagline}</p>
                  </div>
                  <span className="tag">친밀도 {p.bond} / 100</span>
                </div>
                <div className="pet-meters">
                  <Meter label="청결" value={p.hygiene} color="#9dc7bf" icon={<Bath size={14} />} />
                  <Meter
                    label="화장실 욕구"
                    value={p.toilet}
                    color="#d8b78f"
                    icon={<Toilet size={14} />}
                  />
                  <Meter
                    label="건강"
                    value={p.hp}
                    max={maxHp(p)}
                    color="#e6a89b"
                    icon={<Heart size={14} />}
                  />
                  <Meter
                    label="배부름"
                    value={p.hunger}
                    color="#dfc08b"
                    icon={<Utensils size={14} />}
                  />
                  <Meter
                    label="행복"
                    value={p.happiness}
                    color="#a6bf9c"
                    icon={<Sparkles size={14} />}
                  />
                  <Meter label="체력" value={p.energy} color="#a9b9ce" icon={<Zap size={14} />} />
                </div>
                <button
                  className="outline change-friend"
                  disabled={!enabled}
                  onClick={() => setPicker(true)}
                >
                  <PawPrint size={16} />
                  {p.chosen ? '친구 바꾸기' : '친구 선택하기'}
                </button>
                <form
                  className="name-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setFeedback(engine.rename(draftName).message);
                    saveNow();
                  }}
                >
                  <label htmlFor="pet-name">친구의 이름</label>
                  <input
                    id="pet-name"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    maxLength={16}
                    required
                    disabled={!enabled}
                  />
                  <button type="submit" className="outline" disabled={!enabled}>
                    <Pencil size={15} /> 이름 바꾸기
                  </button>
                </form>
                <div className="stat-grid">
                  {[
                    [Swords, '공격력', attack(p)],
                    [Shield, '방어력', defense(p)],
                    [Wind, '민첩성', agility(p)],
                    [Heart, '최대 HP', maxHp(p)],
                  ].map(([Icon, label, value]) => {
                    const I = Icon as typeof Swords;
                    return (
                      <div key={String(label)}>
                        <I size={20} />
                        <span>{String(label)}</span>
                        <b>{String(value)}</b>
                      </div>
                    );
                  })}
                </div>
                <div className="info-block">
                  <Sparkles size={23} />
                  <div>
                    <h3>나만의 시작 스킬 · {skill.name}</h3>
                    <p>
                      {skill.description} 강화 +{p.skillRank} · 재사용 {skill.cooldown}초
                    </p>
                  </div>
                </div>
                <p className="fine-print">
                  이 버전에서는 친구의 외형을 바꿔도 레벨, 코인, 구매한 강화가 이어져요. 고유 기본
                  스킬은 새 친구의 스킬로 바뀌어요.
                </p>
              </section>
            )}
            {page === 'skills' && (
              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <h2>28개의 반짝임</h2>
                    <p>
                      사냥터의 스킬 버튼으로 직접 사용해요. 자동사냥 중 스킬 자동 사용도 선택할 수
                      있어요.
                    </p>
                  </div>
                  <span className="tag">강화 +{p.skillRank}</span>
                </div>
                <div className="skill-grid">
                  {CHARACTERS.map((c) => {
                    const s = SKILLS.find((s) => s.id === c.skillId)!;
                    const active = c.id === p.characterId;
                    return (
                      <article className={`skill-card ${active ? 'equipped' : ''}`} key={c.id}>
                        <img loading="lazy" src={petAsset(c.id)} alt="" width="64" height="64" />
                        <div>
                          <small>
                            {c.name}
                            {active ? ' · 장착 중' : ''}
                          </small>
                          <h3>{s.name}</h3>
                          <p>{s.description}</p>
                          <span>
                            위력 {s.power + (active ? p.skillRank * 3 : 0)} · {s.cooldown}초 ·{' '}
                            {s.effect === 'heal'
                              ? '회복'
                              : s.effect === 'poison'
                                ? '중독'
                                : s.effect === 'guard'
                                  ? '방어'
                                  : '공격'}
                          </span>
                          {active && snapshot.place === 'adventure' && (
                            <button
                              className="outline"
                              disabled={skillDisabled}
                              onClick={castSkill}
                            >
                              <Sparkles size={15} />{' '}
                              {snapshot.skillCooldown > 0
                                ? `재사용 ${snapshot.skillCooldown}초`
                                : snapshot.skillQueued
                                  ? '사용 대기 중'
                                  : '스킬 사용'}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            {page === 'journal' && (
              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <h2>함께 쌓은 발자국</h2>
                    <p>작은 성취도 차곡차곡 기억해요.</p>
                  </div>
                </div>
                <div className="stat-grid">
                  <div>
                    <Swords size={21} />
                    <span>처치한 몬스터</span>
                    <b data-testid="kills">{p.kills}</b>
                  </div>
                  <div>
                    <Sprout size={21} />
                    <span>현재 레벨</span>
                    <b>{p.level} / 20</b>
                  </div>
                  <div>
                    <Heart size={21} />
                    <span>친밀도</span>
                    <b>{p.bond}</b>
                  </div>
                  <div>
                    <MapPin size={21} />
                    <span>열린 사냥터</span>
                    <b>{ZONES.filter((z) => z.level <= p.level).length} / 4</b>
                  </div>
                </div>
                <h3 className="log-heading">이번 접속의 모험 소식</h3>
                <div className="event-log">
                  {snapshot.events
                    .filter((e) => !['damage', 'hurt'].includes(e.kind))
                    .reverse()
                    .map((e) => (
                      <div key={e.id}>
                        <span>✧</span>
                        {e.message}
                      </div>
                    ))}
                  {snapshot.events.length === 0 && (
                    <p>아직 고요한 아침이에요. 첫 모험을 시작해 볼까요?</p>
                  )}
                </div>
              </section>
            )}
            {page === 'settings' && (
              <section className="content-section settings-panel">
                <h2>기록과 플레이</h2>
                <div className="setting-row mini-setting">
                  <div>
                    <h3>미니 펫 창 · PiP</h3>
                    <p>
                      {miniSupported
                        ? '작은 별도 창에서 같은 친구로 계속 플레이해요. 본 화면 탭은 열어 두세요.'
                        : '이 브라우저에서는 조작 가능한 PiP를 지원하지 않아요. 일반 화면으로 플레이해 주세요.'}
                    </p>
                  </div>
                  <button
                    className="outline"
                    disabled={!enabled || !readyScene || !miniSupported}
                    onClick={mini ? returnToMain : enterMiniWindow}
                  >
                    <PictureInPicture2 size={17} />
                    {mini ? '본 화면으로' : '미니 창 열기'}
                  </button>
                </div>
                <p className="fine-print">
                  미니 창이 보이면 자동사냥을 이어가요. 브라우저 절전·창 최소화로 진행이 멈출 수
                  있고 본 탭을 닫으면 미니 창도 닫혀요.
                </p>
                <p>
                  이 브라우저에 자동 저장해요. 계정 연결과 기기 간 동기화는 다음 단계에서 제공할
                  예정이에요.
                </p>
                <div className="setting-row">
                  <div>
                    <h3>지금 저장하기</h3>
                    <p>{saveState} · 10초마다, 구매 후, 탭을 떠날 때 저장해요.</p>
                  </div>
                  <button className="outline" disabled={!enabled} onClick={saveNow}>
                    저장
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>기록 내보내기</h3>
                    <p>현재 기록과 이전 백업을 개인 파일로 보관해요.</p>
                  </div>
                  <button
                    className="outline"
                    onClick={() => {
                      try {
                        const raw = JSON.stringify(
                          {
                            current: localStorage.getItem(SAVE_KEY),
                            previous: localStorage.getItem(BACKUP_KEY),
                            beforeReset: localStorage.getItem(RESET_KEY),
                            beforeHomeUpgrade: localStorage.getItem(HOME_UPGRADE_KEY),
                          },
                          null,
                          2,
                        );
                        const url = URL.createObjectURL(
                          new Blob([raw], { type: 'application/json' }),
                        );
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'mochipet-personal-backup.json';
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      } catch {
                        setFeedback('기록을 내보내지 못했어요. 저장 권한을 확인해 주세요.');
                      }
                    }}
                  >
                    <Download size={15} />
                    내보내기
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>새로운 모험 시작</h3>
                    <p>확인 후 현재·이전 저장 원본을 백업하고 초기화해요.</p>
                  </div>
                  <button
                    className="outline danger"
                    disabled={access === 'blocked' || access === 'loading'}
                    onClick={() => setReset(true)}
                  >
                    초기화
                  </button>
                </div>
                <div className="info-block">
                  <Leaf size={24} />
                  <div>
                    <h3>가볍게, 천천히</h3>
                    <p>
                      게임은 30 FPS를 목표로 렌더링해요. 본 화면과 미니 창이 모두 보이지 않으면
                      진행을 멈춰요. 탭 종료·자리 비움 보상은 아직 제공하지 않아요.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </aside>
      )}
      {picker && <CharacterPicker onClose={() => setPicker(false)} />}
      {help && (
        <Modal title="반가워요, 모찌의 세상에!" onClose={() => setHelp(false)}>
          <div className="help-content">
            <span>🌿</span>
            <h3>우리의 첫 모험, 이렇게 시작해요.</h3>
            <ol>
              <li>28종 중 마음이 가는 친구를 선택해 주세요.</li>
              <li>
                사냥터에서 몬스터를 누르면 그 대상에게 가서 공격해요. 스킬 버튼으로 고유 스킬을
                사용해요.
              </li>
              <li>
                자동사냥 ON을 누르면 가까운 몬스터부터 차례로 싸워요. 스킬 자동 사용도 선택할 수
                있어요.
              </li>
              <li>모은 코인으로 음식, 장난감, 훈련을 선물해 주세요.</li>
              <li>맵의 땅을 누르면 그곳으로 산책해요. 양옆 버튼으로 기능을 열어요.</li>
              <li>
                우리 집 버튼이나 마당의 집을 누르면 실내로 들어가요. 가구에서 밥
                먹기·목욕·화장실·놀이·독서·수면·청소를 함께해요.
              </li>
              <li>HP가 부족하면 쉬어요. 새로운 레벨에서 사냥터가 열려요.</li>
            </ol>
            <p>
              현재는 이 브라우저에서 즐기는 싱글 모험이에요. 계정·온라인 월드·자리 비움 보상·PWA는
              준비 중이에요. 설정에서 지원되는 PC 브라우저의 PiP 미니 창을 열 수 있어요.
            </p>
          </div>
          <button className="primary full-width" onClick={() => setHelp(false)}>
            좋아요, 시작해 볼게요
          </button>
        </Modal>
      )}
      {reset && (
        <Modal title="새로운 모험을 시작할까요?" onClose={() => setReset(false)}>
          <p>
            레벨, 코인, 구매 내역을 초기화해요. 초기화 전 원본은 이 브라우저에 백업되지만 브라우저
            데이터 삭제 시 함께 사라져요.
          </p>
          <p>설정의 ‘기록 내보내기’로 개인 백업을 먼저 보관할 수 있어요.</p>
          <div className="modal-actions">
            <button className="outline" onClick={() => setReset(false)}>
              돌아가기
            </button>
            <button
              className="primary danger"
              onClick={() => {
                if (resetGame()) setReset(false);
              }}
            >
              백업 후 초기화
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
