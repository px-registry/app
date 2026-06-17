// Device Mesh — 端末ローカルの身元・鍵置き場（Phase A）。
// 設計: docs/r2/device-mesh-how-v0.3.md §3.2。
//
// この lane（meet-memory）は IndexedDB のみ（fetch なし）。private JWK（device_sig/device_enc/epoch）は
// **この端末の中にだけ**住む — サーバ・ログ・チャットのどこにも出さない。配送は meet-net/mesh-api、
// 署名は meet-crypto/mesh。順序材料は持たない（比較ソートなし＝px-guard 準拠）。

import type { KeyedBackend } from "./backend.ts";

/** 身元 singleton: この端末の owner_ref と device_id。 */
export type MeshIdentityV1 = { entryId: "self"; ownerRef: string; deviceId: string };

/** device 鍵 singleton: sig(ECDSA)/enc(ECDH) の公開＋秘密（秘密は端末のみ）。 */
export type MeshDeviceKeysV1 = {
  entryId: "self";
  sig: { pub: JsonWebKey; priv: JsonWebKey };
  enc: { pub: JsonWebKey; priv: JsonWebKey };
};

/** epoch 鍵: epoch 番号ごとの content keypair（過去 epoch も保持＝過去暗号文も読める）。 */
export type MeshEpochKeyV1 = { entryId: string; epoch: number; pub: JsonWebKey; priv: JsonWebKey };

const SELF = "self" as const;
const epochEntryId = (epoch: number): string => `epoch:${epoch}`;

export class MeshIdentityStore {
  constructor(private backend: KeyedBackend<MeshIdentityV1>) {}
  async get(): Promise<MeshIdentityV1 | null> {
    return (await this.backend.get(SELF)) ?? null;
  }
  async set(ownerRef: string, deviceId: string): Promise<void> {
    await this.backend.put({ entryId: SELF, ownerRef, deviceId });
  }
}

export class MeshDeviceStore {
  constructor(private backend: KeyedBackend<MeshDeviceKeysV1>) {}
  async get(): Promise<MeshDeviceKeysV1 | null> {
    return (await this.backend.get(SELF)) ?? null;
  }
  async set(keys: Omit<MeshDeviceKeysV1, "entryId">): Promise<void> {
    await this.backend.put({ entryId: SELF, ...keys });
  }
}

export class MeshEpochStore {
  constructor(private backend: KeyedBackend<MeshEpochKeyV1>) {}
  async get(epoch: number): Promise<MeshEpochKeyV1 | null> {
    return (await this.backend.get(epochEntryId(epoch))) ?? null;
  }
  async put(rec: { epoch: number; pub: JsonWebKey; priv: JsonWebKey }): Promise<void> {
    await this.backend.put({ entryId: epochEntryId(rec.epoch), ...rec });
  }
  async list(): Promise<MeshEpochKeyV1[]> {
    return await this.backend.list();
  }
  /** 保持している最高 epoch（比較ソートを使わず位置走査・px-guard 準拠）。 */
  async highest(): Promise<number> {
    let m = 0;
    for (const r of await this.backend.list()) if (r.epoch > m) m = r.epoch;
    return m;
  }
}
