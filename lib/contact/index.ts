// Contact Kit v1 — public API (device-side intro packet).
//
// Owner-side, client-only composition: build an intro packet from PUBLIC board
// material, then copy it or open an owner-chosen external tool. Pure and
// network-free — nothing here POSTs a contact/message body, and there is no PX
// inbox/relay/contact route anywhere (the "持たない" line at the contact layer).

export {
  TOOL_KINDS,
  type ToolKind,
  type ContactPolicy,
  type ContactAction,
  type IntroPacketV1,
  type IntroPacketSource,
  policyRequiresInterstitial,
} from "./types.ts";

export {
  buildIntroPacket,
  introPacketText,
  publicBoardUrlFor,
  type IntroLang,
} from "./intro-packet.ts";

export {
  TOOL_LABELS,
  TOOL_USE_CASE_GUIDE,
  toolLabel,
  toolOpenUrl,
  type ToolUseCase,
} from "./tools.ts";

export { CONTACT_BOUNDARY, type ContactBoundary } from "./boundary.ts";

export {
  CONTACT_COPY,
  CONTACT_INTERSTITIAL,
  allContactCopyStrings,
  type Label,
} from "./copy.ts";
