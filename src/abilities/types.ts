import type Phaser from 'phaser';
import type { AbilityBoost } from '../core/talents';
import type { AbilityId } from '../data/types';
import type { Player } from '../entities/Player';
import type { WorldContext } from '../entities/WorldContext';
import type { TextKey } from '../i18n';

export type AbilityIcon =
  | 'dash'
  | 'shield'
  | 'slam'
  | 'drone'
  | 'hack'
  | 'emp'
  | 'rockets'
  | 'armor'
  | 'gauss'
  | 'barrage'
  | 'ally'
  | 'inspire';

export interface AbilityContext {
  player: Player;
  world: WorldContext;
  scene: Phaser.Scene;
  /** Verbesserungen aus Talenten für diese Fähigkeit (Anteile). */
  boost: AbilityBoost;
}

export interface AbilityDef {
  id: AbilityId;
  nameKey: TextKey;
  icon: AbilityIcon;
  cooldownMs: number;
  /** Liefert false, wenn die Fähigkeit nichts bewirken konnte; dann beginnt keine Abklingzeit. */
  execute(ctx: AbilityContext): boolean;
}
