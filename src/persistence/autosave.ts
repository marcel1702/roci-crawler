import type { Profile } from '../core/profile';
import type { SaveStore } from './saveStore';

const SAVE_DELAY_MS = 800;

/**
 * Speichert das Profil automatisch: kurz nach jeder Änderung (gebündelt) und sofort, wenn die App in den
 * Hintergrund wechselt oder geschlossen wird (auf Smartphones die wichtigste Gelegenheit).
 */
export function startAutosave(profile: Profile, store: SaveStore): void {
  let timer: number | undefined;

  const flush = (): void => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
    store.save(profile);
  };

  profile.onChange = () => {
    if (timer === undefined) timer = window.setTimeout(flush, SAVE_DELAY_MS);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}
