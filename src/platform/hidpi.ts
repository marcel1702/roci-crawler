import type Phaser from 'phaser';
import { MAX_DEVICE_PIXEL_RATIO, REGISTRY_KEYS } from '../config/constants';
import { clamp } from '../core/math';
import { getSettings, onSettingsChange } from './settingsRuntime';

/** Pixelverhältnis der Spielfläche: das des Geräts, höchstens 2; bei sparsamer Grafik höchstens 1. */
export function currentPixelRatio(): number {
  const max = getSettings().quality === 'low' ? 1 : MAX_DEVICE_PIXEL_RATIO;
  return clamp(window.devicePixelRatio || 1, 1, max);
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
    // Erst die Größe, dann der Zoom: Der Zoom berechnet die CSS-Größe des Canvas aus der aktuellen Spielgröße.
    game.scale.resize(width, height);
    game.scale.setZoom(1 / dpr);
  };

  new ResizeObserver(apply).observe(container);
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  // Wechsel der Grafikqualität wirkt sofort.
  onSettingsChange(apply);
  if (game.isBooted) apply();
  else game.events.once('ready', apply);
}
