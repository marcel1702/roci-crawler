import type { ItemRules } from '../core/items';

/**
 * Regeln für Gegenstände: Wertebereiche bei Gegenstandsstufe 1, Gewichte, Herkunfts- und Set-Boni.
 * Alle Zahlen sind Startwerte für das spätere Balancing.
 */
export const ITEM_RULES: ItemRules = {
  primary: {
    weapon: { stat: 'weaponDamage', range: { min: 4, max: 6 } },
    armor: { stat: 'armor', range: { min: 10, max: 16 } },
    helmet: { stat: 'maxHp', range: { min: 20, max: 30 } },
    gadget: { stat: 'moveSpeedPct', range: { min: 0.04, max: 0.06 } },
    module: { stat: 'critChance', range: { min: 0.03, max: 0.05 } },
  },
  affixes: [
    { stat: 'damagePct', range: { min: 0.04, max: 0.08 }, weight: 3, favored: ['mars'] },
    { stat: 'weaponDamage', range: { min: 2, max: 4 }, weight: 2, favored: ['mars'] },
    { stat: 'critChance', range: { min: 0.02, max: 0.04 }, weight: 2, favored: ['mars'] },
    { stat: 'maxHp', range: { min: 12, max: 24 }, weight: 3, favored: ['earth'] },
    { stat: 'maxHpPct', range: { min: 0.03, max: 0.06 }, weight: 2, favored: ['earth'] },
    { stat: 'armor', range: { min: 6, max: 12 }, weight: 3, favored: ['earth'] },
    { stat: 'potionHealPct', range: { min: 0.05, max: 0.1 }, weight: 1.5, favored: ['earth'] },
    { stat: 'moveSpeedPct', range: { min: 0.03, max: 0.06 }, weight: 2, favored: ['belt'] },
    { stat: 'cooldownReduction', range: { min: 0.03, max: 0.06 }, weight: 2, favored: ['belt'] },
    { stat: 'lifesteal', range: { min: 0.01, max: 0.02 }, weight: 0.7 },
  ],
  originBonus: {
    earth: [
      { stat: 'maxHp', range: { min: 8, max: 14 } },
      { stat: 'armor', range: { min: 4, max: 8 } },
    ],
    mars: [
      { stat: 'damagePct', range: { min: 0.03, max: 0.05 } },
      { stat: 'critChance', range: { min: 0.015, max: 0.03 } },
    ],
    belt: [
      { stat: 'moveSpeedPct', range: { min: 0.02, max: 0.04 } },
      { stat: 'cooldownReduction', range: { min: 0.02, max: 0.04 } },
    ],
  },
  originPrimaryFactor: { earth: 1.2, mars: 1, belt: 0.9 },
  rarityPrimaryFactor: { common: 1, uncommon: 1.1, rare: 1.25, epic: 1.45, legendary: 1.7 },
  affixCount: { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 },
  legendary: {
    vampiric: { lifesteal: 0.06 },
    medic: { potionHealPct: 0.35, extraPotions: 1 },
  },
  setBonus: {
    earth: { maxHpPct: 0.1 },
    mars: { damagePct: 0.1 },
    belt: { moveSpeedPct: 0.08, cooldownReduction: 0.08 },
  },
  bases: {
    weapon: ['crowbar', 'baton', 'magpistol'],
    armor: ['vest', 'spacesuit', 'jacket'],
    helmet: ['helmet', 'visor'],
    gadget: ['magboots', 'scanner'],
    module: ['reactor', 'targeting'],
  },
  baseValue: { common: 5, uncommon: 14, rare: 35, epic: 90, legendary: 250 },
};
