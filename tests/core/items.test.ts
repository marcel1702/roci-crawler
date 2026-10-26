import { describe, expect, it } from 'vitest';
import { Inventory, BAG_CAPACITY } from '../../src/core/inventory';
import {
  EMPTY_MODS,
  ORIGINS,
  RARITIES,
  SLOTS,
  armorReduction,
  deriveStats,
  equipmentMods,
  itemMods,
  itemValue,
  levelScale,
  rollItem,
} from '../../src/core/items';
import type { Item, Rarity } from '../../src/core/items';
import { createRng } from '../../src/core/rng';
import { ITEM_RULES } from '../../src/data/items';
import { RARITY_WEIGHTS } from '../../src/data/loot';

const only = (rarity: Rarity) => Object.fromEntries(RARITIES.map((r) => [r, r === rarity ? 1 : 0])) as Record<Rarity, number>;
const roll = (seed: number, opts: Partial<Parameters<typeof rollItem>[2]> = {}) =>
  rollItem(createRng(seed), ITEM_RULES, { itemLevel: 1, rarityWeights: RARITY_WEIGHTS.enemy, ...opts });

describe('rollItem', () => {
  it('ist deterministisch pro Rng-Zustand', () => {
    expect(roll(7)).toEqual(roll(7));
    expect(roll(7)).not.toEqual(roll(8));
  });

  it('hat je Seltenheit die richtige Zahl Zusatzwerte und nur Legendäre haben einen Spezialeffekt', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const rarity of RARITIES) {
        const item = roll(seed, { rarityWeights: only(rarity) });
        expect(item.rarity).toBe(rarity);
        expect(item.affixes).toHaveLength(ITEM_RULES.affixCount[rarity]);
        expect(item.legendary !== undefined).toBe(rarity === 'legendary');
      }
    }
  });

  it('Werte sind sinnvoll: positiv, endlich, Zusatzwerte ohne Doppelung, Hauptwert passt zum Platz', () => {
    for (let seed = 0; seed < 500; seed++) {
      const item = roll(seed, { itemLevel: 1 + (seed % 20), rarityWeights: only(RARITIES[seed % 5] as Rarity) });
      const stats = [item.primary.stat, item.originBonus.stat, ...item.affixes.map((a) => a.stat)];
      expect(new Set(stats).size, `Seed ${seed}: Doppelung ${stats}`).toBe(stats.length);
      expect(item.primary.stat).toBe(ITEM_RULES.primary[item.slot].stat);
      for (const affix of [item.primary, item.originBonus, ...item.affixes]) {
        expect(Number.isFinite(affix.value)).toBe(true);
        expect(affix.value).toBeGreaterThan(0);
      }
      expect(ITEM_RULES.bases[item.slot]).toContain(item.base);
    }
  });

  it('gibt Herkunft und Platz vor, wenn verlangt', () => {
    const item = roll(3, { slot: 'helmet', origin: 'mars' });
    expect(item.slot).toBe('helmet');
    expect(item.origin).toBe('mars');
    expect(['damagePct', 'critChance']).toContain(item.originBonus.stat);
  });

  it('Herkunft bestimmt den Charakter: Erde mehr Hauptwert, Gürtel weniger; Boni passen zur Herkunft', () => {
    const avg = (origin: 'earth' | 'mars' | 'belt') => {
      let sum = 0;
      for (let seed = 0; seed < 400; seed++) sum += roll(seed, { slot: 'armor', origin, rarityWeights: only('common'), itemLevel: 5 }).primary.value;
      return sum / 400;
    };
    expect(avg('earth')).toBeGreaterThan(avg('mars'));
    expect(avg('mars')).toBeGreaterThan(avg('belt'));
    for (let seed = 0; seed < 100; seed++) {
      expect(['maxHp', 'armor']).toContain(roll(seed, { origin: 'earth', slot: 'weapon' }).originBonus.stat);
      expect(['moveSpeedPct', 'cooldownReduction', 'zeroGControl']).toContain(roll(seed, { origin: 'belt' }).originBonus.stat);
    }
  });

  it('Gegenstandsstufe skaliert Werte, Seltenheit erhöht den Hauptwert', () => {
    const avg = (opts: Parameters<typeof roll>[1]) => {
      let sum = 0;
      for (let seed = 0; seed < 300; seed++) sum += roll(seed, { slot: 'weapon', origin: 'mars', ...opts }).primary.value;
      return sum / 300;
    };
    expect(avg({ itemLevel: 10, rarityWeights: only('common') })).toBeGreaterThan(avg({ itemLevel: 1, rarityWeights: only('common') }) * 1.5);
    expect(avg({ itemLevel: 5, rarityWeights: only('legendary') })).toBeGreaterThan(avg({ itemLevel: 5, rarityWeights: only('common') }) * 1.4);
  });

  it('Drop-Tabellen: Elite und Wächter liefern deutlich bessere Seltenheit als normale Gegner', () => {
    const rank = (weights: Record<Rarity, number>) => {
      let sum = 0;
      for (let seed = 0; seed < 2000; seed++) sum += RARITIES.indexOf(roll(seed, { rarityWeights: weights }).rarity);
      return sum / 2000;
    };
    expect(rank(RARITY_WEIGHTS.elite)).toBeGreaterThan(rank(RARITY_WEIGHTS.enemy) + 0.8);
    expect(rank(RARITY_WEIGHTS.guardian)).toBeGreaterThan(rank(RARITY_WEIGHTS.elite));
  });
});

describe('Werte aus Ausrüstung', () => {
  const make = (overrides: Partial<Item>): Item => ({
    id: 'x',
    slot: 'weapon',
    base: 'crowbar',
    rarity: 'common',
    origin: 'earth',
    level: 1,
    primary: { stat: 'weaponDamage', value: 5 },
    originBonus: { stat: 'maxHp', value: 10 },
    affixes: [],
    ...overrides,
  });

  it('summiert Haupt-, Herkunfts- und Zusatzwerte sowie Spezialeffekte', () => {
    const item = make({ affixes: [{ stat: 'damagePct', value: 0.05 }], legendary: 'medic', rarity: 'legendary' });
    const mods = itemMods(item, ITEM_RULES);
    expect(mods.weaponDamage).toBe(5);
    expect(mods.maxHp).toBe(10);
    expect(mods.damagePct).toBeCloseTo(0.05);
    expect(mods.extraPotions).toBe(1);
    expect(mods.potionHealPct).toBeCloseTo(0.35);
  });

  it('Set-Bonus gibt es erst ab drei Teilen gleicher Herkunft', () => {
    const earth = (slot: Item['slot'], id: string) => make({ id, slot, origin: 'earth' });
    const two = equipmentMods([earth('weapon', 'a'), earth('armor', 'b')], ITEM_RULES);
    const three = equipmentMods([earth('weapon', 'a'), earth('armor', 'b'), earth('helmet', 'c')], ITEM_RULES);
    expect(two.maxHpPct).toBe(0);
    expect(three.maxHpPct).toBeCloseTo(0.1);
    const mixed = equipmentMods([earth('weapon', 'a'), make({ id: 'b', slot: 'armor', origin: 'mars' }), earth('helmet', 'c')], ITEM_RULES);
    expect(mixed.maxHpPct).toBe(0);
  });

  it('deriveStats wendet Prozent und feste Werte in der richtigen Reihenfolge an und deckelt', () => {
    const base = { maxHp: 100, moveSpeed: 100, radius: 10, damageMin: 10, damageMax: 20, attackRange: 10, attackCooldownMs: 500 };
    const d = deriveStats(base, { ...EMPTY_MODS, maxHp: 20, maxHpPct: 0.5, weaponDamage: 5, damagePct: 0.2, moveSpeedPct: 0.9, critChance: 0.9, cooldownReduction: 0.9, armor: 60 });
    expect(d.stats.maxHp).toBe(180);
    expect(d.stats.damageMin).toBe(18);
    expect(d.stats.damageMax).toBe(30);
    expect(d.stats.moveSpeed).toBeCloseTo(140);
    expect(d.critChance).toBe(0.5);
    expect(d.cooldownReduction).toBe(0.4);
    expect(d.armor).toBe(60);
  });

  it('ohne Ausrüstung bleiben die Klassenwerte unverändert', () => {
    const base = { maxHp: 140, moveSpeed: 150, radius: 11, damageMin: 10, damageMax: 14, attackRange: 14, attackCooldownMs: 550 };
    expect(deriveStats(base, EMPTY_MODS).stats).toEqual(base);
  });

  it('Panzerung hält einen wachsenden, aber nie vollständigen Anteil ab', () => {
    expect(armorReduction(0)).toBe(0);
    expect(armorReduction(120)).toBeCloseTo(0.5);
    expect(armorReduction(10_000)).toBeLessThan(1);
    expect(armorReduction(60)).toBeGreaterThan(armorReduction(30));
  });

  it('levelScale wächst nur bei Stufen über 1; Lebensraub skaliert nicht', () => {
    expect(levelScale('armor', 1)).toBe(1);
    expect(levelScale('armor', 11)).toBeCloseTo(2);
    expect(levelScale('lifesteal', 30)).toBe(1);
  });

  it('Verkaufswert steigt mit Seltenheit und Stufe', () => {
    const common = make({ rarity: 'common' });
    expect(itemValue(make({ rarity: 'legendary' }), ITEM_RULES)).toBeGreaterThan(itemValue(common, ITEM_RULES) * 20);
    expect(itemValue(make({ level: 10 }), ITEM_RULES)).toBeGreaterThan(itemValue(common, ITEM_RULES));
  });
});

describe('Inventory', () => {
  const gen = (n: number, opts: Partial<Parameters<typeof rollItem>[2]> = {}) => roll(n, { rarityWeights: only('rare'), ...opts });

  it('legt Gegenstände ab und meldet, wenn der Rucksack voll ist', () => {
    const inv = new Inventory(ITEM_RULES);
    for (let i = 0; i < BAG_CAPACITY; i++) expect(inv.add(gen(i + 1))).toBe(true);
    expect(inv.isFull).toBe(true);
    expect(inv.add(gen(999))).toBe(false);
  });

  it('rüstet aus, tauscht den alten Gegenstand zurück in den Rucksack und behält die Anzahl', () => {
    const inv = new Inventory(ITEM_RULES);
    const a = gen(1, { slot: 'weapon' });
    const b = gen(2, { slot: 'weapon' });
    inv.add(a);
    inv.add(b);
    expect(inv.equip(a.id)).toBe(true);
    expect(inv.equipped.weapon).toBe(a);
    expect(inv.bag).toEqual([b]);
    expect(inv.equip(b.id)).toBe(true);
    expect(inv.equipped.weapon).toBe(b);
    expect(inv.bag).toEqual([a]);
    expect(inv.equip('gibtsnicht')).toBe(false);
  });

  it('Austausch klappt auch bei vollem Rucksack, Ablegen nicht', () => {
    const inv = new Inventory(ITEM_RULES);
    const worn = gen(100, { slot: 'armor' });
    inv.add(worn);
    inv.equip(worn.id);
    for (let i = 0; i < BAG_CAPACITY; i++) inv.add(gen(i + 1, { slot: 'armor' }));
    expect(inv.isFull).toBe(true);
    expect(inv.unequip('armor')).toBe(false);
    expect(inv.equip((inv.bag[0] as Item).id)).toBe(true);
    expect(inv.bag).toHaveLength(BAG_CAPACITY);
  });

  it('legt ab, wenn Platz ist', () => {
    const inv = new Inventory(ITEM_RULES);
    const item = gen(5, { slot: 'helmet' });
    inv.add(item);
    inv.equip(item.id);
    expect(inv.unequip('helmet')).toBe(true);
    expect(inv.equipped.helmet).toBeNull();
    expect(inv.bag).toEqual([item]);
    expect(inv.unequip('helmet')).toBe(false);
  });

  it('verwertet Gegenstände gegen Credits (halber Wert), unbekannte nicht', () => {
    const inv = new Inventory(ITEM_RULES);
    const item = gen(9);
    inv.add(item);
    const value = inv.scrapValue(item);
    expect(value).toBe(Math.round(itemValue(item, ITEM_RULES) * 0.5));
    expect(inv.scrap(item.id)).toBe(value);
    expect(inv.bag).toHaveLength(0);
    expect(inv.scrap(item.id)).toBe(0);
  });

  it('mods() zählt nur Ausgerüstetes, nicht den Rucksack', () => {
    const inv = new Inventory(ITEM_RULES);
    const item = gen(11, { slot: 'weapon' });
    inv.add(item);
    expect(inv.mods().weaponDamage).toBe(0);
    inv.equip(item.id);
    expect(inv.mods().weaponDamage).toBeGreaterThan(0);
  });

  it('alle Plätze und Herkünfte sind abgedeckt', () => {
    expect(SLOTS).toHaveLength(5);
    expect(ORIGINS).toHaveLength(3);
    for (const slot of SLOTS) expect(ITEM_RULES.bases[slot].length).toBeGreaterThan(0);
  });
});
