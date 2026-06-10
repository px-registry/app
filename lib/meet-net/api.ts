// R1.5 — the meet network client. The ONLY file in lib/meet-net that calls
// fetch (gate-pinned). Same-origin Pages Functions only — no third-party host,
// no AI provider here (browser-direct AI lives in lib/meet-ai).
//
// Responses are parsed FAIL-CLOSED: a malformed body degrades to a typed error
// or drops the malformed row — never throws into the UI.

import type { OutboundPoolItem } from "./projection.ts";
import { isParticipantRef } from "./ref.ts";

export type NetResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/** One pool row as served to every participant — display name + content only. */
export type PoolItemPublic = {
  participantRef: string;
  ownerRef: string;
  kind: string;
  title: string;
  text: string;
  tags: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function publishProjection(input: {
  ownerToken: string;
  displayName: string;
  items: OutboundPoolItem[];
}): Promise<NetResult<{ count: number; participantRef: string }>> {
  try {
    const res = await fetch("/api/meet/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok || !isRecord(body) || body.ok !== true) {
      const error = isRecord(body) && typeof body.error === "string" ? body.error : "publish_failed";
      return { ok: false, error };
    }
    const count = typeof body.count === "number" ? body.count : 0;
    const participantRef = isParticipantRef(body.participantRef) ? body.participantRef : "";
    return { ok: true, count, participantRef };
  } catch {
    return { ok: false, error: "network" };
  }
}

function parsePoolItem(raw: unknown): PoolItemPublic | null {
  if (!isRecord(raw)) return null;
  if (!isParticipantRef(raw.participantRef)) return null;
  if (typeof raw.ownerRef !== "string" || raw.ownerRef.trim() === "") return null;
  if (typeof raw.kind !== "string" || typeof raw.title !== "string" || typeof raw.text !== "string") {
    return null;
  }
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === "string")
    : [];
  return {
    participantRef: raw.participantRef,
    ownerRef: raw.ownerRef,
    kind: raw.kind,
    title: raw.title,
    text: raw.text,
    tags,
  };
}

export async function fetchPool(
  myRef: string,
): Promise<NetResult<{ items: PoolItemPublic[] }>> {
  try {
    const res = await fetch(`/api/meet/pool?me=${encodeURIComponent(myRef)}`);
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok || !isRecord(body) || body.ok !== true || !Array.isArray(body.items)) {
      return { ok: false, error: "pool_failed" };
    }
    const items: PoolItemPublic[] = [];
    for (const raw of body.items) {
      const it = parsePoolItem(raw);
      if (it !== null && it.participantRef !== myRef) items.push(it); // self never proposed
    }
    return { ok: true, items };
  } catch {
    return { ok: false, error: "network" };
  }
}
