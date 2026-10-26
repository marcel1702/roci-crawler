import Phaser from 'phaser';
import { audio } from '../audio';
import { KNOCKBACK, MISSION_EVENTS, TAP, TEXTURE_KEYS, TEXTURE_SCALE } from '../config/constants';
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
/** Ein Boss bleibt in dieser Distanz (Ränder) vom Spieler stehen, statt ihn zu schieben. */
const BOSS_HOLD_DISTANCE = 24;
/** Prallt ein Sturmangriff gegen eine Wand, dauert die Benommenheit so viel länger. */
const WALL_DIZZY_FACTOR = 1.5;
/** Schaden pro Takt einer Sporenzone im Verhältnis zu einem normalen Treffer des Gegners. */
const SPORE_DAMAGE_FACTOR = 0.35;
const SPORE_SLOW = 0.7;

type EnemyState = 'idle' | 'chase' | 'windup' | 'charge';
type MeleeLike = Extract<EnemyAttack, { kind: 'melee' | 'slam' }>;
type RangedLike = Extract<EnemyAttack, { kind: 'ranged' | 'fan' | 'bomb' | 'spore' }>;

/** Fernkämpfer halten Abstand (weichen zurück) und brauchen Sichtlinie. */
function isRangedLike(attack: EnemyAttack): attack is RangedLike {
  return attack.kind === 'ranged' || attack.kind === 'fan' || attack.kind === 'bomb' || attack.kind === 'spore';
}

export interface Difficulty {
  hp: number;
  damage: number;
}

/**
 * Gegner mit mehreren Angriffsarten (Nahkampf, Flächenschlag, Fernkampf, Fächer, Sprengsatz, Sturmangriff). Jeder Angriff
 * wird vorher durch eine rote Gefahrenzone angekündigt; Betäubung unterbricht ihn. Bosse wechseln reihum zwischen
 * mehreren Angriffen (`def.pattern`) und haben eine zweite Phase.
 */
export class Enemy extends Actor {
  readonly team = 'enemy';
  /** Von einem Boss nachgerufen: gibt weder Erfahrung noch Beute. */
  summoned = false;

  private aiState: EnemyState = 'idle';
  private current: EnemyAttack;
  private patternIndex = 0;
  private repathTimer = 0;
  private windupMs = 0;
  private windupAim = 0;
  private aimLength = 0;
  private bombTarget = { x: 0, y: 0 };
  private sporeTargets: { x: number; y: number }[] = [];
  private rainTimerMs = 0;
  private bombSprite: Phaser.GameObjects.Image | null = null;
  private chargeLeft = 0;
  private chargeHit = false;
  private enraged = false;
  private summonTimerMs = 0;
  private summonIndex = 0;
  private engagedAnnounced = false;
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
    private readonly difficulty: Difficulty = { hp: 1, damage: 1 },
  ) {
    super(scene, world, x, y, scaleStats(def.stats, difficulty.hp, difficulty.damage), def.id);
    this.current = def.attack;

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

  get isBoss(): boolean {
    return this.def.boss !== undefined;
  }

  /** True, sobald der Gegner den Spieler bemerkt hat (und nicht wieder aufgegeben hat). */
  get isEngaged(): boolean {
    return this.aiState !== 'idle';
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
    this.engage();
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
    if (this.aiState === 'charge') {
      this.advanceCharge(dt, player);
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (this.aiState === 'idle') {
      if (dist > this.def.aggroRange) return;
      // Durch Wände bemerken Gegner den Spieler erst aus nächster Nähe.
      if (dist > NOTICE_THROUGH_WALLS && !hasLineOfSight(this.world.grid, this.x, this.y, player.x, player.y)) return;
      this.engage();
    } else if (dist > this.def.leashRange && this.tauntMs <= 0) {
      this.aiState = 'idle';
      this.follower.clear();
      return;
    }

    this.tickSummons(dt, player);
    const attack = this.def.attack;
    if (this.def.pattern || attack.kind === 'charge') this.tickPattern(dt, player, dist);
    else if (isRangedLike(attack)) this.tickRanged(dt, player, dist, attack);
    else this.tickMelee(dt, player, attack);
  }

  /** Beginnt den Kampf; Bosse melden sich dabei einmal bei der Mission (Spruch, Lebensleiste). */
  private engage(): void {
    if (this.aiState === 'idle') this.aiState = 'chase';
    if (this.isBoss && !this.engagedAnnounced) {
      this.engagedAnnounced = true;
      this.scene.events.emit(MISSION_EVENTS.bossEngaged, this);
    }
  }

  private tickMelee(dt: number, player: Player, attack: MeleeLike): void {
    // Der Flächenschlag beginnt schon, wenn der Spieler nur nahe genug an der Zone ist.
    const engage = attack.kind === 'slam' ? attack.radius * 0.6 : this.stats.attackRange;
    if (edgeDistance(this, player) <= engage) {
      this.follower.clear();
      this.faceToward(player.x, player.y);
      if (this.attackCooldown.ready) this.beginWindup(player, attack);
      return;
    }
    this.chase(dt, player);
  }

  private tickRanged(dt: number, player: Player, dist: number, attack: RangedLike): void {
    const sight = hasLineOfSight(this.world.grid, this.x, this.y, player.x, player.y);

    if (sight && dist < attack.minRange && dist > 0.001 && this.tauntMs <= 0) {
      if (this.isFloating) {
        // Schwerelos: nach hinten Schub geben statt zu laufen.
        this.follower.clear();
        this.floatToward(this.x - player.x, this.y - player.y);
        this.faceToward(player.x, player.y);
        return;
      }
      const wanted = this.moveSpeed * dt;
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
      if (this.attackCooldown.ready) this.beginWindup(player, attack);
      return;
    }
    this.chase(dt, player);
  }

  /** Boss: wählt reihum den ersten Angriff, der aus der aktuellen Lage möglich ist; sonst auf den Spieler zugehen. */
  private tickPattern(dt: number, player: Player, dist: number): void {
    const pattern = this.def.pattern ?? [this.def.attack];
    if (this.attackCooldown.ready) {
      for (let k = 0; k < pattern.length; k++) {
        const index = (this.patternIndex + k) % pattern.length;
        const attack = pattern[index] as EnemyAttack;
        if (!this.canUse(attack, player, dist)) continue;
        this.patternIndex = index + 1;
        this.follower.clear();
        this.faceToward(player.x, player.y);
        this.beginWindup(player, attack);
        return;
      }
    }
    if (edgeDistance(this, player) <= BOSS_HOLD_DISTANCE) {
      this.follower.clear();
      this.faceToward(player.x, player.y);
      return;
    }
    this.chase(dt, player);
  }

  private canUse(attack: EnemyAttack, player: Player, dist: number): boolean {
    const sight = hasLineOfSight(this.world.grid, this.x, this.y, player.x, player.y);
    switch (attack.kind) {
      case 'melee':
        return edgeDistance(this, player) <= this.stats.attackRange;
      case 'slam':
        return edgeDistance(this, player) <= attack.radius * 0.7;
      case 'ranged':
      case 'fan':
        return sight && dist >= attack.minRange && edgeDistance(this, player) <= this.stats.attackRange * 0.9;
      case 'bomb':
      case 'spore':
        return sight && dist >= attack.minRange && edgeDistance(this, player) <= this.stats.attackRange;
      case 'charge':
        return sight && dist >= attack.minRange && dist <= attack.distance + this.radius + player.radius;
    }
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

  private beginWindup(player: Player, attack: EnemyAttack): void {
    this.aiState = 'windup';
    this.current = attack;
    this.windupMs = 0;
    // Die Richtung wird beim Start festgelegt: Ausweichen ist möglich und lohnt sich.
    this.windupAim = Math.atan2(player.y - this.y, player.x - this.x);
    this.sprite.rotation = this.windupAim;
    switch (attack.kind) {
      case 'ranged':
      case 'fan':
        this.aimLength = rayDistance(this.world.grid, this.x, this.y, this.windupAim, this.stats.attackRange + this.radius + 30);
        break;
      case 'charge':
        this.aimLength = rayDistance(this.world.grid, this.x, this.y, this.windupAim, attack.distance + this.radius);
        break;
      case 'bomb': {
        // Das Ziel wird zu Beginn festgelegt und der Sprengsatz fliegt sichtbar hin.
        this.bombTarget = { x: player.x, y: player.y };
        this.bombSprite?.destroy();
        this.bombSprite = this.scene.add
          .image(this.x, this.y, TEXTURE_KEYS.projectile)
          .setScale(TEXTURE_SCALE * 1.5)
          .setTint(0xff8a3d)
          .setDepth(42);
        this.scene.tweens.add({ targets: this.bombSprite, x: player.x, y: player.y, duration: attack.windupMs, ease: 'Quad.easeOut' });
        break;
      }
      case 'spore': {
        // Der erste Klumpen zielt auf den Spieler, die übrigen streuen um ihn (festgelegt zu Beginn).
        this.sporeTargets = [{ x: player.x, y: player.y }];
        for (let i = 1; i < attack.count; i++) {
          const angle = this.world.rng.next() * Math.PI * 2;
          const distance = (0.4 + this.world.rng.next() * 0.6) * attack.scatter;
          this.sporeTargets.push({ x: player.x + Math.cos(angle) * distance, y: player.y + Math.sin(angle) * distance });
        }
        break;
      }
      default:
        break;
    }
    this.drawTelegraph(0);
  }

  private advanceWindup(dt: number, player: Player): void {
    this.windupMs += dt * 1000;
    const progress = Math.min(1, this.windupMs / this.current.windupMs);
    this.drawTelegraph(progress);
    if (progress >= 1) this.resolveAttack(player);
  }

  private resolveAttack(player: Player): void {
    const attack = this.current;
    const { combat } = this.world;
    this.telegraph.clear();
    this.aiState = 'chase';
    this.attackCooldown.trigger(this.stats.attackCooldownMs * (this.enraged ? (this.def.enrage?.cooldownFactor ?? 1) : 1));

    switch (attack.kind) {
      case 'melee':
        combat.swingFx(this, this.windupAim);
        if (isInSector(this, this.windupAim, MELEE_HALF_ANGLE, player, this.radius + this.stats.attackRange + MELEE_SLACK)) {
          combat.attack(this, player);
        }
        break;
      case 'slam':
        combat.ring(this.x, this.y, attack.radius, COLORS.telegraph, 300);
        audio.play('boom');
        this.scene.cameras.main.shake(this.isBoss ? 220 : 120, this.isBoss ? 0.01 : 0.006);
        if (isInSector(this, 0, Math.PI, player, attack.radius)) combat.attack(this, player, 1, KNOCKBACK.slam);
        break;
      case 'ranged':
        audio.play('shoot');
        this.fire(this.windupAim, attack.projectileSpeed);
        this.pushAlong(-Math.cos(this.windupAim), -Math.sin(this.windupAim), KNOCKBACK.enemyRecoil);
        break;
      case 'fan':
        audio.play('shoot');
        for (let i = 0; i < attack.count; i++) {
          const offset = attack.count > 1 ? (i / (attack.count - 1) - 0.5) * attack.spread : 0;
          this.fire(this.windupAim + offset, attack.projectileSpeed);
        }
        this.pushAlong(-Math.cos(this.windupAim), -Math.sin(this.windupAim), KNOCKBACK.enemyRecoil * 1.5);
        break;
      case 'bomb': {
        const { x, y } = this.bombTarget;
        this.clearBomb();
        combat.ring(x, y, attack.radius, 0xffa24d, 280);
        audio.play('boom');
        combat.areaDamage(this, x, y, attack.radius, 1, [player], 0, KNOCKBACK.slam);
        this.scene.cameras.main.shake(100, 0.005);
        break;
      }
      case 'spore':
        audio.play('boom');
        for (const target of this.sporeTargets) {
          this.world.hazards.spawn({
            x: target.x,
            y: target.y,
            radius: attack.radius,
            durationMs: attack.zoneMs,
            damage: Math.max(1, Math.round(this.world.combat.rollDamage(this) * SPORE_DAMAGE_FACTOR)),
            slow: SPORE_SLOW,
          });
        }
        this.sporeTargets = [];
        break;
      case 'charge':
        this.aiState = 'charge';
        this.chargeLeft = this.aimLength > 0 ? this.aimLength : attack.distance;
        this.chargeHit = false;
        break;
    }
  }

  private fire(angle: number, speed: number): void {
    this.world.projectiles.spawn({
      source: this,
      x: this.x + Math.cos(angle) * (this.radius + 4),
      y: this.y + Math.sin(angle) * (this.radius + 4),
      angle,
      speed,
      damage: this.world.combat.rollDamage(this),
      knockback: KNOCKBACK.projectile,
    });
  }

  /** Sturmangriff: rennt in die angekündigte Richtung, trifft den Spieler einmal und ist danach benommen. */
  private advanceCharge(dt: number, player: Player): void {
    const attack = this.current;
    if (attack.kind !== 'charge') {
      this.aiState = 'chase';
      return;
    }
    const step = Math.min(this.chargeLeft, attack.speed * this.speedMultiplier * this.slowFactor * dt);
    const moved = this.moveBy(Math.cos(this.windupAim) * step, Math.sin(this.windupAim) * step);
    this.chargeLeft -= step;

    if (!this.chargeHit && edgeDistance(this, player) <= 3) {
      this.chargeHit = true;
      this.world.combat.attack(this, player, 1.4, KNOCKBACK.charge);
      this.world.combat.ring(player.x, player.y, 30, COLORS.telegraph, 220);
    }
    const wall = moved < step * 0.5;
    if (this.chargeLeft <= 0.01 || wall) {
      this.aiState = 'chase';
      if (wall) this.scene.cameras.main.shake(160, 0.008);
      this.stun(attack.dizzyMs * (wall ? WALL_DIZZY_FACTOR : 1));
    }
  }

  private cancelWindup(): void {
    if (this.aiState === 'charge') {
      this.aiState = 'chase';
      this.chargeLeft = 0;
    }
    if (this.aiState !== 'windup') return;
    this.aiState = 'chase';
    this.telegraph.clear();
    this.clearBomb();
    this.sporeTargets = [];
    if (this.attackCooldown.ready) this.attackCooldown.trigger(AFTER_STUN_COOLDOWN_MS);
  }

  private clearBomb(): void {
    if (!this.bombSprite) return;
    this.scene.tweens.killTweensOf(this.bombSprite);
    this.bombSprite.destroy();
    this.bombSprite = null;
  }

  /** Gefahrenzone: wächst mit dem Fortschritt der Ankündigung und zeigt, wo der Treffer landet. */
  private drawTelegraph(progress: number): void {
    const attack = this.current;
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
      case 'fan': {
        g.lineStyle(1 + 2 * progress, COLORS.telegraph, 0.3 + 0.6 * progress);
        for (let i = 0; i < attack.count; i++) {
          const offset = attack.count > 1 ? (i / (attack.count - 1) - 0.5) * attack.spread : 0;
          const angle = this.windupAim + offset;
          g.lineBetween(0, 0, Math.cos(angle) * this.aimLength, Math.sin(angle) * this.aimLength);
        }
        break;
      }
      case 'bomb': {
        // Die Zone liegt am Ziel (relativ zur Figur gezeichnet); sie bleibt dort, auch wenn die Figur sich bewegt.
        const tx = this.bombTarget.x - this.x;
        const ty = this.bombTarget.y - this.y;
        g.lineStyle(2, COLORS.telegraph, line).strokeCircle(tx, ty, attack.radius);
        g.fillStyle(COLORS.telegraph, fill).fillCircle(tx, ty, attack.radius * progress);
        break;
      }
      case 'spore':
        for (const target of this.sporeTargets) {
          const tx = target.x - this.x;
          const ty = target.y - this.y;
          g.lineStyle(2, COLORS.telegraph, line).strokeCircle(tx, ty, attack.radius);
          g.fillStyle(COLORS.telegraph, fill).fillCircle(tx, ty, attack.radius * progress);
        }
        break;
      case 'charge': {
        // Band in Laufrichtung, so breit wie der Körper.
        const dx = Math.cos(this.windupAim);
        const dy = Math.sin(this.windupAim);
        const nx = -dy * this.radius;
        const ny = dx * this.radius;
        const length = this.aimLength > 0 ? this.aimLength : attack.distance;
        const ex = dx * length;
        const ey = dy * length;
        const points = [
          new Phaser.Math.Vector2(nx, ny),
          new Phaser.Math.Vector2(ex + nx, ey + ny),
          new Phaser.Math.Vector2(ex - nx, ey - ny),
          new Phaser.Math.Vector2(-nx, -ny),
        ];
        g.fillStyle(COLORS.telegraph, fill).fillPoints(points, true);
        g.lineStyle(2, COLORS.telegraph, line).strokePoints(points, true);
        break;
      }
    }
  }

  /** Zweite Phase des Bosses: schneller, öfter Angriffe und Verstärkung. */
  private enrage(): void {
    const phase = this.def.enrage;
    if (!phase || this.enraged) return;
    this.enraged = true;
    this.speedMultiplier *= phase.speedFactor;
    this.summonTimerMs = 1500;
    this.rainTimerMs = phase.rain?.everyMs ?? 0;
    this.world.combat.ring(this.x, this.y, 70, COLORS.telegraph, 450);
    this.scene.events.emit(MISSION_EVENTS.bossEnraged, this);
  }

  /** Zweite Phase: Wucherungsregen in der Nähe des Spielers und Verstärkung in Abständen (bis zur Obergrenze). */
  private tickSummons(dt: number, player: Player): void {
    const phase = this.def.enrage;
    if (!phase || !this.enraged) return;
    this.tickRain(dt, player);
    this.summonTimerMs -= dt * 1000;
    if (this.summonTimerMs > 0) return;
    this.summonTimerMs = phase.summonEveryMs;

    const alive = this.world.enemies.filter((e) => e.summoned && !e.isDead).length;
    if (alive >= phase.summonCap) return;
    const id = phase.summon[this.summonIndex++ % phase.summon.length];
    if (id === undefined) return;
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = (attempt / 8) * Math.PI * 2 + this.scene.time.now * 0.001;
      const distance = this.radius + 34;
      const x = this.x + Math.cos(angle) * distance;
      const y = this.y + Math.sin(angle) * distance;
      const { grid } = this.world;
      if (grid.isSolid(grid.toCol(x), grid.toRow(y))) continue;
      const add = this.world.spawnEnemy(id, x, y, this.difficulty);
      if (add) {
        add.summoned = true;
        this.world.combat.ring(x, y, 26, COLORS.telegraph, 300);
      }
      return;
    }
  }

  private tickRain(dt: number, player: Player): void {
    const rain = this.def.enrage?.rain;
    if (!rain) return;
    this.rainTimerMs -= dt * 1000;
    if (this.rainTimerMs > 0) return;
    this.rainTimerMs = rain.everyMs;
    const angle = this.world.rng.next() * Math.PI * 2;
    const distance = this.world.rng.next() * rain.spread;
    const { grid } = this.world;
    const x = player.x + Math.cos(angle) * distance;
    const y = player.y + Math.sin(angle) * distance;
    if (grid.isSolid(grid.toCol(x), grid.toRow(y))) return;
    this.world.hazards.spawn({
      x,
      y,
      radius: rain.radius,
      warnMs: rain.warnMs,
      durationMs: rain.zoneMs,
      damage: Math.max(1, Math.round(this.world.combat.rollDamage(this) * SPORE_DAMAGE_FACTOR)),
      slow: SPORE_SLOW,
    });
  }

  protected override onDamaged(): void {
    // Wer getroffen wird, bemerkt den Spieler auch außerhalb der Aggro-Reichweite.
    this.engage();
    const phase = this.def.enrage;
    if (phase && this.hp > 0 && this.hp <= this.stats.maxHp * phase.hpFraction) this.enrage();
    this.drawHpBar();
  }

  protected override onStunned(): void {
    this.cancelWindup();
  }

  protected override onDeath(): void {
    this.setTargeted(false);
    const zone = this.def.deathZone;
    if (zone) {
      this.world.hazards.spawn({
        x: this.x,
        y: this.y,
        radius: zone.radius,
        durationMs: zone.zoneMs,
        damage: Math.max(1, Math.round(this.world.combat.rollDamage(this) * SPORE_DAMAGE_FACTOR)),
        slow: SPORE_SLOW,
      });
    }
    this.hpBar.setVisible(false);
    this.telegraph.clear();
    this.clearBomb();
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
    // Bosse haben ihre Leiste im HUD.
    if (this.isBoss) return;
    const width = Math.max(28, this.radius * 2 + 8);
    const height = 4;
    const x = -width / 2;
    const y = -this.radius - 10;
    this.hpBar.clear().setVisible(true);
    this.hpBar.fillStyle(COLORS.hpBack, 0.9).fillRect(x - 1, y - 1, width + 2, height + 2);
    this.hpBar.fillStyle(COLORS.hpFill, 1).fillRect(x, y, width * (this.hp / this.stats.maxHp), height);
  }
}
