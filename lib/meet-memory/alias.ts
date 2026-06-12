// R2 0010 — 公開項目の安定 identity（item_ref alias）の端末側対応表。
//
// 「never a raw internal id」(types.ts) を保ったまま、公開項目に publish を
// 跨いで続く identity を与える: 端末がここで乱数 alias を mint し、内部
// entryId → alias の対応をこの owner-local レーンにだけ持つ。alias は公開
// 射影と edge の basis_item_ref に乗る — 内部 id は決して乗らない。
//
// 継続性（0010 §1・ゲート裁定）: 取り下げ→再公開で同じ alias が続く（この
// map が生きている限り）。entry が完全削除されても map の行は消さない —
// 過去の edge の basis_item_ref が指す歴史的ポインタの土台はサーバ側にあり、
// ここの残骸は無害（再 mint の衝突もない）。

import type { KeyedBackend } from "./backend.ts";

export type ItemAliasV1 = {
  /** = the memory entry's internal entryId (the key of this lane). */
  entryId: string;
  /** The minted public alias — 16 hex chars, random, content-free. */
  itemRef: string;
};

export function mintItemRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class ItemAliasStore {
  private backend: KeyedBackend<ItemAliasV1>;
  private mint: () => string;

  constructor(backend: KeyedBackend<ItemAliasV1>, opts?: { mint?: () => string }) {
    this.backend = backend;
    this.mint = opts?.mint ?? mintItemRef;
  }

  /** The stable alias for this entry — minted once, then returned forever. */
  async getOrMint(entryId: string): Promise<string> {
    const existing = await this.backend.get(entryId);
    if (existing !== undefined) return existing.itemRef;
    const itemRef = this.mint();
    await this.backend.put({ entryId, itemRef });
    return itemRef;
  }

  /** Bulk form for the publish projection — preserves input order. */
  async getOrMintAll(entryIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (const id of entryIds) out.set(id, await this.getOrMint(id));
    return out;
  }

  clear(): Promise<void> {
    return this.backend.clear();
  }
}
