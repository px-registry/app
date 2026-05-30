import type { Metadata } from "next";
import { Footer } from "../../Footer";
import { BoardStand } from "./BoardStand";

// Board Templates v1 — stand a board (owner-local scaffold). Drafts live on the
// owner's device; PX holds no draft and no board state. A template is a starting
// point, not a prescription; publishing rides a structural gate (a title, at least
// one row, a way to be contacted), never a PX judgment of content.
export const metadata: Metadata = {
  title: "Stand a board — PX Registry",
  description: "Start a board from an example or a blank — owner-local. PX ranks no board and judges no content.",
};

export default function BoardStandPage() {
  return (
    <main className="page">
      <a className="back" href="/search/">
        ← Board
      </a>

      <header className="head cat-head">
        <h1 className="title cat-title">
          <span className="cat-en">Stand a board</span>
          <span className="cat-ja" lang="ja">
            板を立てる
          </span>
        </h1>
        <p className="cat-sub">On your device · a template is a starting point · PX ranks no board, judges no content</p>
      </header>

      <BoardStand />

      <Footer />
    </main>
  );
}
