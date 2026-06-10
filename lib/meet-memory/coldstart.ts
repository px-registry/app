// R1.5 — cold-start prompt the tester copies into their own everyday LLM.
//
// ★ DRAFT. The canonical text is px-coldstart-prompt.md (Hiroto から渡される
// 正本) — swap this constant verbatim when received. The output contract
// (JSON array of {kind,title,text,tags,private}) is what ./intake.ts parses;
// keep the two in step if the canonical text changes the shape.
//
// 迷ったら private: true — the prompt itself repeats the fail-closed default.

export const COLDSTART_PROMPT = `あなたは、私のことをよく知っているAIです。これまでの会話の記憶（無ければ、これから私に聞いて）をもとに、「私」を次の4種類の項目に書き出してください。

- have：私が持っているもの・できること（場所・道具・技能・時間・人のつながり）
- want：私が欲しいもの・やってみたいこと
- avoid：私が避けたいこと・苦手なこと
- memory：私という人を形づくっている記憶・背景

各項目はこの形で：
- title：一言タイトル
- text：本文1〜2行。具体的に（固有名詞や数字があると良い）
- tags：短いタグを0〜3個（公開されてもよい言葉だけ）
- private：ほかの参加者に見られたくないなら true、公開してよいなら false。迷ったら true

合計8〜15個ほど。私の記憶が足りなければ、先に私へ質問して埋めてください。

出力は、次の形のJSONだけにしてください（前後に説明文を付けない）：
[
  { "kind": "have", "title": "…", "text": "…", "tags": ["…"], "private": false },
  { "kind": "memory", "title": "…", "text": "…", "tags": [], "private": true }
]`;

/** Shown next to the copy button — what happens to the paste. */
export const COLDSTART_NOTE =
  "出てきたJSONをそのまま下に貼ってください。取り込んだあと、一つずつ確認してから確定します。";
