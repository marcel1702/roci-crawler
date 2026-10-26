
import { rayDistance } from '../core/collision';
import { densestPoint, distanceToSegment } from '../core/math';
import type { Vec2 } from '../core/math';
import { TEXTURE_KEYS, TEXTURE_SCALE } from '../config/constants';
import type { AbilityContext, AbilityDef } from './types';

const SALVO = { range: 340, clusterRadius: 70, rockets: 3, rocketDelayMs: 220, flightMs: 600, spread: 30, radius: 56, damageMultiplier: 1.1, knockback: 110 } as const;
const SEAL = { durationMs: 5000, damageTaken: 0.3, speed: 0.5 } as const;
const GAUSS = { range: 420, length: 380, damageMultiplier: 2.6, width: 8, knockback: 160, recoil: 190 } as const;
const PURPLE = 0xb98bff;

/** Mittelpunkt der dichtesten Gegnergruppe in Reichweite, sonst null. */
export function clusterTarget(ctx: Pick<AbilityContext, 'player' | 'world'>, range: number, clusterRadius: number): Vec2 | null {
  const { player, world } = ctx;
  const points = world.enemies
    .filter((e) => !e.isDead && Math.hypot(e.x - player.x, e.y - player.y) <= range)
    .map((e) => ({ x: e.x, y: e.y }));
  return densestPoint(points, clusterRadius);
}

/** Schießt eine Rakete von der Figur zu einem Punkt; beim Einschlag wird `onImpact` ausgeführt. */
export function launchRocket(ctx: AbilityContext, to: Vec2, flightMs: number, onImpact: () => void): void {
  const { player, scene } = ctx;
  const rocket = scene.add.image(player.x, player.y, TEXTURE_KEYS.projectile).setScale(TEXTURE_SCALE * 1.4).setDepth(42).setTint(PURPLE);
  scene.tweens.add({
    targets: rocket,
    x: to.x,
    y: to.y,
    duration: flightMs,
    ease: 'Quad.easeIn',
    onComplete: () => {
      rocket.destroy();
      onImpact();
    },
  });
}

/** Drei Raketen auf die dichteste Gegnergruppe; die Einschlagzone wird vorher markiert. */
const raketensalve: AbilityDef = {
  id: 'raketensalve',
  nameKey: 'ability.raketensalve.name',
  icon: 'rockets',
  cooldownMs: 10000,
  execute(ctx) {
    const { player, world, boost } = ctx;
    const center = clusterTarget(ctx, SALVO.range, SALVO.clusterRadius);
    if (!center) return false;

    const radius = SALVO.radius * (1 + boost.area);
    world.combat.ring(center.x, center.y, SALVO.spread + radius, PURPLE, SALVO.flightMs + SALVO.rocketDelayMs * SALVO.rockets);
    for (let i = 0; i < SALVO.rockets; i++) {
      const angle = world.rng.next() * Math.PI * 2;
      const dist = world.rng.next() * SALVO.spread;
      const impact = { x: center.x + Math.cos(angle) * dist, y: center.y + Math.sin(angle) * dist };
      player.scene.time.delayedCall(i * SALVO.rocketDelayMs, () => {
        if (player.isDead) return;
        launchRocket(ctx, impact, SALVO.flightMs, () => {
          world.combat.ring(impact.x, impact.y, radius, 0xffb347, 260);
          world.combat.areaDamage(player, impact.x, impact.y, radius, SALVO.damageMultiplier * (1 + boost.damage), world.enemies, 0, SALVO.knockback);
          player.scene.cameras.main.shake(80, 0.004);
        });
      });
    }
    return true;
  },
};

/** Versiegelt die Rüstung: deutlich weniger Schaden, dafür langsamer. */
const ruestung: AbilityDef = {
  id: 'ruestung',
  nameKey: 'ability.ruestung.name',
  icon: 'armor',
  cooldownMs: 16000,
  execute({ player, world, boost }) {
    player.startBuff('ruestung', SEAL.durationMs * (1 + boost.duration), { damageTaken: SEAL.damageTaken, speed: SEAL.speed, aura: 0xffd34d });
    world.combat.ring(player.x, player.y, 40, 0xffd34d, 340);
    return true;
  },
};

/** Durchschlagender Strahl: trifft alle Gegner auf der Linie. */
const gauss: AbilityDef = {
  id: 'gauss',
  nameKey: 'ability.gauss.name',
  icon: 'gauss',
  cooldownMs: 8000,
  execute({ player, world, boost, scene }) {
    let aimed = player.attackTarget && !player.attackTarget.isDead ? player.attackTarget : null;
    if (!aimed) {
      let bestDist: number = GAUSS.range;
      for (const enemy of world.enemies) {
        const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (!enemy.isDead && d < bestDist) {
          aimed = enemy;
          bestDist = d;
        }
      }
    }
    if (!aimed) return false;

    const angle = Math.atan2(aimed.y - player.y, aimed.x - player.x);
    const length = rayDistance(world.grid, player.x, player.y, angle, GAUSS.length);
    const ex = player.x + Math.cos(angle) * length;
    const ey = player.y + Math.sin(angle) * length;
    player.faceToward(aimed.x, aimed.y);
    player.pushAlong(-Math.cos(angle), -Math.sin(angle), GAUSS.recoil);

    for (const enemy of world.enemies) {
      if (enemy.isDead) continue;
      if (distanceToSegment(enemy.x, enemy.y, player.x, player.y, ex, ey) <= enemy.radius + GAUSS.width) {
        world.combat.attack(player, enemy, GAUSS.damageMultiplier * (1 + boost.damage), GAUSS.knockback);
      }
    }

    const beam = scene.add.graphics().setDepth(50);
    beam.lineStyle(7, PURPLE, 0.35).lineBetween(player.x, player.y, ex, ey);
    beam.lineStyle(3, 0xffffff, 0.95).lineBetween(player.x, player.y, ex, ey);
    scene.tweens.add({ targets: beam, alpha: 0, duration: 220, onComplete: () => beam.destroy() });
    scene.cameras.main.shake(100, 0.006);
    return true;
  },
};

export const BOBBIE_ABILITIES = { raketensalve, ruestung, gauss } as const;
