// Contact Kit v1 — device-side intro packet (PX holds no contact/message body).
//
// The "持たない" line carried to the contact layer: PX never generates, stores,
// relays, proxies, messages through, or verifies a contact. The owner sees a
// candidate, taps "contact", and PX assembles an intro packet ON THE DEVICE from
// PUBLIC board material only — then the owner copies it / opens an external tool.
// No server route, no inbox, no relay, no contact table.
//
// IntroPacketV1 is public-only BY CONSTRUCTION: its source type carries only a
// record id + public title, so no owner_handle / memory / proposal / PII can
// reach it (C3 — B/B+1 memory-blindness extended to contact).
//
// Leaf module: relative imports only, no React, no network.

/** External tools the owner may choose. No email/mailto — contact is in-app (C4). */
export const TOOL_KINDS = [
  "signal",
  "telegram",
  "discord",
  "line_openchat",
  "instagram",
  "slack",
  "simplex",
  "other",
] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

/**
 * How a record's contact is reached. owner_approved_external is an OWNER-SIDE
 * ritual only — PX builds no server-side approval queue / unlock / inbox (C2).
 */
export type ContactPolicy =
  | "public_external_link"
  | "owner_approved_external"
  | "manual_copy"
  | "owner_provided_limited_external_invite";

/** The three device-side actions. None touches a PX server. */
export type ContactAction =
  | { kind: "copyIntroPacket" }
  | { kind: "openExternalActionUrl"; url: string }
  | { kind: "openToolTemplate"; tool: ToolKind };

/**
 * The intro packet — PUBLIC board material + a fixed boilerplate, nothing else.
 * recordTitle/publicBoardUrl come from the public board record; boilerplate is the
 * fixed statement that PX does not settle/broker/recommend.
 */
export interface IntroPacketV1 {
  recordTitle: string;
  publicBoardUrl: string;
  boilerplate: string;
}

/** The only input the packet builder accepts — public fields, nothing private. */
export interface IntroPacketSource {
  recordId: string;
  title: string;
}

/** A policy whose external link is an access key — show the interstitial (C6). */
export function policyRequiresInterstitial(policy: ContactPolicy): boolean {
  return policy === "public_external_link" || policy === "owner_provided_limited_external_invite";
}
