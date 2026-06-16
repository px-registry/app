"use client";

// ワークスペース化(β) 第2便 — rail（道具棚・canvas 脇役）。React Aria useToolbar で
// roving tabindex＋矢印移動を被せる（見た目を持たない hook・.m-* マークアップは家風のまま）。
//
// 墨工房 文言実験 第2手（Hiroto 裁定 2026-06-16）: rail＝「場」の道具
// （Antenna／Finds／Talk＝canvas の面切替、Setup＝ルート遷移）。**「あなたのAI」は
// rail から外した** — それは場でなく場を動かす司令塔（操縦席）で層が違う（§0.5: 会話窓は
// 道具の集まりでなく一つの窓）。あなたのAI は右下 FAB 一つ（MemoryWindow が描く・
// どこからでも開く）。rail に並列で置くと Antenna と混同し、モバイルで FAB と被った。
//
// サブページ統一便（Hiroto 裁定 2026-06-16・道B）: rail は home だけでなく記憶・Setup
// でも立つ（世界観完全一貫）。rail は文脈で姿を変える共通器:
//   ・home（provider 圏内）: 面の道具（Antenna/Finds/Talk）は canvas の面切替ボタン。
//   ・サブページ（provider 圏外）: 面の道具は home の該当面へ戻る導線リンク（/meet/?s=…）。
// Memory・Setup は常に「ルート遷移の導線」なので仕切り線の下に2つ並ぶ（3面＋2導線）。
// active は pathname で決まる（記憶ページ→Memory が朱・Setup ページ→Setup が朱）。
//
// 工房語彙: 道具ごとに ◇/◆ の標（hollow=休／filled=今ひらいている面）が状態を形で語る
// （命名問題の解の核）。標は aria-hidden の装い；可触名は短語ラベル（React Aria 不変）。
// rail は短語（MEET.rail）— canvas 見出しと同じ短語で一貫（第2手 GOAL①）。色は既存
// トークン経由・新色なし——紙でも墨でも成立し、墨で最も工房らしく映える。

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useToolbar } from "@react-aria/toolbar";
import { MEET } from "@/lib/meet/copy.ts";
import { useMeetWorkspaceOptional, type SurfaceKey } from "./MeetWorkspaceContext.tsx";

// glyph(◆/◇)＋配置＋短語の三層で語るので、ラベル単体の完璧な明快さは要らない。
// tip = 一行の本質（世界観の指針・ツールチップ）。
const SURFACES: { key: SurfaceKey; label: string; tip: string }[] = [
  { key: "antenna", label: MEET.rail.antenna, tip: MEET.rail.tip.antenna },
  { key: "proposals", label: MEET.rail.finds, tip: MEET.rail.tip.finds },
  { key: "talk", label: MEET.rail.talk, tip: MEET.rail.tip.talk },
];

export function MeetRail() {
  const ws = useMeetWorkspaceOptional();
  const pathname = usePathname();
  const norm = pathname.replace(/\/$/, ""); // 末尾スラッシュ差を吸収（static export）
  const onHome = norm === "/meet";
  const onMemory = norm === "/meet/memory";
  const onStart = norm === "/meet/start";
  // 面切替が効くのは home の canvas だけ（provider 圏内）。サブページでは導線リンク。
  const liveSwitch = ws !== null && onHome;

  const ref = useRef<HTMLDivElement | null>(null);
  const { toolbarProps } = useToolbar({ "aria-label": MEET.title, orientation: "vertical" }, ref);

  return (
    <nav className="m-rail" aria-label={MEET.title}>
      <div className="m-rail-inner" ref={ref} {...toolbarProps}>
        {SURFACES.map((s) =>
          liveSwitch ? (
            <button
              key={s.key}
              type="button"
              className="m-rail-item"
              title={s.tip}
              aria-pressed={ws!.activeSurface === s.key}
              aria-controls="m-ws-canvas"
              data-active={ws!.activeSurface === s.key}
              onClick={() => ws!.setActiveSurface(s.key)}
            >
              <span className="m-rail-mark" aria-hidden="true" />
              <span className="m-rail-label">{s.label}</span>
            </button>
          ) : (
            // サブページから面の道具を押す＝home に戻り該当面を開く（HomeView が ?s= を読む）。
            <Link key={s.key} className="m-rail-item m-rail-link" href={`/meet/?s=${s.key}`} title={s.tip}>
              <span className="m-rail-mark" aria-hidden="true" />
              <span className="m-rail-label">{s.label}</span>
            </Link>
          ),
        )}
        {/* 節目（composer の section 区切り）— 面の道具と、ルート遷移の導線を位置で分ける。 */}
        <div className="m-rail-div" role="presentation" aria-hidden="true" />
        {/* Memory（旧 記憶）と Setup（旧 はじめかた）は既存ルートへの導線（canvas 面でない）。 */}
        <Link
          className="m-rail-item m-rail-aux m-rail-link"
          href="/meet/memory/"
          title={MEET.rail.tip.memory}
          data-active={onMemory}
        >
          <span className="m-rail-mark" aria-hidden="true" />
          <span className="m-rail-label">{MEET.rail.memory}</span>
        </Link>
        <Link
          className="m-rail-item m-rail-aux m-rail-link"
          href="/meet/start/"
          title={MEET.rail.tip.setup}
          data-active={onStart}
        >
          <span className="m-rail-mark" aria-hidden="true" />
          <span className="m-rail-label">{MEET.rail.setup}</span>
        </Link>
      </div>
    </nav>
  );
}
