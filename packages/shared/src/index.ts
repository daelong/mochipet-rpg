import { z } from 'zod';
import { nearestEnemy, spawnPosition, type Point } from './hunting';
export { nearestEnemy, spawnPosition } from './hunting';
import {
  CHARACTERS,
  HUNTING_RULES,
  SHOP,
  ZONES,
  characterById,
  skillById,
  monsterById,
  type Monster,
  homeActivityById,
  type HomeActivityId,
} from '@mochi/game-data';
export const MAX_LEVEL = 20;
export const SCHEMA_VERSION = 2;
const integer = (min: number, max: number) => z.number().int().min(min).max(max);
const ids = CHARACTERS.map((c) => c.id) as [string, ...string[]];
export const PetSchema = z
  .object({
    schema: z.literal(SCHEMA_VERSION),
    characterId: z.enum(ids),
    name: z
      .string()
      .trim()
      .min(1)
      .max(16)
      .refine((s) => !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(s)),
    chosen: z.boolean(),
    level: integer(1, MAX_LEVEL),
    xp: integer(0, 10000),
    coins: integer(0, 1000000),
    hp: integer(0, 1000),
    hunger: integer(0, 100),
    happiness: integer(0, 100),
    energy: integer(0, 100),
    bond: integer(0, 100),
    hygiene: integer(0, 100),
    toilet: integer(0, 100),
    roomCleanliness: integer(0, 100),
    homeActivities: z.record(
      z.enum(['meal', 'bath', 'toilet', 'play', 'read', 'sleep', 'clean']),
      integer(0, 1000000),
    ),
    attackBonus: integer(0, 100),
    defenseBonus: integer(0, 50),
    agilityBonus: integer(0, 19),
    hpBonus: integer(0, 200),
    skillRank: integer(0, 20),
    zoneId: z.enum(['meadow', 'forest', 'cave', 'moonhill']),
    kills: integer(0, 1000000),
    purchases: z
      .record(z.string(), integer(0, 1000000))
      .refine((p) => Object.keys(p).every((k) => SHOP.some((s) => s.id === k))),
    savedAt: integer(0, 9007199254740991),
  })
  .strict();
export type Pet = z.infer<typeof PetSchema>;
const LegacyPetSchema = PetSchema.omit({
  hygiene: true,
  toilet: true,
  roomCleanliness: true,
  homeActivities: true,
})
  .extend({ schema: z.literal(1) })
  .strict();
export const xpForLevel = (level: number) => 35 + level * 20;
export function maxHp(p: Pet) {
  return characterById(p.characterId)!.stats.hp + (p.level - 1) * 7 + p.hpBonus;
}
export function attack(p: Pet) {
  return characterById(p.characterId)!.stats.attack + (p.level - 1) * 2 + p.attackBonus;
}
export function defense(p: Pet) {
  return (
    characterById(p.characterId)!.stats.defense + Math.floor((p.level - 1) / 2) + p.defenseBonus
  );
}
export function agility(p: Pet) {
  return characterById(p.characterId)!.stats.agility + p.agilityBonus;
}
export function defaults(): Pet {
  return {
    schema: SCHEMA_VERSION,
    characterId: 'z_rabbit',
    name: '모찌',
    chosen: false,
    level: 1,
    xp: 0,
    coins: 60,
    hp: 60,
    hunger: 82,
    happiness: 80,
    energy: 85,
    bond: 0,
    hygiene: 80,
    toilet: 20,
    roomCleanliness: 85,
    homeActivities: {},
    attackBonus: 0,
    defenseBonus: 0,
    agilityBonus: 0,
    hpBonus: 0,
    skillRank: 0,
    zoneId: 'meadow',
    kills: 0,
    purchases: {},
    savedAt: 0,
  };
}
export function parsePet(raw: unknown): Pet {
  if (raw && typeof raw === 'object' && 'schema' in raw && raw.schema === 1) {
    const old = LegacyPetSchema.parse(raw);
    raw = {
      ...old,
      schema: SCHEMA_VERSION,
      hygiene: 80,
      toilet: 20,
      roomCleanliness: 85,
      homeActivities: {},
    };
  }
  const p = PetSchema.parse(raw);
  if (p.hp > maxHp(p) || p.xp >= xpForLevel(p.level) || (p.level === MAX_LEVEL && p.xp !== 0))
    throw new Error('Invalid progression');
  if (ZONES.find((z) => z.id === p.zoneId)!.level > p.level) throw new Error('Locked zone');
  for (const item of SHOP)
    if (item.limit && (p.purchases[item.id] ?? 0) > item.limit)
      throw new Error('Purchase limit exceeded');
  return p;
}
export type Action = 'idle' | 'walk' | 'attack' | 'sleep' | 'eat' | 'play' | 'happy';
export interface Enemy extends Point {
  uid: number;
  id: string;
  hp: number;
  maxHp: number;
  poisonTicks: number;
}
export interface GameEvent {
  id: number;
  kind: 'damage' | 'hurt' | 'skill' | 'reward' | 'level' | 'notice' | 'care';
  message: string;
  amount?: number;
  target?: 'pet' | 'monster';
  position?: Point;
  enemyUid?: number;
}
export interface Snapshot {
  pet: Pet;
  hunting: boolean;
  action: Action;
  enemy: Enemy | null;
  enemies: Enemy[];
  autoResting: boolean;
  targetUid: number | null;
  skillCooldown: number;
  events: GameEvent[];
  paused: boolean;
  place: Place;
  homeActivity: HomeActivityState | null;
}
export type Place = 'yard' | 'home' | 'adventure';
export interface HomeActivityState {
  id: HomeActivityId;
  remaining: number;
  started: boolean;
}
export type Result = { ok: true; message: string } | { ok: false; message: string };
/** Offline-only rules. A future server must own its own simulation and persisted economy. */
export class GameEngine {
  pet: Pet;
  hunting = false;
  action: Action = 'idle';
  enemies: Enemy[] = [];
  targetUid: number | null = null;
  autoResting = false;
  private nextEnemyUid = 0;
  private enemyTimers = new Map<number, { attack: number; poison: number }>();
  get enemy(): Enemy | null {
    return this.enemies.find((e) => e.uid === this.targetUid) ?? null;
  }
  paused = false;
  skillCooldown = 0;
  place: Place = 'yard';
  homeActivity: HomeActivityState | null = null;
  private attackCooldown = 0;
  private spawnCooldown = 0.5;
  private decay = 0;
  private healClock = 0;
  private actionClock = 0;
  private guard = 0;
  private eventId = 0;
  private events: GameEvent[] = [];
  private listeners = new Set<() => void>();
  private changed = false;
  private publishClock = 0;
  constructor(
    pet: Pet = defaults(),
    private random: () => number = Math.random,
  ) {
    this.pet = parsePet(pet);
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = (): Snapshot => ({
    pet: structuredClone(this.pet),
    hunting: this.hunting,
    action: this.action,
    enemy: this.enemy ? { ...this.enemy } : null,
    enemies: this.enemies.map((e) => ({ ...e })),
    autoResting: this.autoResting,
    targetUid: this.targetUid,
    skillCooldown: Math.ceil(this.skillCooldown),
    events: [...this.events],
    paused: this.paused,
    place: this.place,
    homeActivity: this.homeActivity ? { ...this.homeActivity } : null,
  });
  private emit() {
    this.changed = false;
    for (const cb of this.listeners) cb();
  }
  private event(
    kind: GameEvent['kind'],
    message: string,
    amount?: number,
    target?: GameEvent['target'],
    enemy?: Enemy,
  ) {
    this.events = [
      ...this.events.slice(-11),
      {
        id: ++this.eventId,
        kind,
        message,
        amount,
        target,
        ...(enemy ? { position: { x: enemy.x, y: enemy.y }, enemyUid: enemy.uid } : {}),
      },
    ];
    this.changed = true;
  }
  private notice(message: string, ok = true): Result {
    this.event('notice', message);
    this.emit();
    return { ok, message };
  }
  choose(id: string): Result {
    const c = characterById(id);
    if (!c) return this.notice('캐릭터를 찾을 수 없어요.', false);
    const ratio = this.pet.hp / maxHp(this.pet);
    const first = !this.pet.chosen;
    this.pet = { ...this.pet, characterId: c.id, chosen: true, hp: 0 };
    this.pet.hp = first ? maxHp(this.pet) : Math.floor(maxHp(this.pet) * ratio);
    this.stopHunt();
    this.homeActivity = null;
    this.event('notice', `${c.animal} 친구와 모험을 시작해요!`);
    this.emit();
    return { ok: true, message: '친구를 선택했어요.' };
  }
  rename(name: string): Result {
    const clean = name.trim();
    const parsed = PetSchema.shape.name.safeParse(clean);
    if (!parsed.success) return this.notice('이름은 제어문자 없이 1~16자로 적어 주세요.', false);
    this.pet.name = clean;
    return this.notice('새 이름을 기억했어요.');
  }
  setZone(id: string): Result {
    const z = ZONES.find((z) => z.id === id);
    if (!z || this.pet.level < z.level)
      return this.notice('아직 입장할 수 없는 사냥터예요.', false);
    if (!this.pet.chosen) return this.notice('먼저 함께할 친구를 선택해 주세요.', false);
    if (this.homeActivity) return this.notice('집에서 하던 활동을 마치거나 취소해 주세요.', false);
    if (this.place === 'adventure' && this.pet.zoneId === z.id)
      return this.notice(`이미 ${z.name}에 있어요. 자동사냥을 켜 보세요.`);
    this.stopHunt();
    this.clearEnemies();
    this.place = 'adventure';
    this.pet.zoneId = z.id;
    this.fillEnemies();
    return this.notice(`${z.name} 입장! 자동사냥을 켜면 가까운 몬스터를 찾아가요.`);
  }
  private clearEnemies() {
    this.enemies = [];
    this.enemyTimers.clear();
    this.targetUid = null;
    this.spawnCooldown = HUNTING_RULES.respawnSeconds;
  }
  private spawnEnemy() {
    const zone = ZONES.find((z) => z.id === this.pet.zoneId)!;
    const id =
      zone.monsters[
        Math.min(
          zone.monsters.length - 1,
          Math.floor(Math.max(0, this.random()) * zone.monsters.length),
        )
      ];
    const m = monsterById(id);
    const enemy: Enemy = {
      id,
      uid: ++this.nextEnemyUid,
      hp: m.hp,
      maxHp: m.hp,
      poisonTicks: 0,
      ...spawnPosition(this.enemies, this.random),
    };
    this.enemies.push(enemy);
    this.enemyTimers.set(enemy.uid, { attack: 1.5, poison: 0 });
    this.changed = true;
  }
  private fillEnemies() {
    while (this.enemies.length < HUNTING_RULES.maxMonsters) this.spawnEnemy();
    this.spawnCooldown = HUNTING_RULES.respawnSeconds;
  }
  stopHunt() {
    this.hunting = false;
    this.autoResting = false;
    this.targetUid = null;
    this.action = 'idle';
    this.attackCooldown = 0.2;
    this.guard = 0;
    for (const enemy of this.enemies) {
      enemy.poisonTicks = 0;
      this.enemyTimers.set(enemy.uid, { attack: 1.5, poison: 0 });
    }
  }
  toggleHunt(): Result {
    if (this.hunting) {
      this.stopHunt();
      return this.notice('자동사냥을 멈췄어요. 사냥터를 자유롭게 둘러보세요.');
    }
    if (!this.pet.chosen) return this.notice('먼저 함께할 친구를 선택해 주세요.', false);
    if (this.homeActivity) return this.notice('집에서 하던 활동을 마치거나 취소해 주세요.', false);
    if (this.place !== 'adventure')
      return this.notice('사냥터를 선택해 입장한 뒤 자동사냥을 켜 주세요.', false);
    this.hunting = true;
    this.actionClock = 0;
    this.action = 'walk';
    this.attackCooldown = 0.2;
    this.targetUid = null;
    this.autoResting = this.pet.hp <= Math.floor(maxHp(this.pet) * 0.25) || this.pet.energy < 10;
    if (this.autoResting) this.action = 'sleep';
    return this.notice(
      this.autoResting
        ? '먼저 쉬고 있어요. 충분히 회복하면 자동사냥을 시작해요.'
        : '자동사냥 시작! 가까운 몬스터를 차례로 찾아가요.',
    );
  }
  selectNearestTarget(origin: Point) {
    if (!this.hunting || this.autoResting || this.place !== 'adventure') return;
    if (this.enemy) return; // Finish the current target before moving to another one.
    this.targetUid = nearestEnemy(this.enemies, origin)?.uid ?? null;
    this.changed = true;
  }
  pause(value: boolean) {
    this.paused = value;
    this.emit();
  }
  care(kind: 'pet' | 'rest'): Result {
    if (this.homeActivity) return this.notice('지금 하던 활동을 마친 뒤 함께해요.', false);
    if (kind === 'rest' && this.place === 'home') return this.startHomeActivity('sleep');
    if (kind === 'rest') {
      this.stopHunt();
      this.action = 'sleep';
      this.actionClock = 15;
      return this.notice('포근한 낮잠 시간. 쉬는 동안 HP와 체력이 회복돼요.');
    }
    if (this.actionClock > 0)
      return this.notice('친구가 하던 행동을 마칠 때까지 기다려 주세요.', false);
    this.pet.happiness = Math.min(100, this.pet.happiness + 3);
    this.pet.bond = Math.min(100, this.pet.bond + 1);
    this.action = 'happy';
    this.actionClock = 5;
    this.event('care', '쓰다듬어 주니 기분이 좋아요!');
    this.emit();
    return { ok: true, message: '마음이 가까워졌어요.' };
  }
  purchase(id: string): Result {
    const item = SHOP.find((i) => i.id === id);
    if (!item) return this.notice('없는 상품이에요.', false);
    const p = this.pet;
    const count = p.purchases[id] ?? 0;
    if (p.level < item.level) return this.notice(`레벨 ${item.level}부터 살 수 있어요.`, false);
    if (item.limit && count >= item.limit) return this.notice('구매 한도에 도달했어요.', false);
    if (p.coins < item.price) return this.notice('코인이 조금 부족해요.', false);
    if (
      (item.effect === 'food' && p.hunger === 100 && p.energy === 100) ||
      (item.effect === 'heal' && p.hp === maxHp(p)) ||
      (item.effect === 'toy' && p.happiness === 100 && p.bond === 100)
    )
      return this.notice('이미 가득 회복되어 있어요.', false);
    p.coins -= item.price;
    p.purchases[id] = count + 1;
    switch (item.effect) {
      case 'food':
        p.hunger = Math.min(100, p.hunger + item.amount);
        p.energy = Math.min(100, p.energy + 10);
        break;
      case 'heal':
        p.hp = Math.min(maxHp(p), p.hp + item.amount);
        break;
      case 'toy':
        p.happiness = Math.min(100, p.happiness + item.amount);
        p.bond = Math.min(100, p.bond + 5);
        break;
      case 'attack':
        p.attackBonus += item.amount;
        break;
      case 'defense':
        p.defenseBonus += item.amount;
        break;
      case 'agility':
        p.agilityBonus += item.amount;
        break;
      case 'maxHp':
        p.hpBonus += item.amount;
        p.hp += item.amount;
        break;
      case 'skill':
        p.skillRank += item.amount;
        break;
    }
    if (!this.hunting && !this.homeActivity) {
      this.action = item.category === 'toy' ? 'play' : item.category === 'food' ? 'eat' : 'happy';
      this.actionClock = 3;
    }
    this.event('care', `${item.name} 구매 · −${item.price} 코인`);
    this.emit();
    return { ok: true, message: `${item.name} 구매 완료!` };
  }
  setPlace(place: Place): Result {
    if (!['yard', 'home', 'adventure'].includes(place))
      return this.notice('갈 수 없는 곳이에요.', false);
    this.homeActivity = null;
    this.actionClock = 0;
    if (place === 'adventure') return this.setZone(this.pet.zoneId);
    this.stopHunt();
    this.clearEnemies();
    this.place = place;
    return this.notice(
      place === 'home'
        ? '포근한 우리 집에 도착했어요.'
        : place === 'yard'
          ? '집 앞 마당으로 나왔어요.'
          : '사냥터로 산책을 나왔어요.',
    );
  }
  startHomeActivity(id: string): Result {
    const activity = homeActivityById(id);
    if (!activity || this.place !== 'home' || !this.pet.chosen)
      return this.notice('친구를 선택하고 집 안에서 활동해 주세요.', false);
    if (this.homeActivity) return this.notice('지금 하던 활동을 마치거나 취소해 주세요.', false);
    if (id === 'meal' && this.pet.hunger >= 95) return this.notice('지금은 배가 불러요.', false);
    if (id === 'bath' && this.pet.hygiene >= 95) return this.notice('아직 뽀송뽀송해요.', false);
    if (id === 'toilet' && this.pet.toilet <= 10)
      return this.notice('아직 화장실에 가지 않아도 괜찮아요.', false);
    if (id === 'clean' && this.pet.roomCleanliness >= 95)
      return this.notice('방이 이미 깨끗해요.', false);
    if (id === 'sleep' && this.pet.energy >= 95 && this.pet.hp === maxHp(this.pet))
      return this.notice('푹 쉬어서 잠이 오지 않아요.', false);
    if ((id === 'play' && this.pet.energy < 10) || (id === 'read' && this.pet.energy < 5))
      return this.notice('먼저 침대에서 쉬고 싶어요.', false);
    this.stopHunt();
    this.homeActivity = { id: activity.id, remaining: activity.seconds, started: false };
    this.actionClock = 0;
    this.action = 'walk';
    return this.notice(`${activity.furniture}로 가고 있어요.`);
  }
  arriveHomeActivity() {
    if (!this.homeActivity || this.homeActivity.started || this.place !== 'home') return;
    this.homeActivity.started = true;
    this.action = homeActivityById(this.homeActivity.id)!.animation;
    this.emit();
  }
  cancelHomeActivity(): Result {
    this.homeActivity = null;
    this.actionClock = 0;
    this.action = 'idle';
    return this.notice('활동을 멈췄어요. 완료한 돌봄만 기록해요.');
  }
  private finishHomeActivity() {
    const activity = homeActivityById(this.homeActivity!.id)!;
    this.homeActivity = null;
    for (const [stat, amount] of Object.entries(activity.effects)) {
      const key = stat as
        | 'hunger'
        | 'energy'
        | 'toilet'
        | 'hygiene'
        | 'happiness'
        | 'bond'
        | 'hp'
        | 'roomCleanliness';
      this.pet[key] = Math.max(
        0,
        Math.min(key === 'hp' ? maxHp(this.pet) : 100, this.pet[key] + amount),
      );
    }
    this.pet.homeActivities[activity.id] = Math.min(
      1000000,
      (this.pet.homeActivities[activity.id] ?? 0) + 1,
    );
    this.action = 'happy';
    this.actionClock = 2;
    this.event('care', `${activity.name} 완료!`);
    this.emit();
  }
  step(seconds: number, engagement: boolean | { uid: number; inRange: boolean }) {
    if (this.paused || !this.pet.chosen) return;
    const dt = Math.min(0.1, Math.max(0, seconds));
    if (!Number.isFinite(dt) || dt === 0) return;
    this.publishClock += dt;
    if (this.homeActivity?.started) {
      this.homeActivity.remaining = Math.max(0, this.homeActivity.remaining - dt);
      this.changed = true;
      if (this.homeActivity.remaining <= 0.001) this.finishHomeActivity();
    }
    this.actionClock = Math.max(0, this.actionClock - dt);
    this.guard = Math.max(0, this.guard - dt);
    const oldCooldown = Math.ceil(this.skillCooldown);
    this.skillCooldown = Math.max(0, this.skillCooldown - dt);
    if (Math.ceil(this.skillCooldown) !== oldCooldown) this.changed = true;
    this.decay += dt;
    this.healClock += dt;
    if (this.decay >= 30) {
      this.decay = 0;
      this.pet.hunger = Math.max(0, this.pet.hunger - 1);
      this.pet.happiness = Math.max(0, this.pet.happiness - 1);
      this.pet.hygiene = Math.max(0, this.pet.hygiene - (this.place === 'adventure' ? 2 : 1));
      this.pet.toilet = Math.min(100, this.pet.toilet + 2);
      if (this.place === 'home')
        this.pet.roomCleanliness = Math.max(0, this.pet.roomCleanliness - 1);
      if (this.pet.hygiene <= 30 || this.pet.roomCleanliness <= 30 || this.pet.toilet >= 80)
        this.pet.happiness = Math.max(0, this.pet.happiness - 1);
      if (this.hunting && !this.autoResting) this.pet.energy = Math.max(0, this.pet.energy - 2);
      this.changed = true;
    }
    if (this.place === 'adventure' && this.enemies.length < HUNTING_RULES.maxMonsters) {
      this.spawnCooldown -= dt;
      if (this.spawnCooldown <= 0) {
        this.spawnEnemy();
        this.spawnCooldown = HUNTING_RULES.respawnSeconds;
      }
    }
    if (
      this.hunting &&
      !this.autoResting &&
      (this.pet.hp <= Math.floor(maxHp(this.pet) * 0.25) || this.pet.energy < 5)
    ) {
      this.autoResting = true;
      this.targetUid = null;
      this.action = 'sleep';
      this.healClock = 0;
      this.event('notice', 'HP나 체력이 부족해요. 쉬고 난 뒤 자동으로 사냥을 이어가요.');
    }
    if (!this.hunting || this.autoResting) {
      if (this.homeActivity) this.healClock = 0;
      if (!this.homeActivity && this.healClock >= 2) {
        this.healClock = 0;
        this.pet.hp = Math.min(maxHp(this.pet), this.pet.hp + (this.action === 'sleep' ? 5 : 2));
        this.pet.energy = Math.min(100, this.pet.energy + 2);
        this.changed = true;
      }
      if (
        this.autoResting &&
        this.pet.hp >= Math.ceil(maxHp(this.pet) * HUNTING_RULES.recoverHpRatio) &&
        this.pet.energy >= HUNTING_RULES.recoverEnergy
      ) {
        this.autoResting = false;
        this.action = 'walk';
        this.attackCooldown = 0.2;
        this.event('notice', '충분히 쉬었어요. 자동사냥을 다시 시작해요!');
      } else if (
        !this.autoResting &&
        !this.homeActivity &&
        this.actionClock === 0 &&
        this.action !== 'walk' &&
        this.action !== 'idle'
      ) {
        this.action = 'idle';
        this.changed = true;
      }
    } else {
      this.healClock = 0;
      this.attackCooldown -= dt;
      // The scene supplies the exact instance it measured. A kill cannot redirect a stale range check.
      if (typeof engagement === 'boolean' && !this.enemy)
        this.targetUid = this.enemies[0]?.uid ?? null;
      const measuredUid = typeof engagement === 'boolean' ? this.targetUid : engagement.uid;
      const inRange = typeof engagement === 'boolean' ? engagement : engagement.inRange;
      for (const enemy of [...this.enemies]) {
        const timers = this.enemyTimers.get(enemy.uid)!;
        timers.attack -= dt;
        timers.poison += dt;
        if (enemy.poisonTicks > 0 && timers.poison >= 1) {
          timers.poison = 0;
          enemy.poisonTicks--;
          this.hit(enemy, 3 + this.pet.skillRank, '중독');
        }
      }
      const target = this.enemy;
      this.action = target && inRange && measuredUid === target.uid ? 'attack' : 'walk';
      if (target && inRange && measuredUid === target.uid) {
        if (this.attackCooldown <= 0) {
          this.attackCooldown = Math.max(0.45, 1.15 - agility(this.pet) * 0.025);
          this.hit(target, attack(this.pet), '공격');
        }
        if (this.enemy === target && this.skillCooldown <= 0) {
          const skill = skillById(characterById(this.pet.characterId)!.skillId)!;
          this.skillCooldown = skill.cooldown;
          const power = skill.power + this.pet.skillRank * 3;
          this.event('skill', skill.name, undefined, 'pet');
          if (skill.effect === 'heal') {
            const amount = Math.min(maxHp(this.pet) - this.pet.hp, power);
            this.pet.hp += amount;
            this.event('care', `HP +${amount}`, amount, 'pet');
          } else {
            if (skill.effect === 'poison') {
              target.poisonTicks = 3;
              this.enemyTimers.get(target.uid)!.poison = 0;
            }
            if (skill.effect === 'guard') this.guard = 3;
            this.hit(target, power, skill.name);
          }
        }
        if (this.enemy === target && this.enemyTimers.get(target.uid)!.attack <= 0) {
          this.enemyTimers.get(target.uid)!.attack = 1.6;
          const damage = Math.max(
            1,
            monsterById(target.id).attack - defense(this.pet) - (this.guard > 0 ? 3 : 0),
          );
          this.pet.hp = Math.max(0, this.pet.hp - damage);
          this.event('hurt', `피해 ${damage}`, damage, 'pet');
        }
      }
    }
    if (this.changed && this.publishClock >= 0.2) {
      this.publishClock = 0;
      this.emit();
    }
  }
  private hit(enemy: Enemy, amount: number, label: string) {
    if (!this.enemies.includes(enemy) || enemy.hp <= 0) return;
    enemy.hp = Math.max(0, enemy.hp - amount);
    this.event('damage', `${label} ${amount}`, amount, 'monster', enemy);
    if (enemy.hp === 0) {
      this.reward(monsterById(enemy.id), enemy);
      const wasFull = this.enemies.length === HUNTING_RULES.maxMonsters;
      this.enemies = this.enemies.filter((e) => e.uid !== enemy.uid);
      this.enemyTimers.delete(enemy.uid);
      if (this.targetUid === enemy.uid) this.targetUid = null;
      if (wasFull) this.spawnCooldown = HUNTING_RULES.respawnSeconds;
      this.action = 'happy';
    }
  }
  private reward(m: Monster, enemy: Enemy) {
    this.pet.coins = Math.min(1000000, this.pet.coins + m.coins);
    this.pet.kills = Math.min(1000000, this.pet.kills + 1);
    this.event(
      'reward',
      `+${m.coins} 코인${this.pet.level < MAX_LEVEL ? ` · +${m.xp} XP` : ''}`,
      m.coins,
      'monster',
      enemy,
    );
    if (this.pet.level === MAX_LEVEL) return;
    this.pet.xp += m.xp;
    while (this.pet.level < MAX_LEVEL && this.pet.xp >= xpForLevel(this.pet.level)) {
      this.pet.xp -= xpForLevel(this.pet.level);
      this.pet.level++;
      this.pet.hp = maxHp(this.pet);
      this.event('level', `레벨 ${this.pet.level}! 한 뼘 더 자랐어요.`);
    }
    if (this.pet.level === MAX_LEVEL) {
      this.pet.xp = 0;
      this.event('notice', '싱글 최고 레벨 20! 온라인 월드는 준비 중이에요.');
    }
  }
}
/** Contract reserved for Phase 2. Never accept client XP, coins, damage, or local saves as server authority. */
export type GameCommand =
  | { type: 'purchase'; itemId: string; requestId: string }
  | { type: 'hunt'; enabled: boolean; zoneId: string; requestId: string };
export interface ServerGamePort {
  dispatch(command: GameCommand): Promise<{ revision: number; pet: Pet }>;
}
