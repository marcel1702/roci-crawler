import { itemValue, rollItem, SLOTS } from './items';
import type { Item, ItemRules, Rarity } from './items';
import type { Profile } from './profile';
import type { Rng } from './rng';

/** Ein Gegenstand im Angebot des Händlers. */
export interface ShopOffer {
  item: Item;
  price: number;
}

export const BUY_FACTOR = 3;
export const STOCK_SIZE = 6;

export function buyPrice(item: Item, rules: ItemRules): number {
  return itemValue(item, rules) * BUY_FACTOR;
}

/** Angebot: je Platz ein Gegenstand, dazu ein zufälliger weiterer. Gleicher Rng-Zustand = gleiches Angebot. */
export function generateStock(
  rng: Rng,
  rules: ItemRules,
  itemLevel: number,
  rarityWeights: Record<Rarity, number>,
): ShopOffer[] {
  const slots = [...SLOTS, rng.pick(SLOTS)].slice(0, STOCK_SIZE);
  return slots.map((slot) => {
    const item = rollItem(rng, rules, { itemLevel, rarityWeights, slot });
    return { item, price: buyPrice(item, rules) };
  });
}

export type BuyResult = 'ok' | 'no-credits' | 'bag-full' | 'sold-out';

/** Kauft ein Angebot: zieht Credits ab, legt den Gegenstand in den Rucksack und merkt sich den Kauf. */
export function buy(profile: Profile, offer: ShopOffer): BuyResult {
  if (profile.shopBought.has(offer.item.id)) return 'sold-out';
  if (profile.wallet.credits < offer.price) return 'no-credits';
  if (!profile.inventory.add(offer.item)) return 'bag-full';
  profile.wallet.credits -= offer.price;
  profile.shopBought.add(offer.item.id);
  profile.touch();
  return 'ok';
}
