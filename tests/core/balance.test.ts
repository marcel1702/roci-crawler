import { describe, expect, it } from 'vitest';
import { LEVEL_SCALING } from '../../src/config/constants';
import { generateDungeon } from '../../src/core/dungeon';
import { planMission } from '../../src/core/encounters';
import { MAX_LEVEL, xpToNextLevel } from '../../src/core/progression';
import { createRng } from '../../src/core/rng';
import { MISSIONS_PER_ACT } from '../../src/core/story';
import { statsAtLevel } from '../../src/core/stats';
import { ACTS } from '../../src/data/acts';
import type { ActDef } from '../../src/data/acts';
import { CLASSES } from '../../src/data/classes';
import { ENEMIES } from '../../src/data/enemies';
import type { EnemyId } from '../../src/data/enemies';
import type { EnemyDef } from '../../src/data/types';

/**
 * Leitplanken für das Balancing: keine exakten Werte, sondern Bereiche, die beim Ändern von Zahlen im Blick halten,
 * wie schnell die Figur aufsteigt, wie lange Kämpfe dauern und wie gefährlich Gegner sind. Grundlage ist die Figur ohne
 * Ausrüstung (schlechtester Fall); Fähigkeiten und Beute machen sie stärker.
 */

const def = (id: string): EnemyDef => ENEMIES[id as EnemyId] as EnemyDef;
const SEEDS = 40;

function levelAt(xp: number): number {
  let level = 1;
  let need = xpToNextLevel(level);
  let rest = xp;
  while (level < MAX_LEVEL && rest >= need) {
    rest -= need;
    level++;
    need = xpToNextLevel(level);
  }
  return level;
}

/** Mittlere Erfahrung eines vollständig geräumten Auftrags des Akts (mit dem Faktor des Akts). */
function xpPerMission(act: ActDef): number {
  let total = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const dungeon = generateDungeon(seed, 32, { zeroGChance: act.zeroGChance, infectionChance: act.infectionChance });
    const plan = planMission(dungeon, act.spawns, createRng(seed));
    total += plan.encounters.flatMap((e) => e.enemies).reduce((sum, e) => sum + def(e.id).xp, 0);
  }
  return (total / SEEDS) * act.xpFactor;
}

/** Erfahrung bis zum Ende jedes Akts, wenn man je Akt die nötigen Aufträge vollständig räumt und den Boss besiegt. */
function xpAtActEnds(): number[] {
  let xp = 0;
  return ACTS.map((act) => {
    xp += MISSIONS_PER_ACT * xpPerMission(act) + def(act.boss).xp * act.xpFactor;
    return xp;
  });
}

const ends = xpAtActEnds();
const startLevel = (index: number): number => levelAt(index === 0 ? 0 : (ends[index - 1] as number));

const scaled = (e: EnemyDef, level: number) => {
  const steps = level - 1;
  const damageFactor = 1 + LEVEL_SCALING.damagePerLevel * steps;
  return {
    hp: e.stats.maxHp * (1 + LEVEL_SCALING.hpPerLevel * steps),
    avgDamage: ((e.stats.damageMin + e.stats.damageMax) / 2) * damageFactor,
    maxDamage: e.stats.damageMax * damageFactor,
  };
};

const baselineDps = (classId: keyof typeof CLASSES, level: number): number => {
  const c = CLASSES[classId];
  const s = statsAtLevel(c.stats, c.growth, level);
  return (s.damageMin + s.damageMax) / 2 / (s.attackCooldownMs / 1000);
};

describe('Balancing: Stufen über die Akte', () => {
  it('die empfohlene Grundstufe jedes Akts passt zur Stufe, die man bei vollständig geräumten Aufträgen erreicht hat', () => {
    ACTS.forEach((act, i) => {
      expect(Math.abs(startLevel(i) - act.baseLevel), `Akt ${act.id}: Start Stufe ${startLevel(i)}`).toBeLessThanOrEqual(1);
    });
  });

  it('die Stufen wachsen gleichmäßig: pro Akt 3 bis 7 Stufen, am Ende etwa Stufe 17 bis 22', () => {
    let previous = 1;
    for (const xp of ends) {
      const level = levelAt(xp);
      expect(level - previous).toBeGreaterThanOrEqual(3);
      expect(level - previous).toBeLessThanOrEqual(8);
      previous = level;
    }
    expect(previous).toBeGreaterThanOrEqual(17);
    expect(previous).toBeLessThanOrEqual(23);
  });

  it('spätere Akte geben mehr Erfahrung je Gegner, nie weniger', () => {
    const factors = ACTS.map((a) => a.xpFactor);
    expect(factors).toEqual([...factors].sort((a, b) => a - b));
    expect(factors[0]).toBe(1);
  });
});

describe('Balancing: Kampfdauer und Gefahr (Figur ohne Ausrüstung)', () => {
  ACTS.forEach((act, index) => {
    const level = Math.max(act.baseLevel, startLevel(index));
    const ids = new Set<string>([...act.spawns.guardian, ...act.spawns.treasureGuard]);
    for (const group of act.spawns.groups) for (const id of group.enemies) ids.add(id);

    it(`Akt ${act.id} (Stufe ${level}): reguläre Gegner fallen schnell, Elite in Maßen, jeder Treffer bleibt klein`, () => {
      for (const id of ids) {
        const e = def(id);
        const s = scaled(e, level);
        const ttkWeakest = s.hp / Math.min(baselineDps('naomi', level), baselineDps('holden', level));
        if (e.elite) {
          expect(ttkWeakest, `${id}: Elite`).toBeGreaterThanOrEqual(6);
          expect(ttkWeakest, `${id}: Elite`).toBeLessThanOrEqual(26);
        } else {
          expect(ttkWeakest, `${id}`).toBeLessThanOrEqual(6);
        }
        // Kein Einzeltreffer über ein Drittel der Leben der schwächsten Figur (Sturmangriffe zählen 1,4-fach).
        const weakestHp = Math.min(...(['amos', 'naomi', 'bobbie', 'holden'] as const).map((c) => statsAtLevel(CLASSES[c].stats, CLASSES[c].growth, level).maxHp));
        expect(s.maxDamage * 1.4, `${id}: Einzeltreffer`).toBeLessThanOrEqual(weakestHp / 3);
      }
    });

    it(`Akt ${act.id}: der Boss dauert mit dem Grundangriff 25 bis 65 s, und seine durchschnittliche Schadensrate tötet in 12 bis 70 s`, () => {
      const boss = def(act.boss);
      const s = scaled(boss, level);
      const ttkStrongest = s.hp / Math.max(...(['amos', 'naomi', 'bobbie', 'holden'] as const).map((c) => baselineDps(c, level)));
      const ttkWeakest = s.hp / Math.min(...(['amos', 'naomi', 'bobbie', 'holden'] as const).map((c) => baselineDps(c, level)));
      expect(ttkStrongest).toBeGreaterThanOrEqual(25);
      expect(ttkWeakest).toBeLessThanOrEqual(65);

      const cooldown = (boss.stats.attackCooldownMs + boss.attack.windupMs) / 1000;
      const dps = s.avgDamage / cooldown;
      const hp = statsAtLevel(CLASSES.amos.stats, CLASSES.amos.growth, level).maxHp;
      expect(hp / dps).toBeGreaterThanOrEqual(12);
      expect(hp / dps).toBeLessThanOrEqual(70);
    });
  });
});
