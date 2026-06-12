// R2 0013 — E2EE 鍵対の置き場（owner-local, browser only）。
//
// 秘密鍵 JWK はこの store（IndexedDB px-meet / enckey）にだけ住む。サーバへは
// 公開鍵だけが publish と同送される。mint はレーン外（lib/meet-crypto）から
// 関数で注入 — このモジュールは crypto を直接呼ばない（保存と取出しだけ）。
//
// 控えを保存（export）に秘密鍵を含める日（0013 裁定 a）は、owner パスフレーズ
// 封緘（invariant 6）と同便で実装する — 平文 JWK を export へ流す形は作らない。

import type { KeyedBackend } from "./backend.ts";

export type EncKeyRecordV1 = {
  /** singleton — one keypair per device identity. */
  entryId: "enckey";
  pub: JsonWebKey;
  priv: JsonWebKey;
  createdAt: string;
};

export class EncKeyStore {
  private backend: KeyedBackend<EncKeyRecordV1>;
  private now: () => string;

  constructor(backend: KeyedBackend<EncKeyRecordV1>, opts?: { now?: () => string }) {
    this.backend = backend;
    this.now = opts?.now ?? (() => new Date().toISOString());
  }

  /** The device keypair — minted once via the injected lane function. */
  async getOrMint(mint: () => Promise<{ pub: JsonWebKey; priv: JsonWebKey }>): Promise<EncKeyRecordV1> {
    const existing = await this.backend.get("enckey");
    if (existing !== undefined) return existing;
    const kp = await mint();
    const rec: EncKeyRecordV1 = { entryId: "enckey", pub: kp.pub, priv: kp.priv, createdAt: this.now() };
    await this.backend.put(rec);
    return rec;
  }

  clear(): Promise<void> {
    return this.backend.clear();
  }
}
