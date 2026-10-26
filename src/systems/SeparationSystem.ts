import type { Actor } from '../entities/Actor';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';

/**
 * Verhindert, dass sich Akteure überlagern. Der Spieler wird nie geschoben,
 * Gegner weichen ihm und einander aus (Wandkollision bleibt über `moveBy` erhalten).
 */
export function separateActors(player: Player, enemies: readonly Enemy[]): void {
  const living = enemies.filter((enemy) => !enemy.isDead);
  for (let i = 0; i < living.length; i++) {
    const a = living[i] as Enemy;
    pushApart(a, player, 1, 0);
    for (let j = i + 1; j < living.length; j++) pushApart(a, living[j] as Enemy, 0.5, 0.5);
  }
}

function pushApart(a: Actor, b: Actor, weightA: number, weightB: number): void {
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  let dist = Math.hypot(dx, dy);
  const overlap = a.radius + b.radius - dist;
  if (overlap <= 0) return;

  if (dist < 0.001) {
    // Exakt übereinander: beliebige, aber feste Richtung wählen.
    dx = 1;
    dy = 0;
    dist = 1;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  if (weightA > 0) a.moveBy(nx * overlap * weightA, ny * overlap * weightA);
  if (weightB > 0) b.moveBy(-nx * overlap * weightB, -ny * overlap * weightB);
}
