import { REGISTRY_PROFILE, REGISTRY_SESSION, SCENE_KEYS } from '../config/constants';
import { COLORS } from '../config/palette';
import { clamp } from '../core/math';
import { createRng } from '../core/rng';
import { CLASS_LIST } from '../data/classes';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import { SLOT_COUNT } from '../persistence/session';
import type { Session, SlotSummary } from '../persistence/session';
import { PanelScene, hex } from '../ui/PanelScene';
import type { Rect } from '../ui/PanelScene';

type View = 'slots' | 'class';

/** Titelseite: drei Spielstände zur Auswahl, bei einem leeren Platz die Wahl der Figur. */
export class TitleScene extends PanelScene {
  private session!: Session;
  private view: View = 'slots';
  private pendingSlot = 1;
  private confirmDeleteSlot: number | null = null;

  constructor() {
    super(SCENE_KEYS.title);
  }

  create(): void {
    this.session = this.registry.get(REGISTRY_SESSION) as Session;
    this.session.end();
    this.registry.remove(REGISTRY_PROFILE);
    this.view = 'slots';
    this.confirmDeleteSlot = null;
    this.cameras.main.setBackgroundColor(COLORS.background);
    // Das HUD gehört zu Hub und Mission.
    if (this.scene.isActive(SCENE_KEYS.hud)) this.scene.stop(SCENE_KEYS.hud);

    this.setupPanel(false);
    this.refresh();
  }

  // ---------------------------------------------------------------- Aktionen

  private openSlot(slot: number, summary: SlotSummary | null): void {
    if (summary) {
      const profile = this.session.load(slot);
      if (profile) this.enterHub(profile);
      return;
    }
    this.pendingSlot = slot;
    this.view = 'class';
    this.refresh();
  }

  private chooseClass(classId: string): void {
    this.enterHub(this.session.startNew(this.pendingSlot, classId));
  }

  private enterHub(profile: unknown): void {
    this.registry.set(REGISTRY_PROFILE, profile);
    this.scene.start(SCENE_KEYS.hub);
  }

  private deleteSlot(slot: number): void {
    if (this.confirmDeleteSlot !== slot) {
      this.confirmDeleteSlot = slot;
    } else {
      this.session.delete(slot);
      this.confirmDeleteSlot = null;
    }
    this.refresh();
  }

  // ---------------------------------------------------------------- Zeichnen

  protected render(): void {
    this.drawStars();
    if (this.view === 'slots') this.renderSlots();
    else this.renderClasses();
  }

  private drawStars(): void {
    const rng = createRng(7);
    const { width, height } = this.scale;
    for (let i = 0; i < 70; i++) {
      this.gfx.fillStyle(0x8fa3c7, 0.15 + rng.next() * 0.35).fillCircle(rng.next() * width, rng.next() * height, (0.6 + rng.next() * 1.4) * this.u);
    }
  }

  private heading(title: string, subtitle: string | null, y: number): number {
    const { width } = this.scale;
    const u = this.u;
    this.text(width / 2, y, title, { size: width / u < 520 ? 30 : 40, bold: true, color: hex(COLORS.accent), origin: [0.5, 0.5] });
    if (subtitle) this.text(width / 2, y + 30 * u, subtitle, { size: 13, color: '#9fb0d0', origin: [0.5, 0.5], wrap: width * 0.9, align: 'center' });
    return y + (subtitle ? 56 : 40) * u;
  }

  private renderSlots(): void {
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const summaries = this.session.summaries();
    const last = this.session.lastSlot();
    const top = this.heading(t('title.name'), t('title.subtitle'), Math.max(40 * u, H * 0.1));

    const landscape = W >= H * 1.15;
    const margin = 20 * u;
    const gap = 14 * u;
    const areaH = H - top - margin;
    const cards: Rect[] = [];
    if (landscape) {
      const w = clamp((W - 2 * margin - (SLOT_COUNT - 1) * gap) / SLOT_COUNT, 150 * u, 280 * u);
      const total = SLOT_COUNT * w + (SLOT_COUNT - 1) * gap;
      const h = clamp(areaH * 0.8, 150 * u, 230 * u);
      for (let i = 0; i < SLOT_COUNT; i++) cards.push({ x: (W - total) / 2 + i * (w + gap), y: top + (areaH - h) / 2, w, h });
    } else {
      const w = Math.min(W - 2 * margin, 420 * u);
      const h = clamp((areaH - (SLOT_COUNT - 1) * gap) / SLOT_COUNT, 96 * u, 150 * u);
      for (let i = 0; i < SLOT_COUNT; i++) cards.push({ x: (W - w) / 2, y: top + i * (h + gap), w, h });
    }

    cards.forEach((rect, i) => this.drawSlotCard(rect, i + 1, summaries[i] ?? null, last === i + 1));
  }

  private drawSlotCard(rect: Rect, slot: number, summary: SlotSummary | null, isLast: boolean): void {
    const u = this.u;
    const g = this.gfx;
    const pad = 14 * u;
    g.fillStyle(COLORS.uiPanel, 0.92).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 12 * u);
    g.lineStyle(isLast ? 3 * u : Math.max(1, u), isLast ? COLORS.accent : COLORS.uiDim, isLast ? 1 : 0.6).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 12 * u);
    this.hits.push({ rect, action: () => this.openSlot(slot, summary) });

    this.text(rect.x + pad, rect.y + pad, t('title.slot', { n: slot }), { size: 12, color: '#7d8aa8', origin: [0, 0] });
    if (!summary) {
      this.text(rect.x + rect.w / 2, rect.y + rect.h / 2 - 8 * u, t('title.new'), { size: 20, bold: true, color: '#dbe4f5', origin: [0.5, 0.5] });
      this.text(rect.x + rect.w / 2, rect.y + rect.h / 2 + 18 * u, t('title.newHint'), { size: 12, color: '#7d8aa8', origin: [0.5, 0.5] });
      return;
    }

    const info = CLASS_LIST.find((c) => c.id === summary.classId);
    const name = info ? t(info.nameKey) : summary.classId;
    this.text(rect.x + pad, rect.y + pad + 20 * u, name, { size: 20, bold: true, color: hex(info?.color ?? 0xffffff), origin: [0, 0], wrap: rect.w - 2 * pad });
    const lines = [
      `${t('title.level', { level: summary.level })}  ·  ${t('title.credits', { amount: summary.credits })}`,
      t('title.missions', { n: summary.missionsCompleted }),
    ];
    if (summary.savedAt) lines.push(new Date(summary.savedAt).toLocaleDateString('de-DE'));
    this.text(rect.x + pad, rect.y + pad + 52 * u, lines.join('\n'), { size: 13, color: '#dbe4f5', origin: [0, 0], wrap: rect.w - 2 * pad });
    if (isLast) this.text(rect.x + rect.w - pad, rect.y + pad, t('title.last'), { size: 11, color: hex(COLORS.accent), origin: [1, 0] });

    // Löschen unten rechts; zum Bestätigen ein zweites Mal tippen
    const confirming = this.confirmDeleteSlot === slot;
    const del: Rect = { x: rect.x + rect.w - (confirming ? 190 : 84) * u - pad, y: rect.y + rect.h - 34 * u - pad * 0.6, w: (confirming ? 190 : 84) * u, h: 30 * u };
    this.button(del, confirming ? t('title.deleteConfirm') : t('title.delete'), confirming ? 0x7a2b2b : 0x2a3556, confirming ? '#ffd0d0' : '#9fb0d0', () => this.deleteSlot(slot), 11);
  }

  private renderClasses(): void {
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const top = this.heading(t('title.chooseClass'), null, Math.max(36 * u, H * 0.08));
    const landscape = W >= H * 1.15;
    const margin = 20 * u;
    const gap = 12 * u;
    const count = CLASS_LIST.length;
    const cols = landscape ? count : 2;
    const rows = Math.ceil(count / cols);
    const backH = 40 * u;
    const areaH = H - top - margin - backH - gap;
    const w = clamp((W - 2 * margin - (cols - 1) * gap) / cols, 130 * u, 230 * u);
    const h = clamp((areaH - (rows - 1) * gap) / rows, 120 * u, 260 * u);
    const totalW = cols * w + (cols - 1) * gap;

    CLASS_LIST.forEach((info, i) => {
      const rect: Rect = { x: (W - totalW) / 2 + (i % cols) * (w + gap), y: top + Math.floor(i / cols) * (h + gap), w, h };
      const g = this.gfx;
      const dim = info.available ? 1 : 0.45;
      g.fillStyle(COLORS.uiPanel, 0.92).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 12 * u);
      g.lineStyle(info.available ? 2 * u : Math.max(1, u), info.available ? info.color : COLORS.uiDim, info.available ? 1 : 0.5).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 12 * u);

      // Figur wie im Spiel: runder Körper mit Nase
      const r = Math.min(rect.w, rect.h) * 0.16;
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h * 0.3;
      g.fillStyle(0x000000, 0.5 * dim).fillCircle(cx, cy, r + 2 * u);
      g.fillStyle(info.color, dim).fillCircle(cx, cy, r);
      g.fillStyle(0xffffff, 0.9 * dim).fillTriangle(cx + r - 3 * u, cy - 5 * u, cx + r + 7 * u, cy, cx + r - 3 * u, cy + 5 * u);

      this.text(cx, rect.y + rect.h * 0.52, t(info.nameKey), { size: 16, bold: true, color: hex(info.color), origin: [0.5, 0.5], wrap: rect.w - 16 * u, align: 'center' });
      this.text(cx, rect.y + rect.h * 0.7, t(info.roleKey), { size: 12, color: '#9fb0d0', origin: [0.5, 0.5], wrap: rect.w - 20 * u, align: 'center' });
      this.text(cx, rect.y + rect.h - 16 * u, info.available ? t('title.pick') : t('title.soon'), {
        size: 12,
        bold: true,
        color: info.available ? '#8dffb0' : '#7d8aa8',
        origin: [0.5, 0.5],
      });
      if (info.available) this.hits.push({ rect, action: () => this.chooseClass(info.id) });
    });

    const back: Rect = { x: W / 2 - 90 * u, y: H - margin - backH, w: 180 * u, h: backH };
    this.button(back, t('title.back' as TextKey), 0x2a3556, '#dbe4f5', () => {
      this.view = 'slots';
      this.refresh();
    }, 14);
  }
}
