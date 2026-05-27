// The signed-out compose entry (Mode 1) — the public chooser: Send-a-pack is the
// one built-out flow; the eight categories are scaffolded "coming soon" forms.
// Extracted unchanged from the former app/compose/page.tsx so the signed-out
// surface is identical; ComposeAdaptive renders it as the default.

import { categories } from "@/app/categories";
import { Footer } from "@/app/Footer";

export function ComposeChooser() {
  return (
    <main className="page">
      <a className="back" href="/">
        ← back
      </a>

      <header className="head cat-head">
        <h1 className="title cat-title">
          <span className="cat-en">Start something</span>
          <span className="cat-ja" lang="ja">
            はじめる
          </span>
        </h1>
        <p className="cat-sub">Compose · nothing is held by PX</p>
      </header>

      <a className="compose-feature" href="/compose/pack/">
        <span className="compose-feature-main">
          <span className="compose-feature-title">Send a pack</span>
          <span className="compose-feature-sub">
            Deliver files with a note for each one. They stay in your browser —
            PX never receives them.
          </span>
        </span>
        <span className="compose-feature-go" aria-hidden="true">
          →
        </span>
      </a>

      <p className="compose-or">or list activity</p>

      <ul className="compose-chips">
        {categories.map((c) => (
          <li key={c.slug}>
            <a className="compose-chip" href={`/compose/${c.slug}/`}>
              <span className="compose-chip-en">{c.name}</span>
              <span className="compose-chip-ja" lang="ja">
                {c.ja}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <Footer />
    </main>
  );
}
