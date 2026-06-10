// R1.5 meet memory — owner-held substrate (OWNER-LOCAL, Stage B lineage).
//
// Adopts the Stage B owner-memory precedent (lib/owner-memory, c2a7d90) for the
// R1.5 rig memory: the memory body lives in the owner's browser (IndexedDB),
// never on a PX server. PX is memory-blind. STOP #2 decision: hybrid — durable
// owner-local store + export/import backup (the Stage B module already carried
// export/delete/clear; R1.5 adds import).
//
// Entries are TYPED by kind (closed set), owner-authored only:
//   rig_item — one have/want/avoid/memory item (the rig core's RigMemoryItemV1,
//              verbatim — `private` is an explicit boolean, fail-closed upstream)
//   question — 今日の問い (one logical instance, upserted)
//   profile  — owner-chosen public display name (the ownerRef shown when items
//              are published; never a raw internal id)
//
// AI proposals are NOT memory: received proposals live on a separate shelf
// (never validated into this store), so AI output can never compound into the
// SELF grounding block. The validator refuses any non-owner provenance.

import type { RigMemoryItemV1 } from "../rig/rig.ts";

/** How an entry came to be. AI-authored facts are REFUSED by the validator. */
export type MeetProvenance = "owner_written" | "owner_imported_confirmed";

export const MEET_ENTRY_KINDS = ["rig_item", "question", "profile", "mask_list"] as const;
export type MeetEntryKind = (typeof MEET_ENTRY_KINDS)[number];

/**
 * 第2便 B — a stored rig item may carry 候補に出すときの書き方: optional public
 * phrasings (固有名を伏せた言い方) used INSTEAD of title/text whenever the item
 * leaves the device (pool projection → other participants' prompts). The
 * private body stays for the owner's own SELF grounding. The rig core type is
 * untouched: these fields live in the meet-memory layer only, and the frozen
 * buildPublicPool explicit-pick means they can never ride along unprojected.
 */
export type MeetRigItemV1 = RigMemoryItemV1 & {
  publicTitle?: string;
  publicText?: string;
};

export type QuestionValue = { text: string };
/** 第7便 B: intro = ひとこと紹介 (optional one-liner; published with the projection). */
export type ProfileValue = { displayName: string; intro?: string };
/**
 * 補遺 E — 伏せたい言葉 (one owner-wide list, device-local). Words the owner
 * never wants in an OUTGOING text; the deterministic mask check warns when one
 * survives in a public view. Model-side masking is best-effort — this list is
 * what the structure verifies against.
 */
export type MaskListValue = { words: string[] };

type EntryBase = {
  entryId: string;
  provenance: MeetProvenance;
  createdAt: string;
  updatedAt: string;
};

export type MeetMemoryEntryV1 = EntryBase &
  (
    | { kind: "rig_item"; value: MeetRigItemV1 }
    | { kind: "question"; value: QuestionValue }
    | { kind: "profile"; value: ProfileValue }
    | { kind: "mask_list"; value: MaskListValue }
  );

/** A new entry before id/timestamps — what a caller submits. */
export type NewMeetEntry =
  | { kind: "rig_item"; provenance: MeetProvenance; value: MeetRigItemV1 }
  | { kind: "question"; provenance: MeetProvenance; value: QuestionValue }
  | { kind: "profile"; provenance: MeetProvenance; value: ProfileValue }
  | { kind: "mask_list"; provenance: MeetProvenance; value: MaskListValue };
