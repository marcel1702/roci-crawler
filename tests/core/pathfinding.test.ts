import { describe, expect, it } from 'vitest';
import { hasClearLine } from '../../src/core/collision';
import { parseLevel } from '../../src/core/level';
import { findPath, nearestWalkableTile } from '../../src/core/pathfinding';

const RADIUS = 11;

// Zwei Räume, nur durch eine Lücke in der Trennwand (Spalte 5, Zeile 5) verbunden.
const { grid } = parseLevel(
  {
    rows: [
      '###########',
      '#....#....#',
      '#....#....#',
      '#.@..#....#',
      '#....#....#',
      '#.........#',
      '#....#....#',
      '###########',
    ],
  },
  32,
);

const tileCenter = (col: number, row: number) => grid.tileCenter(col, row);

describe('findPath', () => {
  it('findet einen Weg durch die Lücke und endet am Ziel', () => {
    const from = tileCenter(2, 3);
    const to = tileCenter(8, 2);
    const path = findPath(grid, from, to, RADIUS);
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual(to);
  });

  it('der Weg ist befahrbar: jedes Teilstück hat freie Sicht für den Läufer', () => {
    const from = tileCenter(2, 3);
    const path = findPath(grid, from, tileCenter(8, 2), RADIUS) ?? [];
    let previous = from;
    for (const point of path) {
      expect(hasClearLine(grid, previous.x, previous.y, point.x, point.y, RADIUS)).toBe(true);
      previous = point;
    }
  });

  it('glättet geradlinige Wege auf einen einzigen Punkt', () => {
    const path = findPath(grid, tileCenter(1, 1), tileCenter(4, 4), RADIUS);
    expect(path).toHaveLength(1);
  });

  it('Ziel in der Wand rastet aufs nächste begehbare Feld ein', () => {
    const wall = tileCenter(5, 2);
    const path = findPath(grid, tileCenter(2, 3), wall, RADIUS);
    expect(path).not.toBeNull();
    const last = path?.at(-1);
    expect(last).toBeDefined();
    expect(grid.isWalkable(grid.toCol(last?.x ?? 0), grid.toRow(last?.y ?? 0))).toBe(true);
  });

  it('liefert null, wenn das Ziel zu weit von begehbaren Feldern entfernt ist', () => {
    expect(findPath(grid, tileCenter(2, 3), { x: -500, y: -500 }, RADIUS)).toBeNull();
  });

  it('liefert null bei abgeschlossenen Bereichen', () => {
    const closed = parseLevel({ rows: ['#######', '#@.#..#', '#######'] }, 32).grid;
    expect(findPath(closed, closed.tileCenter(1, 1), closed.tileCenter(4, 1), RADIUS)).toBeNull();
  });

  it('schneidet keine Ecken: Diagonale nur bei freien Nachbarfeldern', () => {
    const diagonal = parseLevel({ rows: ['####', '#@##', '##.#', '####'] }, 32).grid;
    expect(findPath(diagonal, diagonal.tileCenter(1, 1), diagonal.tileCenter(2, 2), RADIUS)).toBeNull();
  });
});

describe('nearestWalkableTile', () => {
  it('gibt das Feld selbst zurück, wenn es begehbar ist', () => {
    expect(nearestWalkableTile(grid, 48, 48, 2)).toEqual({ col: 1, row: 1 });
  });

  it('sucht im Umkreis und gibt null außerhalb der Reichweite zurück', () => {
    expect(nearestWalkableTile(grid, tileCenter(5, 2).x, tileCenter(5, 2).y, 1)).not.toBeNull();
    expect(nearestWalkableTile(grid, -300, -300, 2)).toBeNull();
  });
});
