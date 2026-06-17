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
  mintDeviceId,
  signMesh,
  isOwnerRef,
} from "../meet-crypto/mesh.ts";
import { encPubToString, mintEncKeyPair } from "../meet-crypto/keys.ts";

export type MeshDeviceView = {
  deviceId: string;
  label: string;
  addedAt: string;
  revoked: boolean;
  here: boolean;
};

/** mesh write の capability（server authoritative・正直な表示用＝B）。
 *  writeAllowed=false のとき UI は「同期中」と言わない（嘘をつかない）。 */
export type MeshCapability = { mode: "off" | "allowlist" | "on"; writeAllowed: boolean };

function readCapability(data: Record<string, unknown>): MeshCapability {
  const mode = data.mode === "allowlist" || data.mode === "on" ? data.mode : "off";
  return { mode, writeAllowed: data.writeAllowed === true };
}

/** ensureRegistered の結果。disabled = サーバが mesh_disabled（mode off）で bootstrap を拒否。 */
export type EnsureResult = { identity: MeshIdentityV1 | null; capability: MeshCapability | null; disabled: boolean };

function ok(r: MeshHttpResult): r is MeshHttpResult & { data: Record<string, unknown> } {
  return r.ok && r.data !== null && r.data.ok === true;
}

/** device_sig 署名つきの要求エンベロープを組む（dataStr を直接署名＝再直列化ずれを避ける）。
 *  Phase B（handoff）も同じ署名形を使う — export して共有。 */
export async function signedRequest(deviceId: string, sigPriv: JsonWebKey, data: unknown): Promise<{
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
 * identity root = passkey session（サーバが handle に owner_ref を束ねる・A.1）。session が無ければ
 * register は 401 → null（UI は mock 表示に留まる＝sign-in 前の正直な無状態）。
 * 無ければ device 鍵＋epoch=1 を生成し、**公開鍵だけ**をサーバへ送る（private は端末に保管）。
 * ownerToken は補助 ID として同送するだけ（サーバが一方向ハッシュで participant_ref 写像に使う）。
 */
export async function ensureRegistered(label = ""): Promise<EnsureResult> {
  const idStore = openMeshIdentity();
  const existing = await idStore.get();
  if (existing !== null) return { identity: existing, capability: null, disabled: false };

  const ownerToken = getOrMintOwnerToken();
  const deviceId = mintDeviceId();
  const keys = await mintDeviceKeys();
  // epoch=1 の content keypair（enc と同形の ECDH P-256）。
  const epoch1 = await mintEncKeyPair();

  const res = await meshPost("/api/mesh/register", {
    ownerToken, // 補助のみ — サーバは handle（passkey）を identity root に使う
    device: {
      deviceId,
      sigPub: encPubToString(keys.sig.pub),
      encPub: encPubToString(keys.enc.pub),
      label,
    },
    epochPub: encPubToString(epoch1.pub),
  });
  // mesh_disabled（mode off で bootstrap 拒否）は **正直な off 状態** — mock に誤魔化さない（B）。
  // network 失敗・401 passkey_required は disabled でない（mock のまま＝足場）。
  if (res.data !== null && res.data.ok === false && res.data.error === "mesh_disabled") {
    return { identity: null, capability: readCapability(res.data), disabled: true };
  }
  if (!ok(res)) return { identity: null, capability: null, disabled: false };

  const capability = readCapability(res.data);
  const ownerRef = typeof res.data.ownerRef === "string" && isOwnerRef(res.data.ownerRef) ? res.data.ownerRef : null;
  if (ownerRef === null) return { identity: null, capability, disabled: false };
  // existing:true = この handle は既に別端末で bootstrap 済み → この端末は handoff（Phase B）で
  // 合流すべき（register は 2 台目を登録しない）。未登録のまま身元を保存しない。
  if (res.data.existing === true) return { identity: null, capability, disabled: false };

  // private 鍵と身元は端末にだけ保管（登録成功後・サーバ authoritative の owner_ref を使う）。
  await openMeshDevice().set({ deviceId, sig: keys.sig, enc: keys.enc });
  await openMeshEpochs().put({ epoch: 1, pub: epoch1.pub, priv: epoch1.priv });
  await idStore.set(ownerRef, deviceId);
  return { identity: { entryId: "self", ownerRef, deviceId }, capability, disabled: false };
}

/** 自分の接続済み端末一覧（署名つき）＋ capability（writeAllowed・正直表示用）。
 *  身元（=registered）/鍵が無ければ null（mock 表示）。 */
export async function loadDevices(): Promise<{ devices: MeshDeviceView[]; capability: MeshCapability } | null> {
  const id = await openMeshIdentity().get();
  const dev = await openMeshDevice().get();
  if (id === null || dev === null) return null;
  const body = await signedRequest(dev.deviceId, dev.sig.priv, {});
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
  return { devices: out, capability: readCapability(res.data) };
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
  const body = await signedRequest(dev.deviceId, dev.sig.priv, {
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
