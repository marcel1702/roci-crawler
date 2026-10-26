import Phaser from 'phaser';
import { TAP, TEXTURE_KEYS, TEXTURE_SCALE } from '../config/constants';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';

type DragMode = 'move' | 'attack';

/**
 * Touch- und Maussteuerung der Spielwelt:
 * - Tippen auf den Boden: dorthin laufen. Finger gehalten und bewegt: Ziel läuft mit.
 * - Tippen auf einen Gegner: hinlaufen und angreifen, bis er tot ist.
 * Tipps auf HUD-Elemente werden über `isOverUi` herausgefiltert.
 */
export class TapControlSystem {
  private activePointerId: number | null = null;
  private dragMode: DragMode = 'move';
  private lastDragMs = 0;
  private readonly marker: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly getEnemies: () => readonly Enemy[],
    private readonly isOverUi: (screenX: number, screenY: number) => boolean,
  ) {
    this.marker = scene.add.image(0, 0, TEXTURE_KEYS.moveMarker).setScale(TEXTURE_SCALE).setDepth(5).setAlpha(0);

    scene.input.addPointer(2); // Mehrfingerbedienung: Laufen und HUD-Tasten gleichzeitig
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.player.isDead || this.activePointerId !== null || this.isOverUi(pointer.x, pointer.y)) return;

    const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    const enemy = this.pickEnemy(world.x, world.y);
    if (enemy) {
      this.dragMode = 'attack';
      this.player.commandAttack(enemy);
    } else {
      this.dragMode = 'move';
      this.moveTo(world.x, world.y);
    }
    this.activePointerId = pointer.id;
    this.lastDragMs = this.scene.time.now;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointerId || !pointer.isDown || this.dragMode !== 'move') return;
    if (this.player.isDead || this.scene.time.now - this.lastDragMs < TAP.dragRepathMs) return;

    this.lastDragMs = this.scene.time.now;
    const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    this.moveTo(world.x, world.y);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.activePointerId) this.activePointerId = null;
  }

  private moveTo(x: number, y: number): void {
    if (this.player.commandMoveTo(x, y)) this.showMarker(x, y);
  }

  private pickEnemy(worldX: number, worldY: number): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const enemy of this.getEnemies()) {
      if (enemy.isDead) continue;
      const dist = Phaser.Math.Distance.Between(worldX, worldY, enemy.x, enemy.y);
      if (dist <= enemy.radius + TAP.enemySlop && dist < bestDist) {
        best = enemy;
        bestDist = dist;
      }
    }
    return best;
  }

  private showMarker(x: number, y: number): void {
    this.scene.tweens.killTweensOf(this.marker);
    this.marker.setPosition(x, y).setAlpha(1).setScale(TEXTURE_SCALE * 1.3);
    this.scene.tweens.add({
      targets: this.marker,
      alpha: 0,
      scale: TEXTURE_SCALE * 0.6,
      duration: 380,
      ease: 'Quad.easeOut',
    });
  }

  private destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }
}
