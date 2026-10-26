import { TILE, TileGrid } from './grid';
import type { Vec2 } from './math';
import { createRng } from './rng';
import type { Rng } from './rng';

export type RoomRole = 'start' | 'exit' | 'combat' | 'treasure';

export interface Room {
  id: number;
  /** Linke obere Ecke und Größe in Kacheln. */
  x: number;
  y: number;
  w: number;
  h: number;
  role: RoomRole;
  /** Benachbarte Räume (durch Gänge verbunden). */
  links: number[];
  /** Anzahl Räume vom Startraum (0 = Startraum). */
  depth: number;
}

export interface Dungeon {
  seed: number;
  grid: TileGrid;
  rooms: Room[];
}

export interface DungeonOptions {
  cols: number;
  rows: number;
  minRooms: number;
  maxRooms: number;
  minRoomSize: number;
  maxRoomSize: number;
  /** Breite der Gänge in Kacheln. */
  corridorWidth: number;
}

export const DEFAULT_DUNGEON: DungeonOptions = {
  cols: 64,
  rows: 44,
  minRooms: 8,
  maxRooms: 11,
  minRoomSize: 6,
  maxRoomSize: 11,
  corridorWidth: 2,
};

const ROOM_PADDING = 3;
const ROOM_TRIES = 300;
const GENERATION_ATTEMPTS = 60;
const EXTRA_LINK_CHANCE = 0.22;
const MAX_EXTRA_LINKS = 3;
const MAX_TREASURE_ROOMS = 2;

export function roomCenterTile(room: Room): { col: number; row: number } {
  return { col: room.x + Math.floor(room.w / 2), row: room.y + Math.floor(room.h / 2) };
}

export function roomCenterPx(room: Room, tileSize: number): Vec2 {
  const { col, row } = roomCenterTile(room);
  return { x: (col + 0.5) * tileSize, y: (row + 0.5) * tileSize };
}

/**
 * Erzeugt einen zufälligen Dungeon aus Räumen und Gängen. Gleicher Seed (und gleiche Optionen) ergibt immer
 * dieselbe Karte. Alle Räume sind verbunden; Start- und Ausgangsraum liegen möglichst weit auseinander.
 */
export function generateDungeon(seed: number, tileSize: number, options: Partial<DungeonOptions> = {}): Dungeon {
  const opts = { ...DEFAULT_DUNGEON, ...options };

  for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
    const rng = createRng((seed ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0);
    const rooms = placeRooms(rng, opts);
    if (rooms.length < opts.minRooms) continue;

    linkRooms(rooms, rng);
    assignRoles(rooms, rng);

    const cells = new Uint8Array(opts.cols * opts.rows).fill(TILE.wall);
    for (const room of rooms) carveRect(cells, opts.cols, room.x, room.y, room.w, room.h);
    for (const room of rooms) {
      for (const otherId of room.links) {
        if (otherId > room.id) carveCorridor(cells, opts, room, rooms[otherId] as Room, rng);
      }
    }
    return { seed, grid: new TileGrid(opts.cols, opts.rows, tileSize, cells), rooms };
  }
  throw new Error(`Kein gültiger Dungeon für Seed ${seed} gefunden`);
}

function placeRooms(rng: Rng, opts: DungeonOptions): Room[] {
  const rooms: Room[] = [];
  const target = rng.int(opts.minRooms, opts.maxRooms);

  for (let tries = 0; tries < ROOM_TRIES && rooms.length < target; tries++) {
    const w = rng.int(opts.minRoomSize, opts.maxRoomSize);
    const h = rng.int(opts.minRoomSize - 1, opts.maxRoomSize - 2);
    const x = rng.int(2, opts.cols - w - 3);
    const y = rng.int(2, opts.rows - h - 3);
    const overlaps = rooms.some(
      (r) =>
        x < r.x + r.w + ROOM_PADDING && x + w + ROOM_PADDING > r.x && y < r.y + r.h + ROOM_PADDING && y + h + ROOM_PADDING > r.y,
    );
    if (!overlaps) rooms.push({ id: rooms.length, x, y, w, h, role: 'combat', links: [], depth: 0 });
  }
  return rooms;
}

function center(room: Room): { x: number; y: number } {
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
}

function roomDistance(a: Room, b: Room): number {
  const ca = center(a);
  const cb = center(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
}

function connect(a: Room, b: Room): void {
  if (!a.links.includes(b.id)) a.links.push(b.id);
  if (!b.links.includes(a.id)) b.links.push(a.id);
}

/** Minimaler Spannbaum (Prim) macht alles erreichbar; wenige Zusatzgänge erzeugen Rundwege. */
function linkRooms(rooms: Room[], rng: Rng): void {
  const inTree = new Set<number>([0]);
  while (inTree.size < rooms.length) {
    let best: { from: Room; to: Room; dist: number } | null = null;
    for (const id of inTree) {
      const from = rooms[id] as Room;
      for (const to of rooms) {
        if (inTree.has(to.id)) continue;
        const dist = roomDistance(from, to);
        if (!best || dist < best.dist) best = { from, to, dist };
      }
    }
    if (!best) break;
    connect(best.from, best.to);
    inTree.add(best.to.id);
  }

  let extras = 0;
  for (const a of rooms) {
    for (const b of rooms) {
      if (b.id <= a.id || a.links.includes(b.id) || extras >= MAX_EXTRA_LINKS) continue;
      if (roomDistance(a, b) < 24 && rng.chance(EXTRA_LINK_CHANCE)) {
        connect(a, b);
        extras++;
      }
    }
  }
}

/** Start zufällig, Ausgang am weitesten (in Räumen) entfernt, Sackgassen werden zu Schatzräumen. */
function assignRoles(rooms: Room[], rng: Rng): void {
  const start = rng.pick(rooms);

  const queue: Room[] = [start];
  const seen = new Set<number>([start.id]);
  start.depth = 0;
  while (queue.length > 0) {
    const room = queue.shift() as Room;
    for (const id of room.links) {
      if (seen.has(id)) continue;
      seen.add(id);
      const next = rooms[id] as Room;
      next.depth = room.depth + 1;
      queue.push(next);
    }
  }

  let exit = start;
  for (const room of rooms) {
    const farther = room.depth > exit.depth;
    const tieFarther = room.depth === exit.depth && roomDistance(room, start) > roomDistance(exit, start);
    if (room !== start && (farther || tieFarther)) exit = room;
  }

  start.role = 'start';
  exit.role = 'exit';
  const deadEnds = rng.shuffle(rooms.filter((r) => r.role === 'combat' && r.links.length === 1));
  for (const room of deadEnds.slice(0, MAX_TREASURE_ROOMS)) room.role = 'treasure';
}

function carveRect(cells: Uint8Array, cols: number, x: number, y: number, w: number, h: number): void {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) cells[row * cols + col] = TILE.floor;
  }
}

/** Gang zwischen den Raummitten: erst waagerecht, dann senkrecht (oder umgekehrt). */
function carveCorridor(cells: Uint8Array, opts: DungeonOptions, a: Room, b: Room, rng: Rng): void {
  const ca = { col: Math.floor(a.x + a.w / 2), row: Math.floor(a.y + a.h / 2) };
  const cb = { col: Math.floor(b.x + b.w / 2), row: Math.floor(b.y + b.h / 2) };
  const horizontalFirst = rng.chance(0.5);
  const corner = horizontalFirst ? { col: cb.col, row: ca.row } : { col: ca.col, row: cb.row };

  carveLine(cells, opts, ca.col, ca.row, corner.col, corner.row);
  carveLine(cells, opts, corner.col, corner.row, cb.col, cb.row);
}

function carveLine(cells: Uint8Array, opts: DungeonOptions, c1: number, r1: number, c2: number, r2: number): void {
  const w = opts.corridorWidth;
  const minC = Math.min(c1, c2);
  const maxC = Math.max(c1, c2);
  const minR = Math.min(r1, r2);
  const maxR = Math.max(r1, r2);
  // Der Gang wird um die Mittellinie verbreitert, der Kartenrand bleibt immer Wand.
  const x0 = Math.max(1, minC - Math.floor((w - 1) / 2));
  const y0 = Math.max(1, minR - Math.floor((w - 1) / 2));
  const x1 = Math.min(opts.cols - 2, maxC + Math.ceil((w - 1) / 2));
  const y1 = Math.min(opts.rows - 2, maxR + Math.ceil((w - 1) / 2));
  carveRect(cells, opts.cols, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}
