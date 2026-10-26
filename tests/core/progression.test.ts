import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, Progression, xpToNextLevel } from '../../src/core/progression';
import { scaleStats, statsAtLevel } from '../../src/core/stats';

const BASE = { maxHp: 100, moveSpeed: 100, radius: 10, damageMin: 10, damageMax: 20, attackRange: 10, attackCooldownMs: 500 };

describe('xpToNextLevel', () => {
  it('steigt streng mit der Stufe', () => {
    for (let level = 1; level < MAX_LEVEL; level++) {
      expect(xpToNextLevel(level + 1)).toBeGreaterThan(xpToNextLevel(level));
    }
  });
});

describe('Progression', () => {
  it('sammelt Erfahrung ohne Stufenaufstieg', () => {
    const p = new Progression();
    expect(p.gain(10)).toEqual([]);
    expect(p.level).toBe(1);
    expect(p.xp).toBe(10);
    expect(p.fraction).toBeCloseTo(10 / xpToNextLevel(1));
  });

  it('steigt auf und behält den Überschuss', () => {
    const p = new Progression();
    const need = xpToNextLevel(1);
    expect(p.gain(need + 5)).toEqual([2]);
    expect(p.level).toBe(2);
    expect(p.xp).toBe(5);
  });

  it('kann mehrere Stufen auf einmal steigen', () => {
    const p = new Progression();
    const reached = p.gain(xpToNextLevel(1) + xpToNextLevel(2) + 1);
    expect(reached).toEqual([2, 3]);
    expect(p.level).toBe(3);
  });

  it('endet an der Maximalstufe und ignoriert weitere Erfahrung', () => {
    const p = new Progression(MAX_LEVEL - 1, 0);
    expect(p.gain(1_000_000)).toEqual([MAX_LEVEL]);
    expect(p.atMaxLevel).toBe(true);
    expect(p.xp).toBe(0);
    expect(p.fraction).toBe(1);
    expect(p.gain(500)).toEqual([]);
  });

  it('ignoriert nicht positive Mengen', () => {
    const p = new Progression();
    expect(p.gain(0)).toEqual([]);
    expect(p.gain(-5)).toEqual([]);
    expect(p.xp).toBe(0);
  });
});

describe('statsAtLevel / scaleStats', () => {
  it('Stufe 1 entspricht den Grundwerten', () => {
    expect(statsAtLevel(BASE, { hpPerLevel: 12, damagePerLevel: 0.1 }, 1)).toEqual(BASE);
  });

  it('wächst linear pro Stufe', () => {
    const s = statsAtLevel(BASE, { hpPerLevel: 10, damagePerLevel: 0.1 }, 6);
    expect(s.maxHp).toBe(150);
    expect(s.damageMin).toBe(15);
    expect(s.damageMax).toBe(30);
    expect(s.moveSpeed).toBe(100);
  });

  it('scaleStats verändert nur Leben und Schaden, nie unter 1', () => {
    const s = scaleStats(BASE, 1.5, 0.01);
    expect(s.maxHp).toBe(150);
    expect(s.damageMin).toBe(1);
    expect(s.damageMax).toBe(1);
    expect(s.moveSpeed).toBe(100);
  });
});
