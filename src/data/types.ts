import type { ActorStats, LevelGrowth } from '../core/stats';
import type { TextKey } from '../i18n';

/** Woher Beute stammt; bestimmt Dropchance und Seltenheit (siehe data/loot.ts). */
export type LootSource = 'enemy' | 'elite' | 'guardian' | 'chest' | 'boss';

export type ClassId = 'amos' | 'naomi' | 'bobbie' | 'holden';

/** Fähigkeiten aller Klassen; die Wirkung steht in `src/abilities`, hier nur die Kennung. */
export type AbilityId =
  | 'rammbock'
  | 'standhaft'
  | 'gnadenloser-schlag'
  | 'kampfdrohne'
  | 'hack'
  | 'emp'
  | 'raketensalve'
  | 'ruestung'
  | 'gauss'
  | 'sperrfeuer'
  | 'amos-eingriff'
  | 'inspirieren';

/** Grundangriff: Nahkampf oder Geschoss. */
export type BasicAttack =
  | { kind: 'melee' }
  /** `recoil`: Rückstoß in der Schwerelosigkeit (px/s), ohne Angabe der Standardwert. */
  | { kind: 'ranged'; projectileSpeed: number; recoil?: number };

export interface ClassDef {
  id: ClassId;
  nameKey: TextKey;
  roleKey: TextKey;
  color: number;
  stats: ActorStats;
  growth: LevelGrowth;
  basic: BasicAttack;
  /** Belegung der drei Fähigkeiten-Tasten. */
  abilities: readonly [AbilityId, AbilityId, AbilityId];
}

/**
 * Wie ein Gegner angreift. Jeder Angriff hat eine Ankündigung (`windupMs`), in der der Gegner stillsteht
 * und die Gefahrenzone zeigt; wer sich währenddessen herausbewegt, wird nicht getroffen.
 * `minRange` (bei Angriffen aus der Ferne): Unterschreitet der Spieler diesen Abstand (Mittelpunkte), weicht der Gegner zurück.
 */
export type EnemyAttack =
  | { kind: 'melee'; windupMs: number }
  | { kind: 'slam'; windupMs: number; radius: number }
  | { kind: 'ranged'; windupMs: number; projectileSpeed: number; minRange: number }
  /** Fächer aus `count` Geschossen, `spread` Radiant breit. */
  | { kind: 'fan'; windupMs: number; projectileSpeed: number; minRange: number; count: number; spread: number }
  /** Wirft einen Sprengsatz auf die Position des Spielers zu Beginn der Ankündigung; er detoniert am Ende (Radius `radius`). */
  | { kind: 'bomb'; windupMs: number; minRange: number; radius: number }
  /**
   * Schleudert `count` Sporenklumpen auf deinen Standort (der erste) und seine Umgebung (`scatter` px). Jeder lässt am Ende
   * der Ankündigung eine Wucherungszone zurück, die `zoneMs` lang schadet und bremst.
   */
  | { kind: 'spore'; windupMs: number; minRange: number; count: number; scatter: number; radius: number; zoneMs: number }
  /** Rennt `distance` Pixel in die angekündigte Richtung und ist danach `dizzyMs` benommen. */
  | { kind: 'charge'; windupMs: number; minRange: number; distance: number; speed: number; dizzyMs: number };

/** Zweite Phase eines Bosses ab einem Lebensanteil: ruft Verstärkung, wird schneller und greift häufiger an. */
export interface EnrageDef {
  hpFraction: number;
  /** Zusätzlich: lässt in Abständen Wucherungszonen (mit Warnung) in der Nähe des Spielers entstehen. */
  rain?: { everyMs: number; radius: number; warnMs: number; zoneMs: number; spread: number };
  /** Kennungen der Gegner, die nachgerufen werden (in dieser Reihenfolge, reihum). */
  summon: readonly string[];
  summonEveryMs: number;
  /** Höchstens so viele Nachgerufene gleichzeitig. */
  summonCap: number;
  /** Faktor auf die Angriffs-Abklingzeit (< 1 = öfter). */
  cooldownFactor: number;
  speedFactor: number;
  /** Spruch beim Wechsel der Phase. */
  lineKey: TextKey;
}

export interface EnemyDef {
  id: string;
  nameKey: TextKey;
  color: number;
  elite?: boolean;
  /** Erfahrung für den Spieler beim Besiegen. */
  xp: number;
  /** Beutetabelle; ohne Angabe `enemy`. */
  loot?: LootSource;
  stats: ActorStats;
  attack: EnemyAttack;
  /** Ab diesem Abstand (Mittelpunkte) bemerkt der Gegner den Spieler. */
  aggroRange: number;
  /** Ab diesem Abstand gibt der Gegner die Verfolgung auf. */
  leashRange: number;
  /** Boss: eigene Lebensleiste im HUD, ein Spruch beim ersten Sehen und beim Besiegen; `attack` ist der erste Angriff von `pattern`. */
  boss?: { introKey: TextKey; defeatKey: TextKey };
  /** Reihum eingesetzte Angriffe (Bosse); jeweils der erste, der gerade möglich ist. */
  pattern?: readonly EnemyAttack[];
  enrage?: EnrageDef;
  /** Hinterlässt beim Tod eine Wucherungszone. */
  deathZone?: { radius: number; zoneMs: number };
}

/** Ein herbeigerufener Verbündeter (Drohne, Crewmitglied): kämpft eine Weile mit, ist unverwundbar. */
export interface AllyDef {
  id: string;
  /** Textur der Figur (`actor-<id>`). */
  textureId: string;
  radius: number;
  moveSpeed: number;
  /** Schaden als Anteil des durchschnittlichen Grundschadens der Spielerin. */
  damageFactor: number;
  basic: BasicAttack;
  attackRange: number;
  attackCooldownMs: number;
  lifetimeMs: number;
  /** Gegner in diesem Abstand werden angegriffen. */
  aggroRange: number;
}
