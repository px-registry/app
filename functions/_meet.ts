// Shared helpers for the R1.5 meet Functions. Leading underscore = not routed.
//
// Constitution, enforced here:
//   * The server holds ONLY: the public projection (owner-published items),
//     the 話してみる signal, the mutual-only contact note, and the
//     test-disclosed facilitator log. No private memory — a publish payload
//     carrying a `private` or `ownerId`/`items.private` key is REJECTED whole
//     (defense against an upstream bug posting full memory).
//   * The owner's secret token is derived to an opaque participant_ref and
//     DROPPED — never stored, never logged, never echoed.
//   * No score/rank column, no quality sort — reads return arrival order.
//
// Imports are relative into the top-level lib/ (the Pages build bundles with
// esbuild, no "@/*" alias) — same convention as functions/_board.ts.

import { deriveParticipantRef, isOwnerToken, isParticipantRef } from "../lib/meet-net/ref.ts";
import { parseEncPub } from "../lib/meet-crypto/keys.ts";

export interface MeetEnv {
  /** Same D1 database as the board (wrangler.toml binding = "BOARD");
   *  the r15_* tables live alongside it (migrations/0007). */
  BOARD: D1Database;
}

export { deriveParticipantRef, isOwnerToken, isParticipantRef };

export const MEET_KINDS = new Set(["have", "want", "avoid", "memory"]);

// ── R2 0010: item_ref / edge_id の形 ───────────────────────────────────────────
// item_ref = 端末が mint する公開項目の alias（raw internal id は決して来ない —
// 0010 invariant 5。乱数 16 hex なので形だけ検証できる）。
export function isItemRef(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{16}$/.test(s);
}

// edge_id = 端末 mint（edge_ 接頭辞）。r15pair_ は backfill 予約名前空間 —
// クライアントが backfill を装えないよう、形そのもので拒否する（ゲート条件2）。
export function isClientEdgeId(s: unknown): s is string {
  return typeof s === "string" && /^edge_[0-9a-f]{16,32}$/.test(s);
}

// ── R2 0013: 封筒の形 ──────────────────────────────────────────────────────────
export const ENVELOPE_KINDS = new Set(["message", "note", "contact"]);
export const MAX_CIPHERTEXT_B64 = 22000; // ≒ 16KB の base64（物理 cap）
export const MAX_IV_B64 = 64;
/** held queue cap per (edge, sender) — 物理律速（課金・優先は永久にない）。 */
export const MAX_HELD_PER_EDGE_SENDER = 50;
/** 不達 TTL（仮14日）— 期限切れは read 時に expired tombstone へ（cron なし）。 */
export const ENVELOPE_TTL_DAYS = 14;

export function isEnvelopeId(s: unknown): s is string {
  return typeof s === "string" && /^env_[0-9a-f]{16,32}$/.test(s);
}

// ── R2 便3: dormant の読み時導出（0010 §3 — 状態ではない・書き込み不在）──────
// TTL は仮90日（命名・調整は後続）。行為のみが last_act を動かす（invariant 2）
// ので、この導出が presence/既読の裏口になることはない。
export const DORMANT_TTL_DAYS = 90;

export function deriveDormant(
  state: string,
  createdAt: string,
  lastActA: string,
  lastActB: string,
  now: Date,
): boolean {
  if (state === "closed") return false; // 閉じは閉じ — 眠りではない
  const last = [createdAt, lastActA, lastActB].filter((s) => s !== "").sort().at(-1) ?? "";
  if (last === "") return false;
  const t = Date.parse(last);
  if (Number.isNaN(t)) return false;
  return now.getTime() - t > DORMANT_TTL_DAYS * 24 * 60 * 60 * 1000;
}

// Payload caps — reject before any DB write.
export const MAX_ITEMS = 60;
export const MAX_TITLE = 120;
export const MAX_TEXT = 600;
export const MAX_TAGS = 6;
export const MAX_TAG = 30;
export const MAX_NAME = 30;
export const MAX_INTRO = 80;
export const MAX_ANCHOR = 80;
export const MAX_NOTE = 500;
export const MAX_QUESTION = 300;
export const MAX_PROPOSAL = 8000;
export const MAX_READING = 4000;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const MAX_ENC_PUB = 240;

export type CleanPublish = {
  ownerToken: string;
  displayName: string;
  /** ひとこと紹介 — optional one-liner, same standing as displayName ("" = unset). */
  intro: string;
  /**
   * R2 0013 — E2EE 公開鍵（JWK 直列形・公開物）。optional: "" = 鍵を送らない
   * （鍵レーン未対応の旧クライアント）。present なら形を fail-closed 検証 —
   * private 成分 "d" を運ぶ JWK は publish ごと拒否する。
   */
  encPub: string;
  items: Array<{
    /** R2 0010: device-minted stable alias — REQUIRED, unique within the payload. */
    itemRef: string;
    kind: string;
    title: string;
    text: string;
    tags: string[];
    position: number;
    /** R2 0012: ビジネス旗 — owner の自己申告（省略可・既定 false・素通し）。 */
    business: boolean;
  }>;
};

/**
 * Validate a publish body. FAIL-CLOSED: anything off-shape rejects the whole
 * request (no partial acceptance of a malformed projection). The `private` /
 * `ownerId` key check is the boundary tripwire — those keys exist only on the
 * device side; their presence means something upstream posted raw memory.
 */
export function validatePublish(raw: unknown): { ok: true; value: CleanPublish } | { ok: false; reason: string } {
  if (!isRecord(raw)) return { ok: false, reason: "body" };
  if (!isOwnerToken(raw.ownerToken)) return { ok: false, reason: "token" };
  const displayName = typeof raw.displayName === "string" ? raw.displayName.trim() : "";
  if (displayName.length === 0 || displayName.length > MAX_NAME) {
    return { ok: false, reason: "display_name" };
  }
  // intro is OPTIONAL — absent/empty publishes as "" (never required); but a
  // present non-string or oversize value rejects the whole payload.
  if (raw.intro !== undefined && typeof raw.intro !== "string") {
    return { ok: false, reason: "intro" };
  }
  const intro = typeof raw.intro === "string" ? raw.intro.trim() : "";
  if (intro.length > MAX_INTRO) return { ok: false, reason: "intro" };
  // R2 0013: encPub — optional; present must be a valid PUBLIC P-256 JWK string
  // (a smuggled private scalar "d" rejects the whole publish — boundary tripwire).
  if (raw.encPub !== undefined && typeof raw.encPub !== "string") {
    return { ok: false, reason: "enc_pub" };
  }
  const encPub = typeof raw.encPub === "string" ? raw.encPub.trim() : "";
  if (encPub !== "" && (encPub.length > MAX_ENC_PUB || parseEncPub(encPub) === null)) {
    return { ok: false, reason: "enc_pub" };
  }
  if (!Array.isArray(raw.items) || raw.items.length > MAX_ITEMS) {
    return { ok: false, reason: "items" };
  }
  const items: CleanPublish["items"] = [];
  const seenRefs = new Set<string>();
  for (const [i, it] of raw.items.entries()) {
    if (!isRecord(it)) return { ok: false, reason: `item_${i}` };
    if ("private" in it || "ownerId" in it || "ownerToken" in it) {
      // Boundary tripwire: raw memory shapes never cross this line.
      return { ok: false, reason: "private_shape" };
    }
    // R2 0010: every published item carries its device-minted alias. Fail-closed:
    // absent, off-shape, or duplicated within the payload rejects the whole publish
    // (a duplicate would also hit the partial UNIQUE index — the floor below).
    if (!isItemRef(it.itemRef)) return { ok: false, reason: `item_${i}_ref` };
    if (seenRefs.has(it.itemRef)) return { ok: false, reason: `item_${i}_ref_dup` };
    seenRefs.add(it.itemRef);
    if (typeof it.kind !== "string" || !MEET_KINDS.has(it.kind)) {
      return { ok: false, reason: `item_${i}_kind` };
    }
    if (typeof it.title !== "string" || it.title.length > MAX_TITLE) {
      return { ok: false, reason: `item_${i}_title` };
    }
    if (typeof it.text !== "string" || it.text.trim() === "" || it.text.length > MAX_TEXT) {
      return { ok: false, reason: `item_${i}_text` };
    }
    if (!Array.isArray(it.tags) || it.tags.length > MAX_TAGS) {
      return { ok: false, reason: `item_${i}_tags` };
    }
    const tags: string[] = [];
    for (const t of it.tags) {
      if (typeof t !== "string" || t.length > MAX_TAG) return { ok: false, reason: `item_${i}_tag` };
      tags.push(t);
    }
    // R2 0012: optional boolean — absent publishes as false; an odd value rejects.
    if (it.business !== undefined && typeof it.business !== "boolean") {
      return { ok: false, reason: `item_${i}_business` };
    }
    items.push({
      itemRef: it.itemRef,
      kind: it.kind,
      title: it.title,
      text: it.text,
      tags,
      position: items.length,
      business: it.business === true,
    });
  }
  return { ok: true, value: { ownerToken: raw.ownerToken, displayName, intro, encPub, items } };
}

// ── 気配 (第9便 C) — 問いの serve 日次カウント（pool serve と port serve の共有形）─
// Day-scoped one-way dedup token — never a stored viewer id.
async function serveDedup(
  day: string,
  viewer: string,
  owner: string,
  position: number,
): Promise<string> {
  const data = new TextEncoder().encode(`r15-serve:${day}:${viewer}:${owner}:${position}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseTagsJson(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export { parseTagsJson };

/**
 * 置かれた問い（アンテナ）が viewer の AI に serve された事実を、viewer ごと日次
 * 一回だけ数える。Best-effort: 数え損ねは serve を壊さない。viewer 列は保存しない
 * （dedup は一方向ハッシュ）。pool.ts（ページの serve）と port（チャットの serve）
 * の両方が同じ一枚を通る — serve の意味を二重定義しない。
 */
export async function recordQuestionServes(
  env: MeetEnv,
  viewerRef: string,
  rows: Array<{ participant_ref: string; tags: string; position: number }>,
): Promise<void> {
  if (viewerRef === "") return;
  const day = new Date().toISOString().slice(0, 10);
  const stmts = [];
  for (const r of rows) {
    if (!parseTagsJson(r.tags).includes("問い")) continue;
    const dedup = await serveDedup(day, viewerRef, r.participant_ref, r.position);
    stmts.push(
      env.BOARD
        .prepare(
          "INSERT OR IGNORE INTO r15_question_serve (owner_ref, position, day, dedup) VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(r.participant_ref, r.position, day, dedup),
    );
  }
  if (stmts.length > 0) await env.BOARD.batch(stmts).catch(() => {});
}

// ── T1（∅→sent）の共有形 — signal.ts（ページ）と port（チャット）が同じ遷移を通る ──
// ガードは 0010 の遷移表どおり: 宛先の在籍・basis の実在・live 三つ組の冪等。
// mutual はここでは決して書かれない（T2 = talkback だけが書く）。

export type T1Input = {
  fromRef: string;
  toRef: string;
  edgeId: string;
  basisItemRef: string;
  fromName: string;
  toName: string;
  anchor: string;
  proposalPtr: string;
};

export type T1Outcome =
  | { ok: true; edgeId: string; state: string; existing: boolean }
  | { ok: false; error: "peer_not_in_pool" | "basis_not_in_pool" | "signal_failed" };

export async function performT1(env: MeetEnv, input: T1Input): Promise<T1Outcome> {
  try {
    // T1 guard: the addressee must be in the pool NOW and the basis item must be
    // THEIR published item. Distinct honest codes: peer gone vs item withdrawn.
    const present = await env.BOARD
      .prepare("SELECT 1 AS x FROM r15_pool_item WHERE participant_ref = ?1 LIMIT 1")
      .bind(input.toRef)
      .all();
    if ((present.results ?? []).length === 0) {
      return { ok: false, error: "peer_not_in_pool" };
    }
    const basis = await env.BOARD
      .prepare(
        "SELECT 1 AS x FROM r15_pool_item WHERE participant_ref = ?1 AND item_ref = ?2 LIMIT 1",
      )
      .bind(input.toRef, input.basisItemRef)
      .all();
    if ((basis.results ?? []).length === 0) {
      return { ok: false, error: "basis_not_in_pool" };
    }

    // Live-triple idempotency (gate condition 1): an existing live edge on the
    // same (a, b, basis) is returned as-is — no second room, no state change.
    const live = await env.BOARD
      .prepare(
        "SELECT edge_id, state FROM r15_edge " +
          "WHERE a_ref = ?1 AND b_ref = ?2 AND basis_item_ref = ?3 AND state != 'closed' LIMIT 1",
      )
      .bind(input.fromRef, input.toRef, input.basisItemRef)
      .all<{ edge_id: string; state: string }>();
    const existing = (live.results ?? [])[0];
    if (existing !== undefined) {
      return { ok: true, edgeId: existing.edge_id, state: existing.state, existing: true };
    }

    const now = new Date().toISOString();
    await env.BOARD
      .prepare(
        "INSERT INTO r15_edge " +
          "(edge_id, a_ref, b_ref, basis_item_ref, proposal_ptr, anchor, from_name, to_name, state, created_at, last_act_a_at) " +
          "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'sent', ?9, ?9)",
      )
      .bind(
        input.edgeId,
        input.fromRef,
        input.toRef,
        input.basisItemRef,
        input.proposalPtr,
        input.anchor,
        input.fromName,
        input.toName,
        now,
      )
      .run();
    return { ok: true, edgeId: input.edgeId, state: "sent", existing: false };
  } catch {
    // Includes the UNIQUE live-triple race: two concurrent presses — re-read and
    // answer honestly with whichever edge won.
    try {
      const after = await env.BOARD
        .prepare(
          "SELECT edge_id, state FROM r15_edge " +
            "WHERE a_ref = ?1 AND b_ref = ?2 AND basis_item_ref = ?3 AND state != 'closed' LIMIT 1",
        )
        .bind(input.fromRef, input.toRef, input.basisItemRef)
        .all<{ edge_id: string; state: string }>();
      const won = (after.results ?? [])[0];
      if (won !== undefined) {
        return { ok: true, edgeId: won.edge_id, state: won.state, existing: true };
      }
    } catch {
      // fall through to the honest failure below
    }
    return { ok: false, error: "signal_failed" };
  }
}

/** Same-origin write guard (lineage: functions/_ownerboard.ts). */
export function isAllowedWriteOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  const url = new URL(request.url);
  const own = `${url.protocol}//${url.host}`;
  const fwdHost = request.headers.get("X-Forwarded-Host");
  const fwdProto = request.headers.get("X-Forwarded-Proto");
  const fwd =
    fwdHost && fwdProto
      ? `${fwdProto.split(",")[0].trim()}://${fwdHost.split(",")[0].trim()}`
      : null;
  return origin === own || (fwd !== null && origin === fwd);
}
