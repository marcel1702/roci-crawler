import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/constants';
import { createPlaceholderTextures } from '../graphics/placeholderTextures';
import type { MissionConfig } from './MissionScene';

/**
 * Erzeugt die Platzhalter-Grafik und startet Mission und HUD. Später: Assets laden, Spielstand lesen, Menü.
 * Zum Ausprobieren: `?seed=123` startet genau diesen Dungeon, `?mode=arena` die Testarena.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.scene.start(SCENE_KEYS.mission, configFromUrl(window.location.search));
    this.scene.launch(SCENE_KEYS.hud);
  }
}

function configFromUrl(search: string): MissionConfig | undefined {
  const params = new URLSearchParams(search);
  if (params.get('mode') === 'arena') return { kind: 'arena' };
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  return Number.isFinite(seed) ? { kind: 'dungeon', seed } : undefined;
}
