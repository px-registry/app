import type { Metadata } from "next";
import { Footer } from "../Footer";
import { BoardDetail } from "./BoardDetail";

// Public detail surface for a single board record. Query-param based
// (/board/?id=…) because records are D1-backed and cannot be pre-rendered under
// `output: export`. Every board row routes here (gate 9A-7).
export const metadata: Metadata = {
  title: "Record — PX Registry",
  description: "A public board record. PX records; the owner transacts.",
};

export default function BoardRecordPage() {
  return (
    <main className="page">
      <a className="back" href="/search/">
        ← Board
      </a>
      <BoardDetail />
      <Footer />
    </main>
  );
}
