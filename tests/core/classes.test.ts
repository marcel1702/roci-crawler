import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../../src/abilities';
import { BRANCH_COUNT, talentEffects } from '../../src/core/talents';
import { densestPoint, distanceToSegment } from '../../src/core/math';
import { ALLIES } from '../../src/data/allies';
import { CLASSES, CLASS_LIST } from '../../src/data/classes';
import { TALENTS } from '../../src/data/talents';
import type { ClassId } from '../../src/data/types';
import { de } from '../../src/i18n/de';
import { talentLines } from '../../src/i18n/talents';

const ids = Object.keys(CLASSES) as ClassId[];

describe('Klassen', () => {
  it('alle vier Klassen sind definiert, wählbar und haben je drei verschiedene Fähigkeiten', () => {
    expect(ids.sort()).toEqual(['amos', 'bobbie', 'holden', 'naomi']);
    expect(CLASS_LIST.map((c) => c.id).sort()).toEqual(ids);
    for (const info of CLASS_LIST) expect(info.available).toBe(true);
    for (const id of ids) {
      const def = CLASSES[id];
      expect(new Set(def.abilities).size).toBe(3);
      for (const ability of def.abilities) {
        expect(ABILITIES[ability], `${id}: ${ability}`).toBeDefined();
        expect(de[`ability.${ability}.name` as keyof typeof de], `Text für ${ability}`).toBeTruthy();
        expect(ABILITIES[ability].cooldownMs).toBeGreaterThan(0);
      }
      expect(def.stats.maxHp).toBeGreaterThan(0);
      expect(def.stats.attackRange).toBeGreaterThan(0);
      expect(de[def.nameKey]).toBeTruthy();
      expect(de[def.roleKey]).toBeTruthy();
    }
  });

  it('Fernkämpfer haben Reichweite und Geschwindigkeit, Amos kämpft im Nahkampf', () => {
    expect(CLASSES.amos.basic.kind).toBe('melee');
    for (const id of ['naomi', 'bobbie', 'holden'] as const) {
      const basic = CLASSES[id].basic;
      expect(basic.kind).toBe('ranged');
      if (basic.kind === 'ranged') expect(basic.projectileSpeed).toBeGreaterThan(200);
      expect(CLASSES[id].stats.attackRange).toBeGreaterThan(100);
    }
  });

  it('jede Fähigkeit gehört genau zu einer Klasse', () => {
    const used = ids.flatMap((id) => [...CLASSES[id].abilities]);
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(new Set(Object.keys(ABILITIES)));
  });

  it('Verbündete sind vollständig beschrieben', () => {
    for (const ally of Object.values(ALLIES)) {
      expect(ally.lifetimeMs).toBeGreaterThan(0);
      expect(ally.damageFactor).toBeGreaterThan(0);
      expect(ally.aggroRange).toBeGreaterThan(ally.attackRange);
    }
  });
});

describe('Talentbäume', () => {
  it.each(ids)('%s: 3 Zweige × 4 Reihen, eindeutige Kennungen, sinnvolle Ränge, vollständige Texte', (id) => {
    const tree = TALENTS[id];
    expect(tree.nodes).toHaveLength(12);
    expect(new Set(tree.nodes.map((n) => n.id)).size).toBe(12);
    for (let branch = 0; branch < BRANCH_COUNT; branch++) {
      const tiers = tree.nodes.filter((n) => n.branch === branch).map((n) => n.tier).sort();
      expect(tiers).toEqual([1, 2, 3, 4]);
      expect(de[tree.branches[branch] as keyof typeof de]).toBeTruthy();
    }
    for (const n of tree.nodes) {
      expect(n.id.startsWith(`${id}.`)).toBe(true);
      expect(n.maxRank).toBe(n.tier === 4 ? 1 : 3);
      expect(n.mods || n.ability, `${n.id} hat keine Wirkung`).toBeTruthy();
      expect(de[`talent.${n.id}` as keyof typeof de], `Name ${n.id}`).toBeTruthy();
      if (n.ability) expect([0, 1, 2]).toContain(n.ability.slot);
      expect(talentLines(n, CLASSES[id]).length, `Beschreibung ${n.id}`).toBeGreaterThan(0);
    }
  });

  it.each(ids)('%s: es gibt mehr Ränge als Punkte (echte Auswahl), aber genug für einen vollen Zweig', (id) => {
    const tree = TALENTS[id];
    const totalRanks = tree.nodes.reduce((s, n) => s + n.maxRank, 0);
    expect(totalRanks).toBeGreaterThanOrEqual(29); // mehr als Punkte bis Stufe 30
    const branchRanks = tree.nodes.filter((n) => n.branch === 0).reduce((s, n) => s + n.maxRank, 0);
    expect(branchRanks).toBeLessThanOrEqual(29);
  });

  it('Talente wirken: mit vollem Zweig steigen Werte oder Verbesserungen', () => {
    const tree = TALENTS.amos;
    const ranks = Object.fromEntries(tree.nodes.filter((n) => n.branch === 0).map((n) => [n.id, n.maxRank]));
    const { mods, boosts } = talentEffects(tree, ranks);
    expect(mods.maxHp).toBe(60);
    expect(mods.armor).toBe(21 + 25);
    expect(boosts[1]?.duration).toBeCloseTo(0.6);
  });
});

describe('Geometrie-Helfer', () => {
  it('distanceToSegment misst zur Strecke, nicht zur Geraden', () => {
    expect(distanceToSegment(5, 3, 0, 0, 10, 0)).toBe(3);
    expect(distanceToSegment(-4, 3, 0, 0, 10, 0)).toBe(5);
    expect(distanceToSegment(14, 3, 0, 0, 10, 0)).toBe(5);
    expect(distanceToSegment(3, 4, 0, 0, 0, 0)).toBe(5);
  });

  it('densestPoint findet die dichteste Gruppe', () => {
    expect(densestPoint([], 50)).toBeNull();
    const group = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 12 },
    ];
    const lone = { x: 300, y: 300 };
    const best = densestPoint([lone, ...group], 50);
    expect(group).toContainEqual(best);
    expect(densestPoint([lone], 50)).toEqual(lone);
  });
});
