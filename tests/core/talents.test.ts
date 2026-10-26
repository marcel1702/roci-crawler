import { describe, expect, it } from 'vitest';
import {
  TIER_UNLOCK,
  availablePoints,
  canRankUp,
  rankUp,
  respecCost,
  sanitizeRanks,
  spentInBranch,
  talentEffects,
  totalSpent,
} from '../../src/core/talents';
import type { TalentRanks, TalentTree } from '../../src/core/talents';

const tree: TalentTree = {
  branches: ['a', 'b', 'c'],
  nodes: [
    { id: 'a1', branch: 0, tier: 1, maxRank: 3, mods: { maxHp: 10 } },
    { id: 'a2', branch: 0, tier: 2, maxRank: 3, mods: { armor: 5 }, ability: { slot: 0, cooldown: 0.1, damage: 0.05 } },
    { id: 'a3', branch: 0, tier: 3, maxRank: 3, ability: { slot: 2, area: 0.1 } },
    { id: 'a4', branch: 0, tier: 4, maxRank: 1, mods: { maxHpPct: 0.1 } },
    { id: 'b1', branch: 1, tier: 1, maxRank: 3, mods: { damagePct: 0.05 } },
  ],
};

describe('Talentpunkte', () => {
  it('ein Punkt je Stufe ab Stufe 2', () => {
    expect(availablePoints(tree, {}, 1)).toBe(0);
    expect(availablePoints(tree, {}, 2)).toBe(1);
    expect(availablePoints(tree, { a1: 2 }, 5)).toBe(2);
    expect(availablePoints(tree, { a1: 3, a2: 3 }, 3)).toBe(0); // nie negativ
  });

  it('Rang erhöhen kostet einen Punkt, begrenzt durch Maximalrang und Punkte', () => {
    let ranks: TalentRanks = {};
    expect(canRankUp(tree, ranks, 'a1', 1)).toBe(false); // keine Punkte
    ranks = rankUp(tree, ranks, 'a1', 4) ?? {};
    ranks = rankUp(tree, ranks, 'a1', 4) ?? {};
    ranks = rankUp(tree, ranks, 'a1', 4) ?? {};
    expect(ranks).toEqual({ a1: 3 });
    expect(rankUp(tree, ranks, 'a1', 30)).toBeNull(); // Maximalrang
    expect(rankUp(tree, ranks, 'gibtsnicht', 30)).toBeNull();
  });

  it('höhere Reihen brauchen Punkte im Zweig; ein anderer Zweig zählt nicht', () => {
    expect(TIER_UNLOCK[2]).toBe(3);
    expect(canRankUp(tree, {}, 'a2', 30)).toBe(false);
    expect(canRankUp(tree, { b1: 3 }, 'a2', 30)).toBe(false);
    expect(canRankUp(tree, { a1: 2 }, 'a2', 30)).toBe(false);
    expect(canRankUp(tree, { a1: 3 }, 'a2', 30)).toBe(true);
    expect(canRankUp(tree, { a1: 3, a2: 2 }, 'a3', 30)).toBe(false); // 5 < 6
    expect(canRankUp(tree, { a1: 3, a2: 3 }, 'a3', 30)).toBe(true);
    expect(canRankUp(tree, { a1: 3, a2: 3, a3: 2 }, 'a4', 30)).toBe(false); // 8 < 9
    expect(canRankUp(tree, { a1: 3, a2: 3, a3: 3 }, 'a4', 30)).toBe(true);
    expect(spentInBranch(tree, { a1: 3, b1: 2 }, 0)).toBe(3);
    expect(totalSpent(tree, { a1: 3, b1: 2 })).toBe(5);
  });

  it('Zurücksetzen kostet mit der Stufe mehr', () => {
    expect(respecCost(10)).toBeGreaterThan(respecCost(2));
  });
});

describe('talentEffects', () => {
  it('summiert Werte und Fähigkeits-Verbesserungen pro Rang', () => {
    const { mods, boosts } = talentEffects(tree, { a1: 2, a2: 3, a3: 1, a4: 1, b1: 3 });
    expect(mods.maxHp).toBe(20);
    expect(mods.armor).toBe(15);
    expect(mods.maxHpPct).toBeCloseTo(0.1);
    expect(mods.damagePct).toBeCloseTo(0.15);
    expect(boosts[0]).toMatchObject({ cooldown: expect.closeTo(0.3, 5), damage: expect.closeTo(0.15, 5), area: 0 });
    expect(boosts[2]?.area).toBeCloseTo(0.1);
    expect(boosts[1]).toEqual({ cooldown: 0, damage: 0, area: 0, duration: 0 });
  });

  it('ohne Talente ändert sich nichts', () => {
    const { mods, boosts } = talentEffects(tree, {});
    expect(Object.values(mods).every((v) => v === 0)).toBe(true);
    expect(boosts.every((b) => Object.values(b).every((v) => v === 0))).toBe(true);
  });
});

describe('sanitizeRanks', () => {
  it('übernimmt gültige Ränge, begrenzt sie und verwirft Unbekanntes', () => {
    expect(sanitizeRanks(tree, { a1: 99, x: 5, b1: -2, a2: 'viel' }, 30)).toEqual({ a1: 3 });
  });

  it('setzt alles zurück, wenn mehr Punkte vergeben sind als verdient', () => {
    expect(sanitizeRanks(tree, { a1: 3, b1: 3 }, 4)).toEqual({}); // 6 Punkte, nur 3 verdient
    expect(sanitizeRanks(tree, { a1: 3, b1: 3 }, 7)).toEqual({ a1: 3, b1: 3 });
  });

  it('setzt zurück, wenn Reihen ohne Freischaltung belegt sind (manipulierte Daten)', () => {
    expect(sanitizeRanks(tree, { a2: 1 }, 30)).toEqual({});
    expect(sanitizeRanks(tree, { a1: 3, a2: 3, a4: 1 }, 30)).toEqual({});
  });

  it('nimmt Müll nicht an', () => {
    expect(sanitizeRanks(tree, null, 30)).toEqual({});
    expect(sanitizeRanks(tree, [1, 2], 30)).toEqual({});
    expect(sanitizeRanks(tree, 'x', 30)).toEqual({});
  });
});
