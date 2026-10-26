import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/constants';
import { createPlaceholderTextures } from '../graphics/placeholderTextures';

/** Erzeugt die Platzhalter-Grafik und startet Mission und HUD. Später: Assets laden, Spielstand lesen, Menü. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.scene.start(SCENE_KEYS.mission);
    this.scene.launch(SCENE_KEYS.hud);
  }
}
