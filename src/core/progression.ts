export const MAX_LEVEL = 30;

/** Erfahrung, die von `level` auf `level + 1` nötig ist. */
export function xpToNextLevel(level: number): number {
  return Math.round(30 + 20 * level + 3 * level * level);
}

/** Stufe und Erfahrung einer Spielfigur. Lebt über Missionsneustarts hinweg (später im Spielstand). */
export class Progression {
  constructor(
    public level = 1,
    public xp = 0,
  ) {}

  get atMaxLevel(): boolean {
    return this.level >= MAX_LEVEL;
  }

  /** Fortschritt zur nächsten Stufe, 0..1. */
  get fraction(): number {
    return this.atMaxLevel ? 1 : this.xp / xpToNextLevel(this.level);
  }

  /** Fügt Erfahrung hinzu und liefert die dabei erreichten neuen Stufen (meist leer, selten mehrere). */
  gain(amount: number): number[] {
    const reached: number[] = [];
    if (this.atMaxLevel || amount <= 0) return reached;

    this.xp += amount;
    while (!this.atMaxLevel && this.xp >= xpToNextLevel(this.level)) {
      this.xp -= xpToNextLevel(this.level);
      this.level++;
      reached.push(this.level);
    }
    if (this.atMaxLevel) this.xp = 0;
    return reached;
  }
}
