import type { Vec2 } from './math';

export interface FollowStep {
  dx: number;
  dy: number;
}

/** Läuft eine Wegpunktliste ab. Rein rechnerisch: liefert pro Frame die gewünschte Verschiebung. */
export class PathFollower {
  private path: Vec2[] = [];
  private index = 0;
  private pendingIndex = 0;

  get active(): boolean {
    return this.index < this.path.length;
  }

  setPath(path: Vec2[]): void {
    this.path = path;
    this.index = 0;
    this.pendingIndex = 0;
  }

  clear(): void {
    this.path = [];
    this.index = 0;
    this.pendingIndex = 0;
  }

  /**
   * Verschiebung für `dt` Sekunden bei `speed` Pixel/Sekunde; geht über mehrere Wegpunkte hinweg.
   * Erreichte Wegpunkte zählen erst nach `commit()`, damit eine blockierte Bewegung sie nicht überspringt.
   */
  step(x: number, y: number, speed: number, dt: number): FollowStep {
    let remaining = speed * dt;
    let cx = x;
    let cy = y;
    let index = this.index;

    while (remaining > 0 && index < this.path.length) {
      const waypoint = this.path[index] as Vec2;
      const dx = waypoint.x - cx;
      const dy = waypoint.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist <= remaining) {
        cx = waypoint.x;
        cy = waypoint.y;
        remaining -= dist;
        index++;
      } else {
        cx += (dx / dist) * remaining;
        cy += (dy / dist) * remaining;
        remaining = 0;
      }
    }
    this.pendingIndex = index;
    return { dx: cx - x, dy: cy - y };
  }

  /** Übernimmt die Wegpunkte des letzten `step()`, wenn die Bewegung vollständig gelungen ist. */
  commit(): void {
    this.index = this.pendingIndex;
  }
}
