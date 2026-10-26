import Phaser from 'phaser';
import { TAP } from '../config/constants';
import { hasLineOfSight } from '../core/collision';
import { isInReach } from '../core/combat';
import { findPath } from '../core/pathfinding';
import type { AllyDef } from '../data/types';
import { Actor } from './Actor';
import type { Enemy } from './Enemy';
import type { Player } from './Player';
import type { WorldContext } from './WorldContext';

const RETARGET_SECONDS = 0.3;
const REPATH_SECONDS = 0.35;
const FOLLOW_DISTANCE = 70;
const FADE_MS = 700;

export interface AllyOverrides {
  lifetimeMs?: number;
  /** Faktor auf den Schaden (aus Talenten). */
  damageBoost?: number;
}

/**
 * Herbeigerufener Verbündeter (Drohne, Crewmitglied). Kämpft für begrenzte Zeit, ist unverwundbar und
 * wird von Gegnern nicht angegriffen; folgt sonst der Spielerin.
 */
export class Ally extends Actor {
  readonly team = 'player';

  private lifeMs: number;
  private target: Enemy | null = null;
  private retargetTimer = 0;
  private repathTimer = 0;
  private leaving = false;

  constructor(
    scene: Phaser.Scene,
    world: WorldContext,
    x: number,
    y: number,
    readonly def: AllyDef,
    private readonly owner: Player,
    overrides: AllyOverrides = {},
  ) {
    const average = (owner.stats.damageMin + owner.stats.damageMax) / 2;
    const damage = average * def.damageFactor * (1 + (overrides.damageBoost ?? 0));
    super(
      scene,
      world,
      x,
      y,
      {
        maxHp: 1,
        moveSpeed: def.moveSpeed,
        radius: def.radius,
        damageMin: Math.max(1, Math.round(damage * 0.85)),
        damageMax: Math.max(1, Math.round(damage * 1.15)),
        attackRange: def.attackRange,
        attackCooldownMs: def.attackCooldownMs,
      },
      def.textureId,
    );
    this.basic = def.basic;
    this.lifeMs = overrides.lifetimeMs ?? def.lifetimeMs;
    this.setAlpha(0.9);
  }

  override takeDamage(): number {
    return 0;
  }

  protected override onDeath(): void {}

  /** Entlässt den Verbündeten sofort (blendet aus). */
  dismiss(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.tweens.add({ targets: this, alpha: 0, duration: FADE_MS, onComplete: () => this.destroy() });
  }

  get isLeaving(): boolean {
    return this.leaving;
  }

  tick(dt: number, enemies: readonly Enemy[]): void {
    if (this.leaving) return;
    this.tickTimers(dt);
    this.lifeMs -= dt * 1000;
    if (this.lifeMs <= 0) {
      this.dismiss();
      return;
    }

    this.retargetTimer -= dt;
    if (this.retargetTimer <= 0 || this.target?.isDead) {
      this.retargetTimer = RETARGET_SECONDS;
      this.target = this.pickTarget(enemies);
    }

    const target = this.target;
    if (target) {
      const ranged = this.basic.kind === 'ranged';
      const sight = !ranged || hasLineOfSight(this.world.grid, this.x, this.y, target.x, target.y);
      if (sight && isInReach(this, target, this.stats.attackRange)) {
        this.follower.clear();
        this.faceToward(target.x, target.y);
        this.tryAttack(target);
        return;
      }
      this.moveToward(target, dt);
      return;
    }

    // Kein Gegner: bei der Spielerin bleiben.
    if (Phaser.Math.Distance.Between(this.x, this.y, this.owner.x, this.owner.y) > FOLLOW_DISTANCE) this.moveToward(this.owner, dt);
    else this.follower.clear();
  }

  private pickTarget(enemies: readonly Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = this.def.aggroRange;
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist < bestDist) {
        best = enemy;
        bestDist = dist;
      }
    }
    return best;
  }

  private moveToward(goal: { x: number; y: number }, dt: number): void {
    this.repathTimer -= dt;
    if (this.repathTimer <= 0 || !this.follower.active) {
      this.repathTimer = REPATH_SECONDS;
      const path = findPath(this.world.grid, this, goal, this.radius, TAP.snapTiles);
      if (path) this.follower.setPath(path);
    }
    this.followPath(dt);
  }
}
