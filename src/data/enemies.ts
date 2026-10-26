import type { EnemyDef } from './types';

export const ENEMIES = {
  thug: {
    id: 'thug',
    nameKey: 'enemy.thug.name',
    color: 0xc0392b,
    stats: {
      maxHp: 45,
      moveSpeed: 85,
      radius: 11,
      damageMin: 4,
      damageMax: 7,
      attackRange: 8,
      attackCooldownMs: 1000,
    },
    aggroRange: 150,
    leashRange: 320,
  },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;
