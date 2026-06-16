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

        {/* 二つのモード — 概念カード（静か・recessed）。何ができるかを先に示す。 */}
        <div className="m-doors">
          <div className="m-card m-card--concept">
            <h2 className="m-h2">{MEET.start.modes.antenna.heading}</h2>
            <p style={{ margin: "var(--space-1) 0 0", color: "var(--text)" }}>
              {MEET.start.modes.antenna.body}
            </p>
          </div>
          <div className="m-card m-card--concept">
            <h2 className="m-h2">{MEET.start.modes.run.heading}</h2>
            <p style={{ margin: "var(--space-1) 0 0", color: "var(--text)" }}>
              {MEET.start.modes.run.body}
            </p>
          </div>
        </div>

        {/* 準備の手順 — AI接続（任意・Run の前提）→ Memory を作る → 呼び名。
            layout 体系便: 呼び名は孤立 section をやめ、この手順グループに並べる（フィールド
            カード・#name はここに着地）。縦リズムは grid gap（--card-gap）が持つ。 */}
        <div className="m-doorsteps" style={{ marginTop: "var(--card-gap)" }}>
          <div className="m-card" id="step-key">
            <h2 className="m-h2 m-stepnum">{MEET.start.step1.heading}</h2>
            <p style={{ margin: "0 0 var(--space-1)", color: "var(--text)" }}>{MEET.start.step1.body}</p>
            <p style={{ margin: "0 0 var(--stack)", color: "var(--text)" }}>{MEET.start.step1.run}</p>
            <KeyConnect />
            {/* AI接続の二つ目の方法 — あなたのAIからつなぐ（MCP）。向きカードでなく方法として畳む。 */}
            <details style={{ marginTop: "var(--stack)" }}>
              <summary className="m-note" style={{ cursor: "pointer" }}>
                {MEET.start.mcp.summary}
              </summary>
              <div style={{ marginTop: "var(--space-1)" }}>
                <PortConnect />
              </div>
            </details>
          </div>

          <div className="m-card" id="step-intake">
            <h2 className="m-h2 m-stepnum">{MEET.start.step2.heading}</h2>
            <p style={{ margin: "0 0 var(--space-1)", color: "var(--text)" }}>{MEET.start.step2.body}</p>
            <p style={{ margin: "0 0 var(--stack)", color: "var(--text)" }}>{MEET.start.step2.why}</p>
            <ColdStartIntake />
          </div>

          {/* 呼び名（フィールドカード・#name）— 実体は Memory 側 store と共用（NameField）。 */}
          <NameField />
        </div>
      </section>

      <BoundaryNote lines={[MEET.boundary.memory, MEET.boundary.holds, MEET.boundary.ai]} />
    </MeetWorkspace>
  );
}
