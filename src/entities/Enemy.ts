import Phaser from 'phaser';
import { KNOCKBACK, TAP, TEXTURE_KEYS, TEXTURE_SCALE } from '../config/constants';
import { COLORS } from '../config/palette';
import { edgeDistance, isInSector } from '../core/combat';
import { hasLineOfSight, rayDistance } from '../core/collision';
import { findPath } from '../core/pathfinding';
import { scaleStats } from '../core/stats';
import type { EnemyAttack, EnemyDef } from '../data/types';
import { Actor } from './Actor';
import type { Player } from './Player';
import type { WorldContext } from './WorldContext';

const REPATH_SECONDS = 0.35;
const DEATH_FADE_MS = 260;
const AFTER_STUN_COOLDOWN_MS = 400;
/** Toleranz beim Treffer-Check einer Nahkampf-Ankündigung (Pixel). */
const MELEE_SLACK = 8;
const MELEE_HALF_ANGLE = 0.75;
const RETREAT_MIN_PROGRESS = 0.3;
/** Bis zu diesem Abstand (Pixel) bemerkt ein Gegner den Spieler auch ohne Sichtlinie. */
const NOTICE_THROUGH_WALLS = 70;

type EnemyState = 'idle' | 'chase' | 'windup';

export interface Difficulty {
  hp: number;
  damage: number;
}

/**
 * Gegner mit drei Angriffsarten (Nahkampf, Flächenschlag, Fernkampf). Jeder Angriff wird vorher durch eine
 * rote Gefahrenzone angekündigt; Betäubung unterbricht ihn.
 */
export class Enemy extends Actor {
  readonly team = 'enemy';

  private aiState: EnemyState = 'idle';
  private repathTimer = 0;
  private windupMs = 0;
  private windupAim = 0;
  private aimLength = 0;
  private tauntMs = 0;
  private hackMs = 0;
  private hackDrawn = false;
  private stunDrawn = false;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private readonly targetRing: Phaser.GameObjects.Image;
  private readonly telegraph: Phaser.GameObjects.Graphics;
  private readonly stunMark: Phaser.GameObjects.Graphics;
  private readonly hackMark: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    world: WorldContext,
    x: number,
    y: number,
    readonly def: EnemyDef,
    difficulty: Difficulty = { hp: 1, damage: 1 },
  ) {
    super(scene, world, x, y, scaleStats(def.stats, difficulty.hp, difficulty.damage), def.id);

    this.targetRing = new Phaser.GameObjects.Image(scene, 0, 0, TEXTURE_KEYS.targetRing);
    this.targetRing.setScale(TEXTURE_SCALE * (this.radius / 11 + 0.15)).setVisible(false);
    this.telegraph = new Phaser.GameObjects.Graphics(scene);
    this.hpBar = new Phaser.GameObjects.Graphics(scene).setVisible(false);
    this.stunMark = new Phaser.GameObjects.Graphics(scene);
    this.hackMark = new Phaser.GameObjects.Graphics(scene);
    // Unter der Figur: Gefahrenzone und Zielring.
    this.addAt(this.telegraph, 1);
    this.addAt(this.targetRing, 2);
    this.add([this.hpBar, this.stunMark, this.hackMark]);
  }

  get isElite(): boolean {
    return this.def.elite === true;
  }

  setTargeted(targeted: boolean): void {
    if (this.active) this.targetRing.setVisible(targeted);
  }

  /** Gehackt: nimmt `factor`-fachen Schaden, solange es dauert. */
  hack(durationMs: number, factor: number): void {
    this.hackMs = Math.max(this.hackMs, durationMs);
    this.damageTakenMultiplier = factor;
  }

  /** Zieht den Gegner in den Kampf; Schützen halten währenddessen keinen Abstand. */
  taunt(durationMs: number): void {
    this.tauntMs = Math.max(this.tauntMs, durationMs);
    if (this.aiState === 'idle') this.aiState = 'chase';
  }

  tick(dt: number, player: Player): void {
    if (this.isDead) return;
    this.tickTimers(dt);
    this.tauntMs = Math.max(0, this.tauntMs - dt * 1000);
    this.tickHack(dt);

    if (this.isStunned) {
      this.drawStun();
      return;
    }
    this.clearStun();

    if (player.isDead) {
      this.follower.clear();
      this.cancelWindup();
      return;
    }
    if (this.aiState === 'windup') {
      this.advanceWindup(dt, player);
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (this.aiState === 'idle') {
      if (dist > this.def.aggroRange) return;
      // Durch Wände bemerken Gegner den Spieler erst aus nächster Nähe.
      if (dist > NOTICE_THROUGH_WALLS && !hasLineOfSight(this.world.grid, this.x, this.y, player.x, player.y)) return;
      this.aiState = 'chase';
    } else if (dist > this.def.leashRange && this.tauntMs <= 0) {
      this.aiState = 'idle';
      this.follower.clear();
      return;
    }

    const attack = this.def.attack;
    if (attack.kind === 'ranged') this.tickRanged(dt, player, dist, attack);
    else this.tickMelee(dt, player, attack);
  }

  private tickMelee(dt: number, player: Player, attack: Exclude<EnemyAttack, { kind: 'ranged' }>): void {
    // Der Flächenschlag beginnt schon, wenn der Spieler nur nahe genug an der Zone ist.
    const engage = attack.kind === 'slam' ? attack.radius * 0.6 : this.stats.attackRange;
    if (edgeDistance(this, player) <= engage) {
      this.follower.clear();
      this.faceToward(player.x, player.y);
      if (this.attackCooldown.ready) this.beginWindup(player);
      return;
    }
    this.chase(dt, player);
  }

  private tickRanged(dt: number, player: Player, dist: number, attack: Extract<EnemyAttack, { kind: 'ranged' }>): void {
    const sight = hasLineOfSight(this.world.grid, this.x, this.y, player.x, player.y);

    if (sight && dist < attack.minRange && dist > 0.001 && this.tauntMs <= 0) {
      if (this.isFloating) {
        // Schwerelos: nach hinten Schub geben statt zu laufen.
        this.follower.clear();
        this.floatToward(this.x - player.x, this.y - player.y);
        this.faceToward(player.x, player.y);
        return;
      }
      const wanted = this.stats.moveSpeed * dt;
      const moved = this.moveBy(((this.x - player.x) / dist) * wanted, ((this.y - player.y) / dist) * wanted);
      if (moved > wanted * RETREAT_MIN_PROGRESS) {
        this.follower.clear();
        this.faceToward(player.x, player.y);
        return;
      }
      // In die Ecke gedrängt: stehen bleiben und schießen.
    }

    if (sight && edgeDistance(this, player) <= this.stats.attackRange * 0.9) {
      this.follower.clear();
      this.faceToward(player.x, player.y);
      if (this.attackCooldown.ready) this.beginWindup(player);
      return;
    }
    this.chase(dt, player);
  }

  private chase(dt: number, player: Player): void {
    this.repathTimer -= dt;
    if (this.repathTimer <= 0 || !this.follower.active) {
      this.repathTimer = REPATH_SECONDS;
      const path = findPath(this.world.grid, this, player, this.radius, TAP.snapTiles);
      if (path) this.follower.setPath(path);
    }
    this.followPath(dt);
  }

  private beginWindup(player: Player): void {
    this.aiState = 'windup';
    this.windupMs = 0;
    // Die Richtung wird beim Start festgelegt: Ausweichen ist möglich und lohnt sich.
    this.windupAim = Math.atan2(player.y - this.y, player.x - this.x);
    this.sprite.rotation = this.windupAim;
    if (this.def.attack.kind === 'ranged') {
      this.aimLength = rayDistance(this.world.grid, this.x, this.y, this.windupAim, this.stats.attackRange + this.radius + 30);
    }
    this.drawTelegraph(0);
  }

  private advanceWindup(dt: number, player: Player): void {
    this.windupMs += dt * 1000;
    const progress = Math.min(1, this.windupMs / this.def.attack.windupMs);
    this.drawTelegraph(progress);
    if (progress >= 1) this.resolveAttack(player);
  }

  private resolveAttack(player: Player): void {
    const attack = this.def.attack;
    const { combat, projectiles } = this.world;
    this.telegraph.clear();
    this.aiState = 'chase';
    this.attackCooldown.trigger(this.stats.attackCooldownMs);

    switch (attack.kind) {
      case 'melee':
        combat.swingFx(this, this.windupAim);
        if (isInSector(this, this.windupAim, MELEE_HALF_ANGLE, player, this.radius + this.stats.attackRange + MELEE_SLACK)) {
          combat.attack(this, player);
        }
        break;
      case 'slam':
        combat.ring(this.x, this.y, attack.radius, COLORS.telegraph, 300);
        this.scene.cameras.main.shake(120, 0.006);
        if (isInSector(this, 0, Math.PI, player, attack.radius)) combat.attack(this, player, 1, KNOCKBACK.slam);
        break;
      case 'ranged':
        projectiles.spawn({
          source: this,
          x: this.x + Math.cos(this.windupAim) * (this.radius + 4),
          y: this.y + Math.sin(this.windupAim) * (this.radius + 4),
          angle: this.windupAim,
          speed: attack.projectileSpeed,
          damage: combat.rollDamage(this),
          knockback: KNOCKBACK.projectile,
        });
        this.pushAlong(-Math.cos(this.windupAim), -Math.sin(this.windupAim), KNOCKBACK.enemyRecoil);
        break;
    }
  }

  private cancelWindup(): void {
    if (this.aiState !== 'windup') return;
    this.aiState = 'chase';
    this.telegraph.clear();
    if (this.attackCooldown.ready) this.attackCooldown.trigger(AFTER_STUN_COOLDOWN_MS);
  }

  /** Gefahrenzone: wächst mit dem Fortschritt der Ankündigung und zeigt, wo der Treffer landet. */
  private drawTelegraph(progress: number): void {
    const attack = this.def.attack;
    const g = this.telegraph.clear();
    const fill = 0.1 + 0.3 * progress;
    const line = 0.5 + 0.5 * progress;

    switch (attack.kind) {
      case 'melee': {
        const reach = this.radius + this.stats.attackRange + MELEE_SLACK;
        g.fillStyle(COLORS.telegraph, fill).lineStyle(2, COLORS.telegraph, line);
        g.slice(0, 0, reach, this.windupAim - MELEE_HALF_ANGLE, this.windupAim + MELEE_HALF_ANGLE);
        g.fillPath().strokePath();
        break;
      }
      case 'slam':
        g.lineStyle(2, COLORS.telegraph, line).strokeCircle(0, 0, attack.radius);
        g.fillStyle(COLORS.telegraph, fill).fillCircle(0, 0, attack.radius * progress);
        break;
      case 'ranged': {
        const ex = Math.cos(this.windupAim) * this.aimLength;
        const ey = Math.sin(this.windupAim) * this.aimLength;
        g.lineStyle(1 + 2 * progress, COLORS.telegraph, 0.3 + 0.6 * progress).lineBetween(0, 0, ex, ey);
        break;
      }
    }
  }

  protected override onDamaged(): void {
    // Wer getroffen wird, bemerkt den Spieler auch außerhalb der Aggro-Reichweite.
    if (this.aiState === 'idle') this.aiState = 'chase';
    this.drawHpBar();
  }

  protected override onStunned(): void {
    this.cancelWindup();
  }

  protected override onDeath(): void {
    this.setTargeted(false);
    this.hpBar.setVisible(false);
    this.telegraph.clear();
    this.hackMark.clear();
    this.clearStun();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.6,
      duration: DEATH_FADE_MS,
      onComplete: () => this.destroy(),
    });
  }

  private tickHack(dt: number): void {
    if (this.hackMs <= 0) {
      if (this.hackDrawn) {
        this.hackMark.clear();
        this.hackDrawn = false;
      }
      return;
    }
    this.hackMs -= dt * 1000;
    if (this.hackMs <= 0) this.damageTakenMultiplier = 1;
    const spin = this.scene.time.now / 300;
    this.hackMark.clear().lineStyle(1.5, 0x5fd8ff, 0.9);
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI * 2) / 3;
      this.hackMark.beginPath().arc(0, 0, this.radius + 5, a, a + 0.9).strokePath();
    }
    this.hackDrawn = true;
  }

  private drawStun(): void {
    const t = this.scene.time.now / 220;
    const y = -this.radius - 16;
    this.stunMark.clear().fillStyle(0xffe08a, 1);
    for (let i = 0; i < 3; i++) {
      const a = t + (i * Math.PI * 2) / 3;
      this.stunMark.fillCircle(Math.cos(a) * 8, y + Math.sin(a) * 3, 2.2);
    }
    this.stunDrawn = true;
  }

  private clearStun(): void {
    if (!this.stunDrawn) return;
    this.stunMark.clear();
    this.stunDrawn = false;
  }

  private drawHpBar(): void {
    const width = Math.max(28, this.radius * 2 + 8);
    const height = 4;
    const x = -width / 2;
    const y = -this.radius - 10;
    this.hpBar.clear().setVisible(true);
    this.hpBar.fillStyle(COLORS.hpBack, 0.9).fillRect(x - 1, y - 1, width + 2, height + 2);
    this.hpBar.fillStyle(COLORS.hpFill, 1).fillRect(x, y, width * (this.hp / this.stats.maxHp), height);
  }
}
