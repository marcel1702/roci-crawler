import { hasClearLine, circleHitsSolid } from './collision';
import type { TileGrid } from './grid';
import type { Vec2 } from './math';

const SQRT2 = Math.SQRT2;
const NEIGHBORS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

/** Nächstes begehbares Feld um (col,row) innerhalb von maxRadius Kacheln, bevorzugt das nächstgelegene zum Weltpunkt. */
export function nearestWalkableTile(
  grid: TileGrid,
  worldX: number,
  worldY: number,
  maxRadius: number,
): { col: number; row: number } | null {
  const col0 = grid.toCol(worldX);
  const row0 = grid.toRow(worldY);

  for (let ring = 0; ring <= maxRadius; ring++) {
    let best: { col: number; row: number } | null = null;
    let bestDist = Infinity;
    for (let row = row0 - ring; row <= row0 + ring; row++) {
      for (let col = col0 - ring; col <= col0 + ring; col++) {
        if (Math.max(Math.abs(col - col0), Math.abs(row - row0)) !== ring) continue;
        if (!grid.isWalkable(col, row)) continue;
        const center = grid.tileCenter(col, row);
        const d = Math.hypot(center.x - worldX, center.y - worldY);
        if (d < bestDist) {
          bestDist = d;
          best = { col, row };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * Kürzester Weg (A*, 8 Richtungen, kein Ecken-Schneiden) in Weltkoordinaten.
 * Startpunkt ist nicht enthalten, der letzte Punkt ist das Ziel. Liefert null, wenn es keinen Weg gibt.
 * `radius` ist die Größe des Läufers; der Weg wird danach geglättet.
 */
export function findPath(
  grid: TileGrid,
  from: Vec2,
  to: Vec2,
  radius: number,
  snapTiles = 2,
): Vec2[] | null {
  const start = nearestWalkableTile(grid, from.x, from.y, snapTiles);
  const goal = nearestWalkableTile(grid, to.x, to.y, snapTiles);
  if (!start || !goal) return null;

  const tilePath = astar(grid, start.col, start.row, goal.col, goal.row);
  if (!tilePath) return null;

  // Der exakte Zielpunkt ersetzt die Kachelmitte, solange er selbst begehbar ist.
  const goalCenter = grid.tileCenter(goal.col, goal.row);
  const exactGoalOk =
    grid.toCol(to.x) === goal.col && grid.toRow(to.y) === goal.row && !circleHitsSolid(grid, to.x, to.y, radius);
  const waypoints: Vec2[] = tilePath.slice(1).map(([col, row]) => grid.tileCenter(col, row));
  if (waypoints.length === 0) waypoints.push(goalCenter);
  waypoints[waypoints.length - 1] = exactGoalOk ? { x: to.x, y: to.y } : goalCenter;

  return smoothPath(grid, from, waypoints, radius);
}

/** Entfernt Zwischenpunkte, wenn der Läufer die Strecke direkt abfahren kann ("String Pulling"). */
export function smoothPath(grid: TileGrid, from: Vec2, waypoints: readonly Vec2[], radius: number): Vec2[] {
  const result: Vec2[] = [];
  let anchor = from;
  let i = 0;
  while (i < waypoints.length) {
    let farthest = i;
    for (let j = waypoints.length - 1; j > i; j--) {
      const candidate = waypoints[j] as Vec2;
      if (hasClearLine(grid, anchor.x, anchor.y, candidate.x, candidate.y, radius)) {
        farthest = j;
        break;
      }
    }
    const next = waypoints[farthest] as Vec2;
    result.push(next);
    anchor = next;
    i = farthest + 1;
  }
  return result;
}

function astar(grid: TileGrid, sc: number, sr: number, gc: number, gr: number): [number, number][] | null {
  const index = (c: number, r: number): number => r * grid.cols + c;
  const heuristic = (c: number, r: number): number => {
    const dx = Math.abs(c - gc);
    const dy = Math.abs(r - gr);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  };

  const total = grid.cols * grid.rows;
  const gScore = new Float32Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const open = new MinHeap();

  gScore[index(sc, sr)] = 0;
  open.push(index(sc, sr), heuristic(sc, sr));

  while (open.size > 0) {
    const current = open.pop();
    if (closed[current]) continue;
    closed[current] = 1;
    const c = current % grid.cols;
    const r = Math.floor(current / grid.cols);

    if (c === gc && r === gr) {
      const path: [number, number][] = [];
      for (let node = current; node !== -1; node = cameFrom[node] as number) {
        path.push([node % grid.cols, Math.floor(node / grid.cols)]);
      }
      return path.reverse();
    }

    for (const [dc, dr, cost] of NEIGHBORS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!grid.isWalkable(nc, nr)) continue;
      // Diagonalen nur, wenn beide Nachbarfelder frei sind (sonst würde der Läufer die Ecke schneiden).
      if (dc !== 0 && dr !== 0 && (grid.isSolid(c + dc, r) || grid.isSolid(c, r + dr))) continue;
      const ni = index(nc, nr);
      if (closed[ni]) continue;
      const tentative = (gScore[current] as number) + cost;
      if (tentative < (gScore[ni] as number)) {
        gScore[ni] = tentative;
        cameFrom[ni] = current;
        open.push(ni, tentative + heuristic(nc, nr));
      }
    }
  }
  return null;
}

/** Binärer Min-Heap über (Knoten, Priorität); doppelte Einträge werden beim Entnehmen übersprungen. */
class MinHeap {
  private nodes: number[] = [];
  private priorities: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, priority: number): void {
    this.nodes.push(node);
    this.priorities.push(priority);
    let i = this.nodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((this.priorities[parent] as number) <= priority) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.nodes[0] as number;
    const lastNode = this.nodes.pop() as number;
    const lastPriority = this.priorities.pop() as number;
    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode;
      this.priorities[0] = lastPriority;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.nodes.length && (this.priorities[left] as number) < (this.priorities[smallest] as number)) {
          smallest = left;
        }
        if (right < this.nodes.length && (this.priorities[right] as number) < (this.priorities[smallest] as number)) {
          smallest = right;
        }
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.nodes[a], this.nodes[b]] = [this.nodes[b] as number, this.nodes[a] as number];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b] as number, this.priorities[a] as number];
  }
}
