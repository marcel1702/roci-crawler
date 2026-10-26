import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../src/core/level';
import { TEST_ARENA } from '../../src/data/levels/testArena';

describe('parseLevel', () => {
  it('liest Raster, Spielerstart und Gegner-Spawns', () => {
    const level = parseLevel({ rows: ['####', '#@e#', '####'] }, 32);
    expect(level.grid.cols).toBe(4);
    expect(level.grid.rows).toBe(3);
    expect(level.playerStart).toEqual({ x: 48, y: 48 });
    expect(level.enemySpawns).toEqual([{ x: 80, y: 48 }]);
    expect(level.grid.isSolid(0, 0)).toBe(true);
    expect(level.grid.isWalkable(1, 1)).toBe(true);
  });

  it('behandelt Koordinaten außerhalb als Wand', () => {
    const { grid } = parseLevel({ rows: ['#@#'] }, 32);
    expect(grid.isSolid(-1, 0)).toBe(true);
    expect(grid.isSolid(0, 5)).toBe(true);
  });

  it('lehnt unregelmäßige Zeilen, unbekannte Zeichen und fehlenden Start ab', () => {
    expect(() => parseLevel({ rows: ['###', '#@'] }, 32)).toThrow(/Zeile 1/);
    expect(() => parseLevel({ rows: ['#?@'] }, 32)).toThrow(/Unbekanntes/);
    expect(() => parseLevel({ rows: ['###', '#.#'] }, 32)).toThrow(/Spielerstart/);
  });

  it('die Testarena ist gültig und alle Spawns sind begehbar', () => {
    const level = parseLevel(TEST_ARENA, 32);
    expect(level.enemySpawns.length).toBeGreaterThan(0);
    for (const spawn of [level.playerStart, ...level.enemySpawns]) {
      expect(level.grid.isWalkable(level.grid.toCol(spawn.x), level.grid.toRow(spawn.y))).toBe(true);
    }
  });
});
