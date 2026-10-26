import type { EnemyDef } from './types';

export const ENEMIES = {
  /** Nahkämpfer: schnell, schwach, kommt in Gruppen. */
  thug: {
    id: 'thug',
    nameKey: 'enemy.thug.name',
    color: 0xc0392b,
    xp: 15,
    stats: {
      maxHp: 45,
      moveSpeed: 85,
      radius: 11,
      damageMin: 4,
      damageMax: 7,
      attackRange: 8,
      attackCooldownMs: 1000,
    },
    attack: { kind: 'melee', windupMs: 300 },
    aggroRange: 150,
    leashRange: 320,
  },
  /** Fernkämpfer: hält Abstand und braucht Sichtlinie; Deckung hinter Wänden schützt. */
  gunner: {
    id: 'gunner',
    nameKey: 'enemy.gunner.name',
    color: 0xd4a017,
    xp: 20,
    stats: {
      maxHp: 30,
      moveSpeed: 80,
      radius: 10,
      damageMin: 5,
      damageMax: 8,
      attackRange: 220,
      attackCooldownMs: 1700,
    },
    attack: { kind: 'ranged', windupMs: 500, projectileSpeed: 230, minRange: 110 },
    aggroRange: 230,
    leashRange: 380,
  },
  /** Elite: langsam, zäh, schlägt mit langer Ankündigung eine große Fläche. */
  brute: {
    id: 'brute',
    nameKey: 'enemy.brute.name',
    color: 0x8e2b2b,
    elite: true,
    xp: 80,
    stats: {
      maxHp: 170,
      moveSpeed: 68,
      radius: 15,
      damageMin: 15,
      damageMax: 21,
      attackRange: 14,
      attackCooldownMs: 2200,
    },
    attack: { kind: 'slam', windupMs: 750, radius: 62 },
    aggroRange: 180,
    leashRange: 340,
  },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;
