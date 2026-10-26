import type { Profile } from '../core/profile';
import type { SaveStore } from './saveStore';

const SAVE_DELAY_MS = 800;

/**
 * Speichert das aktive Profil automatisch: kurz nach jeder Änderung (gebündelt) und sofort, wenn die App in den
 * Hintergrund wechselt oder geschlossen wird (auf Smartphones die wichtigste Gelegenheit).
 * Die Ereignis-Hörer werden einmal angelegt; `attach`/`detach` wechseln das Profil (z. B. beim Spielstand-Wechsel).
 */
export class Autosaver {
  private profile: Profile | null = null;
  private store: SaveStore | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Im Browser; in Tests ohne Browser gibt es diese Ereignisse nicht.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush();
      });
      window.addEventListener('pagehide', () => this.flush());
    }
  }

  attach(profile: Profile, store: SaveStore): void {
    this.detach();
    this.profile = profile;
    this.store = store;
    profile.onChange = () => {
      if (this.timer === undefined) this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
    };
  }

  /** Speichert noch Ausstehendes und löst das Profil. */
  detach(): void {
    this.flush();
    if (this.profile) this.profile.onChange = null;
    this.profile = null;
    this.store = null;
  }

  flush(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.profile && this.store) this.store.save(this.profile);
  }
}
