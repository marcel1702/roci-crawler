import { moveCircle } from './collision';
import type { TileGrid } from './grid';
import type { Vec2 } from './math';

/** Bewegungswerte in der Schwerelosigkeit. Alles in Pixeln und Sekunden. */
export interface ZeroGParams {
  /** Beschleunigung durch Schub (px/s²). */
  thrust: number;
  /** Bis zu dieser Geschwindigkeit hilft der Schub; schneller wird man nur durch Stöße. */
  maxSpeed: number;
  /** Absolute Obergrenze (px/s), damit nichts durch Wände schießt. */
  hardMax: number;
  /** Sanfte Dämpfung pro Sekunde (ohne Eingriff gleitet man lange). */
  damping: number;
  /** Zusätzliche Dämpfung beim Stabilisieren. */
  brakeDamping: number;
  /** Anteil der Geschwindigkeit, der beim Abprallen an einer Wand bleibt. */
  restitution: number;
}

export const DEFAULT_ZEROG: ZeroGParams = {
  thrust: 520,
  maxSpeed: 170,
  hardMax: 520,
  damping: 0.45,
  brakeDamping: 7,
  restitution: 0.55,
};

export interface ZeroGBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface ZeroGResult {
  /** True, wenn der Körper in diesem Schritt an eine Wand stieß. */
  bumped: boolean;
}

/**
 * Ein Zeitschritt in der Schwerelosigkeit: Schub in `thrustDir` (Einheitsvektor oder null), Dämpfung, Abprallen.
 * `control` (1 = normal) verstärkt Schub, Dämpfung und Bremse (Gürtler-Ausrüstung, Talente).
 */
export function stepZeroG(
  grid: TileGrid,
  body: ZeroGBody,
  dt: number,
  thrustDir: Vec2 | null,
  params: ZeroGParams = DEFAULT_ZEROG,
  control = 1,
  brake = false,
): ZeroGResult {
  if (thrustDir) {
    const speed = Math.hypot(body.vx, body.vy);
    // Schub treibt nur bis zur Höchstgeschwindigkeit an; wer schneller ist (Stoß), bleibt es und muss gegensteuern.
    const along = speed > 0 ? (body.vx * thrustDir.x + body.vy * thrustDir.y) / speed : 0;
    const gain = speed >= params.maxSpeed && along > 0 ? 0 : params.thrust * control * dt;
    body.vx += thrustDir.x * gain;
    body.vy += thrustDir.y * gain;
  }

  const damp = (params.damping + (brake ? params.brakeDamping : 0)) * control;
  const factor = Math.exp(-damp * dt);
  body.vx *= factor;
  body.vy *= factor;

  const speed = Math.hypot(body.vx, body.vy);
  if (speed > params.hardMax) {
    body.vx *= params.hardMax / speed;
    body.vy *= params.hardMax / speed;
  }

  const moved = moveCircle(grid, body.x, body.y, body.radius, body.vx * dt, body.vy * dt);
  body.x = moved.x;
  body.y = moved.y;
  if (moved.blockedX) body.vx = -body.vx * params.restitution;
  if (moved.blockedY) body.vy = -body.vy * params.restitution;
  return { bumped: moved.blockedX || moved.blockedY };
}

/** Stoß (Rückstoß, Treffer): addiert Geschwindigkeit, begrenzt auf die Obergrenze. */
export function applyImpulse(body: Pick<ZeroGBody, 'vx' | 'vy'>, ix: number, iy: number, hardMax = DEFAULT_ZEROG.hardMax): void {
  body.vx += ix;
  body.vy += iy;
  const speed = Math.hypot(body.vx, body.vy);
  if (speed > hardMax) {
    body.vx *= hardMax / speed;
    body.vy *= hardMax / speed;
  }
}

/** Werte für einen Körper mit Lauftempo `moveSpeed`: gleiche Beschleunigungszeit, Höchsttempo = Lauftempo. */
export function paramsFor(moveSpeed: number): ZeroGParams {
  const scale = moveSpeed / DEFAULT_ZEROG.maxSpeed;
  return { ...DEFAULT_ZEROG, maxSpeed: moveSpeed, thrust: DEFAULT_ZEROG.thrust * scale };
}

/**
 * Schub für „Geschwindigkeit angleichen“ (Gegner, Verbündete): zeigt von der aktuellen Geschwindigkeit zur
 * Wunschgeschwindigkeit `speed` in Richtung (dirX, dirY) und wird bei kleinem Unterschied sanfter,
 * damit der Körper nicht um den Sollwert zittert. Liefert null, wenn schon alles passt.
 */
export function matchedThrust(body: Pick<ZeroGBody, 'vx' | 'vy'>, dirX: number, dirY: number, speed: number): Vec2 | null {
  const dx = dirX * speed - body.vx;
  const dy = dirY * speed - body.vy;
  const mag = Math.hypot(dx, dy);
  if (mag < 2) return null;
  const strength = Math.min(1, mag / 40);
  return { x: (dx / mag) * strength, y: (dy / mag) * strength };
}
