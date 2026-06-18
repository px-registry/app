// PX Memory v0.1 — types.
//
// 設計正本: docs/r2/px-memory-v01.md。Owner の端末上にある append-only な記憶基層。
//
// 不変（型で固める）:
//  - Raw Memory は append-only な MemoryEvent（生まれた後は不変・物理削除しない）。
//  - 表層/深層/Antenna-ready/hidden は「重要度」ではなく Owner が選んだ placement。
//    placement は内部値のみ — Owner-facing UI には出さない（管理操作として見せない）。
//  - tag / cue は重要度ではなく、読み時に掘るための trigger。
//  - distillation / summary / claim / embedding / relation は projection であり、
//    sourceEventIds を必ず持つ（Raw Memory の置き換えではない・source of truth でない）。
//  - サーバには Raw Memory / Deep Memory / private embedding / raw 会話 を送らない
//    （この lane は fetch を持たない — 端末ローカルのみ）。

/** 出自。Owner 入力か、AI が出した候補か。AI 候補は Owner が「残す」まで表層化しない。 */
export type MemoryProvenance = "owner" | "ai_candidate";

/**
 * 内部だけの読み placement。**Owner-facing UI には絶対に出さない**（「深くしまう」
 * 「Deep」「表層」「深層」を操作として見せない）。未選択の既定は "deep"。
 *  - surface        : Owner が「残す」を選んだ — 通常 Run で読まれる
 *  - deep           : 既定 / 「外す」後 — 端末に保持されるが通常 Run では読まれない
 *  - antenna_ready  : 「+Antenna」で下書きカードを作った候補（まだ公開でない）
 *  - antenna_public : Owner が承認した公開断片（v0.1 の自動フローには無い・別経路）
 *  - hidden         : Owner が忘れた指し（tombstone）— Read Gate が完全に除外する
 */
export type MemoryReadPlacement =
  | "surface"
  | "deep"
  | "antenna_ready"
  | "antenna_public"
  | "hidden";

/** 未選択の既定 placement。Owner には選択操作として見せない。 */
export const DEFAULT_PLACEMENT: MemoryReadPlacement = "deep";

/** 生の中身。text は raw private — サーバ送信・自動公開を絶対にしない。 */
export type RawMemoryBody = {
  /** raw private text。Read Gate を通さずに AI へ渡さない。公開しない。 */
  text: string;
  /** 一行アンカー（任意）。 */
  title?: string;
  /** cue = 読み時トリガー（重要度ではない）。奥を掘るかどうかの判断にだけ使う。 */
  cues: string[];
};

type MemoryEventBase = {
  /** 不変の同一性。 */
  eventId: string;
  /** 端末ローカルの単調増加 = 長さ。穴を空けない（place/forget も seq を進める）。 */
  seq: number;
  createdAt: string;
  provenance: MemoryProvenance;
};

/**
 * Raw Memory の append-only レコード（生まれた後は不変）。
 *  - capture : 生の記憶が生まれた（body を持つ）。
 *  - place   : Owner が placement を動かした（targetEventId が指す capture へ）。
 *  - forget  : 忘却の指し（tombstone・物理削除しない）。
 */
export type MemoryEvent = MemoryEventBase &
  (
    | { type: "capture"; body: RawMemoryBody }
    | { type: "place"; targetEventId: string; placement: MemoryReadPlacement }
    | { type: "forget"; targetEventId: string }
  );

/**
 * 一つの捕捉記憶の「今の見え方」— events を畳んで作る projection。
 * これ自体は source of truth ではない（events が長さ＝真理）。
 */
export type MemoryItem = {
  /** == capture eventId。 */
  itemId: string;
  /** この item を形づくった全 event（capture + place/forget…）。常に非空。 */
  sourceEventIds: string[];
  body: RawMemoryBody;
  /** 畳んだ現在の placement（既定 deep）。 */
  placement: MemoryReadPlacement;
  /** 最新 event が forget なら true。 */
  forgotten: boolean;
  createdAt: string;
  updatedAt: string;
};

export const PROJECTION_KINDS = [
  "distillation",
  "summary",
  "claim",
  "embedding",
  "relation",
] as const;
export type MemoryProjectionKind = (typeof PROJECTION_KINDS)[number];

/**
 * 派生物（蒸留・要約・claim・embedding・relation）。**sourceEventIds を必ず持つ**
 * — projection は Raw Memory の置き換えではなく、いつでも source へ戻れる派生でしかない。
 */
export type MemoryProjection = {
  projectionId: string;
  kind: MemoryProjectionKind;
  /** 必須・非空。空なら createMemoryProjection が throw する（type でも要求）。 */
  sourceEventIds: [string, ...string[]];
  /** 派生の中身（要約文・claim・vector ref…）。Read Gate にとっては不透明。 */
  value: unknown;
  createdAt: string;
};

/** Read Gate の判定。すべての「AI に渡す」経路はここを通る（fail-closed）。 */
export type ReadGateDecision = {
  allow: boolean;
  /** true のとき、allow でも raw text は伏せる。 */
  redactRaw: boolean;
  reason: string;
};

/**
 * 「+Antenna」が作る下書き。**Raw Memory 公開ではない** — raw private text を載せない。
 * 公開（antenna_public）は Owner 承認の別経路（v0.1 では draft までで止める）。
 */
export type AntennaContextCard = {
  cardId: string;
  sourceItemId: string;
  sourceEventIds: [string, ...string[]];
  /** Owner が書く/直す要約。既定は空 — raw で自動補完しない。 */
  summary: string;
  /** Owner が出すと選んだ公開 cue（既定は無し）。 */
  cues: string[];
  /** draft は raw private text を決して持たない（hard invariant）。 */
  includesRawText: false;
  /** v0.1 は draft しか作らない。publish は Owner-gated な別経路。 */
  status: "draft";
  createdAt: string;
};

/** 通常 Run で AI に渡す記憶の束。 */
export type RunMemoryPacket = {
  /** 表層 — 通常 Run に常に入る。 */
  surface: MemoryItem[];
  /** trigger の cue が当たったので掘った深層（Read Gate 通過後のみ）。 */
  dug: MemoryItem[];
  /** trigger text に現れた cue（素の Run では空）。 */
  triggerCues: string[];
};
