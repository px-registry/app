// R1.5 meet surface — forbidden copy terms. PORTED from px-table (the law/lab
// original): lib/px-table/copy.ts FORBIDDEN_TERMS + findForbiddenTerm @ main
// f46f470, plus the single exact-match fee whitelist from lib/px-work
// (category-scan-terms.ts). Data, not displayed copy — the meet gates scan
// deliberately excludes this file's own term list.
//
// PX never ranks, scores, recommends, certifies, or guarantees. These terms are
// banned as SUBSTRINGS in every meet copy string and UI source (case-insensitive
// for the EN tail, exact for JA).

export const FORBIDDEN_TERMS: readonly string[] = [
  // JA
  "マッチング",
  "おすすめ",
  "最適",
  "相性",
  "スコア",
  "信頼できる",
  "安全",
  "認定",
  "保証",
  "人気",
  "成立",
  "成功",
  "AIが選んだ",
  "PXが選んだ",
  "ベスト",
  "マッチ度",
  "ランキング",
  // 退場（Hiroto 2026-06-17・命名ゲート通過）: 旧「話してみる」→ Talk 語へ統一。
  // 「押した/誘導/説明」型でなく「状態を静かに示す」型へ（PX UI 憲法: ユーザーへの信頼）。
  "話してみる",
  // copy 微修正便（Hiroto 2026-06-17）: 「話せる」（peer presence 風味）・「見回り」（自動巡回の旧概念語→Run）
  // を user-facing から恒久排除。いずれも現状 copy 値には無く、コメントは scan が strip するので安全。
  // ※「下地」は Memory 移行語として文脈依存が残るため今回は追加しない（Hiroto 指定）。
  "話せる",
  "見回り",
  // JA — labour / employment-placement safety
  "採用",
  "推薦",
  "雇用",
  "面接",
  "報酬",
  "優先順位",
  // JA — review / rating / reputation safety ("レビュー" intentionally NOT
  // listed — substring of プレビュー, legitimate honesty copy)
  "評価",
  "評判",
  "レーティング",
  // EN (case-insensitive substrings)
  "recommended",
  "best",
  "score",
  "rank",
  "compatibility",
  "trusted",
  "safe",
  "verified",
  "certified",
  "guarantee",
  "hiring",
  "placement",
  "interview",
  "reputation",
];

/** The single exact-match whitelist: the zero-fee fact. Whole-string only —
 *  「成立しました」「成立率」 etc. still fail. */
export const FEE_WHITELIST = "成立手数料 0円";

/**
 * Returns the first forbidden term found in `s`, or null. The fee phrase passes
 * ONLY as the exact whole string.
 */
export function findForbiddenTerm(s: string): string | null {
  if (s === FEE_WHITELIST) return null;
  const lower = s.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (lower.includes(term.toLowerCase())) return term;
  }
  return null;
}
