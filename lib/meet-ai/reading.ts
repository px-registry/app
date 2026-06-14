// 記憶装置 層1b — reading（記憶が読める）。設計正本 v0.7 §0/§0.6/§0.7。
//
//   書く時は長さだけ（層1a・journal）。**読む時に層が生まれる** — owner の AI が、
//   その日の問いを刃に、journal の生札を切る。何度でも切り直せる。
//
// このモジュールは PURE: fetch も storage も触らない（生成は generate.ts の鍵直行、
// journal は meet-memory）。journal からは **読むだけ** — append 以外の書き込みを
// 一切しない（journal 非汚染・複利しない＝reading 結果は journal に戻さない）。
// 切った層はビュー（捨てて切り直せる導出物・ReadingViewCache）。
//
// 三深度（レコードを動かさず読み時のビューで・§0.7）:
//   表層   — owner が surface で上げたもの（active surface event）。先頭へ。
//   深層   — 既定。recency 窓（seq の最近を先に）。日頃読まない長さの中身。
//   タグ掘り — トリガー語が出たら body.tags で紐づくレコードへ、窓の外でも到達。
// forgotten（forget で指された）は **既定で出さない** — 「全部見せて」(showAll)で復帰。
// superseded（古い body）は最新優先で除外（foldHeads が落とす）。

import {
  foldHeads,
  foldForgottenIds,
  foldSurfacedIds,
} from "../meet-memory/journal.ts";
import type { MemJournalRecordV1 } from "../meet-memory/journal-types.ts";

/** 既定の recency 窓（深層は普段軽い・トリガーと表層で深くなる）。 */
export const READING_WINDOW = 40;

export type ReadingOpts = {
  /** 深層の recency 窓（最近 N 件）。 */
  window?: number;
  /** 「全部見せて」— forgotten も含め長さ全体を出す。 */
  showAll?: boolean;
};

export type ReadingSelection = {
  /** プロンプトに渡すレコード（表層→タグ掘り→深層 窓 の順・重複なし）。 */
  records: MemJournalRecordV1[];
  /** 表層へ上がっている recordId（active surface）。 */
  surfacedIds: string[];
  /** 問いが呼んだタグ（body.tags のうち問い文に現れたもの）。 */
  triggeredTags: string[];
  /** 既定ビューから伏せた forgotten の数（showAll では 0）。正直表示用。 */
  forgottenHidden: number;
};

function contentTags(r: MemJournalRecordV1): string[] {
  return r.recordType === "content" ? r.body.tags : [];
}

/**
 * 問いが呼ぶタグ — visible なレコードの body.tags のうち、問い文に現れた語。
 * タグは事実（焼いてよい）、深度は読み時に AI が決める（焼かない）— ここは「どの
 * タグが呼ばれたか」までを決め、どこまで掘るかは AI に委ねる（prompt の【読み方】）。
 */
export function extractTriggerTags(question: string, visible: MemJournalRecordV1[]): string[] {
  const q = question.trim();
  if (q === "") return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of visible) {
    for (const tag of contentTags(r)) {
      if (tag === "" || seen.has(tag)) continue;
      if (q.includes(tag)) {
        seen.add(tag);
        out.push(tag);
      }
    }
  }
  return out;
}

/**
 * その日の一刀 — journal の全レコードと問いから、読みのビューを切る。PURE で
 * 決定的（同じ (journal, question, opts) → 同じ selection）。だからビューキャッシュ
 * は捨てても再構築できる（journal が正・ビューは導出物）。
 */
export function selectForReading(
  all: MemJournalRecordV1[],
  question: string,
  opts?: ReadingOpts,
): ReadingSelection {
  const window = opts?.window ?? READING_WINDOW;
  const showAll = opts?.showAll ?? false;

  const heads = foldHeads(all); // content heads（superseded 除外・seq 昇順）
  const forgotten = foldForgottenIds(all);
  const surfaced = foldSurfacedIds(all);

  // forgotten は既定で伏せる（showAll で復帰）。
  const visible = showAll ? heads : heads.filter((r) => !forgotten.has(r.recordId));
  const forgottenHidden = showAll ? 0 : heads.length - visible.length;

  const triggeredTags = extractTriggerTags(question, visible);
  const newest = [...visible].reverse(); // seq 降順（比較ソートではなく位置の反転）

  const picked: MemJournalRecordV1[] = [];
  const seen = new Set<string>();
  const add = (r: MemJournalRecordV1): void => {
    if (seen.has(r.recordId)) return;
    seen.add(r.recordId);
    picked.push(r);
  };

  // 1. 表層（owner が上げたもの）— 先頭へ。
  for (const r of newest) if (surfaced.has(r.recordId)) add(r);
  // 2. タグ掘り — 窓の外でも到達（忘れていても・表層になくても）。
  if (triggeredTags.length > 0) {
    for (const r of newest) {
      if (contentTags(r).some((t) => triggeredTags.includes(t))) add(r);
    }
  }
  // 3. 深層 recency 窓 — 最近 N 件。
  for (const r of newest.slice(0, window)) add(r);

  const surfacedIds: string[] = [];
  for (const r of visible) if (surfaced.has(r.recordId)) surfacedIds.push(r.recordId);

  return { records: picked, surfacedIds, triggeredTags, forgottenHidden };
}

// ── プロンプト組み立て（AI 向け・§0.6 文言の床: 評価でなく発見・判定しない）──────

const MEMORY_HEADING = "【あなたの記憶（読み）】";
const QUESTION_HEADING = "【今日の問い】";
const HOW_HEADING = "【読み方】";
const FORMAT_HEADING = "【返答の形】";

const HOW_BLOCK = [
  HOW_HEADING,
  "上の記憶を、今日の問いの刃で読む。決めつけず、見つかったことを返す。",
  "判定しない。点数や順位はつけない。比べて選ばない。",
  "足りない記憶は作らない。記憶に無いことは「無い」と言う。",
  "気づきは『あなたに必要』ではなく『これ、気になりますか?』の誘いで書く。",
].join("\n");

function renderMemoryLine(ref: string, r: MemJournalRecordV1): string {
  if (r.recordType !== "content") return `[${ref}]`;
  const b = r.body;
  const head = b.title.trim() !== "" ? `${b.kind}: ${b.title} — ${b.text}` : `${b.kind}: ${b.text}`;
  const tags = b.tags.length > 0 ? `  ${b.tags.map((t) => `#${t}`).join(" ")}` : "";
  return `[${ref}] ${head}${tags}`;
}

/**
 * selection を AI 向けプロンプトへ。prompt-local ref（m1, m2, …）を記憶行に振り、
 * 同じ ref を map で返す — reading の返答（found）はこの ref で記憶を指し、解決して
 * recordId に戻す（received 棚の basisItems と同根の provenance 流儀）。
 */
export function composeReadingPrompt(
  all: MemJournalRecordV1[],
  question: string,
  opts?: ReadingOpts,
): { prompt: string; refs: Record<string, string>; selection: ReadingSelection } {
  const selection = selectForReading(all, question, opts);
  const refs: Record<string, string> = {};
  const lines: string[] = [];
  selection.records.forEach((r, i) => {
    const ref = `m${i + 1}`;
    refs[ref] = r.recordId;
    lines.push(renderMemoryLine(ref, r));
  });

  const memoryBlock =
    lines.length > 0 ? `${MEMORY_HEADING}\n${lines.join("\n")}` : `${MEMORY_HEADING}\n（まだ記憶がありません）`;
  const q = question.trim();
  const questionBlock = q !== "" ? `\n\n${QUESTION_HEADING}\n${q}` : "";
  const formatBlock = [
    FORMAT_HEADING,
    "次の形のJSONだけを返す（前後に説明文を付けない）：",
    '{ "found": ["関係した記憶の参照（[m1] と書かれた記憶なら m1）", "..."], "note": "見つかったことを一言（誘いの言葉で・判定しない）" }',
    "関係する記憶が無ければ found を [] にし、note に「今日はここには見つからない」と書く。",
  ].join("\n");

  const prompt = `${memoryBlock}${questionBlock}\n\n${HOW_BLOCK}\n\n${formatBlock}`;
  return { prompt, refs, selection };
}

/**
 * 記憶の文脈ブロックだけを描く（層2 の窓の system へ畳む材料）。返答の形・読み方の
 * 指示は付けない — agent 側が自分の system 指示を持つ。selection は PURE。
 */
export function renderMemoryContext(
  all: MemJournalRecordV1[],
  question: string,
  opts?: ReadingOpts,
): string {
  const selection = selectForReading(all, question, opts);
  if (selection.records.length === 0) return `${MEMORY_HEADING}\n（まだ記憶がありません）`;
  const lines = selection.records.map((r, i) => renderMemoryLine(`m${i + 1}`, r));
  return `${MEMORY_HEADING}\n${lines.join("\n")}`;
}

/** 指示書の名前どおりの薄い入口（プロンプト文字列だけ要る呼び手向け）。 */
export function buildReadingPrompt(
  all: MemJournalRecordV1[],
  question: string,
  opts?: ReadingOpts,
): string {
  return composeReadingPrompt(all, question, opts).prompt;
}

// ── 返答パース（fail-closed・raw は常に残す）＋ 捨てられるビューキャッシュ ────────

export type ReadingReply = { found: string[]; note: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * AI の reading 返答をパース。fail-closed: 壊れていれば { found: [], note: "" }。
 * 例外を投げない（沈黙でなく空の読み）。コードフェンスは剥がす。
 */
export function parseReadingReply(raw: string): ReadingReply {
  const stripped = raw.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    const a = stripped.indexOf("{");
    const b = stripped.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        parsed = JSON.parse(stripped.slice(a, b + 1));
      } catch {
        return { found: [], note: "" };
      }
    } else {
      return { found: [], note: "" };
    }
  }
  if (!isRecord(parsed)) return { found: [], note: "" };
  const found = Array.isArray(parsed.found)
    ? parsed.found.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim())
    : [];
  const note = typeof parsed.note === "string" ? parsed.note.trim() : "";
  return { found, note };
}

/** reading 結果（received 棚の規律＝AI 出力は journal に戻さない・複利しない）。 */
export type ReadingResultV1 = {
  question: string;
  createdAt: string;
  /** AI 返答 verbatim（正直さ・パースできてもそのまま残す）。 */
  raw: string;
  /** パースした読みの一言。 */
  note: string;
  /** found ref を解決した recordId 群（解決できた参照のみ・fail-closed）。 */
  foundRecordIds: string[];
};

/**
 * found（prompt-local ref）を recordId に解決して reading 結果を組む。解決できない
 * 参照（AI の発明・古い ref）は黙って落とす — journal には何も書かない。
 */
export function resolveReading(
  reply: ReadingReply,
  refs: Record<string, string>,
  raw: string,
  question: string,
  createdAt: string,
): ReadingResultV1 {
  const foundRecordIds: string[] = [];
  const seen = new Set<string>();
  for (const ref of reply.found) {
    const id = refs[ref];
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      foundRecordIds.push(id);
    }
  }
  return { question, createdAt, raw, note: reply.note, foundRecordIds };
}

/**
 * 切った層の置き場 — 捨てて切り直せる導出物（in-memory）。journal が正・これは
 * キャッシュ。clear() で全部捨てられ、再 compose で再構築できる（selection が PURE）。
 * journal には一切触れない（読みも書きもこのクラスはしない）。
 */
export class ReadingViewCache {
  private map = new Map<string, ReadingResultV1>();

  put(result: ReadingResultV1): void {
    this.map.set(result.question, result);
  }
  get(question: string): ReadingResultV1 | undefined {
    return this.map.get(question);
  }
  list(): ReadingResultV1[] {
    return [...this.map.values()];
  }
  /** 切り直す — ビューを全部捨てる（journal は無傷・再構築できる）。 */
  clear(): void {
    this.map.clear();
  }
}
