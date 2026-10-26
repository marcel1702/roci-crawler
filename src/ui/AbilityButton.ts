import Phaser from 'phaser';
import type { AbilityIcon } from '../abilities';
import { COLORS } from '../config/palette';

export type ButtonIcon = AbilityIcon | 'potion';

export interface ButtonState {
  /** Verbleibender Anteil der Abklingzeit, 1 = gerade ausgelöst, 0 = bereit. */
  cooldownFraction: number;
  cooldownSeconds: number;
  /** False, wenn die Taste gerade nichts bewirken kann (z. B. Trank bei vollem Leben). */
  usable: boolean;
  /** Kleine Zahl unten rechts (z. B. Tränke). */
  badge?: number;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FLASH_MS = 120;

/** Runde Taste am Bildschirmrand mit Symbol, Abklingzeit-Anzeige und Rückmeldung beim Drücken. */
export class AbilityButton {
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly seconds: Phaser.GameObjects.Text;
  private readonly badge: Phaser.GameObjects.Text;
  private x = 0;
  private y = 0;
  private radius = 30;
  private icon: ButtonIcon | null = null;
  private lastKey = '';
  private flashUntil = 0;
  private state: ButtonState = { cooldownFraction: 0, cooldownSeconds: 0, usable: true };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly accent: number,
  ) {
    this.base = scene.add.graphics();
    this.overlay = scene.add.graphics();
    this.seconds = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontStyle: 'bold', color: '#ffffff', stroke: '#000000' })
      .setOrigin(0.5);
    this.badge = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontStyle: 'bold', color: '#ffffff', stroke: '#000000' })
      .setOrigin(0.5);
  }

  setIcon(icon: ButtonIcon): void {
    if (this.icon === icon) return;
    this.icon = icon;
    this.redraw();
  }

  layout(x: number, y: number, radius: number): void {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.seconds.setFontSize(Math.round(radius * 0.8)).setStroke('#000000', Math.max(2, radius / 10));
    this.badge.setFontSize(Math.round(radius * 0.55)).setStroke('#000000', Math.max(2, radius / 12));
    this.seconds.setPosition(x, y);
    this.badge.setPosition(x + radius * 0.62, y + radius * 0.62);
    this.redraw();
  }

  /** Treffertest in Bildschirmkoordinaten; `pad` vergrößert die Fläche für ungenaue Finger. */
  contains(px: number, py: number, pad = 0): boolean {
    return Math.hypot(px - this.x, py - this.y) <= this.radius + pad;
  }

  /** Kurzes Aufleuchten als Rückmeldung für einen Tipp. */
  press(): void {
    this.flashUntil = this.scene.time.now + FLASH_MS;
    this.lastKey = '';
  }

  setState(state: ButtonState): void {
    this.state = state;
    const flashing = this.scene.time.now < this.flashUntil;
    const key = [Math.ceil(state.cooldownFraction * 48), state.cooldownSeconds, state.usable, state.badge, flashing].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.redraw();
  }

  private redraw(): void {
    const { x, y, radius: r, state } = this;
    const ready = state.cooldownFraction <= 0;
    const alive = ready && state.usable;
    const flashing = this.scene.time.now < this.flashUntil;

    this.base
      .clear()
      .fillStyle(COLORS.uiPanel, 0.72)
      .fillCircle(x, y, r)
      .lineStyle(Math.max(2, r / 11), this.accent, alive ? 0.95 : 0.35)
      .strokeCircle(x, y, r);
    if (this.icon) this.drawIcon(this.icon, alive ? 1 : 0.4);

    const g = this.overlay.clear();
    if (state.cooldownFraction > 0) {
      const start = Phaser.Math.DegToRad(-90);
      g.fillStyle(0x000000, 0.62).slice(x, y, r - 1, start, start + Math.PI * 2 * state.cooldownFraction, false).fillPath();
    }
    if (flashing) g.fillStyle(0xffffff, 0.3).fillCircle(x, y, r);

    this.seconds.setText(state.cooldownSeconds > 0 ? String(state.cooldownSeconds) : '');
    this.badge.setText(state.badge === undefined ? '' : String(state.badge));
  }

  private drawIcon(icon: ButtonIcon, alpha: number): void {
    const { x, y, radius: r } = this;
    const g = this.base;
    const w = Math.max(2, r / 9);
    g.lineStyle(w, 0xffffff, alpha).fillStyle(0xffffff, alpha);

    switch (icon) {
      case 'dash': {
        // Zwei Pfeilspitzen nach rechts.
        for (const dx of [-0.32, 0.12]) {
          g.beginPath()
            .moveTo(x + r * (dx - 0.18), y - r * 0.38)
            .lineTo(x + r * (dx + 0.22), y)
            .lineTo(x + r * (dx - 0.18), y + r * 0.38)
            .strokePath();
        }
        break;
      }
      case 'shield': {
        const pts = [
          { x: x - r * 0.42, y: y - r * 0.42 },
          { x: x + r * 0.42, y: y - r * 0.42 },
          { x: x + r * 0.42, y: y + r * 0.05 },
          { x, y: y + r * 0.55 },
          { x: x - r * 0.42, y: y + r * 0.05 },
        ];
        g.strokePoints(pts, true);
        break;
      }
      case 'slam': {
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          g.lineBetween(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
        }
        g.fillCircle(x, y, r * 0.12);
        break;
      }
      case 'potion': {
        g.fillStyle(0x6dff9a, alpha).fillCircle(x, y + r * 0.18, r * 0.32);
        g.fillStyle(0xffffff, alpha).fillRect(x - r * 0.1, y - r * 0.4, r * 0.2, r * 0.3);
        break;
      }
    }
  }
}
