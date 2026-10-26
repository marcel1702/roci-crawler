import { TILE, TileGrid } from './grid';
import type { Vec2 } from './math';

export interface LevelLayout {
  /** ASCII-Zeilen: `#` Wand, `.` Boden, `@` Spielerstart, `e` Gegner-Spawn. */
  rows: readonly string[];
}

export interface ParsedLevel {
  grid: TileGrid;
  playerStart: Vec2;
  enemySpawns: Vec2[];
}

export function parseLevel(layout: LevelLayout, tileSize: number): ParsedLevel {
  const { rows } = layout;
  const cols = rows[0]?.length ?? 0;
  if (rows.length === 0 || cols === 0) throw new Error('Level ist leer');

  const cells = new Uint8Array(cols * rows.length);
  let playerStart: Vec2 | null = null;
  const enemySpawns: Vec2[] = [];

  rows.forEach((line, row) => {
    if (line.length !== cols) {
      throw new Error(`Level-Zeile ${row} hat ${line.length} statt ${cols} Zeichen`);
    }
    [...line].forEach((char, col) => {
      const center = { x: (col + 0.5) * tileSize, y: (row + 0.5) * tileSize };
      switch (char) {
        case '#':
          cells[row * cols + col] = TILE.wall;
          break;
        case '.':
          break;
        case '@':
          playerStart = center;
          break;
        case 'e':
          enemySpawns.push(center);
          break;
        default:
          throw new Error(`Unbekanntes Level-Zeichen "${char}" in Zeile ${row}, Spalte ${col}`);
      }
    });
  });

  if (!playerStart) throw new Error('Level hat keinen Spielerstart (@)');
  return { grid: new TileGrid(cols, rows.length, tileSize, cells), playerStart, enemySpawns };
}
