// R1.5 c17 → R2 便4 — 第一信の下書き置き場（owner-local, browser only）。
//
// Handoff Lite: mutual 後の「この接点で話す」面で AI が下書きした第一信を、
// owner が自分の言葉に直すまでの作業台。R2 便4 で **edge 単位キー**へ —
// spec §10 文脈の鮮度原則（下書きは edge に閉じ、最新の窓だけを拾う）。
// 同じ相手との別の接点は別の下書き。R1.5 の相手単位キー（fnote_<peerRef>）は
// 過渡形 — 旧キーの下書きは読み出し時に一度だけ edge キーへ移す（lazy 移行・
// 五人テスト端末の c17 下書きを失わない）。
//
// received.ts と同じ規律: AI 出力はこのレーンと received 棚にだけ着地する。
// このモジュールは memory store/validator を import しない（gate-pinned）し、
// 何もこのレーンをプロンプトの SELF 材料に読み込まない — 下書きが将来の
// 生成に複利しない。

import type { KeyedBackend } from "./backend.ts";

export type FirstNoteDraftV1 = {
  /** edge 単位キー — {@link firstNoteKey} で edgeId から導出。 */
  entryId: string;
  /** the edge this draft belongs to ("" on legacy rows awaiting migration). */
  edgeId: string;
  /** the draft body, exactly as last edited (owner's words win). */
  text: string;
  updatedAt: string;
};

/** One draft per EDGE: the entryId IS the edge (便4 — 鮮度原則のデータ形). */
export function firstNoteKey(edgeId: string): string {
  return `fnote_${edgeId}`;
}

/** R1.5 過渡形の相手単位キー — lazy 移行の読み出し元としてだけ残る。 */
export function legacyFirstNoteKey(peerRef: string): string {
  return `fnote_${peerRef}`;
}

export class FirstNoteStore {
  private backend: KeyedBackend<FirstNoteDraftV1>;
  private now: () => string;

  constructor(backend: KeyedBackend<FirstNoteDraftV1>, opts?: { now?: () => string }) {
    this.backend = backend;
    this.now = opts?.now ?? (() => new Date().toISOString());
  }

  /**
   * The saved draft for this edge ("" when none — the textarea starts blank).
   * Falls back ONCE to the R1.5 peer-keyed row and migrates it under the edge
   * key (the legacy row is removed so a second edge with the same peer starts
   * blank — 鮮度原則: 過去の窓を現在の最新として読まない).
   */
  async get(edgeId: string, legacyPeerRef = ""): Promise<string> {
    const e = await this.backend.get(firstNoteKey(edgeId));
    if (e !== undefined) return e.text;
    if (legacyPeerRef === "") return "";
    const legacy = await this.backend.get(legacyFirstNoteKey(legacyPeerRef));
    if (legacy === undefined || legacy.text === "") return "";
    await this.backend.put({
      entryId: firstNoteKey(edgeId),
      edgeId,
      text: legacy.text,
      updatedAt: this.now(),
    });
    await this.backend.remove(legacyFirstNoteKey(legacyPeerRef));
    return legacy.text;
  }

  /** Upsert — a later save overwrites the edge's single draft. */
  async save(edgeId: string, text: string): Promise<void> {
    await this.backend.put({
      entryId: firstNoteKey(edgeId),
      edgeId,
      text,
      updatedAt: this.now(),
    });
  }

  remove(edgeId: string): Promise<void> {
    return this.backend.remove(firstNoteKey(edgeId));
  }

  clear(): Promise<void> {
    return this.backend.clear();
  }
}
