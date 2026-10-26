import type { Tileset } from '../config/constants';
import type { TextKey } from '../i18n';
import type { EnemyId } from './enemies';
import { ACT1_SPAWNS, ACT2_SPAWNS } from './spawnTables';
import type { SpawnTable } from '../core/encounters';

export interface ActDef {
  /** 1-basiert; Text-Schlüssel heißen `act.<id>.*`. */
  id: number;
  spawns: SpawnTable<EnemyId>;
  boss: EnemyId;
  /** Fester Seed des Boss-Dungeons (gleiche Karte bei jedem Versuch, damit sich der Kampf lernen lässt). */
  bossSeed: number;
  /** Wahrscheinlichkeit, dass ein Kampf- oder Schatzraum schwerelos ist. */
  zeroGChance: number;
  /** Wahrscheinlichkeit, dass ein Kampf- oder Schatzraum infiziert ist (nur ohne Schwerelosigkeit). */
  infectionChance: number;
  /** Der Bossraum ist schwerelos. */
  bossRoomZeroG: boolean;
  tileset: Tileset;
  /** Empfohlene Stufe der ersten Aufträge dieses Akts (Anzeige auf den Karten). */
  baseLevel: number;
}

export const ACTS: readonly ActDef[] = [
  {
    id: 1,
    spawns: ACT1_SPAWNS,
    boss: 'gangboss',
    bossSeed: 20250101,
    zeroGChance: 0.18,
    infectionChance: 0,
    bossRoomZeroG: false,
    tileset: 'ceres',
    baseLevel: 1,
  },
  {
    id: 2,
    spawns: ACT2_SPAWNS,
    boss: 'knot',
    bossSeed: 20250202,
    zeroGChance: 0.4,
    infectionChance: 0.35,
    bossRoomZeroG: true,
    tileset: 'eros',
    baseLevel: 7,
  },
];

/** Der Akt mit dieser Nummer; unbekannte Nummern fallen auf Akt 1 zurück. */
export function actDef(act: number): ActDef {
  return ACTS.find((a) => a.id === act) ?? (ACTS[0] as ActDef);
}

/** Text-Schlüssel eines Akts, z. B. `actText(1, 'boss.name')` → `act.1.boss.name`. */
export function actText(act: number, suffix: string): TextKey {
  return `act.${act}.${suffix}` as TextKey;
}
