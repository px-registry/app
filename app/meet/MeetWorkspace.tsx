"use client";

// ワークスペース化(β) 第2便 — 器のシェル（rail 細＋canvas 主役）。紙の上の工房。
// canvas には activeSurface 一面が大きく開く（C裁定一面）。CC窓（あなたのAI）は
// floating のまま（HomeView が描く・FAB 維持）。
//
// 紙トークンは触らない（既存 --ground/--shu/--mincho 参照のみ）。レイアウトは既存 grid/
// flex の役割転換＋MeetNav の固定バー CSS パターンの流用（下ドック）— ライブラリ不要。
//
// 器が立っている間だけ layout のルート nav（ホーム/記憶/はじめかた の3導線）を退ける
// — rail がその役を兼ねる（html[data-ws] で CSS が隠す）。

import { useEffect, type ReactNode } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import { MeetRail } from "./MeetRail.tsx";
import { useMeetWorkspace } from "./MeetWorkspaceContext.tsx";

const SURFACE_LABEL: Record<string, string> = {
  antenna: MEET.home.place.heading,
  proposals: MEET.home.proposals.heading,
  talk: MEET.home.signals.heading,
};

export function MeetWorkspace({ children }: { children: ReactNode }) {
  const { activeSurface } = useMeetWorkspace();

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-ws", "1");
    return () => el.removeAttribute("data-ws");
  }, []);

  return (
    <div className="m-ws">
      <MeetRail />
      <div
        className="m-ws-canvas"
        id="m-ws-canvas"
        role="region"
        aria-label={SURFACE_LABEL[activeSurface] ?? ""}
      >
        {children}
      </div>
    </div>
  );
}
