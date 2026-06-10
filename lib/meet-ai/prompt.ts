// R1.5 meet AI — prompt assembly. Composes the FROZEN rig core output; never
// re-implements it. Structure (the goal's four blocks):
//
//   【あなたの記憶】       buildOwnerPrompt (rig core, private included — SELF only)
//   【公開候補プール】     buildOwnerPrompt (rig core, public-only, ownerRef-attributed)
//   【今日の問い】         spliced in here, BEFORE the law (so the law reads it too);
//                          omitted entirely when the question is empty
//   【出会いの法】         RIG_LAW verbatim (pinned by lib/rig gates)
//
// A FORMAT block is appended AFTER the law — a technical output contract
// (machine-readable cards) that adds no ranking and contradicts nothing in the
// law; the law's 2-line card shape maps 1:1 onto line1/line2.

import {
  buildOwnerPrompt,
  RIG_MEMORY_KINDS,
  type RigOwnerV1,
  type RigPublicPoolItemV1,
  type RigMemoryKindV1,
} from "../rig/rig.ts";
import type { PoolItemPublic } from "../meet-net/api.ts";

const LAW_HEADING = "【出会いの法】";
const QUESTION_HEADING = "【今日の問い】";

const FORMAT_BLOCK = [
  "【返答の形】",
  "次の形のJSONだけを返してください（前後に説明文を付けない）：",
  '[{ "to": "相手の名前（プールの[名前]と同じ表記）", "line1": "①あなたのもの × 相手のもの", "line2": "②具体の錨をひとつ言い切る" }]',
  "今日は無い場合は [] を返す。",
].join("\n");

const KIND_SET = new Set<string>(RIG_MEMORY_KINDS);

/** Served pool rows → the rig core's pool shape (fail-closed on kind). */
export function toRigPool(items: PoolItemPublic[]): RigPublicPoolItemV1[] {
  const out: RigPublicPoolItemV1[] = [];
  for (const it of items) {
    if (!KIND_SET.has(it.kind)) continue;
    out.push({
      ownerRef: it.ownerRef,
      kind: it.kind as RigMemoryKindV1,
      title: it.title,
      text: it.text,
      tags: [...it.tags],
    });
  }
  return out;
}

/**
 * Assemble the full browser-direct prompt. Pure & deterministic; the law block
 * stays verbatim and LAST among the rig blocks (the question slips in before it).
 */
export function buildMeetPrompt(
  self: RigOwnerV1,
  pool: RigPublicPoolItemV1[],
  question: string,
): string {
  const base = buildOwnerPrompt(self, pool);
  const q = question.trim();
  let withQuestion = base;
  if (q !== "") {
    const idx = base.indexOf(LAW_HEADING);
    const qBlock = `${QUESTION_HEADING}\n${q}\n\n`;
    withQuestion = idx >= 0 ? base.slice(0, idx) + qBlock + base.slice(idx) : `${base}\n\n${qBlock}`;
  }
  return `${withQuestion}\n\n${FORMAT_BLOCK}`;
}

// ── Parsing the model's reply (fail-closed; raw text is kept either way) ───────

export type ProposalCard = { to: string; line1: string; line2: string };

/**
 * `parsed` distinguishes the two empty-card cases the UI must not conflate
 * (第1便 observation: qwen's fenced "```json\n[]\n```" was dumped raw):
 *   parsed=true,  cards=[]  → the model SAID 今日は無い (a recognized empty array)
 *   parsed=false, cards=[]  → format miss; raw is the honest fallback
 */
export type ReplyOutcome = { parsed: boolean; cards: ProposalCard[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Last-ditch rescue for a TRUNCATED array (max-tokens cut): keep the cards
 *  completed before the cut by re-closing at each `}` from the end. */
function parseTruncatedArray(s: string): unknown {
  for (let i = s.lastIndexOf("}"); i > 0; i = s.lastIndexOf("}", i - 1)) {
    try {
      return JSON.parse(s.slice(0, i + 1) + "]");
    } catch {
      /* keep walking back */
    }
  }
  return null;
}

/**
 * Parse the reply leniently — code fences stripped, surrounding prose removed
 * (everything outside the outermost [...]), truncated arrays rescued — and
 * fail-closed per card. When nothing is recognizable as a JSON array,
 * `parsed: false` tells the caller to fall back to the verbatim raw text, so
 * a format miss never loses a proposal.
 */
export function parseReplyOutcome(raw: string): ReplyOutcome {
  const stripped = raw.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(stripped.trim());
  } catch {
    const a = stripped.indexOf("[");
    if (a >= 0) {
      const b = stripped.lastIndexOf("]");
      if (b > a) {
        try {
          parsed = JSON.parse(stripped.slice(a, b + 1));
        } catch {
          parsed = parseTruncatedArray(stripped.slice(a));
        }
      } else {
        parsed = parseTruncatedArray(stripped.slice(a));
      }
    }
  }
  if (!Array.isArray(parsed)) return { parsed: false, cards: [] };
  const cards: ProposalCard[] = [];
  for (const c of parsed) {
    if (!isRecord(c)) continue;
    if (typeof c.to !== "string" || typeof c.line1 !== "string") continue;
    const line2 = typeof c.line2 === "string" ? c.line2 : "";
    if (c.to.trim() === "" || c.line1.trim() === "") continue;
    cards.push({ to: c.to.trim(), line1: c.line1, line2 });
  }
  return { parsed: true, cards };
}

/** Card list only — kept for callers that don't need the parsed/raw distinction. */
export function parseProposalReply(raw: string): ProposalCard[] {
  return parseReplyOutcome(raw).cards;
}
