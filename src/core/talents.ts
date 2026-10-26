import { EMPTY_MODS, addMods } from './items';
import type { Mods, StatMods } from './items';

/** Verbesserungen einer Fähigkeit aus Talenten (Anteile, 0.1 = +10 %; Abklingzeit: Verkürzung). */
export interface AbilityBoost {
  cooldown: number;
  damage: number;
  area: number;
  duration: number;
}

export const NO_BOOST: AbilityBoost = { cooldown: 0, damage: 0, area: 0, duration: 0 };

export interface TalentNode {
  id: string;
  /** Zweig 0–2. */
  branch: number;
  /** Reihe 1–4; höhere Reihen schalten sich durch Punkte im Zweig frei. */
  tier: number;
  maxRank: number;
  /** Pro Rang addierte Werte. */
  mods?: Mods;
  /** Pro Rang addierte Verbesserung der Fähigkeit auf Taste `slot` (0–2). */
  ability?: { slot: number } & Partial<AbilityBoost>;
}

export interface TalentTree {
  /** Text-Schlüssel der drei Zweige. */
  branches: readonly [string, string, string];
  nodes: readonly TalentNode[];
}

export type TalentRanks = Record<string, number>;

/** Punkte, die in einem Zweig stecken müssen, damit die Reihe (Index = Reihe) freigeschaltet ist. */
export const TIER_UNLOCK: readonly number[] = [0, 0, 3, 6, 9];

export const BRANCH_COUNT = 3;

function node(tree: TalentTree, id: string): TalentNode | undefined {
  return tree.nodes.find((n) => n.id === id);
}

export function rankOf(ranks: TalentRanks, id: string): number {
  return ranks[id] ?? 0;
}

export function spentInBranch(tree: TalentTree, ranks: TalentRanks, branch: number): number {
  return tree.nodes.filter((n) => n.branch === branch).reduce((sum, n) => sum + rankOf(ranks, n.id), 0);
}

export function totalSpent(tree: TalentTree, ranks: TalentRanks): number {
  return tree.nodes.reduce((sum, n) => sum + rankOf(ranks, n.id), 0);
}

/** Ein Talentpunkt pro Stufe ab Stufe 2. */
export function availablePoints(tree: TalentTree, ranks: TalentRanks, level: number): number {
  return Math.max(0, level - 1 - totalSpent(tree, ranks));
}

export function isUnlocked(tree: TalentTree, ranks: TalentRanks, n: TalentNode): boolean {
  return spentInBranch(tree, ranks, n.branch) >= (TIER_UNLOCK[n.tier] ?? 0);
}

export function canRankUp(tree: TalentTree, ranks: TalentRanks, id: string, level: number): boolean {
  const n = node(tree, id);
  return !!n && rankOf(ranks, id) < n.maxRank && availablePoints(tree, ranks, level) > 0 && isUnlocked(tree, ranks, n);
}

/** Erhöht den Rang um 1 und liefert die neuen Ränge (oder null, wenn es nicht möglich ist). */
export function rankUp(tree: TalentTree, ranks: TalentRanks, id: string, level: number): TalentRanks | null {
  return canRankUp(tree, ranks, id, level) ? { ...ranks, [id]: rankOf(ranks, id) + 1 } : null;
}

/** Kosten, alle Talente zurückzusetzen. */
export function respecCost(level: number): number {
  return 25 * level;
}

export interface TalentEffects {
  mods: StatMods;
  /** Je Fähigkeiten-Taste (0–2). */
  boosts: AbilityBoost[];
}

export function talentEffects(tree: TalentTree, ranks: TalentRanks): TalentEffects {
  const mods = { ...EMPTY_MODS };
  const boosts: AbilityBoost[] = [{ ...NO_BOOST }, { ...NO_BOOST }, { ...NO_BOOST }];
  for (const n of tree.nodes) {
    const rank = rankOf(ranks, n.id);
    if (rank === 0) continue;
    if (n.mods) {
      const scaled: Mods = {};
      for (const key of Object.keys(n.mods) as (keyof StatMods)[]) scaled[key] = (n.mods[key] ?? 0) * rank;
      addMods(mods, scaled);
    }
    const target = n.ability ? boosts[n.ability.slot] : undefined;
    if (n.ability && target) {
      for (const key of ['cooldown', 'damage', 'area', 'duration'] as const) target[key] += (n.ability[key] ?? 0) * rank;
    }
  }
  return { mods, boosts };
}

/**
 * Macht gespeicherte Ränge verlässlich: unbekannte Talente fallen weg, Ränge werden begrenzt. Passen die Punkte nicht
 * (mehr als verdient) oder ist eine Reihe nicht freigeschaltet, werden alle Talente zurückgesetzt.
 */
export function sanitizeRanks(tree: TalentTree, raw: unknown, level: number): TalentRanks {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const ranks: TalentRanks = {};
  for (const n of tree.nodes) {
    const value = (raw as Record<string, unknown>)[n.id];
    if (typeof value === 'number' && Number.isFinite(value)) {
      const rank = Math.min(n.maxRank, Math.max(0, Math.floor(value)));
      if (rank > 0) ranks[n.id] = rank;
    }
  }
  if (totalSpent(tree, ranks) > Math.max(0, level - 1)) return {};
  // Reihenfolge der Freischaltung prüfen: Punkte einer Reihe dürfen nur mit genug Punkten darunter vergeben sein.
  for (let branch = 0; branch < BRANCH_COUNT; branch++) {
    for (let tier = 2; tier <= 4; tier++) {
      const below = tree.nodes.filter((n) => n.branch === branch && n.tier < tier).reduce((sum, n) => sum + rankOf(ranks, n.id), 0);
      const here = tree.nodes.filter((n) => n.branch === branch && n.tier === tier).reduce((sum, n) => sum + rankOf(ranks, n.id), 0);
      if (here > 0 && below < (TIER_UNLOCK[tier] ?? 0)) return {};
    }
  }
  return ranks;
}
