import Link from "next/link";
import { MEET } from "@/lib/meet/copy.ts";

// R1.5 home — Slice 1 shell: the loop's resting surface. The question field,
// receive action, proposals and signals become live in later slices; until each
// is wired it shows its honest empty state (never a dead control).
export default function MeetHome() {
  return (
    <>
      <section className="m-section">
        <h1 className="m-h1">{MEET.home.question.heading}</h1>
        <p className="m-lede">{MEET.lede}</p>
        <div className="m-card">
          <p style={{ margin: 0, color: "var(--text)" }}>{MEET.home.proposals.empty}</p>
          <p className="m-note">{MEET.home.question.note}</p>
        </div>
        <p className="m-note">
          <Link href="/meet/start/" style={{ color: "var(--shu-deep)" }}>
            {MEET.nav.start}
          </Link>
          から三つ済ませると、ここが動き出します。
        </p>
      </section>

      <section className="m-section">
        <h2 className="m-h2">{MEET.home.proposals.heading}</h2>
        <div className="m-empty">{MEET.home.proposals.empty}</div>
        <p className="m-note">{MEET.home.proposals.orderNote}</p>
      </section>

      <section className="m-section">
        <h2 className="m-h2">{MEET.home.signals.heading}</h2>
        <div className="m-empty">{MEET.home.signals.empty}</div>
      </section>

      <div className="m-boundary">
        <p>{MEET.boundary.memory}</p>
        <p>{MEET.boundary.ai}</p>
        <p>{MEET.boundary.order}</p>
      </div>
    </>
  );
}
