import { circleHitsSolid } from './collision';
import type { TileGrid } from './grid';

export interface ProjectileState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** Verbleibende Flugzeit in Sekunden. */
  ttl: number;
}

export type ProjectileOutcome = 'flying' | 'hitWall' | 'expired';

/** Bewegt ein Geschoss um `dt` Sekunden; kleine Teilschritte, damit schnelle Geschosse keine Wand überspringen. */
export function stepProjectile(grid: TileGrid, p: ProjectileState, dt: number): ProjectileOutcome {
  const distance = Math.hypot(p.vx, p.vy) * dt;
  const steps = Math.max(1, Math.ceil(distance / Math.max(2, p.radius)));
  for (let i = 0; i < steps; i++) {
    p.x += (p.vx * dt) / steps;
    p.y += (p.vy * dt) / steps;
    if (circleHitsSolid(grid, p.x, p.y, p.radius)) return 'hitWall';
  }
  p.ttl -= dt;
  return p.ttl <= 0 ? 'expired' : 'flying';
}
