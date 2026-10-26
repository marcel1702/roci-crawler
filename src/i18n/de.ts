/** Deutsche Texte. Schlüssel sind die Referenz: Jede weitere Sprache muss exakt dieselben Schlüssel liefern. */
export const de = {
  'class.amos.name': 'Amos Burton',
  'class.amos.role': 'Nahkampf-Tank',

  'ability.rammbock.name': 'Rammbock',
  'ability.standhaft.name': 'Standhaft',
  'ability.gnadenloser-schlag.name': 'Gnadenloser Schlag',

  'enemy.thug.name': 'Gang-Schläger',
  'enemy.gunner.name': 'Gang-Schütze',
  'enemy.brute.name': 'Gang-Brecher',

  'hud.hint.controls': 'Tippen: Laufen  ·  Gegner antippen: Angreifen',
  'hud.hp': 'LP {current}/{max}',
  'hud.level': 'Stufe {level}',
  'hud.levelUp': 'Stufe {level} erreicht!',
  'hud.xp': '+{amount} EP',
  'hud.wave': 'Welle {wave}',
  'hud.waveCleared': 'Welle geräumt – die nächste naht …',
  'hud.death.title': 'Besiegt',
  'hud.death.retry': 'Tippen für Neustart',

  'pwa.updateAvailable': 'Update verfügbar',
  'pwa.reload': 'Neu laden',
  'pwa.offlineReady': 'Offline spielbereit',
} as const;

export type TextKey = keyof typeof de;
export type Locale = Record<TextKey, string>;
