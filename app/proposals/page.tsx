import type { Metadata } from "next";
import { Footer } from "../Footer";
import { Proposals } from "./Proposals";

// Stage B+1 — owner-side proposals. The owner-agent reads owner-local memory and
// composes suggestions on this device. PX stays memory-blind and ranks nothing;
// each suggestion names the memory entry that grounds it.
export const metadata: Metadata = {
  title: "Your AI's suggestions — PX Registry",
  description: "Owner-side proposals, grounded in your on-device memory. PX ranks nothing.",
};

export default function ProposalsPage() {
  return (
    <main className="page">
      <a className="back" href="/memory/">
        ← Your memory
      </a>

      <header className="head cat-head">
        <h1 className="title cat-title">
          <span className="cat-en">Your AI&rsquo;s suggestions</span>
          <span className="cat-ja" lang="ja">
            あなたのAIの提案
          </span>
        </h1>
        <p className="cat-sub">Composed on your device · grounded in your memory · PX ranks nothing</p>
      </header>

      <Proposals />

      <Footer />
    </main>
  );
}
