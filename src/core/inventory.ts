import type { Item, ItemRules, Slot, StatMods } from './items';
import { SLOTS, equipmentMods, itemValue } from './items';

export const BAG_CAPACITY = 20;
/** Anteil des Wertes, den Verwerten einbringt. */
export const SCRAP_FACTOR = 0.5;

export type EquippedItems = Record<Slot, Item | null>;

/** Rucksack und ausgerüstete Gegenstände. Reine Daten, keine Anzeige. */
export class Inventory {
  readonly bag: Item[] = [];
  readonly equipped: EquippedItems = { weapon: null, armor: null, helmet: null, gadget: null, module: null };

  constructor(
    private readonly rules: ItemRules,
    readonly capacity = BAG_CAPACITY,
  ) {}

  get isFull(): boolean {
    return this.bag.length >= this.capacity;
  }

  equippedItems(): Item[] {
    return SLOTS.map((slot) => this.equipped[slot]).filter((item): item is Item => item !== null);
  }

  mods(): StatMods {
    return equipmentMods(this.equippedItems(), this.rules);
  }

  /** Legt einen Gegenstand in den Rucksack. False, wenn er voll ist. */
  add(item: Item): boolean {
    if (this.isFull) return false;
    this.bag.push(item);
    return true;
  }

  find(id: string): Item | null {
    return this.bag.find((item) => item.id === id) ?? this.equippedItems().find((item) => item.id === id) ?? null;
  }

  /**
   * Rüstet einen Gegenstand aus dem Rucksack aus; der bisherige Gegenstand des Platzes kommt in den Rucksack.
   * Liefert false, wenn der Gegenstand nicht im Rucksack ist.
   */
  equip(id: string): boolean {
    const index = this.bag.findIndex((item) => item.id === id);
    if (index < 0) return false;
    const item = this.bag[index] as Item;
    const previous = this.equipped[item.slot];
    // Tausch an derselben Stelle, damit der Rucksack nicht überläuft.
    if (previous) this.bag[index] = previous;
    else this.bag.splice(index, 1);
    this.equipped[item.slot] = item;
    return true;
  }

  /** Legt einen ausgerüsteten Gegenstand in den Rucksack ab. False, wenn der Rucksack voll ist oder nichts ausgerüstet ist. */
  unequip(slot: Slot): boolean {
    const item = this.equipped[slot];
    if (!item || this.isFull) return false;
    this.equipped[slot] = null;
    this.bag.push(item);
    return true;
  }

  /** Verwertet einen Gegenstand aus dem Rucksack und liefert die Credits (0, wenn er nicht gefunden wurde). */
  scrap(id: string): number {
    const index = this.bag.findIndex((item) => item.id === id);
    if (index < 0) return 0;
    const [item] = this.bag.splice(index, 1) as [Item];
    return Math.max(1, Math.round(itemValue(item, this.rules) * SCRAP_FACTOR));
  }

  scrapValue(item: Item): number {
    return Math.max(1, Math.round(itemValue(item, this.rules) * SCRAP_FACTOR));
  }
}
