import { describe, expect, it } from 'vitest';
import { IMPLEMENTED_ACTS, MISSIONS_PER_ACT, highestUnlockedAct, mainMission } from '../../src/core/story';
import { Profile, parseProfile } from '../../src/core/profile';
import { ITEM_RULES } from '../../src/data/items';

describe('Hauptauftrag (Akt-Fortschritt)', () => {
  it('ist gesperrt, bis genug Missionen im Akt geschafft sind', () => {
    for (let done = 0; done < MISSIONS_PER_ACT; done++) {
      expect(mainMission(1, 0, done)).toMatchObject({ act: 1, status: 'locked', remaining: MISSIONS_PER_ACT - done, allCleared: false });
    }
    expect(mainMission(1, 0, MISSIONS_PER_ACT)).toMatchObject({ status: 'ready', remaining: 0 });
    expect(mainMission(1, 0, MISSIONS_PER_ACT + 5).status).toBe('ready');
  });

  it('geschaffte Akte lassen sich wiederholen, der nächste ist gesperrt, bis die Missionen geschafft sind', () => {
    expect(mainMission(1, 1, 0)).toMatchObject({ act: 1, status: 'repeat', remaining: 0, allCleared: false });
    expect(mainMission(2, 1, 1)).toMatchObject({ act: 2, status: 'locked', remaining: MISSIONS_PER_ACT - 1 });
    expect(mainMission(2, 1, MISSIONS_PER_ACT).status).toBe('ready');
  });

  it('nicht freigeschaltete Akte werden auf den höchsten spielbaren begrenzt; nach dem letzten gelten alle als geschafft', () => {
    expect(mainMission(2, 0, 0).act).toBe(1);
    expect(mainMission(99, IMPLEMENTED_ACTS, 0)).toMatchObject({ act: IMPLEMENTED_ACTS, status: 'repeat', allCleared: true });
    expect(highestUnlockedAct(0)).toBe(1);
    expect(highestUnlockedAct(1)).toBe(Math.min(2, IMPLEMENTED_ACTS));
    expect(highestUnlockedAct(IMPLEMENTED_ACTS + 3)).toBe(IMPLEMENTED_ACTS);
  });
});

describe('Profil: Missionen und Akte', () => {
  it('Missionen im laufenden Akt zählen, der Boss schließt den Akt ab und setzt den Zähler zurück', () => {
    const profile = new Profile(ITEM_RULES);
    for (let i = 0; i < MISSIONS_PER_ACT; i++) profile.completeMission(1, false);
    expect(profile).toMatchObject({ missionsCompleted: MISSIONS_PER_ACT, actMissions: MISSIONS_PER_ACT, actsCleared: 0 });

    profile.completeMission(1, true);
    expect(profile).toMatchObject({ missionsCompleted: MISSIONS_PER_ACT + 1, actMissions: 0, actsCleared: 1 });

    profile.completeMission(2, false);
    expect(profile).toMatchObject({ actMissions: 1, actsCleared: 1 });
  });

  it('frühere Akte zählen nur für die Gesamtzahl; ein Boss ein weiteres Mal schließt nichts ab', () => {
    const profile = new Profile(ITEM_RULES);
    profile.completeMission(1, true);
    profile.completeMission(1, true);
    profile.completeMission(1, false);
    expect(profile).toMatchObject({ missionsCompleted: 3, actsCleared: 1, actMissions: 0 });
  });

  it('ein späterer Akt kann nicht vor dem früheren abgeschlossen werden', () => {
    const profile = new Profile(ITEM_RULES);
    profile.completeMission(2, true);
    expect(profile).toMatchObject({ missionsCompleted: 1, actsCleared: 0, actMissions: 0 });
  });

  it('Fortschritt übersteht Speichern und Laden; ältere Spielstände starten bei null', () => {
    const profile = new Profile(ITEM_RULES);
    profile.completeMission(1, false);
    profile.completeMission(1, false);
    const loaded = parseProfile(JSON.parse(JSON.stringify(profile)), ITEM_RULES).profile;
    expect(loaded).toMatchObject({ missionsCompleted: 2, actMissions: 2, actsCleared: 0 });

    const old = parseProfile({ version: 1, classId: 'amos', level: 3, xp: 0, credits: 10, missionsCompleted: 5, bag: [], equipped: {} }, ITEM_RULES).profile;
    expect(old).toMatchObject({ missionsCompleted: 5, actMissions: 0, actsCleared: 0 });
  });

  it('kaputte Werte im Spielstand werden begrenzt', () => {
    const raw = { version: 1, classId: 'amos', level: 1, xp: 0, credits: 0, missionsCompleted: 0, actsCleared: 99, actMissions: -4, bag: [], equipped: {} };
    expect(parseProfile(raw, ITEM_RULES).profile).toMatchObject({ actsCleared: 3, actMissions: 0 });
    expect(parseProfile({ ...raw, actsCleared: 'x', actMissions: null }, ITEM_RULES).profile).toMatchObject({ actsCleared: 0, actMissions: 0 });
  });

  it('der Abspann gilt als gesehen, sobald er gespeichert wurde; ältere Stände haben ihn nicht gesehen', () => {
    const profile = new Profile(ITEM_RULES);
    expect(profile.endingSeen).toBe(false);
    profile.endingSeen = true;
    expect(parseProfile(JSON.parse(JSON.stringify(profile)), ITEM_RULES).profile?.endingSeen).toBe(true);
    const old = { version: 1, classId: 'amos', level: 1, xp: 0, credits: 0, missionsCompleted: 0, bag: [], equipped: {} };
    expect(parseProfile(old, ITEM_RULES).profile?.endingSeen).toBe(false);
    expect(parseProfile({ ...old, endingSeen: 'ja' }, ITEM_RULES).profile?.endingSeen).toBe(false);
  });
});
