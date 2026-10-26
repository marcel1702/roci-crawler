import Phaser from 'phaser';
import { REGISTRY_SESSION } from './config/constants';
import { COLORS } from './config/palette';
import type { Session } from './persistence/session';
import { currentPixelRatio, startHiDpiScaling, surfaceSize } from './platform/hidpi';
import { BootScene } from './scenes/BootScene';
import { HubScene } from './scenes/HubScene';
import { HudScene } from './scenes/HudScene';
import { InventoryScene } from './scenes/InventoryScene';
import { MissionScene } from './scenes/MissionScene';
import { MissionSelectScene } from './scenes/MissionSelectScene';
import { ShopScene } from './scenes/ShopScene';
import { TitleScene } from './scenes/TitleScene';

export function createGame(container: HTMLElement, session: Session): Phaser.Game {
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
    // Reihenfolge = Zeichenreihenfolge: Welt unten, HUD darüber, Overlays ganz oben.
    scene: [BootScene, TitleScene, HubScene, MissionScene, HudScene, InventoryScene, ShopScene, MissionSelectScene],
    // Die Sitzung steht bereit, bevor die erste Szene startet.
    callbacks: { preBoot: (g) => g.registry.set(REGISTRY_SESSION, session) },
  });

  startHiDpiScaling(game, container);
  return game;
}
