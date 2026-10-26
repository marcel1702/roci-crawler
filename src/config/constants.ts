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
  title: 'TitleScene',
  hub: 'HubScene',
  inventory: 'InventoryScene',
  shop: 'ShopScene',
  talents: 'TalentScene',
  missionSelect: 'MissionSelectScene',
  ending: 'EndingScene',
  settings: 'SettingsScene',
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
  /** Payload: Player. */
  hubReady: 'roci:hub-ready',
  playerDied: 'roci:player-died',
  /** Payload: Wellennummer (1-basiert). */
  waveStarted: 'roci:wave-started',
  waveCleared: 'roci:wave-cleared',
  /** Payload: erreichte Stufe. */
  playerLevelUp: 'roci:player-level-up',
  /** Payload: Text-Schlüssel der aktuellen Aufgabe. */
  objectiveChanged: 'roci:objective-changed',
  /** Payload: MissionStats. */
  missionCompleted: 'roci:mission-completed',
  restartRequested: 'roci:restart-requested',
  /** Die Figur betritt erstmals in dieser Mission einen schwerelosen Raum. */
  zeroGEntered: 'roci:zero-g-entered',
  /** Sprechzeile im HUD. Payload: `SayLine` (Sprecher-Schlüssel, Text-Schlüssel). */
  say: 'roci:say',
} as const;

/** Ereignisse innerhalb einer Szene (`scene.events`). Payload actorKilled: (Besiegter, Verursacher | null). */
export const MISSION_EVENTS = {
  actorKilled: 'mission:actor-killed',
  /** Ein Boss bemerkt den Spieler zum ersten Mal. Payload: Enemy. */
  bossEngaged: 'mission:boss-engaged',
  /** Ein Boss wechselt in die zweite Phase. Payload: Enemy. */
  bossEnraged: 'mission:boss-enraged',
  /** Ein Einführungshinweis wird fällig. Payload: `TipId`. */
  tip: 'mission:tip',
} as const;

/** Schlüssel des Spielstands (`Profile`) im Registry: Fortschritt, Credits, Gegenstände. */
export const REGISTRY_PROFILE = 'profile';
/** Schlüssel der Spielsitzung (`Session`): Spielstand-Plätze und Autospeichern. */
export const REGISTRY_SESSION = 'session';

export const CRIT_MULTIPLIER = 1.5;

export const LOOT = {
  /** Abstand, ab dem die Figur Beute automatisch aufhebt. */
  pickupRadius: 24,
  /** Wie weit Beute beim Fallen vom Ursprung wegspringt. */
  popDistance: 22,
} as const;

/** Gegnerstärke wächst mit der Spielerstufe, etwas langsamer als die Figur selbst. */
export const LEVEL_SCALING = { hpPerLevel: 0.06, damagePerLevel: 0.04 } as const;

export const POTION = {
  charges: 3,
  /** So viele Tränke kann die Figur höchstens tragen (Truhen füllen auf). */
  maxCarry: 5,
  cooldownMs: 4000,
  /** Anteil der maximalen Lebenspunkte, der geheilt wird. */
  healFraction: 0.4,
} as const;

export const TEXTURE_KEYS = {
  tiles: 'tiles',
  shadow: 'shadow',
  targetRing: 'target-ring',
  moveMarker: 'move-marker',
  projectile: 'projectile',
} as const;

export function actorTextureKey(id: string): string {
  return `actor-${id}`;
}

export const FOG = {
  /** Sichtweite der Figur in Kacheln. */
  radiusTiles: 8,
  /** Die letzten Kacheln vor dem Sichtrand werden weich ausgeblendet. */
  fadeTiles: 3,
  /** Deckkraft (0..255) bereits entdeckter, aber gerade nicht sichtbarer Bereiche. */
  rememberedAlpha: 150,
} as const;

export const CHEST = {
  openRadius: 26,
  creditsMin: 40,
  creditsMax: 90,
  potionChance: 0.3,
} as const;

export const EXIT_RADIUS = 30;

/** Stöße in der Schwerelosigkeit (px/s Geschwindigkeitsänderung bei Masse 1; schwerere Gegner bewegen sich weniger). */
export const KNOCKBACK = {
  /** Nahkampftreffer. */
  melee: 60,
  /** Schlag eines Gegners mit Flächenwirkung. */
  slam: 120,
  /** Treffer durch ein Geschoss. */
  projectile: 35,
  /** Standard bei Flächenschaden. */
  area: 70,
  /** Treffer durch den Sturmangriff eines Gegners. */
  charge: 200,
  /** Rückstoß beim Schießen (Grundangriff ohne eigene Angabe). */
  recoil: 28,
  /** Rückstoß schießender Gegner. */
  enemyRecoil: 24,
} as const;

/** Wucherung des Protomoleküls (Akt 2): Boden und Sporenzonen schaden über Zeit und bremsen. */
export const INFECTION = {
  /** Abstand der Schadenstakte (ms). */
  tickMs: 500,
  /** Anteil der maximalen Lebenspunkte pro Takt auf infiziertem Boden. */
  tilePct: 0.025,
  /** Faktor auf das Lauftempo darauf. */
  tileSlow: 0.7,
} as const;

/** Optik einer Welt: Schlüssel der Kachel-Textur je Akt-Welt (siehe `graphics/placeholderTextures`). */
export type Tileset = 'ceres' | 'eros' | 'ganymede';
export const TILESET_KEYS: Record<Tileset, string> = { ceres: 'tiles', eros: 'tiles-eros', ganymede: 'tiles-ganymede' };

export const ZEROG = {
  /** Dauer der Bremswirkung von „Stabilisieren“ (ms). */
  brakeMs: 900,
  /** Abklingzeit von „Stabilisieren“ (ms). */
  brakeCooldownMs: 2000,
  /** Zusätzliche Dämpfung für Gegner und Verbündete ohne Schub (bewusst weniger als die Bremse der Spielerin). */
  autoBrake: 2.5,
  /** Anteil der Sprintgeschwindigkeit eines Sturmangriffs, die als Schwung bleibt. */
  dashCarry: 0.35,
  /** Sprünge der Geschwindigkeit unter diesem Wert (px/s) zählen nicht als Aufprall mit Rückmeldung. */
  bumpFeedbackSpeed: 120,
} as const;
