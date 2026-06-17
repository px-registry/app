// PX Device Mesh — クライアント orchestrator（Phase A）。
// 設計: docs/r2/device-mesh-how-v0.3.md §3/§7。
//
// このレーンが三者を束ねる:
//   - meet-crypto/mesh : 鍵生成・署名（WebCrypto）
//   - meet-memory      : 身元・private 鍵の保管（IndexedDB・この端末のみ）
//   - meet-net/api     : /api/mesh/* への配送（fetch）
// app/meet は本モジュールだけを呼ぶ（fetch/indexedDB を直接触らない＝lane gate 準拠）。
//
// Phase A の射程: bootstrap 登録 / 端末一覧 / revoke+rotate（registry 側）。
// QR 束縛 handoff は Phase B、relay delta は Phase C（本モジュールに後から足す）。
// private 鍵はサーバへ出さない（公開鍵だけ送る）。順序材料を持たない・並べ替えない。

import { getOrMintOwnerToken } from "../meet-net/local.ts";
import { meshPost, meshGet, type MeshHttpResult } from "../meet-net/api.ts";
import {
  openMeshIdentity,
  openMeshDevice,
  openMeshEpochs,
  type MeshIdentityV1,
} from "../meet-memory/index.ts";
import {
  mintDeviceKeys,
  mintOwnerRef,
  mintDeviceId,
  signMesh,
} from "../meet-crypto/mesh.ts";
import { encPubToString, mintEncKeyPair } from "../meet-crypto/keys.ts";

export type MeshDeviceView = {
  deviceId: string;
  label: string;
  addedAt: string;
  revoked: boolean;
  here: boolean;
};

function ok(r: MeshHttpResult): r is MeshHttpResult & { data: Record<string, unknown> } {
  return r.ok && r.data !== null && r.data.ok === true;
}

/** device_sig 署名つきの要求エンベロープを組む（dataStr を直接署名＝再直列化ずれを避ける）。 */
async function signedBody(deviceId: string, sigPriv: JsonWebKey, data: unknown): Promise<{
  dataStr: string;
  ts: number;
  deviceId: string;
  sig: string;
}> {
  const dataStr = JSON.stringify(data ?? {});
  const ts = Date.now();
  const sig = await signMesh(sigPriv, dataStr, ts);
  return { dataStr, ts, deviceId, sig };
}

/**
 * この端末を Mesh に bootstrap する（冪等）。既に身元があればそれを返す。
 * 無ければ device 鍵＋epoch=1 を生成し、公開鍵だけをサーバへ登録（private は端末に保管）。
 * label は端末名（owner 表示・任意）。失敗時 null（fail-closed・UI は mock 表示に留まる）。
 */
export async function ensureRegistered(label = ""): Promise<MeshIdentityV1 | null> {
  const idStore = openMeshIdentity();
  const existing = await idStore.get();
  if (existing !== null) return existing;

  const ownerToken = getOrMintOwnerToken();
  const ownerRef = mintOwnerRef();
  const deviceId = mintDeviceId();
  const keys = await mintDeviceKeys();
  // epoch=1 の content keypair（enc と同形の ECDH P-256）。
  const epoch1 = await mintEncKeyPair();

  const res = await meshPost("/api/mesh/register", {
    ownerToken,
    ownerRef,
    device: {
      deviceId,
      sigPub: encPubToString(keys.sig.pub),
      encPub: encPubToString(keys.enc.pub),
      label,
    },
    epochPub: encPubToString(epoch1.pub),
  });
  if (!ok(res)) return null;

  // private 鍵と身元は端末にだけ保管（登録成功後）。
  await openMeshDevice().set({ sig: keys.sig, enc: keys.enc });
  await openMeshEpochs().put({ epoch: 1, pub: epoch1.pub, priv: epoch1.priv });
  await idStore.set(ownerRef, deviceId);
  return { entryId: "self", ownerRef, deviceId };
}

/** 自分の接続済み端末一覧（署名つき）。身元/鍵が無ければ null（mock 表示）。 */
export async function loadDevices(): Promise<MeshDeviceView[] | null> {
  const id = await openMeshIdentity().get();
  const dev = await openMeshDevice().get();
  if (id === null || dev === null) return null;
  const body = await signedBody(id.deviceId, dev.sig.priv, {});
  const res = await meshPost("/api/mesh/devices", body);
  if (!ok(res) || !Array.isArray(res.data.devices)) return null;
  const out: MeshDeviceView[] = [];
  for (const raw of res.data.devices) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.deviceId !== "string") continue;
    out.push({
      deviceId: r.deviceId,
      label: typeof r.label === "string" ? r.label : "",
      addedAt: typeof r.addedAt === "string" ? r.addedAt : "",
      revoked: r.revoked === true,
      here: r.here === true,
    });
  }
  return out;
}

/**
 * 端末を外す＋epoch を巻き直す（registry 側）。新 epoch keypair を生成し公開鍵だけ送る。
 * 残存端末への新 epoch private 配布（relay）は Phase C。成功で新 epoch を端末に保管。
 */
export async function revokeDevice(targetDeviceId: string): Promise<{ ok: boolean; epoch?: number }> {
  const id = await openMeshIdentity().get();
  const dev = await openMeshDevice().get();
  if (id === null || dev === null) return { ok: false };
  const next = await mintEncKeyPair();
  const body = await signedBody(id.deviceId, dev.sig.priv, {
    targetDeviceId,
    newEpochPub: encPubToString(next.pub),
  });
  const res = await meshPost("/api/mesh/revoke", body);
  if (!ok(res)) return { ok: false };
  const epoch = typeof res.data.epoch === "number" ? res.data.epoch : undefined;
  if (epoch !== undefined) await openMeshEpochs().put({ epoch, pub: next.pub, priv: next.priv });
  return { ok: true, epoch };
}

/** owner の active epoch 公開鍵を読む（peer が宛先鍵を得る・公開物）。 */
export async function getEpochPub(ownerRef: string): Promise<{ epoch: number; epochPub: string } | null> {
  const res = await meshGet(`/api/mesh/epoch?ref=${encodeURIComponent(ownerRef)}`);
  if (!ok(res)) return null;
  const epoch = typeof res.data.epoch === "number" ? res.data.epoch : null;
  const epochPub = typeof res.data.epochPub === "string" ? res.data.epochPub : null;
  return epoch !== null && epochPub !== null ? { epoch, epochPub } : null;
}
