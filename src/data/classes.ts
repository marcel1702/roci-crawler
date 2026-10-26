import type { TextKey } from '../i18n';
import type { ClassDef, ClassId } from './types';

/** Die vier spielbaren Klassen. Zahlen sind Startwerte für das Balancing. */
export const CLASSES = {
  amos: {
    id: 'amos',
    nameKey: 'class.amos.name',
    roleKey: 'class.amos.role',
    color: 0xd9822b,
    stats: { maxHp: 140, moveSpeed: 150, radius: 11, damageMin: 10, damageMax: 14, attackRange: 14, attackCooldownMs: 550 },
    growth: { hpPerLevel: 12, damagePerLevel: 0.06 },
    basic: { kind: 'melee' },
    abilities: ['rammbock', 'standhaft', 'gnadenloser-schlag'],
  },
  naomi: {
    id: 'naomi',
    nameKey: 'class.naomi.name',
    roleKey: 'class.naomi.role',
    color: 0x4fa3d9,
    stats: { maxHp: 100, moveSpeed: 165, radius: 11, damageMin: 7, damageMax: 10, attackRange: 170, attackCooldownMs: 480 },
    growth: { hpPerLevel: 9, damagePerLevel: 0.06 },
    basic: { kind: 'ranged', projectileSpeed: 380 },
    abilities: ['kampfdrohne', 'hack', 'emp'],
  },
  bobbie: {
    id: 'bobbie',
    nameKey: 'class.bobbie.name',
    roleKey: 'class.bobbie.role',
    color: 0x9b6bd9,
    stats: { maxHp: 175, moveSpeed: 128, radius: 11, damageMin: 13, damageMax: 17, attackRange: 190, attackCooldownMs: 700 },
    growth: { hpPerLevel: 13, damagePerLevel: 0.06 },
    basic: { kind: 'ranged', projectileSpeed: 440, recoil: 55 },
    abilities: ['raketensalve', 'ruestung', 'gauss'],
  },
  holden: {
    id: 'holden',
    nameKey: 'class.holden.name',
    roleKey: 'class.holden.role',
    color: 0x5bd98f,
    stats: { maxHp: 125, moveSpeed: 150, radius: 11, damageMin: 8, damageMax: 11, attackRange: 140, attackCooldownMs: 520 },
    growth: { hpPerLevel: 10, damagePerLevel: 0.06 },
    basic: { kind: 'ranged', projectileSpeed: 400 },
    abilities: ['sperrfeuer', 'amos-eingriff', 'inspirieren'],
  },
} as const satisfies Record<ClassId, ClassDef>;

export type ImplementedClassId = keyof typeof CLASSES;

/** Alle vier Klassen für die Auswahl; nicht verfügbare lassen sich nicht wählen. */
export interface ClassInfo {
  id: ClassId;
  nameKey: TextKey;
  roleKey: TextKey;
  color: number;
  available: boolean;
}

export const CLASS_LIST: readonly ClassInfo[] = [
  { id: 'amos', nameKey: 'class.amos.name', roleKey: 'class.amos.role', color: 0xd9822b, available: true },
  { id: 'naomi', nameKey: 'class.naomi.name', roleKey: 'class.naomi.role', color: 0x4fa3d9, available: true },
  { id: 'bobbie', nameKey: 'class.bobbie.name', roleKey: 'class.bobbie.role', color: 0x9b6bd9, available: true },
  { id: 'holden', nameKey: 'class.holden.name', roleKey: 'class.holden.role', color: 0x5bd98f, available: true },
];
