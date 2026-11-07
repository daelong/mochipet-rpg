import { describe, it, expect } from 'vitest';
import { GameEngine, defaults, maxHp } from './index';

function field(characterId = 'z_rabbit') {
  const g = new GameEngine({ ...defaults(), chosen: true, characterId }, () => 0);
  g.setZone('meadow');
  return g;
}
function step(g: GameEngine, seconds: number, uid = g.targetUid ?? -1, inRange = true) {
  for (let i = 0; i < Math.ceil(seconds * 10); i++) g.step(0.1, { uid, inRange });
}
describe('manual target selection and skills', () => {
  it('attacks the clicked instance without enabling automatic hunting or automatic skills', () => {
    const g = field();
    const target = g.enemies[3];
    expect(g.attackEnemy(target.uid).ok).toBe(true);
    expect(g.hunting).toBe(false);
    expect(g.manualCombat).toBe(true);
    step(g, 1, target.uid, false);
    expect(target.hp).toBe(target.maxHp);
    step(g, 0.1, target.uid);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(g.enemies.filter((e) => e !== target).every((e) => e.hp === e.maxHp)).toBe(true);
    expect(g.snapshot().events.some((e) => e.kind === 'skill')).toBe(false);
  });
  it('stops after one selected kill and never picks a second target or pays twice', () => {
    const g = field();
    const target = g.enemies[2];
    g.attackEnemy(target.uid);
    step(g, 7, target.uid);
    expect(g.pet.kills).toBe(1);
    expect(g.manualCombat).toBe(false);
    expect(g.enemy).toBeNull();
    const coins = g.pet.coins;
    g.selectNearestTarget(g.enemies[0]);
    step(g, 20, target.uid);
    expect(g.pet.coins).toBe(coins);
    expect(g.pet.kills).toBe(1);
    expect(g.enemies).toHaveLength(5);
    expect(g.attackEnemy(target.uid).ok).toBe(false);
  });
  it('clicking or changing targets cannot reset the basic attack cooldown', () => {
    const g = field();
    g.attackEnemy(g.enemies[0].uid);
    step(g, 0.3);
    expect(g.enemies[0].hp).toBeLessThan(g.enemies[0].maxHp);
    const next = g.enemies[1];
    g.attackEnemy(next.uid);
    g.attackEnemy(next.uid);
    step(g, 0.1);
    expect(next.hp).toBe(next.maxHp);
    step(g, 1);
    expect(next.hp).toBeLessThan(next.maxHp);
  });
  it('queues a skill for the exact target and consumes it only on a fresh in-range frame', () => {
    const g = field();
    const target = g.enemies[2];
    g.attackEnemy(target.uid);
    expect(g.requestSkill().ok).toBe(true);
    step(g, 2, target.uid, false);
    step(g, 1, g.enemies[0].uid);
    expect(g.skillCooldown).toBe(0);
    expect(g.snapshot().skillQueued).toBe(true);
    expect(target.hp).toBe(target.maxHp);
    step(g, 0.1, target.uid);
    expect(g.skillCooldown).toBeGreaterThan(0);
    expect(g.snapshot().skillQueued).toBe(false);
    expect(g.snapshot().events.filter((e) => e.kind === 'skill')).toHaveLength(1);
    expect(g.requestSkill().ok).toBe(false);
  });
  it('cancels pending skills on retarget, stop, exit and character change', () => {
    for (const action of ['retarget', 'stop', 'exit', 'character']) {
      const g = field();
      g.attackEnemy(g.enemies[0].uid);
      g.requestSkill();
      if (action === 'retarget') g.attackEnemy(g.enemies[1].uid);
      if (action === 'stop') g.cancelAttack();
      if (action === 'exit') g.setPlace('yard');
      if (action === 'character') g.choose('z_dragon');
      expect(g.snapshot().skillQueued).toBe(false);
      step(g, 0.1);
      expect(g.skillCooldown).toBe(0);
      expect(g.snapshot().events.some((e) => e.kind === 'skill')).toBe(false);
    }
  });
  it('rejects skills without an active target, during pause or during recovery', () => {
    const g = field();
    expect(g.requestSkill().ok).toBe(false);
    g.pause(true);
    expect(g.attackEnemy(g.enemies[0].uid).ok).toBe(false);
    expect(g.requestSkill().ok).toBe(false);
    g.pause(false);
    g.toggleHunt();
    g.pet.hp = 10;
    step(g, 0.1);
    expect(g.autoResting).toBe(true);
    expect(g.requestSkill().ok).toBe(false);
  });
  it('can disable automatic skills while automatic basic attacks continue', () => {
    const g = field();
    g.setAutoSkill(false);
    g.toggleHunt();
    g.selectNearestTarget(g.enemies[0]);
    step(g, 0.3);
    expect(g.enemy!.hp).toBeLessThan(g.enemy!.maxHp);
    expect(g.snapshot().events.some((e) => e.kind === 'skill')).toBe(false);
    expect(g.requestSkill().ok).toBe(true);
    step(g, 0.1);
    expect(g.snapshot().events.filter((e) => e.kind === 'skill')).toHaveLength(1);
    expect(g.hunting).toBe(true);
  });
  it('overrides automatic hunting with one manually chosen target', () => {
    const g = field();
    g.toggleHunt();
    g.selectNearestTarget(g.enemies[0]);
    g.attackEnemy(g.enemies[4].uid);
    expect(g.hunting).toBe(false);
    expect(g.manualCombat).toBe(true);
    expect(g.targetUid).toBe(g.enemies[4].uid);
    g.toggleHunt();
    expect(g.hunting).toBe(true);
    expect(g.manualCombat).toBe(false);
  });
  it('stops a weakened manual hunter without automatically restarting after recovery', () => {
    const g = field();
    g.pet.hp = 10;
    expect(g.attackEnemy(g.enemies[0].uid).ok).toBe(false);
    g.pet.hp = maxHp(g.pet);
    g.attackEnemy(g.enemies[0].uid);
    g.requestSkill();
    g.pet.hp = 10;
    step(g, 0.1);
    expect(g.inCombat).toBe(false);
    expect(g.autoResting).toBe(false);
    expect(g.snapshot().skillQueued).toBe(false);
    step(g, 60);
    expect(g.pet.kills).toBe(0);
    expect(g.inCombat).toBe(false);
  });
  it('a manually cast guard reduces the next retaliation damage', () => {
    const pair = [field('z_ox'), field('z_ox')];
    for (const g of pair) {
      g.pet.level = 5;
      g.pet.hp = maxHp(g.pet);
      g.setZone('cave');
      g.attackEnemy(g.enemies[0].uid);
    }
    pair[0].requestSkill();
    pair.forEach((g) => step(g, 1.6));
    expect(pair[0].pet.hp - pair[1].pet.hp).toBe(3);
  });
  it.each(['z_rabbit', 'z_snake', 'z_sheep', 'z_ox'])(
    'manually casts the equipped effect for %s',
    (id) => {
      const g = field(id);
      g.pet.hp = 40;
      const target = g.enemies[0];
      target.hp = target.maxHp = 100;
      g.attackEnemy(target.uid);
      g.requestSkill();
      step(g, 0.1);
      expect(g.snapshot().events.some((e) => e.kind === 'skill')).toBe(true);
      if (id === 'z_sheep') expect(g.pet.hp).toBeGreaterThan(40);
      else expect(target.hp).toBeLessThan(90);
      if (id === 'z_snake') expect(target.poisonTicks).toBe(3);
      expect(g.requestSkill().ok).toBe(false);
    },
  );
});
