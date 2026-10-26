import { DEFAULT_SETTINGS } from '../core/settings';
import type { Settings } from '../core/settings';

type Listener = (settings: Settings) => void;

let current: Settings = { ...DEFAULT_SETTINGS };
let persist: ((settings: Settings) => void) | null = null;
const listeners = new Set<Listener>();

/** Startet die Einstellungen mit den gespeicherten Werten; `save` wird bei jeder Änderung aufgerufen. */
export function initSettings(initial: Settings, save: (settings: Settings) => void): void {
  current = { ...initial };
  persist = save;
}

export function getSettings(): Settings {
  return current;
}

/** Ändert Einstellungen, speichert sie und meldet die Änderung allen Zuhörern (Ton, Pixelverhältnis, HUD). */
export function updateSettings(patch: Partial<Settings>): Settings {
  current = { ...current, ...patch };
  persist?.(current);
  for (const listener of listeners) listener(current);
  return current;
}

/** Meldet sich für Änderungen an; liefert die Abmeldung. */
export function onSettingsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
