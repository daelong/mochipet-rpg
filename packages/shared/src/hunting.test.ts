import { describe, it, expect } from 'vitest';
import { HUNTING_RULES, monsterById } from '@mochi/game-data';
import { GameEngine, defaults, nearestEnemy } from './index';
const frame = (g: GameEngine, time: number, range = false) => {
  for (let i = 0; i < Math.ceil(time * 10); i++) g.step(0.1, range);
};
const engine = () => new GameEngine({ ...defaults(), chosen: true }, () => 0);
describe('separate hunting fields and multiple instances', () => {
  it('requires explicit entry and never spawns monsters in the yard or home', () => {
    const g = engine();
    expect(g.toggleHunt().ok).toBe(false);
    frame(g, 30);
    expect(g.place).toBe('yard');
    expect(g.enemies).toHaveLength(0);
    g.setPlace('home');
    frame(g, 30);
    expect(g.enemies).toHaveLength(0);
    expect(g.toggleHunt().ok).toBe(false);
    g.setZone('meadow');
    expect(g.place).toBe('adventure');
    expect(g.enemies).toHaveLength(5);
    expect(g.hunting).toBe(false);
  });
  it('fills five unique well-separated positions even with a constant random source', () => {
    const g = engine();
    g.setZone('meadow');
    const b = HUNTING_RULES.bounds;
    expect(new Set(g.enemies.map((e) => e.uid)).size).toBe(5);
    for (const a of g.enemies) {
      expect(a.x).toBeGreaterThanOrEqual(b.minX);
      expect(a.x).toBeLessThanOrEqual(b.maxX);
      expect(a.y).toBeGreaterThanOrEqual(b.minY);
      expect(a.y).toBeLessThanOrEqual(b.maxY);
      for (const other of g.enemies)
        if (a !== other)
          expect(Math.hypot(a.x - other.x, a.y - other.y)).toBeGreaterThanOrEqual(
            HUNTING_RULES.minSpacing,
          );
    }
  });
  it('uses the provided RNG for positions as well as monster types', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const a = new GameEngine({ ...defaults(), chosen: true }, random);
    a.setZone('meadow');
    const first = a.enemies.map((e) => [e.x, e.y]);
    a.setPlace('yard');
    a.setZone('meadow');
    expect(a.enemies.map((e) => [e.x, e.y])).not.toEqual(first);
  });
  it('picks the nearest live monster and retains it until defeated', () => {
    const g = engine();
    g.setZone('meadow');
    g.toggleHunt();
    const closest = g.enemies[4];
    g.selectNearestTarget(closest);
    expect(g.targetUid).toBe(closest.uid);
    g.selectNearestTarget(g.enemies[0]);
    expect(g.targetUid).toBe(closest.uid);
    expect(nearestEnemy(g.enemies, { x: NaN, y: 0 })).toBeNull();
  });
  it('damages only the selected instance, pays once and replenishes to at most five', () => {
    const g = engine();
    g.setZone('meadow');
    g.toggleHunt();
    const selected = g.enemies[4];
    g.selectNearestTarget(selected);
    frame(g, 0.3, true);
    expect(g.pet.kills).toBe(1);
    expect(g.pet.coins).toBe(60 + monsterById(selected.id).coins);
    expect(g.enemies.some((e) => e.uid === selected.uid)).toBe(false);
    expect(g.enemies.every((e) => e.hp === e.maxHp)).toBe(true);
    expect(g.enemies).toHaveLength(4);
    g.toggleHunt();
    frame(g, 4);
    expect(g.enemies).toHaveLength(5);
    expect(g.pet.kills).toBe(1);
  });
  it('rejects an attack range measurement for another monster instance', () => {
    const g = engine();
    g.setZone('meadow');
    g.toggleHunt();
    g.selectNearestTarget(g.enemies[0]);
    for (let i = 0; i < 50; i++) g.step(0.1, { uid: g.enemies[1].uid, inRange: true });
    expect(g.enemies.every((e) => e.hp === e.maxHp)).toBe(true);
    expect(g.pet.kills).toBe(0);
  });
  it('refills with new identities and keeps the hard cap during prolonged auto combat', () => {
    const g = engine();
    g.pet.defenseBonus = 50;
    g.setZone('meadow');
    g.toggleHunt();
    const initial = g.enemies.map((e) => e.uid);
    for (let i = 0; i < 3000; i++) {
      g.step(0.1, true);
      expect(g.enemies.length).toBeLessThanOrEqual(5);
    }
    expect(g.pet.kills).toBeGreaterThan(5);
    expect(
      g.snapshot().events.some((e) => e.kind === 'reward' && !initial.includes(e.enemyUid!)),
    ).toBe(true);
  });
  it('leaving clears every monster, cancels recovery and prevents old rewards', () => {
    const g = engine();
    g.setZone('meadow');
    g.toggleHunt();
    g.pet.hp = 10;
    frame(g, 1);
    expect(g.autoResting).toBe(true);
    g.setPlace('yard');
    expect(g.enemies).toHaveLength(0);
    expect(g.autoResting).toBe(false);
    frame(g, 30, true);
    expect(g.pet.kills).toBe(0);
    expect(g.hunting).toBe(false);
  });
  it('cannot heal or reset enemies by re-entering the same field', () => {
    const g = engine();
    g.setZone('meadow');
    const before = g.enemies.map((e) => e.uid);
    g.enemies[0].hp = 4;
    g.setZone('meadow');
    expect(g.enemies[0].hp).toBe(4);
    expect(g.enemies.map((e) => e.uid)).toEqual(before);
  });
  it('manual OFF cancels automatic recovery and cannot restart itself', () => {
    const g = engine();
    g.setZone('meadow');
    g.toggleHunt();
    g.pet.hp = 10;
    frame(g, 0.2);
    g.toggleHunt();
    frame(g, 60, true);
    expect(g.hunting).toBe(false);
    expect(g.autoResting).toBe(false);
    expect(g.pet.kills).toBe(0);
  });
});
