import { z } from 'zod';
import {
  CHARACTERS,
  SHOP,
  ZONES,
  characterById,
  skillById,
  monsterById,
  type Monster,
} from '@mochi/game-data';
export const MAX_LEVEL = 20;
export const SCHEMA_VERSION = 1;
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
    schema: 1,
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
export interface Enemy {
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
}
export interface Snapshot {
  pet: Pet;
  hunting: boolean;
  action: Action;
  enemy: Enemy | null;
  skillCooldown: number;
  events: GameEvent[];
  paused: boolean;
}
export type Result = { ok: true; message: string } | { ok: false; message: string };
/** Offline-only rules. A future server must own its own simulation and persisted economy. */
export class GameEngine {
  pet: Pet;
  hunting = false;
  action: Action = 'idle';
  enemy: Enemy | null = null;
  paused = false;
  skillCooldown = 0;
  private attackCooldown = 0;
  private enemyCooldown = 0;
  private spawnCooldown = 0.5;
  private decay = 0;
  private healClock = 0;
  private poisonClock = 0;
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
    skillCooldown: Math.ceil(this.skillCooldown),
    events: [...this.events],
    paused: this.paused,
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
  ) {
    this.events = [
      ...this.events.slice(-11),
      { id: ++this.eventId, kind, message, amount, target },
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
    this.pet.zoneId = z.id;
    this.enemy = null;
    this.spawnCooldown = 0.8;
    return this.notice(`${z.name}에 도착했어요.`);
  }
  stopHunt() {
    this.hunting = false;
    this.enemy = null;
    this.action = 'idle';
    this.attackCooldown = 0;
    this.enemyCooldown = 0;
    this.guard = 0;
  }
  toggleHunt(): Result {
    if (this.hunting) {
      this.stopHunt();
      return this.notice('사냥을 멈추고 산책해요.');
    }
    if (!this.pet.chosen) return this.notice('먼저 함께할 친구를 선택해 주세요.', false);
    if (this.pet.hp <= Math.floor(maxHp(this.pet) * 0.25) || this.pet.energy < 10)
      return this.notice('조금 더 쉬고 사냥해요. HP와 체력이 필요해요.', false);
    this.hunting = true;
    this.actionClock = 0;
    this.spawnCooldown = 0.5;
    this.action = 'walk';
    return this.notice('작은 모험을 시작해요!');
  }
  pause(value: boolean) {
    this.paused = value;
    this.emit();
  }
  care(kind: 'pet' | 'rest'): Result {
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
    if (!this.hunting) {
      this.action = item.category === 'toy' ? 'play' : item.category === 'food' ? 'eat' : 'happy';
      this.actionClock = 3;
    }
    this.event('care', `${item.name} 구매 · −${item.price} 코인`);
    this.emit();
    return { ok: true, message: `${item.name} 구매 완료!` };
  }
  step(seconds: number, inRange: boolean) {
    if (this.paused || !this.pet.chosen) return;
    const dt = Math.min(0.1, Math.max(0, seconds));
    if (!Number.isFinite(dt) || dt === 0) return;
    this.publishClock += dt;
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
      if (this.hunting) this.pet.energy = Math.max(0, this.pet.energy - 2);
      this.changed = true;
    }
    if (!this.hunting) {
      if (this.healClock >= 2) {
        this.healClock = 0;
        this.pet.hp = Math.min(maxHp(this.pet), this.pet.hp + (this.action === 'sleep' ? 5 : 2));
        this.pet.energy = Math.min(100, this.pet.energy + 2);
        this.changed = true;
      }
      if (this.actionClock === 0 && this.action !== 'walk' && this.action !== 'idle') {
        this.action = 'idle';
        this.changed = true;
      }
    } else {
      this.healClock = 0;
      if (this.pet.hp <= Math.floor(maxHp(this.pet) * 0.25) || this.pet.energy < 5) {
        this.stopHunt();
        this.action = 'sleep';
        this.actionClock = 15;
        this.event('notice', 'HP나 체력이 부족해요. 사냥을 멈추고 쉬어요.');
      } else if (!this.enemy) {
        this.spawnCooldown -= dt;
        if (this.spawnCooldown <= 0) {
          const zone = ZONES.find((z) => z.id === this.pet.zoneId)!;
          const id =
            zone.monsters[
              Math.min(
                zone.monsters.length - 1,
                Math.floor(Math.max(0, this.random()) * zone.monsters.length),
              )
            ];
          const m = monsterById(id);
          this.enemy = { id, hp: m.hp, maxHp: m.hp, poisonTicks: 0 };
          this.attackCooldown = 0.2;
          this.enemyCooldown = 1.5;
          this.poisonClock = 0;
          this.changed = true;
        }
      } else {
        this.action = inRange ? 'attack' : 'walk';
        this.attackCooldown -= dt;
        this.enemyCooldown -= dt;
        this.poisonClock += dt;
        if (this.enemy.poisonTicks > 0 && this.poisonClock >= 1) {
          this.poisonClock = 0;
          this.enemy.poisonTicks--;
          this.hit(3 + this.pet.skillRank, '중독');
        }
        if (this.enemy && inRange) {
          if (this.attackCooldown <= 0) {
            this.attackCooldown = Math.max(0.45, 1.15 - agility(this.pet) * 0.025);
            this.hit(attack(this.pet), '공격');
          }
          if (this.enemy && this.skillCooldown <= 0) {
            const skill = skillById(characterById(this.pet.characterId)!.skillId)!;
            this.skillCooldown = skill.cooldown;
            const power = skill.power + this.pet.skillRank * 3;
            this.event('skill', skill.name, undefined, 'pet');
            if (skill.effect === 'heal') {
              const amount = Math.min(maxHp(this.pet) - this.pet.hp, power);
              this.pet.hp += amount;
              this.event('care', `HP +${amount}`, amount, 'pet');
            } else {
              if (skill.effect === 'poison') this.enemy.poisonTicks = 3;
              if (skill.effect === 'guard') this.guard = 3;
              this.hit(power, skill.name);
            }
          }
          if (this.enemy && this.enemyCooldown <= 0) {
            this.enemyCooldown = 1.6;
            const damage = Math.max(
              1,
              monsterById(this.enemy.id).attack - defense(this.pet) - (this.guard > 0 ? 3 : 0),
            );
            this.pet.hp = Math.max(0, this.pet.hp - damage);
            this.event('hurt', `피해 ${damage}`, damage, 'pet');
          }
        }
      }
    }
    if (this.changed && this.publishClock >= 0.2) {
      this.publishClock = 0;
      this.emit();
    }
  }
  private hit(amount: number, label: string) {
    if (!this.enemy) return;
    this.enemy.hp = Math.max(0, this.enemy.hp - amount);
    this.event('damage', `${label} ${amount}`, amount, 'monster');
    if (this.enemy.hp === 0) {
      const m = monsterById(this.enemy.id);
      this.reward(m);
      this.enemy = null;
      this.spawnCooldown = 1.8;
      this.action = 'happy';
    }
  }
  private reward(m: Monster) {
    this.pet.coins = Math.min(1000000, this.pet.coins + m.coins);
    this.pet.kills = Math.min(1000000, this.pet.kills + 1);
    this.event(
      'reward',
      `+${m.coins} 코인${this.pet.level < MAX_LEVEL ? ` · +${m.xp} XP` : ''}`,
      m.coins,
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
