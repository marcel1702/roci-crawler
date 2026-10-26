import { describe, expect, it } from 'vitest';
import { Profile, parseProfile } from '../../src/core/profile';
import { TIP_IDS, isTipId } from '../../src/core/tips';
import { ITEM_RULES } from '../../src/data/items';
import { de } from '../../src/i18n/de';

describe('Einführungshinweise', () => {
  it('jeder Hinweis hat einen Text, und der Sprecher „Tipp“ ist definiert', () => {
    expect(de['say.tip']).toBeTruthy();
    for (const id of TIP_IDS) expect(de[`tip.${id}` as keyof typeof de], id).toBeTruthy();
    expect(Object.keys(de).filter((k) => k.startsWith('tip.')).sort()).toEqual(TIP_IDS.map((id) => `tip.${id}`).sort());
  });

  it('ein Hinweis zählt nur beim ersten Mal als neu', () => {
    const profile = new Profile(ITEM_RULES);
    expect(profile.markTip('loot')).toBe(true);
    expect(profile.markTip('loot')).toBe(false);
    expect(profile.markTip('telegraph')).toBe(true);
  });

  it('gesehene Hinweise bleiben gespeichert; Unbekanntes und Kaputtes wird ignoriert', () => {
    const profile = new Profile(ITEM_RULES);
    profile.markTip('loot');
    profile.markTip('boss');
    const loaded = parseProfile(JSON.parse(JSON.stringify(profile)), ITEM_RULES).profile;
    expect([...(loaded?.tipsSeen ?? [])].sort()).toEqual(['boss', 'loot']);

    const raw = { version: 1, classId: 'amos', level: 1, xp: 0, credits: 0, missionsCompleted: 0, bag: [], equipped: {}, tips: ['loot', 'gibtsnicht', 5, null] };
    expect([...(parseProfile(raw, ITEM_RULES).profile?.tipsSeen ?? [])]).toEqual(['loot']);
    expect(parseProfile({ ...raw, tips: 'x' }, ITEM_RULES).profile?.tipsSeen.size).toBe(0);
    expect(isTipId('controls')).toBe(true);
    expect(isTipId('nope')).toBe(false);
  });
});
