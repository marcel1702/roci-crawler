import { describe, expect, it } from 'vitest';
import { Cooldown } from '../../src/core/cooldown';

describe('Cooldown', () => {
  it('meldet verbleibende Zeit und Anteil', () => {
    const c = new Cooldown();
    expect(c.fraction).toBe(0);
    c.trigger(1000);
    expect(c.fraction).toBe(1);
    c.update(250);
    expect(c.remaining).toBe(750);
    expect(c.fraction).toBeCloseTo(0.75);
  });

  it('reset macht sofort bereit', () => {
    const c = new Cooldown();
    c.trigger(5000);
    c.reset();
    expect(c.ready).toBe(true);
    expect(c.fraction).toBe(0);
  });
});
