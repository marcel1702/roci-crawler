import Phaser from 'phaser';
import { COLORS } from './config/palette';
import { currentPixelRatio, startHiDpiScaling, surfaceSize } from './platform/hidpi';
import { BootScene } from './scenes/BootScene';
import { HudScene } from './scenes/HudScene';
import { MissionScene } from './scenes/MissionScene';

export function createGame(container: HTMLElement): Phaser.Game {
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
    scene: [BootScene, MissionScene, HudScene],
  });

  startHiDpiScaling(game, container);
  return game;
}
