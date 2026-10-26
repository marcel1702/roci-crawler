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
    loot: 'elite',
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
  /** OPA-Saboteur: wirft Sprengsätze auf deinen Standort; hält Abstand. Wer in der roten Zone steht, wird getroffen. */
  saboteur: {
    id: 'saboteur',
    nameKey: 'enemy.saboteur.name',
    color: 0xd94f8a,
    xp: 22,
    stats: {
      maxHp: 32,
      moveSpeed: 95,
      radius: 10,
      damageMin: 9,
      damageMax: 13,
      attackRange: 190,
      attackCooldownMs: 2600,
    },
    attack: { kind: 'bomb', windupMs: 900, minRange: 90, radius: 48 },
    aggroRange: 220,
    leashRange: 360,
  },
  /** Sicherheitsdrohne: flink und zerbrechlich, feuert einen Dreierfächer. */
  drone: {
    id: 'drone',
    nameKey: 'enemy.drone.name',
    color: 0x7f8fa6,
    xp: 18,
    stats: {
      maxHp: 24,
      moveSpeed: 115,
      radius: 9,
      damageMin: 4,
      damageMax: 6,
      attackRange: 200,
      attackCooldownMs: 2300,
    },
    attack: { kind: 'fan', windupMs: 550, projectileSpeed: 250, minRange: 100, count: 3, spread: 0.45 },
    aggroRange: 240,
    leashRange: 380,
  },
  /**
   * Gangboss (Arbeitsname „Eisenzahn“): wechselt zwischen Flächenschlag, Sturmangriff und Salve; unter der Hälfte der
   * Lebenspunkte ruft er Schläger und wird schneller.
   */
  gangboss: {
    id: 'gangboss',
    nameKey: 'enemy.gangboss.name',
    color: 0x5b1d33,
    elite: true,
    loot: 'boss',
    xp: 400,
    stats: {
      maxHp: 640,
      moveSpeed: 78,
      radius: 19,
      damageMin: 17,
      damageMax: 24,
      attackRange: 240,
      attackCooldownMs: 1700,
    },
    attack: { kind: 'slam', windupMs: 850, radius: 84 },
    pattern: [
      { kind: 'slam', windupMs: 850, radius: 84 },
      { kind: 'charge', windupMs: 800, minRange: 90, distance: 230, speed: 430, dizzyMs: 1300 },
      { kind: 'fan', windupMs: 650, projectileSpeed: 270, minRange: 0, count: 5, spread: 0.9 },
    ],
    enrage: {
      hpFraction: 0.5,
      summon: ['thug', 'thug', 'saboteur'],
      summonEveryMs: 9000,
      summonCap: 3,
      cooldownFactor: 0.75,
      speedFactor: 1.2,
      lineKey: 'boss.gangboss.enrage',
    },
    boss: { introKey: 'boss.gangboss.intro', defeatKey: 'boss.gangboss.defeat' },
    aggroRange: 260,
    leashRange: 600,
  },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;
