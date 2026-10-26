/** Einfache Abklingzeit in Millisekunden. */
export class Cooldown {
  private remainingMs = 0;
  private durationMs = 0;

  get ready(): boolean {
    return this.remainingMs <= 0;
  }

  /** Verbleibende Zeit in ms. */
  get remaining(): number {
    return this.remainingMs;
  }

  /** Verbleibender Anteil, 1 = gerade ausgelöst, 0 = bereit. */
  get fraction(): number {
    return this.durationMs > 0 ? this.remainingMs / this.durationMs : 0;
  }

  trigger(durationMs: number): void {
    this.remainingMs = durationMs;
    this.durationMs = durationMs;
  }

  update(deltaMs: number): void {
    if (this.remainingMs > 0) this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
  }

  reset(): void {
    this.remainingMs = 0;
  }
}
