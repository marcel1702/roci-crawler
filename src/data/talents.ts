import type { TalentNode, TalentTree } from '../core/talents';
import type { ClassId } from './types';

/** Kurzschreibweise für einen Knoten; Text-Schlüssel: `talent.<id>`. */
function n(id: string, branch: number, tier: number, maxRank: number, effect: Omit<TalentNode, 'id' | 'branch' | 'tier' | 'maxRank'>): TalentNode {
  return { id, branch, tier, maxRank, ...effect };
}

/**
 * Talentbäume: je Klasse 3 Zweige mit 4 Reihen (3 Ränge je Knoten, die vierte Reihe ein Rang).
 * Ein Punkt je Stufe ab Stufe 2 (29 bis Stufe 30); alles zu füllen sind 30 Punkte, es bleibt also eine Auswahl.
 * `slot` meint die Fähigkeiten-Taste 0–2 der Klasse (siehe `data/classes.ts`). Werte pro Rang.
 */
export const TALENTS: Record<ClassId, TalentTree> = {
  amos: {
    branches: ['talent.branch.amos.0', 'talent.branch.amos.1', 'talent.branch.amos.2'],
    nodes: [
      n('amos.b1', 0, 1, 3, { mods: { maxHp: 20 } }),
      n('amos.b2', 0, 2, 3, { mods: { armor: 7 } }),
      n('amos.b3', 0, 3, 3, { ability: { slot: 1, duration: 0.2, cooldown: 0.07 } }),
      n('amos.b4', 0, 4, 1, { mods: { maxHpPct: 0.15, armor: 25 } }),
      n('amos.s1', 1, 1, 3, { mods: { damagePct: 0.06 } }),
      n('amos.s2', 1, 2, 3, { ability: { slot: 0, cooldown: 0.1, damage: 0.1 } }),
      n('amos.s3', 1, 3, 3, { ability: { slot: 2, area: 0.12, damage: 0.1 } }),
      n('amos.s4', 1, 4, 1, { mods: { critChance: 0.12, damagePct: 0.1 } }),
      n('amos.p1', 2, 1, 3, { mods: { potionHealPct: 0.08 } }),
      n('amos.p2', 2, 2, 3, { mods: { moveSpeedPct: 0.04 } }),
      n('amos.p3', 2, 3, 3, { mods: { potionHealPct: 0.06, maxHp: 10 } }),
      n('amos.p4', 2, 4, 1, { mods: { lifesteal: 0.05, cooldownReduction: 0.08, extraPotions: 1 } }),
    ],
  },
  naomi: {
    branches: ['talent.branch.naomi.0', 'talent.branch.naomi.1', 'talent.branch.naomi.2'],
    nodes: [
      n('naomi.d1', 0, 1, 3, { ability: { slot: 0, duration: 0.15 } }),
      n('naomi.d2', 0, 2, 3, { ability: { slot: 0, damage: 0.15 } }),
      n('naomi.d3', 0, 3, 3, { ability: { slot: 0, cooldown: 0.1, damage: 0.05 } }),
      n('naomi.d4', 0, 4, 1, { ability: { slot: 0, damage: 0.3, duration: 0.3 } }),
      n('naomi.h1', 1, 1, 3, { ability: { slot: 1, cooldown: 0.08 } }),
      n('naomi.h2', 1, 2, 3, { ability: { slot: 1, duration: 0.15, damage: 0.05 } }),
      n('naomi.h3', 1, 3, 3, { ability: { slot: 2, area: 0.12, damage: 0.1 } }),
      n('naomi.h4', 1, 4, 1, { mods: { critChance: 0.1 }, ability: { slot: 1, cooldown: 0.2 } }),
      n('naomi.i1', 2, 1, 3, { mods: { damagePct: 0.05 } }),
      n('naomi.i2', 2, 2, 3, { mods: { moveSpeedPct: 0.04 } }),
      n('naomi.i3', 2, 3, 3, { mods: { maxHp: 15 } }),
      n('naomi.i4', 2, 4, 1, { mods: { cooldownReduction: 0.1, moveSpeedPct: 0.08 } }),
    ],
  },
  bobbie: {
    branches: ['talent.branch.bobbie.0', 'talent.branch.bobbie.1', 'talent.branch.bobbie.2'],
    nodes: [
      n('bobbie.w1', 0, 1, 3, { mods: { damagePct: 0.05 } }),
      n('bobbie.w2', 0, 2, 3, { ability: { slot: 0, area: 0.1, damage: 0.1 } }),
      n('bobbie.w3', 0, 3, 3, { ability: { slot: 2, damage: 0.12, cooldown: 0.06 } }),
      n('bobbie.w4', 0, 4, 1, { ability: { slot: 0, cooldown: 0.25, damage: 0.2 } }),
      n('bobbie.p1', 1, 1, 3, { mods: { armor: 8 } }),
      n('bobbie.p2', 1, 2, 3, { mods: { maxHp: 20 } }),
      n('bobbie.p3', 1, 3, 3, { ability: { slot: 1, duration: 0.2, cooldown: 0.07 } }),
      n('bobbie.p4', 1, 4, 1, { mods: { maxHpPct: 0.15, lifesteal: 0.03 } }),
      n('bobbie.z1', 2, 1, 3, { mods: { critChance: 0.03 } }),
      n('bobbie.z2', 2, 2, 3, { mods: { damagePct: 0.05 } }),
      n('bobbie.z3', 2, 3, 3, { mods: { critChance: 0.04 }, ability: { slot: 2, damage: 0.05 } }),
      n('bobbie.z4', 2, 4, 1, { mods: { critChance: 0.12, damagePct: 0.1 } }),
    ],
  },
  holden: {
    branches: ['talent.branch.holden.0', 'talent.branch.holden.1', 'talent.branch.holden.2'],
    nodes: [
      n('holden.b1', 0, 1, 3, { ability: { slot: 0, cooldown: 0.07 } }),
      n('holden.b2', 0, 2, 3, { ability: { slot: 0, damage: 0.12, area: 0.08 } }),
      n('holden.b3', 0, 3, 3, { ability: { slot: 1, duration: 0.2, damage: 0.1 } }),
      n('holden.b4', 0, 4, 1, { ability: { slot: 0, cooldown: 0.15 } }),
      n('holden.d1', 1, 1, 3, { ability: { slot: 2, duration: 0.15 } }),
      n('holden.d2', 1, 2, 3, { ability: { slot: 2, damage: 0.1, cooldown: 0.06 } }),
      n('holden.d3', 1, 3, 3, { mods: { cooldownReduction: 0.04 } }),
      n('holden.d4', 1, 4, 1, { mods: { damagePct: 0.1, moveSpeedPct: 0.08 } }),
      n('holden.u1', 2, 1, 3, { mods: { maxHp: 15 } }),
      n('holden.u2', 2, 2, 3, { mods: { potionHealPct: 0.08 } }),
      n('holden.u3', 2, 3, 3, { mods: { armor: 6 } }),
      n('holden.u4', 2, 4, 1, { mods: { lifesteal: 0.04, maxHpPct: 0.12 } }),
    ],
  },
};
