"use client";

// i18n React context: an I18nProvider (mounted once in the root layout), a
// useT() translator, and useLang() for the toggle. The active language renders
// a single language at a time.
//
// No-flash strategy (as close as a single-locale static export allows):
//   • LANG_INIT_SCRIPT runs in <head> before paint — it resolves the preference
//     (localStorage → navigator.language) and writes <html lang> + data-px-lang
//     immediately, so the document language is correct with zero flash.
//   • SSR and the first client render both use "en" (matching the prerendered
//     HTML — no hydration mismatch); a useLayoutEffect then adopts the resolved
//     language before the post-hydration paint, so translated text swaps without
//     a mismatch warning. (Truly zero text-flash would need per-locale
//     prerendered routes — a later step.)

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { LANGS, translate, type Lang } from "./index.ts";

const STORAGE_KEY = "px:lang";

// Inline, dependency-free; injected verbatim into <head> via the layout.
export const LANG_INIT_SCRIPT = `(function(){try{var l=localStorage.getItem('${STORAGE_KEY}');if(l!=='en'&&l!=='ja'){l=(navigator.language||'').toLowerCase().indexOf('ja')===0?'ja':'en';}var e=document.documentElement;e.lang=l;e.setAttribute('data-px-lang',l);}catch(_){}})();`;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Adopt the language the init script resolved, before the first paint after
  // hydration (server + first client render are "en", so hydration matches).
  useLayoutEffect(() => {
    const resolved = document.documentElement.getAttribute("data-px-lang");
    if (resolved === "ja" || resolved === "en") {
      if (resolved !== lang) setLangState(resolved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((l: Lang) => {
    if (!LANGS.includes(l)) return;
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* private mode — pref just won't persist */
    }
    document.documentElement.lang = l;
    document.documentElement.setAttribute("data-px-lang", l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

function useI18n(): Ctx {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useT/useLang must be used within <I18nProvider>");
  return ctx;
}

/** The translator. `t("pack.field.title")`, `t("pack.hashing", { n: 3 })`. */
export function useT() {
  return useI18n().t;
}

/** The active language and a setter, for the toggle. */
export function useLang(): [Lang, (l: Lang) => void] {
  const { lang, setLang } = useI18n();
  return [lang, setLang];
}
