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

/** Kleinster Winkelunterschied zweier Richtungen in Radiant (0..π). */
export function angleDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % (Math.PI * 2);
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
}

/**
 * True, wenn das Ziel (Kreis) den Kreissektor um `origin` berührt: Richtung `aim`, halber Öffnungswinkel
 * `halfAngle`, Radius `reach` (gemessen bis zum Rand des Ziels). Mit halfAngle = π ein voller Kreis.
 */
export function isInSector(origin: Circle, aim: number, halfAngle: number, target: Circle, reach: number): boolean {
  const dist = Math.hypot(target.x - origin.x, target.y - origin.y);
  if (dist - target.radius > reach) return false;
  if (halfAngle >= Math.PI || dist <= target.radius) return true;
  const toTarget = Math.atan2(target.y - origin.y, target.x - origin.x);
  // Ein Ziel mit Ausdehnung wird schon getroffen, wenn nur sein Rand im Sektor liegt.
  const widen = Math.asin(Math.min(1, target.radius / dist));
  return angleDifference(aim, toTarget) <= halfAngle + widen;
}
