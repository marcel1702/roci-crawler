import Phaser from 'phaser';
import { COLORS } from '../config/palette';
import { TEXTURE_KEYS, TEXTURE_SCALE, TAP } from '../config/constants';
import { isInReach } from '../core/combat';
import { findPath } from '../core/pathfinding';
import type { EnemyDef } from '../data/types';
import { Actor } from './Actor';
import type { Player } from './Player';
import type { WorldContext } from './WorldContext';

const REPATH_SECONDS = 0.35;
const DEATH_FADE_MS = 260;
const HP_BAR = { width: 28, height: 4 } as const;

type EnemyState = 'idle' | 'chase';

/** Einfacher Nahkämpfer: wartet, bis der Spieler nah genug ist, verfolgt ihn und schlägt zu. */
export class Enemy extends Actor {
  readonly team = 'enemy';

  private aiState: EnemyState = 'idle';
  private repathTimer = 0;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private readonly targetRing: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    world: WorldContext,
    x: number,
    y: number,
    readonly def: EnemyDef,
  ) {
    super(scene, world, x, y, def.stats, def.id);

    this.targetRing = new Phaser.GameObjects.Image(scene, 0, 0, TEXTURE_KEYS.targetRing);
    this.targetRing.setScale(TEXTURE_SCALE).setVisible(false);
    this.hpBar = new Phaser.GameObjects.Graphics(scene).setVisible(false);
    // Der Zielring liegt unter der Figur.
    this.addAt(this.targetRing, 1);
    this.add(this.hpBar);
  }

  setTargeted(targeted: boolean): void {
    if (this.active) this.targetRing.setVisible(targeted);
  }

  tick(dt: number, player: Player): void {
    if (this.isDead) return;
    this.tickTimers(dt);
    if (player.isDead) {
      this.follower.clear();
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (this.aiState === 'idle') {
      if (dist > this.def.aggroRange) return;
      this.aiState = 'chase';
    } else if (dist > this.def.leashRange) {
      this.aiState = 'idle';
      this.follower.clear();
      return;
    }

    if (isInReach(this, player, this.stats.attackRange)) {
      this.follower.clear();
      this.faceToward(player.x, player.y);
      this.tryAttack(player);
      return;
    }

    this.repathTimer -= dt;
    if (this.repathTimer <= 0 || !this.follower.active) {
      this.repathTimer = REPATH_SECONDS;
      const path = findPath(this.world.grid, this, player, this.radius, TAP.snapTiles);
      if (path) this.follower.setPath(path);
    }
    this.followPath(dt);
  }

  protected override onDamaged(): void {
    // Wer getroffen wird, bemerkt den Spieler auch außerhalb der Aggro-Reichweite.
    this.aiState = 'chase';
    this.drawHpBar();
  }

  protected override onDeath(): void {
    this.setTargeted(false);
    this.hpBar.setVisible(false);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.6,
      duration: DEATH_FADE_MS,
      onComplete: () => this.destroy(),
    });
  }

  private drawHpBar(): void {
    const { width, height } = HP_BAR;
    const x = -width / 2;
    const y = -this.radius - 10;
    this.hpBar.clear().setVisible(true);
    this.hpBar.fillStyle(COLORS.hpBack, 0.9).fillRect(x - 1, y - 1, width + 2, height + 2);
    this.hpBar.fillStyle(COLORS.hpFill, 1).fillRect(x, y, width * (this.hp / this.stats.maxHp), height);
  }
}
