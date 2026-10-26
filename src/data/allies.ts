import type { AllyDef } from './types';

export const ALLIES = {
  /** Kampfdrohne (Naomi): schwebt mit, schießt auf nahe Gegner. */
  drone: {
    id: 'drone',
    textureId: 'drone',
    radius: 8,
    moveSpeed: 175,
    damageFactor: 0.7,
    basic: { kind: 'ranged', projectileSpeed: 360 },
    attackRange: 150,
    attackCooldownMs: 550,
    lifetimeMs: 10000,
    aggroRange: 240,
  },
  /** Amos greift ein (Holden): schlägt zu, solange er da ist. */
  amos: {
    id: 'amos',
    textureId: 'amos',
    radius: 11,
    moveSpeed: 150,
    damageFactor: 1.1,
    basic: { kind: 'melee' },
    attackRange: 14,
    attackCooldownMs: 600,
    lifetimeMs: 10000,
    aggroRange: 260,
  },
} as const satisfies Record<string, AllyDef>;

export type AllyId = keyof typeof ALLIES;
