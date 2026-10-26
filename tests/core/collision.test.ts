import { describe, expect, it } from 'vitest';
import { circleHitsSolid, hasClearLine, moveCircle } from '../../src/core/collision';
import { parseLevel } from '../../src/core/level';

// 5x5; Zeile 2 ist ab Spalte 3 (x >= 96) Wand.
const { grid } = parseLevel(
  {
    rows: ['#####', '#@..#', '#..##', '#...#', '#####'],
  },
  32,
);

describe('circleHitsSolid', () => {
  it('erkennt freie Fläche und Wandkontakt', () => {
    expect(circleHitsSolid(grid, 48, 48, 10)).toBe(false);
    expect(circleHitsSolid(grid, 38, 48, 10)).toBe(true); // 38-10 = 28 < 32 (linke Wand)
  });

  it('behandelt Kachelecken als rund', () => {
    // Nahe der Ecke der Wandkachel (3,2) bei (96, 64): Abstand ~ 13,4 > Radius 10
    expect(circleHitsSolid(grid, 86, 54, 10)).toBe(false);
    expect(circleHitsSolid(grid, 90, 58, 10)).toBe(true);
  });
});

describe('moveCircle', () => {
  it('bewegt frei, wenn nichts im Weg ist', () => {
    const r = moveCircle(grid, 48, 48, 10, 5, 3);
    expect(r).toMatchObject({ x: 53, y: 51, blockedX: false, blockedY: false });
  });

  it('stoppt an der Wand und meldet die blockierte Achse', () => {
    const r = moveCircle(grid, 70, 80, 10, 40, 0); // Wand ab x=96 -> Kreismitte höchstens 86
    expect(r.blockedX).toBe(true);
    expect(r.x).toBeGreaterThan(85.5);
    expect(r.x).toBeLessThanOrEqual(86);
  });

  it('gleitet an Wänden entlang', () => {
    const r = moveCircle(grid, 70, 80, 10, 40, 5);
    expect(r.blockedX).toBe(true);
    expect(r.blockedY).toBe(false);
    expect(r.y).toBeCloseTo(85);
  });

  it('lässt einen eingeklemmten Kreis hinaus', () => {
    const r = moveCircle(grid, 36, 48, 10, 6, 0); // überlappt linke Wand
    expect(r.x).toBe(42);
  });
});

describe('hasClearLine', () => {
  it('ist frei im offenen Raum und blockiert durch Wände', () => {
    expect(hasClearLine(grid, 48, 48, 80, 48, 10)).toBe(true);
    expect(hasClearLine(grid, 48, 48, 112, 80, 10)).toBe(false);
  });
});
