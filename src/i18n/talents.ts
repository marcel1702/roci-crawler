import type { AbilityBoost, TalentNode } from '../core/talents';
import { statLine } from './items';
import { t } from './index';
import type { TextKey } from './index';
import type { ClassDef } from '../data/types';

export function talentName(node: TalentNode): string {
  return t(`talent.${node.id}` as TextKey);
}

function percent(value: number): string {
  return String(Math.round(value * 1000) / 10).replace('.', ',');
}

/** Beschreibung eines Knotens "pro Rang", aus den Werten erzeugt (nie von Hand gepflegt). */
export function talentLines(node: TalentNode, classDef: ClassDef): string[] {
  const lines: string[] = [];
  if (node.mods) {
    for (const stat of Object.keys(node.mods) as (keyof NonNullable<TalentNode['mods']>)[]) {
      lines.push(statLine(stat, node.mods[stat] ?? 0));
    }
  }
  if (node.ability) {
    const abilityId = classDef.abilities[node.ability.slot];
    const ability = abilityId ? t(`ability.${abilityId}.name` as TextKey) : '';
    for (const key of ['cooldown', 'damage', 'area', 'duration'] as (keyof AbilityBoost)[]) {
      const value = node.ability[key];
      if (value) lines.push(t(`talent.ab.${key}` as TextKey, { ability, value: percent(value) }));
    }
  }
  return lines;
}
