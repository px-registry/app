// PX Memory v0.1 — local store abstraction (isolated lane).
//
// 端末ローカルのみ。fetch / sync / server を持たない（Hard STOP: Raw Memory を
// サーバに送らない）。backend は id→record の薄い非同期ストア。ブラウザは
// IndexedDB backend（./indexeddb.ts・別 DB）、テストは下の InMemory backend。
// store ロジック（fold・gate・packet・draft）は backend 非依存。

import type {
  AntennaContextCard,
  MemoryEvent,
  MemoryItem,
  MemoryProjection,
  MemoryProjectionKind,
  MemoryProvenance,
  RawMemoryBody,
  RunMemoryPacket,
} from "./types.ts";
import {
  createMemoryEvent,
  foldMemoryItems,
  forgetMemory,
  moveMemoryToSurface,
  nextSeq,
  removeMemoryFromRun,
  orderBySeq,
} from "./memory.ts";
import { createMemoryProjection } from "./projection.ts";
import { buildRunMemoryPacket } from "./read-gate.ts";
import { createAntennaContextDraft } from "./antenna.ts";

/** id→record の薄いストア。eventId / projectionId / cardId を keyOf で取る。 */
export interface MemoryBackend<T> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(entry: T): Promise<void>;
  clear(): Promise<void>;
}

/** プロセス内テスト用 backend（と SSR の安全な no-op）。 */
export class InMemoryBackend<T> implements MemoryBackend<T> {
  private map = new Map<string, T>();
  private keyOf: (entry: T) => string;
  constructor(keyOf: (entry: T) => string) {
    this.keyOf = keyOf;
  }
  async list(): Promise<T[]> {
    return [...this.map.values()];
  }
  async get(id: string): Promise<T | undefined> {
    return this.map.get(id);
  }
  async put(entry: T): Promise<void> {
    this.map.set(this.keyOf(entry), entry);
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
}

function defaultGenId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `${prefix}_${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export type PxMemoryStoreOpts = {
  events?: MemoryBackend<MemoryEvent>;
  projections?: MemoryBackend<MemoryProjection>;
  antenna?: MemoryBackend<AntennaContextCard>;
  now?: () => string;
  genId?: (prefix: string) => string;
};

/**
 * Owner-local な記憶基層のストア。append-only な event を巻き取り、読みは fold で作る。
 * 変異経路は capture / surface(残す) / removeFromRun(外す) / forget だけ — in-place 変異なし。
 */
export class PxMemoryStore {
  private events: MemoryBackend<MemoryEvent>;
  private projections: MemoryBackend<MemoryProjection>;
  private antenna: MemoryBackend<AntennaContextCard>;
  private now: () => string;
  private genId: (prefix: string) => string;

  constructor(opts?: PxMemoryStoreOpts) {
    this.events = opts?.events ?? new InMemoryBackend<MemoryEvent>((e) => e.eventId);
    this.projections =
      opts?.projections ?? new InMemoryBackend<MemoryProjection>((p) => p.projectionId);
    this.antenna = opts?.antenna ?? new InMemoryBackend<AntennaContextCard>((c) => c.cardId);
    this.now = opts?.now ?? (() => new Date().toISOString());
    this.genId = opts?.genId ?? defaultGenId;
  }

  private async ctx() {
    const all = await this.events.list();
    return { eventId: this.genId("mem"), seq: nextSeq(all), now: this.now() };
  }

  /** すべての event を seq 順で。 */
  async listEvents(): Promise<MemoryEvent[]> {
    return orderBySeq(await this.events.list());
  }

  /** 現在の MemoryItem 群（fold 後）。 */
  async listItems(): Promise<MemoryItem[]> {
    return foldMemoryItems(await this.events.list());
  }

  private async itemById(itemId: string): Promise<MemoryItem | undefined> {
    return (await this.listItems()).find((i) => i.itemId === itemId);
  }

  /** Raw Memory が生まれる（capture）。既定 placement は deep（未選択は表層化しない）。 */
  async capture(
    body: RawMemoryBody,
    provenance: MemoryProvenance = "owner",
  ): Promise<MemoryItem> {
    const event = createMemoryEvent({ body, provenance }, await this.ctx());
    await this.events.put(event);
    return foldMemoryItems(await this.events.list()).find((i) => i.itemId === event.eventId)!;
  }

  /** 「残す」— surface へ。 */
  async keepInRun(itemId: string): Promise<MemoryItem> {
    const item = await this.itemById(itemId);
    if (!item) throw new Error(`unknown memory item: ${itemId}`);
    const { event } = moveMemoryToSurface(item, await this.ctx());
    await this.events.put(event);
    return (await this.itemById(itemId))!;
  }

  /** 「外す」— 通常 Run から外す（deep へ・物理削除しない）。 */
  async removeFromRun(itemId: string): Promise<MemoryItem> {
    const item = await this.itemById(itemId);
    if (!item) throw new Error(`unknown memory item: ${itemId}`);
    const { event } = removeMemoryFromRun(item, await this.ctx());
    await this.events.put(event);
    return (await this.itemById(itemId))!;
  }

  /** 忘れる（tombstone）。Owner 承認操作 — 3 つの UI 操作には含めない。 */
  async forget(itemId: string): Promise<MemoryItem> {
    const item = await this.itemById(itemId);
    if (!item) throw new Error(`unknown memory item: ${itemId}`);
    const { event } = forgetMemory(item, await this.ctx());
    await this.events.put(event);
    return (await this.itemById(itemId))!;
  }

  /** 通常 Run の記憶束（表層のみ＋trigger cue が当たった深層を Read Gate 通過分）。 */
  async runPacket(triggerText?: string): Promise<RunMemoryPacket> {
    return buildRunMemoryPacket(await this.listItems(), { triggerText });
  }

  /** 「+Antenna」— draft カードを作って保存（raw private text は載せない）。 */
  async draftAntenna(
    itemId: string,
    opts?: { summary?: string; cues?: string[] },
  ): Promise<AntennaContextCard> {
    const item = await this.itemById(itemId);
    if (!item) throw new Error(`unknown memory item: ${itemId}`);
    const card = createAntennaContextDraft(item, { cardId: this.genId("ant"), now: this.now() }, opts);
    await this.antenna.put(card);
    return card;
  }

  /** Antenna draft 一覧。 */
  async listAntennaDrafts(): Promise<AntennaContextCard[]> {
    return this.antenna.list();
  }

  /** projection を作って保存（sourceEventIds 必須・空なら throw）。 */
  async addProjection(input: {
    kind: MemoryProjectionKind;
    sourceEventIds: string[];
    value: unknown;
  }): Promise<MemoryProjection> {
    const proj = createMemoryProjection(input, { projectionId: this.genId("proj"), now: this.now() });
    await this.projections.put(proj);
    return proj;
  }

  async listProjections(): Promise<MemoryProjection[]> {
    return this.projections.list();
  }
}
