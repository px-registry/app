import { MEET } from "@/lib/meet/copy.ts";

// R1.5 はじめかた — Slice 1 shell: the three steps as a single quiet scroll.
// Each step gains its interactive widget in later slices (key entry, cold-start
// paste-back, publish toggles); the descriptions here are the durable copy.
export default function MeetStart() {
  const steps = [MEET.start.step1, MEET.start.step2, MEET.start.step3];
  return (
    <>
      <section className="m-section">
        <h1 className="m-h1">{MEET.start.title}</h1>
        <p className="m-lede">{MEET.start.lede}</p>
        {steps.map((s) => (
          <div className="m-card" key={s.heading}>
            <h2 className="m-h2 m-stepnum">{s.heading}</h2>
            <p style={{ margin: 0, color: "var(--text)" }}>{s.body}</p>
          </div>
        ))}
      </section>

      <div className="m-boundary">
        <p>{MEET.boundary.memory}</p>
        <p>{MEET.boundary.ai}</p>
      </div>
    </>
  );
}
