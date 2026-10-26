import { TILE, TileGrid } from './grid';
import type { Vec2 } from './math';

export interface LevelLayout {
  /** ASCII-Zeilen: `#` Wand, `.` Boden, `z` Boden ohne Schwerkraft, `@` Spielerstart, `e` Gegner-Spawn. */
  rows: readonly string[];
}

export interface ParsedLevel {
  grid: TileGrid;
  playerStart: Vec2;
  enemySpawns: Vec2[];
  /** Mitten der Kacheln mit zusätzlichen Markierungszeichen (siehe `markerChars`), je Zeichen. */
  markers: Record<string, Vec2[]>;
}

/**
 * Liest eine ASCII-Karte. `markerChars` nennt weitere erlaubte Zeichen (z. B. Stationen im Hub): Sie zählen als
 * begehbarer Boden, ihre Position wird in `markers` gesammelt.
 */
export function parseLevel(layout: LevelLayout, tileSize: number, markerChars = ''): ParsedLevel {
  const { rows } = layout;
  const cols = rows[0]?.length ?? 0;
  if (rows.length === 0 || cols === 0) throw new Error('Level ist leer');

  const cells = new Uint8Array(cols * rows.length);
  let playerStart: Vec2 | null = null;
  const enemySpawns: Vec2[] = [];
  const markers: Record<string, Vec2[]> = {};

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
        case 'z':
          cells[row * cols + col] = TILE.zeroG;
          break;
        case '@':
          playerStart = center;
          break;
        case 'e':
          enemySpawns.push(center);
          break;
        default:
          if (!markerChars.includes(char)) {
            throw new Error(`Unbekanntes Level-Zeichen "${char}" in Zeile ${row}, Spalte ${col}`);
          }
          (markers[char] ??= []).push(center);
      }
    });
  });

  if (!playerStart) throw new Error('Level hat keinen Spielerstart (@)');
  return { grid: new TileGrid(cols, rows.length, tileSize, cells), playerStart, enemySpawns, markers };
}
