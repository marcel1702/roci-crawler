import type { TileGrid } from '../core/grid';
import type { Rng } from '../core/rng';
import type { CombatSystem } from '../systems/CombatSystem';

/** Was Akteure von ihrer Szene brauchen. Entkoppelt Entities von der konkreten Szenenklasse. */
export interface WorldContext {
  readonly grid: TileGrid;
  readonly rng: Rng;
  readonly combat: CombatSystem;
}
