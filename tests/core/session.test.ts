import { describe, expect, it } from 'vitest';
import { Profile } from '../../src/core/profile';
import { ITEM_RULES } from '../../src/data/items';
import { SAVE_KEY } from '../../src/persistence/saveStore';
import type { StorageLike } from '../../src/persistence/saveStore';
import { SLOT_COUNT, Session } from '../../src/persistence/session';

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

describe('Session', () => {
  it('beginnt mit drei leeren Plätzen', () => {
    const session = new Session(new FakeStorage(), ITEM_RULES);
    expect(session.summaries()).toEqual(Array(SLOT_COUNT).fill(null));
    expect(session.lastSlot()).toBeNull();
    expect(session.profile).toBeNull();
  });

  it('neues Spiel belegt den Platz, wird sofort gespeichert und ist aktiv', () => {
    const storage = new FakeStorage();
    const session = new Session(storage, ITEM_RULES);
    const profile = session.startNew(2, 'amos');
    expect(session.activeSlot).toBe(2);
    expect(session.profile).toBe(profile);
    const summaries = session.summaries();
    expect(summaries[0]).toBeNull();
    expect(summaries[1]).toMatchObject({ slot: 2, classId: 'amos', level: 1, credits: 0, missionsCompleted: 0 });
    expect(summaries[1]?.savedAt).toBeGreaterThan(0);
    expect(session.lastSlot()).toBe(2);
  });

  it('lädt einen belegten Platz mit allen Daten, leere Plätze liefern null', () => {
    const storage = new FakeStorage();
    const first = new Session(storage, ITEM_RULES);
    const profile = first.startNew(1, 'amos');
    profile.wallet.add(77);
    profile.progression.gain(500);
    first.end(); // speichert immer den aktuellen Stand

    const again = new Session(storage, ITEM_RULES);
    expect(again.load(3)).toBeNull();
    const loaded = again.load(1);
    expect(loaded?.wallet.credits).toBe(77);
    expect(loaded?.progression.level).toBeGreaterThan(1);
  });

  it('Änderungen mit touch() werden gespeichert, auch beim Beenden der Sitzung', () => {
    const storage = new FakeStorage();
    const session = new Session(storage, ITEM_RULES);
    const profile = session.startNew(1, 'amos');
    profile.wallet.add(123);
    profile.touch();
    session.end(); // flush
    const loaded = new Session(storage, ITEM_RULES).load(1);
    expect(loaded?.wallet.credits).toBe(123);
  });

  it('Spielstände sind voneinander getrennt', () => {
    const storage = new FakeStorage();
    const session = new Session(storage, ITEM_RULES);
    session.startNew(1, 'amos').wallet.add(5);
    session.profile?.touch();
    session.startNew(2, 'amos');
    session.profile?.wallet.add(900);
    session.profile?.touch();
    session.end();
    const s = session.summaries();
    expect(s[0]?.credits).toBe(5);
    expect(s[1]?.credits).toBe(900);
  });

  it('Löschen leert den Platz und beendet ihn, falls er aktiv ist; andere bleiben', () => {
    const storage = new FakeStorage();
    const session = new Session(storage, ITEM_RULES);
    session.startNew(1, 'amos');
    session.startNew(3, 'amos');
    session.delete(3);
    expect(session.activeSlot).toBeNull();
    expect(session.summaries().map((x) => x !== null)).toEqual([true, false, false]);
    expect(session.lastSlot()).toBeNull(); // der zuletzt gespielte Platz ist weg
  });

  it('übernimmt den alten Einzelspielstand (Meilenstein 4) in Platz 1, ohne ihn zu zerstören', () => {
    const storage = new FakeStorage();
    const legacy = new Profile(ITEM_RULES);
    legacy.wallet.add(250);
    storage.setItem(SAVE_KEY, JSON.stringify(legacy.toJSON()));

    const session = new Session(storage, ITEM_RULES);
    expect(session.summaries()[0]).toMatchObject({ slot: 1, credits: 250 });
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    // Ein zweites Mal ändert nichts mehr
    expect(new Session(storage, ITEM_RULES).summaries()[0]).toMatchObject({ credits: 250 });
  });

  it('überschreibt einen vorhandenen Platz 1 nicht mit dem alten Spielstand', () => {
    const storage = new FakeStorage();
    const old = new Profile(ITEM_RULES);
    old.wallet.add(1);
    storage.setItem(SAVE_KEY, JSON.stringify(old.toJSON()));
    const first = new Session(storage, ITEM_RULES);
    first.load(1)?.wallet.add(999);
    first.profile?.touch();
    first.end();
    // Der alte Eintrag ist weg, ein erneuter Start darf Platz 1 nicht zurücksetzen.
    expect(new Session(storage, ITEM_RULES).summaries()[0]?.credits).toBe(1000);
  });

  it('funktioniert ohne Browser-Speicher', () => {
    const session = new Session(null, ITEM_RULES);
    expect(session.summaries()).toEqual(Array(SLOT_COUNT).fill(null));
    expect(() => session.startNew(1, 'amos')).not.toThrow();
    expect(session.profile).not.toBeNull();
  });
});
