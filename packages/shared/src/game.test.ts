import { describe, it, expect } from 'vitest';
import { CHARACTERS, SKILLS, SHOP, ZONES } from '@mochi/game-data';
import { GameEngine, defaults, maxHp, parsePet, xpForLevel, MAX_LEVEL, type Pet } from './index';
function chosen(overrides: Partial<Pet> = {}) {
  return { ...defaults(), chosen: true, ...overrides };
}
function advance(g: GameEngine, seconds: number, range = true) {
  for (let i = 0; i < Math.ceil(seconds * 10); i++) g.step(0.1, range);
}
describe('catalog and validation', () => {
  it('all 28 characters have one real starter skill', () => {
    expect(CHARACTERS).toHaveLength(28);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(28);
    for (const c of CHARACTERS) {
      expect(SKILLS.filter((s) => s.id === c.skillId)).toHaveLength(1);
      expect(c.stats.attack).toBeGreaterThan(0);
    }
  });
  it('has the requested 1/3/5/8 unlocks', () =>
    expect(ZONES.map((z) => z.level)).toEqual([1, 3, 5, 8]));
  it.each([
    { level: 21 },
    { coins: -1 },
    { coins: Infinity },
    { xp: NaN },
    { characterId: '../../bad' },
    { zoneId: 'cave' },
    { name: '\u202eevil' },
    { hp: 999 },
    { purchases: { unknown: 2 } },
    { purchases: { attack: 51 } },
    { level: 20, xp: 1 },
  ])('rejects malformed or inconsistent save %j', (bad) =>
    expect(() => parsePet({ ...defaults(), ...bad })).toThrow(),
  );
});
describe('offline simulation', () => {
  it('requires choosing a friend before hunting', () => {
    const g = new GameEngine();
    expect(g.toggleHunt().ok).toBe(false);
    g.choose('z_rabbit');
    expect(g.toggleHunt().ok).toBe(false);
    g.setZone('meadow');
    expect(g.toggleHunt().ok).toBe(true);
  });
  it('does not hit or award from out of range', () => {
    const g = new GameEngine(chosen(), () => 0);
    g.setZone(g.pet.zoneId);
    g.toggleHunt();
    advance(g, 30, false);
    expect(g.enemy?.hp).toBe(28);
    expect(g.pet.coins).toBe(60);
    expect(g.pet.kills).toBe(0);
  });
  it('attacks, casts skills, and grants one reward per kill', () => {
    const g = new GameEngine(chosen(), () => 0);
    g.setZone(g.pet.zoneId);
    g.toggleHunt();
    advance(g, 1.2);
    expect(g.pet.kills).toBe(1);
    expect(g.pet.coins).toBe(69);
    expect(g.pet.xp).toBe(14);
    expect(g.snapshot().events.some((e) => e.kind === 'skill')).toBe(true);
    advance(g, 0.5);
    expect(g.pet.kills).toBe(1);
  });
  it('a stopped hunt preserves field monsters without granting rewards', () => {
    const g = new GameEngine(chosen());
    g.setZone(g.pet.zoneId);
    g.toggleHunt();
    advance(g, 1, false);
    g.setZone(g.pet.zoneId);
    g.toggleHunt();
    advance(g, 20);
    expect(g.enemy).toBeNull();
    expect(g.enemies).toHaveLength(5);
    expect(g.pet.kills).toBe(0);
  });
  it('automatically rests at low HP and resumes the same hunt after recovery', () => {
    const g = new GameEngine(chosen(), () => 0);
    g.setZone('meadow');
    g.toggleHunt();
    g.pet.hp = 10;
    advance(g, 0.2);
    expect(g.hunting).toBe(true);
    expect(g.autoResting).toBe(true);
    expect(g.enemy).toBeNull();
    advance(g, 8);
    expect(g.pet.hp).toBeGreaterThan(10);
    expect(g.pet.kills).toBe(0);
    advance(g, 16);
    expect(g.autoResting).toBe(false);
    expect(g.hunting).toBe(true);
    expect(g.pet.kills).toBeGreaterThan(0);
  });
  it('manual rest cancels hunting and restores HP and energy', () => {
    const g = new GameEngine(chosen({ hp: 35, energy: 15 }));
    g.setZone(g.pet.zoneId);
    g.toggleHunt();
    g.care('rest');
    advance(g, 10);
    expect(g.hunting).toBe(false);
    expect(g.pet.hp).toBeGreaterThan(35);
    expect(g.pet.energy).toBeGreaterThan(15);
  });
  it('pauses progress and caps long frames so no implicit away reward', () => {
    const g = new GameEngine(chosen());
    g.setZone(g.pet.zoneId);
    g.toggleHunt();
    g.pause(true);
    advance(g, 2000);
    expect(g.pet.kills).toBe(0);
    g.pause(false);
    g.step(86400, true);
    expect(g.pet.kills).toBe(0);
    expect(g.snapshot().events.filter((e) => e.kind === 'damage').length).toBeLessThanOrEqual(1);
  });
  it('levels up, restores HP and unlocks level gated zones', () => {
    const g = new GameEngine(chosen({ level: 2, xp: xpForLevel(2) - 1 }), () => 0);
    expect(g.setZone('forest').ok).toBe(false);
    g.setZone(g.pet.zoneId);
    g.toggleHunt();
    advance(g, 1.2);
    expect(g.pet.level).toBe(3);
    expect(g.pet.hp).toBe(maxHp(g.pet));
    expect(g.setZone('forest').ok).toBe(true);
  });
  it('never grows beyond 20 or accumulates XP at 20, while coins remain usable', () => {
    const g = new GameEngine(chosen({ level: 19, xp: xpForLevel(19) - 1 }), () => 0);
    g.setZone(g.pet.zoneId);
    g.toggleHunt();
    advance(g, 30);
    expect(g.pet.level).toBe(MAX_LEVEL);
    expect(g.pet.xp).toBe(0);
    expect(g.pet.coins).toBeGreaterThan(60);
    expect(() => parsePet(g.pet)).not.toThrow();
  });
  it('poison applies extra damage over time', () => {
    const g = new GameEngine(
      chosen({ characterId: 'z_snake', level: 5, hp: 80, zoneId: 'cave' }),
      () => 0,
    );
    g.setZone(g.pet.zoneId);
    g.toggleHunt();
    advance(g, 5);
    expect(g.snapshot().events.some((e) => e.message.startsWith('중독'))).toBe(true);
  });
  it('healing skill restores HP instead of being a renamed attack', () => {
    const g = new GameEngine(chosen({ characterId: 'z_sheep', hp: 35 }), () => 0);
    g.setZone(g.pet.zoneId);
    g.toggleHunt();
    advance(g, 1.2);
    expect(g.pet.hp).toBeGreaterThan(35);
    expect(g.snapshot().events.some((e) => e.kind === 'care' && e.message.startsWith('HP'))).toBe(
      true,
    );
  });
  it('keeps save bounds and event cap through a long simulation', () => {
    const g = new GameEngine(
      chosen({ coins: 1000000, attackBonus: 100, defenseBonus: 50 }),
      () => 0,
    );
    g.setZone(g.pet.zoneId);
    g.toggleHunt();
    advance(g, 1800);
    expect(() => parsePet(g.pet)).not.toThrow();
    expect(g.snapshot().events.length).toBeLessThanOrEqual(12);
  });
});
describe('purchases and player input', () => {
  it('changing characters preserves health ratio instead of giving free healing', () => {
    const g = new GameEngine(chosen({ hp: 30 }));
    g.choose('z_rat');
    expect(g.pet.hp).toBe(30);
    g.choose('z_tiger');
    expect(g.pet.hp / maxHp(g.pet)).toBeLessThanOrEqual(0.5);
    g.choose('z_rabbit');
    expect(g.pet.hp).toBeLessThanOrEqual(30);
  });
  it('rejects unaffordable and unknown items without changes', () => {
    const g = new GameEngine(chosen({ coins: 0 }));
    const before = structuredClone(g.pet);
    expect(g.purchase('rice').ok).toBe(false);
    expect(g.purchase('bogus').ok).toBe(false);
    expect(g.pet).toEqual(before);
  });
  it('deducts and applies an immediate purchase exactly once per action', () => {
    const g = new GameEngine(chosen());
    expect(g.purchase('rice').ok).toBe(true);
    expect(g.pet.coins).toBe(45);
    expect(g.pet.hunger).toBe(100);
    expect(g.pet.energy).toBe(95);
    expect(g.pet.purchases.rice).toBe(1);
  });
  it('enforces item level and count limits for repeated requests', () => {
    const g = new GameEngine(chosen({ coins: 1000000 }));
    expect(g.purchase('skill').ok).toBe(false);
    for (let i = 0; i < 51; i++) g.purchase('attack');
    expect(g.pet.purchases.attack).toBe(50);
    expect(g.pet.attackBonus).toBe(100);
    expect(g.pet.coins).toBe(1000000 - 50 * 65);
    expect(() => parsePet(g.pet)).not.toThrow();
  });
  it('enforces healing and stat caps for every catalog item', () => {
    const g = new GameEngine(chosen({ coins: 1000000, level: 20 }));
    for (const item of SHOP) for (let n = 0; n < item.limit + 2; n++) g.purchase(item.id);
    expect(() => parsePet(g.pet)).not.toThrow();
    expect(g.pet.hp).toBeLessThanOrEqual(maxHp(g.pet));
  });
  it('validates names and prevents spamming pet care', () => {
    const g = new GameEngine(chosen());
    expect(g.rename('  구름  ').ok).toBe(true);
    expect(g.pet.name).toBe('구름');
    expect(g.rename(' ').ok).toBe(false);
    expect(g.rename('x'.repeat(17)).ok).toBe(false);
    g.care('pet');
    g.care('pet');
    expect(g.pet.bond).toBe(1);
  });
});
