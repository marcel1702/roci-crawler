import { Profile } from '../core/profile';
import type { ItemRules } from '../core/items';
import { Autosaver } from './autosave';
import { SaveStore, SAVE_KEY } from './saveStore';
import type { StorageLike } from './saveStore';

export const SLOT_COUNT = 3;
const LAST_SLOT_KEY = `${SAVE_KEY}:last`;

/** Kurzinfo zu einem belegten Spielstand für die Auswahl. */
export interface SlotSummary {
  slot: number;
  classId: string;
  level: number;
  credits: number;
  missionsCompleted: number;
  savedAt: number | null;
}

/**
 * Die Spielsitzung: drei Spielstände, welcher gerade gespielt wird, und das Autospeichern dafür.
 * Der Spielstand aus Meilenstein 4 (ein einzelner Eintrag) wird beim ersten Start in Slot 1 übernommen.
 */
export class Session {
  profile: Profile | null = null;
  activeSlot: number | null = null;

  private readonly autosaver = new Autosaver();

  constructor(
    private readonly storage: (StorageLike & { removeItem?(key: string): void }) | null,
    private readonly rules: ItemRules,
  ) {
    this.migrateLegacy();
  }

  private key(slot: number): string {
    return `${SAVE_KEY}:slot${slot}`;
  }

  private store(slot: number): SaveStore {
    return new SaveStore(this.storage, this.rules, this.key(slot));
  }

  /** Belegte Spielstände (null = leer oder unbrauchbar). */
  summaries(): (SlotSummary | null)[] {
    return Array.from({ length: SLOT_COUNT }, (_, i) => this.summary(i + 1));
  }

  private summary(slot: number): SlotSummary | null {
    const loaded = this.store(slot).load().profile;
    if (!loaded) return null;
    let savedAt: number | null = null;
    try {
      const raw = JSON.parse(this.storage?.getItem(this.key(slot)) ?? 'null') as { savedAt?: unknown } | null;
      if (typeof raw?.savedAt === 'number') savedAt = raw.savedAt;
    } catch {
      /* ignorieren */
    }
    return {
      slot,
      classId: loaded.classId,
      level: loaded.progression.level,
      credits: loaded.wallet.credits,
      missionsCompleted: loaded.missionsCompleted,
      savedAt,
    };
  }

  /** Zuletzt gespielter Spielstand (nur, wenn er noch belegt ist). */
  lastSlot(): number | null {
    try {
      const n = Number.parseInt(this.storage?.getItem(LAST_SLOT_KEY) ?? '', 10);
      return n >= 1 && n <= SLOT_COUNT && this.summary(n) ? n : null;
    } catch {
      return null;
    }
  }

  /** Lädt einen belegten Spielstand und macht ihn zum aktiven. Null, wenn der Platz leer ist. */
  load(slot: number): Profile | null {
    const profile = this.store(slot).load().profile;
    if (profile) this.begin(slot, profile);
    return profile;
  }

  /** Beginnt ein neues Spiel in einem Platz (überschreibt dort nichts, bis zum ersten Speichern). */
  startNew(slot: number, classId: string): Profile {
    const profile = new Profile(this.rules, classId);
    this.begin(slot, profile);
    this.store(slot).save(profile);
    return profile;
  }

  /** Löscht einen Spielstand (die Sicherung beschädigter Daten bleibt unangetastet). */
  delete(slot: number): void {
    if (this.activeSlot === slot) this.end();
    try {
      this.storage?.removeItem?.(this.key(slot));
    } catch {
      /* ignorieren */
    }
  }

  /** Beendet die aktuelle Sitzung (speichert noch Ausstehendes), z. B. beim Zurück zur Titelseite. */
  end(): void {
    this.autosaver.detach();
    this.profile = null;
    this.activeSlot = null;
  }

  private begin(slot: number, profile: Profile): void {
    this.end();
    this.profile = profile;
    this.activeSlot = slot;
    this.autosaver.attach(profile, this.store(slot));
    try {
      this.storage?.setItem(LAST_SLOT_KEY, String(slot));
    } catch {
      /* ignorieren */
    }
  }

  private migrateLegacy(): void {
    if (!this.storage) return;
    try {
      const legacy = this.storage.getItem(SAVE_KEY);
      if (legacy !== null && this.storage.getItem(this.key(1)) === null) {
        this.storage.setItem(this.key(1), legacy);
        this.storage.removeItem?.(SAVE_KEY);
      }
    } catch {
      /* ignorieren */
    }
  }
}
