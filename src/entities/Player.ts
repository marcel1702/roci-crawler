import type Phaser from 'phaser';
import { TAP } from '../config/constants';
import { isInReach } from '../core/combat';
import { findPath } from '../core/pathfinding';
import type { ClassDef } from '../data/types';
import { Actor } from './Actor';
import type { Enemy } from './Enemy';
import type { WorldContext } from './WorldContext';

const CHASE_REPATH_SECONDS = 0.2;

/** Die Spielfigur. Bekommt Befehle (laufen / Gegner angreifen) vom TapControlSystem. */
export class Player extends Actor {
  readonly team = 'player';
  readonly classDef: ClassDef;
  attackTarget: Enemy | null = null;

  private repathTimer = 0;

  constructor(scene: Phaser.Scene, world: WorldContext, x: number, y: number, classDef: ClassDef) {
    super(scene, world, x, y, classDef.stats, classDef.id);
    this.classDef = classDef;
  }

  /** Läuft zum Zielpunkt. Liefert false, wenn es dorthin keinen Weg gibt. */
  commandMoveTo(x: number, y: number): boolean {
    const path = findPath(this.world.grid, this, { x, y }, this.radius, TAP.snapTiles);
    if (!path) return false;
    this.setAttackTarget(null);
    this.follower.setPath(path);
    return true;
  }

  /** Läuft zum Gegner und greift ihn an, bis er tot ist oder ein neuer Befehl kommt. */
  commandAttack(enemy: Enemy): void {
    this.setAttackTarget(enemy);
    this.follower.clear();
    this.repathTimer = 0;
  }

  tick(dt: number): void {
    if (this.isDead) return;
    this.tickTimers(dt);

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
    this.setAlpha(0.45);
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
