// Contact Kit v1 — intro packet builder (device-side, public-only).
//
// Pure and total. Takes ONLY a record id + public title and a board origin, and
// returns the packet. There is no parameter through which owner_handle, session,
// memoryRef, a proposal reason, a saved_filter query, an interest label, a note,
// counterparty data, or any PII could enter (C3). The publicBoardUrl is the plain
// public detail URL — no query carrying memory/session/proposal ids.

import type { IntroPacketSource, IntroPacketV1 } from "./types.ts";

export type IntroLang = "en" | "ja";

/** The fixed boilerplate (announcement plan). PX settles/brokers/recommends nothing. */
function boilerplateFor(lang: IntroLang, recordTitle: string, publicBoardUrl: string): string {
  if (lang === "ja") {
    return [
      "PX Board から来ました。この募集/提供について連絡します。",
      `Board: ${recordTitle} ${publicBoardUrl}`,
      "PX は決済・仲介・推薦をしません。連絡と判断は当事者同士で行います。",
    ].join("\n");
  }
  return [
    "Reaching out from the PX Board about this listing.",
    `Board: ${recordTitle} ${publicBoardUrl}`,
    "PX does not handle payment, brokering, or recommendation. Contact and decisions are between the parties.",
  ].join("\n");
}

/**
 * The public detail URL for a record — `<origin>/board/?id=<recordId>`. recordId
 * is public; no owner/session/memory/proposal/query is ever appended.
 */
export function publicBoardUrlFor(origin: string, recordId: string): string {
  return `${origin.replace(/\/+$/, "")}/board/?id=${encodeURIComponent(recordId)}`;
}

/** Build the intro packet from public material only. */
export function buildIntroPacket(
  source: IntroPacketSource,
  origin: string,
  lang: IntroLang = "ja",
): IntroPacketV1 {
  const publicBoardUrl = publicBoardUrlFor(origin, source.recordId);
  return {
    recordTitle: source.title,
    publicBoardUrl,
    boilerplate: boilerplateFor(lang, source.title, publicBoardUrl),
  };
}

/** The copyable text of a packet (the boilerplate already carries title + url). */
export function introPacketText(packet: IntroPacketV1): string {
  return packet.boilerplate;
}
