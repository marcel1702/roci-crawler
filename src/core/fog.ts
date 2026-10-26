import type { TileGrid } from './grid';

const RAYS = 144;
const RAY_STEP = 0.5;

/**
 * Entdeckte Teile der Karte (Nebel des Krieges). `visible` ist, was die Figur gerade sieht,
 * `explored` alles, was sie je gesehen hat.
 */
export class ExploredMap {
  private readonly exploredTiles: Uint8Array;
  private visibleTiles: Uint8Array;
  private exploredCount = 0;

  constructor(private readonly grid: TileGrid) {
    this.exploredTiles = new Uint8Array(grid.cols * grid.rows);
    this.visibleTiles = new Uint8Array(grid.cols * grid.rows);
  }

  /** Anzahl entdeckter Kacheln; steigt nur, damit Beobachter erkennen, ob sich die Minikarte ändern muss. */
  get exploredTotal(): number {
    return this.exploredCount;
  }

  isExplored(col: number, row: number): boolean {
    return this.grid.inBounds(col, row) && this.exploredTiles[row * this.grid.cols + col] === 1;
  }

  isVisible(col: number, row: number): boolean {
    return this.grid.inBounds(col, row) && this.visibleTiles[row * this.grid.cols + col] === 1;
  }

  /** Berechnet die Sicht aus der Kachel (col,row) mit Reichweite `radius` (Kacheln); Wände halten Strahlen auf. */
  updateVision(col: number, row: number, radius: number): void {
    this.visibleTiles.fill(0);
    const ox = col + 0.5;
    const oy = row + 0.5;

    this.mark(col, row);
    for (let i = 0; i < RAYS; i++) {
      const angle = (i / RAYS) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      for (let t = RAY_STEP; t <= radius; t += RAY_STEP) {
        const c = Math.floor(ox + dx * t);
        const r = Math.floor(oy + dy * t);
        if (!this.grid.inBounds(c, r)) break;
        this.mark(c, r);
        if (this.grid.isSolid(c, r)) break;
      }
    }
  }

  private mark(col: number, row: number): void {
    const index = row * this.grid.cols + col;
    this.visibleTiles[index] = 1;
    if (this.exploredTiles[index] === 0) {
      this.exploredTiles[index] = 1;
      this.exploredCount++;
    }
  }
}
