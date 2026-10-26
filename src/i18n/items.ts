import type { Item, StatKey } from '../core/items';
import { t } from './index';
import type { TextKey } from './index';

/** "Mars-Zielcomputer": Herkunft als Vorsilbe, damit keine Beugung nötig ist. */
export function itemName(item: Item): string {
  return `${t(`item.originPrefix.${item.origin}` as TextKey)}${t(`item.base.${item.base}` as TextKey)}`;
}

const PERCENT_STATS = new Set<StatKey>([
  'damagePct',
  'maxHpPct',
  'moveSpeedPct',
  'critChance',
  'cooldownReduction',
  'lifesteal',
  'potionHealPct',
  'zeroGControl',
]);

function formatNumber(value: number): string {
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

/** Zahl für einen Wert: Anteile als Prozent (0.047 → "4,7"), feste Werte ganzzahlig. */
export function formatStatValue(stat: StatKey, value: number): string {
  return PERCENT_STATS.has(stat) ? formatNumber(value * 100) : String(Math.round(value));
}

/** Vollständige Zeile, z. B. "+4,7 % Schaden". */
export function statLine(stat: StatKey, value: number): string {
  return t(`item.stat.${stat}` as TextKey, { value: formatStatValue(stat, value) });
}
