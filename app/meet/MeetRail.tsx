"use client";

// ワークスペース化(β) 第2便 — rail（道具棚・canvas 脇役）。React Aria useToolbar で
// roving tabindex＋矢印移動を被せる（見た目を持たない hook・.m-* マークアップは家風のまま）。
//
// 墨工房 文言実験 第2手（Hiroto 裁定 2026-06-16）: rail＝「場」の道具4つ
// （Antenna／Finds／Talk＝canvas の面切替、Setup＝ルート遷移）。**「あなたのAI」は
// rail から外した** — それは場でなく場を動かす司令塔（操縦席）で層が違う（§0.5: 会話窓は
// 道具の集まりでなく一つの窓）。あなたのAI は右下 FAB 一つ（MemoryWindow が描く・
// どこからでも開く）。rail に並列で置くと Antenna と混同し、モバイルで FAB と被った。
//
// 工房語彙: 道具ごとに ◇/◆ の標（hollow=休／filled=今ひらいている面）が状態を形で語る
// （命名問題の解の核）。標は aria-hidden の装い；可触名は短語ラベル（React Aria 不変）。
// rail は短語（MEET.rail）— canvas 見出しと同じ短語で一貫（第2手 GOAL①）。色は既存
// トークン経由・新色なし——紙でも墨でも成立し、墨で最も工房らしく映える。

import { useRef } from "react";
import Link from "next/link";
import { useToolbar } from "@react-aria/toolbar";
import { MEET } from "@/lib/meet/copy.ts";
import { useMeetWorkspace, type SurfaceKey } from "./MeetWorkspaceContext.tsx";

// glyph(◆/◇)＋配置＋短語の三層で語るので、ラベル単体の完璧な明快さは要らない。
const SURFACES: { key: SurfaceKey; label: string }[] = [
  { key: "antenna", label: MEET.rail.antenna },
  { key: "proposals", label: MEET.rail.finds },
  { key: "talk", label: MEET.rail.talk },
];

export function MeetRail() {
  const { activeSurface, setActiveSurface } = useMeetWorkspace();
  const ref = useRef<HTMLDivElement | null>(null);
  const { toolbarProps } = useToolbar({ "aria-label": MEET.title, orientation: "vertical" }, ref);

  return (
    <nav className="m-rail" aria-label={MEET.title}>
      <div className="m-rail-inner" ref={ref} {...toolbarProps}>
        {SURFACES.map((s) => (
          <button
            key={s.key}
            type="button"
            className="m-rail-item"
            aria-pressed={activeSurface === s.key}
            aria-controls="m-ws-canvas"
            data-active={activeSurface === s.key}
            onClick={() => setActiveSurface(s.key)}
          >
            <span className="m-rail-mark" aria-hidden="true" />
            <span className="m-rail-label">{s.label}</span>
          </button>
        ))}
        {/* 節目（composer の section 区切り）— 面の道具と、Setup（導線）を位置で分ける。 */}
        <div className="m-rail-div" role="presentation" aria-hidden="true" />
        {/* Setup（旧 はじめかた）は既存ルートへの導線（canvas 面でない）。 */}
        <Link className="m-rail-item m-rail-aux m-rail-link" href="/meet/start/">
          <span className="m-rail-mark" aria-hidden="true" />
          <span className="m-rail-label">{MEET.rail.setup}</span>
        </Link>
      </div>
    </nav>
  );
}
