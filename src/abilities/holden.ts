import { ALLIES } from '../data/allies';
import type { AbilityDef } from './types';
import { clusterTarget } from './bobbie';

const BARRAGE = { range: 340, clusterRadius: 70, shells: 4, intervalMs: 300, warnMs: 800, spread: 45, radius: 58, damageMultiplier: 1.0 } as const;
const INSPIRE = { healFraction: 0.35, durationMs: 6000, damage: 1.25, speed: 1.25 } as const;
const ORANGE = 0xffb347;
const GREEN = 0x6dff9a;

/** Die Rocinante nimmt eine Gegnergruppe unter Sperrfeuer: erst eine Warnzone, dann mehrere Einschläge. */
const sperrfeuer: AbilityDef = {
  id: 'sperrfeuer',
  nameKey: 'ability.sperrfeuer.name',
  icon: 'barrage',
  cooldownMs: 14000,
  execute(ctx) {
    const { player, world, boost } = ctx;
    const center = clusterTarget(ctx, BARRAGE.range, BARRAGE.clusterRadius);
    if (!center) return false;

    const radius = BARRAGE.radius * (1 + boost.area);
    world.combat.ring(center.x, center.y, BARRAGE.spread + radius, ORANGE, BARRAGE.warnMs + BARRAGE.shells * BARRAGE.intervalMs);
    for (let i = 0; i < BARRAGE.shells; i++) {
      const angle = world.rng.next() * Math.PI * 2;
      const dist = world.rng.next() * BARRAGE.spread;
      const x = center.x + Math.cos(angle) * dist;
      const y = center.y + Math.sin(angle) * dist;
      player.scene.time.delayedCall(BARRAGE.warnMs + i * BARRAGE.intervalMs, () => {
        if (player.isDead) return;
        world.combat.ring(x, y, radius, ORANGE, 260);
        world.combat.areaDamage(player, x, y, radius, BARRAGE.damageMultiplier * (1 + boost.damage), world.enemies);
        player.scene.cameras.main.shake(70, 0.004);
      });
    }
    return true;
  },
};

/** Amos greift für einige Sekunden ein. */
const amosEingriff: AbilityDef = {
  id: 'amos-eingriff',
  nameKey: 'ability.amos-eingriff.name',
  icon: 'ally',
  cooldownMs: 18000,
  execute({ player, world, boost }) {
    const ally = world.spawnAlly(ALLIES.amos, player.x + 22, player.y, player, {
      lifetimeMs: ALLIES.amos.lifetimeMs * (1 + boost.duration),
      damageBoost: boost.damage,
    });
    if (!ally) return false;
    world.combat.ring(ally.x, ally.y, 34, 0xd9822b, 320);
    return true;
  },
};

/** Heilt etwas und treibt an: mehr Schaden und Tempo für kurze Zeit. */
const inspirieren: AbilityDef = {
  id: 'inspirieren',
  nameKey: 'ability.inspirieren.name',
  icon: 'inspire',
  cooldownMs: 20000,
  execute({ player, world, boost }) {
    const healed = player.heal(player.stats.maxHp * INSPIRE.healFraction);
    if (healed >= 1) world.combat.floatText(player.x, player.y - player.radius - 6, `+${Math.round(healed)}`, '#8dffb0', 13);
    player.startBuff('inspirieren', INSPIRE.durationMs * (1 + boost.duration), {
      damage: INSPIRE.damage + 0.25 * boost.damage,
      speed: INSPIRE.speed,
      aura: GREEN,
    });
    world.combat.ring(player.x, player.y, 46, GREEN, 360);
    return true;
  },
};

export const HOLDEN_ABILITIES = { sperrfeuer, 'amos-eingriff': amosEingriff, inspirieren } as const;
