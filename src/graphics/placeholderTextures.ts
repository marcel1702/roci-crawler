import Phaser from 'phaser';
import { COLORS } from '../config/palette';
import { actorTextureKey, TEXTURE_KEYS, TEXTURE_RES, TILE_SIZE } from '../config/constants';
import { CLASSES, CLASS_LIST } from '../data/classes';
import { ALLIES } from '../data/allies';
import { ENEMIES } from '../data/enemies';

/**
 * Erzeugt alle Platzhalter-Texturen zur Laufzeit aus einfachen Formen. Gezeichnet wird in Welt-Pixeln,
 * die Textur ist TEXTURE_RES-mal so groß. Echte Grafik ersetzt später nur diese Datei.
 */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  createTileset(scene);
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

/** Streifen mit zwei Kacheln: Index 0 = Boden, Index 1 = Wand. */
function createTileset(scene: Phaser.Scene): void {
  const s = TILE_SIZE;
  drawTexture(scene, TEXTURE_KEYS.tiles, s * 2, s, (g) => {
    // Boden
    g.fillStyle(COLORS.floor, 1).fillRect(0, 0, s, s);
    g.lineStyle(1, COLORS.floorLine, 1).strokeRect(0.5, 0.5, s - 1, s - 1);
    g.fillStyle(COLORS.floorLine, 1).fillRect(s / 2 - 1, s / 2 - 1, 2, 2);

    // Wand
    const x = s;
    g.fillStyle(COLORS.wall, 1).fillRect(x, 0, s, s);
    g.fillStyle(COLORS.wallLight, 1).fillRect(x, 0, s, 3).fillRect(x, 0, 3, s);
    g.fillStyle(COLORS.wallDark, 1).fillRect(x, s - 3, s, 3).fillRect(x + s - 3, 0, 3, s);
    g.fillStyle(COLORS.wallDark, 1);
    for (const [px, py] of [
      [6, 6],
      [s - 6, 6],
      [6, s - 6],
      [s - 6, s - 6],
    ] as const) {
      g.fillCircle(x + px, py, 1.6);
    }
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
