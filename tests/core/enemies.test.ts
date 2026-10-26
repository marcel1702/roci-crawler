import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../src/core/dungeon';
import { planMission } from '../../src/core/encounters';
import { findPath } from '../../src/core/pathfinding';
import { createRng } from '../../src/core/rng';
import { ENEMIES } from '../../src/data/enemies';
import type { EnemyId } from '../../src/data/enemies';
import { DROP_CHANCE, RARITY_WEIGHTS } from '../../src/data/loot';
import { ACT1_SPAWNS } from '../../src/data/spawnTables';
import type { EnemyAttack, EnemyDef } from '../../src/data/types';
import { de } from '../../src/i18n/de';

const defs = Object.values(ENEMIES) as EnemyDef[];

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

  it('Akt 1 hat vier Gegnertypen plus Elite und Boss', () => {
    const regular = defs.filter((d) => !d.elite && !d.boss).map((d) => d.id).sort();
    expect(regular).toEqual(['drone', 'gunner', 'saboteur', 'thug']);
    expect(defs.filter((d) => d.elite && !d.boss).map((d) => d.id)).toEqual(['brute']);
    expect(defs.filter((d) => d.boss).map((d) => d.id)).toEqual(['gangboss']);
  });

  it('die Spawn-Tabelle von Akt 1 nutzt nur vorhandene Gegner, jeden regulären mindestens einmal', () => {
    const used = new Set<string>([...ACT1_SPAWNS.guardian, ...ACT1_SPAWNS.treasureGuard]);
    for (const group of ACT1_SPAWNS.groups) for (const id of group.enemies) used.add(id);
    for (const id of used) expect(ENEMIES[id as EnemyId], id).toBeDefined();
    for (const id of ['thug', 'gunner', 'saboteur', 'drone', 'brute']) expect(used.has(id), id).toBe(true);
    expect(used.has('gangboss')).toBe(false);
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
