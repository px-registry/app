// 記憶装置 層1a — journal 型（LOCK・変更不可）。
//
// 設計正本: PX_MEMORY_DEVICE_thread v0.7 §0.7。保存は一つ（append-only の長さ）。
// 深さ・層・show 状態・重要度・visibilityHint は **焼かない**（読み時のビューが作る）。
// このファイルは型だけ — 焼く線（事実）と焼かない線（判断）の境界をコンパイル時に固める。
//
// 焼くもの: sourceRef（出自・後から付けられない）／tags は body.tags（新設しない）／
//           supersedes（訂正の鎖）／forget マーカー（忘却もappend・物理削除しない）。
// 焼かないもの: 層・深さ・show・重要度・visibilityHint（write-time 層決定の裏口を作らない）。
//
// rig_item は二本立て据置 — この journal は MeetMemoryEntryV1 を派生化しない（別便）。
// body は RigMemoryItemV1 を verbatim 流用（既存型・新設しない）。

import type { RigMemoryItemV1 } from "../rig/rig.ts";
import type { MeetProvenance } from "./types.ts";

/**
 * 出自（sourceRef）— 生まれた時にしか拾えない事実。channel が discriminant で、
 * その channel が content レコードの「witness 経路かどうか」を決める唯一の根拠。
 * すべて owner-local の参照（localRef/threadRef 等）— サーバ id は焼かない。
 */
export type SourceRefV1 =
  | { channel: "note"; localRef?: string }
  | { channel: "import"; importKind?: "cold_start" | "csv" | "json"; batchId?: string }
  | { channel: "talk"; threadRef?: string; messageRef?: string }
  | { channel: "witness"; witnessRef?: string };

/** witness 経路の種別（channel==="witness" の content レコードでだけ意味を持つ）。 */
export const WITNESS_SOURCES = ["payment", "ticket", "pack", "provider"] as const;
export type WitnessSourceV1 = (typeof WITNESS_SOURCES)[number];

/** 全レコード共通の土台。append-only — どれも生まれた後は不変。 */
export type JournalBase = {
  /** mem_<rand>。不変の同一性。IndexedDB の keyPath。 */
  recordId: string;
  /** 端末ローカルの単調増加 = 長さ。穴を空けない（forget/supersede も新レコードで seq を進める）。 */
  seq: number;
  createdAt: string;
  /** owner_written | owner_imported_confirmed のみ。AI 由来は validator が弾く。 */
  provenance: MeetProvenance;
  sourceRef: SourceRefV1;
};

/**
 * 一枚のレコード。recordType の discriminated union:
 *  - content: 中身を持つ（body=RigMemoryItemV1 verbatim）。supersedes で訂正の鎖。
 *             witnessSource は channel==="witness" の時だけ載る。
 *  - event:  body を持たない。targetRef が指す既存レコードへの「上げる/忘れる」の append。
 * 型ゲート: 「event なのに body」「content なのに body なし」は tsc が弾く。
 */
export type MemJournalRecordV1 = JournalBase &
  (
    | {
        recordType: "content";
        contentKind: "rig_item" | "note";
        body: RigMemoryItemV1;
        /** channel==="witness" の時のみ（validator が整合を見る）。 */
        witnessSource?: WitnessSourceV1;
        /** 訂正の鎖 — 上書きでなく、前の recordId を指す新レコードを append。 */
        supersedes?: string;
      }
    | {
        recordType: "event";
        /** surface=表層へ上げる（✅）／forget=忘却の指し（tombstone・長さは保つ）。 */
        eventKind: "surface" | "forget";
        targetRef: string;
      }
  );

/**
 * append() に渡す content レコードの素 — recordId/seq/createdAt は store が付ける。
 * 「event なのに body」をここでも型で塞ぐ（content 専用の投入口）。
 */
export type NewContentRecordV1 = {
  contentKind: "rig_item" | "note";
  provenance: MeetProvenance;
  sourceRef: SourceRefV1;
  body: RigMemoryItemV1;
  witnessSource?: WitnessSourceV1;
  supersedes?: string;
};

/** appendEvent() に渡す event レコードの素。 */
export type NewEventRecordV1 = {
  eventKind: "surface" | "forget";
  provenance: MeetProvenance;
  sourceRef: SourceRefV1;
  targetRef: string;
};
