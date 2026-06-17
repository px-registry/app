// PX Device Mesh — delta 同期の orchestrator（Phase C・G3/G5・§15.4）。
// 設計: docs/r2/device-mesh-how-v0.3.md §4/§6/§15。
//
// mesh lane に乗るのは **Talk message（peer）/ talk-mirror（self）/ Memory delta（self）** だけ
// （edge_note は混ぜない・§15）。body は epoch_pub 封緘＝PX は平文を持たない。受信は復号成功後に ack。
// timeline 順序は createdAt＋recordId の決定的キー（mergeRecords）— 両端末で収束する。HLC は §6.4 の
// 機構として hlc.ts に在る（timeline 専用・ranking 不流入）。

import { sealEnvelope, openEnvelope } from "../meet-crypto/envelope.ts";
import { encPubToString, parseEncPub } from "../meet-crypto/keys.ts";
import { meshPost, type MeshHttpResult } from "../meet-net/api.ts";
import { signedRequest, getEpochPub } from "./client.ts";
import { mergeRecords, type MergeableRecord } from "./merge.ts";
import {
  openMeshIdentity,
  openMeshDevice,
  openMeshEpochs,
  openMemJournal,
  openTalk,
  openMeetMemory,
  type MemJournalRecordV1,
  type TalkEntryV1,
} from "../meet-memory/index.ts";

function okHttp(r: MeshHttpResult): r is MeshHttpResult & { data: Record<string, unknown> } {
  return r.ok && r.data !== null && r.data.ok === true;
}

/** mesh write の結果。denied = サーバが MESH_WRITE gate で拒否（off/allowlist 外）— 真の失敗ではない。
 *  fallback: "legacy"=既存 envelope へ落とせる（talk-msg）／"none"=等価無し＝no-op（memory-delta/talk-mirror）。 */
export type MeshSendResult = { ok: boolean; denied?: boolean; fallback?: "legacy" | "none" };

/** put の応答が MESH_WRITE 拒否（HTTP 200・ok:false・denied:true）かを見て fallback を読む。 */
function deniedFallback(r: MeshHttpResult): "legacy" | "none" | null {
  if (r.ok && r.data !== null && r.data.ok === false && r.data.denied === true) {
    return r.data.fallback === "legacy" ? "legacy" : "none";
  }
  return null;
}

async function currentEpoch(): Promise<{ epoch: number; pub: JsonWebKey } | null> {
  const epochs = openMeshEpochs();
  const hi = await epochs.highest();
  if (hi <= 0) return null;
  const rec = await epochs.get(hi);
  return rec === null ? null : { epoch: rec.epoch, pub: rec.pub };
}

/** Memory delta（自分の journal records）を self lane に投函（自分の current epoch へ封緘）。
 *  MESH_WRITE off/allowlist 外なら denied（fallback="none"＝no-op・Sync 未有効として静かに扱う）。 */
export async function sendMemoryDelta(records: MemJournalRecordV1[]): Promise<MeshSendResult> {
  if (records.length === 0) return { ok: true };
  const id = await openMeshIdentity().get();
  const dev = await openMeshDevice().get();
  const ep = await currentEpoch();
  if (id === null || dev === null || ep === null) return { ok: false };
  const sealed = await sealEnvelope(ep.pub, JSON.stringify({ kind: "memory-delta", records }));
  const res = await meshPost(
    "/api/mesh/relay/put",
    await signedRequest(dev.deviceId, dev.sig.priv, {
      lane: "self",
      ptype: "memory-delta",
      epoch: ep.epoch,
      ephPub: sealed.ephPub,
      iv: sealed.iv,
      ciphertext: sealed.ciphertext,
    }),
  );
  const fb = deniedFallback(res);
  if (fb !== null) return { ok: false, denied: true, fallback: fb };
  return { ok: okHttp(res) };
}

/** Talk message を相手 owner へ（peer lane）＋自分の他端末へ mirror（self lane）。
 *  MESH_WRITE off/allowlist 外なら denied（fallback="legacy"）→ 呼び出し側は既存 envelope 送信へ落とす。 */
export async function sendTalkMsg(peerOwnerRef: string, entry: TalkEntryV1): Promise<MeshSendResult> {
  const dev = await openMeshDevice().get();
  if (dev === null) return { ok: false };
  // peer lane: 相手の active epoch pub へ封緘（公開鍵を GET・content は相手だけが読める）。
  const peer = await getEpochPub(peerOwnerRef);
  let peerOk = false;
  let denied: "legacy" | "none" | null = null;
  if (peer !== null) {
    const pub = parseEncPub(peer.epochPub);
    if (pub !== null) {
      const sealed = await sealEnvelope(pub, JSON.stringify({ kind: "talk-msg", entry }));
      const res = await meshPost(
        "/api/mesh/relay/put",
        await signedRequest(dev.deviceId, dev.sig.priv, {
          lane: "peer",
          ptype: "talk-msg",
          audienceRef: peerOwnerRef,
          epoch: peer.epoch,
          ephPub: sealed.ephPub,
          iv: sealed.iv,
          ciphertext: sealed.ciphertext,
        }),
      );
      denied = deniedFallback(res);
      peerOk = okHttp(res);
    }
  }
  await sendTalkMirror(entry);
  // peer 投函が gate で拒否されたら、呼び出し側へ legacy fallback を申告（Talk 本文を落とさない）。
  if (denied !== null) return { ok: false, denied: true, fallback: "legacy" };
  return { ok: peerOk };
}

/** 送信控えを自分の他端末へ（self lane talk-mirror）。off/allowlist 外なら denied（fallback="none"・no-op）。 */
export async function sendTalkMirror(entry: TalkEntryV1): Promise<MeshSendResult> {
  const dev = await openMeshDevice().get();
  const ep = await currentEpoch();
  if (dev === null || ep === null) return { ok: false };
  const sealed = await sealEnvelope(ep.pub, JSON.stringify({ kind: "talk-mirror", entry }));
  const res = await meshPost(
    "/api/mesh/relay/put",
    await signedRequest(dev.deviceId, dev.sig.priv, {
      lane: "self",
      ptype: "talk-mirror",
      epoch: ep.epoch,
      ephPub: sealed.ephPub,
      iv: sealed.iv,
      ciphertext: sealed.ciphertext,
    }),
  );
  const fb = deniedFallback(res);
  if (fb !== null) return { ok: false, denied: true, fallback: fb };
  return { ok: okHttp(res) };
}

/**
 * 自分宛の delta を取得→**epoch priv で復号**→install（journal restore / talk put）→ack（復号成功後だけ）。
 * 復号できない payload はスキップ（ack しない＝再取得対象に残す）。
 */
export async function pollMesh(): Promise<{ ok: boolean; installed: number }> {
  const dev = await openMeshDevice().get();
  if (dev === null) return { ok: false, installed: 0 };
  const res = await meshPost("/api/mesh/relay/fetch", await signedRequest(dev.deviceId, dev.sig.priv, {}));
  if (!okHttp(res) || !Array.isArray(res.data.payloads)) return { ok: false, installed: 0 };

  const epochs = openMeshEpochs();
  const journal = openMemJournal();
  const talk = openTalk();
  const ackIds: string[] = [];
  let installed = 0;

  for (const raw of res.data.payloads as Array<Record<string, unknown>>) {
    if (typeof raw.payloadId !== "string" || typeof raw.epoch !== "number") continue;
    if (typeof raw.ephPub !== "string" || typeof raw.iv !== "string" || typeof raw.ciphertext !== "string") continue;
    const ek = await epochs.get(raw.epoch);
    if (ek === null) continue; // この epoch private を持たない → 復号できない（ack しない）
    const text = await openEnvelope(ek.priv, { ephPub: raw.ephPub, iv: raw.iv, ciphertext: raw.ciphertext });
    if (text === null) continue; // 復号失敗 → ack しない
    let body: { kind?: string; records?: unknown; entry?: unknown };
    try {
      body = JSON.parse(text);
    } catch {
      continue;
    }
    if (body.kind === "memory-delta" && Array.isArray(body.records)) {
      for (const rec of body.records as MemJournalRecordV1[]) {
        if (await journal.restore(rec)) installed += 1;
      }
    } else if ((body.kind === "talk-msg" || body.kind === "talk-mirror") && body.entry) {
      await talk.put(body.entry as TalkEntryV1);
      installed += 1;
    }
    ackIds.push(raw.payloadId); // 復号・install できた payload だけ ack
  }

  if (ackIds.length > 0) {
    await meshPost("/api/mesh/relay/ack", await signedRequest(dev.deviceId, dev.sig.priv, { payloadIds: ackIds }));
  }
  return { ok: true, installed };
}

/** Memory timeline を HLC（createdAt+recordId 決定的キー）順で返す（dual-read の Memory 側・収束的）。 */
export async function memoryTimeline(): Promise<MemJournalRecordV1[]> {
  const recs = (await openMemJournal().list()) as (MemJournalRecordV1 & MergeableRecord)[];
  return mergeRecords(recs, []);
}

/** owner 全消去（exit-safe）: 自分宛の relay payload を server から実消去する。 */
export async function purgeMine(): Promise<{ ok: boolean }> {
  const dev = await openMeshDevice().get();
  if (dev === null) return { ok: false };
  const res = await meshPost("/api/mesh/relay/purge", await signedRequest(dev.deviceId, dev.sig.priv, {}));
  return { ok: okHttp(res) };
}

/**
 * 全消去（「このPXのMemoryとTalkを消す」）: server relay payload を purge（exit-safe）＋
 * 端末ローカルの Talk / Memory を消す。相手の端末・相手の PX には触れない（server は自分の audience だけ）。
 * backend 不在でもローカルは消す（purge は best-effort）。
 */
export async function wipeMine(): Promise<{ ok: boolean }> {
  const purged = await purgeMine();
  await openTalk().clear();
  await openMeetMemory().clear();
  return { ok: purged.ok };
}
