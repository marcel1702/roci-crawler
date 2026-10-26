import { parseProfile } from '../core/profile';
import type { LoadProblem, Profile } from '../core/profile';
import type { ItemRules } from '../core/items';

/** Das, was vom Browser-Speicher gebraucht wird (erleichtert Tests und Browser ohne Speicher). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'roci-crawler:save';

export interface LoadResult {
  profile: Profile | null;
  problem?: LoadProblem;
}

/**
 * Spielstand im Browser-Speicher (localStorage). Beschädigte Daten werden vor dem Überschreiben gesichert,
 * ein Spielstand einer neueren Version wird nie überschrieben.
 */
export class SaveStore {
  private blocked = false;

  constructor(
    private readonly storage: StorageLike | null,
    private readonly rules: ItemRules,
    private readonly key = SAVE_KEY,
  ) {}

  load(): LoadResult {
    if (!this.storage) return { profile: null };
    let text: string | null;
    try {
      text = this.storage.getItem(this.key);
    } catch {
      return { profile: null };
    }
    if (text === null) return { profile: null };

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.backup(text);
      return { profile: null, problem: 'corrupt' };
    }
    const result = parseProfile(raw, this.rules);
    if (result.problem === 'too-new') this.blocked = true;
    if (result.problem === 'corrupt') this.backup(text);
    return result;
  }

  /** Speichert das Profil. Liefert false, wenn das nicht möglich oder nicht erlaubt war. */
  save(profile: Profile): boolean {
    if (!this.storage || this.blocked) return false;
    try {
      this.storage.setItem(this.key, JSON.stringify(profile.toJSON()));
      return true;
    } catch {
      return false; // Speicher voll oder gesperrt: das Spiel läuft weiter, nur ohne Speichern.
    }
  }

  private backup(text: string): void {
    try {
      this.storage?.setItem(`${this.key}:backup`, text);
    } catch {
      /* ignorieren */
    }
  }
}

/** Der Browser-Speicher, oder null, wenn er nicht verfügbar ist (z. B. private Fenster). */
export function browserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    const probe = `${SAVE_KEY}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
