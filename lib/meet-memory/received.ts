// R1.5 — the received-proposals shelf (owner-local, browser only).
//
// A SEPARATE shelf from the memory substrate, deliberately: AI output lands
// here and ONLY here. This module must never import the memory store/validator
// (gate-pinned) and nothing reads this shelf into a SELF grounding block — so
// AI output can never compound into future prompts. Readings (面白い etc.) are
// the owner's private marks on a card; they live on the entry and are shared
// only through the explicitly test-disclosed facilitator lane.

import type { KeyedBackend } from "./backend.ts";
import type { ProposalCard } from "../meet-ai/prompt.ts";

export type ReadingV1 = { marks: string[]; note: string };

export type ReceivedProposalV1 = {
  entryId: string;
  createdAt: string;
  /** 今日の問い at generation time (may be ""). */
  question: string;
  /** Which model produced it — product label, shown for honesty. */
  modelLabel: string;
  /** The model's reply, verbatim. Kept even when cards parsed cleanly. */
  raw: string;
  /** Parsed cards ([] when the reply didn't parse — raw is still shown). */
  cards: ProposalCard[];
  /** ownerRef → participantRef at generation time (for the 話してみる signal). */
  refs: Record<string, string>;
  /**
   * 第7便 C: prompt-local ref → the served public item it pointed at, captured
   * at generation time. The display gate requires each card's basisItemId to
   * resolve here; the 「相手の候補から」 fold shows exactly this one item.
   * Absent on pre-第7便 entries (they keep the to-only gate).
   * R2 0010: itemRef = the served item's stable public alias (absent on pre-R2
   * entries) — what T1 sends as the edge's basis_item_ref.
   */
  basisItems?: Record<string, { ownerRef: string; title: string; text: string; itemRef?: string }>;
  /** ownerRef → ひとこと紹介 at generation time (may be ""). 第7便 B. */
  intros?: Record<string, string>;
  /**
   * 第9便 A/B: how this entry came to be. "patrol" = 見回り (the automatic
   * run on opening home — still the owner's device and key, never PX).
   */
  via?: "manual" | "patrol";
  /** patrol provenance: the placed question (title) that drove the run. */
  patrolQuestion?: string;
  /**
   * 第9便 A: a NON-generation ending recorded as an honest entry — the
   * outcome lives at the top of AIが見つけた提案, not as a side note.
   * Absent = a normal generation (the entryFace three faces apply).
   */
  outcome?: "pool-empty" | "error";
  errorCode?: string;
  /** Non-blocking: the reply may echo the owner's own private text. */
  echoFlag: boolean;
  /** Owner's readings per card index. */
  readings: Record<number, ReadingV1>;
};

function genId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `recv_${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export class ReceivedStore {
  private backend: KeyedBackend<ReceivedProposalV1>;
  private now: () => string;

  constructor(backend: KeyedBackend<ReceivedProposalV1>, opts?: { now?: () => string }) {
    this.backend = backend;
    this.now = opts?.now ?? (() => new Date().toISOString());
  }

  /** Arrival order — by receive time. A TIME order, never a quality measure. */
  async list(): Promise<ReceivedProposalV1[]> {
    const all = await this.backend.list();
    return all.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  }

  async add(input: Omit<ReceivedProposalV1, "entryId" | "createdAt" | "readings">): Promise<ReceivedProposalV1> {
    const entry: ReceivedProposalV1 = {
      ...input,
      entryId: genId(),
      createdAt: this.now(),
      readings: {},
    };
    await this.backend.put(entry);
    return entry;
  }

  async setReading(entryId: string, cardIndex: number, reading: ReadingV1): Promise<void> {
    const e = await this.backend.get(entryId);
    if (!e) return;
    await this.backend.put({ ...e, readings: { ...e.readings, [cardIndex]: reading } });
  }

  remove(entryId: string): Promise<void> {
    return this.backend.remove(entryId);
  }

  clear(): Promise<void> {
    return this.backend.clear();
  }
}
