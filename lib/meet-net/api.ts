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
  /** ひとこと紹介 (第7便 B) — owner-written, published with the projection; "" = unset. */
  ownerIntro: string;
  kind: string;
  title: string;
  text: string;
  tags: string[];
  /**
   * R2 0010 — the item's stable public alias (basis of an edge). Lenient at
   * PARSE time ("" when absent/odd, like basisItemId); strict at ACT time —
   * T1 refuses an empty/foreign basis.
   */
  itemRef: string;
  /** R2 0012 — ビジネス旗（素通し・読むのは AI と「相手の候補から」の一語）。 */
  business: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function publishProjection(input: {
  ownerToken: string;
  displayName: string;
  /** ひとこと紹介 — optional; "" publishes as unset. */
  intro: string;
  /** R2 0013 — E2EE 公開鍵（JWK 直列形・公開物）。"" = 同送しない。 */
  encPub: string;
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
    ownerIntro: typeof raw.ownerIntro === "string" ? raw.ownerIntro : "",
    kind: raw.kind,
    title: raw.title,
    text: raw.text,
    tags,
    itemRef: typeof raw.itemRef === "string" ? raw.itemRef : "",
    business: raw.business === true,
  };
}

// ── signal / contact / inbox / facilitator-log lanes ───────────────────────────

// R2 0010 — the inbox speaks EDGES now (期待の追従: ペア単位 mutual flag 退場).
export type EdgeState = "sent" | "mutual" | "closed";

export type InboxIncoming = {
  edgeId: string;
  fromRef: string;
  fromName: string;
  /** sender's published ひとこと紹介 ("" = unset/departed). */
  fromIntro: string;
  /** the basis item alias this edge stands on ("" only on backfill edges). */
  basisItemRef: string;
  anchor: string;
  createdAt: string;
  state: EdgeState;
  /** 便3 — true なら自分が閉じた（自分の行為は一語の表示すら要らない）。 */
  closedByMe: boolean;
  /** 便3 (0011) — 遷移元の事実: "sent" | "mutual" | ""（live 中は ""）。 */
  closedFrom: string;
  /** 便3 — 読み時導出（状態ではない）。「しばらく動きがありません。」の根拠。 */
  dormant: boolean;
};
export type InboxOutgoing = {
  edgeId: string;
  toRef: string;
  /** 0011 — 宛先の公開 pseudonym（送信時点固定・from_name と同格）。 */
  toName: string;
  basisItemRef: string;
  /** a 側 pair 面の接点の再掲に使う（送信時に固定した一行）。 */
  anchor: string;
  state: EdgeState;
  createdAt: string;
  closedByMe: boolean;
  closedFrom: string;
  dormant: boolean;
};
/** R2 GOAL（チャットポート）— 自分の公開面の写し（reverse-import の材料）。 */
export type InboxMyItem = {
  itemRef: string;
  kind: string;
  title: string;
  text: string;
  tags: string[];
  business: boolean;
};

export type InboxData = {
  incoming: InboxIncoming[];
  outgoing: InboxOutgoing[];
  notes: Array<{ fromRef: string; note: string }>;
  myNotes: Array<{ peerRef: string; note: string }>;
  /** R2 GOAL — port が立てた行を端末が取り込むための自分の公開面（additive key）。 */
  myItems: InboxMyItem[];
  /** 第9便 C — today's read-count per OWN placed question (by projection position). */
  questionReads: Array<{ position: number; count: number }>;
};

function parseEdgeState(v: unknown): EdgeState | null {
  return v === "sent" || v === "mutual" || v === "closed" ? v : null;
}

async function postJson(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** T1 — open (or honestly re-find) the edge for one 話してみる. */
export async function sendSignal(input: {
  ownerToken: string;
  toRef: string;
  fromName: string;
  /** 0011 — 宛先の公開 pseudonym（カードの宛名・送信時点で固定）。 */
  toName: string;
  anchor: string;
  edgeId: string;
  basisItemRef: string;
  /** opaque pointer into the sender's own shelf (recv entry + card index). */
  proposalPtr: string;
}): Promise<NetResult<{ edgeId: string; state: EdgeState; existing: boolean }>> {
  try {
    const { body } = await postJson("/api/meet/signal", input);
    if (!isRecord(body) || body.ok !== true) {
      return { ok: false, error: isRecord(body) && typeof body.error === "string" ? body.error : "signal_failed" };
    }
    const state = parseEdgeState(body.state);
    if (typeof body.edgeId !== "string" || state === null) {
      return { ok: false, error: "signal_failed" };
    }
    return { ok: true, edgeId: body.edgeId, state, existing: body.existing === true };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** T3/T4/T5 — a participant closes a live edge (取り下げる／閉じる). Idempotent. */
export async function sendClose(input: {
  ownerToken: string;
  edgeId: string;
}): Promise<NetResult<{ state: EdgeState; already: boolean }>> {
  try {
    const { body } = await postJson("/api/meet/close", input);
    if (!isRecord(body) || body.ok !== true) {
      return { ok: false, error: isRecord(body) && typeof body.error === "string" ? body.error : "close_failed" };
    }
    const state = parseEdgeState(body.state);
    if (state === null) return { ok: false, error: "close_failed" };
    return { ok: true, state, already: body.already === true };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** T2 — the addressee answers the edge they received (sent→mutual; b only). */
export async function sendTalkBack(input: {
  ownerToken: string;
  edgeId: string;
}): Promise<NetResult<{ state: EdgeState; already: boolean }>> {
  try {
    const { body } = await postJson("/api/meet/talkback", input);
    if (!isRecord(body) || body.ok !== true) {
      return { ok: false, error: isRecord(body) && typeof body.error === "string" ? body.error : "talkback_failed" };
    }
    const state = parseEdgeState(body.state);
    if (state === null) return { ok: false, error: "talkback_failed" };
    return { ok: true, state, already: body.already === true };
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
      incoming: arr(body.incoming).filter(isRecord).flatMap((r) => {
        const state = parseEdgeState(r.state);
        return isParticipantRef(r.fromRef) && typeof r.fromName === "string" &&
          typeof r.edgeId === "string" && state !== null
          ? [{
              edgeId: r.edgeId,
              fromRef: r.fromRef,
              fromName: r.fromName,
              fromIntro: typeof r.fromIntro === "string" ? r.fromIntro : "",
              basisItemRef: typeof r.basisItemRef === "string" ? r.basisItemRef : "",
              anchor: typeof r.anchor === "string" ? r.anchor : "",
              createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
              state,
              closedByMe: r.closedByMe === true,
              closedFrom: typeof r.closedFrom === "string" ? r.closedFrom : "",
              dormant: r.dormant === true,
            }]
          : [];
      }),
      outgoing: arr(body.outgoing).filter(isRecord).flatMap((r) => {
        const state = parseEdgeState(r.state);
        return isParticipantRef(r.toRef) && typeof r.edgeId === "string" && state !== null
          ? [{
              edgeId: r.edgeId,
              toRef: r.toRef,
              toName: typeof r.toName === "string" ? r.toName : "",
              basisItemRef: typeof r.basisItemRef === "string" ? r.basisItemRef : "",
              anchor: typeof r.anchor === "string" ? r.anchor : "",
              state,
              createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
              closedByMe: r.closedByMe === true,
              closedFrom: typeof r.closedFrom === "string" ? r.closedFrom : "",
              dormant: r.dormant === true,
            }]
          : [];
      }),
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
      myItems: arr(body.myItems).filter(isRecord).flatMap((r) =>
        typeof r.itemRef === "string" && /^[0-9a-f]{16}$/.test(r.itemRef) &&
        typeof r.kind === "string" && typeof r.title === "string" && typeof r.text === "string"
          ? [{
              itemRef: r.itemRef,
              kind: r.kind,
              title: r.title,
              text: r.text,
              tags: Array.isArray(r.tags)
                ? r.tags.filter((t): t is string => typeof t === "string")
                : [],
              business: r.business === true,
            }]
          : [],
      ),
      questionReads: arr(body.questionReads).filter(isRecord).flatMap((r) =>
        typeof r.position === "number" && typeof r.count === "number" && r.count >= 0
          ? [{ position: r.position, count: r.count }]
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

// ── R2 0013 — 封筒レーン（PX は ciphertext を運ぶだけ・平文はこの lane を通らない）──

export type SealedFields = { ephPub: string; iv: string; ciphertext: string };
export type EnvelopeKind = "message" | "note" | "contact";

export type FetchedEnvelope = SealedFields & {
  envelopeId: string;
  edgeId: string;
  fromRef: string;
  kind: EnvelopeKind;
  createdAt: string;
};
export type ExpiredEnvelope = {
  envelopeId: string;
  edgeId: string;
  kind: EnvelopeKind;
  /** true = 自分が出した封筒が届かなかった（両者に正直な一行 — 0013 §4）。 */
  mine: boolean;
  createdAt: string;
};

/** 投函 — mutual edge の participant のみ（サーバ述語が床）。 */
export async function sendEnvelope(input: {
  ownerToken: string;
  envelopeId: string;
  edgeId: string;
  kind: EnvelopeKind;
} & SealedFields): Promise<NetResult<{ envelopeId: string }>> {
  try {
    const { body } = await postJson("/api/meet/envelope", input);
    if (!isRecord(body) || body.ok !== true || typeof body.envelopeId !== "string") {
      return { ok: false, error: isRecord(body) && typeof body.error === "string" ? body.error : "envelope_failed" };
    }
    return { ok: true, envelopeId: body.envelopeId };
  } catch {
    return { ok: false, error: "network" };
  }
}

function parseEnvelopeKind(v: unknown): EnvelopeKind | null {
  return v === "message" || v === "note" || v === "contact" ? v : null;
}

/** 受け取りに行く（pull・通知なし）。返るのは ciphertext のまま。 */
export async function fetchEnvelopes(
  ownerToken: string,
): Promise<NetResult<{ incoming: FetchedEnvelope[]; expired: ExpiredEnvelope[] }>> {
  try {
    const { body } = await postJson("/api/meet/envelope-fetch", { ownerToken });
    if (!isRecord(body) || body.ok !== true) return { ok: false, error: "fetch_failed" };
    const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
    return {
      ok: true,
      incoming: arr(body.incoming).filter(isRecord).flatMap((r) => {
        const kind = parseEnvelopeKind(r.kind);
        return typeof r.envelopeId === "string" && typeof r.edgeId === "string" &&
          isParticipantRef(r.fromRef) && kind !== null &&
          typeof r.ephPub === "string" && typeof r.iv === "string" && typeof r.ciphertext === "string"
          ? [{
              envelopeId: r.envelopeId,
              edgeId: r.edgeId,
              fromRef: r.fromRef,
              kind,
              ephPub: r.ephPub,
              iv: r.iv,
              ciphertext: r.ciphertext,
              createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
            }]
          : [];
      }),
      expired: arr(body.expired).filter(isRecord).flatMap((r) => {
        const kind = parseEnvelopeKind(r.kind);
        return typeof r.envelopeId === "string" && typeof r.edgeId === "string" && kind !== null
          ? [{
              envelopeId: r.envelopeId,
              edgeId: r.edgeId,
              kind,
              mine: r.mine === true,
              createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
            }]
          : [];
      }),
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** 受信完了の内部信号 — 相手に通知されない・相手の UI に状態を作らない（0013 条件2）。 */
export async function ackEnvelopes(
  ownerToken: string,
  envelopeIds: string[],
): Promise<NetResult<Record<never, never>>> {
  try {
    const { body } = await postJson("/api/meet/envelope-ack", { ownerToken, envelopeIds });
    if (!isRecord(body) || body.ok !== true) return { ok: false, error: "ack_failed" };
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** R2 0013 — a peer's E2EE public key (public material; survives pool departure). */
export async function fetchEncKey(
  ref: string,
): Promise<NetResult<{ encPub: string; gen: number }>> {
  try {
    const res = await fetch(`/api/meet/enckey?ref=${encodeURIComponent(ref)}`);
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok || !isRecord(body) || body.ok !== true || typeof body.encPub !== "string") {
      const error = isRecord(body) && typeof body.error === "string" ? body.error : "enckey_failed";
      return { ok: false, error };
    }
    return { ok: true, encPub: body.encPub, gen: typeof body.gen === "number" ? body.gen : 1 };
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
