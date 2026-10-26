import { Inventory } from './inventory';
import type { EquippedItems } from './inventory';
import { EMPTY_MODS, ORIGINS, RARITIES, SLOTS } from './items';
import type { Affix, Item, ItemRules, LegendaryId, StatKey } from './items';
import { MAX_LEVEL, Progression } from './progression';
import { Wallet } from './wallet';

export const SAVE_VERSION = 1;

/** Alles, was zwischen zwei Spielsitzungen erhalten bleibt. */
export interface SaveData {
  version: number;
  classId: string;
  level: number;
  xp: number;
  credits: number;
  missionsCompleted: number;
  /** Abgeschlossene Akte (0 = noch keiner). */
  actsCleared?: number;
  /** Abgeschlossene Missionen im laufenden Akt (schaltet den Boss frei). */
  actMissions?: number;
  /** Verteilte Talentpunkte: Talent-Kennung -> Rang. */
  talents?: Record<string, number>;
  /** Kennungen der Gegenstände, die im aktuellen Angebot des Händlers schon gekauft wurden. */
  shopBought?: string[];
  /** Zeitpunkt des letzten Speicherns (ms seit 1970), nur zur Anzeige. */
  savedAt?: number;
  bag: Item[];
  equipped: Record<string, Item | null>;
}

const STAT_KEYS = new Set<string>(Object.keys(EMPTY_MODS));
const LEGENDARY_IDS = new Set<string>(['vampiric', 'medic']);

/** Spielstand der Figur: Fortschritt, Credits und Gegenstände. Meldet Änderungen für das automatische Speichern. */
export class Profile {
  readonly progression: Progression;
  readonly wallet: Wallet;
  readonly inventory: Inventory;
  classId: string;
  missionsCompleted = 0;
  actsCleared = 0;
  actMissions = 0;
  readonly shopBought = new Set<string>();
  /** Talent-Kennung -> Rang. Wird beim Laden nicht geprüft; der Spieler prüft gegen den Baum seiner Klasse. */
  talents: Record<string, number> = {};
  /** Wird bei jeder Änderung aufgerufen (Speichern wird davon entkoppelt). */
  onChange: (() => void) | null = null;

  constructor(
    rules: ItemRules,
    classId = 'amos',
    progression = new Progression(),
    wallet = new Wallet(),
  ) {
    this.classId = classId;
    this.progression = progression;
    this.wallet = wallet;
    this.inventory = new Inventory(rules);
  }

  /** Meldet, dass sich etwas geändert hat. */
  touch(): void {
    this.onChange?.();
  }

  /** Verbucht eine abgeschlossene Mission; ein besiegter Akt-Boss schließt den Akt ab (höchstens bis `actCount`). */
  completeMission(bossDefeated: boolean, actCount: number): void {
    this.missionsCompleted++;
    if (bossDefeated && this.actsCleared < actCount) {
      this.actsCleared++;
      this.actMissions = 0;
    } else if (!bossDefeated) {
      this.actMissions++;
    }
  }

  toJSON(): SaveData {
    return {
      version: SAVE_VERSION,
      classId: this.classId,
      level: this.progression.level,
      xp: this.progression.xp,
      credits: this.wallet.credits,
      missionsCompleted: this.missionsCompleted,
      actsCleared: this.actsCleared,
      actMissions: this.actMissions,
      shopBought: [...this.shopBought],
      talents: { ...this.talents },
      bag: [...this.inventory.bag],
      equipped: { ...this.inventory.equipped },
    };
  }
}

export type LoadProblem = 'corrupt' | 'too-new';

export interface ParseResult {
  profile: Profile | null;
  problem?: LoadProblem;
}

/** Wandelt gespeicherte Daten in ein Profil um. Unbrauchbare Gegenstände werden verworfen, nicht der ganze Spielstand. */
export function parseProfile(raw: unknown, rules: ItemRules): ParseResult {
  if (!isRecord(raw)) return { profile: null, problem: 'corrupt' };
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { profile: null, problem: 'corrupt' };
  if (version > SAVE_VERSION) return { profile: null, problem: 'too-new' };

  // Hier später: Migrationen von älteren Versionen auf SAVE_VERSION (Schleife über version..SAVE_VERSION).
  const level = clampInt(raw.level, 1, MAX_LEVEL, 1);
  const xp = Math.max(0, Math.floor(finiteOr(raw.xp, 0)));
  const progression = new Progression(level, level >= MAX_LEVEL ? 0 : xp);
  const wallet = new Wallet(Math.max(0, Math.floor(finiteOr(raw.credits, 0))));
  const profile = new Profile(rules, typeof raw.classId === 'string' ? raw.classId : 'amos', progression, wallet);
  profile.missionsCompleted = Math.max(0, Math.floor(finiteOr(raw.missionsCompleted, 0)));
  profile.actsCleared = clampInt(raw.actsCleared, 0, 3, 0);
  profile.actMissions = clampInt(raw.actMissions, 0, 1000, 0);
  if (isRecord(raw.talents)) {
    for (const [id, rank] of Object.entries(raw.talents)) {
      if (typeof rank === 'number' && Number.isFinite(rank) && rank > 0) profile.talents[id] = Math.floor(rank);
    }
  }
  if (Array.isArray(raw.shopBought)) {
    for (const id of raw.shopBought) if (typeof id === 'string') profile.shopBought.add(id);
  }

  const seen = new Set<string>();
  const accept = (value: unknown): Item | null => {
    const item = parseItem(value);
    if (!item || seen.has(item.id)) return null;
    seen.add(item.id);
    return item;
  };

  if (Array.isArray(raw.bag)) {
    for (const value of raw.bag) {
      const item = accept(value);
      if (item && !profile.inventory.add(item)) break;
    }
  }
  if (isRecord(raw.equipped)) {
    const equipped: EquippedItems = profile.inventory.equipped;
    for (const slot of SLOTS) {
      const item = accept(raw.equipped[slot]);
      if (item && item.slot === slot) equipped[slot] = item;
    }
  }
  return { profile };
}

function parseItem(value: unknown): Item | null {
  if (!isRecord(value)) return null;
  const { id, slot, base, rarity, origin, level, legendary } = value;
  if (typeof id !== 'string' || id.length === 0 || typeof base !== 'string') return null;
  if (!SLOTS.includes(slot as never) || !RARITIES.includes(rarity as never) || !ORIGINS.includes(origin as never)) return null;
  if (typeof level !== 'number' || !Number.isFinite(level) || level < 1) return null;

  const primary = parseAffix(value.primary);
  const originBonus = parseAffix(value.originBonus);
  if (!primary || !originBonus || !Array.isArray(value.affixes)) return null;
  const affixes: Affix[] = [];
  for (const entry of value.affixes) {
    const affix = parseAffix(entry);
    if (!affix) return null;
    affixes.push(affix);
  }

  const item: Item = {
    id,
    slot: slot as Item['slot'],
    base,
    rarity: rarity as Item['rarity'],
    origin: origin as Item['origin'],
    level: Math.floor(level),
    primary,
    originBonus,
    affixes,
  };
  if (legendary !== undefined) {
    if (typeof legendary !== 'string' || !LEGENDARY_IDS.has(legendary)) return null;
    item.legendary = legendary as LegendaryId;
  }
  return item;
}

function parseAffix(value: unknown): Affix | null {
  if (!isRecord(value) || typeof value.stat !== 'string' || !STAT_KEYS.has(value.stat)) return null;
  if (typeof value.value !== 'number' || !Number.isFinite(value.value)) return null;
  return { stat: value.stat as StatKey, value: value.value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(finiteOr(value, fallback));
  return Math.min(max, Math.max(min, n));
}
