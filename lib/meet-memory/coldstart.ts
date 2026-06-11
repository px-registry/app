// R1.5 — cold-start prompt the tester copies into their own everyday LLM.
//
// ★ CANONICAL — px-coldstart-prompt-v2.md（Hiroto 正本, JSON 出力版, fix1 で
// 差し替え済み）＋ c12-6 固有名詞ガード（2026-06-11 Hiroto 裁定文・verbatim 追記
// = v2.1 相当）. The body below is VERBATIM from the 正本; do not edit the
// wording here — a new version is a new 正本. The output contract (JSON array
// of {kind,title,text,tags,private}) is what ./intake.ts parses; keep the two
// in step if a future 正本 changes the shape.
//
// 迷ったら private: true — the prompt itself repeats the fail-closed default.
// c12-6 は既定の言い回し指針であり禁止法ではない — 取り込み後の一件ずつ確認
// フローが従来どおり最終ゲート。

export const COLDSTART_PROMPT = `あなたは私の「最初の記憶セット」を作る手伝いをして。これは **PX** という場で、**私自身の AI が、私の記憶をもとに「意外だけど腑に落ちる」つながりを見つける**ための素材です。PX はこれを持ちません——私のもの。あなたは下書きを出すだけで、決めるのは私です。

あなたが私について知っていること（過去のやり取り）＋ 末尾の追加説明 をもとに、次の JSON だけを出力して。前置き・後書き・コードブロック記号は不要、JSON 本体のみ。

\`\`\`
[
  { "kind": "have",   "title": "一言タイトル", "text": "本文1〜2行・具体の錨を一つ", "tags": ["短い語"], "private": false },
  { "kind": "want",   "title": "…", "text": "…", "tags": ["…"], "private": false },
  { "kind": "avoid",  "title": "…", "text": "…", "tags": [], "private": true },
  { "kind": "memory", "title": "…", "text": "…", "tags": [], "private": true }
]
\`\`\`

**kind の意味**
- "have"：私が持っている・できる・提供できるもの（仕事だけでなく、趣味・関心・道具・場所・経験も）
- "want"：やってみたい・届きたい・組みたいもの
- "avoid"：関わりたくない・外に出したくない境界
- "memory"：私を形づくる出来事・文脈（短く）

**大事なこと**
- **異ジャンルを混ぜて**。本業だけでなく、私の違う面（趣味・昔やっていたこと・私的な関心）も出して。意外なつながりはそこから生まれる。
- **盛らない・捏造しない**。本当に私が持つ／求めるものだけ。曖昧なら省く。
- tags は短い語を 1〜3 個（記号・句読点なし。例「木工」「夜型」「教育」）。
- 会社名・店名・人名・取引先名などの固有名詞は、そのまま書かず、内容が伝わる言い換えにしてください（例:「◯◯株式会社との取引」→「飲食チェーンとの取引」）。あなたの呼び名や連絡先は項目に含めないでください。
- センシティブなものは \`"private": true\`（avoid と memory は基本 true 推奨。最終判断は私がアプリ内でする）。
- 12〜20 枚くらい。薄いカードは出さない。

---

**追加説明（私から）**：
（ここに自己紹介や補足を書く。LLM が私をよく知っているなら空でも可）`;

/** Shown next to the copy button — what happens to the paste. */
export const COLDSTART_NOTE =
  "出てきたJSONをそのまま下に貼ってください。取り込んだあと、一つずつ確認してから確定します。";
