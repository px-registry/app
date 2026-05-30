// Contact Kit v1 — tool chooser (a use-case GUIDE, never a ranking; C5).
//
// PX does not rank, recommend, or rate tools. It offers use-case examples; the
// owner chooses. The guide encodes the announcement-plan posture: Signal is the
// one-to-one privacy default (usernames, no phone exposure) — Telegram is NOT a
// one-to-one privacy default; LINE is OpenChat (approval/invite), not a direct
// number; SimpleX (no user ID) is the advanced-privacy option closest to PX's
// philosophy. There is no email/mailto tool (contact is in-app; C4).

import { TOOL_KINDS } from "./types.ts";
import type { ToolKind } from "./types.ts";

export const TOOL_LABELS: Record<ToolKind, string> = {
  signal: "Signal",
  telegram: "Telegram",
  discord: "Discord",
  line_openchat: "LINE OpenChat",
  instagram: "Instagram",
  slack: "Slack",
  simplex: "SimpleX",
  other: "Other",
};

export interface ToolUseCase {
  key: string;
  en: string;
  ja: string;
  /** Example tools for this use case (owner chooses; order is illustrative). */
  tools: ToolKind[];
}

export const TOOL_USE_CASE_GUIDE: ToolUseCase[] = [
  { key: "one_to_one_privacy", en: "One-to-one · privacy", ja: "1対1・プライバシー", tools: ["signal", "simplex"] },
  { key: "one_to_one_creator", en: "One-to-one · creator", ja: "1対1・creator", tools: ["instagram", "telegram", "signal"] },
  { key: "one_to_many_casual", en: "One-to-many · casual", ja: "1対多・カジュアル", tools: ["discord", "line_openchat"] },
  { key: "one_to_many_work", en: "One-to-many · work", ja: "1対多・仕事", tools: ["slack", "discord", "line_openchat"] },
  { key: "privacy_advanced", en: "Privacy · advanced", ja: "高プライバシー", tools: ["simplex", "signal"] },
];

// Each tool's PUBLIC entry point — opened so the owner can paste the intro packet
// into a conversation they choose. All http/https; "other" has none (copy only).
const TOOL_OPEN_URLS: Record<ToolKind, string | null> = {
  signal: "https://signal.org/",
  telegram: "https://web.telegram.org/",
  discord: "https://discord.com/app",
  line_openchat: "https://openchat.line.me/",
  instagram: "https://www.instagram.com/",
  slack: "https://slack.com/",
  simplex: "https://simplex.chat/",
  other: null,
};

export function toolLabel(tool: ToolKind): string {
  return TOOL_LABELS[tool];
}

/** The tool's public app/web entry, or null (just copy the packet). */
export function toolOpenUrl(tool: ToolKind): string | null {
  return TOOL_OPEN_URLS[tool];
}

export { TOOL_KINDS };
