# 0013 設計ゲート文書 — E2EE 封筒と鍵配布（STOP②: サーバデータ新設・Wave 1 の床）

状態: **通過確定（design lead 2026-06-12・条件二点反映済み・裁量点三つ裁定済み）→ 便6 着工可。**
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
  それが E2EE の値段。正直な caveat を UI に）。**裁定（2026-06-12）: 秘密鍵は控えを保存（export）に
  含める** — 鍵を控えに入れないのは「持たない」ではなく「失わせる」。owner-held の哲学は
  「owner は自分のものを持ち出せる」で、鍵はその最たるもの。**ただし控えの中の秘密鍵は owner 自身の
  パスフレーズで封緘**（控えを預かる先＝PX や cloud が復号できない形）— invariant 6 に昇格。

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
   **ack の定義（ゲート条件2・UI 非接続に固定）**: ack は**サーバの行削除トリガー**であり、
   相手に通知されない・相手の UI に状態を作らない — 既読の裏口を ack が開けない（c18 の
   talkBack 結果認識とは別物: あれは送信者自身の行為の結果表示、ack は受信完了の内部信号）。
3. 不達: TTL（仮14日）を過ぎた held 行は **expired tombstone**（ciphertext を落とし種別と時刻だけ残す）
   → 次回訪問時に**両者へ正直なエラー一行** → tombstone も確認後に削除。
4. **ノートは流れない**: 立っているあいだサーバが ciphertext を保持（standing object — 配達後非保持の
   例外であることを明記）。**保持期限（ゲート条件1・Hiroto 指定）: ノートは edge に従属** —
   edge が closed になったら、次の掃除（serve 時の規則の機械的実行・cron ではない）でノートも消える。
   **縁が閉じれば立て札も畳まれる。** E2EE なのでサーバは ciphertext を消すだけ — 復号鍵は端末で、
   owner 自身の端末原本は owner のもの。owner はいつでも自分のノートを下げられる。
5. 物理律速 — **追補（2026-06-12 実装裁定・design lead 承認）**: 「日次 N=50 通」は
   **滞留キュー深さ 50** で実装する。日次カウンタは「誰と・どれだけ」の持続メタデータを
   要求し、持たないに反する — キュー深さは今ある行だけで律速でき、配達で空く（制限の
   目的＝詰まりの物理を、データの蓄積ゼロで達成）。**expired tombstone は深さに数えない**
   （数えると不在の相手の edge が死蔵で詰まったままになる — state='held' のみ計数・pin 付き）。
   課金・優先・従量は永久にない（§10）。

## 5. invariant（このゲートで凍結する七本）

1. **平文の本文はサーバに一度も到達しない** — 平文を受ける API 形を作らない（R8 hook の常時化対象）。
2. **配達済み・既読・開封の表示は作らない** — 不達の正直なエラーだけが配達系の唯一の顔。
   **ack はサーバの行削除トリガーであり、相手に通知されず・相手の UI に状態を作らない**（条件2）。
3. **メッセージは配達後非保持・ノートだけが立つ** — 第三の保持形を作らない。
   **ノートは edge に従属 — 縁が閉じれば立て札も畳まれる**（条件1: closed 後の次の掃除で消える）。
4. **投函は mutual edge の participant のみ・封筒は出自（from_ref）を持つ** — §10 actor provenance。
5. **メタデータの正直** — PX に見えるもの（誰と・いつ・量）を隠して語らない（§1 の表が正本）。
6. **控えの中の秘密鍵は owner のパスフレーズで封緘** — 控えを預かる先（PX・cloud・ファイル置き場）の
   どれも復号できない形でしか秘密鍵は端末を出ない（裁定 (a)）。
7. PX は鍵を mint しない・預からない・すり替えの検出は事実表示（「鍵が変わりました」）で owner へ。

## 6. 裁量点の裁定（2026-06-12・design lead）

- (a) 秘密鍵の控え同梱 → **含める**（パスフレーズ封緘つき — invariant 6）。
- (b) 鍵指紋照合 UI → **R3**（key transparency・印=attestation と束ねて初めて意味を持つ。
  v1 は鍵変更の事実表示一行のみ）。
- (c) 既存平文 contact_note の移行 → **cutover 側の射程で確定**（owner 自身の手による再封→
  予告削除→R8 arm。本文書は新規封筒の設計に集中）。

## 7. ゲート後の実装順（便6 案）

1. 0014 migration（dev）＋鍵 mint/公開（publish 時に enc_pub 同送）＋鍵レーン gate テスト
2. メッセージ: 投函/fetch+ack/expired の三面＋トーク UI（時系列・自他整列・日付区切り・下書き保全・
   圧なし — spec §10 文通 UI 方針）
3. ノート（standing upsert・読者明示の一行）／渡す（contact の E2EE 形）
4. R8 hook の armed 化はカットオーバーの contact 移行完了と同時

## 裁可欄

design lead: 【通過 ／ 差し戻し】 → Hiroto: 【裁可 ／ 修正指示】 → 通過で便6 着工
