// R1.5 meet memory — owner-local store (Stage B lineage: lib/owner-memory/store.ts).
//
// The single write path for the R1.5 memory substrate. Every create/update runs
// through the validator (provenance required; AI-authored entries refused), and
// there is NO method that writes an un-validated entry. Nothing here calls a
// network: read / edit / export / IMPORT / delete all happen on the owner's
// device. STOP #2 (hybrid): durable owner-local + versioned JSON backup both
// ways — exportAll() downloads a copy the owner keeps, importBackup() restores
// it fail-closed (validated entry by entry, never throws).

import { validateNewEntry, validateStoredEntry } from "./validate.ts";
import type { MeetBackend } from "./backend.ts";
import type { MemJournalStore } from "./journal.ts";
import type { MemJournalRecordV1 } from "./journal-types.ts";
import type { SealedKeyV1 } from "../meet-crypto/seal.ts";
import type {
  MeetMemoryEntryV1,
  MeetEntryKind,
  MeetRigItemV1,
  NewMeetEntry,
  QuestionValue,
  ProfileValue,
  MaskListValue,
} from "./types.ts";

export const MEET_EXPORT_FORMAT = "px.meet-memory/v1";
/** 記憶装置 層1a — 控えは v2 へ（journal 同梱・sealedKey 任意）。v1 は黙って読む。 */
export const MEET_EXPORT_FORMAT_V2 = "px.meet-memory/v2";

/** Machine-readable backup (v1) — provenance included, no server fields. */
export type MeetMemoryExportV1 = {
  format: typeof MEET_EXPORT_FORMAT;
  exportedAt: string;
  entries: MeetMemoryEntryV1[];
};

/**
 * 控え v2 — substrate entries ＋ 記憶装置 journal の長さ ＋ 任意の封緘鍵。
 * sealedKey は passphrase 設定時のみ存在（不在＝秘密鍵は控えに出ない=安全既定の保存）。
 * 平文の私有スカラ "d" はここに現れない（鍵は seal.ts で封緘形＝opaque ciphertext）。
 */
export type MeetMemoryExportV2 = {
  format: typeof MEET_EXPORT_FORMAT_V2;
  exportedAt: string;
  entries: MeetMemoryEntryV1[];
  journal: MemJournalRecordV1[];
  sealedKey?: SealedKeyV1;
};

export type ImportReport = {
  added: number;
  updated: number;
  rejected: number;
  /** 記憶装置 journal の復元数（v2 控えのみ・v1 では 0）。 */
  journalRestored: number;
  journalRejected: number;
  warnings: string[];
};

function defaultGenId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `meet_${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export class MeetMemoryStore {
  private backend: MeetBackend;
  private now: () => string;
  private genId: () => string;
  /** 記憶装置 journal — 控え v2 の同梱対象。未配線でも substrate は単独で動く。 */
  private journal?: MemJournalStore;

  constructor(
    backend: MeetBackend,
    opts?: { now?: () => string; genId?: () => string; journal?: MemJournalStore },
  ) {
    this.backend = backend;
    this.now = opts?.now ?? (() => new Date().toISOString());
    this.genId = opts?.genId ?? defaultGenId;
    this.journal = opts?.journal;
  }

  list(): Promise<MeetMemoryEntryV1[]> {
    return this.backend.list();
  }
  async listByKind(kind: MeetEntryKind): Promise<MeetMemoryEntryV1[]> {
    return (await this.backend.list()).filter((e) => e.kind === kind);
  }
  /** The rig items, in stored order — the SELF grounding substrate. */
  async listRigItems(): Promise<Array<{ entryId: string; item: MeetRigItemV1 }>> {
    const out: Array<{ entryId: string; item: MeetRigItemV1 }> = [];
    for (const e of await this.backend.list()) {
      if (e.kind === "rig_item") out.push({ entryId: e.entryId, item: e.value });
    }
    return out;
  }

  /**
   * Create from an explicit owner submission. Throws when the candidate fails
   * validation (bad provenance / unknown kind / un-typed value) — this is the
   * line an AI-authored "fact" cannot cross.
   */
  async create(input: NewMeetEntry): Promise<MeetMemoryEntryV1> {
    const r = validateNewEntry(input);
    if (!r.ok) throw new Error(`invalid entry: ${r.error}`);
    const at = this.now();
    const entry = {
      entryId: this.genId(),
      provenance: input.provenance,
      kind: input.kind,
      value: input.value,
      createdAt: at,
      updatedAt: at,
    } as MeetMemoryEntryV1;
    await this.backend.put(entry);
    return entry;
  }

  /** Edit an entry's typed value (same kind). Re-validates before writing. */
  async update(id: string, value: MeetMemoryEntryV1["value"]): Promise<MeetMemoryEntryV1> {
    const existing = await this.backend.get(id);
    if (!existing) throw new Error("entry not found");
    const candidate = { kind: existing.kind, provenance: existing.provenance, value };
    const r = validateNewEntry(candidate);
    if (!r.ok) throw new Error(`invalid entry: ${r.error}`);
    const updated = { ...existing, value, updatedAt: this.now() } as MeetMemoryEntryV1;
    await this.backend.put(updated);
    return updated;
  }

  remove(id: string): Promise<void> {
    return this.backend.remove(id);
  }

  /** Clear the entire local store. Never calls a server (PX holds no body). */
  clear(): Promise<void> {
    return this.backend.clear();
  }

  // ── singletons (question / profile are one logical instance, upserted) ──────

  async getQuestion(): Promise<string> {
    const all = await this.listByKind("question");
    return all.length > 0 && all[0].kind === "question" ? all[0].value.text : "";
  }
  async setQuestion(text: string): Promise<void> {
    await this.upsertSingleton("question", { text });
  }
  async getProfile(): Promise<ProfileValue | null> {
    const all = await this.listByKind("profile");
    return all.length > 0 && all[0].kind === "profile" ? all[0].value : null;
  }
  async setProfile(value: ProfileValue): Promise<void> {
    await this.upsertSingleton("profile", value);
  }
  /** 補遺 E: 伏せたい言葉 — one owner-wide list (device-local, backed up too). */
  async getMaskWords(): Promise<string[]> {
    const all = await this.listByKind("mask_list");
    return all.length > 0 && all[0].kind === "mask_list" ? all[0].value.words : [];
  }
  async setMaskWords(words: string[]): Promise<void> {
    await this.upsertSingleton("mask_list", { words });
  }
  private async upsertSingleton(
    kind: "question" | "profile" | "mask_list",
    value: QuestionValue | ProfileValue | MaskListValue,
  ): Promise<void> {
    const all = await this.listByKind(kind);
    if (all.length > 0) {
      await this.update(all[0].entryId, value);
    } else {
      await this.create({ kind, provenance: "owner_written", value } as NewMeetEntry);
    }
  }

  // ── backup (STOP #2 hybrid: export AND import) ──────────────────────────────

  /**
   * 控え v2 — substrate entries ＋ journal の長さ（配線時）＋ 任意の封緘鍵。
   * sealedKey は呼び手が passphrase 設定時にだけ渡す。渡さなければ不在＝秘密鍵は
   * 控えに一切出ない（安全既定の保存）。journal 未配線なら journal: []（v1 互換の中身）。
   */
  async exportAll(opts?: { sealedKey?: SealedKeyV1 }): Promise<MeetMemoryExportV2> {
    const out: MeetMemoryExportV2 = {
      format: MEET_EXPORT_FORMAT_V2,
      exportedAt: this.now(),
      entries: await this.backend.list(),
      journal: this.journal ? await this.journal.list() : [],
    };
    if (opts?.sealedKey !== undefined) out.sealedKey = opts.sealedKey;
    return out;
  }

  /**
   * Restore from a backup JSON string. FAIL-CLOSED and never throws: a bad
   * format / syntax error rejects everything; each entry is re-validated and a
   * broken one is skipped with a warning. Same id → overwritten (the backup
   * wins); new id → added. Nothing is deleted. Accepts BOTH v1 and v2 (v2 carries
   * the journal; v1 silently has none).
   */
  async importBackup(json: string): Promise<ImportReport> {
    const report: ImportReport = {
      added: 0,
      updated: 0,
      rejected: 0,
      journalRestored: 0,
      journalRejected: 0,
      warnings: [],
    };
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      report.warnings.push("控えのJSONを読み取れませんでした。");
      return report;
    }
    if (typeof raw !== "object" || raw === null) {
      report.warnings.push("この形式の控えではありません。");
      return report;
    }
    const obj = raw as Record<string, unknown>;
    const isV1 = obj.format === MEET_EXPORT_FORMAT;
    const isV2 = obj.format === MEET_EXPORT_FORMAT_V2;
    if ((!isV1 && !isV2) || !Array.isArray(obj.entries)) {
      report.warnings.push("この形式の控えではありません。");
      return report;
    }
    for (const entry of obj.entries as unknown[]) {
      const r = validateStoredEntry(entry);
      if (!r.ok) {
        report.rejected += 1;
        report.warnings.push(`壊れた項目をひとつ除外しました（${r.error}）。`);
        continue;
      }
      const typed = entry as MeetMemoryEntryV1;
      const existing = await this.backend.get(typed.entryId);
      await this.backend.put(typed);
      if (existing) report.updated += 1;
      else report.added += 1;
    }
    // v2: 記憶装置 journal の長さを復元（配線時のみ・fail-closed・verbatim）。
    if (isV2 && Array.isArray(obj.journal) && this.journal) {
      for (const rec of obj.journal as unknown[]) {
        const ok = await this.journal.restore(rec as MemJournalRecordV1);
        if (ok) report.journalRestored += 1;
        else {
          report.journalRejected += 1;
          report.warnings.push("壊れた記憶レコードをひとつ除外しました。");
        }
      }
    }
    return report;
  }
}
