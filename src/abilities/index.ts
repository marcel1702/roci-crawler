import type { AbilityId } from '../data/types';
import { AMOS_ABILITIES } from './amos';
import { BOBBIE_ABILITIES } from './bobbie';
import { HOLDEN_ABILITIES } from './holden';
import { NAOMI_ABILITIES } from './naomi';
import type { AbilityDef } from './types';

export type { AbilityContext, AbilityDef, AbilityIcon } from './types';

/** Alle Fähigkeiten. Neue Klassen ergänzen ihre Fähigkeiten hier; `AbilityId` erzwingt Vollständigkeit. */
export const ABILITIES: Record<AbilityId, AbilityDef> = {
  ...AMOS_ABILITIES,
  ...NAOMI_ABILITIES,
  ...BOBBIE_ABILITIES,
  ...HOLDEN_ABILITIES,
};
