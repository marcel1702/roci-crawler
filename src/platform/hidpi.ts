import type Phaser from 'phaser';
import { MAX_DEVICE_PIXEL_RATIO, REGISTRY_KEYS } from '../config/constants';
import { clamp } from '../core/math';

export function currentPixelRatio(): number {
  return clamp(window.devicePixelRatio || 1, 1, MAX_DEVICE_PIXEL_RATIO);
}

/** Größe der Spielfläche in Geräte-Pixeln für einen CSS-Container. */
export function surfaceSize(container: HTMLElement): { width: number; height: number } {
  const dpr = currentPixelRatio();
  return {
    width: Math.max(1, Math.round(container.clientWidth * dpr)),
    height: Math.max(1, Math.round(container.clientHeight * dpr)),
  };
}

/**
 * Hält die Spielfläche scharf: Das Canvas hat Geräte-Pixel-Größe und wird per CSS (`zoom = 1/dpr`)
 * auf CSS-Pixel verkleinert. Folgt Drehung, Fenstergröße und Browser-Zoom des Containers.
 * Szenen lesen das Verhältnis aus `registry.get(REGISTRY_KEYS.devicePixelRatio)`.
 */
export function startHiDpiScaling(game: Phaser.Game, container: HTMLElement): void {
  game.registry.set(REGISTRY_KEYS.devicePixelRatio, currentPixelRatio());

  let lastKey = '';
  const apply = (): void => {
    if (!game.isBooted) return;
    const dpr = currentPixelRatio();
    const { width, height } = surfaceSize(container);
    const key = `${width}x${height}@${dpr}`;
    if (key === lastKey) return;
    lastKey = key;

    game.registry.set(REGISTRY_KEYS.devicePixelRatio, dpr);
    game.scale.setZoom(1 / dpr);
    game.scale.resize(width, height);
  };

  new ResizeObserver(apply).observe(container);
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  if (game.isBooted) apply();
  else game.events.once('ready', apply);
}
