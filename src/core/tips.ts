/** Einführungshinweise, die jeder Spielstand genau einmal sieht (Texte `tip.<kennung>`). */
export const TIP_IDS = ['controls', 'telegraph', 'loot', 'talents', 'potion', 'infection', 'boss'] as const;

export type TipId = (typeof TIP_IDS)[number];

export function isTipId(value: unknown): value is TipId {
  return typeof value === 'string' && (TIP_IDS as readonly string[]).includes(value);
}
