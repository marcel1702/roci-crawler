import { shake } from '../platform/effects';
import { edgeDistance } from '../core/combat';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { ALLIES } from '../data/allies';
import type { AbilityDef } from './types';

const DRONE = { damageBoostBase: 0 } as const;
const HACK = { range: 280, stunMs: 2500, markMs: 5000, damageTaken: 1.35 } as const;
const EMP = { radius: 110, damageMultiplier: 0.9, stunMs: 2000, knockback: 110 } as const;
const CYAN = 0x5fd8ff;

function nearest(player: Player, enemies: readonly Enemy[], range: number): Enemy | null {
  const target = player.attackTarget;
  if (target && !target.isDead && edgeDistance(player, target) <= range) return target;
  let best: Enemy | null = null;
  let bestDist = range;
  for (const enemy of enemies) {
    if (enemy.isDead) continue;
    const dist = edgeDistance(player, enemy);
    if (dist < bestDist) {
      best = enemy;
      bestDist = dist;
    }
  }
  return best;
}

/** Eine Kampfdrohne schwebt mit und schießt auf nahe Gegner. */
const kampfdrohne: AbilityDef = {
  id: 'kampfdrohne',
  nameKey: 'ability.kampfdrohne.name',
  icon: 'drone',
  cooldownMs: 14000,
  execute({ player, world, boost }) {
    const ally = world.spawnAlly(ALLIES.drone, player.x, player.y - 14, player, {
      lifetimeMs: ALLIES.drone.lifetimeMs * (1 + boost.duration),
      damageBoost: boost.damage + DRONE.damageBoostBase,
    });
    if (!ally) return false;
    world.combat.ring(player.x, player.y, 34, CYAN, 320);
    return true;
  },
};

/** Hackt den nächsten Gegner: betäubt ihn und lässt ihn mehr Schaden nehmen. */
const hack: AbilityDef = {
  id: 'hack',
  nameKey: 'ability.hack.name',
  icon: 'hack',
  cooldownMs: 9000,
  execute({ player, world, boost }) {
    const target = nearest(player, world.enemies, HACK.range);
    if (!target) return false;
    target.stun(HACK.stunMs * (1 + boost.duration));
    target.hack(HACK.markMs * (1 + boost.duration), 1 + (HACK.damageTaken - 1) * (1 + boost.damage));
    world.combat.ring(target.x, target.y, 40, CYAN, 380);
    return true;
  },
};

/** EMP-Impuls: betäubt und beschädigt alle Gegner ringsum. */
const emp: AbilityDef = {
  id: 'emp',
  nameKey: 'ability.emp.name',
  icon: 'emp',
  cooldownMs: 12000,
  execute({ player, world, boost }) {
    const radius = EMP.radius * (1 + boost.area);
    const hits = world.combat.areaDamage(player, player.x, player.y, radius, EMP.damageMultiplier * (1 + boost.damage), world.enemies, EMP.stunMs, EMP.knockback);
    if (hits === 0) return false;
    world.combat.ring(player.x, player.y, radius + player.radius, CYAN, 340);
    shake(player.scene, 110, 0.005);
    return true;
  },
};

export const NAOMI_ABILITIES = { kampfdrohne, hack, emp } as const;
