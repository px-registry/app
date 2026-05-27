import type { Metadata } from "next";
import { categories } from "../categories";
import { Footer } from "../Footer";

export const metadata: Metadata = {
  title: "Start something — PX Registry",
  description: "Compose a pack: send files, or list owner-domain activity.",
};

// The compose entry chooser. Send-a-pack is the one creation flow built out;
// the eight categories are scaffolded (each opens a "coming soon" form), so the
// surface is complete without over-claiming what works yet.
export default function ComposeHome() {
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
