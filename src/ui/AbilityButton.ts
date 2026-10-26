import Phaser from 'phaser';
import type { AbilityIcon } from '../abilities';
import { COLORS } from '../config/palette';

export type ButtonIcon = AbilityIcon | 'potion' | 'bag' | 'talents' | 'brake' | 'sound' | 'muted';

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
  private visible = true;
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

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const object of [this.base, this.overlay, this.seconds, this.badge]) object.setVisible(visible);
  }

  /** Treffertest in Bildschirmkoordinaten; `pad` vergrößert die Fläche für ungenaue Finger. Verborgene Tasten treffen nie. */
  contains(px: number, py: number, pad = 0): boolean {
    return this.visible && Math.hypot(px - this.x, py - this.y) <= this.radius + pad;
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
      case 'drone': {
        g.strokeCircle(x, y, r * 0.17);
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          g.lineBetween(x + dx * r * 0.17, y + dy * r * 0.17, x + dx * r * 0.42, y + dy * r * 0.42);
          g.strokeCircle(x + dx * r * 0.5, y + dy * r * 0.5, r * 0.11);
        }
        break;
      }
      case 'hack': {
        // Klammern um einen Blitz
        g.beginPath().moveTo(x - r * 0.25, y - r * 0.5).lineTo(x - r * 0.5, y - r * 0.5).lineTo(x - r * 0.5, y + r * 0.5).lineTo(x - r * 0.25, y + r * 0.5).strokePath();
        g.beginPath().moveTo(x + r * 0.25, y - r * 0.5).lineTo(x + r * 0.5, y - r * 0.5).lineTo(x + r * 0.5, y + r * 0.5).lineTo(x + r * 0.25, y + r * 0.5).strokePath();
        g.beginPath().moveTo(x + r * 0.1, y - r * 0.4).lineTo(x - r * 0.12, y + r * 0.02).lineTo(x + r * 0.12, y + r * 0.02).lineTo(x - r * 0.1, y + r * 0.4).strokePath();
        break;
      }
      case 'emp': {
        g.fillCircle(x, y, r * 0.1);
        for (const k of [0.28, 0.46, 0.64]) g.strokeCircle(x, y, r * k);
        break;
      }
      case 'rockets': {
        for (const dx of [-0.36, 0, 0.36]) {
          const top = y - r * 0.5 + Math.abs(dx) * r * 0.5;
          g.lineBetween(x + dx * r, top + r * 0.18, x + dx * r, y + r * 0.45);
          g.fillTriangle(x + dx * r - r * 0.11, top + r * 0.22, x + dx * r + r * 0.11, top + r * 0.22, x + dx * r, top - r * 0.05);
        }
        break;
      }
      case 'armor': {
        const pts = [];
        for (let i = 0; i < 6; i++) pts.push({ x: x + Math.cos((i * Math.PI) / 3) * r * 0.55, y: y + Math.sin((i * Math.PI) / 3) * r * 0.55 });
        g.strokePoints(pts, true);
        g.lineBetween(x - r * 0.2, y, x + r * 0.2, y).lineBetween(x, y - r * 0.2, x, y + r * 0.2);
        break;
      }
      case 'gauss': {
        g.lineBetween(x - r * 0.6, y + r * 0.45, x + r * 0.6, y - r * 0.45);
        g.fillTriangle(x + r * 0.62, y - r * 0.47, x + r * 0.3, y - r * 0.5, x + r * 0.5, y - r * 0.15);
        for (const t of [-0.15, 0.1]) g.lineBetween(x + t * r - r * 0.12, y - t * r * 0.75 - r * 0.2, x + t * r + r * 0.12, y - t * r * 0.75 + r * 0.2);
        break;
      }
      case 'barrage': {
        for (const [dx, dy] of [[-0.35, -0.2], [0.3, -0.3], [0, 0.35]] as const) {
          const cx = x + dx * r;
          const cy = y + dy * r;
          g.lineBetween(cx - r * 0.13, cy - r * 0.13, cx + r * 0.13, cy + r * 0.13).lineBetween(cx - r * 0.13, cy + r * 0.13, cx + r * 0.13, cy - r * 0.13);
          g.strokeCircle(cx, cy, r * 0.2);
        }
        break;
      }
      case 'ally': {
        g.strokeCircle(x - r * 0.2, y - r * 0.12, r * 0.22);
        g.beginPath().arc(x - r * 0.2, y + r * 0.5, r * 0.34, Math.PI, 0).strokePath();
        g.strokeCircle(x + r * 0.28, y - r * 0.02, r * 0.17);
        g.beginPath().arc(x + r * 0.28, y + r * 0.5, r * 0.26, Math.PI, 0).strokePath();
        break;
      }
      case 'inspire': {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? r * 0.55 : r * 0.24;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          pts.push({ x: x + Math.cos(a) * rad, y: y + Math.sin(a) * rad });
        }
        g.strokePoints(pts, true);
        break;
      }
      case 'brake': {
        // Vier Pfeilspitzen zeigen auf einen Punkt: „anhalten“.
        g.fillCircle(x, y, r * 0.13);
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
          const px = -dy;
          const py = dx;
          const tipX = x + dx * r * 0.3;
          const tipY = y + dy * r * 0.3;
          g.fillTriangle(tipX, tipY, x + dx * r * 0.62 + px * r * 0.17, y + dy * r * 0.62 + py * r * 0.17, x + dx * r * 0.62 - px * r * 0.17, y + dy * r * 0.62 - py * r * 0.17);
        }
        break;
      }
      case 'sound':
      case 'muted': {
        // Lautsprecher: Kasten mit Trichter; Wellen bei Ton, Kreuz bei stumm.
        g.fillRect(x - r * 0.48, y - r * 0.16, r * 0.2, r * 0.32);
        g.fillTriangle(x - r * 0.28, y - r * 0.16, x - r * 0.28, y + r * 0.16, x + r * 0.02, y + r * 0.46);
        g.fillTriangle(x - r * 0.28, y - r * 0.16, x + r * 0.02, y - r * 0.46, x + r * 0.02, y + r * 0.46);
        if (icon === 'sound') {
          for (const k of [0.3, 0.52]) g.beginPath().arc(x + r * 0.02, y, r * k, -0.85, 0.85).strokePath();
        } else {
          g.lineBetween(x + r * 0.2, y - r * 0.22, x + r * 0.58, y + r * 0.22).lineBetween(x + r * 0.2, y + r * 0.22, x + r * 0.58, y - r * 0.22);
        }
        break;
      }
      case 'talents': {
        // Drei verbundene Knoten
        const pts = [[0, -0.42], [-0.4, 0.3], [0.4, 0.3]] as const;
        g.lineBetween(x, y - r * 0.42, x - r * 0.4, y + r * 0.3).lineBetween(x, y - r * 0.42, x + r * 0.4, y + r * 0.3);
        for (const [dx, dy] of pts) g.fillCircle(x + dx * r, y + dy * r, r * 0.13);
        break;
      }
      case 'bag': {
        g.strokeRoundedRect(x - r * 0.42, y - r * 0.2, r * 0.84, r * 0.72, r * 0.14);
        g.beginPath().arc(x, y - r * 0.2, r * 0.22, Math.PI, 0).strokePath();
        g.lineBetween(x - r * 0.42, y + r * 0.08, x + r * 0.42, y + r * 0.08);
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
