import { AudioEngine } from './engine';

export type { MusicMode, SfxName } from './engine';

/** Das eine Audio-System des Spiels (siehe `AudioEngine`); wird in `main.ts` mit den Einstellungen gestartet. */
export const audio = new AudioEngine();
