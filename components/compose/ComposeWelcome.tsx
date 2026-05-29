"use client";

// ComposeWelcome — the center workspace before any tool is chosen: a plain PX
// intro (the brief's "natural PX intro", not a "Welcome" splash). No sign-in to
// read it, no sign-in to explore — that's asked for only at the final,
// attributable step. §2 subtraction: the smallest true thing, no marketing.
// Copy comes from the i18n dictionary so the toggle localizes it.

import { useT } from "@/lib/i18n/context.tsx";

export function ComposeWelcome({ onPick }: { onPick: (mode: string) => void }) {
  const t = useT();
  return (
    <section className="welcome">
      <h1 className="welcome-h">{t("intro.heading")}</h1>
      <p className="welcome-lede">{t("intro.lead")}</p>
      <p className="welcome-body">{t("intro.body")}</p>

      <div className="welcome-picks">
        <button type="button" className="welcome-pick" onClick={() => onPick("pack")}>
          <span className="welcome-pick-h">{t("intro.pick.pack.title")}</span>
          <span className="welcome-pick-sub">{t("intro.pick.pack.sub")}</span>
        </button>
        <button type="button" className="welcome-pick" onClick={() => onPick("sale")}>
          <span className="welcome-pick-h">{t("intro.pick.sale.title")}</span>
          <span className="welcome-pick-sub">{t("intro.pick.sale.sub")}</span>
        </button>
      </div>

      <p className="welcome-foot">{t("intro.foot")}</p>
    </section>
  );
}
