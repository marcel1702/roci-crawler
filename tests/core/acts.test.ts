import { describe, expect, it } from 'vitest';
import { TILESET_KEYS } from '../../src/config/constants';
import { generateDungeon, roomCenterTile } from '../../src/core/dungeon';
import { planMission } from '../../src/core/encounters';
import { TILE, TileGrid } from '../../src/core/grid';
import { findPath } from '../../src/core/pathfinding';
import { createRng } from '../../src/core/rng';
import { IMPLEMENTED_ACTS, LOCATIONS_PER_ACT } from '../../src/core/story';
import { ACTS, actText } from '../../src/data/acts';
import { de } from '../../src/i18n/de';

const endingPages = Object.keys(de).filter((k) => k.startsWith('ending.page.'));

describe('Akte', () => {
  it('es gibt so viele Akte wie vorgesehen, lückenlos nummeriert, mit eigenen Boss-Seeds', () => {
    expect(ACTS).toHaveLength(IMPLEMENTED_ACTS);
    expect(ACTS.map((a) => a.id)).toEqual(ACTS.map((_, i) => i + 1));
    expect(new Set(ACTS.map((a) => a.bossSeed)).size).toBe(ACTS.length);
    for (const act of ACTS) {
      expect(TILESET_KEYS[act.tileset], `Akt ${act.id}`).toBeTruthy();
      expect(act.zeroGChance).toBeGreaterThanOrEqual(0);
      expect(act.zeroGChance + act.infectionChance).toBeLessThanOrEqual(1.2);
    }
  });

  it('jeder Akt hat alle Texte: Name, Orte, Briefings und Boss-Auftrag; die Crew kommentiert jeden Akt', () => {
    for (const act of ACTS) {
      for (const suffix of ['name', 'boss.name', 'boss.text', 'boss.action', 'boss.briefing']) {
        expect(de[actText(act.id, suffix)], `act.${act.id}.${suffix}`).toBeTruthy();
      }
      for (let n = 0; n < LOCATIONS_PER_ACT; n++) {
        expect(de[actText(act.id, `location.${n}`)], `Ort ${n} in Akt ${act.id}`).toBeTruthy();
        expect(de[actText(act.id, `briefing.${n}`)], `Briefing ${n} in Akt ${act.id}`).toBeTruthy();
      }
      for (const member of ['amos', 'naomi', 'bobbie', 'holden']) {
        expect(de[`crew.${member}.act${act.id}` as keyof typeof de], `${member} nach Akt ${act.id}`).toBeTruthy();
      }
    }
  });

  it('spätere Akte sind schwerer vorgesehen (höhere Grundstufe) und haben mehr Besonderheiten', () => {
    const levels = ACTS.map((a) => a.baseLevel);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    const act2 = ACTS[1];
    if (act2) {
      expect(act2.zeroGChance).toBeGreaterThan(ACTS[0]!.zeroGChance);
      expect(act2.infectionChance).toBeGreaterThan(0);
      expect(act2.bossRoomZeroG).toBe(true);
    }
  });
});

describe('Abspann', () => {
  it('hat Erzählseiten (lückenlos nummeriert) und alle Texte der letzten Seite', () => {
    // So viele Seiten blättert `EndingScene` (PAGES) durch; beide müssen zusammenpassen.
    expect(endingPages).toHaveLength(5);
    endingPages.forEach((_, i) => expect(de[`ending.page.${i + 1}` as keyof typeof de], `Seite ${i + 1}`).toBeTruthy());
    for (const key of ['ending.next', 'ending.thanks', 'ending.credits', 'ending.continue', 'ending.back'] as const) expect(de[key], key).toBeTruthy();
  });

  it('weist auf das nicht-kommerzielle Fanprojekt hin', () => {
    expect(de['ending.credits']).toMatch(/nicht-kommerziell/);
    expect(de['ending.credits']).toMatch(/Fanprojekt/);
  });
});

describe('Wucherung im Dungeon', () => {
  const count = (grid: TileGrid, id: number): number => grid.toRowsOfIds().flat().filter((v) => v === id).length;

  it('markInfected färbt nur normalen Boden, keine Wand und keinen schwerelosen Boden', () => {
    const cells = new Uint8Array(7 * 7).fill(TILE.floor);
    cells[3 * 7 + 3] = TILE.wall;
    cells[3 * 7 + 4] = TILE.zeroG;
    const grid = new TileGrid(7, 7, 32, cells);
    grid.markInfected(3, 3, 2);
    expect(grid.get(3, 3)).toBe(TILE.wall);
    expect(grid.get(4, 3)).toBe(TILE.zeroG);
    expect(grid.isInfected(2, 3)).toBe(true);
    expect(grid.isWalkable(2, 3)).toBe(true);
    expect(grid.isInfected(6, 6)).toBe(false);
  });

  it('ohne Wahrscheinlichkeit gibt es keine Wucherung; mit 1 jeder Kampf- und Schatzraum ohne Schwerkraft, nie Start oder Ausgang', () => {
    for (let seed = 0; seed < 60; seed++) {
      expect(count(generateDungeon(seed, 32).grid, TILE.infected), `Seed ${seed}`).toBe(0);

      const all = generateDungeon(seed, 32, { infectionChance: 1 });
      for (const room of all.rooms) {
        expect(room.infected).toBe(room.role === 'combat' || room.role === 'treasure');
        const tiles: number[] = [];
        for (let r = room.y; r < room.y + room.h; r++) for (let c = room.x; c < room.x + room.w; c++) tiles.push(all.grid.get(c, r));
        expect(tiles.includes(TILE.infected), `Seed ${seed} Raum ${room.id}`).toBe(room.infected);
      }
    }
  });

  it('Schwerelosigkeit und Wucherung schließen sich im selben Raum aus; die Raummitte bleibt sauber', () => {
    for (let seed = 0; seed < 80; seed++) {
      const d = generateDungeon(seed, 32, { zeroGChance: 0.5, infectionChance: 1 });
      for (const room of d.rooms) {
        expect(room.zeroG && room.infected, `Seed ${seed}`).toBe(false);
        if (room.infected) {
          const c = roomCenterTile(room);
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) expect(d.grid.isInfected(c.col + dc, c.row + dr)).toBe(false);
        }
      }
    }
  });

  it('die Karte und die Gegnerverteilung hängen nicht von der Wucherung ab; Seeds bleiben lösbar', () => {
    for (let seed = 0; seed < 80; seed++) {
      const plain = generateDungeon(seed, 32);
      const grown = generateDungeon(seed, 32, { infectionChance: 0.8 });
      expect(plain.rooms.map((r) => [r.x, r.y, r.w, r.h])).toEqual(grown.rooms.map((r) => [r.x, r.y, r.w, r.h]));
      for (let r = 0; r < plain.grid.rows; r++) for (let c = 0; c < plain.grid.cols; c++) expect(plain.grid.isSolid(c, r)).toBe(grown.grid.isSolid(c, r));

      const plan = planMission(grown, ACTS[1]!.spawns, createRng(seed));
      expect(findPath(grown.grid, plan.playerStart, plan.exit, 11), `Seed ${seed}`).not.toBeNull();
    }
  });

  it('der Bossraum kann schwerelos sein (nur auf Wunsch), nie Start', () => {
    for (let seed = 0; seed < 40; seed++) {
      const d = generateDungeon(seed, 32, { bossRoomZeroG: true });
      for (const room of d.rooms) expect(room.zeroG).toBe(room.role === 'exit');
    }
  });
});
