import Phaser from 'phaser';
import { TEXTURE_KEYS, TEXTURE_SCALE } from '../config/constants';
import { stepProjectile } from '../core/projectile';
import type { ProjectileState } from '../core/projectile';
import type { Actor, Team } from '../entities/Actor';
import type { WorldContext } from '../entities/WorldContext';

export interface ProjectileSpawn {
  source: Actor;
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  radius?: number;
  crit?: boolean;
  /** Farbe des Geschosses (Standard: Gelb der Gegner). */
  tint?: number;
  /** Flugzeit in Sekunden, danach verschwindet das Geschoss. */
  lifetime?: number;
}

interface LiveProjectile {
  state: ProjectileState;
  team: Team;
  damage: number;
  crit: boolean;
  source: Actor;
  sprite: Phaser.GameObjects.Image;
}

/** Fliegende Geschosse: bewegen, an Wänden stoppen, Akteure des gegnerischen Teams treffen. */
export class ProjectileSystem {
  private live: LiveProjectile[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: Pick<WorldContext, 'grid' | 'combat'>,
    private readonly targetsOf: (team: Team) => readonly Actor[],
  ) {}

  spawn(spec: ProjectileSpawn): void {
    const radius = spec.radius ?? 4;
    const sprite = this.scene.add
      .image(spec.x, spec.y, TEXTURE_KEYS.projectile)
      .setScale(TEXTURE_SCALE * (radius / 4))
      .setDepth(40);
    if (spec.tint !== undefined) sprite.setTint(spec.tint);
    this.live.push({
      state: {
        x: spec.x,
        y: spec.y,
        vx: Math.cos(spec.angle) * spec.speed,
        vy: Math.sin(spec.angle) * spec.speed,
        radius,
        ttl: spec.lifetime ?? 3,
      },
      team: spec.source.team,
      damage: spec.damage,
      crit: spec.crit ?? false,
      source: spec.source,
      sprite,
    });
  }

  update(dt: number): void {
    const survivors: LiveProjectile[] = [];
    for (const projectile of this.live) {
      const outcome = stepProjectile(this.world.grid, projectile.state, dt);
      const { x, y, radius } = projectile.state;
      projectile.sprite.setPosition(x, y);

      if (outcome === 'hitWall') {
        this.spark(x, y);
        projectile.sprite.destroy();
        continue;
      }
      if (outcome === 'expired') {
        projectile.sprite.destroy();
        continue;
      }

      const victim = this.targetsOf(projectile.team === 'player' ? 'enemy' : 'player').find(
        (target) => !target.isDead && Math.hypot(target.x - x, target.y - y) <= target.radius + radius,
      );
      if (victim) {
        this.world.combat.dealDamage(projectile.source, victim, projectile.damage, projectile.crit);
        this.spark(x, y);
        projectile.sprite.destroy();
        continue;
      }
      survivors.push(projectile);
    }
    this.live = survivors;
  }

  clear(): void {
    for (const projectile of this.live) projectile.sprite.destroy();
    this.live = [];
  }

  private spark(x: number, y: number): void {
    const ring = this.scene.add.circle(x, y, 3, 0xffe08a, 0.9).setDepth(41);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 160,
      onComplete: () => ring.destroy(),
    });
  }
}
