import { categories } from "./categories";
import { Footer } from "./Footer";
import { getCategoryCounts } from "@/data/packs";

export default async function Home() {
  const counts = await getCategoryCounts();

  return (
    <main className="page">
      <header className="head">
        <h1 className="title">Public register of owner-domain activity</h1>
        <p className="lede" lang="ja">
          PXは中身を保持しません
        </p>
      </header>

      <ul className="categories">
        {categories.map((c) => (
          <li key={c.slug}>
            <a className="category" href={`/${c.slug}/`}>
              <span className="category-name">
                <span className="category-en">{c.name}</span>
                <span className="category-ja" lang="ja">
                  {c.ja}
                </span>
              </span>
              <span className="category-count">{counts[c.slug] ?? 0}</span>
            </a>
          </li>
        ))}
      </ul>

      {/* Composer entry. The prompt field is a placeholder for the AI-assisted
          flow (a later phase) — pressing it, or any chip, opens /compose/. The
          field carries no name, so nothing it holds is submitted anywhere. */}
      <section className="composer" aria-label="Start something">
        <p className="composer-q" lang="ja">
          何かはじめますか?
          <span className="composer-q-en">Start something</span>
        </p>
        <form className="composer-bar" action="/compose/">
          <input
            className="composer-input"
            type="text"
            placeholder="Describe what you want to share…"
            aria-label="Describe what you want to share"
          />
          <button className="composer-go" type="submit">
            Try it →
          </button>
        </form>
        <ul className="composer-chips">
          <li>
            <a className="composer-chip composer-chip-pack" href="/compose/pack/">
              Send a pack
            </a>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <a className="composer-chip" href={`/compose/${c.slug}/`}>
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <Footer />
    </main>
  );
}
