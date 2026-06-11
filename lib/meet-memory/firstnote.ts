// R1.5 c17 — 第一信の下書き置き場（owner-local, browser only）。
//
// Handoff Lite: mutual 後の「この接点で話す」面で AI が下書きした第一信を、
// owner が自分の言葉に直すまでの作業台。EDGE 単位（peerRef ごとに一枚）で
// 端末にだけ残る — サーバへは送らない（送り方はコピー→外部チャネル）。
//
// received.ts と同じ規律: AI 出力はこのレーンと received 棚にだけ着地する。
// このモジュールは memory store/validator を import しない（gate-pinned）し、
// 何もこのレーンをプロンプトの SELF 材料に読み込まない — 下書きが将来の
// 生成に複利しない。

import type { KeyedBackend } from "./backend.ts";

export type FirstNoteDraftV1 = {
  /** edge 単位キー — {@link firstNoteKey} で peerRef から導出。 */
  entryId: string;
  peerRef: string;
  /** the draft body, exactly as last edited (owner's words win). */
  text: string;
  updatedAt: string;
};

/** One draft per edge: the entryId IS the peer. */
export function firstNoteKey(peerRef: string): string {
  return `fnote_${peerRef}`;
}

export class FirstNoteStore {
  private backend: KeyedBackend<FirstNoteDraftV1>;
  private now: () => string;

  constructor(backend: KeyedBackend<FirstNoteDraftV1>, opts?: { now?: () => string }) {
    this.backend = backend;
    this.now = opts?.now ?? (() => new Date().toISOString());
  }

  /** The saved draft for this edge ("" when none — the textarea starts blank). */
  async get(peerRef: string): Promise<string> {
    const e = await this.backend.get(firstNoteKey(peerRef));
    return e?.text ?? "";
  }

  /** Upsert — a later save overwrites the edge's single draft. */
  async save(peerRef: string, text: string): Promise<void> {
    await this.backend.put({
      entryId: firstNoteKey(peerRef),
      peerRef,
      text,
      updatedAt: this.now(),
    });
  }

  remove(peerRef: string): Promise<void> {
    return this.backend.remove(firstNoteKey(peerRef));
  }

  clear(): Promise<void> {
    return this.backend.clear();
  }
}
