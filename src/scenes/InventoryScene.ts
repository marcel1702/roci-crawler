import { REGISTRY_PROFILE, SCENE_KEYS } from '../config/constants';
import { COLORS } from '../config/palette';
import { RARITIES, SLOTS } from '../core/items';
import type { Item } from '../core/items';
import { clamp } from '../core/math';
import type { Profile } from '../core/profile';
import type { Player } from '../entities/Player';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import { PanelScene, hex } from '../ui/PanelScene';
import type { Rect } from '../ui/PanelScene';
import { drawItemCell, drawItemInfo, previewStats, setProgress, statSummary } from '../ui/itemWidgets';

const BAG_COLS = 5;

interface Layout {
  panel: Rect;
  title: { x: number; y: number };
  credits: { x: number; y: number };
  close: Rect;
  equipCells: Rect[];
  bagCells: Rect[];
  bagLabel: { x: number; y: number };
  scrapCommon: Rect;
  /** Bereich für Charakterwerte, wenn nichts ausgewählt ist. */
  info: Rect;
  /** Bereich für die Detailkarte; im Hochformat liegt sie über Rucksack und Werten. */
  detail: Rect;
  /** True im Hochformat: Die Detailkarte ersetzt Rucksack und Werte, solange etwas ausgewählt ist. */
  detailCoversBag: boolean;
}

/** Was beim Öffnen übergeben wird: welche Szene pausiert wurde und danach fortgesetzt wird. */
export interface InventoryData {
  parent: string;
}

/**
 * Rucksack und Ausrüstung. Liegt über der pausierten Mission oder dem Hub. Alles wird bei jeder Änderung neu
 * gezeichnet, das ist bei so wenigen Elementen einfach und ausreichend schnell.
 */
export class InventoryScene extends PanelScene {
  private parent: string = SCENE_KEYS.mission;
  private profile!: Profile;
  private player!: Player;
  private selectedId: string | null = null;
  private confirmScrapId: string | null = null;
  layout!: Layout;

  constructor() {
    super(SCENE_KEYS.inventory);
  }

  init(data?: InventoryData): void {
    this.parent = data?.parent ?? SCENE_KEYS.mission;
  }

  create(): void {
    this.profile = this.registry.get(REGISTRY_PROFILE) as Profile;
    this.player = (this.scene.get(this.parent) as unknown as { player: Player }).player;
    this.selectedId = null;
    this.confirmScrapId = null;

    this.setupPanel(true);
    this.input.keyboard?.on('keydown-ESC', this.close, this);
    this.input.keyboard?.on('keydown-I', this.close, this);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown-ESC', this.close, this);
      this.input.keyboard?.off('keydown-I', this.close, this);
    });
    this.refresh();
  }

  // ---------------------------------------------------------------- Aktionen

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.parent);
  }

  private select(id: string | null): void {
    this.selectedId = id;
    this.confirmScrapId = null;
    this.refresh();
  }

  private changed(): void {
    this.player.refreshStats();
    this.profile.touch();
    this.refresh();
  }

  private equip(item: Item): void {
    if (!this.profile.inventory.equip(item.id)) return;
    // Im Hochformat verdeckt die Detailkarte den Rucksack: zurück zur Liste, damit man weitere Teile ausrüsten kann.
    if (this.layout.detailCoversBag) this.selectedId = null;
    this.changed();
  }

  private unequip(item: Item): void {
    if (!this.profile.inventory.unequip(item.slot)) return;
    if (this.layout.detailCoversBag) this.selectedId = null;
    this.changed();
  }

  private scrap(item: Item): void {
    const needsConfirm = RARITIES.indexOf(item.rarity) >= RARITIES.indexOf('epic');
    if (needsConfirm && this.confirmScrapId !== item.id) {
      this.confirmScrapId = item.id;
      this.refresh();
      return;
    }
    const credits = this.profile.inventory.scrap(item.id);
    if (credits > 0) {
      this.profile.wallet.add(credits);
      this.selectedId = null;
      this.confirmScrapId = null;
      this.changed();
    }
  }

  private scrapAllCommon(): void {
    const commons = this.profile.inventory.bag.filter((item) => item.rarity === 'common');
    let total = 0;
    for (const item of commons) total += this.profile.inventory.scrap(item.id);
    if (total > 0) {
      this.profile.wallet.add(total);
      if (this.selectedId && !this.profile.inventory.find(this.selectedId)) this.selectedId = null;
      this.changed();
    }
  }

  // ---------------------------------------------------------------- Layout

  private computeLayout(): Layout {
    const u = this.u;
    const { width: W, height: H } = this.scale;
    const m = 12 * u;
    const pad = 12 * u;
    const gap = 6 * u;
    const titleH = 44 * u;
    const panel: Rect = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
    const inner: Rect = { x: panel.x + pad, y: panel.y + titleH, w: panel.w - 2 * pad, h: panel.h - titleH - pad };
    const landscape = W >= H * 1.15;
    const closeSize = 40 * u;
    const close: Rect = { x: panel.x + panel.w - closeSize - 6 * u, y: panel.y + 4 * u, w: closeSize, h: closeSize };
    const scrapH = 34 * u;
    const labelH = 18 * u;

    const equipCells: Rect[] = [];
    const bagCells: Rect[] = [];
    let bagLabel = { x: 0, y: 0 };
    let scrapCommon: Rect;
    let info: Rect;
    let detail: Rect;
    let detailCoversBag = false;

    if (landscape) {
      const eq = clamp((inner.h - 4 * gap) / 5, 40 * u, 66 * u);
      SLOTS.forEach((_, i) => equipCells.push({ x: inner.x, y: inner.y + i * (eq + gap), w: eq, h: eq }));

      const bagX = inner.x + eq + pad;
      const bagAreaH = inner.h - labelH - scrapH - 2 * gap;
      const widthBudget = (inner.w - eq - 2 * pad) * 0.46;
      const cell = clamp(Math.min((bagAreaH - 3 * gap) / 4, (widthBudget - (BAG_COLS - 1) * gap) / BAG_COLS), 38 * u, 64 * u);
      bagLabel = { x: bagX, y: inner.y };
      this.gridCells(bagCells, bagX, inner.y + labelH, cell, gap);
      const bagW = BAG_COLS * cell + (BAG_COLS - 1) * gap;
      scrapCommon = { x: bagX, y: inner.y + labelH + 4 * cell + 3 * gap + gap, w: bagW, h: scrapH };
      const infoX = bagX + bagW + pad;
      info = { x: infoX, y: inner.y, w: inner.x + inner.w - infoX, h: inner.h };
      detail = info;
    } else {
      const eq = clamp((inner.w - 4 * gap) / 5, 40 * u, 64 * u);
      SLOTS.forEach((_, i) => equipCells.push({ x: inner.x + i * (eq + gap), y: inner.y, w: eq, h: eq }));

      const bagTop = inner.y + eq + gap + labelH;
      const cell = clamp((inner.w - (BAG_COLS - 1) * gap) / BAG_COLS, 38 * u, 64 * u);
      bagLabel = { x: inner.x, y: bagTop - labelH };
      this.gridCells(bagCells, inner.x, bagTop, cell, gap);
      const bagBottom = bagTop + 4 * cell + 3 * gap;
      scrapCommon = { x: inner.x, y: bagBottom + gap, w: BAG_COLS * cell + (BAG_COLS - 1) * gap, h: scrapH };
      const infoY = scrapCommon.y + scrapH + gap;
      info = { x: inner.x, y: infoY, w: inner.w, h: inner.y + inner.h - infoY };
      detail = { x: inner.x, y: bagTop - labelH, w: inner.w, h: inner.y + inner.h - (bagTop - labelH) };
      detailCoversBag = true;
    }

    return {
      panel,
      title: { x: panel.x + pad, y: panel.y + titleH / 2 },
      credits: { x: close.x - 10 * u, y: panel.y + titleH / 2 },
      close,
      equipCells,
      bagCells,
      bagLabel,
      scrapCommon,
      info,
      detail,
      detailCoversBag,
    };
  }

  private gridCells(out: Rect[], x: number, y: number, cell: number, gap: number): void {
    for (let i = 0; i < 20; i++) {
      out.push({ x: x + (i % BAG_COLS) * (cell + gap), y: y + Math.floor(i / BAG_COLS) * (cell + gap), w: cell, h: cell });
    }
  }

  // ---------------------------------------------------------------- Zeichnen

  protected render(): void {
    this.layout = this.computeLayout();
    const L = this.layout;
    const u = this.u;
    const inv = this.profile.inventory;

    this.frame(L.panel);
    this.text(L.title.x, L.title.y, t('inv.title'), { size: 20, bold: true, color: '#dbe4f5', origin: [0, 0.5] });
    this.text(L.credits.x, L.credits.y, t('inv.credits', { amount: this.profile.wallet.credits }), {
      size: 14,
      bold: true,
      color: COLORS.credits,
      origin: [1, 0.5],
    });
    this.closeButton(L.close, () => this.close());

    // Ausrüstung
    SLOTS.forEach((slot, i) => {
      const item = inv.equipped[slot];
      const rect = L.equipCells[i] as Rect;
      drawItemCell(this, rect, item, item?.id === this.selectedId, slot);
      this.hits.push({ rect, action: () => this.select(item ? (this.selectedId === item.id ? null : item.id) : null) });
    });

    // Werte oder Detailkarte; im Hochformat ersetzt die Karte den Rucksack (Texte lassen sich nicht überdecken).
    const selected = this.selectedId ? inv.find(this.selectedId) : null;
    if (selected && L.detailCoversBag) {
      this.drawDetail(L.detail, selected);
      return;
    }

    // Rucksack
    this.text(L.bagLabel.x, L.bagLabel.y + 8 * u, t('inv.bag', { count: inv.bag.length, max: inv.capacity }), {
      size: 12,
      color: '#9fb0d0',
      origin: [0, 0.5],
    });
    L.bagCells.forEach((rect, i) => {
      const item = inv.bag[i] ?? null;
      drawItemCell(this, rect, item, item?.id === this.selectedId);
      if (item) this.hits.push({ rect, action: () => this.select(this.selectedId === item.id ? null : item.id) });
    });
    this.drawScrapCommonButton(L.scrapCommon);

    if (selected) this.drawDetail(L.detail, selected);
    else this.drawCharacterStats(L.info);
  }

  private drawScrapCommonButton(rect: Rect): void {
    const commons = this.profile.inventory.bag.filter((item) => item.rarity === 'common');
    const total = commons.reduce((sum, item) => sum + this.profile.inventory.scrapValue(item), 0);
    const enabled = commons.length > 0;
    this.button(
      rect,
      t('inv.scrapCommon', { amount: total }),
      enabled ? 0x2a3556 : 0x1a2340,
      enabled ? '#dbe4f5' : '#5d6b8c',
      enabled ? () => this.scrapAllCommon() : null,
      12,
    );
  }

  private drawCharacterStats(rect: Rect): void {
    const u = this.u;
    const lines = statSummary(previewStats(this.player, this.profile.inventory.mods()));

    let y = rect.y + 4 * u;
    this.text(rect.x, y, t('inv.equipped'), { size: 12, color: '#9fb0d0', origin: [0, 0] });
    y += 22 * u;
    const wide = rect.w > 300 * u;
    const colW = wide ? rect.w / 2 : rect.w;
    lines.forEach(([label, value], i) => {
      const col = wide ? i % 2 : 0;
      const row = wide ? Math.floor(i / 2) : i;
      const x = rect.x + col * colW;
      const ly = y + row * 22 * u;
      this.text(x, ly, label, { size: 13, color: '#9fb0d0', origin: [0, 0] });
      this.text(x + colW - 14 * u, ly, value, { size: 13, bold: true, color: '#ffffff', origin: [1, 0] });
    });
    y += Math.ceil(lines.length / (wide ? 2 : 1)) * 22 * u + 10 * u;

    for (const { origin, count } of setProgress(this.profile.inventory.equippedItems())) {
      const active = count >= 3;
      this.text(rect.x, y, `${t('item.set', { origin: t(`item.origin.${origin}` as TextKey), count: Math.min(count, 3) })}${active ? '  ✓' : ''}`, {
        size: 12,
        color: active ? '#8dffb0' : hex(COLORS.origin[origin]),
        origin: [0, 0],
      });
      y += 18 * u;
    }
    if (rect.h - (y - rect.y) > 24 * u) {
      this.text(rect.x, rect.y + rect.h - 4 * u, t('inv.selectHint'), { size: 12, color: '#7d8aa8', origin: [0, 1] });
    }
  }

  private drawDetail(rect: Rect, item: Item): void {
    const u = this.u;
    const inv = this.profile.inventory;
    const equipped = inv.equipped[item.slot]?.id === item.id;

    // Karte (im Hochformat liegt sie deckend über dem Rucksack)
    this.gfx.fillStyle(COLORS.uiPanel, 1).fillRoundedRect(rect.x - 4 * u, rect.y - 4 * u, rect.w + 8 * u, rect.h + 8 * u, 8 * u);
    const close: Rect = { x: rect.x + rect.w - 34 * u, y: rect.y, w: 34 * u, h: 34 * u };
    const cx = close.x + close.w / 2;
    const cy = close.y + close.h / 2;
    this.gfx
      .lineStyle(Math.max(2, u * 1.5), 0x9fb0d0, 1)
      .lineBetween(cx - 6 * u, cy - 6 * u, cx + 6 * u, cy + 6 * u)
      .lineBetween(cx - 6 * u, cy + 6 * u, cx + 6 * u, cy - 6 * u);
    this.hits.push({ rect: close, action: () => this.select(null) });

    const buttonsH = (equipped ? 46 : 92) * u;
    drawItemInfo(this, rect, item, {
      equipped,
      equippedItems: inv.equippedItems(),
      player: this.player,
      maxY: rect.y + rect.h - buttonsH,
      reserveRight: 40 * u,
    });

    // Knöpfe unten
    const btnH = 40 * u;
    let by = rect.y + rect.h - btnH;
    if (!equipped) {
      const confirming = this.confirmScrapId === item.id;
      this.button(
        { x: rect.x, y: by, w: rect.w, h: btnH },
        confirming ? t('inv.scrapConfirm') : t('inv.scrap', { amount: inv.scrapValue(item) }),
        confirming ? 0x7a2b2b : 0x3a2a2a,
        '#ffd0d0',
        () => this.scrap(item),
        14,
      );
      by -= btnH + 8 * u;
    }
    const full = equipped && inv.isFull;
    this.button(
      { x: rect.x, y: by, w: rect.w, h: btnH },
      equipped ? t('inv.unequip') : t('inv.equip'),
      full ? 0x1a2340 : 0x2c6b4a,
      full ? '#5d6b8c' : '#ffffff',
      full ? null : equipped ? () => this.unequip(item) : () => this.equip(item),
      15,
    );
  }
}
