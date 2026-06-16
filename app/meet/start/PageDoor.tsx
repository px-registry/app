"use client";

// 墨工房 文言実験 第3手 ②（案A・Hiroto 裁定 2026-06-16）: Setup の二重框を構造で解く。
// 「このページで使う」扉は details — 既定は畳み、開くと中の3手順（鍵・下地・選ぶ）が出る。
// 二扉は R2 裁定 GOAL（同格の入口）なので保つ — 消さず、片方の中身を入れ子にしただけ。
//
// 沈黙の禁止: Antenna 面の未接続三点は /meet/start/#step-key・#step-intake へ深リンクする。
// 畳んだ details の中に anchor があると素のブラウザは開かない＝結末が画面に出ない。よって
// 対象 hash が中の id を指すとき、この窓口が details を開いてその手順までスクロールする。

import { useEffect, useRef, type ReactNode } from "react";
import { MEET } from "@/lib/meet/copy.ts";

export function PageDoor({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const openIfTargeted = () => {
      const id = location.hash.slice(1);
      if (id === "") return;
      const el = ref.current;
      if (el && el.querySelector(`#${CSS.escape(id)}`) !== null) {
        el.open = true;
        // details 展開後のレイアウトで対象へ寄せる（沈黙の禁止: 結末を画面に出す）。
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
      }
    };
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
    return () => window.removeEventListener("hashchange", openIfTargeted);
  }, []);

  return (
    <details className="m-door" ref={ref}>
      <summary className="m-door-summary">
        <span className="m-door-title">{MEET.start.doors.page.heading}</span>
        <span className="m-door-sign">{MEET.start.doors.page.sign}</span>
      </summary>
      {children}
    </details>
  );
}
