import { audio } from '../audio';
import Phaser from 'phaser';
import { REGISTRY_KEYS } from '../config/constants';
import { COLORS } from '../config/palette';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hit {
  rect: Rect;
  action: () => void;
  label?: string;
}

export interface TextOptions {
  size: number;
  color?: string;
  bold?: boolean;
  origin: [number, number];
  wrap?: number;
  align?: 'left' | 'center' | 'right';
}

export const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
export const inside = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;

/** Was Hilfsfunktionen zum Zeichnen von Oberflächen brauchen (die Szene selbst oder ein Teil davon). */
export interface PanelCanvas {
  readonly u: number;
  readonly gfx: Phaser.GameObjects.Graphics;
  readonly hits: Hit[];
  text(x: number, y: number, content: string, opts: TextOptions): Phaser.GameObjects.Text;
  button(rect: Rect, label: string, fill: number, textColor: string, action: (() => void) | null, size: number): void;
}

/**
 * Basis für Oberflächen-Szenen (Rucksack, Händler, Aufträge, Titel): Alles wird in `render()` neu gezeichnet,
 * Tipps werden über Trefferflächen (`hits`) verteilt. Maße sind CSS-Pixel mal `u` (Pixelverhältnis).
 */
export abstract class PanelScene extends Phaser.Scene implements PanelCanvas {
  u = 1;
  gfx!: Phaser.GameObjects.Graphics;
  hits: Hit[] = [];
  private dynamic: Phaser.GameObjects.GameObject[] = [];

  protected abstract render(): void;

  /** Im `create()` der Szene aufrufen. `dim`: halbdurchsichtige Abdunklung der Szene darunter. */
  protected setupPanel(dim: boolean): void {
    this.dynamic = [];
    this.hits = [];
    if (dim) this.add.rectangle(0, 0, 8000, 8000, 0x000000, 0.72).setOrigin(0).setInteractive();
    this.gfx = this.add.graphics();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPanelPointer, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.refresh, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPanelPointer, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.refresh, this);
    });
  }

  refresh(): void {
    this.u = (this.registry.get(REGISTRY_KEYS.devicePixelRatio) as number | undefined) ?? 1;
    for (const object of this.dynamic) object.destroy();
    this.dynamic = [];
    this.hits = [];
    this.gfx.clear();
    this.render();
  }

  private onPanelPointer(pointer: Phaser.Input.Pointer): void {
    // Von hinten nach vorn: Overlays und Knöpfe liegen über Zellen.
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const hit = this.hits[i];
      if (hit && inside(hit.rect, pointer.x, pointer.y)) {
        audio.play('click');
        hit.action();
        return;
      }
    }
  }

  text(x: number, y: number, content: string, opts: TextOptions): Phaser.GameObjects.Text {
    const text = this.add
      .text(x, y, content, {
        fontFamily: FONT,
        fontSize: `${Math.round(opts.size * this.u)}px`,
        fontStyle: opts.bold ? 'bold' : 'normal',
        color: opts.color ?? '#dbe4f5',
        align: opts.align ?? 'left',
        wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
      })
      .setOrigin(opts.origin[0], opts.origin[1]);
    this.dynamic.push(text);
    return text;
  }

  button(rect: Rect, label: string, fill: number, textColor: string, action: (() => void) | null, size: number): void {
    const u = this.u;
    this.gfx.fillStyle(fill, 1).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 8 * u);
    this.text(rect.x + rect.w / 2, rect.y + rect.h / 2, label, {
      size,
      bold: true,
      color: textColor,
      origin: [0.5, 0.5],
      wrap: rect.w - 12 * u,
      align: 'center',
    });
    if (action) this.hits.push({ rect, action, label });
  }

  /** Abgerundete Fläche mit Rand. */
  protected frame(rect: Rect, fillAlpha = 0.97): void {
    const u = this.u;
    this.gfx.fillStyle(COLORS.uiPanel, fillAlpha).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 12 * u);
    this.gfx.lineStyle(Math.max(1, u), COLORS.uiDim, 0.7).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 12 * u);
  }

  protected closeButton(rect: Rect, action: () => void): void {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const r = rect.w * 0.26;
    this.gfx.fillStyle(0x24304f, 1).fillCircle(cx, cy, rect.w / 2);
    this.gfx
      .lineStyle(Math.max(2, this.u * 2), 0xdbe4f5, 1)
      .lineBetween(cx - r, cy - r, cx + r, cy + r)
      .lineBetween(cx - r, cy + r, cx + r, cy - r);
    this.hits.push({ rect, action });
  }
}
