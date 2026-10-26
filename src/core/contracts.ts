import type { Rng } from './rng';

export type Difficulty = 'normal' | 'hard';

/** Wie sich die Schwierigkeit auswirkt. `loot` hebt die Gewichte seltener Beute, `credits` die Truhen-Credits. */
export const DIFFICULTY_RULES: Record<Difficulty, { hp: number; damage: number; loot: number; credits: number }> = {
  normal: { hp: 1, damage: 1, loot: 1, credits: 1 },
  hard: { hp: 1.35, damage: 1.2, loot: 1.8, credits: 1.5 },
};

/** Ein Auftrag der Missionskonsole: Ort, Schwierigkeit und der Seed des Dungeons. */
export interface Contract {
  seed: number;
  /** Index in der Liste der Ortsnamen (`contract.location.<n>`). */
  location: number;
  difficulty: Difficulty;
}

export const LOCATION_COUNT = 6;

/** Drei Aufträge: zwei normale und ein schwerer, mit verschiedenen Orten. Gleicher Rng-Zustand = gleiche Aufträge. */
export function generateContracts(rng: Rng): Contract[] {
  const locations = rng.shuffle(Array.from({ length: LOCATION_COUNT }, (_, i) => i));
  const difficulties: Difficulty[] = ['normal', 'normal', 'hard'];
  return difficulties.map((difficulty, i) => ({
    seed: rng.int(1, 0x7ffffffe),
    location: locations[i] as number,
    difficulty,
  }));
}

/** Seed für Aufträge und Händlerangebot: ändert sich mit jeder abgeschlossenen Mission, bleibt sonst stabil. */
export function progressSeed(missionsCompleted: number, salt: number): number {
  return (Math.imul(missionsCompleted + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
}
