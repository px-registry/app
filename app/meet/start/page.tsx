import Link from "next/link";
import { MEET } from "@/lib/meet/copy.ts";
import { ColdStartIntake } from "./ColdStartIntake.tsx";
import { KeyConnect } from "./KeyConnect.tsx";
import { BoundaryNote } from "../BoundaryNote.tsx";

// R1.5 はじめかた — the three steps as a single quiet scroll. Step 2 (cold-start
// paste-back) is live; step 1 gains the key widget in Slice 3; step 3 links to
// the memory page where 公開/非公開 lives.
export default function MeetStart() {
  return (
    <>
      <section className="m-section">
        <h1 className="m-h1">{MEET.start.title}</h1>
        <p className="m-lede">{MEET.start.lede}</p>

        {/* 第5便: plain wrapper — invisible on mobile; the three steps sit
            side by side at desktop width. Layout only. */}
        <div className="m-steps">
          <div className="m-card">
            <h2 className="m-h2 m-stepnum">{MEET.start.step1.heading}</h2>
            <p style={{ margin: "0 0 0.9rem", color: "var(--text)" }}>{MEET.start.step1.body}</p>
            <KeyConnect />
          </div>

          <div className="m-card">
            <h2 className="m-h2 m-stepnum">{MEET.start.step2.heading}</h2>
            <p style={{ margin: "0 0 0.9rem", color: "var(--text)" }}>{MEET.start.step2.body}</p>
            <ColdStartIntake />
          </div>

          <div className="m-card">
            <h2 className="m-h2 m-stepnum">{MEET.start.step3.heading}</h2>
            <p style={{ margin: 0, color: "var(--text)" }}>{MEET.start.step3.body}</p>
            <p className="m-note" style={{ marginTop: "0.6rem" }}>
              <Link href="/meet/memory/" style={{ color: "var(--shu-deep)" }}>
                {MEET.nav.memory}
              </Link>
              で項目ごとに選び、「{MEET.publish.action}」で出します。
            </p>
          </div>
        </div>
      </section>

      <BoundaryNote lines={[MEET.boundary.memory, MEET.boundary.ai]} />
    </>
  );
}
