import { MEET } from "@/lib/meet/copy.ts";
import { ColdStartIntake } from "./ColdStartIntake.tsx";
import { KeyConnect } from "./KeyConnect.tsx";
import { PortConnect } from "./PortConnect.tsx";
import { BoundaryNote } from "../BoundaryNote.tsx";
import { MeetWorkspace } from "../MeetWorkspace.tsx";
import { NameField } from "../NameField.tsx";

// Setup（表層語彙統一便 第3手・Hiroto 確定 2026-06-17）: 「三ステップ直列の準備」でなく
// 「Antenna と Run の違いが分かる画面」。
//   lead（置いて待つか／探しに行くか）→ 二つのモード（Antenna=AIなしでも／Run=AIつなぐと）
//   → Step 1 AI接続（鍵でつなぐ＋あなたのAIからつなぐ=MCP を方法として畳む）
//   → Step 2 Memoryを作る → 呼び名カード（#name）→ Trust。
// AI接続を「届くための必須条件」に見せない・Antenna を「AI必須」に見せない（lead/modes が担う）。
// 深リンク #step-key / #step-intake は可視カードに直接当たる（旧 PageDoor の自動開きは不要）。
export default function MeetStart() {
  return (
    <MeetWorkspace page="start">
      <section className="m-section">
        <h1 className="m-h1">{MEET.start.title}</h1>
        <p className="m-lede">{MEET.start.lead}</p>

        {/* 二つのモード — 何ができるかを先に示す（向きカードでなく概念カード）。 */}
        <div className="m-doors">
          <div className="m-card">
            <h2 className="m-h2">{MEET.start.modes.antenna.heading}</h2>
            <p style={{ margin: "0.3rem 0 0", color: "var(--text)" }}>
              {MEET.start.modes.antenna.body}
            </p>
          </div>
          <div className="m-card">
            <h2 className="m-h2">{MEET.start.modes.run.heading}</h2>
            <p style={{ margin: "0.3rem 0 0", color: "var(--text)" }}>
              {MEET.start.modes.run.body}
            </p>
          </div>
        </div>

        {/* 準備の手順 — AI接続（任意・Run の前提）→ Memory を作る。 */}
        <div className="m-doorsteps" style={{ marginTop: "1.25rem" }}>
          <div className="m-card" id="step-key">
            <h2 className="m-h2 m-stepnum">{MEET.start.step1.heading}</h2>
            <p style={{ margin: "0 0 0.4rem", color: "var(--text)" }}>{MEET.start.step1.body}</p>
            <p style={{ margin: "0 0 0.9rem", color: "var(--text)" }}>{MEET.start.step1.run}</p>
            <KeyConnect />
            {/* AI接続の二つ目の方法 — あなたのAIからつなぐ（MCP）。向きカードでなく方法として畳む。 */}
            <details style={{ marginTop: "0.9rem" }}>
              <summary className="m-note" style={{ cursor: "pointer" }}>
                {MEET.start.mcp.summary}
              </summary>
              <div style={{ marginTop: "0.6rem" }}>
                <PortConnect />
              </div>
            </details>
          </div>

          <div className="m-card" id="step-intake">
            <h2 className="m-h2 m-stepnum">{MEET.start.step2.heading}</h2>
            <p style={{ margin: "0 0 0.4rem", color: "var(--text)" }}>{MEET.start.step2.body}</p>
            <p style={{ margin: "0 0 0.9rem", color: "var(--text)" }}>{MEET.start.step2.why}</p>
            <ColdStartIntake />
          </div>
        </div>
      </section>

      {/* 呼び名は初期設定として Setup の一部（#name・警告文の着地点）。実体は Memory 側 store と
          共用（NameField・データ二重化なし）。 */}
      <section className="m-section" id="name">
        <NameField />
      </section>

      <BoundaryNote lines={[MEET.boundary.memory, MEET.boundary.holds, MEET.boundary.ai]} />
    </MeetWorkspace>
  );
}
