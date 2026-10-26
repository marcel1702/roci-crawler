import Phaser from 'phaser';

const GOLD = 0xffd34d;

/** Truhe mit Beute. Öffnet sich automatisch, wenn die Figur nah genug herankommt (siehe MissionScene). */
export class Chest extends Phaser.GameObjects.Container {
  private readonly art: Phaser.GameObjects.Graphics;
  private open = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.art = new Phaser.GameObjects.Graphics(scene);
    this.add(this.art);
    scene.add.existing(this);
    this.setDepth(8);
    this.draw();
  }

  get isOpen(): boolean {
    return this.open;
  }

  markOpened(): void {
    this.open = true;
    this.draw();
  }

  private draw(): void {
    const g = this.art.clear();
    // Schatten
    g.fillStyle(0x000000, 0.35).fillEllipse(0, 8, 26, 9);
    if (this.open) {
      g.fillStyle(0x4a3220, 1).fillRect(-10, -4, 20, 11);
      g.fillStyle(0x2a1a10, 1).fillRect(-8, -3, 16, 4);
      g.fillStyle(0x6b4a2f, 1).fillRect(-10, -12, 20, 5);
      return;
    }
    g.fillStyle(0x7a5232, 1).fillRect(-10, -6, 20, 13);
    g.fillStyle(0x93653d, 1).fillRect(-10, -10, 20, 6);
    g.fillStyle(GOLD, 1).fillRect(-10, -6, 20, 2).fillRect(-2, -10, 4, 15);
    g.lineStyle(1.5, 0x000000, 0.6).strokeRect(-10, -10, 20, 17);
    // Leuchtring als Hinweis, dass hier etwas liegt
    g.lineStyle(1.5, GOLD, 0.55).strokeCircle(0, -1, 17);
  }
}
