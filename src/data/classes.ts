import type { ClassDef } from './types';

/** Spielbare Klassen. Meilenstein 1 enthält nur Amos; Naomi, Bobbie und Holden folgen (siehe docs/MILESTONES.md). */
export const CLASSES = {
  amos: {
    id: 'amos',
    nameKey: 'class.amos.name',
    roleKey: 'class.amos.role',
    color: 0xd9822b,
    stats: {
      maxHp: 140,
      moveSpeed: 150,
      radius: 11,
      damageMin: 10,
      damageMax: 14,
      attackRange: 14,
      attackCooldownMs: 550,
    },
  },
} as const satisfies Partial<Record<ClassDef['id'], ClassDef>>;

export type ImplementedClassId = keyof typeof CLASSES;
