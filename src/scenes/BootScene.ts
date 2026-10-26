import Phaser from 'phaser';
import { REGISTRY_PROFILE, REGISTRY_SESSION, SCENE_KEYS } from '../config/constants';
import { createPlaceholderTextures } from '../graphics/placeholderTextures';
import { CLASS_LIST } from '../data/classes';
import type { Session } from '../persistence/session';
import { SLOT_COUNT } from '../persistence/session';
import type { MissionConfig } from './MissionScene';

/**
 * Erzeugt die Platzhalter-Grafik und startet die Titelseite.
 *
 * Abkürzungen zum Ausprobieren (überspringen die Titelseite):
 * - `?seed=123` startet genau diesen Dungeon (`&zerog=1`: jeder Kampfraum schwerelos, `&zerog=0`: keiner),
 *   `?mode=arena` die Testarena (beides mit Spielstand 1),
 * - `?slot=2` lädt Spielstand 2 (oder beginnt dort mit Amos) und geht in den Hub,
 * - `?reset` beginnt in Spielstand 1 neu,
 * - `?class=naomi` (amos, naomi, bobbie, holden) wählt die Figur, wenn dabei ein neuer Spielstand entsteht.
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
    const requested = params.get('class');
    const classId = CLASS_LIST.some((c) => c.id === requested) ? (requested as string) : 'amos';
    const profile = (!params.has('reset') && session.load(slot)) || session.startNew(slot, classId);
    this.registry.set(REGISTRY_PROFILE, profile);
    this.scene.start(mission ? SCENE_KEYS.mission : SCENE_KEYS.hub, mission ?? undefined);
  }
}

function missionFromParams(params: URLSearchParams): MissionConfig | null {
  if (params.get('mode') === 'arena') return { kind: 'arena' };
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  if (!Number.isFinite(seed)) return null;
  const zeroG = Number.parseFloat(params.get('zerog') ?? '');
  return Number.isFinite(zeroG) ? { kind: 'dungeon', seed, zeroG } : { kind: 'dungeon', seed };
}
