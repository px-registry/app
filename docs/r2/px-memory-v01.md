# PX Memory v0.1 — 設計 / spec

PX の Memory は、Owner の端末上にある **append-only な記憶基層**。Owner が表に置きたい
ものだけを選び、それ以外は端末に保持されるが通常 Run では読まれない。奥は毎回読まず、
Owner の言葉 / Antenna / Run / Talk の文脈が **trigger** になった時だけ、AI が必要な範囲で
掘る。蒸留・タグ・claim・embedding は作ってよいが、すべて **projection** であり Raw Memory
の置き換えではない。

実装 lane: `lib/px-memory/`（**隔離** — 既存 `lib/meet-memory` の live 層に entangle しない・
fetch を持たない・サーバ非接触）。UI: `lib/px-memory/ui/MemoryCardList.tsx`（presentational・
**未配線**）。

---

## 1. 設計不変（型と Read Gate で固める）

1. Raw Memory は append-only な `MemoryEvent`。生まれた後は不変、**物理削除しない**
   （忘却も forget event = tombstone で append）。
2. 表層 / 深層 / Antenna-ready / hidden は **重要度ではなく Owner が選んだ placement**。
   placement は **内部値のみ** — Owner-facing UI には出さない。
3. tag / cue は重要度ではなく、**読み時に掘るための trigger**。
4. distillation / summary / claim / embedding / relation は **projection** であり、
   `sourceEventIds`（非空）を必ず持つ。projection は source of truth ではない。
5. 通常 Run は **Surface Memory だけ**読む。
6. Deep Memory は `triggerText` から cue が当たった時だけ検索対象にする。
7. Deep から拾った Memory は **Read Gate** を通してから AI に渡す。
8. **[+Antenna] は Raw Memory 公開ではなく**、`AntennaContextCard` の *draft* を作る操作。
9. Owner 承認なしに、Memory を表層化・Antenna 公開・忘却・外部送信しない。
10. PX server に Raw Memory / Deep Memory / private embedding / raw 会話を送らない。

---

## 2. Owner-facing UX（重要）

Owner-facing UI に「深くしまう」「Deep」「表層」「深層」を **出さない**。Owner は、表に
置きたい Memory だけを選べばよい。選ばれなかった Memory は、内部的に deep（default-hidden）
として保持される — これを管理操作として見せない。

Owner-facing な操作は 3 つだけ:

| 操作 | UI | 内部 |
| --- | --- | --- |
| **残す** | チェック ON（言葉でなく affordance） | `moveMemoryToSurface` → placement `surface` |
| **外す** | チェック OFF | `removeMemoryFromRun`(=`stowMemoryDeep`) → placement `deep`（raw event は消さない） |
| **+Antenna** | 明示ボタン「+Antenna」 | `createAntennaContextDraft` → draft（raw を載せない） |

Copy 規律: 「深くしまう」を使わない／基本は「残す」／ボタンは「+Antenna」／通常 Run から
外す意味では「外す」（≠削除）／「重要度・スコア・おすすめ・マッチング・ランキング」を
使わない。`px-memory-gates.test.ts` PM-10 が `PX_MEMORY_COPY` を scan して照合する。

UX の流れ:
1. AI または Owner 入力から Memory candidate が生まれる（`capture`・既定 placement deep）。
2. Owner が「残す」を選んだものだけ、通常 Run で読まれる。
3. 選ばれなかったものは端末に保持されるが通常 Run では読まれない。
4. 必要な時だけ、文脈を trigger に cue 経由で奥を掘る。
5. 掘ったものは Read Gate を通してから AI に渡す。
6. 「+Antenna」したものだけ Antenna surface に出る候補（draft）になる。
7. Raw Memory そのものは公開しない。

---

## 3. モデル（`lib/px-memory/types.ts`）

- `MemoryEvent` — append-only union: `capture`（中身を持つ）/ `place`（placement 変更）/
  `forget`（tombstone）。`seq` は端末ローカル単調増加・穴なし＝長さ。
- `MemoryItem` — events を畳んだ「今の見え方」。`placement`（既定 `deep`）・`forgotten`・
  `sourceEventIds`（常に非空）。source of truth ではない。
- `MemoryReadPlacement` — `surface | deep | antenna_ready | antenna_public | hidden`（**内部のみ**）。
- `MemoryProjection` — `sourceEventIds: [string, ...string[]]`（型で非空を要求）。
- `ReadGateDecision` — `{ allow, redactRaw, reason }`。
- `AntennaContextCard` — `includesRawText: false`（hard invariant）・`status: "draft"`・
  `summary` 既定空。

## 4. 関数（PURE・`lib/px-memory/`）

`createMemoryEvent` / `createMemoryItemFromEvent` / `moveMemoryToSurface` / `stowMemoryDeep`
（=`removeMemoryFromRun`）/ `forgetMemory` / `foldMemoryItems` / `createMemoryProjection` /
`buildRunMemoryPacket` / `applyReadGate` / `createAntennaContextDraft`。すべて id/seq/now を
ctx で注入＝決定的。順序は比較ソートを使わず `seq` 位置で並べる（px-guard の dot-sort 禁止に
沿う）。

## 5. ストア（`store.ts` / `indexeddb.ts`・隔離）

`PxMemoryStore` が backend（テスト=`InMemoryBackend`／ブラウザ=`IndexedDbMemoryBackend`・
**別 DB `px-memory-v01`**）を巻き取る。変異経路は capture / keepInRun(残す) /
removeFromRun(外す) / forget / draftAntenna / addProjection だけ。in-place 変異なし。

## 6. テスト（`px-memory-gates.test.ts`・PM-1..11）

未選択=deep ／ 未選択は保持されるが Run 除外 ／ 残すだけが Run に入る ／ 外すは Run から外す
（raw 保持）／ deep は cue 無しで除外 ／ deep は cue + Read Gate でだけ拾う ／ projection は
sourceEventIds 無しで作れない ／ +Antenna は draft（raw 非載）／ hidden は Read Gate が除外 ／
Owner copy は禁止語なし ／ store 一周 append-only。

## 7. Owner 向け残課題（v0.1 で止めた所）

- **UI 配線**: `MemoryCardList` は presentational・未配線。live nav（記憶ページ等）への
  組み込みは Owner-gated な surface 変更 → Owner Go 待ち。
- **antenna_public（公開）**: v0.1 は draft までで止める。公開は Owner 承認の別経路（未実装）。
- **projection の生成者**: 蒸留/embedding を「いつ・何から作るか」は未配線（型と入口だけ）。
  STAGE_B（予測誤差ゲーティング）の規律に乗せて後便で設計。
- **provenance `ai_candidate`**: AI 提案 candidate を capture する入口は型にあるが、AI 側の
  配線は未実装（AI が自動で表層化・公開しないのが Hard STOP）。
