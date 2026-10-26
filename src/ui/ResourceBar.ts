import Phaser from 'phaser';
import { COLORS } from '../config/palette';

/** Waagerechter Balken (Leben usw.), vektorgezeichnet und damit in jeder Auflösung scharf. */
export class ResourceBar {
  readonly graphics: Phaser.GameObjects.Graphics;
  private x = 0;
  private y = 0;
  private width = 100;
  private height = 10;
  private fraction = 1;

  constructor(
    scene: Phaser.Scene,
    private readonly fillColor: number,
  ) {
    this.graphics = scene.add.graphics();
  }

  setLayout(x: number, y: number, width: number, height: number): void {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.redraw();
  }

  setFraction(fraction: number): void {
    const clamped = Phaser.Math.Clamp(fraction, 0, 1);
    if (clamped === this.fraction) return;
    this.fraction = clamped;
    this.redraw();
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  private redraw(): void {
    const { x, y, width, height } = this;
    const radius = Math.min(height / 2, 6);
    const g = this.graphics.clear();
    g.fillStyle(COLORS.hpBack, 0.85).fillRoundedRect(x, y, width, height, radius);
    if (this.fraction > 0) {
      g.fillStyle(this.fillColor, 1).fillRoundedRect(x, y, Math.max(width * this.fraction, radius * 2), height, radius);
    }
    g.lineStyle(Math.max(1, height / 10), COLORS.hpFrame, 0.8).strokeRoundedRect(x, y, width, height, radius);
  }
}
