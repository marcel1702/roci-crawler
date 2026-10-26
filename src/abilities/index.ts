import type { AbilityId } from '../data/types';
import { AMOS_ABILITIES } from './amos';
import type { AbilityDef } from './types';

export type { AbilityContext, AbilityDef, AbilityIcon } from './types';

/** Alle Fähigkeiten. Neue Klassen ergänzen ihre Fähigkeiten hier; `AbilityId` erzwingt Vollständigkeit. */
export const ABILITIES: Record<AbilityId, AbilityDef> = {
  ...AMOS_ABILITIES,
};
