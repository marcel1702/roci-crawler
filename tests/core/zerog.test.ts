import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../src/core/dungeon';
import { planMission } from '../../src/core/encounters';
import { TileGrid, TILE } from '../../src/core/grid';
import { parseLevel } from '../../src/core/level';
import { findPath } from '../../src/core/pathfinding';
import { createRng } from '../../src/core/rng';
import { DEFAULT_ZEROG, applyImpulse, matchedThrust, paramsFor, stepZeroG } from '../../src/core/zerog';
import type { ZeroGBody } from '../../src/core/zerog';
import { ACT1_SPAWNS } from '../../src/data/spawnTables';

// Großer freier Raum 12x12 Kacheln (Kachel 32), umgeben von Wand.
const room = (() => {
  const rows = ['#'.repeat(14), ...Array.from({ length: 12 }, () => '#' + 'z'.repeat(12) + '#'), '#'.repeat(14)];
  rows[1] = rows[1]!.replace('z', '@');
  return parseLevel({ rows }, 32).grid;
})();

const body = (over: Partial<ZeroGBody> = {}): ZeroGBody => ({ x: 200, y: 200, vx: 0, vy: 0, radius: 11, ...over });
const run = (b: ZeroGBody, seconds: number, dir: { x: number; y: number } | null, control = 1, brake = false) => {
  for (let i = 0; i < seconds * 60; i++) stepZeroG(room, b, 1 / 60, dir, DEFAULT_ZEROG, control, brake);
};

describe('Schwerelosigkeit: Bewegung', () => {
  it('Schub beschleunigt bis zur Höchstgeschwindigkeit, nicht darüber hinaus', () => {
    const b = body();
    run(b, 1, { x: 1, y: 0 });
    expect(b.vx).toBeGreaterThan(DEFAULT_ZEROG.maxSpeed * 0.8);
    expect(b.vx).toBeLessThanOrEqual(DEFAULT_ZEROG.maxSpeed + 5);
    expect(b.x).toBeGreaterThan(200);
  });

  it('ohne Schub gleitet der Körper weiter und wird nur langsam langsamer', () => {
    const b = body({ vx: 150 });
    run(b, 1, null);
    expect(b.vx).toBeGreaterThan(150 * 0.55); // nach 1 s noch über der Hälfte
    expect(b.vx).toBeLessThan(150);
    const before = b.x;
    run(b, 1, null);
    expect(b.x).toBeGreaterThan(before + 50);
  });

  it('Stabilisieren bremst deutlich schneller als Gleiten', () => {
    const gliding = body({ vx: 150 });
    const braking = body({ vx: 150 });
    run(gliding, 0.6, null);
    run(braking, 0.6, null, 1, true);
    expect(braking.vx).toBeLessThan(gliding.vx * 0.25);
  });

  it('Kontrolle verstärkt Schub und Bremsen', () => {
    const normal = body();
    const skilled = body();
    run(normal, 0.3, { x: 1, y: 0 }, 1);
    run(skilled, 0.3, { x: 1, y: 0 }, 1.5);
    expect(skilled.vx).toBeGreaterThan(normal.vx);
    const a = body({ vx: 150 });
    const b = body({ vx: 150 });
    run(a, 0.4, null, 1, true);
    run(b, 0.4, null, 1.5, true);
    expect(b.vx).toBeLessThan(a.vx);
  });

  it('Gegenschub bremst und kehrt die Richtung um', () => {
    const b = body({ vx: 150 });
    run(b, 0.6, { x: -1, y: 0 });
    expect(b.vx).toBeLessThan(0);
  });

  it('prallt an Wänden gedämpft ab und dringt nie ein', () => {
    const b = body({ x: 330, y: 200, vx: 300 }); // rechte Wand bei x = 13*32 = 416
    let bounced = false;
    for (let i = 0; i < 120; i++) {
      const r = stepZeroG(room, b, 1 / 60, null);
      if (r.bumped) bounced = true;
      expect(room.isSolid(room.toCol(b.x + b.radius - 0.01), room.toRow(b.y))).toBe(false);
    }
    expect(bounced).toBe(true);
    expect(b.vx).toBeLessThan(0);
    expect(Math.abs(b.vx)).toBeLessThan(300 * DEFAULT_ZEROG.restitution + 1);
  });

  it('bleibt bei beliebigen Stößen und Schub immer im Raum', () => {
    const rng = createRng(3);
    const b = body();
    for (let i = 0; i < 4000; i++) {
      if (i % 30 === 0) applyImpulse(b, (rng.next() - 0.5) * 800, (rng.next() - 0.5) * 800);
      const angle = rng.next() * Math.PI * 2;
      stepZeroG(room, b, 1 / 60, rng.chance(0.5) ? { x: Math.cos(angle), y: Math.sin(angle) } : null);
      expect(b.x).toBeGreaterThan(32 + 10);
      expect(b.x).toBeLessThan(13 * 32 - 10);
      expect(b.y).toBeGreaterThan(32 + 10);
      expect(b.y).toBeLessThan(13 * 32 - 10);
    }
  });

  it('Stoß addiert Geschwindigkeit und wird begrenzt', () => {
    const b = body({ vx: 100 });
    applyImpulse(b, 50, 0);
    expect(b.vx).toBe(150);
    applyImpulse(b, 5000, 0);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(DEFAULT_ZEROG.hardMax);
  });
});

describe('Schwerelose Räume im Dungeon', () => {
  it('Grid kennt schwerelosen Boden, der begehbar bleibt', () => {
    const grid = parseLevel({ rows: ['#####', '#@z.#', '#####'] }, 32).grid;
    expect(grid.isZeroG(2, 1)).toBe(true);
    expect(grid.isZeroG(3, 1)).toBe(false);
    expect(grid.isWalkable(2, 1)).toBe(true);
    expect(grid.get(2, 1)).toBe(TILE.zeroG);
    expect(grid.isZeroG(0, 0)).toBe(false);
    expect(grid instanceof TileGrid).toBe(true);
  });

  it('ohne Wahrscheinlichkeit gibt es keine, mit Wahrscheinlichkeit 1 jeden Kampf- und Schatzraum, nie Start oder Ausgang', () => {
    for (let seed = 0; seed < 60; seed++) {
      const none = generateDungeon(seed, 32);
      expect(none.rooms.some((r) => r.zeroG)).toBe(false);

      const all = generateDungeon(seed, 32, { zeroGChance: 1 });
      for (const r of all.rooms) {
        expect(r.zeroG).toBe(r.role === 'combat' || r.role === 'treasure');
        const c = all.grid.isZeroG(r.x + 1, r.y + 1);
        expect(c).toBe(r.zeroG);
      }
    }
  });

  it('Seeds bleiben lösbar und Pfade gehen auch durch schwerelose Räume', () => {
    for (let seed = 0; seed < 120; seed++) {
      const d = generateDungeon(seed, 32, { zeroGChance: 0.6 });
      const plan = planMission(d, ACT1_SPAWNS, createRng(seed));
      expect(findPath(d.grid, plan.playerStart, plan.exit, 11), `Seed ${seed}`).not.toBeNull();
    }
  });

  it('die Karte (Räume, Wände) ist von der Wahrscheinlichkeit unabhängig', () => {
    const a = generateDungeon(9, 32, { zeroGChance: 0 });
    const b = generateDungeon(9, 32, { zeroGChance: 0.8 });
    expect(a.rooms.map((r) => [r.x, r.y, r.w, r.h])).toEqual(b.rooms.map((r) => [r.x, r.y, r.w, r.h]));
    for (let r = 0; r < a.grid.rows; r++) for (let c = 0; c < a.grid.cols; c++) expect(a.grid.isSolid(c, r)).toBe(b.grid.isSolid(c, r));
  });
});

describe('Schub für Gegner und Zuschnitt auf das Lauftempo', () => {
  it('Höchsttempo folgt dem Lauftempo, die Beschleunigungszeit bleibt gleich', () => {
    const slow = paramsFor(85);
    expect(slow.maxSpeed).toBe(85);
    expect(slow.maxSpeed / slow.thrust).toBeCloseTo(DEFAULT_ZEROG.maxSpeed / DEFAULT_ZEROG.thrust);
    expect(slow.restitution).toBe(DEFAULT_ZEROG.restitution);
  });

  it('angeglichener Schub zeigt von der Geschwindigkeit zur Wunschgeschwindigkeit', () => {
    const thrust = matchedThrust({ vx: 100, vy: 0 }, 0, 1, 80);
    expect(thrust).not.toBeNull();
    expect(thrust!.x).toBeLessThan(0); // Seitwärtsdrift auslöschen
    expect(thrust!.y).toBeGreaterThan(0);
    expect(Math.hypot(thrust!.x, thrust!.y)).toBeCloseTo(1);
  });

  it('wird nahe am Sollwert sanft und hört dann ganz auf', () => {
    const gentle = matchedThrust({ vx: 0, vy: 70 }, 0, 1, 80)!;
    expect(Math.hypot(gentle.x, gentle.y)).toBeLessThan(0.5);
    expect(matchedThrust({ vx: 0, vy: 79 }, 0, 1, 80)).toBeNull();
  });

  it('ein Gegner mit angeglichenem Schub erreicht sein Tempo und hält die Richtung', () => {
    const b = body({ x: 100, y: 120 });
    const params = paramsFor(85);
    for (let i = 0; i < 180; i++) {
      stepZeroG(room, b, 1 / 60, matchedThrust(b, 1, 0, 85), params);
    }
    expect(b.vx).toBeGreaterThan(70);
    expect(b.vx).toBeLessThan(95);
    expect(Math.abs(b.vy)).toBeLessThan(5);
  });
});
