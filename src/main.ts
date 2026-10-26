import './styles.css';
import { ITEM_RULES } from './data/items';
import { audio } from './audio';
import { createGame } from './game';
import { Session } from './persistence/session';
import { browserStorage } from './persistence/saveStore';
import { initSettings } from './platform/settingsRuntime';
import { loadSettings, saveSettings } from './persistence/settingsStore';
import { registerServiceWorker } from './pwa/register';

declare global {
  interface Window {
    /** Zugriff auf das Spiel für Konsole und automatisierte Tests (Dev-Server oder `?debug`). */
    __roci?: ReturnType<typeof createGame>;
  }
}

const container = document.getElementById('game');
if (!container) throw new Error('#game fehlt in index.html');

const storage = browserStorage();
initSettings(loadSettings(storage), (settings) => saveSettings(storage, settings));
audio.init();

const session = new Session(storage, ITEM_RULES);
const game = createGame(container, session);
// Zugriff auf das Spiel für Konsole und Rauchtest: im Dev-Server immer, in der gebauten App nur mit `?debug` in der URL.
if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) window.__roci = game;

// Bitte den Browser, den Spielstand nicht von selbst zu löschen (v. a. Safari räumt ungenutzte Seiten auf).
void navigator.storage?.persist?.().catch(() => undefined);

registerServiceWorker();
