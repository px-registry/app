"use client";

// R2 GOAL — 二扉化の第二の扉: あなたのAIから使う（チャットポートへの合鍵）。
//
// owner token 入りの接続 URL を組んで渡す。token は meet-net の local レーンが
// mint する同じ一枚（ページの分身とチャットの分身が同一人物になる）。表示は
// 伏せ、コピーだけ全文 — 画面越しの肩越し読みに合鍵を晒さない。
// PX へは何も送られない（この部品は fetch を持たない）。

import { useEffect, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import { getOrMintOwnerToken } from "@/lib/meet-net";

export function PortConnect() {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    // token は端末の中だけ — URL はこの場で組む（どこにも保存しない）
    setUrl(`${window.location.origin}/port/mcp?k=${getOrMintOwnerToken()}`);
  }, []);

  const masked = url === "" ? "" : url.replace(/k=.*$/, "k=••••••••");

  const copy = () => {
    void navigator.clipboard
      .writeText(url)
      .then(() => setCopied("done"))
      .catch(() => setCopied("failed"));
  };

  const D = MEET.start.doors.ai;
  return (
    <div>
      <p style={{ margin: "0 0 0.6rem", color: "var(--text)" }}>{D.setupNote}</p>
      <p className="mono m-note" style={{ margin: "0 0 0.6rem", wordBreak: "break-all" }}>
        {masked}
      </p>
      <button type="button" className="m-btn m-btn-primary" disabled={url === ""} onClick={copy}>
        {D.copyUrl}
      </button>
      {copied !== "idle" && (
        <p className="m-note" aria-live="polite" style={{ marginTop: "0.4rem" }}>
          {copied === "done" ? D.copied : D.copyFailed}
        </p>
      )}
      <p className="m-note" style={{ marginTop: "0.6rem" }}>{D.caution}</p>
      <p className="m-note" style={{ marginTop: "0.4rem" }}>{D.hint}</p>
    </div>
  );
}
