import Phaser from 'phaser';
import { COLORS } from '../config/palette';
import type { Actor } from '../entities/Actor';
import type { CombatSystem } from './CombatSystem';

/** Eine Wucherungszone: erst eine Warnung (rot, ohne Wirkung), dann schadet und bremst sie, bis sie verblasst. */
export interface HazardSpec {
  x: number;
  y: number;
  radius: number;
  /** Wirkdauer in ms (nach der Warnzeit). */
  durationMs: number;
  /** Warnzeit in ms ohne Wirkung. */
  warnMs?: number;
  /** Schaden pro Takt. */
  damage: number;
  /** Faktor auf das Lauftempo (z. B. 0.7). */
  slow: number;
}

interface Zone extends HazardSpec {
  warnLeft: number;
  activeLeft: number;
  tickLeft: number;
}

const TICK_MS = 500;
const FADE_MS = 700;
const GREEN = 0x78d64a;

/** Bleibende Gefahrenzonen am Boden (Sporen, Boss-Regen). Schaden wirkt auf die Ziele der Gegenseite. */
export class HazardSystem {
  private zones: Zone[] = [];
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly combat: CombatSystem,
    /** Wer von den Zonen getroffen wird (die Spielerseite). */
    private readonly targets: () => readonly Actor[],
  ) {
    this.gfx = scene.add.graphics().setDepth(6);
  }

  spawn(spec: HazardSpec): void {
    const warnMs = spec.warnMs ?? 0;
    this.zones.push({ ...spec, warnLeft: warnMs, activeLeft: spec.durationMs, tickLeft: 0 });
  }

  update(dt: number, now: number): void {
    const g = this.gfx.clear();
    if (this.zones.length === 0) return;
    const ms = dt * 1000;
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);

    for (const zone of this.zones) {
      if (zone.warnLeft > 0) {
        zone.warnLeft -= ms;
        const total = zone.warnMs ?? 1;
        const progress = 1 - Math.max(0, zone.warnLeft) / total;
        g.lineStyle(2, COLORS.telegraph, 0.5 + 0.5 * progress).strokeCircle(zone.x, zone.y, zone.radius);
        g.fillStyle(COLORS.telegraph, 0.1 + 0.3 * progress).fillCircle(zone.x, zone.y, zone.radius * progress);
        continue;
      }
      zone.activeLeft -= ms;
      const fade = Math.min(1, Math.max(0, zone.activeLeft) / FADE_MS);
      g.fillStyle(GREEN, (0.2 + 0.08 * pulse) * fade).fillCircle(zone.x, zone.y, zone.radius);
      g.lineStyle(2, GREEN, (0.55 + 0.25 * pulse) * fade).strokeCircle(zone.x, zone.y, zone.radius);

      zone.tickLeft -= ms;
      const hit = zone.tickLeft <= 0;
      if (hit) zone.tickLeft = TICK_MS;
      for (const target of this.targets()) {
        if (target.isDead || Math.hypot(target.x - zone.x, target.y - zone.y) > zone.radius + target.radius * 0.4) continue;
        target.slow(zone.slow, 250);
        if (hit) this.combat.dealDamage(null, target, zone.damage, false, true);
      }
    }
    this.zones = this.zones.filter((zone) => zone.warnLeft > 0 || zone.activeLeft > 0);
  }

  clear(): void {
    this.zones = [];
    this.gfx.clear();
  }
}
