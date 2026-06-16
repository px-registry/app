import Link from "next/link";
import { MEET } from "@/lib/meet/copy.ts";
import { ColdStartIntake } from "./ColdStartIntake.tsx";
import { KeyConnect } from "./KeyConnect.tsx";
import { PortConnect } from "./PortConnect.tsx";
import { PageDoor } from "./PageDoor.tsx";
import { BoundaryNote } from "../BoundaryNote.tsx";

// R1.5 はじめかた — the three steps as a single quiet scroll. Step 2 (cold-start
// paste-back) is live; step 1 gains the key widget in Slice 3; step 3 links to
// the memory page where 公開/非公開 lives.
// R2 GOAL — 二扉化: 「このページで使う」と「あなたのAIから使う」を同格の入り口に。
// どちらの扉も同じ部屋（同じ owner token・同じ公開面）に入る。
export default function MeetStart() {
  return (
    <>
      <section className="m-section">
        <h1 className="m-h1">{MEET.start.title}</h1>
        <p className="m-lede">{MEET.start.doors.lede}</p>

        {/* 二態の対句（ゲート済）— 看板調は見出し・二扉ページ級のみ（register 規則）。
            第3手 ②（案A）: 二重框を構造で解く — 二扉は同格の入口のまま（R2 GOAL 保持）、
            「このページで使う」扉を details にして3手順を入れ子に畳む（散らかりの根＝
            扉の上に手順を平置きしていた重複を、入れ子で正す）。新規文言なし。 */}
        <div className="m-doors">
          <PageDoor>
            <p style={{ margin: "0.2rem 0 1rem", color: "var(--text)" }}>
              {MEET.start.doors.page.body}
            </p>
              {/* 3手順 — 扉の中（鍵 → 下地 → 選ぶ）。anchor は PageDoor が開いて寄せる。 */}
              <div className="m-doorsteps">
                <div className="m-card" id="step-key">
                  <h2 className="m-h2 m-stepnum">{MEET.start.step1.heading}</h2>
                  <p style={{ margin: "0 0 0.9rem", color: "var(--text)" }}>{MEET.start.step1.body}</p>
                  <KeyConnect />
                </div>

                <div className="m-card" id="step-intake">
                  <h2 className="m-h2 m-stepnum">{MEET.start.step2.heading}</h2>
                  <p style={{ margin: "0 0 0.4rem", color: "var(--text)" }}>{MEET.start.step2.body}</p>
                  {/* c14: 下地は他人に読める形で生まれる（取り込み時翻訳）の予告 */}
                  <p style={{ margin: "0 0 0.9rem", color: "var(--text)" }}>{MEET.start.step2.legible}</p>
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
            </PageDoor>
          <div className="m-card">
            <h2 className="m-h2">{MEET.start.doors.ai.heading}</h2>
            <p className="m-lede" style={{ margin: "0 0 0.6rem" }}>{MEET.start.doors.ai.sign}</p>
            <p style={{ margin: "0 0 0.9rem", color: "var(--text)" }}>
              {MEET.start.doors.ai.body}
            </p>
            <PortConnect />
          </div>
        </div>
      </section>

      <BoundaryNote lines={[MEET.boundary.memory, MEET.boundary.ai]} />
    </>
  );
}
