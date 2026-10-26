import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../src/core/dungeon';
import { planMission } from '../../src/core/encounters';
import { findPath } from '../../src/core/pathfinding';
import { createRng } from '../../src/core/rng';
import { ENEMIES } from '../../src/data/enemies';
import type { EnemyId } from '../../src/data/enemies';
import { DROP_CHANCE, RARITY_WEIGHTS } from '../../src/data/loot';
import { ACTS, actText } from '../../src/data/acts';
import { ACT1_SPAWNS } from '../../src/data/spawnTables';
import type { EnemyAttack, EnemyDef } from '../../src/data/types';
import { de } from '../../src/i18n/de';

const defs = Object.values(ENEMIES) as EnemyDef[];
const def = (id: string): EnemyDef => ENEMIES[id as EnemyId] as EnemyDef;

function usedEnemies(table: typeof ACT1_SPAWNS): Set<string> {
  const used = new Set<string>([...table.guardian, ...table.treasureGuard]);
  for (const group of table.groups) for (const id of group.enemies) used.add(id);
  return used;
}

function checkAttack(attack: EnemyAttack, label: string): void {
  expect(attack.windupMs, `${label}: Ankündigung`).toBeGreaterThanOrEqual(250);
  switch (attack.kind) {
    case 'slam':
      expect(attack.radius, label).toBeGreaterThan(0);
      break;
    case 'ranged':
    case 'fan':
      expect(attack.projectileSpeed, label).toBeGreaterThan(0);
      break;
    case 'bomb':
      expect(attack.radius, label).toBeGreaterThan(0);
      break;
    case 'spore':
      expect(attack.radius, label).toBeGreaterThan(0);
      expect(attack.zoneMs, label).toBeGreaterThan(attack.windupMs);
      expect(attack.count, label).toBeGreaterThanOrEqual(1);
      break;
    case 'charge':
      expect(attack.distance, label).toBeGreaterThan(attack.minRange);
      expect(attack.speed, label).toBeGreaterThan(0);
      expect(attack.dizzyMs, label).toBeGreaterThan(0);
      break;
    case 'melee':
      break;
  }
  if (attack.kind === 'fan') {
    expect(attack.count).toBeGreaterThanOrEqual(2);
    expect(attack.spread).toBeGreaterThan(0);
  }
}

describe('Gegnerdaten', () => {
  it('jeder Gegner hat Namen, Werte und eine angekündigte Angriffsart', () => {
    expect(defs.length).toBeGreaterThanOrEqual(6);
    for (const def of defs) {
      expect(de[def.nameKey], def.id).toBeTruthy();
      expect(def.stats.maxHp, def.id).toBeGreaterThan(0);
      expect(def.stats.moveSpeed, def.id).toBeGreaterThan(0);
      expect(def.leashRange, def.id).toBeGreaterThan(def.aggroRange);
      checkAttack(def.attack, def.id);
      for (const attack of def.pattern ?? []) checkAttack(attack, `${def.id}.pattern`);
    }
  });

  it('jeder Akt hat seine Gegnertypen, genau einen Elite und einen Boss; Akt 3 mischt die früheren Akte', () => {
    const byAct: Record<number, { regular: string[]; elite: string[]; boss: string[] }> = {
      1: { regular: ['drone', 'gunner', 'saboteur', 'thug'], elite: ['brute'], boss: ['gangboss'] },
      2: { regular: ['crawler', 'infected', 'spore'], elite: ['host'], boss: ['knot'] },
      3: { regular: ['crawler', 'guarddrone', 'hybrid', 'infected', 'saboteur', 'spore', 'thug'], elite: ['sentinel'], boss: ['commander'] },
    };
    for (const act of ACTS) {
      const expected = byAct[act.id];
      if (!expected) continue;
      const used = usedEnemies(act.spawns);
      expect([...used].filter((id) => !def(id).elite).sort(), `Akt ${act.id}`).toEqual(expected.regular);
      expect([...used].filter((id) => def(id).elite), `Akt ${act.id}`).toEqual(expected.elite);
      expect(act.boss).toBe(expected.boss[0]);
      expect(used.has(act.boss)).toBe(false);
    }
    expect(defs.filter((d) => d.boss).map((d) => d.id).sort()).toEqual(['commander', 'gangboss', 'knot']);
  });

  it('die Spawn-Tabellen nutzen nur vorhandene Gegner; Akt 1 kennt noch keine Wucherer, die späteren Akte schon', () => {
    for (const act of ACTS) for (const id of usedEnemies(act.spawns)) expect(ENEMIES[id as EnemyId], id).toBeDefined();
    expect(usedEnemies(ACT1_SPAWNS).has('spore')).toBe(false);
    expect(usedEnemies(ACTS[2]!.spawns).has('spore')).toBe(true);
  });

  it('Verstärkung der Bosse und Wucherungszonen sind gültig', () => {
    for (const def of defs) {
      if (def.enrage?.rain) {
        expect(def.enrage.rain.warnMs).toBeGreaterThanOrEqual(600);
        expect(def.enrage.rain.zoneMs).toBeGreaterThan(def.enrage.rain.warnMs);
      }
      if (def.deathZone) expect(def.deathZone.zoneMs).toBeGreaterThan(0);
    }
    expect(ENEMIES.spore.deathZone).toBeDefined();
  });
});

describe('Gangboss', () => {
  const boss = ENEMIES.gangboss;

  it('wechselt zwischen drei verschiedenen Angriffen und beginnt mit dem ersten des Musters', () => {
    expect(boss.pattern.map((a) => a.kind)).toEqual(['slam', 'charge', 'fan']);
    expect(boss.attack).toEqual(boss.pattern[0]);
  });

  it('hat Sprüche, eine zweite Phase mit gültigen Verstärkungen und gute Beute', () => {
    expect(de[boss.boss.introKey]).toBeTruthy();
    expect(de[boss.boss.defeatKey]).toBeTruthy();
    expect(de[boss.enrage.lineKey]).toBeTruthy();
    expect(boss.enrage.hpFraction).toBeGreaterThan(0);
    expect(boss.enrage.hpFraction).toBeLessThan(1);
    expect(boss.enrage.cooldownFactor).toBeLessThan(1);
    expect(boss.enrage.summonCap).toBeGreaterThan(0);
    for (const id of boss.enrage.summon) expect(ENEMIES[id as EnemyId], id).toBeDefined();
    expect(DROP_CHANCE.boss).toBe(1);
    expect(RARITY_WEIGHTS.boss.common + RARITY_WEIGHTS.boss.uncommon).toBe(0);
  });

  it('ist deutlich zäher als der Brecher und kostet viel Erfahrung', () => {
    expect(boss.stats.maxHp).toBeGreaterThan(ENEMIES.brute.stats.maxHp * 3);
    expect(boss.xp).toBeGreaterThan(ENEMIES.brute.xp * 3);
  });
});

describe('Bossmission im Dungeon', () => {
  it('jeder Akt-Boss hat Texte und einen lösbaren festen Dungeon mit großem Bossraum', () => {
    for (const act of ACTS) {
      const boss = def(act.boss);
      expect(boss.boss, act.boss).toBeDefined();
      const dungeon = generateDungeon(act.bossSeed, 32, {
        zeroGChance: act.zeroGChance,
        infectionChance: act.infectionChance,
        bossRoomZeroG: act.bossRoomZeroG,
      });
      const plan = planMission(dungeon, act.spawns, createRng(act.bossSeed ^ 0x9e3779b9), { boss: act.boss });
      const room = dungeon.rooms.find((r) => r.id === plan.exitRoomId)!;
      expect(findPath(dungeon.grid, plan.playerStart, plan.exit, 11), `Akt ${act.id}`).not.toBeNull();
      expect(room.zeroG, `Akt ${act.id}`).toBe(act.bossRoomZeroG);
      expect(room.infected).toBe(false);
      expect(Math.min(room.w, room.h) * 32).toBeGreaterThanOrEqual(boss.stats.radius * 2 + 120);
      expect(de[actText(act.id, 'boss.briefing')]).toBeTruthy();
    }
  });

  it('der Boss steht allein in der Mitte des Ausgangsraums, statt der Wächter', () => {
    for (let seed = 0; seed < 60; seed++) {
      const dungeon = generateDungeon(seed, 32);
      const plan = planMission(dungeon, ACT1_SPAWNS, createRng(seed), { boss: 'gangboss' });
      const exitRoom = plan.encounters.find((e) => e.roomId === plan.exitRoomId);
      expect(exitRoom?.enemies, `Seed ${seed}`).toEqual([{ id: 'gangboss', x: plan.exit.x, y: plan.exit.y }]);
      expect(plan.encounters.flatMap((e) => e.enemies).filter((e) => e.id === 'gangboss')).toHaveLength(1);
    }
  });

  it('ohne Boss bleibt alles beim Alten, die übrigen Räume ändern sich nicht', () => {
    for (let seed = 0; seed < 30; seed++) {
      const dungeon = generateDungeon(seed, 32);
      const normal = planMission(dungeon, ACT1_SPAWNS, createRng(seed));
      const boss = planMission(dungeon, ACT1_SPAWNS, createRng(seed), { boss: 'gangboss' });
      expect(normal.playerStart).toEqual(boss.playerStart);
      expect(normal.exit).toEqual(boss.exit);
      expect(normal.chests).toEqual(boss.chests);
      expect(normal.encounters.find((e) => e.roomId === normal.exitRoomId)?.enemies.map((e) => e.id)).toEqual(ACT1_SPAWNS.guardian);
    }
  });

  it('der feste Boss-Dungeon von Akt 1 ist lösbar und der Bossraum groß genug für den Sturmangriff', () => {
    const seed = 20250101;
    const dungeon = generateDungeon(seed, 32, { zeroGChance: 0.18 });
    const plan = planMission(dungeon, ACT1_SPAWNS, createRng(seed ^ 0x9e3779b9), { boss: 'gangboss' });
    expect(findPath(dungeon.grid, plan.playerStart, plan.exit, 11)).not.toBeNull();
    const room = dungeon.rooms.find((r) => r.id === plan.exitRoomId)!;
    expect(room.zeroG).toBe(false);
    expect(Math.min(room.w, room.h) * 32).toBeGreaterThanOrEqual(ENEMIES.gangboss.stats.radius * 2 + 120);
  });
});
