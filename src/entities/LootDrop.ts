import Phaser from 'phaser';
import { LOOT } from '../config/constants';
import { COLORS } from '../config/palette';
import type { Item } from '../core/items';
import { itemName } from '../i18n/items';

/** Beute am Boden: farbiger Kristall in der Farbe der Seltenheit. Ab "selten" mit Namensschild, ab "episch" mit Lichtsäule. */
export class LootDrop extends Phaser.GameObjects.Container {
  /** Wann zuletzt vor vollem Rucksack gewarnt wurde (Szenenzeit, ms). */
  lastFullWarningMs = -Infinity;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly item: Item,
  ) {
    super(scene, x, y);
    const color = COLORS.rarity[item.rarity];
    const rank = ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(item.rarity);

    const art = new Phaser.GameObjects.Graphics(scene);
    art.fillStyle(0x000000, 0.35).fillEllipse(0, 7, 18, 6);
    if (rank >= 3) {
      art.fillStyle(color, 0.16).fillRect(-5, -60, 10, 62);
      art.fillStyle(color, 0.28).fillRect(-2, -60, 4, 62);
    }
    art.fillStyle(color, 1).fillPoints(
      [
        { x: 0, y: -9 },
        { x: 7, y: 0 },
        { x: 0, y: 8 },
        { x: -7, y: 0 },
      ],
      true,
    );
    art.lineStyle(1.5, 0xffffff, 0.8).strokePoints(
      [
        { x: 0, y: -9 },
        { x: 7, y: 0 },
        { x: 0, y: 8 },
        { x: -7, y: 0 },
      ],
      true,
    );
    this.add(art);

    if (rank >= 2) {
      const label = new Phaser.GameObjects.Text(scene, 0, -16, itemName(item), {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: `#${color.toString(16).padStart(6, '0')}`,
        stroke: '#000000',
        strokeThickness: 3,
      });
      label.setOrigin(0.5, 1).setResolution(Math.ceil(scene.cameras.main.zoom));
      this.add(label);
    }

    scene.add.existing(this);
    this.setDepth(8);
    scene.tweens.add({ targets: art, y: -2.5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Lässt die Beute von `from` aus an ihren Platz springen. */
  popFrom(fromX: number, fromY: number): void {
    const targetX = this.x;
    const targetY = this.y;
    this.setPosition(fromX, fromY);
    this.scene.tweens.add({ targets: this, x: targetX, y: targetY, duration: 260, ease: 'Cubic.easeOut' });
  }

  static randomOffset(rng: { next(): number }): { x: number; y: number } {
    const angle = rng.next() * Math.PI * 2;
    return { x: Math.cos(angle) * LOOT.popDistance, y: Math.sin(angle) * LOOT.popDistance };
  }
}
