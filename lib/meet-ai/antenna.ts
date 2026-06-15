// 記憶装置 §0.6 — アンテナ候補（円環の最後の輪）。設計正本 v0.7 §0.6。
//
// AI が記憶（journal）を読み、「アンテナ（探していること）」の候補を **そっと差し出す**。
// 明示（owner 自身が書きそうなこと）＋暗黙（記憶から滲むこと — 「新店を始める」→
// 「初期スタッフが要るのでは」を AI が察する）の両方を拾ってよい。
//
// 文言の床（§0.6 lock）: 出すのは「候補」であって「あなたに必要なアンテナ」ではない。
// 判定しない・決めつけない。「これ、気になりますか?」の誘いで書く（発見を聞く文法）。
//
// PURE: fetch も storage も持たない（生成は generateProposals の鍵直行・journal は
// 読むだけ＝書き戻さない＝第2便 RD-1 の継承）。察するのは AI・立てるのは owner
// （候補から立てるのは place_question 二態・owner ✅ — このモジュールは書き込まない）。

const MEMORY_HEADING = "【あなたの記憶（読み）】";

const ANTENNA_INSTRUCTIONS = [
  "あなたは owner の記憶を読み、アンテナ（探していること）の候補をそっと差し出す AI です。",
  "- owner 自身が書きそうなこと（明示）と、記憶から滲むこと（暗黙）の両方を拾ってよい。",
  "  暗黙の例: 記憶に「新しい店を始める」とあれば「初期のスタッフを探しては?」を察してよい。",
  "- これは「候補」であって「あなたに必要なアンテナ」ではない。判定しない・決めつけない。",
  "  「あなたには店長探しが必要」ではなく「『新しい現場』、気になりますか?」の誘いで書く。",
  "- 記憶に無いことは作らない。気になりそうなものだけ、多くて3つ。",
].join("\n");

const ANTENNA_FORMAT = [
  "返答は次の形のJSONだけ（前後に説明文を付けない）：",
  '[{ "text": "アンテナの本文（探していること・公開される一文）", "title": "一言タイトル", "why": "なぜ気になりそうか、を誘いの一言で（判定しない）", "implicit": false }]',
  "暗黙（記憶から滲ませたもの）は implicit を true に。差し出せるものが無ければ [] を返す。",
].join("\n");

/**
 * 候補生成のプロンプト（AI 向け）。memoryContext は第2便 renderMemoryContext の出力
 * を渡す（journal の読み）。法構造は dock/window と同じ流儀で、記憶→指示→形。
 */
export function buildAntennaPrompt(memoryContext: string): string {
  const memory = memoryContext.trim() !== "" ? memoryContext : `${MEMORY_HEADING}\n（まだ記憶がありません）`;
  return `${memory}\n\n${ANTENNA_INSTRUCTIONS}\n\n${ANTENNA_FORMAT}`;
}

export type AntennaCandidate = {
  /** アンテナ本文（✅ で place_question の本文になる・公開される候補）。 */
  text: string;
  /** 一言タイトル（空可・place_question で自動短縮される）。 */
  title: string;
  /** 誘いの一言（表示用・公開されない — 判定でなく発見を聞く文法）。 */
  why: string;
  /** 暗黙アンテナ（記憶から滲んだもの）か。 */
  implicit: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * 返答を候補へパース。fail-closed: 壊れていれば []（throw しない・沈黙でなく空）。
 * text 必須（無ければその一枚を落とす）。title/why は空既定、implicit は boolean。
 * コードフェンス・前後の散文は剥がす（第2便 parse と同流儀）。
 */
export function parseAntennaCandidates(raw: string): AntennaCandidate[] {
  const stripped = raw.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    const a = stripped.indexOf("[");
    const b = stripped.lastIndexOf("]");
    if (a >= 0 && b > a) {
      try {
        parsed = JSON.parse(stripped.slice(a, b + 1));
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out: AntennaCandidate[] = [];
  for (const c of parsed) {
    if (!isRecord(c)) continue;
    const text = typeof c.text === "string" ? c.text.trim() : "";
    if (text === "") continue; // text 必須・fail-closed
    out.push({
      text,
      title: typeof c.title === "string" ? c.title.trim() : "",
      why: typeof c.why === "string" ? c.why.trim() : "",
      implicit: c.implicit === true,
    });
  }
  return out;
}
