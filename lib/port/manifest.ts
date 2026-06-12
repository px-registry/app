// R2 GOAL — チャットポートの law/manifest 配布（spec §12 Tool Contract の port 版）。
//
// 「あなたのAI」が部屋に入るとき最初に読む一枚。law は lib/rig の正本を直 import —
// 写しを作らない（drift の余地を構造で消す。rig-gates が law 本文を pin している）。
//
// 定数 forbidden は PX 境界のみ（§12 整理規則 v0.8）: pxRanking／successFee／
// storeCloudTranscriptOnPx／private の対外開示。owner↔agent 間の操作はすべて
// 二態（owner確認既定／明示委任）＋出自 — ここに定数禁止は置かない。

import { RIG_LAW } from "../rig/rig.ts";

export const PORT_SERVER_NAME = "px-meet-port";
export const PORT_SERVER_VERSION = "0.1.0";

/** 【出会いの法】を law 正本から組む — buildOwnerPrompt の law ブロックと同じ形。 */
export function buildLawText(): string {
  return ["【出会いの法】", ...RIG_LAW.rules.map((r, i) => `${i + 1}. ${r}`), RIG_LAW.output].join(
    "\n",
  );
}

/** PX 境界の定数 forbidden（§12 — これだけが定数。他はすべて二態＋出自）。 */
export const PORT_FORBIDDEN = Object.freeze([
  "pxRanking",
  "successFee",
  "storeCloudTranscriptOnPx",
  "privateDisclosure",
]) as readonly string[];

// 見回りの作法 — チャット側 LLM への声がけ（owner の側に立つ AI への指針）。
const PATROL_GUIDE = [
  "【見回りの作法】",
  "1. まず law（この manifest と一緒に届く【出会いの法】）を読む。提案はすべて法に従う。",
  "2. read_candidates で公開候補プールを読む。並びは到着順 — 順位の意味はない。",
  "3. owner についてあなたが知っていること（会話・あなた自身の記憶）を grounding に使う。owner の private な事柄は提案本文に引用しない。",
  "4. 提案は法 rule 9 の3行の形で、各提案に根拠の候補項目（itemRef）を basisItemId として添える。示せない提案は出さない。",
  "5. 良いものが無ければ「今日は無い」と正直に伝える。",
  "6. 外へ出る操作（アンテナを立てる・話してみる・トークの下書きを渡す）は、必ず owner の確認を得てから。pull 原則 — 頼まれた時だけ動く。PX から押し通知は来ない。",
].join("\n");

export type PortManifest = {
  name: string;
  version: string;
  contract: {
    readable: readonly string[];
    actions: { draft: string; outbound: string };
    forbidden: readonly string[];
  };
  pull: string;
  honesty: readonly string[];
  patrol: string;
};

export function buildPortManifest(): PortManifest {
  return {
    name: PORT_SERVER_NAME,
    version: PORT_SERVER_VERSION,
    contract: {
      readable: [
        "公開候補プール（全参加者が自分で公開した項目のみ）",
        "自分宛の edge（届いた・送った話してみる）と状態",
        "自分のアンテナの今日の気配（読まれた回数 — 数だけ）",
        "自分宛の封書の件数（中身は端末でだけ開く — ここでは読めない）",
        "law と この manifest",
      ],
      actions: {
        draft: "下書きは自由 — 下書きは常に owner のもので、ここから実行される操作は存在しない。",
        outbound:
          "外へ出る操作（place_question / send_signal）は owner の確認（ツール承認）を経て実行される。すべて出自つき。",
      },
      forbidden: PORT_FORBIDDEN,
    },
    pull: "頼まれた時だけ動く。PX はあなたを呼び出さない。",
    honesty: [
      "PX は AI を実行しない — いま読んでいるあなた（チャットの AI）が owner の AI です。",
      "PX はこの会話を保管しない。読み書きの内容はあなたと owner の間にだけ残る。",
      "トーク（mutual 後の文通）の本文は E2EE — PX もこのポートも平文を受け取らない。",
    ],
    patrol: PATROL_GUIDE,
  };
}
