/** Einstellungen, die nicht zum Spielstand gehören (gelten für das Gerät). */
export interface Settings {
  /** Alles stumm. */
  muted: boolean;
  /** Lautstärke der Effekte, 0..1. */
  sfxVolume: number;
  /** Lautstärke der Musik, 0..1. */
  musicVolume: number;
}

export const DEFAULT_SETTINGS: Settings = { muted: false, sfxVolume: 0.7, musicVolume: 0.5 };

/** Liest Einstellungen aus gespeicherten Daten; Unbrauchbares fällt auf den Standard zurück. */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...DEFAULT_SETTINGS };
  const data = raw as Record<string, unknown>;
  const volume = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  return {
    muted: typeof data.muted === 'boolean' ? data.muted : DEFAULT_SETTINGS.muted,
    sfxVolume: volume(data.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    musicVolume: volume(data.musicVolume, DEFAULT_SETTINGS.musicVolume),
  };
}
