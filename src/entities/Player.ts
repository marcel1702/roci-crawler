import Phaser from 'phaser';
import { ABILITIES } from '../abilities';
import type { AbilityDef } from '../abilities';
import { GAME_EVENTS, POTION, TAP, TEXTURE_SCALE, actorTextureKey } from '../config/constants';
import { COLORS } from '../config/palette';
import { edgeDistance, isInReach } from '../core/combat';
import { Cooldown } from '../core/cooldown';
import { findPath } from '../core/pathfinding';
import type { Progression } from '../core/progression';
import { statsAtLevel } from '../core/stats';
import type { ClassDef } from '../data/types';
import { t } from '../i18n';
import { Actor } from './Actor';
import type { Enemy } from './Enemy';
import type { WorldContext } from './WorldContext';

const CHASE_REPATH_SECONDS = 0.2;
/** Berührungsabstand (Ränder), ab dem ein Sturmangriff einen Gegner rammt. */
const RAM_CONTACT = 4;
const GHOST_INTERVAL_S = 0.035;

export interface AbilitySlot {
  def: AbilityDef;
  cooldown: Cooldown;
}

interface DashState {
  dirX: number;
  dirY: number;
  remaining: number;
  speed: number;
  onHit: (enemy: Enemy) => void;
}

/** Die Spielfigur. Bekommt Befehle (laufen / Gegner angreifen / Fähigkeit) von Eingabe und HUD. */
export class Player extends Actor {
  readonly team = 'player';
  readonly classDef: ClassDef;
  readonly progression: Progression;
  readonly abilities: AbilitySlot[];
  readonly potionCooldown = new Cooldown();
  attackTarget: Enemy | null = null;
  potions: number = POTION.charges;

  private repathTimer = 0;
  private dash: DashState | null = null;
  private ghostTimer = 0;
  private guardMs = 0;
  private readonly aura: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    world: WorldContext,
    x: number,
    y: number,
    classDef: ClassDef,
    progression: Progression,
  ) {
    super(scene, world, x, y, statsAtLevel(classDef.stats, classDef.growth, progression.level), classDef.id);
    this.classDef = classDef;
    this.progression = progression;
    this.abilities = classDef.abilities.map((id) => ({ def: ABILITIES[id], cooldown: new Cooldown() }));

    this.aura = new Phaser.GameObjects.Graphics(scene).setVisible(false);
    this.addAt(this.aura, 1);
  }

  get isDashing(): boolean {
    return this.dash !== null;
  }

  /** Läuft zum Zielpunkt. Liefert false, wenn es dorthin keinen Weg gibt oder die Figur gerade stürmt. */
  commandMoveTo(x: number, y: number): boolean {
    if (this.dash) return false;
    const path = findPath(this.world.grid, this, { x, y }, this.radius, TAP.snapTiles);
    if (!path) return false;
    this.setAttackTarget(null);
    this.follower.setPath(path);
    return true;
  }

  /** Läuft zum Gegner und greift ihn an, bis er tot ist oder ein neuer Befehl kommt. */
  commandAttack(enemy: Enemy): void {
    if (this.dash) return;
    this.setAttackTarget(enemy);
    this.follower.clear();
    this.repathTimer = 0;
  }

  /** Löst die Fähigkeit auf Taste `index` aus. Liefert true, wenn sie gewirkt hat. */
  useAbility(index: number): boolean {
    const slot = this.abilities[index];
    if (!slot || this.isDead || this.isStunned || this.dash || !slot.cooldown.ready) return false;
    const done = slot.def.execute({ player: this, world: this.world, scene: this.scene });
    if (done) slot.cooldown.trigger(slot.def.cooldownMs);
    return done;
  }

  usePotion(): boolean {
    if (this.isDead || this.potions <= 0 || !this.potionCooldown.ready || this.hp >= this.stats.maxHp) return false;
    const healed = this.heal(Math.round(this.stats.maxHp * POTION.healFraction));
    this.potions--;
    this.potionCooldown.trigger(POTION.cooldownMs);
    this.world.combat.floatText(this.x, this.y - this.radius - 6, `+${healed}`, COLORS.heal);
    this.world.combat.ring(this.x, this.y, 38, 0x6dff9a, 320);
    return true;
  }

  /** Stürmt `distance` Pixel in Richtung `angle`; stoppt am ersten gerammten Gegner und ruft dann `onHit`. */
  startDash(angle: number, distance: number, speed: number, onHit: (enemy: Enemy) => void): void {
    this.follower.clear();
    this.sprite.rotation = angle;
    this.ghostTimer = 0;
    this.dash = { dirX: Math.cos(angle), dirY: Math.sin(angle), remaining: distance, speed, onHit };
  }

  /** Schadensminderung für `durationMs`. */
  startGuard(durationMs: number, damageTaken: number): void {
    this.guardMs = durationMs;
    this.damageTakenMultiplier = damageTaken;
    this.aura.setVisible(true);
  }

  gainXp(amount: number): void {
    const reached = this.progression.gain(amount);
    const level = reached.at(-1);
    if (level === undefined) return;

    this.stats = statsAtLevel(this.classDef.stats, this.classDef.growth, level);
    this.hp = this.stats.maxHp;
    this.world.combat.ring(this.x, this.y, 50, 0xffd34d, 450);
    this.world.combat.floatText(this.x, this.y - this.radius - 20, t('hud.levelUp', { level }), COLORS.elite, 15);
    this.scene.game.events.emit(GAME_EVENTS.playerLevelUp, level);
  }

  tick(dt: number): void {
    if (this.isDead) return;
    this.tickTimers(dt);
    this.potionCooldown.update(dt * 1000);
    for (const slot of this.abilities) slot.cooldown.update(dt * 1000);
    this.tickGuard(dt);

    if (this.dash) {
      this.tickDash(dt);
      return;
    }
    if (this.isStunned) return;

    const target = this.attackTarget;
    if (target?.isDead) this.setAttackTarget(null);
    else if (target) {
      if (isInReach(this, target, this.stats.attackRange)) {
        this.follower.clear();
        this.faceToward(target.x, target.y);
        this.tryAttack(target);
      } else {
        this.chase(target, dt);
      }
      return;
    }
    this.followPath(dt);
  }

  protected override onDeath(): void {
    this.setAttackTarget(null);
    this.dash = null;
    this.aura.setVisible(false);
    this.setAlpha(0.45);
  }

  private tickDash(dt: number): void {
    const dash = this.dash;
    if (!dash) return;

    const step = Math.min(dash.remaining, dash.speed * dt);
    const moved = this.moveBy(dash.dirX * step, dash.dirY * step);
    dash.remaining -= step;

    this.ghostTimer -= dt;
    if (this.ghostTimer <= 0) {
      this.ghostTimer = GHOST_INTERVAL_S;
      this.spawnGhost();
    }

    const rammed = this.world.enemies.find((enemy) => !enemy.isDead && edgeDistance(this, enemy) <= RAM_CONTACT);
    if (rammed) {
      this.dash = null;
      dash.onHit(rammed);
    } else if (dash.remaining <= 0.01 || moved < step * 0.5) {
      this.dash = null;
    }
  }

  private tickGuard(dt: number): void {
    if (this.guardMs <= 0) return;
    this.guardMs -= dt * 1000;
    if (this.guardMs <= 0) {
      this.guardMs = 0;
      this.damageTakenMultiplier = 1;
      this.aura.clear().setVisible(false);
      return;
    }
    const pulse = 0.55 + 0.3 * Math.sin(this.scene.time.now / 120);
    this.aura
      .clear()
      .fillStyle(COLORS.guard, 0.14)
      .fillCircle(0, 0, this.radius + 7)
      .lineStyle(2, COLORS.guard, pulse)
      .strokeCircle(0, 0, this.radius + 7);
  }

  private spawnGhost(): void {
    const ghost = this.scene.add
      .image(this.x, this.y, actorTextureKey(this.classDef.id))
      .setScale(TEXTURE_SCALE)
      .setRotation(this.sprite.rotation)
      .setTint(COLORS.accent)
      .setAlpha(0.45)
      .setDepth(9);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 200, onComplete: () => ghost.destroy() });
  }

  private chase(target: Enemy, dt: number): void {
    this.repathTimer -= dt;
    if (this.repathTimer <= 0 || !this.follower.active) {
      this.repathTimer = CHASE_REPATH_SECONDS;
      const path = findPath(this.world.grid, this, target, this.radius, TAP.snapTiles);
      if (!path) {
        this.setAttackTarget(null);
        return;
      }
      this.follower.setPath(path);
    }
    this.followPath(dt);
  }

  private setAttackTarget(enemy: Enemy | null): void {
    if (this.attackTarget === enemy) return;
    this.attackTarget?.setTargeted(false);
    this.attackTarget = enemy;
    enemy?.setTargeted(true);
  }
}
