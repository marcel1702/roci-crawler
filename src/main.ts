import './styles.css';
import { ITEM_RULES } from './data/items';
import { audio } from './audio';
import { createGame } from './game';
import { Session } from './persistence/session';
import { browserStorage } from './persistence/saveStore';
import { loadSettings, saveSettings } from './persistence/settingsStore';
import { registerServiceWorker } from './pwa/register';

declare global {
  interface Window {
    /** Nur im Dev-Server: Zugriff auf das Spiel für Konsole und automatisierte Tests. */
    __roci?: ReturnType<typeof createGame>;
  }
}

const container = document.getElementById('game');
if (!container) throw new Error('#game fehlt in index.html');

const storage = browserStorage();
audio.init(loadSettings(storage), (settings) => saveSettings(storage, settings));

const session = new Session(storage, ITEM_RULES);
const game = createGame(container, session);
if (import.meta.env.DEV) window.__roci = game;

// Bitte den Browser, den Spielstand nicht von selbst zu löschen (v. a. Safari räumt ungenutzte Seiten auf).
void navigator.storage?.persist?.().catch(() => undefined);

registerServiceWorker();
