// R2 GOAL — reverse-import（チャットポートが立てた行の取り込み）。`node --test`.

import { test } from "node:test";
import assert from "node:assert/strict";

import { MeetMemoryStore } from "./store.ts";
import { ItemAliasStore } from "./alias.ts";
import { InMemoryMeetBackend, InMemoryKeyedBackend } from "./backend.ts";
import { adoptPortItems, type PortServedItem } from "./portsync.ts";
import { isPlacedQuestion } from "./placed.ts";
import type { ItemAliasV1 } from "./alias.ts";

const REF_PORT = "ab12".repeat(4);
const REF_MINE = "cd34".repeat(4);

function setup() {
  const store = new MeetMemoryStore(new InMemoryMeetBackend());
  const aliases = new ItemAliasStore(new InMemoryKeyedBackend<ItemAliasV1>());
  return { store, aliases };
}

const portAntenna: PortServedItem = {
  itemRef: REF_PORT,
  kind: "want",
  title: "味噌づくり",
  text: "近所で味噌づくりを教えてくれる人いませんか",
  tags: ["問い"],
  business: false,
};

test("PS-1: an unknown served row becomes an owner-local entry with the SAME alias", async () => {
  const { store, aliases } = setup();
  const n = await adoptPortItems(store, aliases, [portAntenna]);
  assert.equal(n, 1);
  const items = await store.listRigItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].item.text, portAntenna.text, "本文 verbatim");
  assert.equal(items[0].item.private, false, "公開済みの事実をそのまま持つ");
  assert.ok(isPlacedQuestion(items[0].item), "アンテナは置いた問いとして見える");
  // alias continuity: 次の publish は port が mint した alias を送り続ける
  assert.equal(await aliases.getOrMint(items[0].entryId), REF_PORT);
});

test("PS-2: provenance is owner_imported_confirmed (the validator path, not a bypass)", async () => {
  const { store, aliases } = setup();
  await adoptPortItems(store, aliases, [portAntenna]);
  const all = await store.list();
  assert.equal(all[0].provenance, "owner_imported_confirmed");
});

test("PS-3: idempotent — a second sync adopts nothing", async () => {
  const { store, aliases } = setup();
  await adoptPortItems(store, aliases, [portAntenna]);
  const n2 = await adoptPortItems(store, aliases, [portAntenna]);
  assert.equal(n2, 0);
  assert.equal((await store.listRigItems()).length, 1);
});

test("PS-4: rows the device already owns (known alias) are never re-imported", async () => {
  const { store, aliases } = setup();
  const mine = await store.create({
    kind: "rig_item",
    provenance: "owner_written",
    value: { kind: "want", title: "庭", text: "庭仕事", tags: [], private: false },
  });
  await aliases.adopt(mine.entryId, REF_MINE);
  const n = await adoptPortItems(store, aliases, [
    { itemRef: REF_MINE, kind: "want", title: "庭", text: "庭仕事", tags: [], business: false },
  ]);
  assert.equal(n, 0);
  assert.equal((await store.listRigItems()).length, 1);
});

test("PS-5: fail-closed — off-shape kind / empty text are skipped, the rest adopt", async () => {
  const { store, aliases } = setup();
  const n = await adoptPortItems(store, aliases, [
    { ...portAntenna, itemRef: "11".repeat(8), kind: "profile" },
    { ...portAntenna, itemRef: "22".repeat(8), text: "   " },
    portAntenna,
  ]);
  assert.equal(n, 1);
});

test("PS-6: adopt never overwrites an existing alias binding (継続が勝つ)", async () => {
  const { aliases } = setup();
  await aliases.adopt("entry-1", REF_MINE);
  await aliases.adopt("entry-1", REF_PORT);
  assert.equal(await aliases.getOrMint("entry-1"), REF_MINE);
});

test("PS-7: business flag rides into the adopted entry", async () => {
  const { store, aliases } = setup();
  await adoptPortItems(store, aliases, [{ ...portAntenna, business: true }]);
  const items = await store.listRigItems();
  assert.equal(items[0].item.business, true);
});
