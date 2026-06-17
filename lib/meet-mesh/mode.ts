// PX Device Mesh — mesh write の mode 判定（cutover-plan v0.2 §B.0 正本）。
// 純粋関数（I/O 無し・client と Functions が同一実装を読む）。**server authoritative**:
// 実際の許否は Functions が env(cap/allowlist)＋KV(mode)＋passkey 由来の owner_ref で決める。
// client は capability 表示にこの結果を使ってよいが、client 判断で write を通さない。
//
// fail-closed: env 欠落/不正・KV 欠落/不正/読み取り失敗・owner_ref 不在 → すべて off（＝書けない）。
// effective = min(KV:MESH_MODE, MESH_MODE_CAP)。off < allowlist < on（速い lever は cap の枠を超えられない）。

import { isOwnerRef } from "../meet-crypto/mesh.ts";

export type MeshMode = "off" | "allowlist" | "on";
const RANK: Record<MeshMode, number> = { off: 0, allowlist: 1, on: 2 };

export function parseMeshMode(v: unknown): MeshMode | null {
  return v === "off" || v === "allowlist" || v === "on" ? v : null;
}

/** effective = min(KV, cap)。どちらか欠落/不正なら **off**（fail-closed）。 */
export function effectiveMeshMode(cap: unknown, kvMode: unknown): MeshMode {
  const c = parseMeshMode(cap);
  const k = parseMeshMode(kvMode);
  if (c === null || k === null) return "off";
  return RANK[k] <= RANK[c] ? k : c;
}

/** env の allowlist（comma 区切り）を owner_ref の配列へ。形不正は捨てる。 */
export function parseAllowlist(env: unknown): string[] {
  if (typeof env !== "string" || env.trim() === "") return [];
  return env
    .split(",")
    .map((s) => s.trim())
    .filter((s) => isOwnerRef(s));
}

/**
 * この owner が mesh write してよいか（fail-closed）。
 * off → 不可。on → 可。allowlist → allowlist に居る owner だけ。owner_ref 不在は不可。
 */
export function meshWriteAllowed(mode: MeshMode, ownerRef: string | null | undefined, allowlist: readonly string[]): boolean {
  if (typeof ownerRef !== "string" || !isOwnerRef(ownerRef)) return false;
  if (mode === "on") return true;
  if (mode === "allowlist") return allowlist.includes(ownerRef);
  return false; // off（既定）
}

/**
 * bootstrap allowlist（passkey handle ベース）の env を配列へ。
 * owner_ref と違い handle は任意文字列ゆえ形フィルタしない（空だけ捨てる）。
 */
export function parseHandleAllowlist(env: unknown): string[] {
  if (typeof env !== "string" || env.trim() === "") return [];
  return env
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * **新規 owner の bootstrap（register）可否**（owner_ref を mint する前の判定・fail-closed）。
 * handle は **passkey session 由来**（server が HMAC 検証して解決・client 申告でない）。
 * off → 不可。on → 可（global on は別 Go）。allowlist → handle が bootstrap allowlist に居るときだけ。
 * handle 不在は不可。これで allowlist mode の register を「5 人」に閉じる（registry 行の blast radius を絞る）。
 */
export function bootstrapAllowed(mode: MeshMode, handle: string | null | undefined, handleAllowlist: readonly string[]): boolean {
  if (typeof handle !== "string" || handle === "") return false;
  if (mode === "on") return true;
  if (mode === "allowlist") return handleAllowlist.includes(handle);
  return false; // off（既定）
}
