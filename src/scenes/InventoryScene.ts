import Phaser from 'phaser';
import { REGISTRY_PROFILE, SCENE_KEYS } from '../config/constants';
import { COLORS } from '../config/palette';
import { armorReduction, deriveStats, equipmentMods, ORIGINS, RARITIES, SLOTS } from '../core/items';
import type { DerivedStats, Item, Slot, StatKey } from '../core/items';
import { clamp } from '../core/math';
import type { Profile } from '../core/profile';
import { statsAtLevel } from '../core/stats';
import { ITEM_RULES } from '../data/items';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import { formatStatValue, itemName, statLine } from '../i18n/items';
import type { Player } from '../entities/Player';
import type { MissionScene } from './MissionScene';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const BAG_COLS = 5;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

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

type Action = () => void;

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
const inside = (rect: Rect, x: number, y: number): boolean => x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;

/**
 * Rucksack und Ausrüstung. Liegt über der pausierten Mission. Alles wird bei jeder Änderung neu gezeichnet,
 * das ist bei so wenigen Elementen einfach und ausreichend schnell.
 */
export class InventoryScene extends Phaser.Scene {
  private u = 1;
  private profile!: Profile;
  private player!: Player;
  private selectedId: string | null = null;
  private confirmScrapId: string | null = null;
  private layout!: Layout;
  private gfx!: Phaser.GameObjects.Graphics;
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private hits: { rect: Rect; action: Action; label?: string }[] = [];

  constructor() {
    super(SCENE_KEYS.inventory);
  }

  create(): void {
    this.profile = this.registry.get(REGISTRY_PROFILE) as Profile;
    this.player = (this.scene.get(SCENE_KEYS.mission) as MissionScene).player;
    this.selectedId = null;
    this.confirmScrapId = null;
    this.dynamic = [];

    this.add.rectangle(0, 0, 8000, 8000, 0x000000, 0.72).setOrigin(0).setInteractive();
    this.gfx = this.add.graphics();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.keyboard?.on('keydown-ESC', this.close, this);
    this.input.keyboard?.on('keydown-I', this.close, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.refresh, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.input.keyboard?.off('keydown-ESC', this.close, this);
      this.input.keyboard?.off('keydown-I', this.close, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.refresh, this);
    });
    this.refresh();
  }

  // ---------------------------------------------------------------- Eingabe

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Von hinten nach vorn: Overlays und Knöpfe liegen über Zellen.
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const hit = this.hits[i];
      if (hit && inside(hit.rect, pointer.x, pointer.y)) {
        hit.action();
        return;
      }
    }
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(SCENE_KEYS.mission);
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

  private refresh(): void {
    this.u = (this.registry.get('devicePixelRatio') as number | undefined) ?? 1;
    this.layout = this.computeLayout();
    for (const object of this.dynamic) object.destroy();
    this.dynamic = [];
    this.hits = [];
    const g = this.gfx.clear();
    const L = this.layout;
    const u = this.u;
    const inv = this.profile.inventory;

    // Fläche und Kopf
    g.fillStyle(COLORS.uiPanel, 0.97).fillRoundedRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h, 12 * u);
    g.lineStyle(Math.max(1, u), COLORS.uiDim, 0.7).strokeRoundedRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h, 12 * u);
    this.text(L.title.x, L.title.y, t('inv.title'), { size: 20, bold: true, color: '#dbe4f5', origin: [0, 0.5] });
    this.text(L.credits.x, L.credits.y, t('inv.credits', { amount: this.profile.wallet.credits }), {
      size: 14,
      bold: true,
      color: COLORS.credits,
      origin: [1, 0.5],
    });
    this.drawCloseButton(L.close);

    // Ausrüstung
    SLOTS.forEach((slot, i) => {
      const item = inv.equipped[slot];
      const rect = L.equipCells[i] as Rect;
      this.drawCell(rect, item, item?.id === this.selectedId, slot);
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
      this.drawCell(rect, item, item?.id === this.selectedId);
      if (item) this.hits.push({ rect, action: () => this.select(this.selectedId === item.id ? null : item.id) });
    });
    this.drawScrapCommonButton(L.scrapCommon);

    if (selected) this.drawDetail(L.detail, selected);
    else this.drawCharacterStats(L.info);
  }

  private drawCloseButton(rect: Rect): void {
    const g = this.gfx;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const r = rect.w * 0.26;
    g.fillStyle(0x24304f, 1).fillCircle(cx, cy, rect.w / 2);
    g.lineStyle(Math.max(2, this.u * 2), 0xdbe4f5, 1).lineBetween(cx - r, cy - r, cx + r, cy + r).lineBetween(cx - r, cy + r, cx + r, cy - r);
    this.hits.push({ rect, action: () => this.close() });
  }

  private drawCell(rect: Rect, item: Item | null, selected: boolean, emptySlot?: Slot): void {
    const g = this.gfx;
    const u = this.u;
    const rarityColor = item ? COLORS.rarity[item.rarity] : COLORS.uiDim;
    g.fillStyle(item ? rarityColor : 0x1a2340, item ? 0.18 : 0.6).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 6 * u);
    g.lineStyle(selected ? 3 * u : Math.max(1, u * 1.5), selected ? COLORS.accent : rarityColor, item || selected ? 1 : 0.35);
    g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 6 * u);

    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    if (item) {
      this.drawSlotGlyph(item.slot, cx, cy - rect.h * 0.04, rect.w * 0.3, rarityColor, 1);
      // Herkunft: farbiger Punkt unten links
      g.fillStyle(COLORS.origin[item.origin], 1).fillCircle(rect.x + rect.w * 0.17, rect.y + rect.h * 0.83, rect.w * 0.07);
    } else if (emptySlot) {
      this.drawSlotGlyph(emptySlot, cx, cy - rect.h * 0.08, rect.w * 0.26, COLORS.uiDim, 0.55);
      this.text(cx, rect.y + rect.h * 0.84, t(`item.slot.${emptySlot}` as TextKey), { size: 9, color: '#7d8aa8', origin: [0.5, 0.5] });
    }
  }

  private drawSlotGlyph(slot: Slot, cx: number, cy: number, r: number, color: number, alpha: number): void {
    const g = this.gfx;
    const w = Math.max(2, r * 0.22);
    g.lineStyle(w, color, alpha).fillStyle(color, alpha);
    switch (slot) {
      case 'weapon':
        g.lineBetween(cx - r * 0.8, cy + r * 0.8, cx + r * 0.8, cy - r * 0.8);
        g.lineBetween(cx - r * 0.55, cy + r * 0.05, cx - r * 0.05, cy + r * 0.55);
        break;
      case 'armor':
        g.strokePoints(
          [
            { x: cx - r * 0.8, y: cy - r * 0.8 },
            { x: cx + r * 0.8, y: cy - r * 0.8 },
            { x: cx + r * 0.8, y: cy + r * 0.1 },
            { x: cx, y: cy + r },
            { x: cx - r * 0.8, y: cy + r * 0.1 },
          ],
          true,
        );
        break;
      case 'helmet':
        g.beginPath().arc(cx, cy + r * 0.2, r * 0.85, Math.PI, 0).strokePath();
        g.lineBetween(cx - r * 0.85, cy + r * 0.2, cx + r * 0.85, cy + r * 0.2);
        g.lineBetween(cx - r * 0.85, cy + r * 0.2, cx - r * 0.85, cy + r * 0.75);
        g.lineBetween(cx + r * 0.85, cy + r * 0.2, cx + r * 0.85, cy + r * 0.75);
        break;
      case 'gadget':
        g.strokeCircle(cx, cy, r * 0.8);
        g.fillCircle(cx, cy, r * 0.22);
        break;
      case 'module':
        g.strokeRect(cx - r * 0.6, cy - r * 0.6, r * 1.2, r * 1.2);
        for (const dy of [-0.3, 0.3]) {
          g.lineBetween(cx - r, cy + r * dy, cx - r * 0.6, cy + r * dy);
          g.lineBetween(cx + r * 0.6, cy + r * dy, cx + r, cy + r * dy);
        }
        break;
    }
  }

  private drawScrapCommonButton(rect: Rect): void {
    const commons = this.profile.inventory.bag.filter((item) => item.rarity === 'common');
    const total = commons.reduce((sum, item) => sum + this.profile.inventory.scrapValue(item), 0);
    const enabled = commons.length > 0;
    this.button(rect, t('inv.scrapCommon', { amount: total }), enabled ? 0x2a3556 : 0x1a2340, enabled ? '#dbe4f5' : '#5d6b8c', enabled ? () => this.scrapAllCommon() : null, 12);
  }

  private drawCharacterStats(rect: Rect): void {
    const u = this.u;
    const derived = this.previewStats(this.profile.inventory.mods());
    const lines = this.statSummary(derived);
    const items = this.profile.inventory.equippedItems();

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

    // Set-Fortschritt
    for (const origin of ORIGINS) {
      const count = items.filter((item) => item.origin === origin).length;
      if (count === 0) continue;
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

  /** Werte der Figur mit einer bestimmten Ausrüstung (für Vorschau und Vergleich). */
  private previewStats(mods: ReturnType<typeof equipmentMods>): DerivedStats {
    const { classDef, progression } = this.player;
    return deriveStats(statsAtLevel(classDef.stats, classDef.growth, progression.level), mods);
  }

  private statSummary(d: DerivedStats): [string, string][] {
    return [
      [t('inv.stat.damage'), `${d.stats.damageMin}–${d.stats.damageMax}`],
      [t('inv.stat.hp'), String(d.stats.maxHp)],
      [t('inv.stat.armor'), `${Math.round(d.armor)}  (${Math.round(armorReduction(d.armor) * 100)} %)`],
      [t('inv.stat.speed'), String(Math.round(d.stats.moveSpeed))],
      [t('inv.stat.crit'), `${Math.round(d.critChance * 1000) / 10} %`.replace('.', ',')],
      [t('inv.stat.cooldown'), d.cooldownReduction > 0 ? `−${Math.round(d.cooldownReduction * 100)} %` : '0 %'],
      [t('inv.stat.lifesteal'), `${Math.round(d.lifesteal * 1000) / 10} %`.replace('.', ',')],
    ];
  }

  private drawDetail(rect: Rect, item: Item): void {
    const u = this.u;
    const inv = this.profile.inventory;
    const equipped = inv.equipped[item.slot]?.id === item.id;
    const color = COLORS.rarity[item.rarity];

    // Karte (im Hochformat liegt sie deckend über dem Rucksack)
    this.gfx.fillStyle(COLORS.uiPanel, 1).fillRoundedRect(rect.x - 4 * u, rect.y - 4 * u, rect.w + 8 * u, rect.h + 8 * u, 8 * u);
    const close: Rect = { x: rect.x + rect.w - 34 * u, y: rect.y, w: 34 * u, h: 34 * u };
    const cx = close.x + close.w / 2;
    const cy = close.y + close.h / 2;
    this.gfx.lineStyle(Math.max(2, u * 1.5), 0x9fb0d0, 1).lineBetween(cx - 6 * u, cy - 6 * u, cx + 6 * u, cy + 6 * u).lineBetween(cx - 6 * u, cy + 6 * u, cx + 6 * u, cy - 6 * u);
    this.hits.push({ rect: close, action: () => this.select(null) });

    let y = rect.y;
    this.text(rect.x, y, itemName(item), { size: 18, bold: true, color: hex(color), origin: [0, 0], wrap: rect.w - 40 * u });
    y += 26 * u;
    const meta = [
      t(`item.rarity.${item.rarity}` as TextKey),
      t(`item.origin.${item.origin}` as TextKey),
      t(`item.slot.${item.slot}` as TextKey),
      t('item.level', { level: item.level }),
    ].join('  ·  ');
    this.text(rect.x, y, meta, { size: 12, color: '#9fb0d0', origin: [0, 0], wrap: rect.w });
    y += 24 * u;

    const line = (text: string, textColor: string, bold = false): void => {
      this.text(rect.x, y, text, { size: 14, color: textColor, bold, origin: [0, 0], wrap: rect.w });
      y += 20 * u;
    };
    line(statLine(item.primary.stat, item.primary.value), '#ffffff', true);
    line(statLine(item.originBonus.stat, item.originBonus.value), hex(COLORS.origin[item.origin]));
    for (const affix of item.affixes) line(statLine(affix.stat, affix.value), '#9fd0ff');
    if (item.legendary) {
      y += 2 * u;
      line(t(`item.legendary.${item.legendary}` as TextKey), COLORS.elite, true);
      const mods = ITEM_RULES.legendary[item.legendary];
      for (const stat of Object.keys(mods) as StatKey[]) line(`   ${statLine(stat, mods[stat] ?? 0)}`, COLORS.elite);
    }

    // Set
    const wornOfOrigin = inv.equippedItems().filter((other) => other.origin === item.origin).length;
    const count = equipped ? wornOfOrigin : wornOfOrigin + 1;
    y += 4 * u;
    this.text(rect.x, y, `${t('item.set', { origin: t(`item.origin.${item.origin}` as TextKey), count: Math.min(count, 3) })}${count >= 3 ? `  ✓ ${t('item.setActive')}` : ''}`, {
      size: 12,
      color: count >= 3 ? '#8dffb0' : '#7d8aa8',
      origin: [0, 0],
      wrap: rect.w,
    });
    y += 22 * u;

    // Vergleich mit dem getragenen Gegenstand desselben Platzes
    const buttonsH = (equipped ? 46 : 92) * u;
    if (!equipped) y = this.drawComparison(rect, y, item, rect.y + rect.h - buttonsH);

    // Knöpfe unten
    const btnH = 40 * u;
    let by = rect.y + rect.h - btnH;
    if (!equipped) {
      const value = inv.scrapValue(item);
      const confirming = this.confirmScrapId === item.id;
      this.button(
        { x: rect.x, y: by, w: rect.w, h: btnH },
        confirming ? t('inv.scrapConfirm') : t('inv.scrap', { amount: value }),
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

  /** Zeigt, wie sich die Werte der Figur ändern würden. Liefert die neue y-Position. */
  private drawComparison(rect: Rect, startY: number, item: Item, maxY: number): number {
    const u = this.u;
    const inv = this.profile.inventory;
    const current = inv.equippedItems();
    const swapped = current.filter((other) => other.slot !== item.slot).concat(item);
    const before = this.previewStats(equipmentMods(current, ITEM_RULES));
    const after = this.previewStats(equipmentMods(swapped, ITEM_RULES));

    const rows: { label: string; from: string; to: string; delta: number }[] = [];
    const add = (label: string, from: number, to: number, fmt: (v: number) => string, eps = 0.0001): void => {
      if (Math.abs(to - from) > eps) rows.push({ label, from: fmt(from), to: fmt(to), delta: to - from });
    };
    const avg = (d: DerivedStats) => (d.stats.damageMin + d.stats.damageMax) / 2;
    add(t('inv.stat.damage'), avg(before), avg(after), (v) => String(Math.round(v)), 0.5);
    add(t('inv.stat.hp'), before.stats.maxHp, after.stats.maxHp, (v) => String(Math.round(v)), 0.5);
    add(t('inv.stat.armor'), before.armor, after.armor, (v) => String(Math.round(v)), 0.5);
    add(t('inv.stat.speed'), before.stats.moveSpeed, after.stats.moveSpeed, (v) => String(Math.round(v)), 0.5);
    add(t('inv.stat.crit'), before.critChance, after.critChance, (v) => `${formatStatValue('critChance', v)} %`);
    add(t('inv.stat.cooldown'), before.cooldownReduction, after.cooldownReduction, (v) => `${formatStatValue('cooldownReduction', v)} %`);
    add(t('inv.stat.lifesteal'), before.lifesteal, after.lifesteal, (v) => `${formatStatValue('lifesteal', v)} %`);
    if (rows.length === 0) return startY;

    let y = startY;
    this.text(rect.x, y, t('inv.compare'), { size: 12, color: '#9fb0d0', origin: [0, 0] });
    y += 20 * u;
    for (const row of rows) {
      if (y > maxY - 18 * u) break;
      const good = row.delta > 0;
      this.text(rect.x, y, row.label, { size: 13, color: '#9fb0d0', origin: [0, 0] });
      this.text(rect.x + rect.w, y, `${row.from} → ${row.to}  ${good ? '▲' : '▼'}`, {
        size: 13,
        bold: true,
        color: good ? '#8dffb0' : '#ff8a8a',
        origin: [1, 0],
      });
      y += 20 * u;
    }
    return y;
  }

  // ---------------------------------------------------------------- Bausteine

  private button(rect: Rect, label: string, fill: number, textColor: string, action: Action | null, size: number): void {
    const u = this.u;
    this.gfx.fillStyle(fill, 1).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 8 * u);
    this.text(rect.x + rect.w / 2, rect.y + rect.h / 2, label, { size, bold: true, color: textColor, origin: [0.5, 0.5], wrap: rect.w - 12 * u });
    if (action) this.hits.push({ rect, action, label });
  }

  private text(
    x: number,
    y: number,
    content: string,
    opts: { size: number; color?: string; bold?: boolean; origin: [number, number]; wrap?: number },
  ): Phaser.GameObjects.Text {
    const text = this.add
      .text(x, y, content, {
        fontFamily: FONT,
        fontSize: `${Math.round(opts.size * this.u)}px`,
        fontStyle: opts.bold ? 'bold' : 'normal',
        color: opts.color ?? '#dbe4f5',
        wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
      })
      .setOrigin(opts.origin[0], opts.origin[1]);
    this.dynamic.push(text);
    return text;
  }
}
