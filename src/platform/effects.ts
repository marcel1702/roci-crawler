import type Phaser from 'phaser';
import { getSettings } from './settingsRuntime';

/** Kamerawackeln, außer es ist in den Einstellungen abgeschaltet (Barrierefreiheit). */
export function shake(scene: Phaser.Scene, durationMs: number, intensity: number): void {
  if (getSettings().screenShake) scene.cameras.main.shake(durationMs, intensity);
}
