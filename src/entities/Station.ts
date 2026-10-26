import Phaser from 'phaser';
import { COLORS } from '../config/palette';
import { t } from '../i18n';
import type { TextKey } from '../i18n';

export type StationKind = 'missions' | 'locker' | 'trader' | 'terminal';

export const STATION_INTERACT_RADIUS = 38;

/** Bedienbare Station im Hub: Symbol, Beschriftung und ein pulsierender Ring. */
export class Station extends Phaser.GameObjects.Container {
  private readonly glow: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly kind: StationKind,
  ) {
    super(scene, x, y);
    this.glow = new Phaser.GameObjects.Graphics(scene);
    const icon = new Phaser.GameObjects.Graphics(scene);
    this.drawIcon(icon);

    const label = new Phaser.GameObjects.Text(scene, 0, 24, t(`hub.station.${kind}` as TextKey), {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#dbe4f5',
      stroke: '#000000',
      strokeThickness: 3,
    });
    label.setOrigin(0.5, 0).setResolution(Math.ceil(scene.cameras.main.zoom));
    this.add([this.glow, icon, label]);

    scene.add.existing(this);
    this.setDepth(8);
  }

  tick(timeMs: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 380);
    this.glow.clear().lineStyle(2, COLORS.accent, 0.35 + 0.4 * pulse).strokeCircle(0, 0, 21 + 2 * pulse);
    this.glow.fillStyle(COLORS.accent, 0.08 + 0.07 * pulse).fillCircle(0, 0, 20);
  }

  private drawIcon(g: Phaser.GameObjects.Graphics): void {
    const c = 0xffffff;
    g.fillStyle(0x000000, 0.45).fillCircle(0, 0, 17);
    g.lineStyle(2, c, 0.95).fillStyle(c, 0.95);
    switch (this.kind) {
      case 'missions': // Planet mit Ring
        g.strokeCircle(0, 0, 7);
        g.strokeEllipse(0, 0, 22, 8);
        break;
      case 'locker': // Spind mit Griff
        g.strokeRect(-6, -10, 12, 20);
        g.lineBetween(0, -10, 0, 10);
        g.fillCircle(-3, 0, 1.2).fillCircle(3, 0, 1.2);
        break;
      case 'trader': // Münzen
        g.strokeCircle(-4, 3, 6).strokeCircle(5, -3, 6);
        break;
      case 'terminal': // Bildschirm
        g.strokeRect(-9, -8, 18, 12);
        g.lineBetween(0, 4, 0, 9).lineBetween(-5, 9, 5, 9);
        break;
    }
  }
}
