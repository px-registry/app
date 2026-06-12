// R2 GOAL — チャットポートの道具（MCP tools）。定義＝閉じた集合。
//
// P0（read-only）: get_law_and_manifest / read_candidates / read_inbox
// P1（書き込み）: place_question（アンテナを立てる）/ send_signal（話してみる）/
//                 draft_talk_link（トークの下書きリンク — 平文はポートを通らない）
//
// 道具の説明文はチャットの承認 UI に出る — owner が読む文として書く（命名は
// spec §14 の確定写像: アンテナ・トーク・ノート。tool id は spec §12 の内部名）。
//
// schema の数値上限は functions/_meet.ts の caps の鏡（port-gates.test.ts が
// 等値を pin — drift したらテストが赤になる）。

export const PORT_CAP_QUESTION = 300; // = MAX_QUESTION
export const PORT_CAP_TITLE = 120; // = MAX_TITLE
export const PORT_CAP_NAME = 30; // = MAX_NAME
export const PORT_CAP_ANCHOR = 80; // = MAX_ANCHOR

export type PortToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

export const PORT_TOOLS: readonly PortToolDef[] = Object.freeze([
  {
    name: "get_law_and_manifest",
    description:
      "出会いの法（提案の書き方の法）と、このポートの契約（読めるもの・できること・できないこと・見回りの作法）を受け取る。最初に一度読む。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "read_candidates",
    description:
      "公開候補プールを読む（全参加者が自分で公開した項目だけ。並びは到着順 — 順位の意味はない）。自分が公開している項目も mine として返る。見回りの材料。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "read_inbox",
    description:
      "自分宛の状態を読む: 届いた・送った「話してみる」（edge）、アンテナの今日の気配（読まれた数）、封書の件数（中身は端末でだけ開く）。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "place_question",
    description:
      "アンテナを立てる（公開ボードに、探していることを一枚置く）。owner が確認してから使う。立てたアンテナは公開され、他の参加者のAIに読まれる。",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          maxLength: PORT_CAP_QUESTION,
          description: "アンテナの本文（探していること・会いたい話）。公開される。",
        },
        title: {
          type: "string",
          maxLength: PORT_CAP_TITLE,
          description: "省略可 — 一言タイトル。省略時は本文から自動で短く作る。",
        },
        displayName: {
          type: "string",
          maxLength: PORT_CAP_NAME,
          description: "省略可 — 公開時の名乗り。すでにページで公開していれば不要。",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: "send_signal",
    description:
      "話してみる、を送る（候補の一枚を根拠に、その相手への接点を開く）。owner が確認してから使う。相手には次の訪問時に届く — 通知は飛ばない。",
    inputSchema: {
      type: "object",
      properties: {
        toRef: {
          type: "string",
          pattern: "^[0-9a-f]{16}$",
          description: "相手の participantRef（read_candidates の値）。",
        },
        basisItemRef: {
          type: "string",
          pattern: "^[0-9a-f]{16}$",
          description: "根拠にした相手の公開項目の itemRef（read_candidates の値）。",
        },
        anchor: {
          type: "string",
          maxLength: PORT_CAP_ANCHOR,
          description: "省略可 — 接点の一行（あなたの◯◯ × 相手の◯◯）。相手にも見える。",
        },
        fromName: {
          type: "string",
          maxLength: PORT_CAP_NAME,
          description: "省略可 — 名乗り。すでにページで公開していれば不要。",
        },
      },
      required: ["toRef", "basisItemRef"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "draft_talk_link",
    description:
      "トーク（mutual 後の文通）の下書きを owner に渡すリンクを作る。下書きの本文はこの道具に渡さない — リンクの # 以降に乗せて owner に渡す（# 以降はサーバに送られない。封緘と送信は owner の端末で行われる）。",
    inputSchema: {
      type: "object",
      properties: {
        edgeId: {
          type: "string",
          pattern: "^(edge_|r15pair_)[0-9a-f]{16,32}$",
          description: "トークルームの edgeId（read_inbox の値・mutual のもの）。",
        },
      },
      required: ["edgeId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
]) as readonly PortToolDef[];

export const PORT_TOOL_NAMES = Object.freeze(PORT_TOOLS.map((t) => t.name)) as readonly string[];
