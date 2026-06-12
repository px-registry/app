# 0013 設計ゲート文書 — E2EE 封筒と鍵配布（STOP②: サーバデータ新設・Wave 1 の床）

状態: **ゲート待ち（design lead 対話 → Hiroto）。通過まで実装しない（/auto 停止線5）。**
起草: CC（便5・2026-06-12）
参照: spec §10（封書三種・配達後非保持・通数従量禁止・圧なし）・§6（鍵と私的記憶は端末）・
§14（トーク／ノート／渡す）・§15（edge 状態機械）・0010（mutual edge＝開示述語）

## 0. 一文

封書（メッセージ／ノート／渡す）の本文を**端末で施錠し、端末で開ける**。PX は ciphertext を
運ぶだけ — 本文は一度も読めず、メッセージは配達後に持たない。鍵は端末で生まれ、公開鍵だけが
公開射影と同じ階級で配られる。

## 1. 核心 — 誰が・いつ・何を復号できるか（この表がゲートの本体）

| もの | 暗号化 | 復号できる者 | できない者 | PX に見えるもの |
|---|---|---|---|---|
| **メッセージ**（トークの便り・流れる） | 封筒ごと ephemeral ECDH＋AES-GCM | **宛先の端末だけ**（送り手は自分の端末の平文原本を持つ — owner-held 転写） | PX・進行役（research mode でも本文不可読）・第三者 | edge・送信時刻・ciphertext サイズ・種別 |
| **ノート**（edge に立つ一枚・編集可） | 同方式（編集ごとに再封） | **相手の端末**＋自分の端末原本。読者明示「相手と、相手のAIが読めます。」のとおり | 同上 | 同上＋「立っている」という事実 |
| **渡す**（contact） | 同方式 | **相手の端末だけ** | 同上 | 同上 |
| **秘密鍵** | — | 持ち主の端末のみ（IndexedDB・export は §6 裁量点） | 全員 | 存在しない（サーバに来ない） |
| **公開鍵** | 平文（公開物） | — | — | enc_pub 全体（公開射影と同じ階級） |
| **メタデータ** | 暗号化しない | — | — | **誰と誰が・いつ・どれだけ**（正直条項: PX は本文を読めないが、往復の存在と頻度は見える。隠すと嘘になるので明記する） |

**到達しない者の列挙（fail-closed の言い切り）**: PX サーバ／進行役（research mode 含む — テスト開示
レーンは log と edge メタまで）／同じ部屋の第三者／カットオーバー後の運営者。

## 2. 鍵 — 生成・配布・失う日

- **生成**: 端末が WebCrypto で ECDH **P-256** 鍵対を mint（owner token と同じ「端末の中だけ」階級。
  X25519 は WebCrypto 対応がまだ端末差あり — P-256 を v1 とし、世代欄で差し替え可能にする）。
- **配布**: 公開鍵はサーバの **r15_enc_key** に置く（下記 DDL）。公開射影と同じ「owner が出した
  公開物」階級だが、**プール離脱で消えない** — 可達性分離（T2/封筒は pool 在籍不要）が鍵にも要るため。
- **鍵の真正性（脅威モデルの正直な線引き）**: v1 の鍵配布は PX 経由 — **PX が悪意なら鍵すり替えが
  理論上可能**（honest-but-curious を超える脅威には未対応）。緩和は①鍵指紋を両端末で表示し
  外部チャネルで照合**できる**ようにする（任意・圧にしない）②鍵変更を相手の画面で事実表示
  （「鍵が変わりました」— 判定なしの一行）。完全な対抗（key transparency / 印=seal との結合）は
  R3 以降の宿題として明記。
- **失う日**: 端末データ消去＝秘密鍵消滅＝**過去の封筒は開けなくなる**（PX は復旧できない —
  それが E2EE の値段。正直な caveat を UI に）。⛔裁量点: 控えを保存（export）に秘密鍵を含めるか
  （含める=持ち運び可・漏えい面増／含めない=端末固定）。**起草者の傾き: 含める**（記憶 export と
  同じ「owner の資産は owner の手に」）。

## 3. スキーマ案

```sql
-- 0014（実装時の連番）
CREATE TABLE r15_enc_key (
  participant_ref TEXT PRIMARY KEY,
  enc_pub         TEXT NOT NULL,            -- JWK(P-256 public)・公開物
  gen             INTEGER NOT NULL DEFAULT 1, -- 鍵世代（変更の事実表示用）
  updated_at      TEXT NOT NULL
);

CREATE TABLE r15_envelope (
  envelope_id  TEXT PRIMARY KEY,            -- 端末 mint（env_ 接頭辞・偽装は形で拒否）
  edge_id      TEXT NOT NULL,               -- 宛先 edge（mutual のみ受理 — SQL 述語）
  from_ref     TEXT NOT NULL,               -- 送信主体（token 由来・出自）
  kind         TEXT NOT NULL CHECK (kind IN ('message','note','contact')),
  eph_pub      TEXT NOT NULL,               -- 封筒ごとの ephemeral 公開鍵
  iv           TEXT NOT NULL,
  ciphertext   TEXT NOT NULL,               -- base64・上限 16KB（物理 cap）
  state        TEXT NOT NULL DEFAULT 'held' CHECK (state IN ('held','expired')),
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_r15_envelope_edge ON r15_envelope (edge_id);
-- ノートは「一人一枚・編集可」: (edge_id, from_ref) で kind='note' は一行に upsert
CREATE UNIQUE INDEX idx_r15_envelope_note
  ON r15_envelope (edge_id, from_ref) WHERE kind = 'note';
```

## 4. 配達の生涯（メッセージ／渡す＝流れるもの）

1. 送信: mutual edge の participant だけが投函できる（SQL 述語 — c 系 mutual-join の継承）。
   last_act_{a|b} を動かす（行為）。**送信成功の顔はあるが、配達済み・既読の顔は無い**（圧なし）。
2. 受取: 宛先が fetch → 端末で復号・owner-local 棚へ保存 → **ack で行を削除**（配達後非保持）。
   ack は受取の自動動作で「既読」ではない（開封表示は存在しない・読みは行為ではない）。
3. 不達: TTL（仮14日）を過ぎた held 行は **expired tombstone**（ciphertext を落とし種別と時刻だけ残す）
   → 次回訪問時に**両者へ正直なエラー一行** → tombstone も確認後に削除。
4. **ノートは流れない**: 立っているあいだサーバが ciphertext を保持（standing object — 配達後非保持の
   例外であることを明記。edge が closed になっても紙の床と同じく読める／owner はいつでも下げられる）。
5. 物理律速: edge ごと日次 **N=50 通**（仮）。課金・優先・従量は永久にない（§10）。

## 5. invariant（このゲートで凍結する五本）

1. **平文の本文はサーバに一度も到達しない** — 平文を受ける API 形を作らない（R8 hook の常時化対象）。
2. **配達済み・既読・開封の表示は作らない** — 不達の正直なエラーだけが配達系の唯一の顔。
3. **メッセージは配達後非保持・ノートだけが立つ** — 第三の保持形を作らない。
4. **投函は mutual edge の participant のみ・封筒は出自（from_ref）を持つ** — §10 actor provenance。
5. **メタデータの正直** — PX に見えるもの（誰と・いつ・量）を隠して語らない（§1 の表が正本）。

## 6. ⛔ 裁量点（ゲートで決めてほしい三つ）

- (a) 秘密鍵を「控えを保存」に含めるか（傾き: 含める）。
- (b) 鍵指紋の照合 UI を v1 で出すか（傾き: v1 は鍵変更の事実表示のみ・照合表示は R3）。
- (c) テスト期の梯子: E2EE-first で建てるが、**既存平文 contact_note の移行**はカットオーバー
  プラン側（cutover-plan.md §3）— 本文書の射程外であることの確認。

## 7. ゲート後の実装順（便6 案）

1. 0014 migration（dev）＋鍵 mint/公開（publish 時に enc_pub 同送）＋鍵レーン gate テスト
2. メッセージ: 投函/fetch+ack/expired の三面＋トーク UI（時系列・自他整列・日付区切り・下書き保全・
   圧なし — spec §10 文通 UI 方針）
3. ノート（standing upsert・読者明示の一行）／渡す（contact の E2EE 形）
4. R8 hook の armed 化はカットオーバーの contact 移行完了と同時

## 裁可欄

design lead: 【通過 ／ 差し戻し】 → Hiroto: 【裁可 ／ 修正指示】 → 通過で便6 着工
