import Phaser from 'phaser';
import { actorTextureKey, TEXTURE_KEYS, TEXTURE_SCALE } from '../config/constants';
import { moveCircle } from '../core/collision';
import { isInReach } from '../core/combat';
import { Cooldown } from '../core/cooldown';
import { PathFollower } from '../core/follower';
import type { ActorStats } from '../data/types';
import type { WorldContext } from './WorldContext';

/** Läuft ein Akteur weniger als diesen Anteil seiner Sollstrecke, gilt er als blockiert. */
const STUCK_RATIO = 0.2;
const STUCK_SECONDS = 0.35;
const HIT_FLASH_MS = 70;

export type Team = 'player' | 'enemy';

/** Basis für Spielerfigur und Gegner: Lebenspunkte, Wandkollision, Wegverfolgung und Nahkampf. */
export abstract class Actor extends Phaser.GameObjects.Container {
  abstract readonly team: Team;

  readonly stats: ActorStats;
  hp: number;

  protected readonly follower = new PathFollower();
  protected readonly attackCooldown = new Cooldown();
  protected readonly sprite: Phaser.GameObjects.Image;

  private dead = false;
  private stuckSeconds = 0;

  protected constructor(
    scene: Phaser.Scene,
    protected readonly world: WorldContext,
    x: number,
    y: number,
    stats: ActorStats,
    textureId: string,
  ) {
    super(scene, x, y);
    this.stats = stats;
    this.hp = stats.maxHp;

    const shadow = new Phaser.GameObjects.Image(scene, 0, stats.radius * 0.45, TEXTURE_KEYS.shadow);
    shadow.setScale(TEXTURE_SCALE);
    this.sprite = new Phaser.GameObjects.Image(scene, 0, 0, actorTextureKey(textureId));
    this.sprite.setScale(TEXTURE_SCALE);
    this.add([shadow, this.sprite]);

    scene.add.existing(this);
    this.setDepth(10);
  }

  get radius(): number {
    return this.stats.radius;
  }

  get isDead(): boolean {
    return this.dead;
  }

  faceToward(x: number, y: number): void {
    this.sprite.rotation = Math.atan2(y - this.y, x - this.x);
  }

  /** Bewegt mit Wandkollision und liefert die tatsächlich zurückgelegte Strecke. */
  moveBy(dx: number, dy: number): number {
    const result = moveCircle(this.world.grid, this.x, this.y, this.radius, dx, dy);
    const moved = Math.hypot(result.x - this.x, result.y - this.y);
    this.setPosition(result.x, result.y);
    return moved;
  }

  takeDamage(amount: number): void {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - amount);
    this.flashHit();
    this.onDamaged();
    if (this.hp === 0) {
      this.dead = true;
      this.follower.clear();
      this.onDeath();
    }
  }

  protected onDamaged(): void {}

  protected abstract onDeath(): void;

  protected tickTimers(dt: number): void {
    this.attackCooldown.update(dt * 1000);
  }

  /** Greift an, wenn das Ziel in Reichweite und die Abklingzeit vorbei ist. */
  protected tryAttack(target: Actor): boolean {
    if (!this.attackCooldown.ready || !isInReach(this, target, this.stats.attackRange)) return false;
    this.attackCooldown.trigger(this.stats.attackCooldownMs);
    this.world.combat.meleeAttack(this, target);
    return true;
  }

  /** Läuft den aktuellen Weg ab; gibt ihn auf, wenn der Akteur länger festhängt. */
  protected followPath(dt: number): void {
    if (!this.follower.active) {
      this.stuckSeconds = 0;
      return;
    }
    const { dx, dy } = this.follower.step(this.x, this.y, this.stats.moveSpeed, dt);
    const wanted = Math.hypot(dx, dy);
    if (wanted === 0) {
      this.follower.commit();
      return;
    }

    this.sprite.rotation = Math.atan2(dy, dx);
    const moved = this.moveBy(dx, dy);

    if (moved >= wanted - 0.01) this.follower.commit();
    if (moved < wanted * STUCK_RATIO) {
      this.stuckSeconds += dt;
      if (this.stuckSeconds >= STUCK_SECONDS) {
        this.follower.clear();
        this.stuckSeconds = 0;
      }
    } else {
      this.stuckSeconds = 0;
    }
  }

  private flashHit(): void {
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      if (this.sprite.active) this.sprite.clearTint();
    });
  }
}
