import type { TileGrid } from '../core/grid';
import type { Rng } from '../core/rng';
import type { CombatSystem } from '../systems/CombatSystem';
import type { ProjectileSystem } from '../systems/ProjectileSystem';
import type { AllyDef } from '../data/types';
import type { Ally, AllyOverrides } from './Ally';
import type { Enemy } from './Enemy';
import type { Player } from './Player';

/** Was Akteure von ihrer Szene brauchen. Entkoppelt Entities von der konkreten Szenenklasse. */
export interface WorldContext {
  readonly grid: TileGrid;
  readonly rng: Rng;
  readonly combat: CombatSystem;
  readonly projectiles: ProjectileSystem;
  /** Lebende und frisch besiegte Gegner der Mission. */
  readonly enemies: readonly Enemy[];
  /** Ruft einen Verbündeten herbei (ersetzt einen gleichen). Null, wo es keine Kämpfe gibt (Hub). */
  spawnAlly(def: AllyDef, x: number, y: number, owner: Player, overrides?: AllyOverrides): Ally | null;
}
