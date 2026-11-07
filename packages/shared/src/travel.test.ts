import { describe, it, expect } from 'vitest';
import { GameEngine, defaults, DOORS, travelPoint, parsePet } from './index';
const game = () => new GameEngine({ ...defaults(), chosen: true });
const step = (g: GameEngine, seconds: number) => {
  for (let i = 0; i < seconds * 10; i++) g.step(0.1, false);
};
function cross(g: GameEngine) {
  expect(g.advanceTravel(travelPoint(g.travel!))).toBeNull();
  expect(g.travel?.stage).toBe('cross');
  return g.advanceTravel(travelPoint(g.travel!));
}
describe('walking through doors', () => {
  it('waits for both the approach and the threshold, rather than a timer or request', () => {
    const g = game();
    expect(g.requestTravel('home').ok).toBe(true);
    step(g, 20);
    expect(g.place).toBe('yard');
    expect(g.advanceTravel(DOORS.house.threshold)).toBeNull();
    expect(g.travel?.stage).toBe('approach');
    expect(g.advanceTravel(DOORS.house.approach)).toBeNull();
    expect(g.place).toBe('yard');
    expect(g.requestTravel('home').ok).toBe(true);
    expect(g.travel?.stage).toBe('cross');
    expect(g.advanceTravel(DOORS.house.threshold)).toEqual({
      destination: 'home',
      position: DOORS.house.arrival,
    });
    expect(g.place).toBe('home');
    expect(g.travel).toBeNull();
  });
  it.each(['home', 'adventure'] as const)('uses the matching exit from %s', (place) => {
    const g = game();
    g.setPlace(place);
    g.requestTravel('yard');
    const door = place === 'home' ? 'homeExit' : 'fieldExit';
    expect(g.travel?.door).toBe(door);
    expect(cross(g)).toEqual({ destination: 'yard', position: DOORS[door].arrival });
    expect(g.enemies).toHaveLength(0);
  });
  it('cancels combat and its queued skill before walking, and never resumes it on arrival', () => {
    const g = game();
    g.setZone('meadow');
    g.attackEnemy(g.enemies[0].uid);
    g.requestSkill();
    g.requestTravel('yard');
    expect(g.inCombat).toBe(false);
    expect(g.snapshot().skillQueued).toBe(false);
    expect(g.attackEnemy(g.enemies[0].uid).ok).toBe(false);
    expect(g.toggleHunt().ok).toBe(false);
    cross(g);
    expect(g.inCombat).toBe(false);
    expect(g.pet.kills).toBe(0);
  });
  it('cancels unfinished home care without giving its effects', () => {
    const g = game();
    g.setPlace('home');
    g.startHomeActivity('bath');
    g.arriveHomeActivity();
    g.requestTravel('yard');
    expect(g.homeActivity).toBeNull();
    expect(g.startHomeActivity('play').ok).toBe(false);
    cross(g);
    expect(g.pet.homeActivities).toEqual({});
    expect(g.pet.hygiene).toBe(80);
  });
  it('rejects distant, nonfinite or paused arrival and allows cancellation', () => {
    const g = game();
    g.requestTravel('home');
    for (const point of [
      { x: NaN, y: 415 },
      { x: 473, y: Infinity },
      { x: 840, y: 690 },
    ])
      expect(g.advanceTravel(point)).toBeNull();
    g.pause(true);
    expect(g.advanceTravel(DOORS.house.approach)).toBeNull();
    expect(g.requestTravel('yard').ok).toBe(false);
    g.pause(false);
    g.cancelTravel();
    expect(g.advanceTravel(DOORS.house.threshold)).toBeNull();
    expect(g.place).toBe('yard');
  });
  it('does not start for an unchosen pet or the current place, and does not persist a pending route', () => {
    expect(new GameEngine().requestTravel('home').ok).toBe(false);
    const g = game();
    expect(g.requestTravel('yard').ok).toBe(false);
    g.requestTravel('home');
    const reopened = new GameEngine(parsePet(JSON.parse(JSON.stringify(g.pet))));
    expect(reopened.travel).toBeNull();
    expect(reopened.place).toBe('yard');
    g.setZone('meadow');
    expect(g.travel).toBeNull();
  });
});
describe('petting without stopping movement', () => {
  it('keeps walking through a door while showing a brief independent reaction', () => {
    const g = game();
    g.requestTravel('home');
    expect(g.care('pet').ok).toBe(true);
    expect(g.action).toBe('walk');
    expect(g.snapshot().petting).toBe(true);
    expect(g.travel?.destination).toBe('home');
    step(g, 2);
    expect(g.snapshot().petting).toBe(false);
    expect(g.action).toBe('walk');
    expect(g.care('pet').ok).toBe(false);
    step(g, 3.1);
    expect(g.care('pet').ok).toBe(true);
    expect(g.pet.bond).toBe(2);
  });
  it('does not interrupt manual attacks or reset their selected target', () => {
    const g = game();
    g.setZone('meadow');
    const uid = g.enemies[0].uid;
    g.attackEnemy(uid);
    g.requestSkill();
    g.care('pet');
    expect(g.manualCombat).toBe(true);
    expect(g.targetUid).toBe(uid);
    expect(g.snapshot().skillQueued).toBe(true);
    expect(g.action).toBe('walk');
  });
  it('prevents repeated petting rewards and freezes the gesture while paused', () => {
    const g = game();
    g.care('pet');
    for (let i = 0; i < 20; i++) expect(g.care('pet').ok).toBe(false);
    expect(g.pet.bond).toBe(1);
    expect(g.pet.happiness).toBe(83);
    g.pause(true);
    step(g, 5);
    expect(g.petReaction).toBe(1.8);
    g.pause(false);
    step(g, 2);
    expect(g.snapshot().petting).toBe(false);
  });
});
