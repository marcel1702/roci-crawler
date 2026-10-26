import Phaser from 'phaser';
import { FOG } from '../config/constants';
import { clamp } from '../core/math';
import { ExploredMap } from '../core/fog';
import type { TileGrid } from '../core/grid';

const FOG_KEY = 'fog';
export const MINIMAP_KEY = 'minimap';
/** Nebelfarbe = Hintergrundfarbe (0x0b1020), damit Unentdecktes wie leerer Raum wirkt. */
const FOG_RGB = [11, 16, 32] as const;
const MINI_FLOOR = [92, 112, 156] as const;
const MINI_ZEROG = [128, 108, 205] as const;
const MINI_WALL = [150, 164, 196] as const;

/**
 * Nebel des Krieges: verdunkelt Unentdecktes, blendet Erinnertes ab und zeichnet die Minikarte.
 * Der Nebel ist ein Pixel pro Kachel, mit weicher Skalierung dargestellt; er liegt über allen Weltobjekten,
 * sodass Gegner und Truhen im Dunkeln unsichtbar bleiben.
 */
export class FogSystem {
  readonly explored: ExploredMap;

  private readonly fogTexture: Phaser.Textures.CanvasTexture;
  private readonly miniTexture: Phaser.Textures.CanvasTexture;
  private readonly fogImage: Phaser.GameObjects.Image;
  private lastCol = -1;
  private lastRow = -1;
  private lastExplored = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly grid: TileGrid,
    private readonly target: { x: number; y: number },
  ) {
    this.explored = new ExploredMap(grid);

    // Alte Texturen einer vorigen Mission ersetzen (erst jetzt, damit die Anzeige nie ins Leere zeigt).
    for (const key of [FOG_KEY, MINIMAP_KEY]) if (scene.textures.exists(key)) scene.textures.remove(key);
    const fog = scene.textures.createCanvas(FOG_KEY, grid.cols, grid.rows);
    const mini = scene.textures.createCanvas(MINIMAP_KEY, grid.cols, grid.rows);
    if (!fog || !mini) throw new Error('Nebel-Texturen konnten nicht erzeugt werden');
    this.fogTexture = fog;
    this.miniTexture = mini;
    mini.setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.fogImage = scene.add.image(0, 0, FOG_KEY).setOrigin(0).setScale(grid.tileSize).setDepth(60);
    this.update();
  }

  isExploredAt(x: number, y: number): boolean {
    return this.explored.isExplored(this.grid.toCol(x), this.grid.toRow(y));
  }

  /** Zu jedem Frame aufrufen; rechnet nur neu, wenn die Figur eine neue Kachel betritt. */
  update(): void {
    const col = this.grid.toCol(this.target.x);
    const row = this.grid.toRow(this.target.y);
    if (col === this.lastCol && row === this.lastRow) return;
    this.lastCol = col;
    this.lastRow = row;

    this.explored.updateVision(col, row, FOG.radiusTiles);
    this.drawFog(col, row);
    if (this.explored.exploredTotal !== this.lastExplored) {
      this.lastExplored = this.explored.exploredTotal;
      this.drawMinimap();
    }
  }

  destroy(): void {
    this.fogImage.destroy();
  }

  private drawFog(playerCol: number, playerRow: number): void {
    const { cols, rows } = this.grid;
    const ctx = this.fogTexture.context;
    const image = ctx.createImageData(cols, rows);
    const fadeStart = FOG.radiusTiles - FOG.fadeTiles;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let alpha = 255;
        if (this.explored.isVisible(col, row)) {
          const dist = Math.hypot(col - playerCol, row - playerRow);
          alpha = Math.round(clamp((dist - fadeStart) / FOG.fadeTiles, 0, 1) * FOG.rememberedAlpha);
        } else if (this.explored.isExplored(col, row)) {
          alpha = FOG.rememberedAlpha;
        }
        const i = (row * cols + col) * 4;
        image.data[i] = FOG_RGB[0];
        image.data[i + 1] = FOG_RGB[1];
        image.data[i + 2] = FOG_RGB[2];
        image.data[i + 3] = alpha;
      }
    }
    ctx.putImageData(image, 0, 0);
    this.fogTexture.refresh();
  }

  private drawMinimap(): void {
    const { cols, rows } = this.grid;
    const ctx = this.miniTexture.context;
    const image = ctx.createImageData(cols, rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!this.explored.isExplored(col, row)) continue;
        const rgb = this.grid.isZeroG(col, row) ? MINI_ZEROG : this.grid.isWalkable(col, row) ? MINI_FLOOR : this.grid.isWallEdge(col, row) ? MINI_WALL : null;
        if (!rgb) continue;
        const i = (row * cols + col) * 4;
        image.data[i] = rgb[0];
        image.data[i + 1] = rgb[1];
        image.data[i + 2] = rgb[2];
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    this.miniTexture.refresh();
  }
}
