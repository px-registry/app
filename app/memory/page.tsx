import type { Metadata } from "next";
import { Footer } from "../Footer";
import { MemoryManager } from "./MemoryManager";

// Stage B — the owner-local memory surface. The personal algorithm is
// owner-held: this whole page operates on the owner's own device (IndexedDB).
// PX is memory-blind; the board stays one neutral surface for everyone.
export const metadata: Metadata = {
  title: "Your memory — PX Registry",
  description: "Owner-held memory. It lives on your device; PX stores none of it.",
};

export default function MemoryPage() {
  return (
    <main className="page">
      <a className="back" href="/search/">
        ← Board
      </a>

      <header className="head cat-head">
        <h1 className="title cat-title">
          <span className="cat-en">Your memory</span>
          <span className="cat-ja" lang="ja">
            あなたの記憶
          </span>
        </h1>
        <p className="cat-sub">Owner-held · on your device · PX stores none of it</p>
      </header>

      <MemoryManager />

      <Footer />
    </main>
  );
}
