import type { Metadata } from "next";
import { Footer } from "../Footer";
import { BoardSearch } from "./BoardSearch";

// The Attested Board surface. A single /search/ route across all four
// surface_shapes (offered / auction-like / matching / stand) — N4: its own
// route, not a /category extension.
export const metadata: Metadata = {
  title: "Board — PX Registry",
  description: "Search owner activity across the board. PX records; owners transact.",
};

export default function SearchPage() {
  return (
    <main className="page">
      <a className="back" href="/">
        ← back
      </a>

      <header className="head cat-head">
        <h1 className="title cat-title">
          <span className="cat-en">Board</span>
          <span className="cat-ja" lang="ja">
            ボード
          </span>
        </h1>
        <p className="cat-sub">Search across surfaces · owners transact, PX records</p>
      </header>

      <BoardSearch />

      <Footer />
    </main>
  );
}
