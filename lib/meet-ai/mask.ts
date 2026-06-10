// R1.5 第2便 B — 伏せ版の下書き (AI draft for 候補に出すときの書き方). Pure
// prompt + parse only; the call itself goes through generate.ts (this lane's
// single fetch file) with the owner's own model and key — PX runs no model,
// and the private body goes only to the owner's OWN AI, exactly like the SELF
// grounding block. The owner edits and confirms before anything is saved.

export function buildMaskPrompt(title: string, text: string, maskWords: string[] = []): string {
  const words = maskWords.map((w) => w.trim()).filter((w) => w !== "");
  return [
    "次の項目を、固有名を伏せて内容だけが伝わる言い方に書き換えてください。",
    "伏せるもの：会社名・サービス名・ブランド名・人名・地名の細部（市区町村より細かいもの）。",
    // 補遺 E: the owner's explicit list rides along — and is then VERIFIED
    // deterministically on save (model obedience is not assumed).
    ...(words.length > 0 ? [`次の語は必ず言い換える（そのまま残さない）：${words.join("／")}`] : []),
    "内容と経験の中身は保ち、誇張しない。",
    '返答は次の形のJSONだけ（前後に説明文を付けない）：{"title": "短い言い換え", "text": "本文の言い換え"}',
    "",
    `title: ${title}`,
    `text: ${text}`,
  ].join("\n");
}

/**
 * Fail-closed parse of the mask reply (fences stripped, surrounding prose
 * removed). Returns null when no usable phrasing came back — the UI then says
 * so honestly and the owner writes by hand; nothing is auto-saved.
 */
export function parseMaskReply(raw: string): { title: string; text: string } | null {
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
  const r = parsed as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const text = typeof r.text === "string" ? r.text.trim() : "";
  if (title === "" && text === "") return null;
  return { title, text };
}
