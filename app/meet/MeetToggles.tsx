"use client";

// Header-right toggles: theme phase (paper | sumi) + language (existing D12
// i18n). The theme pref persists through the audited device-local store
// (lib/meet-net — G-2: follow the existing method, no new persistence lane);
// THEME_INIT_SCRIPT in the layout resolves it before paint, this component
// only mirrors and updates <html data-theme>.

import { useLayoutEffect, useState } from "react";
import { useLang } from "@/lib/i18n/context.tsx";
import { MEET } from "@/lib/meet/copy.ts";
import { setThemePref, type ThemePhase } from "@/lib/meet-net";

export function MeetToggles() {
  const [lang, setLang] = useLang();
  // SSR renders no active phase (hydration-safe); the init script has already
  // set data-theme, adopted here before the first post-hydration paint.
  const [theme, setTheme] = useState<ThemePhase | null>(null);

  useLayoutEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "paper" || t === "sumi") setTheme(t);
  }, []);

  const pick = (t: ThemePhase) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      setThemePref(t);
    } catch {
      /* private mode — the phase just won't persist (session-only) */
    }
  };

  return (
    <div className="m-toggles">
      <div className="m-themetoggle" role="group" aria-label={MEET.theme.group}>
        <button
          type="button"
          className={`m-toggle-opt${theme === "paper" ? " is-active" : ""}`}
          aria-pressed={theme === "paper"}
          onClick={() => pick("paper")}
        >
          {MEET.theme.paper}
        </button>
        <span className="m-toggle-sep" aria-hidden="true" />
        <button
          type="button"
          className={`m-toggle-opt${theme === "sumi" ? " is-active" : ""}`}
          aria-pressed={theme === "sumi"}
          onClick={() => pick("sumi")}
        >
          {MEET.theme.sumi}
        </button>
      </div>
      <div className="m-langtoggle" role="group" aria-label={MEET.theme.langGroup}>
        <button
          type="button"
          className={`m-toggle-opt${lang === "ja" ? " is-active" : ""}`}
          aria-pressed={lang === "ja"}
          onClick={() => setLang("ja")}
        >
          {MEET.theme.ja}
        </button>
        <span className="m-toggle-sep" aria-hidden="true" />
        <button
          type="button"
          className={`m-toggle-opt${lang === "en" ? " is-active" : ""}`}
          aria-pressed={lang === "en"}
          onClick={() => setLang("en")}
        >
          {MEET.theme.en}
        </button>
      </div>
    </div>
  );
}
