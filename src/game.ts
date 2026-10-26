import Phaser from 'phaser';
import { REGISTRY_PROFILE } from './config/constants';
import { COLORS } from './config/palette';
import type { Profile } from './core/profile';
import { currentPixelRatio, startHiDpiScaling, surfaceSize } from './platform/hidpi';
import { BootScene } from './scenes/BootScene';
import { HudScene } from './scenes/HudScene';
import { InventoryScene } from './scenes/InventoryScene';
import { MissionScene } from './scenes/MissionScene';

export function createGame(container: HTMLElement, profile: Profile): Phaser.Game {
  const { width, height } = surfaceSize(container);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    backgroundColor: COLORS.background,
    // Größe und Zoom werden von startHiDpiScaling gesteuert (Spielfläche in Geräte-Pixeln).
    scale: { mode: Phaser.Scale.NONE, width, height, zoom: 1 / currentPixelRatio() },
    input: { activePointers: 3 },
    disableContextMenu: true,
    render: { antialias: true, powerPreference: 'high-performance' },
    scene: [BootScene, MissionScene, HudScene, InventoryScene],
    // Der Spielstand steht bereit, bevor die erste Szene startet.
    callbacks: { preBoot: (g) => g.registry.set(REGISTRY_PROFILE, profile) },
  });

  startHiDpiScaling(game, container);
  return game;
}
