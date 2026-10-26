import { describe, expect, it } from 'vitest';
import { Inventory } from '../../src/core/inventory';
import { rollItem } from '../../src/core/items';
import { SAVE_VERSION, Profile, parseProfile } from '../../src/core/profile';
import { createRng } from '../../src/core/rng';
import { ITEM_RULES } from '../../src/data/items';
import { RARITY_WEIGHTS } from '../../src/data/loot';
import { SAVE_KEY, SaveStore } from '../../src/persistence/saveStore';
import type { StorageLike } from '../../src/persistence/saveStore';

const item = (seed: number, slot?: 'weapon' | 'armor') =>
  rollItem(createRng(seed), ITEM_RULES, { itemLevel: 4, rarityWeights: RARITY_WEIGHTS.chest, slot });

function filledProfile(): Profile {
  const profile = new Profile(ITEM_RULES);
  profile.progression.gain(500);
  profile.wallet.add(321);
  profile.missionsCompleted = 4;
  const weapon = item(1, 'weapon');
  profile.inventory.add(weapon);
  profile.inventory.equip(weapon.id);
  for (let i = 2; i < 8; i++) profile.inventory.add(item(i));
  return profile;
}

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('voll');
    this.data.set(key, value);
  }
}

describe('Profil: Speichern und Laden', () => {
  it('Rundreise über JSON ergibt dasselbe Profil', () => {
    const original = filledProfile();
    const { profile } = parseProfile(JSON.parse(JSON.stringify(original.toJSON())), ITEM_RULES);
    expect(profile).not.toBeNull();
    expect(profile?.toJSON()).toEqual(original.toJSON());
    expect(profile?.inventory.mods()).toEqual(original.inventory.mods());
  });

  it('wirft nur kaputte Gegenstände weg, nicht den ganzen Spielstand', () => {
    const data = JSON.parse(JSON.stringify(filledProfile().toJSON()));
    data.bag[0].rarity = 'mythisch';
    data.bag[1].primary.stat = 'zauberkraft';
    data.bag[2] = 'müll';
    data.bag[3].level = -5;
    const { profile } = parseProfile(data, ITEM_RULES);
    expect(profile?.progression.level).toBeGreaterThan(1);
    expect(profile?.wallet.credits).toBe(321);
    expect(profile?.inventory.bag.length).toBe(data.bag.length - 4);
    expect(profile?.inventory.equipped.weapon).not.toBeNull();
  });

  it('verwirft doppelte Gegenstände und falsch einsortierte Ausrüstung', () => {
    const data = JSON.parse(JSON.stringify(filledProfile().toJSON()));
    data.bag.push(JSON.parse(JSON.stringify(data.bag[0])));
    data.equipped.armor = JSON.parse(JSON.stringify(data.equipped.weapon)); // Waffe im Rüstungsplatz
    const { profile } = parseProfile(data, ITEM_RULES);
    expect(profile?.inventory.bag.length).toBe(data.bag.length - 1);
    expect(profile?.inventory.equipped.armor).toBeNull();
  });

  it('begrenzt unsinnige Zahlen', () => {
    const { profile } = parseProfile({ version: SAVE_VERSION, level: 9999, xp: -50, credits: -1, bag: [], equipped: {} }, ITEM_RULES);
    expect(profile?.progression.level).toBe(30);
    expect(profile?.progression.xp).toBe(0);
    expect(profile?.wallet.credits).toBe(0);
  });

  it('erkennt Fremdes als beschädigt und neuere Versionen als zu neu', () => {
    expect(parseProfile(null, ITEM_RULES).problem).toBe('corrupt');
    expect(parseProfile([], ITEM_RULES).problem).toBe('corrupt');
    expect(parseProfile({ level: 3 }, ITEM_RULES).problem).toBe('corrupt');
    expect(parseProfile({ version: SAVE_VERSION + 1 }, ITEM_RULES).problem).toBe('too-new');
  });

  it('Rucksack-Kapazität wird beim Laden nicht überschritten', () => {
    const data = JSON.parse(JSON.stringify(filledProfile().toJSON()));
    data.bag = Array.from({ length: 60 }, (_, i) => item(1000 + i));
    const { profile } = parseProfile(JSON.parse(JSON.stringify(data)), ITEM_RULES);
    expect(profile?.inventory.bag.length).toBe(new Inventory(ITEM_RULES).capacity);
  });
});

describe('SaveStore', () => {
  it('speichert und lädt über den Speicher', () => {
    const storage = new FakeStorage();
    const store = new SaveStore(storage, ITEM_RULES);
    expect(store.load().profile).toBeNull();
    expect(store.save(filledProfile())).toBe(true);
    const loaded = new SaveStore(storage, ITEM_RULES).load();
    expect(loaded.profile?.wallet.credits).toBe(321);
    expect(loaded.problem).toBeUndefined();
  });

  it('sichert beschädigte Daten, bevor sie überschrieben werden', () => {
    const storage = new FakeStorage();
    storage.data.set(SAVE_KEY, '{kaputt');
    const store = new SaveStore(storage, ITEM_RULES);
    expect(store.load()).toEqual({ profile: null, problem: 'corrupt' });
    expect(storage.data.get(`${SAVE_KEY}:backup`)).toBe('{kaputt');
  });

  it('überschreibt nie den Spielstand einer neueren Version', () => {
    const storage = new FakeStorage();
    const future = JSON.stringify({ version: SAVE_VERSION + 5, data: 'neu' });
    storage.data.set(SAVE_KEY, future);
    const store = new SaveStore(storage, ITEM_RULES);
    expect(store.load().problem).toBe('too-new');
    expect(store.save(filledProfile())).toBe(false);
    expect(storage.data.get(SAVE_KEY)).toBe(future);
  });

  it('übersteht fehlenden oder vollen Speicher ohne Absturz', () => {
    expect(new SaveStore(null, ITEM_RULES).load().profile).toBeNull();
    expect(new SaveStore(null, ITEM_RULES).save(filledProfile())).toBe(false);
    const full = new FakeStorage();
    full.failWrites = true;
    expect(new SaveStore(full, ITEM_RULES).save(filledProfile())).toBe(false);
  });

  it('touch() meldet Änderungen', () => {
    const profile = new Profile(ITEM_RULES);
    let calls = 0;
    profile.onChange = () => calls++;
    profile.touch();
    profile.touch();
    expect(calls).toBe(2);
  });
});
