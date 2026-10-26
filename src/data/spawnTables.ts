import type { SpawnTable } from '../core/encounters';
import type { EnemyId } from './enemies';

/** Gegnerverteilung für Missionen in Akt 1 (Ceres/Tycho). Tiefe = Räume vom Startraum. */
export const ACT1_SPAWNS: SpawnTable<EnemyId> = {
  groups: [
    { enemies: ['thug', 'thug'], weight: 4, minDepth: 1 },
    { enemies: ['thug', 'thug', 'thug'], weight: 3, minDepth: 1 },
    { enemies: ['gunner', 'thug'], weight: 3, minDepth: 1 },
    { enemies: ['saboteur', 'thug'], weight: 2, minDepth: 1 },
    { enemies: ['thug', 'thug', 'gunner'], weight: 3, minDepth: 2 },
    { enemies: ['drone', 'drone'], weight: 2, minDepth: 2 },
    { enemies: ['gunner', 'saboteur'], weight: 2, minDepth: 2 },
    { enemies: ['gunner', 'gunner'], weight: 2, minDepth: 2 },
    { enemies: ['drone', 'saboteur', 'thug'], weight: 2, minDepth: 3 },
    { enemies: ['brute', 'thug'], weight: 1, minDepth: 3 },
    { enemies: ['brute', 'drone', 'drone'], weight: 1, minDepth: 4 },
  ],
  guardian: ['brute', 'gunner', 'gunner'],
  treasureGuard: ['thug', 'thug'],
};
