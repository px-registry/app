const categories = [
  "Auction",
  "Crowdfund",
  "Sale",
  "Video",
  "Music",
  "Writing",
  "Service & Membership",
  "Matching",
];

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
        {categories.map((name) => (
          <li className="category" key={name}>
            <span className="category-name">{name}</span>
            <span className="category-count">—</span>
          </li>
        ))}
      </ul>

      <footer className="foot">
        PX takes no fee on listed activity. Verifiable via standard tools.
      </footer>
    </main>
  );
}
