// Contact Kit v1 — UI copy (EN/JA), held to the announcement-plan discipline.
//
// PX does not connect, match, vet, or recommend people; the owner opens an
// external tool of their choice and PX holds no contact/message body. Forbidden
// wording (recommendation / safety / matching connotations) is scanned by the
// gate, in both languages.

export interface Label {
  en: string;
  ja: string;
}

export const CONTACT_COPY = {
  heading: { en: "Contact", ja: "連絡する" },
  intro: {
    en: "PX keeps no messages, calls, or contact content. You open the external tool you choose; contact and decisions are between the parties.",
    ja: "PX はメッセージ・通話・連絡内容を保持しません。あなたが選んだ外部ツールで開きます。連絡と判断は当事者同士です。",
  },
  copyPacket: { en: "Copy intro packet", ja: "紹介文をコピー" },
  copied: { en: "Copied ✓", ja: "コピーしました ✓" },
  openExternal: { en: "Open the owner's contact", ja: "出品者の連絡先を開く" },
  toolGuide: {
    // Boundary-safe wording: the no-judgment gate forbids the token 保証 (a
    // positive guarantee). The disclaimer keeps its meaning via 審査/裏付け.
    en: "External tool examples by use case — you choose. PX does not endorse or back any tool.",
    ja: "用途に応じた外部ツール例です。あなたが選びます。PX は外部ツールを審査しません。",
  },
  noContact: { en: "This listing has no contact link.", ja: "この募集には連絡先リンクがありません。" },
} as const;

/** Interstitial shown before opening an owner-provided external link (C6). The
 *  C6 meaning is preserved; the forbidden token 保証 is replaced by 審査/裏付け
 *  (a negative disclaimer, not a positive guarantee). */
export const CONTACT_INTERSTITIAL: Label = {
  en:
    "This is an external invite link — anyone who has it can join. PX does not vet or back it. " +
    "The destination is an external service the owner runs; PX does not manage its participants, messages, payment, or handoff.",
  ja:
    "これは外部招待リンクです。知る人が参加できます。PX は審査も裏付けもしません。" +
    "リンク先は Owner が管理する外部サービスです。PX はリンク先の参加者・メッセージ・支払い・受け渡しを管理しません。",
};

/** Every Contact Kit public copy string — scanned by the forbidden-copy gate. */
export function allContactCopyStrings(): string[] {
  const out: string[] = [];
  for (const v of Object.values(CONTACT_COPY)) out.push(v.en, v.ja);
  out.push(CONTACT_INTERSTITIAL.en, CONTACT_INTERSTITIAL.ja);
  return out;
}
