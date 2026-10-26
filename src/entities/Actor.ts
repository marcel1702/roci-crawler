import Phaser from 'phaser';
import { actorTextureKey, TEXTURE_KEYS, TEXTURE_SCALE, ZEROG } from '../config/constants';
import { moveCircle } from '../core/collision';
import { isInReach } from '../core/combat';
import { armorReduction } from '../core/items';
import { Cooldown } from '../core/cooldown';
import { PathFollower } from '../core/follower';
import type { Vec2 } from '../core/math';
import type { ActorStats } from '../core/stats';
import { DEFAULT_ZEROG, applyImpulse, matchedThrust, paramsFor, stepZeroG } from '../core/zerog';
import type { BasicAttack } from '../data/types';
import type { WorldContext } from './WorldContext';

/** Läuft ein Akteur weniger als diesen Anteil seiner Sollstrecke, gilt er als blockiert. */
const STUCK_RATIO = 0.2;
const STUCK_SECONDS = 0.35;
const HIT_FLASH_MS = 70;
/** In der Schwerelosigkeit gilt ein Wegpunkt in diesem Abstand (mindestens der Körperradius) als erreicht. */
const FLOAT_REACH = 8;

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
  /** Faktor auf das Lauftempo durch Bremswirkung (Wucherung, Sporen); fällt nach kurzer Zeit auf 1 zurück. */
  slowFactor = 1;
  /** Faktor auf verursachten Schaden (z. B. durch Inspirieren). */
  damageMultiplier = 1;
  /** Grundangriff: Nahkampf oder Geschoss. */
  basic: BasicAttack = { kind: 'melee' };
  /** Geschwindigkeit (px/s); nur in der Schwerelosigkeit ungleich null, sonst bewegt sich der Akteur direkt. */
  vx = 0;
  vy = 0;
  /** Faktor auf Schub und Bremse in der Schwerelosigkeit (Gürtler-Ausrüstung, Talente). */
  zeroGControl = 1;

  /** True: der Schub zeigt zum Wegpunkt und Schwung bleibt (Spielerin); false: die Geschwindigkeit wird angeglichen (Gegner). */
  protected directThrust = false;
  /** Zusätzliche Dämpfung beim Bremsen; Gegner bremsen ohne Schub von selbst ein wenig. */
  protected brakeDamping: number = ZEROG.autoBrake;
  /** Bremst in diesem Moment mit voller Kraft („Stabilisieren“). */
  protected braking = false;
  protected readonly follower = new PathFollower();
  protected readonly attackCooldown = new Cooldown();
  protected readonly sprite: Phaser.GameObjects.Image;

  private dead = false;
  private stunMs = 0;
  private slowMs = 0;
  private stuckSeconds = 0;
  private floating = false;
  private thrust: Vec2 | null = null;
  private walkVx = 0;
  private walkVy = 0;

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

  /** True, solange der Akteur auf einer schwerelosen Kachel ist. */
  get isFloating(): boolean {
    return this.floating;
  }

  /**
   * Stößt den Akteur von `(fromX, fromY)` weg. Wirkt nur in der Schwerelosigkeit; große Gegner bewegen sich weniger.
   */
  knockFrom(fromX: number, fromY: number, strength: number): void {
    this.pushAlong(this.x - fromX, this.y - fromY, strength);
  }

  /** Stößt in Richtung (dx, dy); die Länge von (dx, dy) ist ohne Bedeutung. */
  pushAlong(dx: number, dy: number, strength: number): void {
    const dist = Math.hypot(dx, dy);
    if (!this.floating || dist < 0.001 || strength <= 0) return;
    const mass = Math.max(0.6, (this.radius / 11) ** 2);
    const body = { vx: this.vx, vy: this.vy };
    applyImpulse(body, (dx / dist) * (strength / mass), (dy / dist) * (strength / mass));
    this.vx = body.vx;
    this.vy = body.vy;
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

  /** Bremst für `durationMs` auf `factor` des Tempos (die stärkere Bremse gilt). */
  slow(factor: number, durationMs: number): void {
    if (this.dead) return;
    this.slowFactor = this.slowMs > 0 ? Math.min(this.slowFactor, factor) : factor;
    this.slowMs = Math.max(this.slowMs, durationMs);
  }

  /** Lauftempo in px/s mit allen Faktoren (Verstärkungen und Bremswirkung). */
  get moveSpeed(): number {
    return this.stats.moveSpeed * this.speedMultiplier * this.slowFactor;
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
    if (this.slowMs > 0) {
      this.slowMs -= dt * 1000;
      if (this.slowMs <= 0) this.slowFactor = 1;
    }
    this.tickFloat(dt);
  }

  /**
   * Schwerelosigkeit: Der Schub, den die Bewegungslogik im letzten Bild gesetzt hat, wird hier in Geschwindigkeit
   * und Ortsänderung umgesetzt (ein Bild Verzögerung, unmerklich). Betäubte treiben ungebremst weiter.
   */
  private tickFloat(dt: number): void {
    const { grid } = this.world;
    const floating = grid.isZeroG(grid.toCol(this.x), grid.toRow(this.y));
    if (floating !== this.floating) {
      this.floating = floating;
      this.vx = floating ? this.walkVx : 0;
      this.vy = floating ? this.walkVy : 0;
      this.thrust = null;
      if (floating) this.onFloatStart();
    }
    this.walkVx = 0;
    this.walkVy = 0;
    if (!floating) return;

    const thrust = this.thrust;
    this.thrust = null;
    const brake = this.braking || (this.brakeDamping > 0 && thrust === null && !this.isStunned);
    const params = { ...paramsFor(this.moveSpeed), brakeDamping: this.braking ? DEFAULT_ZEROG.brakeDamping : this.brakeDamping };
    const body = { x: this.x, y: this.y, vx: this.vx, vy: this.vy, radius: this.radius };
    const speedBefore = Math.hypot(body.vx, body.vy);
    const { bumped } = stepZeroG(grid, body, dt, thrust, params, this.zeroGControl, brake);
    this.setPosition(body.x, body.y);
    this.vx = body.vx;
    this.vy = body.vy;
    if (bumped && speedBefore >= ZEROG.bumpFeedbackSpeed) this.onBump(speedBefore);
  }

  /** Wunschbewegung in der Schwerelosigkeit: Spielerin gibt Schub, Gegner gleichen ihre Geschwindigkeit an. */
  protected floatToward(dx: number, dy: number): void {
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return;
    const dirX = dx / dist;
    const dirY = dy / dist;
    this.sprite.rotation = Math.atan2(dirY, dirX);
    if (this.directThrust) {
      this.thrust = { x: dirX, y: dirY };
    } else {
      this.thrust = matchedThrust(this, dirX, dirY, this.moveSpeed);
    }
  }

  protected onFloatStart(): void {}

  protected onBump(_speed: number): void {}

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
    if (this.floating) {
      // Kein Gehen entlang des Wegs: auf den nächsten Wegpunkt zusteuern, der Schwung bleibt.
      const goal = this.follower.steer(this.x, this.y, Math.max(this.radius, FLOAT_REACH));
      if (goal) this.floatToward(goal.x - this.x, goal.y - this.y);
      this.stuckSeconds = 0;
      return;
    }
    const { dx, dy } = this.follower.step(this.x, this.y, this.moveSpeed, dt);
    const wanted = Math.hypot(dx, dy);
    if (wanted === 0) {
      this.follower.commit();
      return;
    }

    this.sprite.rotation = Math.atan2(dy, dx);
    const moved = this.moveBy(dx, dy);
    this.walkVx = (dx / dt) * (moved / wanted);
    this.walkVy = (dy / dt) * (moved / wanted);

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
