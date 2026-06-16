"use client";

// ワークスペース化(β) 第2便 — 器のシェル（rail 細＋canvas 主役）。紙の上の工房。
// canvas には activeSurface 一面が大きく開く（C裁定一面）。CC窓（あなたのAI）は
// floating のまま（FAB 維持）。
//
// 紙トークンは触らない（既存 --ground/--shu/--mincho 参照のみ）。レイアウトは既存 grid/
// flex の役割転換＋MeetNav の固定バー CSS パターンの流用（下ドック）— ライブラリ不要。
//
// 器が立っている間だけ layout のルート nav（旧 MeetNav）を退ける（html[data-ws] で
// CSS が隠す）— rail がその役を兼ねる。
//
// サブページ統一便（Hiroto 裁定 2026-06-16・道B）: この器は home だけでなく記憶・Setup
// でも立つ（世界観完全一貫・旧 MeetNav は消費者世界から全退場）。page= でどのサブページ
// かを受け、canvas の見出し（aria-label）と幅を決める。あなたのAI FAB（MemoryWindow）は
// ここが描く — どのページからでも右下に開く（§0.5 司令塔・どこからでも）。

import { useEffect, type ReactNode } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import { MeetRail } from "./MeetRail.tsx";
import { MemoryWindow } from "./MemoryWindow.tsx";
import { useMeetWorkspaceOptional } from "./MeetWorkspaceContext.tsx";

const SURFACE_LABEL: Record<string, string> = {
  antenna: MEET.home.place.heading,
  proposals: MEET.home.proposals.heading,
  talk: MEET.home.signals.heading,
};

export function MeetWorkspace({
  children,
  page,
}: {
  children: ReactNode;
  /** サブページで器を立てるとき（home は undefined＝activeSurface で見出しを決める）。 */
  page?: "memory" | "start";
}) {
  const ws = useMeetWorkspaceOptional();

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-ws", "1");
    return () => el.removeAttribute("data-ws");
  }, []);

  // 見出し（aria-label）: サブページは rail 語彙と一致（Memory / Setup）。home は面で決まる。
  const label =
    page === "memory"
      ? MEET.rail.memory
      : page === "start"
        ? MEET.rail.setup
        : ws
          ? (SURFACE_LABEL[ws.activeSurface] ?? "")
          : "";

  return (
    <div className="m-ws">
      <MeetRail />
      <div
        className="m-ws-canvas"
        id="m-ws-canvas"
        role="region"
        aria-label={label}
        data-page={page}
      >
        {children}
      </div>
      {/* あなたのAI 司令塔 FAB — どのページからでも開く（home/記憶/Setup 共通）。 */}
      <MemoryWindow />
    </div>
  );
}
