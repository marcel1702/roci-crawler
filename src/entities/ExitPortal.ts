import Phaser from 'phaser';
import { COLORS } from '../config/palette';

const RADIUS = 20;

/** Luftschleuse am Ende der Mission: gesperrt, solange die Wächter leben; danach offen. */
export class ExitPortal extends Phaser.GameObjects.Container {
  private readonly art: Phaser.GameObjects.Graphics;
  private open = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.art = new Phaser.GameObjects.Graphics(scene);
    this.add(this.art);
    scene.add.existing(this);
    this.setDepth(7);
    this.draw(0);
  }

  get isOpen(): boolean {
    return this.open;
  }

  unlock(): void {
    this.open = true;
  }

  tick(timeMs: number): void {
    this.draw(timeMs);
  }

  private draw(timeMs: number): void {
    const g = this.art.clear();
    const color = this.open ? COLORS.exitOpen : COLORS.exitLocked;
    const pulse = this.open ? 0.5 + 0.35 * Math.sin(timeMs / 260) : 0.55;

    g.fillStyle(0x000000, 0.5).fillCircle(0, 0, RADIUS + 3);
    g.fillStyle(color, this.open ? 0.28 + 0.12 * Math.sin(timeMs / 260) : 0.14).fillCircle(0, 0, RADIUS);
    g.lineStyle(3, color, pulse + 0.3).strokeCircle(0, 0, RADIUS);
    g.lineStyle(2, color, 0.8).strokeCircle(0, 0, RADIUS * 0.55);
    if (!this.open) {
      g.lineStyle(3, color, 0.9).lineBetween(-7, -7, 7, 7).lineBetween(-7, 7, 7, -7);
    } else {
      g.fillStyle(color, 0.9).fillCircle(0, 0, 4);
    }
  }
}
