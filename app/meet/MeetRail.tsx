"use client";

// ワークスペース化(β) 第2便 — rail（道具棚・canvas 脇役）。React Aria useToolbar で
// roving tabindex＋矢印移動を被せる（見た目を持たない hook・.m-* マークアップは家風のまま）。
//
// 道具5つ: アンテナ／提案／トーク＝canvas の面（activeSurface 切替）、あなたのAI＝floating
// 窓トグル、はじめかた＝既存ルート遷移。**interim ラベルは既存ゲート済文言を流用**
// （新規 user-facing 文言は作らない — 最終ラベルは STOP④ で Hiroto 命名ゲート）。

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
  const { activeSurface, setActiveSurface, setWindowOpen } = useMeetWorkspace();
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
            {s.label}
          </button>
        ))}
        {/* あなたのAI 窓は floating（FAB 維持）— rail の道具は窓を開くトグル。 */}
        <button type="button" className="m-rail-item" onClick={() => setWindowOpen(true)}>
          {MEET.home.aiWindow.title}
        </button>
        {/* はじめかたは既存ルートへの導線（canvas 面でない）。 */}
        <Link className="m-rail-item m-rail-link" href="/meet/start/">
          {MEET.nav.start}
        </Link>
      </div>
    </nav>
  );
}
