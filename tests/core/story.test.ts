import { describe, expect, it } from 'vitest';
import { IMPLEMENTED_ACTS, MISSIONS_PER_ACT, mainMission } from '../../src/core/story';
import { Profile, parseProfile } from '../../src/core/profile';
import { ITEM_RULES } from '../../src/data/items';

describe('Hauptauftrag (Akt-Fortschritt)', () => {
  it('ist gesperrt, bis genug Missionen im Akt geschafft sind', () => {
    for (let done = 0; done < MISSIONS_PER_ACT; done++) {
      const main = mainMission(0, done);
      expect(main).toMatchObject({ act: 1, status: 'locked', remaining: MISSIONS_PER_ACT - done, allCleared: false });
    }
    expect(mainMission(0, MISSIONS_PER_ACT)).toMatchObject({ status: 'ready', remaining: 0 });
    expect(mainMission(0, MISSIONS_PER_ACT + 5).status).toBe('ready');
  });

  it('nach dem Akt kann der Boss erneut herausgefordert werden, und alle vorhandenen Akte gelten als geschafft', () => {
    const main = mainMission(IMPLEMENTED_ACTS, 0);
    expect(main).toMatchObject({ act: IMPLEMENTED_ACTS, status: 'repeat', remaining: 0, allCleared: true });
    // Mehr abgeschlossene Akte als vorhanden ändern nichts.
    expect(mainMission(IMPLEMENTED_ACTS + 2, 0).act).toBe(IMPLEMENTED_ACTS);
  });
});

describe('Profil: Missionen und Akte', () => {
  it('normale Missionen zählen im Akt, der Boss schließt den Akt ab und setzt den Zähler zurück', () => {
    const profile = new Profile(ITEM_RULES);
    for (let i = 0; i < MISSIONS_PER_ACT; i++) profile.completeMission(false, IMPLEMENTED_ACTS);
    expect(profile).toMatchObject({ missionsCompleted: MISSIONS_PER_ACT, actMissions: MISSIONS_PER_ACT, actsCleared: 0 });

    profile.completeMission(true, IMPLEMENTED_ACTS);
    expect(profile).toMatchObject({ missionsCompleted: MISSIONS_PER_ACT + 1, actMissions: 0, actsCleared: 1 });
  });

  it('der Boss ein weiteres Mal zählt für die Gesamtzahl, schließt aber keinen Akt mehr ab', () => {
    const profile = new Profile(ITEM_RULES);
    profile.completeMission(true, IMPLEMENTED_ACTS);
    profile.completeMission(true, IMPLEMENTED_ACTS);
    expect(profile).toMatchObject({ missionsCompleted: 2, actsCleared: IMPLEMENTED_ACTS, actMissions: 0 });
  });

  it('Fortschritt übersteht Speichern und Laden; ältere Spielstände starten bei null', () => {
    const profile = new Profile(ITEM_RULES);
    profile.completeMission(false, IMPLEMENTED_ACTS);
    profile.completeMission(false, IMPLEMENTED_ACTS);
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
});
