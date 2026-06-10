// R1.5 第4便 B — 固有名の検出 (the inversion of masking). The owner never
// pre-registers words; the owner's OWN AI reads the OUTGOING text and OFFERS
// detected proper nouns with replacement suggestions — the owner taps to
// decide. Pure prompt + parse only; the call goes through generate.ts (this
// lane's single fetch file) with the owner's model and key — PX runs no model.
// Downstream, every detection passes the deterministic presence filter
// (lib/meet-memory/mask-check.ts): a model can point only at what is there.

import type { MaskPair } from "../meet-memory/mask-check.ts";

export function buildDetectPrompt(title: string, text: string): string {
  return [
    "次の文から、二種類の言葉だけを見つけてください。",
    "一、特定につながる言葉：会社名・製品名・サービス名・人名・細かい地名・学校名・固有のプロジェクト名。",
    // 第7便 E — 伝わる言い方: jargon rides the same offer-and-tap lane.
    "二、外の参加者に伝わらない可能性のある言い回し：内輪の言葉・専門語。",
    "一般的な言葉は拾わない。確信が持てない言葉は出さない。",
    "見つけた言葉ごとに、平易な言い換えをひとつ添えてください。意味を足さない。",
    '返答は次の形のJSONだけ（前後に説明文を付けない）：[{"word":"見つけた言葉","mask":"言い換え"}]',
    "見つからなければ [] を返してください。",
    "",
    `title: ${title}`,
    `text: ${text}`,
  ].join("\n");
}

/**
 * 第7便 B — ひとこと紹介の下書き. Material is the owner's PUBLIC items only;
 * the result is OFFERED (the owner edits and saves — nothing publishes until
 * the owner presses 保存 and then 候補に出す).
 */
export function buildIntroPrompt(items: Array<{ kind: string; title: string; text: string }>): string {
  return [
    "次の公開項目だけを材料に、この人の「ひとこと紹介」を一行書いてください。",
    "盛らない・誇張しない・材料に無いことを足さない。60字以内。",
    "一人称・呼びかけ・依頼文は使わない。",
    '返答は次の形のJSONだけ（前後に説明文を付けない）：{"intro":"ひとこと紹介"}',
    "",
    ...items.map((it) => `- ${it.kind}: ${it.title !== "" ? `${it.title} — ${it.text}` : it.text}`),
  ].join("\n");
}

/** Fail-closed parse for the intro draft — junk → null (nothing is filled). */
export function parseIntroReply(raw: string): string | null {
  const stripped = raw.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(stripped.trim());
  } catch {
    const a = stripped.indexOf("{");
    const b = stripped.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        parsed = JSON.parse(stripped.slice(a, b + 1));
      } catch {
        parsed = null;
      }
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const intro = (parsed as Record<string, unknown>).intro;
  return typeof intro === "string" && intro.trim() !== "" ? intro.trim() : null;
}

/**
 * Fail-closed parse of the detection reply (fences stripped, surrounding
 * prose removed). Junk → [] — the UI quietly offers nothing and the owner
 * edits by hand; nothing is ever auto-applied from a broken reply.
 */
export function parseDetectReply(raw: string): MaskPair[] {
  const stripped = raw.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(stripped.trim());
  } catch {
    const a = stripped.indexOf("[");
    const b = stripped.lastIndexOf("]");
    if (a >= 0 && b > a) {
      try {
        parsed = JSON.parse(stripped.slice(a, b + 1));
      } catch {
        parsed = null;
      }
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out: MaskPair[] = [];
  for (const p of parsed) {
    if (typeof p !== "object" || p === null || Array.isArray(p)) continue;
    const r = p as Record<string, unknown>;
    const word = typeof r.word === "string" ? r.word.trim() : "";
    const mask = typeof r.mask === "string" ? r.mask.trim() : "";
    if (word === "") continue; // a pair without a word is nothing to offer
    out.push({ word, mask });
  }
  return out;
}
