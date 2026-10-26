import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from '../../src/core/settings';
import { SETTINGS_KEY, loadSettings, saveSettings } from '../../src/persistence/settingsStore';
import type { StorageLike } from '../../src/persistence/saveStore';

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

describe('Einstellungen', () => {
  it('unbrauchbare Daten ergeben die Standardwerte', () => {
    for (const raw of [null, undefined, 5, 'x', [], {}]) expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it('Lautstärken werden auf 0..1 begrenzt, Falsches ersetzt', () => {
    expect(parseSettings({ muted: true, sfxVolume: 3, musicVolume: -1 })).toEqual({ ...DEFAULT_SETTINGS, muted: true, sfxVolume: 1, musicVolume: 0 });
    expect(parseSettings({ muted: 'ja', sfxVolume: NaN, musicVolume: '0.2', quality: 'ultra', screenShake: 1, hints: 'x', largeUi: null })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ quality: 'low', screenShake: false, hints: false, largeUi: true })).toMatchObject({ quality: 'low', screenShake: false, hints: false, largeUi: true });
  });

  it('Speichern und Laden ergibt dieselben Werte; ohne Speicher gelten die Standardwerte', () => {
    const storage = new FakeStorage();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    const settings = { muted: true, sfxVolume: 0.3, musicVolume: 0.9, quality: 'low' as const, screenShake: false, hints: false, largeUi: true };
    expect(saveSettings(storage, settings)).toBe(true);
    expect(loadSettings(storage)).toEqual(settings);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(null, settings)).toBe(false);
  });

  it('kaputter oder voller Speicher stört nicht', () => {
    const storage = new FakeStorage();
    storage.data.set(SETTINGS_KEY, '{kaputt');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    storage.failWrites = true;
    expect(saveSettings(storage, DEFAULT_SETTINGS)).toBe(false);
  });

  it('der Standard ist nicht stumm', () => {
    expect(DEFAULT_SETTINGS.muted).toBe(false);
  });
});
