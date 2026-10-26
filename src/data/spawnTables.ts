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

/** Gegnerverteilung für Missionen in Akt 2 (Eros): Schwärme, Sporenträger und Wirte. */
export const ACT2_SPAWNS: SpawnTable<EnemyId> = {
  groups: [
    { enemies: ['infected', 'infected', 'infected'], weight: 4, minDepth: 1 },
    { enemies: ['infected', 'infected', 'crawler'], weight: 3, minDepth: 1 },
    { enemies: ['crawler', 'crawler'], weight: 3, minDepth: 1 },
    { enemies: ['spore', 'infected'], weight: 3, minDepth: 1 },
    { enemies: ['spore', 'infected', 'infected'], weight: 3, minDepth: 2 },
    { enemies: ['crawler', 'crawler', 'spore'], weight: 2, minDepth: 2 },
    { enemies: ['host', 'infected'], weight: 2, minDepth: 3 },
    { enemies: ['spore', 'spore', 'crawler'], weight: 2, minDepth: 3 },
    { enemies: ['host', 'spore', 'crawler'], weight: 1, minDepth: 4 },
  ],
  guardian: ['host', 'spore', 'spore'],
  treasureGuard: ['infected', 'crawler'],
};
