"use client";

// ワークスペース化(β) 第2便 — rail（道具棚・canvas 脇役）。React Aria useToolbar で
// roving tabindex＋矢印移動を被せる（見た目を持たない hook・.m-* マークアップは家風のまま）。
//
// 道具5つ: アンテナ／提案／トーク＝canvas の面（activeSurface 切替）、あなたのAI＝floating
// 窓トグル、はじめかた＝既存ルート遷移。**interim ラベルは既存ゲート済文言を流用**
// （新規 user-facing 文言は作らない — 最終ラベルは STOP④ で Hiroto 命名ゲート）。
//
// 工房語彙便（墨=黒）: px-composer の UI 語彙を rail に載せる——道具ごとに ◇/◆ の標
// （hollow=休／filled=今ひらいている面）が状態を「言葉でなく形で」語る（命名問題の解の核）。
// 標は aria-hidden の装い；ボタンの可触名は既存ゲート済ラベルのまま（React Aria 不変）。
// あなたのAI には接続の点（つながっていれば --ok・静止＝点滅なし／圧を作らない）を添える。
// 色は既存トークン経由・新色なし——紙でも墨でも成立し、墨で最も工房らしく映える。

import { useRef } from "react";
import Link from "next/link";
import { useToolbar } from "@react-aria/toolbar";
import { MEET } from "@/lib/meet/copy.ts";
import { useMeetWorkspace, type SurfaceKey } from "./MeetWorkspaceContext.tsx";

const SURFACES: { key: SurfaceKey; label: string }[] = [
  { key: "antenna", label: MEET.home.place.heading },
  { key: "proposals", label: MEET.home.proposals.heading },
  { key: "talk", label: MEET.home.signals.heading },
];

export function MeetRail() {
  const { activeSurface, setActiveSurface, setWindowOpen, connected } = useMeetWorkspace();
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
        {/* 節目（composer の section 区切り）— 面の道具と、窓／導線の道具を位置で分ける。 */}
        <div className="m-rail-div" role="presentation" aria-hidden="true" />
        {/* あなたのAI 窓は floating（FAB 維持）— rail の道具は窓を開くトグル。 */}
        <button
          type="button"
          className="m-rail-item m-rail-aux"
          onClick={() => setWindowOpen(true)}
        >
          <span className="m-rail-mark" aria-hidden="true" />
          <span className="m-rail-label">{MEET.home.aiWindow.title}</span>
          {/* 接続の点 — つながっていれば灯る（worker-health の系譜・静止）。 */}
          <span className="m-rail-stat" data-on={connected} aria-hidden="true" />
        </button>
        {/* はじめかたは既存ルートへの導線（canvas 面でない）。 */}
        <Link className="m-rail-item m-rail-aux m-rail-link" href="/meet/start/">
          <span className="m-rail-mark" aria-hidden="true" />
          <span className="m-rail-label">{MEET.nav.start}</span>
        </Link>
      </div>
    </nav>
  );
}
