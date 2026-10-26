/** Währung der Spielfigur (Credits). Wird später Teil des Spielstands. */
export class Wallet {
  constructor(public credits = 0) {}

  add(amount: number): void {
    if (amount > 0) this.credits += amount;
  }
}
