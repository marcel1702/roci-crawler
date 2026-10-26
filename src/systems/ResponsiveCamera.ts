import Phaser from 'phaser';
import { REGISTRY_KEYS, VIEW } from '../config/constants';
import { COLORS } from '../config/palette';
import type { TileGrid } from '../core/grid';
import { clamp } from '../core/math';

/** Kamera, die der Figur folgt und ihren Zoom an Bildschirmgröße und Pixeldichte anpasst (Hoch- wie Querformat). */
export class ResponsiveCamera {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: TileGrid,
    target: Phaser.GameObjects.GameObject,
  ) {
    const camera = scene.cameras.main;
    camera.setBackgroundColor(COLORS.background);
    camera.startFollow(target, false, 0.12, 0.12);

    this.refresh();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.refresh, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, this.refresh, this);
    });
  }

  private refresh(): void {
    const dpr = (this.scene.registry.get(REGISTRY_KEYS.devicePixelRatio) as number | undefined) ?? 1;
    const { width, height } = this.scene.scale;
    const shortSideCss = Math.min(width, height) / dpr;
    const cssZoom = clamp(shortSideCss / VIEW.targetShortSide, VIEW.minZoom, VIEW.maxZoom);
    const camera = this.scene.cameras.main;
    camera.setZoom(cssZoom * dpr);

    // Ist die Welt kleiner als die Ansicht, würde Phaser sie oben links festnageln. Die Grenzen auf
    // Ansichtsgröße aufzuweiten zentriert sie stattdessen.
    const padX = Math.max(0, (width / camera.zoom - this.grid.widthPx) / 2);
    const padY = Math.max(0, (height / camera.zoom - this.grid.heightPx) / 2);
    camera.setBounds(-padX, -padY, this.grid.widthPx + 2 * padX, this.grid.heightPx + 2 * padY);
  }
}
