/** Kantenlänge einer Kachel in Welt-Pixeln. Alle Weltkoordinaten sind Pixel in diesem Raster. */
export const TILE_SIZE = 32;

/** Höhere Pixeldichten kosten auf Tablets viel Füllrate und bringen bei Formen kaum Schärfe. */
export const MAX_DEVICE_PIXEL_RATIO = 2;

/** Längster Zeitschritt pro Frame (s). Verhindert Durchtunneln nach Tab-Wechsel oder Lag. */
export const MAX_FRAME_SECONDS = 0.05;

/**
 * Kamera: Die kürzere Bildschirmseite zeigt ca. `targetShortSide` Welt-Pixel, der Zoom (in CSS-Pixeln)
 * wird auf [minZoom, maxZoom] begrenzt. Tablets sehen so mehr Welt statt riesiger Figuren.
 */
export const VIEW = { targetShortSide: 400, minZoom: 1, maxZoom: 1.5 } as const;

export const TAP = {
  /** Zusätzlicher Treffer-Radius (Welt-Pixel) um Gegner, damit Finger sie sicher treffen. */
  enemySlop: 16,
  /** Mindestabstand (ms), in dem ein gehaltener Finger das Laufziel nachführt. */
  dragRepathMs: 90,
  /** Wie weit (in Kacheln) ein Tipp auf eine Wand zum nächsten begehbaren Feld "einrasten" darf. */
  snapTiles: 2,
} as const;

/** Platzhalter-Texturen werden in doppelter Auflösung erzeugt und mit TEXTURE_SCALE verkleinert, damit sie bei hohem Zoom scharf bleiben. */
export const TEXTURE_RES = 2;
export const TEXTURE_SCALE = 1 / TEXTURE_RES;

export const SCENE_KEYS = {
  boot: 'BootScene',
  mission: 'MissionScene',
  hud: 'HudScene',
} as const;

export const REGISTRY_KEYS = {
  /** Aktuelles (begrenztes) devicePixelRatio. Die Spielfläche ist devicePixelRatio-mal größer als in CSS-Pixeln. */
  devicePixelRatio: 'devicePixelRatio',
} as const;

/**
 * Szenenübergreifende Ereignisse auf `game.events`.
 * Payloads: missionReady -> Player, playerDied/waveCleared -> keine, restartRequested -> keine.
 */
export const GAME_EVENTS = {
  missionReady: 'roci:mission-ready',
  playerDied: 'roci:player-died',
  waveCleared: 'roci:wave-cleared',
  restartRequested: 'roci:restart-requested',
} as const;

export const TEXTURE_KEYS = {
  tiles: 'tiles',
  shadow: 'shadow',
  targetRing: 'target-ring',
  moveMarker: 'move-marker',
} as const;

export function actorTextureKey(id: string): string {
  return `actor-${id}`;
}
