"use client";

// EN / 日本語 toggle — lives in the tools-panel header (dashboard-scoped for this
// atomic). The preference persists in localStorage, so other pages honor it even
// before they grow their own toggle.

import { useLang } from "@/lib/i18n/context.tsx";

export function LangToggle() {
  const [lang, setLang] = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label="Language / 言語">
      <button
        type="button"
        className={`lang-opt${lang === "en" ? " is-active" : ""}`}
        aria-pressed={lang === "en"}
        onClick={() => setLang("en")}
      >
        EN
      </button>
      <span className="lang-sep" aria-hidden>
        ·
      </span>
      <button
        type="button"
        className={`lang-opt${lang === "ja" ? " is-active" : ""}`}
        aria-pressed={lang === "ja"}
        onClick={() => setLang("ja")}
      >
        日本語
      </button>
    </div>
  );
}
