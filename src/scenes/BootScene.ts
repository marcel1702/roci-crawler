import Phaser from 'phaser';
import { REGISTRY_PROFILE, REGISTRY_SESSION, SCENE_KEYS } from '../config/constants';
import { createPlaceholderTextures } from '../graphics/placeholderTextures';
import type { Session } from '../persistence/session';
import { SLOT_COUNT } from '../persistence/session';
import type { MissionConfig } from './MissionScene';

/**
 * Erzeugt die Platzhalter-Grafik und startet die Titelseite.
 *
 * Abkürzungen zum Ausprobieren (überspringen die Titelseite):
 * - `?seed=123` startet genau diesen Dungeon, `?mode=arena` die Testarena (beides mit Spielstand 1),
 * - `?slot=2` lädt Spielstand 2 (oder beginnt dort mit Amos) und geht in den Hub,
 * - `?reset` beginnt in Spielstand 1 neu.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    createPlaceholderTextures(this);
    const params = new URLSearchParams(window.location.search);
    const mission = missionFromParams(params);
    const slotParam = Number.parseInt(params.get('slot') ?? '', 10);
    const shortcut = mission !== null || params.has('reset') || Number.isFinite(slotParam);

    if (!shortcut) {
      this.scene.start(SCENE_KEYS.title);
      return;
    }

    const session = this.registry.get(REGISTRY_SESSION) as Session;
    const slot = slotParam >= 1 && slotParam <= SLOT_COUNT ? slotParam : 1;
    const profile = (!params.has('reset') && session.load(slot)) || session.startNew(slot, 'amos');
    this.registry.set(REGISTRY_PROFILE, profile);
    this.scene.start(mission ? SCENE_KEYS.mission : SCENE_KEYS.hub, mission ?? undefined);
  }
}

function missionFromParams(params: URLSearchParams): MissionConfig | null {
  if (params.get('mode') === 'arena') return { kind: 'arena' };
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  return Number.isFinite(seed) ? { kind: 'dungeon', seed } : null;
}
