export interface Rng {
  /** Gleichverteilt in [0, 1). */
  next(): number;
  /** Ganzzahl in [min, max], beide inklusive. */
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Neue, zufällig gemischte Liste (Fisher-Yates); die Eingabe bleibt unverändert. */
  shuffle<T>(items: readonly T[]): T[];
}

/** Deterministischer Zufall (mulberry32). Gleicher Seed -> gleiche Folge; Grundlage für Dungeons und Beute. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (probability) => next() < probability,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick() aus leerer Liste');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    shuffle: (items) => {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [result[i], result[j]] = [result[j] as (typeof items)[number], result[i] as (typeof items)[number]];
      }
      return result;
    },
  };
}
