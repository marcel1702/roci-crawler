import type { ActorStats, LevelGrowth } from '../core/stats';
import type { TextKey } from '../i18n';

/** Woher Beute stammt; bestimmt Dropchance und Seltenheit (siehe data/loot.ts). */
export type LootSource = 'enemy' | 'elite' | 'guardian' | 'chest';

export type ClassId = 'amos' | 'naomi' | 'bobbie' | 'holden';

/** Fähigkeiten aller Klassen; die Wirkung steht in `src/abilities`, hier nur die Kennung. */
export type AbilityId = 'rammbock' | 'standhaft' | 'gnadenloser-schlag';

export interface ClassDef {
  id: ClassId;
  nameKey: TextKey;
  roleKey: TextKey;
  color: number;
  stats: ActorStats;
  growth: LevelGrowth;
  /** Belegung der drei Fähigkeiten-Tasten. */
  abilities: readonly [AbilityId, AbilityId, AbilityId];
}

/**
 * Wie ein Gegner angreift. Jeder Angriff hat eine Ankündigung (`windupMs`), in der der Gegner stillsteht
 * und die Gefahrenzone zeigt; wer sich währenddessen herausbewegt, wird nicht getroffen.
 */
export type EnemyAttack =
  | { kind: 'melee'; windupMs: number }
  | { kind: 'slam'; windupMs: number; radius: number }
  | {
      kind: 'ranged';
      windupMs: number;
      projectileSpeed: number;
      /** Unterschreitet der Spieler diesen Abstand (Mittelpunkte), weicht der Gegner zurück. */
      minRange: number;
    };

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
}
