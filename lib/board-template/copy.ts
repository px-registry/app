// Board Templates v1 — UI copy (EN/JA), held to the announcement-plan discipline.
//
// The two faces (clarifications ②): the firmness is in the gate (structural, behind
// the scenes); the surface stays LIGHT and inviting — "stand a board easily from a
// starting point". PX prescribes no board, ranks no template, and judges no
// content; a template is an example the owner freely rewrites or ignores. Forbidden
// wording is PHRASE-based (C7 — not a bare "良い" grep, to avoid false positives in
// explanatory/negated prose) and is scanned by the gate in both languages.

import { CONTACT_READINESS_KINDS, type ContactReadinessKind } from "./types.ts";
import type { CriterionKey } from "./criteria.ts";
import { ROW_SERVER_STATES, type RowServerStateKind } from "./reconcile.ts";

export interface Label {
  en: string;
  ja: string;
}

export const TEMPLATE_COPY = {
  heading: { en: "Stand a board", ja: "板を立てる" },
  sub: {
    en: "Start from an example or a blank board — it's yours to write. You decide what to collect.",
    ja: "出発点の例から、または白紙から。あなたが書きます。何を集めるかはあなたが決めます。",
  },
  templatesHeading: { en: "Starting points", ja: "出発点の例" },
  templatesNote: {
    en: "These are examples — edit them, ignore them, or start blank. They are not a prescription.",
    ja: "これは例です。自由に書き換え・無視できます。白紙でもはじめられます。",
  },
  startBlank: { en: "Start blank", ja: "白紙ではじめる" },
  startFrom: { en: "Start from this example", ja: "この例からはじめる" },
  boardTitleLabel: { en: "Board title", ja: "板のタイトル" },
  boardTitlePlaceholder: { en: "Name your board", ja: "板の名前を書く" },
  rowsHeading: { en: "What are you collecting?", ja: "何を集めますか" },
  addRow: { en: "Add a row", ja: "行を追加" },
  rowTitlePlaceholder: { en: "Write this row in your own words", ja: "この行をあなたの言葉で書く" },
  removeRow: { en: "Remove", ja: "削除" },
  contactHeading: { en: "How can people reach you?", ja: "連絡の受け方" },
  contactNote: {
    en: "Set how you'll receive contact. PX keeps no contact or message content — the destination is yours.",
    ja: "連絡の受け方を決めます。PX は連絡内容を保持しません。連絡先はあなたのものです。",
  },
  saveDraft: { en: "Save draft", ja: "下書きを保存" },
  draftBadge: { en: "Draft (only you can see it)", ja: "下書き（あなただけに見えます）" },
  // ★ S3: this state is publish-READY ON THIS DEVICE — NOT live on the public board.
  // The copy must never imply the board is on /search; making it actually public is
  // a later server step (no public-write endpoint exists in this stage).
  publicBadge: { en: "Publish-ready (on this device)", ja: "公開準備OK（この端末内）" },
  publish: { en: "Mark publish-ready", ja: "公開準備にする" },
  unpublish: { en: "Move back to draft", ja: "下書きに戻す" },
  // Empty-board prevention, said plainly and without judgment.
  needsBeforePublish: {
    en: "Before this board is publish-ready, it needs:",
    ja: "公開準備にするには、この板に次が必要です:",
  },
  // What "publish-ready" does and does NOT mean — no over-claim of being live.
  publishReadyNote: {
    en: "This prepares your draft for publishing, on this device. It is not yet on the public board — appearing there is a later step (a server publish) that isn't wired in this stage.",
    ja: "これは端末内の下書きを公開用に整えます。まだ public board には出ていません。実際に出すにはサーバー公開（次の段階）が必要で、この段階ではまだ繋がっていません。",
  },
} as const;

// ── UI Wiring v0: server publish/unpublish + per-row reconciliation copy ─────────
//
// Plain, non-judgmental, and HONEST about state — "server-confirmed only". No copy
// here claims a board is ranked/recommended/good (held to the same forbidden-phrase
// gate as the rest of this module).
export const WIRING_COPY = {
  publishToBoard: { en: "Publish to the board", ja: "公開する" },
  publishing: { en: "Publishing…", ja: "公開中…" },
  unpublishRow: { en: "Unpublish", ja: "取り下げる" },
  unpublishBoard: { en: "Take the whole board down", ja: "板ごと取り下げる" },
  signInToPublish: {
    en: "Sign in to publish your board to the public board.",
    ja: "板を公開するにはサインインしてください。",
  },
  signInLink: { en: "Sign in", ja: "サインイン" },
  publishedOk: {
    en: "Published. Your rows are on the public board.",
    ja: "公開しました。行が public board に出ています。",
  },
  publishFailed: {
    en: "Publish failed — nothing was published. Please review and try again.",
    ja: "公開に失敗しました。何も公開されていません。内容を確認して再試行してください。",
  },
  unpublishFailed: {
    en: "Could not unpublish this row. It is unchanged on the server.",
    ja: "この行を取り下げできませんでした。サーバー上は変わっていません。",
  },
  notYourRow: {
    en: "This row belongs to another owner — you cannot unpublish it.",
    ja: "この行は別の所有者のものです。取り下げできません。",
  },
  // MF2 — the most dangerous case, said plainly.
  unknownResult: {
    en: "We could not confirm the publish state. Re-running may create a duplicate — reload /board to check, and unpublish any extra row.",
    ja: "公開状態を確認できませんでした。再実行すると重複する可能性があります。/board を再読み込みして確認し、余分な行は取り下げてください。",
  },
  // MF4 — published row edited locally.
  editsNotPublishedNote: {
    en: "Edited on this device — not yet on the server. To reflect it: unpublish, edit, then publish again.",
    ja: "この端末で編集済み（サーバー未反映）。反映するには、取り下げ→編集→再公開してください。",
  },
} as const;

/** Per-row state chip labels — honest, neutral; never a ranking/quality word. */
export const ROW_STATE_LABELS: Record<RowServerStateKind, Label> = {
  local: { en: "Draft (this device)", ja: "下書き（この端末）" },
  public: { en: "On the board", ja: "公開中" },
  "local-edits-not-published": { en: "Edited — not published", ja: "編集あり（未公開）" },
  retired: { en: "Taken down", ja: "取り下げ済" },
  unknown: { en: "Unconfirmed", ja: "未確認" },
};

/** The one-line reason a structural criterion is unmet — existence/count, no verdict. */
export const CRITERION_COPY: Record<CriterionKey, Label> = {
  title: { en: "a board title", ja: "板のタイトル" },
  row: { en: "at least one row", ja: "1つ以上の行" },
  contact: { en: "a way to be contacted", ja: "連絡の受け方" },
};

/** Labels for the contact-readiness kinds (C2). Owner chooses; none is "best". */
export const CONTACT_READINESS_LABELS: Record<ContactReadinessKind, Label> = {
  manual_copy: { en: "I'll hand out an intro myself", ja: "紹介文を自分で渡す" },
  public_external_link: { en: "A public external link I run", ja: "自分の外部リンク（公開）" },
  owner_provided_limited_external_invite: {
    en: "A limited external invite I provide",
    ja: "自分が用意する外部の限定招待",
  },
};

/** Every Board Templates public copy string — scanned by the forbidden-phrase gate. */
export function allBoardTemplateCopyStrings(): string[] {
  const out: string[] = [];
  for (const v of Object.values(TEMPLATE_COPY)) out.push(v.en, v.ja);
  for (const v of Object.values(WIRING_COPY)) out.push(v.en, v.ja);
  for (const k of ROW_SERVER_STATES) out.push(ROW_STATE_LABELS[k].en, ROW_STATE_LABELS[k].ja);
  for (const v of Object.values(CRITERION_COPY)) out.push(v.en, v.ja);
  for (const k of CONTACT_READINESS_KINDS) out.push(CONTACT_READINESS_LABELS[k].en, CONTACT_READINESS_LABELS[k].ja);
  return out;
}
