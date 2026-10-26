/** Deutsche Texte. Schlüssel sind die Referenz: Jede weitere Sprache muss exakt dieselben Schlüssel liefern. */
export const de = {
  'class.amos.name': 'Amos Burton',
  'class.amos.role': 'Nahkampf-Tank',

  'enemy.thug.name': 'Gang-Schläger',

  'hud.hint.controls': 'Tippen: Laufen  ·  Gegner antippen: Angreifen',
  'hud.hp': 'LP {current}/{max}',
  'hud.waveCleared': 'Arena geräumt – nächste Welle naht …',
  'hud.death.title': 'Besiegt',
  'hud.death.retry': 'Tippen für Neustart',

  'pwa.updateAvailable': 'Update verfügbar',
  'pwa.reload': 'Neu laden',
  'pwa.offlineReady': 'Offline spielbereit',
} as const;

export type TextKey = keyof typeof de;
export type Locale = Record<TextKey, string>;
