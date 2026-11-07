import { describe, it, expect } from 'vitest';
import { HOME_ACTIVITIES } from '@mochi/game-data';
import { defaults, GameEngine, parsePet, SCHEMA_VERSION } from './index';
function advance(g: GameEngine, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 10); i++) g.step(0.1, true);
}
function atHome() {
  const g = new GameEngine({
    ...defaults(),
    chosen: true,
    hunger: 50,
    hygiene: 50,
    toilet: 80,
    energy: 50,
    happiness: 50,
    roomCleanliness: 50,
    hp: 30,
  });
  g.setPlace('home');
  return g;
}
describe('home life', () => {
  it('keeps the yard peaceful and cancels a hunt on coming home', () => {
    const g = new GameEngine({ ...defaults(), chosen: true });
    expect(g.snapshot().place).toBe('yard');
    advance(g, 10);
    expect(g.enemy).toBeNull();
    g.setZone('meadow');
    g.toggleHunt();
    expect(g.place).toBe('adventure');
    for (let i = 0; i < 10; i++) g.step(0.1, false);
    expect(g.enemy).not.toBeNull();
    g.setPlace('home');
    expect(g.hunting).toBe(false);
    expect(g.enemy).toBeNull();
  });
  it('requires choosing a pet and being inside the house', () => {
    const g = new GameEngine();
    g.setPlace('home');
    expect(g.startHomeActivity('read').ok).toBe(false);
    g.choose('z_rabbit');
    g.setPlace('yard');
    expect(g.startHomeActivity('read').ok).toBe(false);
    expect(g.startHomeActivity('unknown').ok).toBe(false);
  });
  it.each(HOME_ACTIVITIES)(
    '$id applies its bounded effects once after arrival and completion',
    (a) => {
      const g = atHome();
      const before = structuredClone(g.pet);
      expect(g.startHomeActivity(a.id).ok).toBe(true);
      advance(g, 2);
      expect(g.homeActivity?.remaining).toBe(a.seconds);
      expect(g.pet.homeActivities[a.id]).toBeUndefined();
      // Compare needs at the furniture so travel time is excluded.
      const arrived = structuredClone(g.pet);
      g.arriveHomeActivity();
      advance(g, a.seconds);
      expect(g.homeActivity).toBeNull();
      expect(g.pet.homeActivities[a.id]).toBe(1);
      for (const [key, amount] of Object.entries(a.effects)) {
        const stat = key as keyof typeof a.effects;
        expect(g.pet[stat]).toBe(
          Math.max(0, Math.min(stat === 'hp' ? 60 : 100, Number(arrived[stat]) + Number(amount))),
        );
      }
      expect(g.pet.coins).toBe(before.coins);
      expect(g.pet.xp).toBe(before.xp);
      advance(g, 2);
      expect(g.pet.homeActivities[a.id]).toBe(1);
      expect(() => parsePet(g.pet)).not.toThrow();
    },
  );
  it('freezes activities while paused, and never catches up a long frame', () => {
    const g = atHome();
    g.startHomeActivity('read');
    g.arriveHomeActivity();
    g.pause(true);
    advance(g, 100);
    expect(g.homeActivity?.remaining).toBe(10);
    expect(g.pet.homeActivities.read).toBeUndefined();
    g.pause(false);
    g.step(86400, false);
    expect(g.homeActivity?.remaining).toBeCloseTo(9.9);
  });
  it('does not reward cancelled activities or restore them in a new session', () => {
    const g = atHome();
    g.startHomeActivity('bath');
    g.arriveHomeActivity();
    advance(g, 3);
    const hygiene = g.pet.hygiene;
    g.cancelHomeActivity();
    advance(g, 2);
    expect(g.pet.hygiene).toBe(hygiene);
    expect(g.pet.homeActivities.bath).toBeUndefined();
    g.startHomeActivity('meal');
    g.arriveHomeActivity();
    advance(g, 2);
    g.setPlace('yard');
    expect(g.homeActivity).toBeNull();
    expect(g.pet.homeActivities.meal).toBeUndefined();
    const restored = new GameEngine(g.pet);
    expect(restored.place).toBe('yard');
    expect(restored.homeActivity).toBeNull();
  });
  it('prevents activity stacking and hunting while an activity is running', () => {
    const g = atHome();
    g.startHomeActivity('bath');
    expect(g.startHomeActivity('read').ok).toBe(false);
    expect(g.toggleHunt().ok).toBe(false);
    expect(g.setZone('meadow').ok).toBe(false);
    expect(g.care('pet').ok).toBe(false);
    expect(g.homeActivity?.id).toBe('bath');
  });
  it('does not eat, bathe, clean or sleep past full needs', () => {
    const g = new GameEngine({
      ...defaults(),
      chosen: true,
      hunger: 100,
      hygiene: 100,
      toilet: 0,
      roomCleanliness: 100,
      energy: 100,
    });
    g.setPlace('home');
    for (const id of ['meal', 'bath', 'toilet', 'clean', 'sleep'])
      expect(g.startHomeActivity(id).ok).toBe(false);
  });
  it('makes hygiene, toilet and room care matter during active play', () => {
    const g = atHome();
    advance(g, 31);
    expect(g.pet.hygiene).toBe(49);
    expect(g.pet.toilet).toBe(82);
    expect(g.pet.roomCleanliness).toBe(49);
  });
});
describe('home save schema', () => {
  it('migrates a strictly validated v1 record while keeping progress', () => {
    const { hygiene, toilet, roomCleanliness, homeActivities, ...legacy } = defaults();
    const p = parsePet({ ...legacy, schema: 1, name: '구름', coins: 123 });
    expect(p.schema).toBe(SCHEMA_VERSION);
    expect(p.name).toBe('구름');
    expect(p.coins).toBe(123);
    expect(p.hygiene).toBe(80);
    expect(p.homeActivities).toEqual({});
    expect(() => parsePet({ ...legacy, schema: 1, coins: -1 })).toThrow();
    expect(() => parsePet({ ...legacy, schema: 1, unexpected: 1 })).toThrow();
  });
  it.each([
    { hygiene: -1 },
    { toilet: 101 },
    { roomCleanliness: NaN },
    { homeActivities: { unknown: 1 } },
    { homeActivities: { meal: Infinity } },
  ])('rejects invalid home records %j', (bad) =>
    expect(() => parsePet({ ...defaults(), ...bad })).toThrow(),
  );
});
