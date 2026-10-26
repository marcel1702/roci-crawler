import type { Rarity } from '../core/items';
import type { LootSource } from './types';

/** Hebt die Gewichte seltener Beute (selten und besser) um `factor`; 1 ändert nichts. */
export function boostedWeights(weights: Record<Rarity, number>, factor: number): Record<Rarity, number> {
  return { ...weights, rare: weights.rare * factor, epic: weights.epic * factor, legendary: weights.legendary * factor };
}

/** Relative Gewichte der Seltenheiten je Beutequelle. */
export const RARITY_WEIGHTS: Record<LootSource, Record<Rarity, number>> = {
  enemy: { common: 70, uncommon: 22, rare: 7, epic: 0.9, legendary: 0.1 },
  elite: { common: 10, uncommon: 40, rare: 35, epic: 13, legendary: 2 },
  guardian: { common: 0, uncommon: 20, rare: 50, epic: 25, legendary: 5 },
  chest: { common: 20, uncommon: 45, rare: 28, epic: 6, legendary: 1 },
};

/** Wahrscheinlichkeit, dass die Quelle überhaupt einen Gegenstand fallen lässt. */
export const DROP_CHANCE: Record<LootSource, number> = {
  enemy: 0.12,
  elite: 1,
  guardian: 1,
  chest: 1,
};
