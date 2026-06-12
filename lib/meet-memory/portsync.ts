// R2 GOAL — チャットポートの reverse-import（取り込み）。
//
// port（あなたのAI・owner の確認つき）が additive に立てた公開行は、まずサーバの
// 公開面にだけ存在する。端末はここで、自分の公開面（inbox.myItems）のうち alias
// 対応表に無い行を owner-local 記憶へ取り込み、alias を結びつける。以後その項目は
// 端末が正本を持ち、publish の atomic replace で消えない（alias 継続 = 0010 §1）。
//
// 取り込みの階級: provenance は owner_imported_confirmed — owner が承認した自分の
// 行為（ツール承認）に由来する自分の公開文。AI が勝手に書いた「事実」はそもそも
// この行に現れない（port の書き込みは owner 確認後にしか走らない）。
//
// fetch しない・ネットワークを知らない（MN gate）— 材料は呼び出し側が渡す。

import type { MeetMemoryStore } from "./store.ts";
import type { ItemAliasStore } from "./alias.ts";
import type { MeetRigItemV1 } from "./types.ts";

export type PortServedItem = {
  itemRef: string;
  kind: string;
  title: string;
  text: string;
  tags: string[];
  business: boolean;
};

const RIG_KINDS = new Set(["have", "want", "avoid", "memory"]);

/**
 * Import items the device does not know yet. Returns how many were adopted.
 * fail-closed: off-shape kinds are skipped (server rows are validated, but the
 * device re-checks — it is about to make them its own memory).
 */
export async function adoptPortItems(
  store: MeetMemoryStore,
  aliases: ItemAliasStore,
  served: PortServedItem[],
): Promise<number> {
  if (served.length === 0) return 0;
  const known = await aliases.knownRefs();
  let adopted = 0;
  for (const it of served) {
    if (known.has(it.itemRef)) continue; // 端末が既に正本を持つ
    if (!RIG_KINDS.has(it.kind)) continue; // fail-closed
    if (it.text.trim() === "") continue;
    const value: MeetRigItemV1 = {
      kind: it.kind as MeetRigItemV1["kind"],
      title: it.title,
      text: it.text,
      tags: [...it.tags],
      // 公開面から来た行 — 公開済みである事実をそのまま持つ（取り下げは owner の編集）
      private: false,
      ...(it.business ? { business: true } : {}),
    };
    const entry = await store.create({
      kind: "rig_item",
      provenance: "owner_imported_confirmed",
      value,
    });
    await aliases.adopt(entry.entryId, it.itemRef);
    adopted += 1;
  }
  return adopted;
}
