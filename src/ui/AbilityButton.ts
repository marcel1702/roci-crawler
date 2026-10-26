import Phaser from 'phaser';
import { COLORS } from '../config/palette';

/**
 * Runder Fähigkeiten-Button am Bildschirmrand. In Meilenstein 1 nur Platzhalter (gesperrt),
 * damit Layout und "Tipp auf HUD darf nicht laufen lassen" früh feststehen.
 */
export class AbilityButton {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private x = 0;
  private y = 0;
  private radius = 30;

  constructor(
    scene: Phaser.Scene,
    labelText: string,
    private readonly accent: number,
  ) {
    this.graphics = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, labelText, { fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#7d8aa8' })
      .setOrigin(0.5);
  }

  layout(x: number, y: number, radius: number): void {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.label.setPosition(x, y).setFontSize(Math.round(radius * 0.7));
    this.graphics
      .clear()
      .fillStyle(COLORS.uiPanel, 0.55)
      .fillCircle(x, y, radius)
      .lineStyle(Math.max(2, radius / 12), this.accent, 0.35)
      .strokeCircle(x, y, radius);
  }

  /** Treffertest in Bildschirmkoordinaten; `pad` vergrößert die Fläche für ungenaue Finger. */
  contains(px: number, py: number, pad = 0): boolean {
    return Math.hypot(px - this.x, py - this.y) <= this.radius + pad;
  }
}
