// PX Device Mesh — Hybrid Logical Clock（Phase C・verdict G3）。
// 設計: docs/r2/device-mesh-how-v0.3.md §6.4。
//
// HLC は **timeline 収束専用**。ranking / matching / candidate quality には一切流入させない（§6.4・M-14）。
// 文字列化は wall/counter をゼロ詰めして辞書式＝数値順、末尾 node で全順序＋deterministic tie-break。
// 純粋関数（WebCrypto も I/O も無し）。Date.now は呼ばない（呼び出し側が wall を渡す＝決定的にテスト可能）。

export type HLC = { wall: number; counter: number; node: string };

const WALL_PAD = 15;
const CTR_PAD = 6;

/** ローカル事象の stamp。同一/過去 wall なら counter を進める（単調）。 */
export function hlcStamp(prev: HLC | null, wallNow: number, node: string): HLC {
  if (prev !== null && prev.wall >= wallNow) return { wall: prev.wall, counter: prev.counter + 1, node };
  return { wall: wallNow, counter: 0, node };
}

/** 受信時の merge。local と remote と wallNow の最大 wall に揃え、counter を進める（causal 単調）。 */
export function hlcReceive(local: HLC | null, remote: HLC, wallNow: number, node: string): HLC {
  const lw = local?.wall ?? 0;
  const maxWall = Math.max(wallNow, lw, remote.wall);
  if (maxWall === lw && maxWall === remote.wall) {
    return { wall: maxWall, counter: Math.max(local?.counter ?? 0, remote.counter) + 1, node };
  }
  if (maxWall === lw) return { wall: maxWall, counter: (local?.counter ?? 0) + 1, node };
  if (maxWall === remote.wall) return { wall: maxWall, counter: remote.counter + 1, node };
  return { wall: maxWall, counter: 0, node };
}

/** 全順序の比較キー（辞書式＝数値順）。node が deterministic tie-break。 */
export function hlcToString(h: HLC): string {
  return `${String(h.wall).padStart(WALL_PAD, "0")}:${String(h.counter).padStart(CTR_PAD, "0")}:${h.node}`;
}

export function parseHlc(s: string): HLC | null {
  const m = /^(\d{1,15}):(\d{1,6}):(.+)$/.exec(s);
  if (m === null) return null;
  return { wall: Number(m[1]), counter: Number(m[2]), node: m[3] };
}

/** 文字列 HLC の比較（-1/0/1）。辞書式で十分（ゼロ詰め済み）。 */
export function hlcCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** createdAt（ISO）から HLC 形の順序プレフィックスを導く（hlc 不在 record の決定的 fallback）。
 *  counter=0・node 無し。最終 tie-break は merge 側で recordId が担う。 */
export function hlcFromCreatedAt(createdAt: string): string {
  const t = Date.parse(createdAt);
  return `${String(Number.isNaN(t) ? 0 : t).padStart(WALL_PAD, "0")}:${"0".padStart(CTR_PAD, "0")}:`;
}
