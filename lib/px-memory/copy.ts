// PX Memory v0.1 — Owner-facing copy（疎・PX らしく）。
//
// Owner-facing には placement 語彙（「深くしまう」「Deep」「表層」「深層」）を出さない。
// 操作は 残す / 外す / +Antenna の 3 つだけ。重要度・スコア・おすすめ・マッチング・
// ランキングを使わない。px-memory-gates.test.ts の OC-* がこの object を scan する。

export const PX_MEMORY_COPY = {
  /** 「残す」「外す」はチェックの ON/OFF で伝える（言葉でなく affordance）。aria 用の名。 */
  keepAriaLabel: "残す",
  removeAriaLabel: "外す",
  /** 「+Antenna」は明示の操作名（指示書で確定済の文言）。 */
  antennaAction: "+Antenna",
  /** Antenna ページの一緒に出す Memory の節。 */
  antennaSectionTitle: "一緒に出すMemory",
  /** 何も無いときの正直な空状態（沈黙の禁止）。 */
  emptyState: "まだありません。",
} as const;

/** Owner-facing に出してはいけない語（self-check 用・テストが照合する）。 */
export const PX_MEMORY_FORBIDDEN_OWNER_WORDS: readonly string[] = [
  "深くしまう",
  "Deep",
  "表層",
  "深層",
  "重要度",
  "スコア",
  "おすすめ",
  "マッチング",
  "ランキング",
];
