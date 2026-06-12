// R1.5 第2便 B — 公開用の書き方 (the outbound phrasing swap). The owner can
// give an item a public way of saying it (固有名を伏せた言い方); whenever the
// item LEAVES the device — pool projection, hence other participants' prompts —
// the public phrasing substitutes for title/text. The private body never goes
// out, but keeps grounding the owner's OWN prompt (SELF channel uses the raw
// items, not this view).
//
// Pure assembly-layer code: the frozen rig core is untouched — callers hand
// buildPublicPool / buildOutboundProjection these views instead of raw items.

import type { RigMemoryItemV1 } from "../rig/rig.ts";
import type { MeetRigItemV1 } from "./types.ts";

/** Is a public phrasing set (and thus what would leave the device)? */
export function hasPublicVariant(item: MeetRigItemV1): boolean {
  return (item.publicTitle ?? "").trim() !== "" || (item.publicText ?? "").trim() !== "";
}

/**
 * The item as it may leave the device. EXPLICIT PICK (rig-core precedent): the
 * result carries only the five rig fields — publicTitle/publicText themselves
 * never ride along — and an empty/whitespace phrasing falls back to the
 * original field (a half-set 書き方 must not blank a published item).
 */
export function toPublicView(item: MeetRigItemV1): RigMemoryItemV1 {
  const pubTitle = (item.publicTitle ?? "").trim();
  const pubText = (item.publicText ?? "").trim();
  return {
    kind: item.kind,
    title: pubTitle !== "" ? pubTitle : item.title,
    text: pubText !== "" ? pubText : item.text,
    tags: [...item.tags],
    private: item.private,
  };
}
