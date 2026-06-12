# 0010 設計ゲート文書 — item_ref と r15_edge（STOP②: サーバデータ新設）

状態: **ゲート待ち（design lead 対話 → Hiroto）。通過まで実装しない（/auto 停止線5）。**
起草: CC（便1・2026-06-12）／前提対話: Phase 0.5 第一便〜第三便（mutual 意味論・alias・dormant・遷移表）
参照: MEET_FINAL_SPEC §10（前室・edge）・§11（縁のライフサイクル）・§6（恒久条項）

## 0. 一文

サーバの合図をペア単位から**接点（edge）単位**へ引き上げ、その前提として公開項目に
**安定 identity（item_ref）**を与える。サーバが持つのは事実のみ — 遷移は owner の行為だけが書き、
解釈（dormant）は読み時に導出する。

## 1. item_ref — 公開項目の安定 identity

- **形**: 端末が mint する不透明な乱数 alias。owner-local の内部 item id とは無関係
  （既存境界「never a raw internal id」(lib/meet-memory/types.ts) を維持）。
  端末側に 内部id→alias の対応表を持つ（meet-memory レーン・owner-local）。
- **継続性（裁定済み意味論）**: 取り下げ→再公開で**同じ alias が続く** — 既存 edge が生き延びる
  （「縁は死なない」のデータ版）。完全削除時はプールから消えるが、edge の basis_item_ref は
  **歴史的ポインタ**として残り、表示は anchor に落ちる。
- **publish の変更**: DELETE＋全 INSERT → **(participant_ref, item_ref) キーの upsert ＋ 差分 DELETE**。
  position は表示順のみの列に降格（identity から外す）。
- DDL: `ALTER TABLE r15_pool_item ADD COLUMN item_ref TEXT NOT NULL DEFAULT '';`
  既存行は次回 publish（全置換）で自然に item_ref を得る — 五人テスト本番には適用しない（規律）。

## 2. r15_edge — スキーマ案

```sql
CREATE TABLE r15_edge (
  edge_id        TEXT PRIMARY KEY,            -- 端末 mint・不透明
  a_ref          TEXT NOT NULL,               -- この接点で最初に手を挙げた側（出自の記録）
  b_ref          TEXT NOT NULL,               -- 宛先
  basis_item_ref TEXT NOT NULL,               -- b の公開項目（提案の根拠・歴史的ポインタ）
  proposal_ptr   TEXT NOT NULL DEFAULT '',    -- a 端末の recv entry+card への不透明ポインタ（本文なし）
  anchor         TEXT NOT NULL DEFAULT '',    -- 紙の床: basis が消えても前室が読める一行
  from_name      TEXT NOT NULL,               -- a の公開 pseudonym（送信時点）
  state          TEXT NOT NULL CHECK (state IN ('sent','mutual','closed')),
  closed_by      TEXT NOT NULL DEFAULT '',    -- closed の actor ref（reason 列は作らない）
  created_at     TEXT NOT NULL,
  last_act_a_at  TEXT NOT NULL,               -- a の行為の最終時刻
  last_act_b_at  TEXT NOT NULL DEFAULT ''     -- b の行為の最終時刻（'' = まだ行為なし）
);
CREATE INDEX idx_r15_edge_a ON r15_edge (a_ref);
CREATE INDEX idx_r15_edge_b ON r15_edge (b_ref);
```

- サーバが持つもの＝**edge のメタデータのみ**: 参照2つ・根拠項目の alias・不透明ポインタ・anchor 一行・
  状態・actor・時刻。提案本文なし・点数なし・理由なし（憲法整合）。
- last_act を**片側ずつ**持つ理由: dormant 導出は max 側、§11-7「返事が来ていません（N日）」は
  **相手側の事実**をそのまま読む。一列だと自分の手入れと相手の沈黙が混ざり、正直な縁の状態が書けない。

## 3. 遷移表（権限の正本）

役割ガード: 全 mutation は token 由来 ref ∈ {a_ref, b_ref} を照合した上で、遷移別に役割を見る。

| # | 遷移 | 書ける者 | 行為（UI 語は命名ゲート） | ガード |
|---|---|---|---|---|
| T1 | ∅→sent | a | 話してみる（提案カードから） | **b が pool 在籍**（c18 完成形＝新 edge 行為のみ検証）・a≠b |
| T2 | sent→mutual | **b のみ** | talkBack「この接点で話したい」 | edge が closed でないこと。**pool 在籍は要求しない**（§4-b） |
| T3 | sent→closed | a | 合図の取り下げ（R2 台帳「合図削除API」の正体） | — |
| T4 | sent→closed | b | 静かに閉じる | — |
| T5 | mutual→closed | a・b 対称 | 畳む（礼文下書きは任意・§11-7） | — |
| T6 | closed→* | **誰も** | — | 終端。再会は同 pair の**新 edge**（T1） |
| — | dormant | **状態ではない** | — | 読み時導出: now − max(last_act_a, last_act_b) > TTL（仮90日・命名調整は後続） |

**眠る／目覚める × closed の関係（§11-8 との接続・一行定義）**:
dormant は導出であり、どちらかの行為で目覚める（dormant 由来の sent への T2 も可）。
closed は目覚めない — 同じ二人の再会は**新しい edge（T1）**で起きる。
縁の単位は edge、縁の連続性は pair 側に宿る（縁の使い捨て禁止は「同 pair の新 edge がいつでも立つ」ことで満たす）。

## 4. invariant（新設四本＋継承二本＋裁定二件）

新設（この table が新たに招く事故への防壁）:
1. **PX は遷移を書かない** — 全遷移に actor（a か b）が記録される。TTL・cron・サーバ判断による
   状態書き込みは存在しない（判定しないのデータ版・dormant が導出である理由と同根）。
2. **行為のみが last_act を動かす** — letter・note・札・畳む等の書き込みだけ。**読みは行為ではない**
   （閲覧で wake したら dormant 導出が既読通知の裏口になる — presence・既読の恒久禁止と同根）。
3. **anchor＝紙の床** — basis_item_ref が完全削除で引けなくなっても、前室は anchor で読める。
4. **closed に reason 列を作らない** — 取り下げ・断る・畳むはデータ上同一の closed＋closed_by。
   理由の分類は判定語彙の入口。語り分けは UI 文言（命名ゲート）だけに置く。

継承（既存恒久条項のスキーマ面への写し・このゲートで明文化）:
5. **item_ref 経由のみ** — raw internal id は公開射影・edge 行のどこにも乗らない
   （lib/meet-memory/types.ts の既存境界をサーバスキーマ側でも凍結）。
6. **pre-mutual の前室不開放** — edge 行は sent から存在するが、前室の中身（封書・接点メモ・連絡）の
   serve は mutual まで開かない。§10 恒久条項のデータ面への写しで、c 系の mutual-join SQL 文法を
   edge 版でも継承する（開示規則は serve の SQL に焼く）。

裁定済みの精密化（Phase 0.5 第三便）:
- **両方向 sent ≠ mutual** — mutual は「この接点で話したい」が両側で揃った状態。旧ペア単位の
  両方向 EXISTS は過渡形の意味論だった。「この相手は別の接点であなたに手を挙げています→見る」は
  **既存開示（incoming 表示）の横リンク**であり、新しい開示は発生しない。
- **contact の人単位開示テーブルは作らない** — 渡せるか＝∃mutual edge。渡ったものは封筒
  （E2EE・配達後非保持）として両端末の事実になる。`r15_contact_note` は移行裁定（⛔）後に退場する側。

## 5. 設計判断の記録（対話で合意済み）

- **(a) last_act 片側二列** — §2 のとおり。
- **(b) T2 は pool 在籍を要求しない** — edge は a 自身が手を挙げた記録＝この接点への同意は卓上にある。
  a がプール離脱後も b の talkBack は通り、前室は開き、封書は流れ、a は戻った日に読む。
  これが「プール離脱と可達性の分離」の完成形（c18「sent＋不在の一行」の正直な不在表示を前室に継承）。
- **(c) T4 の見え方** — c18b「押す前から正直に」に従い closed は a にも受動表示（理由なし・一語）。
  ⛔ b の閉じが a に見える語は**断罪にも謝罪にも読めない中立の一語**が要る（命名ゲート・社会圧の考慮）。

## 6. 過渡形の退場リスト（この設計の実装で引退するもの）

| 過渡形 | 退場の仕方 |
|---|---|
| ペア単位 signal（r15_signal PK(from,to)・両方向 EXISTS＝mutual） | r15_edge へ。既存行の扱いは ⛔backfill 裁定 |
| sent のペア単位表示（同一相手の全カード一斉「伝えてあります」） | edge 単位の状態表示へ |
| fnote_<peerRef>（第一信下書きの相手単位キー） | fnote_<edge_id> へ（spec §10 鮮度原則・edge に閉じ最新窓） |
| hidden-signals（localStorage の片づけレーン・クライアント化粧） | T3/T4 がサーバの事実になるためレーンごと引退 |
| c18 peer_not_in_pool の全面拒否 | T1 のみに縮退（新 edge 行為だけ検証・既存 edge は可達） |

**端末側レーンの所在**: fnote の edge キー化・hidden-signals の退場は**本文書の射程**（姉妹文書なし）。
ただし STOP② に当たるのはサーバ面のみ — 端末側は便2〜4 の実装裁量で、0010 通過が前提。

## 7. ⛔ 分岐を残す箇所（Hiroto 裁定待ち・設計は両対応）

- **backfill か白紙か**: 疑似 edge 案＝既存 mutual ペア → state=mutual・basis_item_ref=''・
  anchor=旧 signal.anchor・出自 `r15-pair` ラベル（遷移表とは無矛盾・T5/T6 だけ効く）。
  白紙案＝r15_* をテスト档案として凍結。**実装はどちらでも 0010 の DDL を変えない**
  （backfill は INSERT スクリプトの有無だけ）。
- 平文 r15_contact_note の終い方（予告つき終了時削除 vs 移行）。
- **裁定がどちらに出ても本文書は再ゲートしない** — 変わるのは backfill INSERT スクリプトの有無だけで、
  DDL・遷移表・invariant は両案で同一。

## 8. ゲート後の実装順（便2 案）

1. 0010 migration（dev D1 のみ）＋ publish の upsert 化＋端末側 alias 対応表
2. signal 経路の edge 化（T1/T2）＋ inbox の edge serve＋pin 追従
3. T3/T4/T5＋dormant 導出＋正直表示（不在・眠り・閉じ）
4. fnote の edge キー化＋hidden-signals 退場

## 裁可欄

design lead: 【通過 ／ 差し戻し】 → Hiroto: 【裁可 ／ 修正指示】
