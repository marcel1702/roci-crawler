import './styles.css';
import { createGame } from './game';
import { registerServiceWorker } from './pwa/register';

declare global {
  interface Window {
    /** Nur im Dev-Server: Zugriff auf das Spiel für Konsole und automatisierte Tests. */
    __roci?: ReturnType<typeof createGame>;
  }
}

const container = document.getElementById('game');
if (!container) throw new Error('#game fehlt in index.html');

const game = createGame(container);
if (import.meta.env.DEV) window.__roci = game;

registerServiceWorker();
