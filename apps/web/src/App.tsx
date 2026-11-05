import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Home,
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
  ArrowUpRight,
  Moon,
  CircleHelp,
  CloudOff,
  CheckCircle2,
  Play,
  Square,
  Pencil,
  Sprout,
  ArrowRight,
  Download,
} from 'lucide-react';
import {
  CHARACTERS,
  SHOP,
  SKILLS,
  ZONES,
  characterById,
  petAsset,
  type Character,
} from '@mochi/game-data';
import { MAX_LEVEL, agility, attack, defense, maxHp, xpForLevel } from '@mochi/shared';
import { GameCanvas } from './game/GameCanvas';
import { resetGame, saveNow, startSession, useGame } from './state/game';
import { BACKUP_KEY, RESET_KEY, SAVE_KEY } from './state/storage';
type Page = 'home' | 'pet' | 'shop' | 'skills' | 'journal' | 'settings';
const navigation = [
  { id: 'home', label: '우리의 하루', icon: Home },
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
  const [page, setPage] = useState<Page>('home');
  const [picker, setPicker] = useState(false);
  const [help, setHelp] = useState(false);
  const [reset, setReset] = useState(false);
  const [shopFilter, setShopFilter] = useState('all');
  const { engine, snapshot, access, notice, saveState, readyScene } = useGame();
  const p = snapshot.pet;
  const char = characterById(p.characterId)!;
  const skill = SKILLS.find((s) => s.id === char.skillId)!;
  const zone = ZONES.find((z) => z.id === p.zoneId)!;
  const enabled = access === 'ready';
  const [draftName, setDraftName] = useState(p.name);
  const [feedback, setFeedback] = useState('');
  useEffect(startSession, []);
  useEffect(() => setDraftName(p.name), [p.name]);
  function buy(id: string) {
    if (!enabled) return;
    const result = engine.purchase(id);
    setFeedback(result.message);
    if (result.ok) saveNow();
  }
  function changePage(id: Page) {
    setPage(id);
    setFeedback('');
  }
  const progress = p.level === MAX_LEVEL ? 100 : Math.round((p.xp / xpForLevel(p.level)) * 100);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          aria-label="모찌펫 홈"
          onClick={(e) => {
            e.preventDefault();
            changePage('home');
          }}
        >
          <span className="brand-mark">
            <PawPrint size={25} fill="currentColor" />
          </span>
          <span>
            모찌펫<small>MOCHIPET RPG</small>
          </span>
        </a>
        <div className="sidebar-label">MY LITTLE WORLD</div>
        <nav aria-label="메인 메뉴">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => changePage(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === 'shop' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="world-note">
            <span>🌙</span>
            <b>더 넓은 세상에서 만나요</b>
            <p>
              레벨 20 이후의 온라인 월드를
              <br />
              준비하고 있어요.
            </p>
            <div>
              <LockKeyhole size={12} /> 온라인 월드 · 준비 중
            </div>
          </div>
          <button className="quiet help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={17} /> 처음 오셨나요?
            <ArrowUpRight size={15} />
          </button>
          <small className="version">WEB MVP · PHASE 01</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>나의 작은 세상</span>
            <ChevronRight size={14} />
            <b>{navigation.find((n) => n.id === page)!.label}</b>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <span /> 로컬 모험
            </span>
            <div className="coin-wallet" aria-label={`보유 코인 ${p.coins}`}>
              <Coins size={18} />
              <b data-testid="coins">{p.coins.toLocaleString()}</b>
              <span>코인</span>
            </div>
            <button
              className="avatar-button"
              aria-label="나의 친구 열기"
              onClick={() => changePage('pet')}
            >
              <img src={petAsset(p.characterId)} alt="" />
            </button>
          </div>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <Sprout size={15} /> LITTLE MOMENTS, BIG ADVENTURES
              </div>
              <h1>
                {page === 'home' ? (
                  <>
                    작은 친구와, 포근한 하루<span className="heading-leaf">☘</span>
                  </>
                ) : (
                  navigation.find((n) => n.id === page)!.label
                )}
              </h1>
              <p>
                {page === 'home'
                  ? '서두르지 않아도 괜찮아요. 오늘도 모찌와 한 뼘 더 자라요.'
                  : page === 'shop'
                    ? '작은 선물 하나로, 친구의 하루를 더 행복하게.'
                    : page === 'pet'
                      ? '나만의 속도로 자라나는, 세상에 하나뿐인 친구.'
                      : page === 'skills'
                        ? '작은 친구 안에 숨어 있는 반짝이는 힘을 만나 보세요.'
                        : page === 'journal'
                          ? '함께 걸어온 모든 순간이 모험이 돼요.'
                          : '편안하고 안전하게, 우리의 작은 세상을 돌봐요.'}
              </p>
            </div>
            <button
              className="outline change-friend"
              onClick={() => setPicker(true)}
              disabled={!enabled}
            >
              <PawPrint size={16} />
              {p.chosen ? '친구 바꾸기' : '친구 선택하기'}
            </button>
          </div>
          {(notice || access === 'loading') && (
            <div
              className={`notice ${access === 'blocked' || access === 'readonly' ? 'warning' : ''}`}
              role="status"
            >
              <CloudOff size={17} />
              <span>{notice || '친구의 기록을 불러오고 있어요.'}</span>
            </div>
          )}
          <div className="play-layout">
            <section className="adventure-card" aria-labelledby="adventure-title">
              <div className="scene-header">
                <div>
                  <span className="scene-location">
                    <MapPin size={14} /> 현재 사냥터
                  </span>
                  <h2 id="adventure-title">
                    {zone.name} <span>Lv.{zone.level}+</span>
                  </h2>
                </div>
                <span className={`activity-badge ${snapshot.hunting ? 'hunting' : ''}`}>
                  <span />
                  {snapshot.hunting
                    ? '모험 중'
                    : snapshot.action === 'sleep'
                      ? '쉬는 중'
                      : '자유 산책'}
                </span>
              </div>
              <div className="scene-wrap">
                <GameCanvas />
                <div className="scene-caption">
                  <Leaf size={13} />
                  {snapshot.hunting
                    ? '친구가 스스로 몬스터를 찾아가요'
                    : snapshot.action === 'sleep'
                      ? '잠깐의 쉼도 모험의 일부예요'
                      : '햇살 좋은 날, 마음 가는 대로 걸어요'}
                </div>
                {!readyScene && <div className="scene-loading">작은 세상을 불러오는 중…</div>}
              </div>
              <div className="scene-controls">
                <div className="control-description">
                  <span className="soft-icon">
                    <Swords size={20} />
                  </span>
                  <div>
                    <b>{snapshot.hunting ? '모험을 즐기고 있어요' : '모험을 떠나 볼까요?'}</b>
                    <small>
                      {p.chosen
                        ? '사냥은 자동으로 진행돼요. HP가 낮으면 쉬어요.'
                        : '함께할 친구를 선택하면 모험을 시작할 수 있어요.'}
                    </small>
                  </div>
                </div>
                <button
                  data-testid="hunt"
                  className={snapshot.hunting ? 'hunt-button stop' : 'hunt-button'}
                  disabled={!enabled}
                  aria-pressed={snapshot.hunting}
                  onClick={() => {
                    if (!p.chosen) {
                      setPicker(true);
                      return;
                    }
                    setFeedback(engine.toggleHunt().message);
                    saveNow();
                  }}
                >
                  {snapshot.hunting ? (
                    <Square size={15} fill="currentColor" />
                  ) : (
                    <Play size={15} fill="currentColor" />
                  )}
                  {p.chosen ? (snapshot.hunting ? '사냥 OFF' : '사냥 ON') : '친구 선택'}
                </button>
              </div>
            </section>
            <aside className="pet-card" aria-label="펫 상태">
              <div className="pet-card-title">
                <h2>나의 작은 친구</h2>
                <span className="tag">{char.mbti ?? '십이지신'}</span>
              </div>
              <div className="pet-identity">
                <div className="portrait">
                  <img
                    src={petAsset(p.characterId, snapshot.action === 'sleep' ? 'sleep' : 'idle')}
                    alt={char.animal}
                  />
                  <span>Lv.{p.level}</span>
                </div>
                <div>
                  <h3>
                    {p.name}
                    <span>✦</span>
                  </h3>
                  <p>
                    {char.name} · {p.chosen ? '우리의 모험은 계속돼요' : '새로운 만남을 기다려요'}
                  </p>
                  <div className="xp-label">
                    <b>
                      {p.level === MAX_LEVEL
                        ? '싱글 최고 레벨'
                        : `다음 레벨까지 ${xpForLevel(p.level) - p.xp} XP`}
                    </b>
                    <span>{progress}%</span>
                  </div>
                  <div className="xp-track">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
              <div className="pet-meters">
                <Meter
                  label="건강"
                  value={p.hp}
                  max={maxHp(p)}
                  color="#d9a6ad"
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
              <div className="care-buttons">
                <button
                  disabled={!enabled}
                  onClick={() => {
                    setFeedback(engine.care('pet').message);
                    saveNow();
                  }}
                >
                  <Heart size={15} />
                  쓰다듬기
                </button>
                <button
                  disabled={!enabled}
                  onClick={() => {
                    setFeedback(engine.care('rest').message);
                    saveNow();
                  }}
                >
                  <Moon size={15} />
                  쉬기
                </button>
              </div>
              <div className="save-caption">
                <CheckCircle2 size={12} />
                <span>{saveState}</span>
              </div>
            </aside>
          </div>
          <div className="feedback" role="status" aria-live="polite">
            {feedback}
          </div>
          {page === 'home' && (
            <>
              <div className="section-heading">
                <div>
                  <h2>오늘은 어디로 갈까요?</h2>
                  <p>친구가 자라는 만큼, 새로운 길이 열려요.</p>
                </div>
                <span className="small-note">사냥터 4곳</span>
              </div>
              <div className="zone-grid">
                {ZONES.map((z, i) => {
                  const locked = p.level < z.level;
                  return (
                    <button
                      className={`zone-card zone-${i} ${p.zoneId === z.id ? 'selected' : ''}`}
                      key={z.id}
                      disabled={!enabled || locked}
                      onClick={() => {
                        setFeedback(engine.setZone(z.id).message);
                        saveNow();
                      }}
                      aria-pressed={p.zoneId === z.id}
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
                        {p.zoneId === z.id ? (
                          <span className="zone-selected">
                            <Check size={13} /> 머무는 중
                          </span>
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="bottom-strip">
                <div>
                  <span className="tip-icon">✧</span>
                  <p>
                    <b>작은 돌봄이 큰 모험의 시작.</b> 맛있는 음식과 장난감을 선물해 보세요.
                  </p>
                </div>
                <button className="text-button" onClick={() => changePage('shop')}>
                  상점 둘러보기
                  <ArrowRight size={15} />
                </button>
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
                  <p>선택한 친구의 고유 스킬이 전투 중 자동으로 발동해요.</p>
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
                    게임은 30 FPS를 목표로 렌더링해요. 숨겨진 탭에서는 진행을 멈춰요. 탭 종료·자리
                    비움 보상은 아직 제공하지 않아요.
                  </p>
                </div>
              </div>
            </section>
          )}
          <footer className="footer">
            <span>
              <Leaf size={13} /> 오늘도 너의 속도로, 모찌펫
            </span>
            <span>
              기록은 이 브라우저에 보관돼요 <span className="footer-dot">·</span> 오프라인 레벨 최대
              20
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="모바일 메뉴">
        {navigation
          .filter((n) => n.id !== 'settings')
          .map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => changePage(id)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        <button aria-label="설정" onClick={() => changePage('settings')}>
          <Settings size={20} />
          <span>설정</span>
        </button>
      </nav>
      {picker && <CharacterPicker onClose={() => setPicker(false)} />}
      {help && (
        <Modal title="반가워요, 모찌의 세상에!" onClose={() => setHelp(false)}>
          <div className="help-content">
            <span>🌿</span>
            <h3>우리의 첫 모험, 이렇게 시작해요.</h3>
            <ol>
              <li>28종 중 마음이 가는 친구를 선택해 주세요.</li>
              <li>사냥 ON을 누르면 친구가 몬스터를 찾아가 싸워요.</li>
              <li>모은 코인으로 음식, 장난감, 훈련을 선물해 주세요.</li>
              <li>HP가 부족하면 쉬어요. 새로운 레벨에서 사냥터가 열려요.</li>
            </ol>
            <p>
              현재는 이 브라우저에서 즐기는 싱글 모험이에요. 계정·온라인 월드·자리 비움 보상·미니
              창·PWA는 준비 중이며, 탭을 숨기면 진행을 멈춰요.
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
    </div>
  );
}
