import { describe, expect, it } from 'vitest';
import { hasLineOfSight, rayDistance } from '../../src/core/collision';
import { isInSector } from '../../src/core/combat';
import { parseLevel } from '../../src/core/level';
import { stepProjectile } from '../../src/core/projectile';
import { createRng } from '../../src/core/rng';

// 7x3 Raum, Wand in Spalte 3 (x = 96..128) bei Zeile 1 – blockiert die Mitte, oben/unten ist Wand.
const { grid } = parseLevel({ rows: ['#######', '#..#..#', '#@.#..#', '#######'] }, 32);

describe('stepProjectile', () => {
  it('fliegt geradeaus und läuft nach der Flugzeit ab', () => {
    const p = { x: 48, y: 80, vx: 0, vy: 0, radius: 3, ttl: 0.2 };
    expect(stepProjectile(grid, p, 0.1)).toBe('flying');
    expect(stepProjectile(grid, p, 0.15)).toBe('expired');
  });

  it('bleibt an einer Wand hängen, auch bei hoher Geschwindigkeit', () => {
    const p = { x: 48, y: 80, vx: 5000, vy: 0, radius: 3, ttl: 5 };
    expect(stepProjectile(grid, p, 0.1)).toBe('hitWall');
    expect(p.x).toBeLessThan(96);
  });
});

describe('Sichtlinie', () => {
  it('besteht im freien Raum und scheitert an Wänden', () => {
    expect(hasLineOfSight(grid, 40, 80, 70, 80)).toBe(true);
    expect(hasLineOfSight(grid, 40, 80, 150, 80)).toBe(false);
  });

  it('rayDistance endet vor der Wand oder an der Maximallänge', () => {
    const d = rayDistance(grid, 48, 80, 0, 500);
    expect(d).toBeGreaterThan(30);
    expect(d).toBeLessThan(50);
    expect(rayDistance(grid, 48, 80, 0, 20)).toBe(20);
  });
});

describe('isInSector', () => {
  const origin = { x: 0, y: 0, radius: 10 };
  const at = (x: number, y: number, radius = 5) => ({ x, y, radius });

  it('trifft Ziele im Kegel und verfehlt solche dahinter oder daneben', () => {
    expect(isInSector(origin, 0, 0.75, at(30, 0), 40)).toBe(true);
    expect(isInSector(origin, 0, 0.75, at(-30, 0), 40)).toBe(false);
    expect(isInSector(origin, 0, 0.75, at(0, 30), 40)).toBe(false);
  });

  it('beachtet die Reichweite bis zum Rand des Ziels', () => {
    expect(isInSector(origin, 0, 0.75, at(44, 0, 5), 40)).toBe(true);
    expect(isInSector(origin, 0, 0.75, at(46, 0, 5), 40)).toBe(false);
  });

  it('volle Kreise ignorieren die Richtung', () => {
    expect(isInSector(origin, 1.2, Math.PI, at(-30, 0), 40)).toBe(true);
  });

  it('ein breites Ziel am Kegelrand wird noch getroffen', () => {
    // Mittelpunkt knapp außerhalb von 0.75 rad, der Rand des Ziels ragt hinein.
    const a = 0.85;
    expect(isInSector(origin, 0, 0.75, at(Math.cos(a) * 30, Math.sin(a) * 30, 8), 60)).toBe(true);
    expect(isInSector(origin, 0, 0.75, at(Math.cos(a) * 30, Math.sin(a) * 30, 1), 60)).toBe(false);
  });
});

describe('Rng.shuffle', () => {
  it('liefert eine Permutation, ohne die Eingabe zu ändern, und ist pro Seed reproduzierbar', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = createRng(5).shuffle(input);
    expect([...a].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(createRng(5).shuffle(input)).toEqual(a);
  });
});
