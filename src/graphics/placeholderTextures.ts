import Phaser from 'phaser';
import { COLORS } from '../config/palette';
import { actorTextureKey, TEXTURE_KEYS, TEXTURE_RES, TILE_SIZE, TILESET_KEYS } from '../config/constants';
import type { Tileset } from '../config/constants';
import { CLASSES, CLASS_LIST } from '../data/classes';
import { ALLIES } from '../data/allies';
import { ENEMIES } from '../data/enemies';

/**
 * Erzeugt alle Platzhalter-Texturen zur Laufzeit aus einfachen Formen. Gezeichnet wird in Welt-Pixeln,
 * die Textur ist TEXTURE_RES-mal so groß. Echte Grafik ersetzt später nur diese Datei.
 */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  for (const tileset of Object.keys(PALETTES) as Tileset[]) createTileset(scene, TILESET_KEYS[tileset], PALETTES[tileset]);
  createShadow(scene);
  createRing(scene, TEXTURE_KEYS.targetRing, 17, 2.2, COLORS.accent, 0.95);
  createRing(scene, TEXTURE_KEYS.moveMarker, 11, 2.5, 0xffffff, 0.9);

  createProjectile(scene);

  // Alle vier Figuren (für Auswahl und Besatzung im Hub); der Radius entspricht dem spielbaren Amos.
  for (const info of CLASS_LIST) createActor(scene, info.id, info.color, CLASSES.amos.stats.radius, false);
  // Verbündete mit eigener Figur (die Crew nutzt die Klassen-Texturen).
  createActor(scene, ALLIES.drone.textureId, 0x7fe0ff, ALLIES.drone.radius, false);
  for (const def of Object.values(ENEMIES)) {
    createActor(scene, def.id, def.color, def.stats.radius, 'elite' in def && def.elite === true);
  }
}

function drawTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.make.graphics({}, false);
  g.setScale(TEXTURE_RES);
  draw(g);
  g.generateTexture(key, width * TEXTURE_RES, height * TEXTURE_RES);
  g.destroy();
}

/** Farben eines Kachelsatzes. */
interface TilePalette {
  floor: number;
  floorLine: number;
  wall: number;
  wallLight: number;
  wallDark: number;
  /** Wucherung (nur im Streifen, auf allen Welten gleich erkennbar grün). */
  infected: number;
  infectedBlob: number;
}

const PALETTES: Record<Tileset, TilePalette> = {
  ceres: {
    floor: COLORS.floor,
    floorLine: COLORS.floorLine,
    wall: COLORS.wall,
    wallLight: COLORS.wallLight,
    wallDark: COLORS.wallDark,
    infected: 0x23401c,
    infectedBlob: 0x6fbf3f,
  },
  ganymede: {
    floor: 0x1a2438,
    floorLine: 0x2b3a58,
    wall: 0x6a7a96,
    wallLight: 0x93a4c2,
    wallDark: 0x414e66,
    infected: 0x23401c,
    infectedBlob: 0x6fbf3f,
  },
  eros: {
    floor: 0x16302c,
    floorLine: 0x1f4540,
    wall: 0x4c6158,
    wallLight: 0x6f8a7e,
    wallDark: 0x2e3f38,
    infected: 0x2f4f1d,
    infectedBlob: 0x8bd94d,
  },
};

/** Streifen mit vier Kacheln: Index 0 = Boden, 1 = Wand, 2 = schwereloser Boden, 3 = infizierter Boden. */
function createTileset(scene: Phaser.Scene, key: string, palette: TilePalette): void {
  const s = TILE_SIZE;
  drawTexture(scene, key, s * 4, s, (g) => {
    // Boden
    g.fillStyle(palette.floor, 1).fillRect(0, 0, s, s);
    g.lineStyle(1, palette.floorLine, 1).strokeRect(0.5, 0.5, s - 1, s - 1);
    g.fillStyle(palette.floorLine, 1).fillRect(s / 2 - 1, s / 2 - 1, 2, 2);

    // Wand
    const x = s;
    g.fillStyle(palette.wall, 1).fillRect(x, 0, s, s);
    g.fillStyle(palette.wallLight, 1).fillRect(x, 0, s, 3).fillRect(x, 0, 3, s);
    g.fillStyle(palette.wallDark, 1).fillRect(x, s - 3, s, 3).fillRect(x + s - 3, 0, 3, s);
    g.fillStyle(palette.wallDark, 1);
    for (const [px, py] of [
      [6, 6],
      [s - 6, 6],
      [6, s - 6],
      [s - 6, s - 6],
    ] as const) {
      g.fillCircle(x + px, py, 1.6);
    }

    // Schwereloser Boden: violett, mit diagonalem Raster, damit er auch ohne Farbe erkennbar bleibt.
    const z = s * 2;
    g.fillStyle(COLORS.floorZeroG, 1).fillRect(z, 0, s, s);
    g.lineStyle(1, COLORS.floorZeroGLine, 1).strokeRect(z + 0.5, 0.5, s - 1, s - 1);
    g.lineStyle(1, COLORS.floorZeroGLine, 0.5);
    g.lineBetween(z + 3, 3, z + s - 3, s - 3).lineBetween(z + s - 3, 3, z + 3, s - 3);
    g.fillStyle(COLORS.floorZeroGLine, 1).fillCircle(z + s / 2, s / 2, 1.6);

    // Wucherung: dunkles Grün mit hellen Flecken und Adern, ohne Gitterlinien (wirkt zusammenhängend, wenn Kacheln aneinandergrenzen).
    const i = s * 3;
    g.fillStyle(palette.infected, 1).fillRect(i, 0, s, s);
    g.fillStyle(palette.infectedBlob, 0.5);
    for (const [px, py, r] of [
      [8, 9, 5],
      [21, 7, 3.5],
      [15, 20, 6],
      [26, 25, 3],
      [6, 26, 3.5],
    ] as const) {
      g.fillCircle(i + px, py, r);
    }
    g.lineStyle(1.5, palette.infectedBlob, 0.7);
    g.lineBetween(i + 2, s - 4, i + 12, 16).lineBetween(i + 12, 16, i + 18, 4).lineBetween(i + 18, 4, i + s - 2, 8);
    g.lineBetween(i + 12, 16, i + s - 3, 22);
  });
}

function createShadow(scene: Phaser.Scene): void {
  drawTexture(scene, TEXTURE_KEYS.shadow, 32, 20, (g) => {
    g.fillStyle(0x000000, 0.35).fillEllipse(16, 10, 26, 13);
  });
}

function createRing(
  scene: Phaser.Scene,
  key: string,
  radius: number,
  lineWidth: number,
  color: number,
  alpha: number,
): void {
  const size = Math.ceil((radius + lineWidth) * 2) + 2;
  drawTexture(scene, key, size, size, (g) => {
    g.lineStyle(lineWidth, color, alpha).strokeCircle(size / 2, size / 2, radius);
  });
}

/** Runde Figur mit Nase nach rechts (+x); gedreht wird beim Zeichnen die Blickrichtung. Elite: goldener Rand. */
function createActor(scene: Phaser.Scene, id: string, color: number, radius: number, elite: boolean): void {
  const size = Math.ceil((radius + 9) * 2);
  const c = size / 2;
  drawTexture(scene, actorTextureKey(id), size, size, (g) => {
    g.fillStyle(elite ? 0xffd34d : 0x000000, elite ? 0.95 : 0.55).fillCircle(c, c, radius + 2);
    g.fillStyle(0x000000, 0.55).fillCircle(c, c, radius + 0.5);
    g.fillStyle(color, 1).fillCircle(c, c, radius - 0.5);
    g.fillStyle(0xffffff, 0.22).fillCircle(c - radius * 0.3, c - radius * 0.3, radius * 0.5);
    g.fillStyle(0xffffff, 0.9).fillTriangle(c + radius - 3, c - 4.5, c + radius + 5, c, c + radius - 3, c + 4.5);
  });
}

function createProjectile(scene: Phaser.Scene): void {
  drawTexture(scene, TEXTURE_KEYS.projectile, 14, 14, (g) => {
    g.fillStyle(0xffb347, 0.35).fillCircle(7, 7, 6);
    g.fillStyle(0xffe08a, 1).fillCircle(7, 7, 3.2);
    g.fillStyle(0xffffff, 1).fillCircle(7, 7, 1.6);
  });
}
