// lib/i18n — a lightweight client-side dictionary i18n (no dependency, no locale
// routing — Next's built-in i18n is unsupported under output: "export"). Two
// natively-authored dictionaries (en, ja); useT() returns the active language's
// string, falling back to EN then the key. A single chosen language renders at a
// time (the toggle makes a dual-label redundant — §2 subtraction); the sealed
// /pack·/sale viewers keep their own existing dual-label rendering, untouched.

import { en } from "./en.ts";
import { ja } from "./ja.ts";

export const LANGS = ["en", "ja"] as const;
export type Lang = (typeof LANGS)[number];
export type Dict = Record<string, string>;

export const dicts: Record<Lang, Dict> = { en, ja };

/** Substitute {token} placeholders. A template uses only the tokens it needs, so
 *  EN can reference {plural}/{Plural} while JA references {noun} only. */
export function interpolate(
  tpl: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Resolve a key in the active language, falling back to EN, then the raw key. */
export function translate(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  return interpolate(dicts[lang][key] ?? dicts.en[key] ?? key, vars);
}
