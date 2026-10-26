import { COLORS } from '../config/palette';
import { armorReduction, deriveStats, equipmentMods, ORIGINS } from '../core/items';
import type { DerivedStats, Item, Slot, StatKey, StatMods } from '../core/items';
import type { Player } from '../entities/Player';
import { statsAtLevel } from '../core/stats';
import { ITEM_RULES } from '../data/items';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import { formatStatValue, itemName, statLine } from '../i18n/items';
import { hex } from './PanelScene';
import type { PanelCanvas, Rect } from './PanelScene';

/** Symbol eines Platzes (Waffe, Rüstung, Helm, Gadget, Modul) aus einfachen Linien. */
export function drawSlotGlyph(c: PanelCanvas, slot: Slot, cx: number, cy: number, r: number, color: number, alpha: number): void {
  const g = c.gfx;
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

/** Zelle mit Gegenstand (Farbe nach Seltenheit, Punkt nach Herkunft) oder leerem Platz. */
export function drawItemCell(c: PanelCanvas, rect: Rect, item: Item | null, selected: boolean, emptySlot?: Slot, dimmed = false): void {
  const g = c.gfx;
  const u = c.u;
  const rarityColor = item ? COLORS.rarity[item.rarity] : COLORS.uiDim;
  const fadeA = dimmed ? 0.35 : 1;
  g.fillStyle(item ? rarityColor : 0x1a2340, (item ? 0.18 : 0.6) * fadeA).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 6 * u);
  g.lineStyle(selected ? 3 * u : Math.max(1, u * 1.5), selected ? COLORS.accent : rarityColor, (item || selected ? 1 : 0.35) * fadeA);
  g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 6 * u);

  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (item) {
    drawSlotGlyph(c, item.slot, cx, cy - rect.h * 0.04, rect.w * 0.3, rarityColor, fadeA);
    g.fillStyle(COLORS.origin[item.origin], fadeA).fillCircle(rect.x + rect.w * 0.17, rect.y + rect.h * 0.83, rect.w * 0.07);
  } else if (emptySlot) {
    drawSlotGlyph(c, emptySlot, cx, cy - rect.h * 0.08, rect.w * 0.26, COLORS.uiDim, 0.55);
    c.text(cx, rect.y + rect.h * 0.84, t(`item.slot.${emptySlot}` as TextKey), { size: 9, color: '#7d8aa8', origin: [0.5, 0.5] });
  }
}

/** Werte der Figur mit einer bestimmten Ausrüstung (für Vorschau und Vergleich). */
export function previewStats(player: Player, mods: StatMods): DerivedStats {
  const { classDef, progression } = player;
  return deriveStats(statsAtLevel(classDef.stats, classDef.growth, progression.level), mods);
}

/** Zeilen "Schaden 14–18" usw. */
export function statSummary(d: DerivedStats): [string, string][] {
  return [
    [t('inv.stat.damage'), `${d.stats.damageMin}–${d.stats.damageMax}`],
    [t('inv.stat.hp'), String(d.stats.maxHp)],
    [t('inv.stat.armor'), `${Math.round(d.armor)}  (${Math.round(armorReduction(d.armor) * 100)} %)`],
    [t('inv.stat.speed'), String(Math.round(d.stats.moveSpeed))],
    [t('inv.stat.crit'), `${formatStatValue('critChance', d.critChance)} %`],
    [t('inv.stat.cooldown'), d.cooldownReduction > 0 ? `−${Math.round(d.cooldownReduction * 100)} %` : '0 %'],
    [t('inv.stat.lifesteal'), `${formatStatValue('lifesteal', d.lifesteal)} %`],
  ];
}

export interface ItemInfoOptions {
  /** Gegenstand ist gerade ausgerüstet: kein Vergleich, Set-Zählung ohne ihn zu verdoppeln. */
  equipped: boolean;
  equippedItems: readonly Item[];
  player: Player;
  /** Untere Grenze für Vergleichszeilen (darunter liegen Knöpfe). */
  maxY: number;
  /** Rechts oben freihalten (Schließen-Knopf). */
  reserveRight?: number;
}

/** Name, Werte, Set-Fortschritt und Vergleich eines Gegenstands. Knöpfe zeichnet der Aufrufer. */
export function drawItemInfo(c: PanelCanvas, rect: Rect, item: Item, opts: ItemInfoOptions): void {
  const u = c.u;
  const color = COLORS.rarity[item.rarity];
  let y = rect.y;

  c.text(rect.x, y, itemName(item), { size: 18, bold: true, color: hex(color), origin: [0, 0], wrap: rect.w - (opts.reserveRight ?? 0) });
  y += 26 * u;
  const meta = [
    t(`item.rarity.${item.rarity}` as TextKey),
    t(`item.origin.${item.origin}` as TextKey),
    t(`item.slot.${item.slot}` as TextKey),
    t('item.level', { level: item.level }),
  ].join('  ·  ');
  c.text(rect.x, y, meta, { size: 12, color: '#9fb0d0', origin: [0, 0], wrap: rect.w });
  y += 24 * u;

  const line = (text: string, textColor: string, bold = false): void => {
    c.text(rect.x, y, text, { size: 14, color: textColor, bold, origin: [0, 0], wrap: rect.w });
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

  const worn = opts.equippedItems.filter((other) => other.origin === item.origin).length;
  const count = opts.equipped ? worn : worn + 1;
  y += 4 * u;
  c.text(rect.x, y, `${t('item.set', { origin: t(`item.origin.${item.origin}` as TextKey), count: Math.min(count, 3) })}${count >= 3 ? `  ✓ ${t('item.setActive')}` : ''}`, {
    size: 12,
    color: count >= 3 ? '#8dffb0' : '#7d8aa8',
    origin: [0, 0],
    wrap: rect.w,
  });
  y += 22 * u;

  if (!opts.equipped) drawComparison(c, rect, y, item, opts);
}

/** Zeigt, wie sich die Werte der Figur ändern würden, wenn der Gegenstand ausgerüstet wird. */
function drawComparison(c: PanelCanvas, rect: Rect, startY: number, item: Item, opts: ItemInfoOptions): void {
  const u = c.u;
  const swapped = opts.equippedItems.filter((other) => other.slot !== item.slot).concat(item);
  const before = previewStats(opts.player, equipmentMods(opts.equippedItems, ITEM_RULES));
  const after = previewStats(opts.player, equipmentMods(swapped, ITEM_RULES));

  const rows: { label: string; from: string; to: string; delta: number }[] = [];
  const add = (label: string, from: number, to: number, fmt: (v: number) => string, eps = 0.0001): void => {
    if (Math.abs(to - from) > eps) rows.push({ label, from: fmt(from), to: fmt(to), delta: to - from });
  };
  const avg = (d: DerivedStats): number => (d.stats.damageMin + d.stats.damageMax) / 2;
  add(t('inv.stat.damage'), avg(before), avg(after), (v) => String(Math.round(v)), 0.5);
  add(t('inv.stat.hp'), before.stats.maxHp, after.stats.maxHp, (v) => String(Math.round(v)), 0.5);
  add(t('inv.stat.armor'), before.armor, after.armor, (v) => String(Math.round(v)), 0.5);
  add(t('inv.stat.speed'), before.stats.moveSpeed, after.stats.moveSpeed, (v) => String(Math.round(v)), 0.5);
  add(t('inv.stat.crit'), before.critChance, after.critChance, (v) => `${formatStatValue('critChance', v)} %`);
  add(t('inv.stat.cooldown'), before.cooldownReduction, after.cooldownReduction, (v) => `${formatStatValue('cooldownReduction', v)} %`);
  add(t('inv.stat.lifesteal'), before.lifesteal, after.lifesteal, (v) => `${formatStatValue('lifesteal', v)} %`);
  if (rows.length === 0) return;

  let y = startY;
  c.text(rect.x, y, t('inv.compare'), { size: 12, color: '#9fb0d0', origin: [0, 0] });
  y += 20 * u;
  for (const row of rows) {
    if (y > opts.maxY - 18 * u) break;
    const good = row.delta > 0;
    c.text(rect.x, y, row.label, { size: 13, color: '#9fb0d0', origin: [0, 0] });
    c.text(rect.x + rect.w, y, `${row.from} → ${row.to}  ${good ? '▲' : '▼'}`, {
      size: 13,
      bold: true,
      color: good ? '#8dffb0' : '#ff8a8a',
      origin: [1, 0],
    });
    y += 20 * u;
  }
}

/** Zeilen für Herkunfts-Sets (ausgerüstete Teile je Herkunft), für die Charakteransicht. */
export function setProgress(items: readonly Item[]): { origin: (typeof ORIGINS)[number]; count: number }[] {
  return ORIGINS.map((origin) => ({ origin, count: items.filter((item) => item.origin === origin).length })).filter((s) => s.count > 0);
}
