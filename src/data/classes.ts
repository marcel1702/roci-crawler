import type { TextKey } from '../i18n';
import type { ClassDef, ClassId } from './types';

/** Spielbare Klassen. Bisher nur Amos; Naomi, Bobbie und Holden folgen (siehe docs/MILESTONES.md). */
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
    growth: { hpPerLevel: 12, damagePerLevel: 0.06 },
    abilities: ['rammbock', 'standhaft', 'gnadenloser-schlag'],
  },
} as const satisfies Partial<Record<ClassDef['id'], ClassDef>>;

export type ImplementedClassId = keyof typeof CLASSES;

/** Alle vier Klassen für die Auswahl; nur verfügbare lassen sich wählen (die anderen folgen in Meilenstein 6). */
export interface ClassInfo {
  id: ClassId;
  nameKey: TextKey;
  roleKey: TextKey;
  color: number;
  available: boolean;
}

export const CLASS_LIST: readonly ClassInfo[] = [
  { id: 'amos', nameKey: 'class.amos.name', roleKey: 'class.amos.role', color: 0xd9822b, available: true },
  { id: 'naomi', nameKey: 'class.naomi.name', roleKey: 'class.naomi.role', color: 0x4fa3d9, available: false },
  { id: 'bobbie', nameKey: 'class.bobbie.name', roleKey: 'class.bobbie.role', color: 0x9b6bd9, available: false },
  { id: 'holden', nameKey: 'class.holden.name', roleKey: 'class.holden.role', color: 0x5bd98f, available: false },
];
