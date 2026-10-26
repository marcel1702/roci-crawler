/** Einfache Abklingzeit in Millisekunden. */
export class Cooldown {
  private remainingMs = 0;

  get ready(): boolean {
    return this.remainingMs <= 0;
  }

  trigger(durationMs: number): void {
    this.remainingMs = durationMs;
  }

  update(deltaMs: number): void {
    if (this.remainingMs > 0) this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
  }
}
