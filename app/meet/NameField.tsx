"use client";

// 呼び名フィールド（Hiroto 確定 2026-06-16・表層語彙統一便 第2手 (a)）。
//
// 呼び名は Memory の編集項目でもあるが、初期設定としては Setup の一部 — 警告文が
// 「Setupで設定できます。」と言う以上、着地も Setup に揃える。ここはその共用フィールド:
// **データ実体は Memory 側と同じ** owner-local store（openMeetMemory の profile.displayName）
// を読み書きする。新しい保存先は作らない（データ二重化なし）。intro は保全してマージ
// （Memory 側の ひとこと を上書きしない）。Memory ページの呼び名編集はそのまま残る。

import { useCallback, useEffect, useMemo, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import { openMeetMemory } from "@/lib/meet-memory";

export function NameField() {
  const store = useMemo(() => openMeetMemory(), []);
  const [displayName, setDisplayName] = useState("");
  const [saved, setSaved] = useState(false);

  // localStorage/IndexedDB は effect で初期化（prerender を落とさない）。
  useEffect(() => {
    void store.getProfile().then((p) => {
      if (p) setDisplayName(p.displayName);
    });
  }, [store]);

  const save = useCallback(async () => {
    // 同じ store・同じ action を共用 — intro は現状を読み直して保全（二重化なし）。
    const prof = await store.getProfile();
    await store.setProfile({ displayName: displayName.trim(), intro: prof?.intro ?? "" });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [store, displayName]);

  return (
    // layout 体系便（Phase 1）: フィールドカード（入力面）＋深リンク着地点 #name。
    // Setup 専用部品なので id をここに置く（孤立 section を畳み、手順グループに並べる）。
    <div className="m-card m-card--field" id="name">
      <h2 className="m-h2">{MEET.profile.heading}</h2>
      <p className="m-note" style={{ margin: "0 0 0.5rem" }}>
        {MEET.profile.note}
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          className="m-field"
          style={{ flex: 1, minWidth: 0 }}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={MEET.profile.placeholder}
        />
        {/* ボタンは縮ませず一行で（narrow row で「保存済／み」と折れない・Hiroto 指摘）。 */}
        <button
          type="button"
          className="m-btn m-btn-quiet"
          style={{ flexShrink: 0, whiteSpace: "nowrap" }}
          onClick={() => void save()}
        >
          {saved ? MEET.profile.saved : MEET.profile.save}
        </button>
      </div>
    </div>
  );
}
