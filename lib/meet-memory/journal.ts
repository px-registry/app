// 記憶装置 層1a — MemJournalStore（append-only の長さ・owner-local）。
//
// 設計正本: PX_MEMORY_DEVICE_thread v0.7 §0/§0.7。
//   書く時は長さだけを守る — 生・無加工・届いた順・append-only。
//   読む時に層が生まれる — このファイルは保存（長さ）だけ。深さ・層は読み側（層1b）。
//
// この store は **update() を持たない**。訂正は supersede（前の recordId を指す新
// レコードの append）、忘却は forget event（tombstone・物理削除しない=seq に穴を
// 空けない）。in-place 変異は型でも実装でも不可能。
//
// 並べ替えは「順位付け」ではない: seq は単調増加・穴なしなので、比較ソートを使わず
// **位置（seq）で並べる**（px-guard の .sort 禁止＝ranking 忍び込み防止に正面から沿う）。

import { validateJournalRecord } from "./validate.ts";
import type { KeyedBackend } from "./backend.ts";
import type {
  MemJournalRecordV1,
  NewContentRecordV1,
  NewEventRecordV1,
} from "./journal-types.ts";

export type JournalBackend = KeyedBackend<MemJournalRecordV1>;

function defaultGenId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `mem_${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

/**
 * 届いた順（seq 昇順）に並べる。比較ソートではなく seq を配列の添字に置くだけ —
 * append-only で穴がないので dense に埋まる（import 由来の穴があっても hole を
 * 落として順序は保つ）。同 seq は起こらない不変だが、起きても落ちず last-wins。
 */
function orderBySeq(records: MemJournalRecordV1[]): MemJournalRecordV1[] {
  let max = -1;
  for (const r of records) if (r.seq > max) max = r.seq;
  const slots: (MemJournalRecordV1 | undefined)[] = new Array(max + 1);
  for (const r of records) slots[r.seq] = r;
  return slots.filter((r): r is MemJournalRecordV1 => r !== undefined);
}

export class MemJournalStore {
  private backend: JournalBackend;
  private now: () => string;
  private genId: () => string;

  constructor(backend: JournalBackend, opts?: { now?: () => string; genId?: () => string }) {
    this.backend = backend;
    this.now = opts?.now ?? (() => new Date().toISOString());
    this.genId = opts?.genId ?? defaultGenId;
  }

  /** Records in stored order (by seq). The length, oldest → newest. */
  async list(): Promise<MemJournalRecordV1[]> {
    return orderBySeq(await this.backend.list());
  }

  /**
   * 控えからの復元 — put a fully-formed record VERBATIM (recordId / seq / createdAt
   * preserved), fail-closed. This is reconstituting the length, not a new write,
   * so it bypasses seq assignment but NOT the validator. Returns false (skipped)
   * on a malformed record. Same-recordId → overwritten (backup wins).
   */
  async restore(rec: MemJournalRecordV1): Promise<boolean> {
    const r = validateJournalRecord(rec);
    if (!r.ok) return false;
    await this.backend.put(rec);
    return true;
  }

  async get(recordId: string): Promise<MemJournalRecordV1 | undefined> {
    return this.backend.get(recordId);
  }

  /** Records after `seq` (exclusive), in order — recency窓 / sync の入口。 */
  async listSince(seq: number): Promise<MemJournalRecordV1[]> {
    return (await this.list()).filter((r) => r.seq > seq);
  }

  /** Next seq — max existing + 1 (empty → 0). Append-only ⇒ no gaps, ever. */
  private async nextSeq(): Promise<number> {
    const all = await this.backend.list();
    let max = -1;
    for (const r of all) if (r.seq > max) max = r.seq;
    return max + 1;
  }

  private async appendRecord(
    rec: Omit<MemJournalRecordV1, "recordId" | "seq" | "createdAt">,
  ): Promise<MemJournalRecordV1> {
    const full = {
      ...rec,
      recordId: this.genId(),
      seq: await this.nextSeq(),
      createdAt: this.now(),
    } as MemJournalRecordV1;
    const r = validateJournalRecord(full);
    if (!r.ok) throw new Error(`invalid journal record: ${r.error}`);
    await this.backend.put(full);
    return full;
  }

  /** Append a content record (the only way 中身 enters the length). */
  async append(input: NewContentRecordV1): Promise<MemJournalRecordV1> {
    return this.appendRecord({
      recordType: "content",
      contentKind: input.contentKind,
      provenance: input.provenance,
      sourceRef: input.sourceRef,
      body: input.body,
      ...(input.witnessSource !== undefined ? { witnessSource: input.witnessSource } : {}),
      ...(input.supersedes !== undefined ? { supersedes: input.supersedes } : {}),
    } as Omit<MemJournalRecordV1, "recordId" | "seq" | "createdAt">);
  }

  /** Append an event (surface=上げる / forget=忘れる). body を持たない。 */
  async appendEvent(input: NewEventRecordV1): Promise<MemJournalRecordV1> {
    return this.appendRecord({
      recordType: "event",
      eventKind: input.eventKind,
      provenance: input.provenance,
      sourceRef: input.sourceRef,
      targetRef: input.targetRef,
    } as Omit<MemJournalRecordV1, "recordId" | "seq" | "createdAt">);
  }

  /**
   * 訂正の鎖 — append a content record that supersedes `targetRecordId`. 上書き
   * でなく堆積: the old record stays in the length; the fold prefers the head.
   */
  async supersede(
    targetRecordId: string,
    input: Omit<NewContentRecordV1, "supersedes">,
  ): Promise<MemJournalRecordV1> {
    return this.append({ ...input, supersedes: targetRecordId });
  }

  // ── 読み時畳み込みの primitive（最新優先・層1b の reading はこの上に建てる）──────

  /** 各 targetRef の最新 event（seq 最大が勝つ）。surface/forget の現在状態。 */
  async latestEventByTarget(): Promise<Map<string, "surface" | "forget">> {
    const out = new Map<string, "surface" | "forget">();
    for (const r of await this.list()) {
      if (r.recordType === "event") out.set(r.targetRef, r.eventKind); // list() は seq 昇順 ⇒ 最後勝ち
    }
    return out;
  }

  /** supersede されたことのある recordId 全部（鎖の非 head 側）。 */
  async supersededIds(): Promise<Set<string>> {
    const out = new Set<string>();
    for (const r of await this.backend.list()) {
      if (r.recordType === "content" && r.supersedes) out.add(r.supersedes);
    }
    return out;
  }

  /**
   * 既定ビューの種 — content の head（未 supersede）で、最新 event が forget でない
   * もの。最新優先（鎖も忘却も seq 最大が勝つ）。これは store API 段の畳み込みで、
   * その日の問いで切る深さ・層は読み側（層1b）が乗せる。
   */
  async heads(): Promise<MemJournalRecordV1[]> {
    const superseded = await this.supersededIds();
    const events = await this.latestEventByTarget();
    return (await this.list()).filter(
      (r) =>
        r.recordType === "content" &&
        !superseded.has(r.recordId) &&
        events.get(r.recordId) !== "forget",
    );
  }
}
