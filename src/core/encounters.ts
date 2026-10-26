import type { Dungeon, Room } from './dungeon';
import { roomCenterPx } from './dungeon';
import type { Vec2 } from './math';
import type { Rng } from './rng';

export interface SpawnGroup<Id extends string> {
  enemies: readonly Id[];
  /** Relative Häufigkeit unter allen passenden Gruppen. */
  weight: number;
  /** Frühestens in Räumen mit dieser Tiefe (Räume vom Start). */
  minDepth: number;
}

export interface SpawnTable<Id extends string> {
  groups: readonly SpawnGroup<Id>[];
  /** Wächter im Ausgangsraum. */
  guardian: readonly Id[];
  /** Bewacher von Schatzräumen. */
  treasureGuard: readonly Id[];
}

export interface PlacedEnemy<Id extends string> {
  id: Id;
  x: number;
  y: number;
}

export interface Encounter<Id extends string> {
  roomId: number;
  enemies: PlacedEnemy<Id>[];
}

export interface ChestSpawn {
  roomId: number;
  x: number;
  y: number;
}

export interface MissionPlan<Id extends string> {
  playerStart: Vec2;
  exit: Vec2;
  exitRoomId: number;
  encounters: Encounter<Id>[];
  chests: ChestSpawn[];
}

const MIN_ENEMY_SPACING = 40;
const CHEST_CHANCE_COMBAT_ROOM = 0.25;
/** Räume ab dieser Fläche (Kacheln) bekommen einen zusätzlichen Gegner. */
const BIG_ROOM_AREA = 70;

export interface PlanOptions<Id extends string> {
  /** Bossmission: Statt der Wächter steht dieser Boss allein in der Mitte des Ausgangsraums. */
  boss?: Id;
}

/** Verteilt Gegner, Truhen, Start und Ausgang auf einen Dungeon. Rein deterministisch bei gleichem Rng-Zustand. */
export function planMission<Id extends string>(
  dungeon: Dungeon,
  table: SpawnTable<Id>,
  rng: Rng,
  options: PlanOptions<Id> = {},
): MissionPlan<Id> {
  const tileSize = dungeon.grid.tileSize;
  const start = dungeon.rooms.find((r) => r.role === 'start') as Room;
  const exit = dungeon.rooms.find((r) => r.role === 'exit') as Room;

  const encounters: Encounter<Id>[] = [];
  const chests: ChestSpawn[] = [];

  for (const room of dungeon.rooms) {
    switch (room.role) {
      case 'start':
        break;
      case 'exit': {
        // Die Wächter werden immer gewürfelt (und bei einem Boss verworfen), damit die übrigen Räume gleich bleiben.
        const guards = placeEnemies(room, table.guardian, tileSize, rng);
        const center = roomCenterPx(room, tileSize);
        const enemies = options.boss !== undefined ? [{ id: options.boss, x: center.x, y: center.y }] : guards;
        encounters.push({ roomId: room.id, enemies });
        break;
      }
      case 'treasure': {
        const center = roomCenterPx(room, tileSize);
        chests.push({ roomId: room.id, x: center.x, y: center.y });
        encounters.push({ roomId: room.id, enemies: placeEnemies(room, table.treasureGuard, tileSize, rng, center) });
        break;
      }
      case 'combat': {
        const group = pickGroup(table, room.depth, rng);
        const ids = [...group];
        if (room.w * room.h >= BIG_ROOM_AREA && ids.length > 0) ids.push(rng.pick(group));
        encounters.push({ roomId: room.id, enemies: placeEnemies(room, ids, tileSize, rng) });
        if (rng.chance(CHEST_CHANCE_COMBAT_ROOM)) {
          const corner = randomTileInRoom(room, 1, rng);
          chests.push({ roomId: room.id, x: (corner.col + 0.5) * tileSize, y: (corner.row + 0.5) * tileSize });
        }
        break;
      }
    }
  }

  return {
    playerStart: roomCenterPx(start, tileSize),
    exit: roomCenterPx(exit, tileSize),
    exitRoomId: exit.id,
    encounters,
    chests,
  };
}

function pickGroup<Id extends string>(table: SpawnTable<Id>, depth: number, rng: Rng): readonly Id[] {
  const options = table.groups.filter((g) => g.minDepth <= depth);
  const pool = options.length > 0 ? options : table.groups;
  const total = pool.reduce((sum, g) => sum + g.weight, 0);
  let roll = rng.next() * total;
  for (const group of pool) {
    roll -= group.weight;
    if (roll < 0) return group.enemies;
  }
  return (pool[pool.length - 1] as SpawnGroup<Id>).enemies;
}

function randomTileInRoom(room: Room, inset: number, rng: Rng): { col: number; row: number } {
  const w = Math.max(1, room.w - 2 * inset);
  const h = Math.max(1, room.h - 2 * inset);
  return { col: room.x + inset + rng.int(0, w - 1), row: room.y + inset + rng.int(0, h - 1) };
}

/** Platziert Gegner auf zufälligen Kacheln im Raum, mit Abstand zueinander und zu `avoid` (z. B. einer Truhe). */
function placeEnemies<Id extends string>(
  room: Room,
  ids: readonly Id[],
  tileSize: number,
  rng: Rng,
  avoid?: Vec2,
): PlacedEnemy<Id>[] {
  const placed: PlacedEnemy<Id>[] = [];
  for (const id of ids) {
    let spot: Vec2 = { x: 0, y: 0 };
    for (let tries = 0; tries < 40; tries++) {
      const tile = randomTileInRoom(room, 1, rng);
      spot = { x: (tile.col + 0.5) * tileSize, y: (tile.row + 0.5) * tileSize };
      const crowded = placed.some((p) => Math.hypot(p.x - spot.x, p.y - spot.y) < MIN_ENEMY_SPACING);
      const nearAvoid = avoid !== undefined && Math.hypot(avoid.x - spot.x, avoid.y - spot.y) < MIN_ENEMY_SPACING;
      if (!crowded && !nearAvoid) break;
    }
    placed.push({ id, x: spot.x, y: spot.y });
  }
  return placed;
}
