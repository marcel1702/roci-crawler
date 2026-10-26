import { describe, expect, it } from 'vitest';
import { PathFollower } from '../../src/core/follower';

describe('PathFollower', () => {
  it('läuft mit gegebener Geschwindigkeit auf den Wegpunkt zu', () => {
    const follower = new PathFollower();
    follower.setPath([{ x: 100, y: 0 }]);
    const step = follower.step(0, 0, 100, 0.1);
    expect(step.dx).toBeCloseTo(10);
    expect(step.dy).toBeCloseTo(0);
    follower.commit();
    expect(follower.active).toBe(true);
  });

  it('überschreitet Wegpunkte nicht und nutzt den Rest für den nächsten', () => {
    const follower = new PathFollower();
    follower.setPath([
      { x: 5, y: 0 },
      { x: 5, y: 20 },
    ]);
    const step = follower.step(0, 0, 100, 0.1); // 10 px: 5 nach rechts, 5 nach unten
    expect(step.dx).toBeCloseTo(5);
    expect(step.dy).toBeCloseTo(5);
  });

  it('endet nach dem letzten Wegpunkt (erst nach commit)', () => {
    const follower = new PathFollower();
    follower.setPath([{ x: 3, y: 0 }]);
    follower.step(0, 0, 100, 1);
    expect(follower.active).toBe(true);
    follower.commit();
    expect(follower.active).toBe(false);
  });

  it('überspringt Wegpunkte nicht, wenn die Bewegung blockiert war (kein commit)', () => {
    const follower = new PathFollower();
    follower.setPath([
      { x: 3, y: 0 },
      { x: 3, y: 50 },
    ]);
    follower.step(0, 0, 100, 1);
    // Figur ist tatsächlich nicht vorangekommen -> derselbe Wegpunkt bleibt Ziel.
    const again = follower.step(0, 0, 100, 0.01);
    expect(again.dx).toBeCloseTo(1);
    expect(again.dy).toBeCloseTo(0);
  });

  it('clear() leert den Weg', () => {
    const follower = new PathFollower();
    follower.setPath([{ x: 10, y: 10 }]);
    follower.clear();
    expect(follower.active).toBe(false);
    expect(follower.step(0, 0, 100, 1)).toEqual({ dx: 0, dy: 0 });
  });
});
