// R2 便6 — トークの棚（owner-local, browser only）。
//
// 受け取ったメッセージは端末で開封してここに住む（配達後、サーバには無い —
// この棚が唯一の転写）。自分が送った分も投函と同時にここへ（owner-held 転写）。
// 不達（expired）と鍵変更も**事実の行**としてスレッドに並ぶ — 別の通知面を
// 作らない（圧なし）。
//
// received/firstnote と同じ規律: このレーンは memory store/validator を import
// しない・何もこの棚をプロンプトの SELF 材料に読み込まない。

import type { KeyedBackend } from "./backend.ts";

export type TalkEntryKind = "in" | "out" | "expired" | "keychange" | "contact-in" | "contact-out";

export type TalkEntryV1 = {
  /** 受信 = env id 由来（重複受信を冪等に）。送信・事実行 = 端末 mint。 */
  entryId: string;
  edgeId: string;
  kind: TalkEntryKind;
  /** 開封済みの本文（expired/keychange は "" — 文言は表示層の定数が担う）。 */
  text: string;
  at: string;
};

export class TalkStore {
  private backend: KeyedBackend<TalkEntryV1>;

  constructor(backend: KeyedBackend<TalkEntryV1>) {
    this.backend = backend;
  }

  /** Idempotent put — a re-fetched envelope lands once (entryId = env id). */
  async put(entry: TalkEntryV1): Promise<void> {
    const existing = await this.backend.get(entry.entryId);
    if (existing !== undefined) return;
    await this.backend.put(entry);
  }

  /** Thread per edge, time order（時刻順 — 品質の順ではない）。 */
  async thread(edgeId: string): Promise<TalkEntryV1[]> {
    const all = await this.backend.list();
    return all
      .filter((e) => e.edgeId === edgeId)
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  }

  async listAll(): Promise<TalkEntryV1[]> {
    return this.backend.list();
  }

  /** edge → 時刻順スレッド（UI レーンは sort しない — 並びはこの棚の責務）。 */
  async threadsByEdge(): Promise<Record<string, TalkEntryV1[]>> {
    const all = await this.backend.list();
    const th: Record<string, TalkEntryV1[]> = {};
    for (const e of all) (th[e.edgeId] ??= []).push(e);
    for (const k of Object.keys(th)) {
      th[k].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    }
    return th;
  }

  clear(): Promise<void> {
    return this.backend.clear();
  }
}

/** Peer の鍵世代の覚え（鍵変更の事実表示用 — 判定なし）。 */
export type PeerKeyGenV1 = { entryId: string; gen: number };

export class PeerKeyStore {
  private backend: KeyedBackend<PeerKeyGenV1>;
  constructor(backend: KeyedBackend<PeerKeyGenV1>) {
    this.backend = backend;
  }
  async get(peerRef: string): Promise<number | null> {
    return (await this.backend.get(peerRef))?.gen ?? null;
  }
  async set(peerRef: string, gen: number): Promise<void> {
    await this.backend.put({ entryId: peerRef, gen });
  }
  clear(): Promise<void> {
    return this.backend.clear();
  }
}
