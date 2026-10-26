import type { TextKey } from '../i18n';

/** Kampfwerte, die jeder Akteur (Spieler wie Gegner) hat. Längen in Welt-Pixeln, Zeiten in ms. */
export interface ActorStats {
  maxHp: number;
  /** Pixel pro Sekunde. */
  moveSpeed: number;
  /** Kollisions- und Trefferradius. */
  radius: number;
  damageMin: number;
  damageMax: number;
  /** Nahkampfreichweite, vom Rand des Angreifers zum Rand des Ziels gemessen. */
  attackRange: number;
  attackCooldownMs: number;
}

export type ClassId = 'amos' | 'naomi' | 'bobbie' | 'holden';

export interface ClassDef {
  id: ClassId;
  nameKey: TextKey;
  roleKey: TextKey;
  color: number;
  stats: ActorStats;
}

export interface EnemyDef {
  id: string;
  nameKey: TextKey;
  color: number;
  stats: ActorStats;
  /** Ab diesem Abstand (Mittelpunkte) bemerkt der Gegner den Spieler. */
  aggroRange: number;
  /** Ab diesem Abstand gibt der Gegner die Verfolgung auf. */
  leashRange: number;
}
