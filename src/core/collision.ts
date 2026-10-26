import type { TileGrid } from './grid';

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface MoveResult {
  x: number;
  y: number;
  blockedX: boolean;
  blockedY: boolean;
}

/** True, wenn ein Kreis eine Wandkachel berührt. */
export function circleHitsSolid(grid: TileGrid, x: number, y: number, radius: number): boolean {
  const minCol = grid.toCol(x - radius);
  const maxCol = grid.toCol(x + radius);
  const minRow = grid.toRow(y - radius);
  const maxRow = grid.toRow(y + radius);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!grid.isSolid(col, row)) continue;
      // Nächster Punkt der Kachel zum Kreismittelpunkt.
      const nearestX = Math.max(col * grid.tileSize, Math.min(x, (col + 1) * grid.tileSize));
      const nearestY = Math.max(row * grid.tileSize, Math.min(y, (row + 1) * grid.tileSize));
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

/**
 * Bewegt einen Kreis um (dx, dy) und gleitet an Wänden entlang (Achsen getrennt, bis zur Wand
 * per Intervallhalbierung). Steckt der Kreis bereits in einer Wand, darf er sich frei herausbewegen.
 */
export function moveCircle(
  grid: TileGrid,
  x: number,
  y: number,
  radius: number,
  dx: number,
  dy: number,
): MoveResult {
  let blockedX = false;
  let blockedY = false;

  if (dx !== 0) {
    const nx = slideAxis(x, dx, (v) => circleHitsSolid(grid, v, y, radius));
    blockedX = nx !== x + dx;
    x = nx;
  }
  if (dy !== 0) {
    const ny = slideAxis(y, dy, (v) => circleHitsSolid(grid, x, v, radius));
    blockedY = ny !== y + dy;
    y = ny;
  }
  return { x, y, blockedX, blockedY };
}

function slideAxis(start: number, delta: number, hits: (value: number) => boolean): number {
  const target = start + delta;
  if (!hits(target) || hits(start)) return target;

  let free = 0;
  let blocked = delta;
  for (let i = 0; i < 6; i++) {
    const mid = (free + blocked) / 2;
    if (hits(start + mid)) blocked = mid;
    else free = mid;
  }
  return start + free;
}

/** True, wenn ein Kreis der gegebenen Größe die Strecke a->b ohne Wandkontakt abfahren kann. */
export function hasClearLine(
  grid: TileGrid,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
): boolean {
  const length = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(length / Math.max(2, radius / 2)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (circleHitsSolid(grid, ax + (bx - ax) * t, ay + (by - ay) * t, radius)) return false;
  }
  return true;
}

/** Sichtlinie für Schüsse und Zielen: dünner Strahl, der nur Wände beachtet. */
export function hasLineOfSight(grid: TileGrid, ax: number, ay: number, bx: number, by: number): boolean {
  return hasClearLine(grid, ax, ay, bx, by, 1.5);
}

/** Länge des Strahls ab (x,y) in Richtung `angle`, bis er eine Wand trifft (höchstens `maxDistance`). */
export function rayDistance(grid: TileGrid, x: number, y: number, angle: number, maxDistance: number): number {
  const stepSize = 4;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = 0; d < maxDistance; d += stepSize) {
    if (circleHitsSolid(grid, x + dx * d, y + dy * d, 1.5)) return Math.max(0, d - stepSize);
  }
  return maxDistance;
}
