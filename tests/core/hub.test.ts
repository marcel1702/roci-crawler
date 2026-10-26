import { describe, expect, it } from 'vitest';
import { DIFFICULTY_RULES, generateContracts, LOCATION_COUNT, progressSeed } from '../../src/core/contracts';
import { parseLevel } from '../../src/core/level';
import { findPath } from '../../src/core/pathfinding';
import { Profile } from '../../src/core/profile';
import { createRng } from '../../src/core/rng';
import { BUY_FACTOR, STOCK_SIZE, buy, buyPrice, generateStock } from '../../src/core/shop';
import { SLOTS, itemValue } from '../../src/core/items';
import { HUB_LAYOUT, HUB_MARKERS } from '../../src/data/levels/hub';
import { ITEM_RULES } from '../../src/data/items';
import { RARITY_WEIGHTS } from '../../src/data/loot';

describe('Hub-Karte', () => {
  const hub = parseLevel(HUB_LAYOUT, 32, HUB_MARKERS);

  it('enthält alle Stationen genau einmal und drei Besatzungsplätze', () => {
    for (const marker of 'MWHT') expect(hub.markers[marker], `Station ${marker}`).toHaveLength(1);
    expect(hub.markers.n).toHaveLength(3);
  });

  it('alle Stationen und Besatzungsplätze sind vom Start erreichbar (auch für die Spielfigur mit Radius)', () => {
    const points = [...Object.values(hub.markers).flat()];
    expect(points.length).toBeGreaterThanOrEqual(7);
    for (const point of points) {
      expect(hub.grid.isWalkable(hub.grid.toCol(point.x), hub.grid.toRow(point.y))).toBe(true);
      expect(findPath(hub.grid, hub.playerStart, point, 11), `Pfad zu ${JSON.stringify(point)}`).not.toBeNull();
    }
  });

  it('parseLevel lehnt unbekannte Zeichen weiterhin ab, wenn sie nicht als Marker erlaubt sind', () => {
    expect(() => parseLevel({ rows: ['#M@#'] }, 32)).toThrow(/Unbekanntes/);
    expect(parseLevel({ rows: ['#M@#'] }, 32, 'M').markers.M).toHaveLength(1);
  });
});

describe('Aufträge', () => {
  it('sind deterministisch, verschieden und haben einen schweren Auftrag', () => {
    const a = generateContracts(createRng(5));
    const b = generateContracts(createRng(5));
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(a.map((c) => c.difficulty)).toEqual(['normal', 'normal', 'hard']);
    expect(new Set(a.map((c) => c.location)).size).toBe(3);
    expect(new Set(a.map((c) => c.seed)).size).toBe(3);
    for (const c of a) {
      expect(c.location).toBeGreaterThanOrEqual(0);
      expect(c.location).toBeLessThan(LOCATION_COUNT);
    }
  });

  it('schwer ist härter, aber lohnender', () => {
    expect(DIFFICULTY_RULES.hard.hp).toBeGreaterThan(DIFFICULTY_RULES.normal.hp);
    expect(DIFFICULTY_RULES.hard.damage).toBeGreaterThan(DIFFICULTY_RULES.normal.damage);
    expect(DIFFICULTY_RULES.hard.loot).toBeGreaterThan(DIFFICULTY_RULES.normal.loot);
    expect(DIFFICULTY_RULES.hard.credits).toBeGreaterThan(DIFFICULTY_RULES.normal.credits);
  });

  it('progressSeed ändert sich mit dem Fortschritt und ist sonst stabil', () => {
    expect(progressSeed(3, 1)).toBe(progressSeed(3, 1));
    expect(progressSeed(3, 1)).not.toBe(progressSeed(4, 1));
    expect(progressSeed(3, 1)).not.toBe(progressSeed(3, 2));
  });
});

describe('Händler', () => {
  const stock = () => generateStock(createRng(11), ITEM_RULES, 5, RARITY_WEIGHTS.chest);

  it('bietet je Platz mindestens einen Gegenstand, eindeutig und deterministisch', () => {
    const offers = stock();
    expect(offers).toHaveLength(STOCK_SIZE);
    for (const slot of SLOTS) expect(offers.some((o) => o.item.slot === slot)).toBe(true);
    expect(new Set(offers.map((o) => o.item.id)).size).toBe(offers.length);
    expect(stock().map((o) => o.item.id)).toEqual(offers.map((o) => o.item.id));
  });

  it('Preis = Wert × Faktor, deutlich über dem Verwertungswert', () => {
    const offer = stock()[0]!;
    expect(offer.price).toBe(itemValue(offer.item, ITEM_RULES) * BUY_FACTOR);
    expect(buyPrice(offer.item, ITEM_RULES)).toBe(offer.price);
  });

  it('Kauf: Credits werden abgezogen, Gegenstand kommt in den Rucksack, nicht doppelt kaufbar', () => {
    const profile = new Profile(ITEM_RULES);
    const offer = stock()[0]!;
    profile.wallet.add(offer.price + 7);
    let touches = 0;
    profile.onChange = () => touches++;

    expect(buy(profile, offer)).toBe('ok');
    expect(profile.wallet.credits).toBe(7);
    expect(profile.inventory.bag).toContain(offer.item);
    expect(touches).toBe(1);
    expect(buy(profile, offer)).toBe('sold-out');
  });

  it('Kauf scheitert bei zu wenig Credits oder vollem Rucksack, ohne etwas zu verändern', () => {
    const profile = new Profile(ITEM_RULES);
    const [first, second] = stock();
    expect(buy(profile, first!)).toBe('no-credits');
    expect(profile.shopBought.size).toBe(0);

    profile.wallet.add(100000);
    for (let i = 0; i < profile.inventory.capacity; i++) profile.inventory.add(stock()[1 + (i % 4)]!.item);
    const credits = profile.wallet.credits;
    expect(buy(profile, second!)).toBe('bag-full');
    expect(profile.wallet.credits).toBe(credits);
    expect(profile.shopBought.has(second!.item.id)).toBe(false);
  });

  it('gekaufte Angebote bleiben im Spielstand erhalten', async () => {
    const { parseProfile } = await import('../../src/core/profile');
    const profile = new Profile(ITEM_RULES);
    profile.wallet.add(100000);
    buy(profile, stock()[2]!);
    const loaded = parseProfile(JSON.parse(JSON.stringify(profile.toJSON())), ITEM_RULES).profile;
    expect([...(loaded?.shopBought ?? [])]).toEqual([...profile.shopBought]);
  });
});
