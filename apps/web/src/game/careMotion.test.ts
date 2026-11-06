import { describe, it, expect } from 'vitest';
import { HOME_ACTIVITIES } from '@mochi/game-data';
import { careMotion, type CareId } from './careMotion';

describe('physical home activity choreography', () => {
  it('builds up foam while scrubbing, rinses it away, then dries with a towel', () => {
    expect(careMotion('bath', 2).phase).toBe('scrub');
    expect(careMotion('bath', 5).foam).toBeGreaterThan(careMotion('bath', 2).foam);
    expect(careMotion('bath', 6).phase).toBe('rinse');
    expect(careMotion('bath', 8).foam).toBeLessThan(careMotion('bath', 6).foam);
    expect(careMotion('bath', 9)).toMatchObject({ phase: 'dry', foam: 0 });
  });
  it('sits, uses tissue, flushes and moves to wash hands', () => {
    expect([0, 2, 4, 5, 5.9].map((t) => careMotion('toilet', t).phase)).toEqual([
      'sit',
      'wait',
      'wipe',
      'flush',
      'wash',
    ]);
    expect(careMotion('toilet', 5.9).x).toBeGreaterThan(45);
    expect(careMotion('toilet', 2).x).toBe(0);
  });
  it('releases a ball from the paw, follows an arc, bounces back and hugs a toy', () => {
    expect(careMotion('play', 0.2)).toMatchObject({ phase: 'catch', ballX: -32, ballY: 8 });
    expect(careMotion('play', 0.85).phase).toBe('toss');
    expect(careMotion('play', 0.85).ballY).toBeLessThan(-70);
    expect(careMotion('play', 1.3).ballX).toBeGreaterThan(careMotion('play', 2.3).ballX);
    expect(careMotion('play', 2.5)).toMatchObject({ phase: 'catch', ballX: -32, ballY: 8 });
    expect(careMotion('play', 9).phase).toBe('hug');
  });
  it('turns actual pages repeatedly before closing the book', () => {
    expect(careMotion('read', 0.3).phase).toBe('open');
    expect(careMotion('read', 1.3).pageTurn).toBeGreaterThan(0);
    expect(careMotion('read', 3.5).page).toBeGreaterThan(careMotion('read', 1.3).page);
    expect(careMotion('read', 9.5).phase).toBe('close');
  });
  it('pulls up a blanket, sleeps with breathing, then uncovers and wakes', () => {
    expect(careMotion('sleep', 0).blanket).toBe(0);
    expect(careMotion('sleep', 3)).toMatchObject({ phase: 'sleep', blanket: 1, texture: 'sleep' });
    expect(careMotion('sleep', 4).scale).not.toBe(careMotion('sleep', 5).scale);
    expect(careMotion('sleep', 15)).toMatchObject({ phase: 'wake', blanket: 0, texture: 'idle' });
  });
  it('gathers dust and removes it before showing the clean floor', () => {
    expect(careMotion('clean', 0).dust).toBe(8);
    let dust = 8;
    for (let t = 0; t <= 8; t += 0.1) {
      const now = careMotion('clean', t).dust;
      expect(now).toBeLessThanOrEqual(dust);
      dust = now;
    }
    expect(careMotion('clean', 8)).toMatchObject({ phase: 'shine', dust: 0 });
  });
  it('keeps props and body bounded across every activity and invalid time input', () => {
    for (const activity of HOME_ACTIVITIES.filter((a) => a.id !== 'meal')) {
      const id = activity.id as CareId;
      expect(careMotion(id, NaN)).toEqual(careMotion(id, 0));
      expect(careMotion(id, -5)).toEqual(careMotion(id, 0));
      for (let t = 0; t <= activity.seconds + 1; t += 0.13) {
        const pose = careMotion(id, t);
        for (const v of [
          pose.x,
          pose.y,
          pose.angle,
          pose.scale,
          pose.local,
          pose.ballX,
          pose.ballY,
        ])
          expect(Number.isFinite(v)).toBe(true);
        expect(pose.local).toBeGreaterThanOrEqual(0);
        expect(pose.local).toBeLessThanOrEqual(1);
        expect(pose.caption.length).toBeGreaterThan(0);
      }
    }
  });
});
