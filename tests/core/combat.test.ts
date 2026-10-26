import { describe, expect, it } from 'vitest';
import { Cooldown } from '../../src/core/cooldown';
import { edgeDistance, isInReach, rollDamage } from '../../src/core/combat';
import { createRng } from '../../src/core/rng';

describe('Reichweite', () => {
  const a = { x: 0, y: 0, radius: 10 };

  it('misst von Rand zu Rand', () => {
    expect(edgeDistance(a, { x: 30, y: 0, radius: 10 })).toBe(10);
    expect(edgeDistance(a, { x: 15, y: 0, radius: 10 })).toBe(-5);
  });

  it('trifft genau an der Reichweitengrenze', () => {
    expect(isInReach(a, { x: 30, y: 0, radius: 10 }, 10)).toBe(true);
    expect(isInReach(a, { x: 30.5, y: 0, radius: 10 }, 10)).toBe(false);
  });
});

describe('rollDamage', () => {
  it('bleibt im Schadensbereich und trifft beide Grenzen', () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const damage = rollDamage({ damageMin: 3, damageMax: 6 }, rng);
      expect(damage).toBeGreaterThanOrEqual(3);
      expect(damage).toBeLessThanOrEqual(6);
      seen.add(damage);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });
});

describe('Cooldown', () => {
  it('ist erst nach Ablauf wieder bereit', () => {
    const cooldown = new Cooldown();
    expect(cooldown.ready).toBe(true);
    cooldown.trigger(500);
    expect(cooldown.ready).toBe(false);
    cooldown.update(300);
    expect(cooldown.ready).toBe(false);
    cooldown.update(300);
    expect(cooldown.ready).toBe(true);
  });
});

describe('createRng', () => {
  it('ist deterministisch pro Seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    expect(createRng(43).next()).not.toBe(createRng(42).next());
  });

  it('liefert Werte in [0,1) und int() inklusive Grenzen', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(rng.int(5, 5)).toBe(5);
  });

  it('pick() wirft bei leerer Liste', () => {
    expect(() => createRng(1).pick([])).toThrow();
  });
});
