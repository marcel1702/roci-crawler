/** Grafikqualität: `low` rendert mit höchstens einem Pixel je CSS-Pixel (schneller auf älteren Geräten). */
export type Quality = 'high' | 'low';

/** Einstellungen, die nicht zum Spielstand gehören (gelten für das Gerät). */
export interface Settings {
  /** Alles stumm. */
  muted: boolean;
  /** Lautstärke der Effekte, 0..1. */
  sfxVolume: number;
  /** Lautstärke der Musik, 0..1. */
  musicVolume: number;
  quality: Quality;
  /** Kamerawackeln bei Treffern und Explosionen. */
  screenShake: boolean;
  /** Einführungshinweise im Spiel. */
  hints: boolean;
  /** Größere Tasten und Leisten im HUD. */
  largeUi: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  muted: false,
  sfxVolume: 0.7,
  musicVolume: 0.5,
  quality: 'high',
  screenShake: true,
  hints: true,
  largeUi: false,
};

/** Faktor auf die HUD-Größe bei „große Bedienelemente“. */
export const LARGE_UI_SCALE = 1.25;

/** Liest Einstellungen aus gespeicherten Daten; Unbrauchbares fällt auf den Standard zurück. */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...DEFAULT_SETTINGS };
  const data = raw as Record<string, unknown>;
  const volume = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
  return {
    muted: flag(data.muted, DEFAULT_SETTINGS.muted),
    sfxVolume: volume(data.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    musicVolume: volume(data.musicVolume, DEFAULT_SETTINGS.musicVolume),
    quality: data.quality === 'low' ? 'low' : 'high',
    screenShake: flag(data.screenShake, DEFAULT_SETTINGS.screenShake),
    hints: flag(data.hints, DEFAULT_SETTINGS.hints),
    largeUi: flag(data.largeUi, DEFAULT_SETTINGS.largeUi),
  };
}
