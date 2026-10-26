import './styles.css';
import { Profile } from './core/profile';
import { ITEM_RULES } from './data/items';
import { createGame } from './game';
import { startAutosave } from './persistence/autosave';
import { SaveStore, browserStorage } from './persistence/saveStore';
import { registerServiceWorker } from './pwa/register';

declare global {
  interface Window {
    /** Nur im Dev-Server: Zugriff auf das Spiel für Konsole und automatisierte Tests. */
    __roci?: ReturnType<typeof createGame>;
  }
}

const container = document.getElementById('game');
if (!container) throw new Error('#game fehlt in index.html');

// Spielstand laden; `?reset` beginnt mit einem frischen Spielstand (der alte wird erst beim nächsten Speichern ersetzt).
const store = new SaveStore(browserStorage(), ITEM_RULES);
const fresh = new URLSearchParams(window.location.search).has('reset');
const profile = (!fresh && store.load().profile) || new Profile(ITEM_RULES);
startAutosave(profile, store);

const game = createGame(container, profile);
if (import.meta.env.DEV) window.__roci = game;

// Bitte den Browser, den Spielstand nicht von selbst zu löschen (v. a. Safari räumt ungenutzte Seiten auf).
void navigator.storage?.persist?.().catch(() => undefined);

registerServiceWorker();
