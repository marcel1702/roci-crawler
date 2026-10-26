import Phaser from 'phaser';
import { actorTextureKey, TEXTURE_KEYS, TEXTURE_SCALE } from '../config/constants';
import { moveCircle } from '../core/collision';
import { isInReach } from '../core/combat';
import { armorReduction } from '../core/items';
import { Cooldown } from '../core/cooldown';
import { PathFollower } from '../core/follower';
import type { ActorStats } from '../core/stats';
import type { BasicAttack } from '../data/types';
import type { WorldContext } from './WorldContext';

/** Läuft ein Akteur weniger als diesen Anteil seiner Sollstrecke, gilt er als blockiert. */
const STUCK_RATIO = 0.2;
const STUCK_SECONDS = 0.35;
const HIT_FLASH_MS = 70;

export type Team = 'player' | 'enemy';

/** Basis für Spielerfigur und Gegner: Lebenspunkte, Wandkollision, Wegverfolgung, Betäubung und Nahkampf. */
export abstract class Actor extends Phaser.GameObjects.Container {
  abstract readonly team: Team;

  stats: ActorStats;
  hp: number;
  /** Faktor auf erlittenen Schaden (0.5 = halber Schaden). */
  damageTakenMultiplier = 1;
  /** Panzerung hält einen Teil des Schadens ab (siehe `armorReduction`). */
  armor = 0;
  /** Wahrscheinlichkeit auf einen kritischen Treffer, 0..1. */
  critChance = 0;
  /** Anteil des verursachten Schadens, der als Leben zurückkommt. */
  lifesteal = 0;
  /** Faktor auf das Lauftempo (z. B. 0.5 mit versiegelter Rüstung). */
  speedMultiplier = 1;
  /** Faktor auf verursachten Schaden (z. B. durch Inspirieren). */
  damageMultiplier = 1;
  /** Grundangriff: Nahkampf oder Geschoss. */
  basic: BasicAttack = { kind: 'melee' };

  protected readonly follower = new PathFollower();
  protected readonly attackCooldown = new Cooldown();
  protected readonly sprite: Phaser.GameObjects.Image;

  private dead = false;
  private stunMs = 0;
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
    shadow.setScale(TEXTURE_SCALE * (stats.radius / 11));
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

  get isStunned(): boolean {
    return this.stunMs > 0;
  }

  /** Blickrichtung in Radiant. */
  get facing(): number {
    return this.sprite.rotation;
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

  /** Zieht Lebenspunkte ab (nach Schadensfaktor) und liefert den tatsächlichen Schaden. */
  takeDamage(amount: number): number {
    if (this.dead) return 0;
    const dealt = Math.max(1, Math.round(amount * this.damageTakenMultiplier * (1 - armorReduction(this.armor))));
    this.hp = Math.max(0, this.hp - dealt);
    this.flashHit();
    this.onDamaged();
    if (this.hp === 0) {
      this.dead = true;
      this.follower.clear();
      this.onDeath();
    }
    return dealt;
  }

  /** Heilt bis zum Maximum und liefert die tatsächlich geheilte Menge. */
  heal(amount: number): number {
    if (this.dead) return 0;
    const healed = Math.min(amount, this.stats.maxHp - this.hp);
    this.hp += healed;
    return healed;
  }

  stun(durationMs: number): void {
    if (this.dead) return;
    this.stunMs = Math.max(this.stunMs, durationMs);
    this.follower.clear();
    this.onStunned();
  }

  protected onDamaged(): void {}

  protected onStunned(): void {}

  protected abstract onDeath(): void;

  protected tickTimers(dt: number): void {
    this.attackCooldown.update(dt * 1000);
    if (this.stunMs > 0) this.stunMs = Math.max(0, this.stunMs - dt * 1000);
  }

  /** Greift an, wenn das Ziel in Reichweite und die Abklingzeit vorbei ist. */
  protected tryAttack(target: Actor): boolean {
    if (!this.attackCooldown.ready || !isInReach(this, target, this.stats.attackRange)) return false;
    this.attackCooldown.trigger(this.stats.attackCooldownMs);
    this.world.combat.basicAttack(this, target);
    return true;
  }

  /** Läuft den aktuellen Weg ab; gibt ihn auf, wenn der Akteur länger festhängt. */
  protected followPath(dt: number): void {
    if (!this.follower.active) {
      this.stuckSeconds = 0;
      return;
    }
    const { dx, dy } = this.follower.step(this.x, this.y, this.stats.moveSpeed * this.speedMultiplier, dt);
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
