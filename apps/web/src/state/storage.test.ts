import { describe, it, expect } from 'vitest';
import { defaults } from '@mochi/shared';
import { SaveRepository, SAVE_KEY, BACKUP_KEY, RESET_KEY, type StoragePort } from './storage';
class MemoryStorage implements StoragePort {
  data = new Map<string, string>();
  failKey = '';
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (k === this.failKey) throw new Error('quota');
    this.data.set(k, v);
  }
}
describe('versioned local saves', () => {
  it('does not replace the primary if writing its previous backup fails', () => {
    const s = new MemoryStorage(),
      r = new SaveRepository(s);
    r.save({ ...defaults(), coins: 88 });
    s.failKey = BACKUP_KEY;
    expect(() => r.save({ ...defaults(), coins: 90 })).toThrow();
    expect(r.load().pet.coins).toBe(88);
  });
  it('starts with a fresh guest and preserves verified state after reload', () => {
    const s = new MemoryStorage(),
      r = new SaveRepository(s);
    expect(r.load().pet.chosen).toBe(false);
    r.save({ ...defaults(), name: '구름', chosen: true, coins: 99 });
    const loaded = new SaveRepository(s).load();
    expect(loaded.readOnly).toBe(false);
    expect(loaded.pet.name).toBe('구름');
    expect(loaded.pet.coins).toBe(99);
  });
  it('keeps one previous good version and recovers a corrupt primary', () => {
    const s = new MemoryStorage(),
      r = new SaveRepository(s);
    r.save({ ...defaults(), coins: 70 });
    r.save({ ...defaults(), coins: 90 });
    s.setItem(SAVE_KEY, '{broken');
    const result = r.load();
    expect(result.pet.coins).toBe(70);
    expect(result.readOnly).toBe(false);
    expect(s.getItem(`${SAVE_KEY}.damaged`)).toBe('{broken');
    r.save(result.pet);
    expect(r.load().pet.coins).toBe(70);
  });
  it('does not overwrite future schema even when an old backup exists', () => {
    const s = new MemoryStorage(),
      r = new SaveRepository(s);
    s.setItem(SAVE_KEY, JSON.stringify({ schema: 999 }));
    s.setItem(BACKUP_KEY, JSON.stringify(defaults()));
    expect(r.load().readOnly).toBe(true);
    expect(() => r.save(defaults())).toThrow();
    expect(JSON.parse(s.getItem(SAVE_KEY)!)).toEqual({ schema: 999 });
  });
  it('protects corrupt or oversized records without a valid backup', () => {
    const s = new MemoryStorage(),
      r = new SaveRepository(s);
    for (const value of [
      'null',
      '[]',
      'bad',
      'x'.repeat(65537),
      JSON.stringify({ ...defaults(), coins: -1 }),
    ]) {
      s.setItem(SAVE_KEY, value);
      expect(r.load().readOnly).toBe(true);
      expect(s.getItem(SAVE_KEY)).toBe(value);
    }
  });
  it('retains both raw records in a reset backup', () => {
    const s = new MemoryStorage(),
      r = new SaveRepository(s);
    s.setItem(SAVE_KEY, 'broken');
    s.setItem(BACKUP_KEY, JSON.stringify({ ...defaults(), coins: 74 }));
    r.reset();
    const backup = JSON.parse(s.getItem(RESET_KEY)!);
    expect(backup.main).toBe('broken');
    expect(JSON.parse(backup.previous).coins).toBe(74);
    expect(r.load().pet).toEqual(defaults());
  });
  it('never resets if the before-reset backup cannot be written', () => {
    const s = new MemoryStorage(),
      r = new SaveRepository(s);
    r.save({ ...defaults(), coins: 88 });
    s.failKey = RESET_KEY;
    expect(() => r.reset()).toThrow();
    expect(r.load().pet.coins).toBe(88);
  });
  it('reports write failure while preserving a previous valid save', () => {
    const s = new MemoryStorage(),
      r = new SaveRepository(s);
    r.save({ ...defaults(), coins: 88 });
    s.failKey = SAVE_KEY;
    expect(() => r.save({ ...defaults(), coins: 90 })).toThrow();
    expect(r.load().pet.coins).toBe(88);
  });
  it('handles blocked storage without silently claiming a save', () => {
    const r = new SaveRepository({
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    });
    expect(r.load().readOnly).toBe(true);
    expect(() => r.save(defaults())).toThrow();
  });
});
