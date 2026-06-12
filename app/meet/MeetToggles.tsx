"use client";

// Header-right toggle: theme phase (paper | sumi). The pref persists through
// the audited device-local store (lib/meet-net — G-2: follow the existing
// method, no new persistence lane); THEME_INIT_SCRIPT in the layout resolves
// it before paint (保存値 → paper, c12-1 裁定), this component only mirrors
// and updates <html data-theme>.
//
// c12-2 (Hiroto 裁定): the 日本語/EN language toggle is HIDDEN for this test —
// the surface is JA-fixed (the layout pins html lang="ja"). The i18n機構 and
// the EN draft dictionary stay in code untouched; the toggle returns in R2.

import { useLayoutEffect, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import { setThemePref, type ThemePhase } from "@/lib/meet-net";

export function MeetToggles() {
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
    </div>
  );
}
