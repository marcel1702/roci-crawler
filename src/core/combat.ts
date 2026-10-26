import type { Circle } from './collision';
import type { Rng } from './rng';

export interface DamageRange {
  damageMin: number;
  damageMax: number;
}

export function rollDamage(range: DamageRange, rng: Rng): number {
  return rng.int(range.damageMin, range.damageMax);
}

/** Abstand der Kreisränder (negativ bei Überlappung). */
export function edgeDistance(a: Circle, b: Circle): number {
  return Math.hypot(b.x - a.x, b.y - a.y) - a.radius - b.radius;
}

/** Nahkampfreichweite wird vom Rand zu Rand gemessen, damit große Gegner nicht schwerer zu treffen sind. */
export function isInReach(attacker: Circle, target: Circle, range: number): boolean {
  return edgeDistance(attacker, target) <= range;
}
