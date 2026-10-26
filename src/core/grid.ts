import type { Vec2 } from './math';

export const TILE = { floor: 0, wall: 1 } as const;
export type TileId = (typeof TILE)[keyof typeof TILE];

/** Kachelraster der Spielwelt. Alles außerhalb des Rasters zählt als Wand. */
export class TileGrid {
  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly tileSize: number,
    private readonly cells: Uint8Array,
  ) {
    if (cells.length !== cols * rows) {
      throw new Error(`Rastergröße passt nicht: ${cells.length} Zellen für ${cols}x${rows}`);
    }
  }

  get widthPx(): number {
    return this.cols * this.tileSize;
  }

  get heightPx(): number {
    return this.rows * this.tileSize;
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  get(col: number, row: number): TileId {
    return this.inBounds(col, row) ? (this.cells[row * this.cols + col] as TileId) : TILE.wall;
  }

  isSolid(col: number, row: number): boolean {
    return this.get(col, row) === TILE.wall;
  }

  isWalkable(col: number, row: number): boolean {
    return !this.isSolid(col, row);
  }

  toCol(worldX: number): number {
    return Math.floor(worldX / this.tileSize);
  }

  toRow(worldY: number): number {
    return Math.floor(worldY / this.tileSize);
  }

  tileCenter(col: number, row: number): Vec2 {
    return { x: (col + 0.5) * this.tileSize, y: (row + 0.5) * this.tileSize };
  }

  /** Zeilenweise Kachel-IDs, z. B. als Daten für eine Phaser-Tilemap. */
  toRowsOfIds(): TileId[][] {
    const result: TileId[][] = [];
    for (let row = 0; row < this.rows; row++) {
      result.push(Array.from(this.cells.subarray(row * this.cols, (row + 1) * this.cols)) as TileId[]);
    }
    return result;
  }
}
