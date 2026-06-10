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

// ── signal / contact / inbox / facilitator-log lanes ───────────────────────────

export type InboxIncoming = {
  fromRef: string;
  fromName: string;
  anchor: string;
  createdAt: string;
  mutual: boolean;
};
export type InboxData = {
  incoming: InboxIncoming[];
  outgoing: Array<{ toRef: string; mutual: boolean }>;
  notes: Array<{ fromRef: string; note: string }>;
  myNotes: Array<{ peerRef: string; note: string }>;
};

async function postJson(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

export async function sendSignal(input: {
  ownerToken: string;
  toRef: string;
  fromName: string;
  anchor: string;
}): Promise<NetResult<{ mutual: boolean }>> {
  try {
    const { body } = await postJson("/api/meet/signal", input);
    if (!isRecord(body) || body.ok !== true) {
      return { ok: false, error: isRecord(body) && typeof body.error === "string" ? body.error : "signal_failed" };
    }
    return { ok: true, mutual: body.mutual === true };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function fetchInbox(ownerToken: string): Promise<NetResult<InboxData>> {
  try {
    const { body } = await postJson("/api/meet/inbox", { ownerToken });
    if (!isRecord(body) || body.ok !== true) return { ok: false, error: "inbox_failed" };
    const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
    return {
      ok: true,
      incoming: arr(body.incoming).filter(isRecord).flatMap((r) =>
        isParticipantRef(r.fromRef) && typeof r.fromName === "string"
          ? [{
              fromRef: r.fromRef,
              fromName: r.fromName,
              anchor: typeof r.anchor === "string" ? r.anchor : "",
              createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
              mutual: r.mutual === true,
            }]
          : [],
      ),
      outgoing: arr(body.outgoing).filter(isRecord).flatMap((r) =>
        isParticipantRef(r.toRef) ? [{ toRef: r.toRef, mutual: r.mutual === true }] : [],
      ),
      notes: arr(body.notes).filter(isRecord).flatMap((r) =>
        isParticipantRef(r.fromRef) && typeof r.note === "string"
          ? [{ fromRef: r.fromRef, note: r.note }]
          : [],
      ),
      myNotes: arr(body.myNotes).filter(isRecord).flatMap((r) =>
        isParticipantRef(r.peerRef) && typeof r.note === "string"
          ? [{ peerRef: r.peerRef, note: r.note }]
          : [],
      ),
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function saveContactNote(input: {
  ownerToken: string;
  peerRef: string;
  note: string;
}): Promise<NetResult<Record<never, never>>> {
  try {
    const { body } = await postJson("/api/meet/contact", input);
    if (!isRecord(body) || body.ok !== true) {
      return { ok: false, error: isRecord(body) && typeof body.error === "string" ? body.error : "contact_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Test-disclosed facilitator lane (the app says so next to the action). */
export async function submitLog(input: {
  ownerToken: string;
  clientEntryId: string;
  displayName: string;
  question: string;
  proposalText: string;
  reading: string;
}): Promise<NetResult<Record<never, never>>> {
  try {
    const { body } = await postJson("/api/meet/log", input);
    if (!isRecord(body) || body.ok !== true) return { ok: false, error: "log_failed" };
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function fetchHostView(
  hostKey: string,
): Promise<NetResult<{ logs: unknown[]; signals: unknown[]; pool: unknown[] }>> {
  try {
    const { body } = await postJson("/api/meet/host", { hostKey });
    if (!isRecord(body) || body.ok !== true) return { ok: false, error: "host_key" };
    return {
      ok: true,
      logs: Array.isArray(body.logs) ? body.logs : [],
      signals: Array.isArray(body.signals) ? body.signals : [],
      pool: Array.isArray(body.pool) ? body.pool : [],
    };
  } catch {
    return { ok: false, error: "network" };
  }
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
