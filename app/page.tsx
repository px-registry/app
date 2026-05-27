import { categories } from "./categories";
import { Footer } from "./Footer";

export default function Home() {
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
              <span className="category-count">—</span>
            </a>
          </li>
        ))}
      </ul>

      <Footer />
    </main>
  );
}
