import { COLORS } from '../config/palette';
import { edgeDistance } from '../core/combat';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { AbilityDef } from './types';

const RAMMBOCK = { distance: 140, speed: 640, damageMultiplier: 1.5, stunMs: 1200, targetRange: 240, knockback: 220 } as const;
const STANDHAFT = { durationMs: 4500, damageTaken: 0.5, tauntRadius: 230, tauntMs: 4500 } as const;
const SCHLAG = { radius: 72, damageMultiplier: 2.2, stunMs: 500, knockback: 150 } as const;

/** Bevorzugt das aktuelle Angriffsziel, sonst den nächsten Gegner in Reichweite. */
function pickTarget(player: Player, enemies: readonly Enemy[]): Enemy | null {
  const target = player.attackTarget;
  if (target && !target.isDead && edgeDistance(player, target) <= RAMMBOCK.targetRange) return target;

  let nearest: Enemy | null = null;
  let nearestDist: number = RAMMBOCK.targetRange;
  for (const enemy of enemies) {
    if (enemy.isDead) continue;
    const dist = edgeDistance(player, enemy);
    if (dist < nearestDist) {
      nearest = enemy;
      nearestDist = dist;
    }
  }
  return nearest;
}

/** Sturmangriff auf den nächsten Gegner: rammt ihn, verursacht Schaden und betäubt ihn. */
const rammbock: AbilityDef = {
  id: 'rammbock',
  nameKey: 'ability.rammbock.name',
  icon: 'dash',
  cooldownMs: 7000,
  execute({ player, world, boost }) {
    const target = pickTarget(player, world.enemies);
    const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facing;
    player.startDash(angle, RAMMBOCK.distance, RAMMBOCK.speed, (enemy) => {
      world.combat.attack(player, enemy, RAMMBOCK.damageMultiplier * (1 + boost.damage), RAMMBOCK.knockback);
      enemy.stun(RAMMBOCK.stunMs);
      world.combat.ring(enemy.x, enemy.y, 34, COLORS.accent, 220);
      player.scene.cameras.main.shake(110, 0.006);
    });
    return true;
  },
};

/** Schadensminderung und Spott: Gegner in der Nähe werden herangezogen, Schützen hören auf, Abstand zu halten. */
const standhaft: AbilityDef = {
  id: 'standhaft',
  nameKey: 'ability.standhaft.name',
  icon: 'shield',
  cooldownMs: 14000,
  execute({ player, world, boost }) {
    player.startBuff('standhaft', STANDHAFT.durationMs * (1 + boost.duration), { damageTaken: STANDHAFT.damageTaken, aura: COLORS.guard });
    for (const enemy of world.enemies) {
      if (!enemy.isDead && edgeDistance(player, enemy) <= STANDHAFT.tauntRadius) enemy.taunt(STANDHAFT.tauntMs);
    }
    world.combat.ring(player.x, player.y, STANDHAFT.tauntRadius * 0.5, COLORS.guard, 380);
    return true;
  },
};

/** Schlag rundherum: starker Flächenschaden mit kurzer Betäubung. Ohne Gegner in Reichweite passiert nichts. */
const gnadenloserSchlag: AbilityDef = {
  id: 'gnadenloser-schlag',
  nameKey: 'ability.gnadenloser-schlag.name',
  icon: 'slam',
  cooldownMs: 9000,
  execute({ player, world, boost }) {
    const radius = SCHLAG.radius * (1 + boost.area);
    const hit = world.enemies.filter((enemy) => !enemy.isDead && edgeDistance(player, enemy) <= radius);
    if (hit.length === 0) return false;
    for (const enemy of hit) {
      world.combat.attack(player, enemy, SCHLAG.damageMultiplier * (1 + boost.damage), SCHLAG.knockback);
      enemy.stun(SCHLAG.stunMs);
    }
    world.combat.ring(player.x, player.y, radius + player.radius, 0xffffff, 300);
    player.scene.cameras.main.shake(130, 0.008);
    return true;
  },
};

export const AMOS_ABILITIES = { rammbock, standhaft, 'gnadenloser-schlag': gnadenloserSchlag } as const;
