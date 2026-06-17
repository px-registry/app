// PX Device Mesh — QR 束縛 handoff（Phase B・verdict G1/G4・裁定 B-1）。
// 設計: docs/r2/device-mesh-how-v0.3.md §5/§13 G1·G4。
//
// 信頼起点は **QR の中身だけ**（newDeviceEncPub/sigPub）。既存端末は QR 内 encPub へ bundle を封緘する
// — server から後取得した鍵は一切使わない（差し替え不可）。bundle は 72h relay の **fallback 配送**で、
// 正本ではない（端末が正本）。PX は本文・epoch private・journal/talk 平文を読めない（暗号文のみ運ぶ）。
//
// possession（B-1）: sig = 新端末が fetch/ack を device_sig 署名（サーバ検証・else 401）／
// enc = bundle が QR encPub 封緘ゆえ enc_priv 保有者しか読めない（crypto 強制）。client は復号成功後にだけ ack。

import { sealEnvelope, openEnvelope, type SealedEnvelopeV1 } from "../meet-crypto/envelope.ts";
import { encPubToString, parseEncPub } from "../meet-crypto/keys.ts";
import { buildHandoffQR, parseHandoffQR, mintDeviceKeys, mintDeviceId, type HandoffQRV1 } from "../meet-crypto/mesh.ts";
export type { HandoffQRV1 } from "../meet-crypto/mesh.ts";
import { meshPost, type MeshHttpResult } from "../meet-net/api.ts";
import { signedRequest } from "./client.ts";
import {
  openMeshIdentity,
  openMeshDevice,
  openMeshEpochs,
  openMemJournal,
  openTalk,
  type MemJournalRecordV1,
  type TalkEntryV1,
} from "../meet-memory/index.ts";

export const HANDOFF_TTL_MS = 72 * 60 * 60 * 1000; // 72h hard
const MAX_PIECE = 12000; // 平文 1 片（封緘後 ≤16KB に収まる）
const MAX_CHUNKS = 64; // ≒ 768KB bundle 上限

/** 端末名を UA から導出（owner 表示用・大まかな機種名）。判別不能なら "" を返し、受け手が
 *  「新しい端末」fallback を当てる（fallback コピーは MEET.sync.newDevice の一箇所）。 */
export function deviceNameFromUA(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/.test(ua)) return "MacBook";
  if (/Windows/.test(ua)) return "Windows PC";
  return "";
}

type Chunk = { ix: number; of: number; ephPub: string; iv: string; ciphertext: string };

function okHttp(r: MeshHttpResult): r is MeshHttpResult & { data: Record<string, unknown> } {
  return r.ok && r.data !== null && r.data.ok === true;
}

/** 応答が MESH_WRITE gate の拒否（mesh_disabled）か。handoff は deny（fallback 無し）— UI は off を正直に出す。 */
function isMeshDisabled(r: MeshHttpResult): boolean {
  return r.data !== null && r.data.ok === false && r.data.error === "mesh_disabled";
}

/** bundle 平文を片に割り、各片を QR encPub へ封緘（片ごとに ephemeral）。 */
async function sealChunks(recipientPub: JsonWebKey, plaintext: string): Promise<Chunk[]> {
  const pieces: string[] = [];
  for (let i = 0; i < plaintext.length; i += MAX_PIECE) pieces.push(plaintext.slice(i, i + MAX_PIECE));
  if (pieces.length === 0) pieces.push("");
  const of = pieces.length;
  const out: Chunk[] = [];
  for (let ix = 0; ix < of; ix++) {
    const s: SealedEnvelopeV1 = await sealEnvelope(recipientPub, pieces[ix]);
    out.push({ ix, of, ephPub: s.ephPub, iv: s.iv, ciphertext: s.ciphertext });
  }
  return out;
}

/** 受信した片を位置（ix）で並べ、各片を enc_priv で復号して連結。比較ソートは使わない。 */
async function openChunks(privJwk: JsonWebKey, chunks: Chunk[]): Promise<string | null> {
  const of = chunks[0]?.of ?? 0;
  if (of <= 0 || of > MAX_CHUNKS) return null;
  const parts: (string | null)[] = new Array(of).fill(null);
  for (const c of chunks) {
    if (typeof c.ix !== "number" || c.ix < 0 || c.ix >= of) return null;
    const t = await openEnvelope(privJwk, { ephPub: c.ephPub, iv: c.iv, ciphertext: c.ciphertext });
    if (t === null) return null; // enc 復号失敗（鍵違い/改竄）= fail-closed
    parts[c.ix] = t;
  }
  if (parts.some((p) => p === null)) return null; // 欠け
  return parts.join("");
}

// ── 新端末側 ─────────────────────────────────────────────────────────────────────

/** 新端末: device 鍵を用意し、自分の sig で署名した QR（72h 失効）を作って返す（JSON 文字列）。
 *  identity（owner_ref）はまだ確定しない — handoff 完了で確定する。 */
export async function startHandoffAsNewDevice(name = ""): Promise<{ qr: string; deviceId: string }> {
  const store = openMeshDevice();
  let dev = await store.get();
  if (dev === null) {
    const keys = await mintDeviceKeys();
    const deviceId = mintDeviceId();
    await store.set({ deviceId, sig: keys.sig, enc: keys.enc });
    dev = { entryId: "self", deviceId, sig: keys.sig, enc: keys.enc };
  }
  const exp = Date.now() + HANDOFF_TTL_MS;
  // 端末名は明示指定 > UA 導出 > 空（受け手が「新しい端末」fallback）。
  const label = name || deviceNameFromUA();
  const qrObj = await buildHandoffQR(
    dev.deviceId,
    encPubToString(dev.enc.pub),
    encPubToString(dev.sig.pub),
    dev.sig.priv,
    exp,
    label,
  );
  return { qr: JSON.stringify(qrObj), deviceId: dev.deviceId };
}

/**
 * 新端末: handoff bundle を取得→**enc_priv で復号**→install（epoch/journal/talk/identity）→ack（purge）。
 * 復号成功後にだけ ack する（B-1）。未着は pending、復号失敗は fail-closed。
 */
export async function pollAndInstallHandoff(): Promise<{ ok: boolean; pending?: boolean; error?: string }> {
  const dev = await openMeshDevice().get();
  if (dev === null) return { ok: false, error: "no_device" };
  const res = await meshPost("/api/mesh/handoff/fetch", await signedRequest(dev.deviceId, dev.sig.priv, {}));
  if (!okHttp(res) || !Array.isArray(res.data.chunks) || res.data.chunks.length === 0) {
    return { ok: false, pending: true };
  }
  const raw = res.data.chunks as Array<Record<string, unknown>>;
  const chunks: Chunk[] = [];
  const payloadIds: string[] = [];
  for (const c of raw) {
    if (typeof c.ephPub !== "string" || typeof c.iv !== "string" || typeof c.ciphertext !== "string") continue;
    if (typeof c.ix !== "number" || typeof c.of !== "number") continue;
    chunks.push({ ix: c.ix, of: c.of, ephPub: c.ephPub, iv: c.iv, ciphertext: c.ciphertext });
    if (typeof c.payloadId === "string") payloadIds.push(c.payloadId);
  }
  const text = await openChunks(dev.enc.priv, chunks);
  if (text === null) return { ok: false, error: "decrypt" };
  let bundle: { v?: number; ownerRef?: string; epochs?: unknown; journal?: unknown; talk?: unknown };
  try {
    bundle = JSON.parse(text);
  } catch {
    return { ok: false, error: "parse" };
  }
  if (bundle.v !== 1 || typeof bundle.ownerRef !== "string") return { ok: false, error: "bundle" };

  // install（新端末は空 → restore/put で verbatim 取り込み・横断 HLC merge は Phase C）。
  const epochStore = openMeshEpochs();
  for (const e of Array.isArray(bundle.epochs) ? bundle.epochs : []) {
    if (e && typeof e.epoch === "number" && e.pub && e.priv) await epochStore.put({ epoch: e.epoch, pub: e.pub, priv: e.priv });
  }
  const journalStore = openMemJournal();
  for (const rec of Array.isArray(bundle.journal) ? (bundle.journal as MemJournalRecordV1[]) : []) {
    await journalStore.restore(rec);
  }
  const talkStore = openTalk();
  for (const t of Array.isArray(bundle.talk) ? (bundle.talk as TalkEntryV1[]) : []) {
    await talkStore.put(t);
  }
  await openMeshIdentity().set(bundle.ownerRef, dev.deviceId);

  // 復号成功後にだけ ack → relay から purge。
  if (payloadIds.length > 0) {
    await meshPost("/api/mesh/handoff/ack", await signedRequest(dev.deviceId, dev.sig.priv, { payloadIds }));
  }
  return { ok: true };
}

// ── 既存端末側 ───────────────────────────────────────────────────────────────────

/** 既存端末: 読み取った QR を検証（形・期限・QR 署名）して返す（承認 UI 用）。null=不正/失効。 */
export async function reviewIncomingQR(qrStr: string): Promise<HandoffQRV1 | null> {
  return parseHandoffQR(qrStr, Date.now());
}

/**
 * 既存端末: 承認後、新端末を device-add（**QR の pubs**＝信頼起点）→ bundle を作り **QR encPub へ封緘**→
 * 72h relay へ put。server 後取得鍵は使わない。
 */
export async function approveAndSendHandoff(qr: HandoffQRV1): Promise<{ ok: boolean; error?: string }> {
  const id = await openMeshIdentity().get();
  const dev = await openMeshDevice().get();
  if (id === null || dev === null) return { ok: false, error: "not_registered" };

  const add = await meshPost(
    "/api/mesh/device",
    await signedRequest(dev.deviceId, dev.sig.priv, {
      newDevice: { deviceId: qr.did, sigPub: qr.sigPub, encPub: qr.encPub, label: qr.name ?? "" },
    }),
  );
  if (isMeshDisabled(add)) return { ok: false, error: "mesh_disabled" };
  if (!okHttp(add)) return { ok: false, error: "device_add" };

  const epochs = (await openMeshEpochs().list()).map((e) => ({ epoch: e.epoch, pub: e.pub, priv: e.priv }));
  const journal = await openMemJournal().list();
  const talk = await openTalk().listAll();
  const bundle = JSON.stringify({ v: 1, ownerRef: id.ownerRef, epochs, journal, talk });

  const recipientPub = parseEncPub(qr.encPub); // ← QR の鍵だけ。server 後取得鍵を信頼起点にしない
  if (recipientPub === null) return { ok: false, error: "qr_pub" };
  const chunks = await sealChunks(recipientPub, bundle);
  if (chunks.length > MAX_CHUNKS) return { ok: false, error: "too_large" };

  const put = await meshPost(
    "/api/mesh/handoff/put",
    await signedRequest(dev.deviceId, dev.sig.priv, { toDevice: qr.did, chunks }),
  );
  if (isMeshDisabled(put)) return { ok: false, error: "mesh_disabled" };
  return { ok: okHttp(put) };
}

/** 既存端末（owner）: 未配送の handoff を取り消す（owner cancel 削除・§13 G4）。 */
export async function cancelHandoff(toDevice: string): Promise<{ ok: boolean }> {
  const dev = await openMeshDevice().get();
  if (dev === null) return { ok: false };
  const res = await meshPost("/api/mesh/handoff/cancel", await signedRequest(dev.deviceId, dev.sig.priv, { toDevice }));
  return { ok: okHttp(res) };
}
