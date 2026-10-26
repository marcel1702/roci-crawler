import type { Rng } from './rng';
import type { ActorStats } from './stats';

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const ORIGINS = ['earth', 'mars', 'belt'] as const;
export type Origin = (typeof ORIGINS)[number];

export const SLOTS = ['weapon', 'armor', 'helmet', 'gadget', 'module'] as const;
export type Slot = (typeof SLOTS)[number];

/** Alle Werte, die Ausrüstung verändern kann. Fehlende Einträge zählen als 0. */
export interface StatMods {
  /** Fester Zusatzschaden auf den Grundangriff (Minimum und Maximum). */
  weaponDamage: number;
  /** 0.1 = +10 %. */
  damagePct: number;
  maxHp: number;
  maxHpPct: number;
  armor: number;
  moveSpeedPct: number;
  /** Additiv, 0.05 = +5 Prozentpunkte. */
  critChance: number;
  cooldownReduction: number;
  /** Anteil des verursachten Schadens, der als Leben zurückkommt. */
  lifesteal: number;
  /** Zusätzlicher Anteil, den Tränke heilen. */
  potionHealPct: number;
  /** Zusätzlich tragbare Tränke. */
  extraPotions: number;
}
export type StatKey = keyof StatMods;
export type Mods = Partial<StatMods>;

export type LegendaryId = 'vampiric' | 'medic';

export interface Affix {
  stat: StatKey;
  value: number;
}

export interface Item {
  id: string;
  slot: Slot;
  /** Kennung des Grundtyps (z. B. `crowbar`); der Name kommt aus den Texten. */
  base: string;
  rarity: Rarity;
  origin: Origin;
  /** Gegenstandsstufe: bestimmt, wie stark Werte ausfallen. */
  level: number;
  /** Hauptwert des Platzes (Waffe: Schaden, Rüstung: Panzerung …). */
  primary: Affix;
  /** Fester Bonus der Herkunft. */
  originBonus: Affix;
  affixes: Affix[];
  legendary?: LegendaryId;
}

export const EMPTY_MODS: StatMods = {
  weaponDamage: 0,
  damagePct: 0,
  maxHp: 0,
  maxHpPct: 0,
  armor: 0,
  moveSpeedPct: 0,
  critChance: 0,
  cooldownReduction: 0,
  lifesteal: 0,
  potionHealPct: 0,
  extraPotions: 0,
};

/** Wie stark Werte pro Gegenstandsstufe wachsen: feste Werte linear stark, Prozentwerte schwach. */
const SCALE_PER_LEVEL: Record<StatKey, number> = {
  weaponDamage: 0.1,
  damagePct: 0.025,
  maxHp: 0.1,
  maxHpPct: 0.025,
  armor: 0.1,
  moveSpeedPct: 0.02,
  critChance: 0.02,
  cooldownReduction: 0.02,
  lifesteal: 0,
  potionHealPct: 0.02,
  extraPotions: 0,
};

/** Wertebereiche bei Gegenstandsstufe 1 (vor Seltenheits- und Herkunftsfaktoren). */
export interface StatRange {
  min: number;
  max: number;
}

export interface ItemRules {
  /** Hauptwert je Platz. */
  primary: Record<Slot, { stat: StatKey; range: StatRange }>;
  /** Mögliche Zusatzwerte mit Gewicht und passender Herkunft. */
  affixes: { stat: StatKey; range: StatRange; weight: number; favored?: readonly Origin[] }[];
  /** Fester Herkunftsbonus; mehrere Einträge = zufällig einer davon. */
  originBonus: Record<Origin, { stat: StatKey; range: StatRange }[]>;
  /** Faktor auf den Hauptwert je Herkunft. */
  originPrimaryFactor: Record<Origin, number>;
  /** Faktor auf den Hauptwert je Seltenheit. */
  rarityPrimaryFactor: Record<Rarity, number>;
  /** Anzahl Zusatzwerte je Seltenheit. */
  affixCount: Record<Rarity, number>;
  legendary: Record<LegendaryId, Mods>;
  /** Bonus, wenn mindestens drei ausgerüstete Teile dieselbe Herkunft haben. */
  setBonus: Record<Origin, Mods>;
  /** Grundtypen je Platz. */
  bases: Record<Slot, readonly string[]>;
  /** Verkaufswert je Seltenheit bei Stufe 1. */
  baseValue: Record<Rarity, number>;
}

export function levelScale(stat: StatKey, itemLevel: number): number {
  return 1 + SCALE_PER_LEVEL[stat] * Math.max(0, itemLevel - 1);
}

function rollValue(rng: Rng, stat: StatKey, range: StatRange, itemLevel: number, factor = 1): number {
  const raw = range.min + rng.next() * (range.max - range.min);
  const scaled = raw * levelScale(stat, itemLevel) * factor;
  // Feste Werte sind ganzzahlig, Anteile haben drei Nachkommastellen (0.047 = 4,7 %).
  const isFlat = stat === 'weaponDamage' || stat === 'maxHp' || stat === 'armor' || stat === 'extraPotions';
  return isFlat ? Math.max(1, Math.round(scaled)) : Math.round(scaled * 1000) / 1000;
}

export interface RollOptions {
  itemLevel: number;
  /** Relative Gewichte je Seltenheit. */
  rarityWeights: Record<Rarity, number>;
  slot?: Slot;
  origin?: Origin;
  rarity?: Rarity;
}

function weightedPick<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let roll = rng.next() * total;
  for (const item of items) {
    roll -= weight(item);
    if (roll < 0) return item;
  }
  return items[items.length - 1] as T;
}

/** Würfelt einen Gegenstand. Gleicher Rng-Zustand und gleiche Optionen ergeben denselben Gegenstand. */
export function rollItem(rng: Rng, rules: ItemRules, options: RollOptions): Item {
  const rarity = options.rarity ?? weightedPick(rng, RARITIES, (r) => options.rarityWeights[r]);
  const slot = options.slot ?? rng.pick(SLOTS);
  const origin = options.origin ?? rng.pick(ORIGINS);
  const level = Math.max(1, options.itemLevel);

  const primaryRule = rules.primary[slot];
  const primaryFactor = rules.rarityPrimaryFactor[rarity] * rules.originPrimaryFactor[origin];
  const primary: Affix = {
    stat: primaryRule.stat,
    value: rollValue(rng, primaryRule.stat, primaryRule.range, level, primaryFactor),
  };

  const bonusChoices = rules.originBonus[origin].filter((b) => b.stat !== primary.stat);
  const bonusRule = rng.pick(bonusChoices.length > 0 ? bonusChoices : rules.originBonus[origin]);
  const originBonus: Affix = { stat: bonusRule.stat, value: rollValue(rng, bonusRule.stat, bonusRule.range, level) };

  // Zusatzwerte: jeder Wert höchstens einmal, auch nicht doppelt zu Haupt- und Herkunftswert.
  const taken = new Set<StatKey>([primary.stat, originBonus.stat]);
  const affixes: Affix[] = [];
  for (let i = 0; i < rules.affixCount[rarity]; i++) {
    const pool = rules.affixes.filter((a) => !taken.has(a.stat));
    if (pool.length === 0) break;
    const rule = weightedPick(rng, pool, (a) => a.weight * (a.favored?.includes(origin) ? 3 : 1));
    taken.add(rule.stat);
    affixes.push({ stat: rule.stat, value: rollValue(rng, rule.stat, rule.range, level) });
  }

  const item: Item = {
    id: `i${rng.int(0, 0x7fffffff).toString(36)}${rng.int(0, 0xffff).toString(36)}`,
    slot,
    base: rng.pick(rules.bases[slot]),
    rarity,
    origin,
    level,
    primary,
    originBonus,
    affixes,
  };
  if (rarity === 'legendary') item.legendary = rng.pick(Object.keys(rules.legendary) as LegendaryId[]);
  return item;
}

/** Alle Werte eines Gegenstands als Summe. */
export function itemMods(item: Item, rules: ItemRules): StatMods {
  const mods = { ...EMPTY_MODS };
  for (const affix of [item.primary, item.originBonus, ...item.affixes]) mods[affix.stat] += affix.value;
  if (item.legendary) addMods(mods, rules.legendary[item.legendary]);
  return mods;
}

export function addMods(target: StatMods, extra: Mods): void {
  for (const key of Object.keys(extra) as StatKey[]) target[key] += extra[key] ?? 0;
}

/** Summe aller ausgerüsteten Gegenstände samt Set-Boni (ab drei Teilen gleicher Herkunft). */
export function equipmentMods(items: readonly Item[], rules: ItemRules): StatMods {
  const total = { ...EMPTY_MODS };
  for (const item of items) addMods(total, itemMods(item, rules));
  for (const origin of ORIGINS) {
    if (items.filter((item) => item.origin === origin).length >= 3) addMods(total, rules.setBonus[origin]);
  }
  return total;
}

export function itemValue(item: Item, rules: ItemRules): number {
  return Math.round(rules.baseValue[item.rarity] * (1 + 0.15 * (item.level - 1)));
}

export const ARMOR_K = 120;
export const MAX_COOLDOWN_REDUCTION = 0.4;
export const MAX_CRIT_CHANCE = 0.5;
export const MAX_MOVE_SPEED_BONUS = 0.4;

/** Anteil des Schadens, den Panzerung abhält. */
export function armorReduction(armor: number): number {
  return armor <= 0 ? 0 : armor / (armor + ARMOR_K);
}

export interface DerivedStats {
  stats: ActorStats;
  armor: number;
  critChance: number;
  cooldownReduction: number;
  lifesteal: number;
  potionHealPct: number;
  extraPotions: number;
}

/** Werte der Figur aus Klassenwerten (inkl. Stufe) und Ausrüstung. */
export function deriveStats(base: ActorStats, mods: StatMods): DerivedStats {
  return {
    stats: {
      ...base,
      maxHp: Math.round((base.maxHp + mods.maxHp) * (1 + mods.maxHpPct)),
      damageMin: Math.round((base.damageMin + mods.weaponDamage) * (1 + mods.damagePct)),
      damageMax: Math.round((base.damageMax + mods.weaponDamage) * (1 + mods.damagePct)),
      moveSpeed: base.moveSpeed * (1 + Math.min(MAX_MOVE_SPEED_BONUS, mods.moveSpeedPct)),
    },
    armor: mods.armor,
    critChance: Math.min(MAX_CRIT_CHANCE, mods.critChance),
    cooldownReduction: Math.min(MAX_COOLDOWN_REDUCTION, mods.cooldownReduction),
    lifesteal: mods.lifesteal,
    potionHealPct: mods.potionHealPct,
    extraPotions: Math.round(mods.extraPotions),
  };
}
