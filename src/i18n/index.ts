import { de } from './de';
import type { Locale, TextKey } from './de';

export type { TextKey } from './de';

let current: Locale = de;

/** Wechselt die aktive Sprache (weitere Sprachen später als `Locale` ergänzen). */
export function setLocale(locale: Locale): void {
  current = locale;
}

/** Übersetzter Text; `{name}` im Text wird durch `vars.name` ersetzt. */
export function t(key: TextKey, vars?: Record<string, string | number>): string {
  const text = current[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
