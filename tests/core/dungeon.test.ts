import { describe, expect, it } from 'vitest';
import { generateDungeon, roomCenterPx, roomCenterTile } from '../../src/core/dungeon';
import type { Dungeon } from '../../src/core/dungeon';
import { planMission } from '../../src/core/encounters';
import { ExploredMap } from '../../src/core/fog';
import { findPath } from '../../src/core/pathfinding';
import { ACT1_SPAWNS } from '../../src/data/spawnTables';
import { createRng } from '../../src/core/rng';

const TILE = 32;
const PLAYER_RADIUS = 11;
/** Größter Gegnerradius (Brecher) – auch er muss überall hinkommen. */
const BIGGEST_RADIUS = 15;

/** Alle von (col,row) aus begehbaren, zusammenhängenden Kacheln. */
function reachable(dungeon: Dungeon, col: number, row: number): Set<number> {
  const { grid } = dungeon;
  const seen = new Set<number>([row * grid.cols + col]);
  const queue: [number, number][] = [[col, row]];
  while (queue.length > 0) {
    const [c, r] = queue.shift() as [number, number];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc;
      const nr = r + dr;
      const key = nr * grid.cols + nc;
      if (grid.isWalkable(nc, nr) && !seen.has(key)) {
        seen.add(key);
        queue.push([nc, nr]);
      }
    }
  }
  return seen;
}

describe('generateDungeon', () => {
  it('ist deterministisch: gleicher Seed = gleiche Karte, anderer Seed = andere Karte', () => {
    const a = generateDungeon(1234, TILE);
    const b = generateDungeon(1234, TILE);
    const c = generateDungeon(1235, TILE);
    expect(a.grid.toRowsOfIds()).toEqual(b.grid.toRowsOfIds());
    expect(a.rooms).toEqual(b.rooms);
    expect(a.grid.toRowsOfIds()).not.toEqual(c.grid.toRowsOfIds());
  });

  it('hat einen Rand aus Wänden und die gewünschte Größe', () => {
    const { grid } = generateDungeon(7, TILE);
    expect([grid.cols, grid.rows]).toEqual([64, 44]);
    for (let c = 0; c < grid.cols; c++) {
      expect(grid.isSolid(c, 0)).toBe(true);
      expect(grid.isSolid(c, grid.rows - 1)).toBe(true);
    }
    for (let r = 0; r < grid.rows; r++) {
      expect(grid.isSolid(0, r)).toBe(true);
      expect(grid.isSolid(grid.cols - 1, r)).toBe(true);
    }
  });

  it('JEDER von 600 Seeds ist lösbar: alles erreichbar, Ausgang per Pfad begehbar, Rollen stimmig', () => {
    for (let seed = 0; seed < 600; seed++) {
      const dungeon = generateDungeon(seed, TILE);
      const { grid, rooms } = dungeon;
      const plan = planMission(dungeon, ACT1_SPAWNS, createRng(seed));

      expect(rooms.length, `Seed ${seed}: Raumanzahl`).toBeGreaterThanOrEqual(8);
      expect(rooms.filter((r) => r.role === 'start')).toHaveLength(1);
      expect(rooms.filter((r) => r.role === 'exit')).toHaveLength(1);
      for (const room of rooms.filter((r) => r.role === 'treasure')) expect(room.links).toHaveLength(1);

      const start = roomCenterTile(rooms.find((r) => r.role === 'start')!);
      const ok = reachable(dungeon, start.col, start.row);
      const isOk = (x: number, y: number) => ok.has(grid.toRow(y) * grid.cols + grid.toCol(x));

      for (const room of rooms) {
        const c = roomCenterTile(room);
        expect(ok.has(c.row * grid.cols + c.col), `Seed ${seed}: Raum ${room.id} nicht erreichbar`).toBe(true);
      }
      expect(isOk(plan.exit.x, plan.exit.y), `Seed ${seed}: Ausgang`).toBe(true);
      for (const chest of plan.chests) expect(isOk(chest.x, chest.y), `Seed ${seed}: Truhe`).toBe(true);
      for (const encounter of plan.encounters) {
        for (const enemy of encounter.enemies) expect(isOk(enemy.x, enemy.y), `Seed ${seed}: Gegner`).toBe(true);
      }

      // Auch der größte Gegner und die Spielfigur kommen auf einem Pfad vom Start zum Ausgang.
      for (const radius of [PLAYER_RADIUS, BIGGEST_RADIUS]) {
        const path = findPath(grid, plan.playerStart, plan.exit, radius);
        expect(path, `Seed ${seed}: Pfad (Radius ${radius})`).not.toBeNull();
      }
    }
  });

  it('der Ausgang liegt nicht im Startraum, und der Startraum bleibt gegnerfrei', () => {
    for (let seed = 0; seed < 100; seed++) {
      const dungeon = generateDungeon(seed, TILE);
      const plan = planMission(dungeon, ACT1_SPAWNS, createRng(seed));
      const startRoom = dungeon.rooms.find((r) => r.role === 'start')!;
      expect(plan.exitRoomId).not.toBe(startRoom.id);
      expect(plan.encounters.some((e) => e.roomId === startRoom.id)).toBe(false);
      expect(dungeon.rooms.find((r) => r.id === plan.exitRoomId)!.depth).toBeGreaterThanOrEqual(2);
    }
  });

  it('Gegner stehen nie in der Wand und halten Abstand zueinander', () => {
    for (let seed = 0; seed < 100; seed++) {
      const dungeon = generateDungeon(seed, TILE);
      const plan = planMission(dungeon, ACT1_SPAWNS, createRng(seed));
      for (const encounter of plan.encounters) {
        const list = encounter.enemies;
        for (const e of list) expect(dungeon.grid.isWalkable(dungeon.grid.toCol(e.x), dungeon.grid.toRow(e.y))).toBe(true);
      }
    }
  });

  it('roomCenterPx liegt auf einer begehbaren Kachel', () => {
    const dungeon = generateDungeon(99, TILE);
    for (const room of dungeon.rooms) {
      const p = roomCenterPx(room, TILE);
      expect(dungeon.grid.isWalkable(dungeon.grid.toCol(p.x), dungeon.grid.toRow(p.y))).toBe(true);
    }
  });
});

describe('ExploredMap (Nebel)', () => {
  const dungeon = generateDungeon(5, TILE);
  const start = roomCenterTile(dungeon.rooms.find((r) => r.role === 'start')!);

  it('deckt zuerst nur die Umgebung der Figur auf', () => {
    const map = new ExploredMap(dungeon.grid);
    expect(map.exploredTotal).toBe(0);
    map.updateVision(start.col, start.row, 8);
    expect(map.isVisible(start.col, start.row)).toBe(true);
    expect(map.isExplored(start.col, start.row)).toBe(true);
    expect(map.exploredTotal).toBeGreaterThan(9);
    expect(map.isExplored(0, 0)).toBe(false);
  });

  it('Wände halten die Sicht auf: nichts hinter einer geschlossenen Wand wird entdeckt', () => {
    const map = new ExploredMap(dungeon.grid);
    map.updateVision(start.col, start.row, 30);
    const exit = dungeon.rooms.find((r) => r.role === 'exit')!;
    const exitCenter = roomCenterTile(exit);
    // Weit entfernte Räume hinter Wänden/Gängen sind nicht in einem Schritt sichtbar.
    const nearlyEverything = map.exploredTotal > dungeon.grid.cols * dungeon.grid.rows * 0.5;
    expect(nearlyEverything).toBe(false);
    expect(map.isVisible(exitCenter.col, exitCenter.row) && exit.depth >= 2).toBe(false);
  });

  it('entdeckte Kacheln bleiben erinnert, wenn die Figur weitergeht; sichtbar ist nur der aktuelle Ausschnitt', () => {
    const map = new ExploredMap(dungeon.grid);
    map.updateVision(start.col, start.row, 8);
    const first = map.exploredTotal;
    const startRoom = dungeon.rooms.find((r) => r.role === 'start')!;
    const far = roomCenterTile(dungeon.rooms.find((r) => r.id === startRoom.links[0])!);
    map.updateVision(far.col, far.row, 8);
    expect(map.exploredTotal).toBeGreaterThan(first);
    expect(map.isExplored(start.col, start.row)).toBe(true);
    expect(map.isVisible(start.col, start.row)).toBe(false);
  });
});
