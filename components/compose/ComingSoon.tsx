"use client";

// Coming-soon placeholder for the category composers that don't exist yet. One
// data-driven component for all seven. Honest articulation — Send-a-pack works
// today; these arrive later — with no form and no over-claim (§2). The category
// name renders in the active language; the surrounding copy is dictionary-sourced.

import { useT, useLang } from "@/lib/i18n/context.tsx";

export function ComingSoon({
  labelEn,
  labelJa,
}: {
  labelEn: string;
  labelJa: string;
}) {
  const t = useT();
  const [lang] = useLang();
  const name = lang === "ja" ? labelJa : labelEn;

  return (
    <section className="coming-soon">
      <p className="coming-soon-eyebrow" lang={lang === "ja" ? "ja" : undefined}>
        {name}
      </p>
      <h2 className="coming-soon-h">{t("soon.heading", { name })}</h2>
      <p className="coming-soon-tag">{t("soon.tag")}</p>
      <p className="coming-soon-body">{t("soon.body", { name })}</p>
      <p className="coming-soon-alt">
        {t("soon.alt")} <a href="/compose/?mode=pack">{t("soon.altLink")}</a>
      </p>
    </section>
  );
}
