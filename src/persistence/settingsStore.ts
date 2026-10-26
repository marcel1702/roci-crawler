import { DEFAULT_SETTINGS, parseSettings } from '../core/settings';
import type { Settings } from '../core/settings';
import type { StorageLike } from './saveStore';

export const SETTINGS_KEY = 'roci-crawler:settings';

/** Lädt die Einstellungen; ohne Speicher oder bei kaputten Daten gelten die Standardwerte. */
export function loadSettings(storage: StorageLike | null): Settings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const text = storage.getItem(SETTINGS_KEY);
    return text === null ? { ...DEFAULT_SETTINGS } : parseSettings(JSON.parse(text));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Speichert die Einstellungen; Fehler (voller oder gesperrter Speicher) sind unkritisch. */
export function saveSettings(storage: StorageLike | null, settings: Settings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
