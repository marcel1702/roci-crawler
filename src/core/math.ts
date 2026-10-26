export interface Vec2 {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/** Kürzester Abstand eines Punktes zur Strecke a-b. */
export function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Der Punkt, um den sich die meisten anderen Punkte (innerhalb `radius`) scharen; null bei leerer Liste. */
export function densestPoint(points: readonly Vec2[], radius: number): Vec2 | null {
  let best: Vec2 | null = null;
  let bestScore = -1;
  for (const p of points) {
    let score = 0;
    let spread = 0;
    for (const q of points) {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d <= radius) {
        score++;
        spread += d;
      }
    }
    // Bei gleicher Anzahl gewinnt die engere Gruppe.
    const value = score * 1000 - spread;
    if (value > bestScore) {
      bestScore = value;
      best = p;
    }
  }
  return best;
}
