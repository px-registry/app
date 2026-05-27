# PX_BUSINESS_CONTRACT.md

```
version: v0.3 (= GPT review accept、Phase 9A canonical 確定)
status:  本日 (= 2026-05-18) の対話で確定した articulate 統合 + Phase 9A canonical 固定
source:  v0.2 + CC 実装棚卸し報告 + GPT Phase 9A 設計 + Wanted/Antenna 追加 articulate + GPT v0.3 review accept
predecessor: v0.2 (= GPT feedback への Hiroto judgment 11 件反映)
             v0.1 (= 過去 memory 探索 merge)
             v0.0 (= 本日対話のみ baseline)
next:    Phase 9A implementation prompt 起草 → CC fresh session 実装着手
```

---

## §0 この document の位置付け

本 document は PX_BUSINESS_CONTRACT.md の v0.3。

v0.2 → v0.3 で確定した articulate:
- 棚卸し実装 status を §12 PX プロダクト一覧 + §16-bis に統合 (= 「事業 articulate × 実装現実」 並列)
- Wanted / Antenna / Watcher pair の articulate 前面化 (= mode 1/2 の具体実装)
- PX マッチング articulate 整合 (= 機能名 = Matching、結果 = Match)
- Phase 9A Surface Portfolio Search MVP scope articulate
- Auction 命名 = 「入札型」 先行、PX オークション法務後 timing articulate
- intent 軸 articulate (= surface_shape と別軸、3 種に簡潔化)
- §24 Open Questions update (= Q11/Q12 棚卸し済 close、新規 Q 追加)

含めるもの:
- Hiroto articulate (= canonical)
- 棚卸し由来 implementation 現実
- 過去 memory 由来 (= §A-E、明示 merge)
- Claude articulate し Hiroto accept した内容

含めないもの:
- Claude 推測
- Hiroto 未確認の articulate
- 自己称揚 articulate

---

## §1 PX の一行 articulation

```
あなたの自由を邪魔しない infrastructure
```

これを支える structure:
- ユーザー自身のドメインで動く基盤
- 全公開面を繋ぐ検索板
- Stand を立てる仕組み (= 気楽な単位)
- プロダクト個別の「手数料 0」
- 探す側 (= Wanted) と探される側 (= Antenna) の pair 機能

技術北極星 (= 補強):
- 「proof を生成する世界」 (= PX 発明の起点)
- 4KB マニフェスト → fail-close → 通行税モデル → 封筒 metaphor → 現形

user-facing 北極星 (= §1 主 articulate) と技術北極星は階層化:
- 「自由を邪魔しない」 = user に対する PX の articulate
- 「proof を生成する世界」 = infrastructure としての PX の articulate

---

## §2 三原則の architectural enforcement

### 三原則

| 原則 | architectural 帰結 |
|---|---|
| 持たない (= no custody) | プロダクト個別「手数料 0」 が成立 |
| 判定しない (= no adjudication) | 個人型 algorithm + 灯台 (= 改竄不可判断材料) |
| 預からない (= no escrow) | 匿名選択可能 (= owner identity と公開面の linkage 最小) |

これらは marketing claim ではなく、Phase 7d-8 で物理 enforce 済:
- 26 gate / 17 forbidden column / sealed history / STOP & CONFIRM / drift catalog 5 type

### 構造の articulate

多くの既存 platform は cost をかけて service を作り、running cost を cover するため transaction commission を取る。PX は逆構造:

- 個人 user が own domain で動く基盤を持つ (= cost 分散)
- 検索板は transaction volume に比例した custody/settlement cost を持たない (= descriptor index + routing 中心の low marginal cost structure)
- プロダクト個別 (= PX オークション / PX マッチング 等) で「手数料 0」 を達成
- 「手数料 0」 は marketing でなく architectural

これにより「自由を邪魔しない」 北極星が技術的に成立する。

---

## §3 構造 + ブランド体系 + Layer 整理

### 階層

```
Box (= owner's room、上位、owner ごとに 1 つ)
  └ Surface / 公開面 (= Box 内の各種公開区画)
      └ Surface 上の content (= 個別 listing / item / 企画)
      └ Stand (= 気楽に立てる単位、user articulate 主体)

Search Board (= 検索板、全 Surface + Stand cross-cut の index)
Lighthouse (= 灯台、Surface 種類別の改竄不可判断材料を提示)
Composer (= 作成 tool)
```

### Layer 整理 (= 機能体系)

PX の機能は 4 Layer で articulate される:

```
Layer 1: Owner が立てる
  Stand / Wanted / Offered / 入札型 / Ask / Stream / Crowdfunding

Layer 2: 見つけてもらう仕組み
  Antenna / Search Board / AI-readable descriptor / Watcher / Notification

Layer 3: つながる仕組み
  PX マッチング / Match candidate / Reveal / Owner-controlled handoff

Layer 4: 証明・信頼材料
  Lighthouse / Receipt / PASS / Takedown / Removed page
```

### ブランド体系

```
PX:             product / protocol、開発者・user 向け
PX Registry:    法人、権威 / 法務 / 監査 facing
PX Authority:   署名 infrastructure、SCT + receipt 発行
```

note: 旧「Sandbox」 は本 contract から retire、engineering 内部用語としてのみ保持。

---

## §4 Stand articulation

PX の articulate 単位は 2 軸:

### A. Pre-built Surface (= PX 標準提供、§12 で詳細)

PX 〇〇プロダクトとして PX 側が標準実装、user は「開く」 だけで使える。

### B. Stand (= user が立てる気楽な単位)

```
Hiroto articulate (= 2026-05-18 確定):
  「2 ちゃんねるのスレを立てるとか、Yahoo 知恵袋の質問をたてるくらい気楽なイメージ」
  「ユーザーはここで何をたてても良い」
  「手数料のあるオークションでもできる」
  「共同研究もできる」
  「使い方は自由」
```

Stand の articulate:
- user が任意の用途で立てる単位
- Pre-built Surface に当てはまらない活動形態に対応
- 用途は user 自身が articulate (= PX は judge しない)
- 手数料あり / なしも user articulate (= PX は強制しない)
- 検索板から発見可能

### 用語

```
名称:           Stand
日本語併記:     「立て場」 または「Stand」 そのまま
動作:           「Stand を立てる」 (= 動詞活用)
理由:           英語が最も理解される + 非英語話者も理解可能
                Surface / Box / Board と階層的に区別可能
```

---

## §5 匿名性 articulation

PX の匿名性は **試用ではなく、恒久的選択肢として articulate**。

```
パターン:
  1. 完全匿名 (= 本来活動と切り離した、独立 owner identity)
  2. 部分匿名 (= 名前は出すが分野横断は分離)
  3. メイン公開面持ち (= SNS 的、検索・推薦対象)
  4. 混在 (= 同一 owner が複数 Surface を異なる匿名度で運用)
```

技術的支え:
- 各 Surface は掲示板上の独立 ID として articulate
- ダッシュボードからの「開く」 操作で各 Surface が生まれる
- PX 内部での同一 owner 識別は最小

### 特商法 articulate

Owner が販売 Surface を開く場合、PX は Owner の販売 route として機能。

PX 自体の特商法上の位置 (= 表示義務 / platform responsibility / 広告表示義務 等) は legal review で確認。

Owner 側は既存 EC サイト (= 自社EC 等) で特商法表記を保持する想定、PX はそれと接続する設計。

---

## §6 Surface 開設 UX

登録時:
- PX は **個人のダッシュボードとして見える**
- 全 Surface (= Pre-built) がダッシュボードに並ぶ
- user が「開く」 を選択して各 Surface を生成
- 各 Surface は独立した URL / ID を持つ
- Stand は user が任意の時に立てる

メイン公開面と subsurface:
- メイン公開面を **持たない運用も可能**
- メイン公開面持ちの場合、SNS 的に活用可能、検索・推薦の対象
- メイン公開面の有無は owner 選択

完全切り分け運用:
- 1 owner が複数 Surface を完全に切り離して運用可能

---

## §7 Search Board (検索板)

### 立ち位置

Search Board は PX の distribution layer:
- 人間が探す / 見つける / 移動する
- AI agent が読む / 候補化する / Owner に提案する / 接続する

### Ranking policy

```
PX articulate:
  PX 自身が「これがおすすめ」 judgment して push しない
  ただし ranking / 集計 / 順序 articulate は提供する (= 事実 articulate として)
  「ranking 自体は禁止しない」 (= Hiroto articulate)
  「結果を伝えることは PX らしいとも言える」 (= Hiroto articulate)
```

### Allowed

- 事実集計 ranking (= 取引件数順 / 経過時間順 / 新着順 / 等)
- user 選択軸での ranking
- 個人型 algorithm 経由の personalized ranking (= user の AI agent 経由)
- 灯台情報を ranking 材料として user に articulate
- verified status display
- lighthouse / receipt availability display

### Forbidden

- PX 単独 judgment による中央集権 ranking
- hidden / 不透明 ranking 操作
- 課金による ranking boost
- 後付け説明なしの ranking 変更

### 個人型 algorithm との接続

```
PX 検索板自体: judgment 不在の事実 articulate provider
user の AI agent: 個人型 algorithm で「user に合った ranking」 算出
```

### 軸の articulate (= Phase 9A で実装)

```
surface_shape (= Surface 種類):
  offered      (= 売る / 提供する)
  auction_like (= 入札型)
  matching     (= マッチング)
  stand        (= user 自由 articulate)

intent (= 別軸、user の意図方向):
  wanted    (= 探している、欲しい)
  offered   (= 提供できる、出せる)
  ask       (= 問いたい、相談したい)

これら 2 軸 + category + region + time + text で検索可能
```

---

## §8 Lighthouse (灯台)

灯台は **改竄不可判断材料を提示する仕組み**。

PX の立ち位置:
- 信頼を判定するのは PX **ではなく user**
- PX が提供するのは「改竄されていない事実」 のみ
- user が materials を見て、user が判断する
- 目的: 「怪しいものには手を出さない文化」 を産む

Surface 種類ごとに必要な判断材料が異なる:
- オークション → 過去オークション履歴 / photo hash 重複検知 / 取り消し履歴
- クラファン → milestone delivery 履歴 / funding 完了率
- マッチング → 開設経過時間 / 相互 attestation / dispute 履歴

灯台の技術基盤 (= Phase 7d 焼き済):
- Witness layer
- Lighthouse anchor (= Sigstore Rekor / Certificate Transparency 等)

---

## §9 個人型 algorithm + AI 連動 4 mode + Wanted/Antenna pair

```
中央集権型 algorithm (= 既存 platform 一般形):
  platform が user data 集約、中央で recommend 算出、user に push

個人型 algorithm (= PX 設計):
  PX 自体は judgment しない
  各 user の AI agent が PX 検索板を読み、user の context に合わせて recommend
  → 「おま環アルゴリズム」 (= works-on-my-machine、各人で違う結果)
```

### AI 連動 4 mode

| mode | 説明 | 段階 | 具体実装 |
|---|---|---|---|
| 1. personal search | 外 → 自 (= 個人検索) | current | Wanted Antenna + Watcher |
| 2. bulletin board | 自 → 外、AI-free | current | Antenna (= 探されやすく articulate) |
| 3. autonomous room | AI ⇆ AI、autonomous 取引 / 交渉 | future | - |
| 4. AI exploration | 自 AI → 他 box → 戻る | future | - |

### Wanted / Antenna / Watcher pair 機能 (= mode 1/2 の最初の具体実装)

```
Wanted (= 探す側 articulate):
  user が「これが欲しい」「こういう人を探している」 を articulate
  AI / 人間が候補を見つけた時に通知
  → mode 1 personal search (= 外 → 自) の具体形

Antenna (= 探される側 articulate):
  自分を「探してもらいやすく」 articulate
  AI / 人間が探した時に hit しやすくする
  → mode 2 bulletin board (= 自 → 外) の具体形

Watcher (= 通知機能):
  Wanted の条件に合致する候補が現れた時に通知
  最初は dashboard 表示から、後に email / AI summary
  → mode 1 personal search の通知 layer

セット機能:
  Wanted = 探す側 / Antenna = 探される側 / Watcher = 通知
  3 つ揃って「個人型 algorithm」 が体験として成立
  「掲示板に書いた」 で終わらず「探しているものが見つかったら返ってくる」 構造
```

これは PX 個人型 algorithm articulate の **最初の具体実装 pair**。

---

## §10 AI 学習元 attestation

PX が provide する materials:

```
1. Content fingerprint (= 一方向 hash、content 自体は持たない)
2. Publish event chain (= attestation chain、Phase 8 焼き済)
3. Witness anchor (= 第三者 transparency log への anchor)
4. Owner attestation (= owner signature、Phase 8 Stage 2 焼き済)
5. Usage license articulation (= 学習許可 / 禁止 / 条件、新規 articulate 範囲)
```

組み合わせ:
- C2PA (= content authenticity) + W3C VC (= verifiable credentials) + PX (= event chain + Witness + owner signature)
- 3 つ揃って AI 学習元 verifiability 完成
- PX は infrastructure layer の role

---

## §11 Future expansion (= 現 contract 範囲外、将来別 articulate)

```
1. AI 貸し借り / 協力
   - owner の AI 能力 / 専門領域を attestation 付き貸し借り
   - mode 3-4 implementation
   - 「忘れるので future 枠で残す」

2. 規制対象事業の追加
   - 決済 custody / escrow / auction settlement / crowdfunding fund custody
   - insurance-linked clearing / dispute resolution
   - 自律 AI / ロボット保険 (= PX 起源の通行税モデル発展元)

3. Authority Clock / Clearing Clock 接続点
   - attestation primitive standards body engagement
   - AI lab partnership
   - 規制機関 dialogue

4. Receiver-side product
   - follow / inbox / patronage display / cross-domain aggregation
   - custody-free inbox
```

---

## §12 PX プロダクト一覧 (= 事業 articulate × 実装現実)

PX プロダクトは「PX 〇〇」 として個別 articulate される。各プロダクトの説明欄で「手数料 0」 を明示。

各プロダクトに **現実装 status** を articulate (= 棚卸し由来、2026-05-18 HEAD 7d5c596 時点)。

### Pre-built (= PX 標準提供、合計 12 件)

#### 1. PX オークション (= 仮称)

```
内容:        一点物の入札取引
比較対象:    ヤフオク (= 販売手数料 10%)、サザビーズ (= 落札者手数料 25-30%)、Mercari (= 10%)
PX articulate: 手数料 0
灯台材料:    過去オークション履歴 / photo hash 重複検知 / 取り消し履歴
主な user:   盆栽家 / デザイナー / 3D printer maker 等

呼称 articulate:
  internal:        auction_like
  public 現状:     「入札型」 / "auction-like"
  public 法務後:   PX オークション 採用検討 (= legal review 後判断)
  
実装 status:
  current:         prototype only (= Box.variant.kind='auction' render、fixture data のみ)
  publish UI:      無
  worker handler:  無
  D1 table:        無
  Search Board 露出: 無
  
Phase 9A:        surface_shape=auction_like で実装、external action URL (= owner-controlled) 経由
                  bid execution は PX 持たず、owner 側で完結
```

#### 2. PX クラファン

```
内容:        約束と達成の chain
比較対象:    Kickstarter (= 5% + 決済)、Campfire (= 5-17%)、Indiegogo (= 5%)
PX articulate: 手数料 0
灯台材料:    milestone delivery 履歴 / funding 完了率
主な user:   SE musician / 3D maker / 飲食店主 等

実装 status:
  current:         absent (= legacy v1 docs のみ)
  
Phase 配置:      P1-P2 (= Phase 9A scope 外、9C 等で articulate 予定)
```

#### 3. PX マッチング

```
内容:        パートナー / 仕事 / コミュニティ
比較対象:    各種マッチングサービス (= 成立手数料、月額)
PX articulate: 成立手数料 0
灯台材料:    開設経過時間 / 相互 attestation / dispute 履歴
用途:        仕事 / パートナー / 趣味仲間 / 専門家 等

articulate 区別 (= 2026-05-18 確定):
  PX マッチング: 機能 / Surface 名 (= product 名)
  Matching:     内部 articulate (= surface_shape=matching)
  Match:        結果 / event / state (= 「候補が見つかった」「相互関心成立」)
  
  user-facing:
    PX マッチング または「つながる / 探してもらう / 見つけてもらう」
    "Match" 単独は product 名として使わない (= 結果 / state のみ)

実装 status:
  current:         partial (= AntennaDirection='match' として実装、独立 surface 無)
  publish UI:      /me/antenna/new?dir=match
  worker handler:  /api/v1/antenna
  D1 table:        0005 + 0007 (= Antenna 共通 table)
  /category 露出:  Sandbox publish 経由
  Search Board 露出: 無 (= Search Board 自体 absent)
  
Phase 9A:        surface_shape=matching で Search Board に表示
                  既存 Antenna direction=match 実装活用、新規実装最小
```

#### 4. PX 音楽配信

```
内容:        楽曲配信 + ライセンス
比較対象:    Spotify (= 約 30%)、Bandcamp (= 10-15%)、DistroKid (= 年額)
PX articulate: 手数料 0、pull 型 (= file owner 保持)
配信者:      SE musician 等

実装 status:
  current:         prototype only (= Box.variant.kind='music' render variant)
  publish UI:      無
  
Phase 配置:      P1-P2 (= Phase 9A scope 外)
```

#### 5. PX 動画

```
内容:        配信 + チャネル運営
比較対象:    YouTube (= 広告 45% 取分)、Vimeo、Patreon Video (= 8-12%)
PX articulate: 手数料 0、広告は owner-sponsor 直接接続
配信者:      各種

実装 status:
  current:         absent
  
Phase 配置:      P1-P2 (= Phase 9A scope 外)
```

#### 6. PX 販売 (= Shop) + Stand

```
内容:        物販 / digital download (= Sale) + user 自由 articulate (= Stand)
比較対象:    Amazon (= 15%)、BASE (= 3% + 決済)、Etsy (= 6.5% + listing)
PX articulate: 手数料 0、pull 型引き渡し
販売者:      designer / 3D printer maker / 飲食店主 等

実装 status:
  Sale:    prototype only (= Box.variant.kind='shop' render variant)
  Stand:   absent (= concept 未実装)
  
Phase 9A:        offered (= Sale 系) / stand (= 自由 articulate) の最小統合実装
                  surface_shape=offered + surface_shape=stand
                  Phase 9A 内では両者を minimal 区別、full 分離は Phase 9B+
```

#### 7. PX 会員 (= Membership)

```
内容:        subscription 系
比較対象:    Patreon (= 8-12%)、Substack (= 10%)、Pixiv FANBOX (= 10%)
PX articulate: 手数料 0
用途:        ファンクラブ / 専門コミュニティ / 等

実装 status:
  current:         absent
  
Phase 配置:      P1-P2 (= Phase 9A scope 外)
```

#### 8. PX 配信 (= Stream)

```
内容:        live + on-demand
比較対象:    Twitch (= 50%)、YouTube Live (= 30%)、Pococha 等
PX articulate: 手数料 0、スパチャ的投げ銭は owner 直接受領
配信者:      各種

実装 status:
  current:         prototype only (= MusicLiveEvent render)
  
Phase 配置:      P1-P2 (= Phase 9A scope 外)
```

#### 9. PX 専門 (= Specialist / AI-assisted inquiry)

```
内容:        専門家相談 / AI 経由問い合わせ
比較対象:    各種専門家 platform (= 仲介手数料)
PX articulate: 仲介手数料 0
用途:        法律 / 医療 / 教育 / 技術相談 等

実装 status:
  current:         absent
  
Phase 配置:      P1-P2 (= Phase 9A scope 外)
```

#### 10. PX 検索板 (= Search Board)

```
内容:        全 Surface + Stand cross-cut の index
比較対象:    Google (= 検索広告)、各種 marketplace search
PX articulate: 検索手数料 0、judgment 不在の事実集計 ranking
用途:        人間 / AI agent が PX 内を探索

実装 status:
  current v2:      absent (= /category 8 bucket index のみ、cross-surface 無)
  
Phase 9A:        /search route + GET /search worker + cross-surface aggregator 新規実装
                  surface_shape + intent + category + region + time + text 軸での検索
```

#### 11. PX Wanted (= 探す側、新規 articulate)

```
内容:        欲しいもの / 探している協力者 / 依頼したいこと を articulate
比較対象:    各種「探しています」 機能 (= 多くの platform にあるが、AI 通知連動と組み合わせは少ない)
PX articulate: 手数料 0、AI 通知連動
用途:        個人 / 専門 / 趣味 / 仕事 / コラボ等の探索

意義:        個人型 algorithm articulate の最初の具体実装 (= mode 1 personal search)

実装 status:
  current:         partial (= AntennaDirection='wanted' として実装)
  publish UI:      /me/antenna/new?dir=wanted
  worker handler:  /api/v1/antenna
  D1 table:        0005 + 0007
  Search Board 露出: 無
  通知機能:        無
  
Phase 9A:        既存 Antenna direction=wanted を Search Board に表示
                  intent=wanted axis として articulate
                  
Phase 9B:        Watcher 機能 (= dashboard 表示) + AI 通知の最初の実装
```

#### 12. PX Antenna (= 探される側、新規 articulate)

```
内容:        自分を「探してもらいやすく」 articulate する仕組み
PX articulate: 手数料 0
意義:        個人型 algorithm articulate の最初の具体実装 (= mode 2 bulletin board)
            user は「立てておく」 だけで AI / 人間が探した時に hit する状態を維持

実装 status:
  current:         current implemented (= worker-backed / D1-backed / e2e-covered)
  publish UI:      /me/antenna, /me/antenna/new, /me/antenna/search, /me/antenna/view
  worker handler:  /api/v1/antenna (= POST / PATCH)
  D1 table:        0005 + 0006 + 0007 + 0008
  Search Board 露出: 無
  
Phase 9A:        Search Board に既存 Antenna 露出 (= Antenna direction=offered/match/ask/wanted 全て可視)
                  
Phase 9B:        Wanted との pair 機能強化、AI matching algorithm 接続
```

### User 主導: Stand

```
articulate:  §4 参照
実装 status: absent (= concept 未実装)
Phase 9A:    surface_shape=stand の最小実装 (= offered と minimal 統合)
```

### Future regulated (= 別法人 / 別 contract 想定、§19 Boundary Commitment)

```
13. PX 保険       (= 自律 AI / ロボット保険、Tier 上位通行税モデル)
14. PX 決済       (= payment custody / escrow、別法人想定)
15. PX 認証       (= W3C VC issuer / identity)
16. PX AI Rental  (= AI 貸し借り / 協力、mode 3-4)
17. PX Attestation (= AI 学習元 attestation、Authority Clock 接続)
```

---

## §13 Pro 課金 articulation

```
金額:        年間 10,000 円 (= 確定、2026-05-17 articulate)
維持費:      低い (= §B 4 段階計算済)
維持コスト:  「PX 維持コストはかなり低い」 (= Hiroto articulate)
```

### 課金境界 articulate

```
× 単純化のために tier 削除
○ レイヤー間に厚みがある、tier を「上位に上げる」 design 方針

  - 機能を全て触れる前に境界を決めると薄っぺら化
  - 「PX コストかからない部分はなるべく Pro なし」 が原則
  - 課金境界の決定は「全機能が user に触れる」 後 = Phase 9 以降
  - 現時点で境界を articulate するのは時期尚早
```

### 想定 articulate (= 未確定、Hiroto judgment 待ち)

```
Pro 課金候補: PX 維持 cost に関わるもの + 明らかに無料ではない項目
Tier 上位通行税: 証明 / verification 等の attestation API
ドメイン / hosting articulate:
  「より良い考え方があるはず」 (= Hiroto articulate)
  完成前判断は時期尚早
  過去 articulate「custom domain を Pro 課金にしない」 言い切りも撤回
  v0.x で再 articulate
```

### PX-hosted ratio (= 過去 articulate、KPI)

- PX-hosted ratio = 2026 onboarding KPI
- own domain user を伸ばす方向
- PX subdomain は temporary scaffolding

---

## §14 5 beta invitees

```
人数:        5 名
attribute:   designer / bonsai 実践者 / SE musician / 3D printer maker / 飲食店主
構成:        業態多様性、取引額幅広い、専門性幅広い、顧客タイプ幅広い

Surface 選択: 自由 (= Hiroto articulate「彼らに任せる方針」)
test 位置付け: 5 名は「自由な試用機会」、PX validation の重い test 依存対象ではない

Phase 9 timing で起動:
  - Phase 9A (= Surface Portfolio + Search Board) 完了後想定
  - 自ドメイン / Pro subdomain いずれの mode も自由選択
  - 招待は「Stand への出品ライセンス」 として articulate
```

---

## §15 Three Clock + Tier ladder + ブレ articulation

戦略 tier:

| Tier | 内容 | 確率 (= Claude estimate) |
|---|---|---|
| Tier 4 | 日本 B2B PPAP 代替 + EU AI Act compliance | 60-75% |
| Tier 3.5 | 中抜き 0 creator economy 基盤 (= direct focus) | 40-55% |
| Tier 3 | 日本-EU compliance bridge | 45-60% |
| Tier 2 | A2A 時代の attestation primitive layer | 25-35% |
| Tier 1 | trillion-yen Clearing Clock 直接 target | 8-12% |

### ブレ articulation (= 維持、隠さない)

```
採用ラダー Step 1-3 (= 試用 → graduate → 検索板 volume): structural ✅
Step 4-5 (= attestation volume → 外部認識 → Clearing reach):  passive enabling のみ ⚠️

上位 Tier 到達のための active engagement 6 要素は現在着手していない:
  1. PX attestation specification public 文書化
  2. reference implementation SDK 提供
  3. 標準化団体 engagement (= W3C / IETF / C2PA / OpenSSF)
  4. AI lab partnership (= 1-2 件 bilateral conversation)
  5. transparency log anchor formal 実装 (= Sigstore Rekor)
  6. 規制機関 dialogue (= 日本 IPA / EU AI Office / NIST 等)

これら 6 要素は Phase 9+ で追加するか、scenario B (= Tier 3.5 で satisfied) で留めるか、Hiroto judgment 待ち。
```

---

## §16 Phase 関係

### engineering Phase

```
Phase 7d:               完了 (= 2026-05-13)
Phase 8 Stage 0-4:      完了 (= 2026-05-17、HEAD 7d5c596)
Phase 8 Stage 5:        Case C pending external input (= 適切な hold)
Phase 9A:               未着手、本 v0.3 で scope articulate
Phase 9B+:              未着手、Phase 9A 完了後
```

### Phase 9A: Surface Portfolio Search MVP

```
目的:
  PX_BUSINESS_CONTRACT.md (= 本 document) の有用性を実装で証明する
  単なる事業 articulate でなく、現実 ship state での裏付け

scope:
  1. /search route 新規 (= cross-surface aggregator)
  2. GET /search worker handler 新規
  3. surface_shape discriminator (= 4 種: offered / auction_like / matching / stand)
  4. intent axis (= 3 種: wanted / offered / ask)
  5. auction-like row 実装 (= 「入札型」 public copy、external action URL)
  6. matching row Search Board 表示 (= 既存 Antenna direction=match 経由)
  7. wanted row Search Board 表示 (= 既存 Antenna direction=wanted 経由)
  8. offered / stand row 実装 (= minimal 統合)
  9. cross-surface visibility e2e test
  10. 各 row → 対象 surface routing
  11. legal footer + role boundary copy

out of scope (= Phase 9B 以降):
  - Watcher / Candidate alert / AI 通知
  - Wanted/Antenna 専用 UX 強化
  - Auction full settlement (= bid execution は owner-controlled)
  - Crowdfunding / Stream / Music / Video surface 実装
  - Membership / Specialist 実装
  - Pro 課金境界決定
  - production deploy
  - 法務 review 反映 (= Stage 5 と分離)

acceptance gates (= Phase 9A 完了条件):
  Gate 9A-1:  /search route exists
  Gate 9A-2:  GET /search returns D1-backed rows
  Gate 9A-3:  auction_like row appears in /search
  Gate 9A-4:  matching row appears in /search
  Gate 9A-5:  offered / stand row appears in /search
  Gate 9A-6:  wanted row appears in /search
  Gate 9A-7:  all rows route to public detail/surface
  Gate 9A-8:  no private fields leak
  Gate 9A-9:  no PX-as-seller / auctioneer / payment / escrow wording
  Gate 9A-10: no hidden ranking / paid boost
  Gate 9A-11: e2e cross-surface search green
```

### Phase 9B (= 想定 articulate)

```
scope (= 暫定、Phase 9A 完了時に再 articulate):
  - Wanted + Antenna pair の機能強化
  - Watcher (= dashboard 表示) + Candidate alert 最小版
  - AI 通知の最初の実装 (= mode 1 personal search 完成)
  - Auction-like surface 詳細 UX
  - Owner-controlled handoff の articulate 強化
```

### business document phase

```
PX_BUSINESS_CONTRACT.md:
  v0.0:  2026-05-17 朝、本日対話のみ baseline
  v0.1:  2026-05-17 夕、過去 memory 探索 merge
  v0.2:  2026-05-18、GPT feedback への Hiroto judgment 11 件反映
  v0.3:  2026-05-18、棚卸し統合 + Wanted/Antenna pair + Phase 9A scope (= 本 document)
  v0.x:  Pro 課金境界決定 / 法務 review 結果反映 / 等
```

### Stage 5 再開条件 (= 4 件外部入力、変更なし)

```
1. Business contract 完成 (= v0.3 → 法務 review 投入版)
2. 法務 review 結果
3. Cloudflare logs evidence
4. Phase 8 target endpoint URL 確定 + deploy 認可
```

---

## §16-bis Implementation Snapshot (= 2026-05-18, HEAD 7d5c596)

CC 棚卸し報告 (= read-only inventory) の統合 articulate:

### current v2 完全結線 (= worker-backed / D1-backed / e2e-covered)

```
1. Antenna
   - /me/antenna, /me/antenna/new, /me/antenna/search, /me/antenna/view
   - POST/PATCH /api/v1/antenna
   - D1: 0005_antenna_private + 0006_opt_in_records + 0007_antenna_publication_meta + 0008_idempotency_keys
   - e2e: antenna-create-wanted, antenna-create-match, antenna-search-active, antenna-legal-copy, publish-refused-low-anonymity
   - direction subset: wanted / match / ask (= Antenna intent として実装)

2. Sandbox
   - /sandbox/[sandboxHandle], /sandbox-removed
   - POST /api/v1/sandbox/publish, GET /sandbox/{handle}
   - D1: 0003_sandbox_descriptors (sealed) + 0009_sandbox_descriptor_ownership
   - e2e: 9+ specs (= sandbox-hot-link-render / takedown / migration / category-purge / revoke-emergency / 等)
   - 注: PX で唯一の完全 publish-to-public パイプライン

3. Category Surface
   - /category, /category/[code], /category/[code]/[descriptorId]
   - GET /category/{code}, GET /category/{code}/{handle}
   - reads: sandbox_descriptors
   - e2e: 6 category specs
   - 注: 8 bucket controlled vocabulary、cross-surface 機能なし

4. Lighthouse / chain (= proof display)
   - /box/[handle] verify + GET /box/{handle}/chain + /chain/events
   - KV-backed chain
   - e2e: degradation, receipt-verify
```

### current v2 partial (= 部分実装)

```
5. Matching
   - AntennaDirection='match' として実装
   - 独立 Surface 無、Search Board 露出無
   - Phase 9A で surface_shape=matching として Search Board 接続予定

6. Wanted
   - AntennaDirection='wanted' として実装
   - Search Board 露出無、通知機能無
   - Phase 9A で Search Board 接続、Phase 9B で Watcher 実装予定

7. Ask
   - AntennaDirection='ask' として実装
   - Search Board 露出無
```

### current v2 prototype-only (= render variant、publish 不可)

```
8. Auction
   - Box.variant.kind='auction' render
   - fixture data のみ、publish UI / worker / D1 全て無
   - public copy「auction」「オークション」 禁止 (= forbidden-words-public.test.ts)
   - Phase 9A で surface_shape=auction_like (= 「入札型」 public copy) として新規実装

9. Sale
   - Box.variant.kind='shop' render
   - publish 無
   - Phase 9A で surface_shape=offered として新規実装

10. Stream / Distribution
    - Box.variant.kind='music' render (= MusicLiveEvent)
    - publish 無
    - Phase 9A scope 外
```

### current v2 absent (= 未実装)

```
11. Stand                   - codebase 完全 absent
12. Crowdfunding            - legacy v1 docs のみ
13. Search Board (= /search) - v2 absent (= /category のみ)
14. AI surface (= capability discovery) - placeholder のみ
15. Membership              - 未実装
16. Specialist              - 未実装
```

### 結論 articulate

```
事業 articulate (= §12 PX プロダクト一覧 12 件 Pre-built + Stand + 5 Future):
  business contract で articulate 済

実装現実 (= current v2):
  完全結線: Antenna / Sandbox / Category / Lighthouse の 4 件のみ
  partial: Matching / Wanted / Ask の 3 件 (= Antenna direction として)
  prototype: Auction / Sale / Stream の 3 件 (= render variant のみ)
  absent: Stand / Crowdfunding / Search Board / Membership / Specialist の 5 件

gap 解消:
  Phase 9A = Search Board + Auction-like + Matching + Offered/Stand + Wanted の Search Board 統合
  Phase 9B = Wanted/Antenna pair + Watcher / Alert
  Phase 9C+ = Crowdfunding / Stream / Music / Video / Membership / Specialist
```

これを **隠さず articulate** する。Business contract が「事業の articulate」 + 「実装現実」 + 「Phase 化された解消 path」 を併記、これが PX governance pattern の business 側適用。

---

## §17 Growth Model

PX grows by reducing extraction.

```
1. Owner が Surface または Stand を立てる
2. Surface / Stand は人間 / AI に検索可能
3. Search Board が attention を route (= transaction commission なし)
4. Wanted Antenna で「探している状態」 を articulate
5. Watcher が候補を通知 (= Phase 9B、user が探しに行かなくても返ってくる)
6. Lighthouse が non-adjudicative trust material を提供
7. Owner が更に Surface / Stand を増やす (= PX は transaction に課税しないため)
8. Pro は「operation / hosting / verification convenience が price に見合う」 場合にのみ採用
9. 将来、A2A / attestation traffic が machine-side monetization layer になる
```

「使われる理由」 articulate:

```
PX の有用性は「公開できる」 でなく「置いておけば誰か / AI が見つけてくれる」 にある。
Wanted + Antenna + Watcher の pair が、この「使われる理由」 の core。
```

---

## §18 Monetization Architecture (= 想定 articulate、境界未確定)

```
注意: 以下は想定 articulate、境界決定は Phase 9+ (= §13 articulate)
      「完成前判断時期尚早」 を honor、確定 articulate でない
```

### Free / Core (= 想定)

- own-domain Surface
- basic descriptor publication
- Search Board listing
- basic Lighthouse materials
- プロダクト個別「手数料 0」

### PX Pro (= 想定、年間 10,000 円)

- PX-hosted Surface / PX subdomain
- managed publication tools
- verified route setup
- dashboard convenience
- search/indexing controls

### Infrastructure / SLA (= 想定、Tier 上位通行税モデル)

- verifier API
- attestation API
- receipt / witness infrastructure
- enterprise integration
- agent-readable metadata / routing support

### Future regulated contracts (= 別 contract 想定)

- payment custody / escrow / auction settlement / crowdfunding fund custody
- insurance-linked clearing / dispute resolution

---

## §19 Boundary Commitment

```
PX は将来も以下を絶対化する:
  - 持たない (= no custody)
  - 判定しない (= no adjudication)
  - 預からない (= no escrow)

これら境界の compromise は PX の存在意義を破壊する。
governance overhead はこの絶対化のための保険料。

将来 regulated business に進む場合:
  - 別法人 / 別 contract
  - 本 PX 主体は境界を維持
  - 規制対象事業は「PX 〇〇」 名で別 articulate される
```

具体例:
- PX 決済 = 規制対象、別 contract / 別法人想定
- PX 認証 (= W3C VC issuer) = 規制対象、別 contract 想定
- PX 保険 (= 自律 AI / ロボット) = 規制対象、別 contract 想定

PX 主体 (= PX Registry, Inc.) は持たない / 判定しない / 預からない を絶対化、規制対象事業は別主体で運営。

---

## §20 PX らしさ (= governance overhead として articulate)

PX の差別化:
- platform でなく infrastructure (= architecture inversion)
- 約束 (= 三原則) が architecture 上の不可能性として焼かれている
- governance overhead は「無駄」 でなく「PX 哲学維持の保険料」

governance overhead 構成:
- 26 gate / 17 forbidden column / sealed history + supersede / STOP & CONFIRM
- drift catalog 5 type / 4-agent review / 2-段階 closeout / mechanical exhaustive enumeration

Phase 8 全 5 Stage は無駄なし:

| Stage | 役割 |
|---|---|
| Stage 0 | contract governance |
| Stage 1 | typecheck baseline |
| Stage 2 | auth substrate |
| Stage 3 | Worker persistence |
| Stage 4 | per-Surface publish round-trip |
| Stage 5 | production verification |

各 Stage が necessary。

---

## §21 Business Contract Governance Pattern

engineering 側で確立した governance pattern を business 側にも適用:

```
適用済 (= 本 contract で実践中):
  - version 制 (= v0.0 / v0.1 / v0.2 / v0.3)
  - sealed history (= v0.x を別 file 保存、上書きせず保持)
  - supersede pattern (= 古い articulate を rewrite せず新 version で supersede)
  - revision history (= §23 で articulate)
  - 4-agent review (= Hiroto + Claude + GPT + 必要時 CC)
  - 言い切り絶対化を避ける discipline
  - 棚卸し統合 (= 事業 articulate × 実装現実)

cadence:
  engineering: Stage closeout で seal (= 短 cycle)
  business:    市場 / 戦略 understanding 更新時に update (= 長 cycle)

memory 更新 discipline:
  Claude memory 更新は Hiroto 指示時のみ
  起草中の memory_user_edits 呼び出し禁止 (= 混ざることを避ける)
  本日 v0.0 / v0.1 / v0.2 / v0.3 全起草で discipline 維持
```

---

## §22 Legal Review Input

法務 review に渡す質問項目:

```
1. Does PX become seller of record in any Surface?
2. Does PX become auctioneer of record in PX オークション (= 仮称) / 入札型 Surface?
3. Does PX become crowdfunding platform of record in PX クラファン?
4. Does PX become payment intermediary or fund custodian?
5. Does Search Board create platform responsibility?
6. Does Lighthouse wording imply legal/content judgment?
7. Does anonymous Surface / Stand operation conflict with required seller disclosure?
8. What must be shown by Owner, not PX?
9. What must be shown by PX if PX-hosted?
10. Which Surface / Stand types require separate terms before launch?
11. Does "手数料 0" articulate in product 説明欄 create any liability?
12. Does PX 〇〇 product naming (= 例 PX オークション) imply PX as auctioneer of record?
    - Phase 9A では「入札型」 public copy で実装、PX オークション法務後 timing 判断
13. What is required for 特商法 compliance when Owner uses PX as 販売 route?
14. Does Cloudflare logs retention conflict with PX_NEVER_HOLDS articulation?
15. Future regulated business (= 別法人 articulate、§19) の境界明示は法的に十分か?
16. Wanted + Antenna pair (= Search Board に表示) は matching service の法的位置になるか?
17. Watcher / AI 通知機能は user data 取扱の法的観点は?
```

---

## §22-bis Phase 9A Canonical Decisions (= 実装着手前 fix)

Phase 9A 実装着手前に固定する canonical articulate。CC への pre-start decision confirmation 文面、および将来の Phase 9A implementation prompt 起草時の reference として articulate。

### Phase 9A 命名 + scope

```
名称:     Phase 9A Surface Portfolio Search MVP
目的:     PX_BUSINESS_CONTRACT.md 有用性を実装で証明
          (= 単なる事業 articulate でなく現実 ship state での裏付け)
```

### N1. Auction 命名 articulate

```
internal value:           auction_like
public copy 現状:          「入札型」 / "auction-like"
public copy 法務後:        「PX オークション」 / "PX Auction" 採用検討
法務 review 前 forbidden:  「auction」「オークション」 単独 public copy
                          (= 既存 forbidden-words-public.test.ts と整合)
```

### N2. surface_shape vocabulary (= canonical 4 種)

```
offered      (= 売る / 提供する、Sale 系統合)
auction_like (= 入札型、external action URL 経由)
matching     (= マッチング、Antenna direction=match 経由)
stand        (= user 自由 articulate、内容は user 主導)

合計 4 種、Phase 9A scope 内 strict 固定
GPT 提案 6 種 (= wanted / ask 含む) は採用しない、direction は別軸 (= N3)
```

### N3. intent / direction axis (= canonical 3 種)

```
wanted    (= 探している、欲しい)
offered   (= 提供できる、出せる)
ask       (= 問いたい、相談したい)

合計 3 種、surface_shape と独立軸
GPT 拡張案 (= collaborate / hire / sell / bid) は採用しない
  - collaborate / hire = Stand 内で user articulate (= title / description)
  - sell = offered と同義 (= 重複)
  - bid = surface_shape=auction_like の implicit direction (= 軸重複)
  → 必要なら description / tag / future subtype で扱う、canonical intent には入れない
```

### N4. Search Board route

```
新規実装:  /search route 新規
非採用:    /category 拡張で代用
理由:      /category = 8 bucket controlled vocabulary、bucket-only design
          /search = cross-surface aggregator、独立 design path
```

### N5. Stand / Sale 統合度

```
Phase 9A:  surface_shape=offered と surface_shape=stand の minimal 区別
          full 分離は Phase 9B+
理由:      Phase 9A scope controll、発表 timing 短縮
```

### N6. External action articulate

```
allow:     owner-controlled externalActionUrl
forbid:    payment custody / escrow / bid settlement / PX transaction execution
意味:      auction_like row の bid action は owner 側 (= owner-controlled destination)
          PX-as-auctioneer claim 不在を物理 enforce
```

### N7. Ranking policy

```
allow:     user-selected filter / sort、factual badges
          新着順 / 更新順 / 取引件数順 / Lighthouse availability display 等
forbid:    hidden recommendation / paid boost / PX 中央 judgment 押し付け
articulate: 「ranking 自体は禁止しない」 (= v0.3 §7 articulate)
            judgment 不在 ranking 提供は OK、judgment 介入のみ Forbidden
```

### N8. Wanted / Watcher articulate

```
Phase 9A scope:
  Wanted row が Search Board に表示される (= 必須)
  既存 AntennaDirection='wanted' を Search Board 接続、新規実装最小

Phase 9A out-of-scope:
  Watcher (= candidate alert 機能)
  AI 通知 (= email / push / AI summary)
  → 全て Phase 9B 切り出し

Phase 9A 内で許可する Watcher 関連 articulate:
  copy のみ (= 例「候補通知は今後追加予定」)
  実装は一切しない (= 9A scope controll)
```

### N9. Stage 5 切り離し

```
Stage 5:  Case C pending external input 継続 (= 変更なし)
Phase 9A: Stage 5 と independent、production verification claim 不在
articulate:
  - production-ready claim 不在
  - legal-reviewed claim 不在
  - deploy verified claim 不在
```

### N10. acceptance gates (= Phase 9A 完了条件 11 件、v0.3 §16 から再 articulate)

```
Gate 9A-1:  /search route exists
Gate 9A-2:  GET /search returns D1-backed rows
Gate 9A-3:  auction_like row appears in /search
Gate 9A-4:  matching row appears in /search
Gate 9A-5:  offered / stand row appears in /search
Gate 9A-6:  wanted row appears in /search
Gate 9A-7:  all rows route to public detail/surface
Gate 9A-8:  no private fields leak
Gate 9A-9:  no PX-as-seller / auctioneer / payment / escrow wording
Gate 9A-10: no hidden ranking / paid boost
Gate 9A-11: e2e cross-surface search green
```

### CC 投入用 canonical 文面 (= Phase 9A pre-start decision confirmation)

CC fresh session で Phase 9A 着手前に投下する文面:

```md
Acknowledgement of Phase 9A pre-start decisions fixed by PX_BUSINESS_CONTRACT.md v0.3 §22-bis.

Phase 9A canonical vocabulary:

surface_shape (4 values):
- offered
- auction_like
- matching
- stand

intent (3 values):
- wanted
- offered
- ask

Phase 9A canonical decisions:

N1. Auction naming:
- internal: `auction_like`
- public copy: 「入札型」 / "auction-like"
- do not use "PX オークション" / "PX Auction" until legal review

N2-N3. Vocabulary above. Do not expand to collaborate / hire / sell / bid.

N4. Search Board route:
- new `/search`
- do not overload `/category`

N5. Stand / Sale:
- minimal `offered` / `stand` distinction in Phase 9A
- full separation deferred to Phase 9B+

N6. External action:
- allow owner-controlled `externalActionUrl`
- forbid payment custody / escrow / bid settlement / PX transaction execution

N7. Ranking:
- allow user-selected filter/sort, factual badges
- forbid hidden recommendation / paid boost

N8. Wanted / Watcher:
- Phase 9A: Wanted rows must appear in Search Board (mandatory)
- Phase 9A: do NOT implement Watcher / candidate alert / AI notification
- copy-only "今後追加予定" acceptable, no implementation

N9. Stage 5:
- remains Case C pending external input
- no production-ready / legal-reviewed / deploy verified claim

N10. Phase 9A acceptance gates: 11 items per v0.3 §22-bis

Return acknowledgement only.
Do not implement yet.
Await Phase 9A implementation prompt.
```

---

# 過去 memory 由来 (= §A-E、明示 merge、v0.1 から継承)

---

## §A 42 枚 HTML reference

```
location:      px-demo-v1.1/px-demo-build/*.html
articulate:    「demo-build/*.html — read-only canonical specification
                これら 42 ページは product を定義する
                modify 禁止」
                「If 既存 Composer と demo が contradict したら、demo wins」
意味:           42 枚 HTML は PX product の真の仕様書
                business contract も 42 枚 HTML と矛盾しないこと
```

### Design tone (= canonical articulation)

```
canonical:    金茶 (#8b6f2f) + EB Garamond + Noto Serif JP + JetBrains Mono
retire:       朱 (#A4423A) + Source Serif (= final-shell research only)
retire:       Cormorant / DM Sans (= v1)
```

---

## §B 維持費 4 段階計算

```
段階 0 (= 開発中、ユーザーゼロ):
  月 ¥50,000-100,000

段階 1 (= 100 Owner):
  月 ¥90,000-100,000 (+ Hiroto 生活費)
  
段階 2 (= 1,000 Owner):
  月 ¥170,000-250,000 (+ Hiroto / 雇用検討)
  収入: 年 460-660 万円
  → 事業として収支均衡入口

段階 3 (= 10,000 Owner):
  月 ¥2,130,000-2,580,000 (+ 従業員 2 名)
  収入: 年 5,800-8,800 万円
  → 明確な黒字
```

### break-even articulation

- 段階 2 (= 1,000 Owner) で事業として成立
- 段階 3 (= 10,000 Owner) で明確な黒字
- Pro 課金額 = 本日 ¥10,000/年 が canonical、計算 base 数字 v0.x で update 想定

---

## §C 法人 + 商標

### 法人

```
法人名:        PX Registry, Inc. (= 日本登記)
登記:          登記済
```

### 商標 articulate (= 計画段階、実施状況確認待ち)

```
F-1 商標出願日本:  特許庁、第 9 類 / 第 42 類
F-2 商標出願米国:  USPTO、Class 9 / 42
F-3 商標 counsel:  JP + US 同時対応可能

実施状況:        Hiroto 確認待ち (= §24 Open Questions Q5)
```

---

## §D 創業動機 + PX 起源

```
PX 発明の順番:

1. 4KB マニフェスト (= 機械可読、Lens は翻訳機)
2. fail-close (= 自動切断、不完全なものは封印できない)
3. 「これなら保険が掛けられる」 (= 自律 AI / ロボット事故 risk を 4KB で証明、代理店経由通行税)
4. 通行税モデル発展 (= 「これは封筒だ」 と AI 達が一致)
5. 現形 (= Flow Assurance Network、「自由を邪魔しない」 への昇華)
```

### 兆円規模根拠

- 大手企業の生 log 保持を 4KB マニフェストで代替
- EU CRA (= 2027 施行) で生 log 対応 cost 大
- 「proof を生成する世界」 を技術北極星として保持

---

## §E PX Boundary Document v1 (= 過去 articulate、参照)

```
記録: 2026-04-22、Living document
参照: 別 file (= BOUNDARY.md) で詳細管理想定

原則 articulate:
  A: 手数料 0 (= no take-rate)
  B: 持たない範囲限定 (= custody / liability / lock-in のみ)
  C: Lighthouse 観測 (= PX 自身が witness 兼ねない)
  D: PX-hosted ratio を北極星 KPI
  E: 5 分優先 (= user UX)
  F: Activity chain 仮説
  G: 2027 CRA 対応
  H: memory / retention revenue
  I: Memory-first, proof-later
  J: Protocol call volume を副北極星
  K: Publisher-protocol / Subscriber-product の非対称
  L: Cede to descend
```

---

## §23 Revision history

```
v0.0  (= 2026-05-17 朝)
  source: 本日対話のみ
  確定:   §1-§14 暫定
  unknown: 18 項目

v0.1  (= 2026-05-17 夕)
  source: v0.0 + 過去 memory 探索 6 search
  merge:  42 枚 HTML / 維持費 / 法人 + 商標 / 創業動機 / Boundary Doc
  Hiroto accept: 一行 articulate / 社会的 contribution / 板 articulation 2 軸 / Pro 課金境界将来明示 / 5 beta 自由選択

v0.2  (= 2026-05-18)
  source: v0.1 + GPT feedback への Hiroto judgment
  Hiroto judgment 11 件 反映: 唯一削除 / ドメイン未確定 / Search Board ranking allow / 離脱の自由控えめ / 中央集権の逆→PX独自 / 中抜き→手数料0 / 特商法弱める / running→marginal / Stand命名 / プロダクト一覧 / 私追加 4 件

v0.3  (= 2026-05-18、本 document)
  source: v0.2 + CC 棚卸し報告 + GPT Phase 9A 設計 + Wanted/Antenna 追加 articulate
  Hiroto accept:
    - 棚卸し統合 (= §12 implementation status + §16-bis snapshot)
    - Wanted/Antenna/Watcher pair の articulate 前面化 (= §9 + §12)
    - PX マッチング articulate 整合 (= Matching = 機能 / Match = 結果)
    - Phase 9A scope articulate (= §16)
    - Auction 命名 timing articulate (= 「入札型」 先行、PX オークション法務後)
    - intent 軸 articulate (= 3 種: wanted / offered / ask)
    - Layer 4 整理 (= §3)
  私 articulate (= Hiroto accept):
    - intent vocabulary 簡潔化 (= GPT 7 種 → 3 種)
    - Phase 9A scope controll (= Watcher を Phase 9B 切り出し)
    - PX マッチング articulate 整合維持
  未確定: 12 項目 (= §24)

v0.3 minor update  (= 2026-05-18 後刻、本 file 内 fix)
  source: v0.3 GPT review accept + Phase 9A canonical 固定要請
  反映:
    - §22-bis Phase 9A Canonical Decisions 新規追加
      (= N1-N10 + CC 投入用 canonical 文面)
    - §0 status update (= GPT review accept、Phase 9A canonical 確定)
    - §0 next articulate 追加 (= Phase 9A implementation prompt 起草 → CC fresh session)
  方針: v0.4 化せず v0.3 内 minor update (= Hiroto judgment「v0.4 でなくて OK」)
  GPT correction 反映: CC acknowledgement intent 一時的 6 種 → canonical 3 種 articulate
                       Watcher Phase 9A 実装回避 articulate 明示
                       「手数料 0」 product 個別 articulate 維持
                       Search Board ranking policy 維持 (= judgment 不在 ranking 提供 OK)

memory 更新:
  v0.0 / v0.1 / v0.2 / v0.3 全起草で Claude memory 更新せず継続
  Hiroto articulate「混ざることを避ける」 honor 維持
```

---

## §24 Open Questions (= 別 session 続行)

```
本 v0.3 で確定しなかった項目:

1. Pro 課金境界の具体 (= 全機能 user 触れ完了後、Phase 9+ で articulate)

2. ドメイン / hosting / Pro 関係の articulate (= 「より良い考え方があるはず」)

3. 著名人 / 権威者 invitee 候補 (= Hiroto network 内、領域・関係性)

4. 利用規約 / プライバシーポリシー / 特商法表記 素案

5. 法人事業範囲 / 税務扱い (= 業種登録の具体)

6. 商標出願実施状況 (= JP / US の現状)

7. 維持費計算 update (= ¥10,000/年 base での再計算)

8. PX Boundary Document v1 (= §E) と本 v0.3 の完全整合確認

9. 検索板 indexing default (= opt-in / opt-out 既定の articulate)

10. Composer 詳細 articulate (= 必須 / optional / 機能範囲)

11. Auction 公開呼称 timing (= 「入札型」 → PX オークション 移行の法務 review 後 判断)

12. Phase 9B / 9C scope detail (= Phase 9A 完了時に再 articulate)
```

### v0.3 で close した項目 (= v0.2 §24 から)

```
✅ Q11 (旧): PX オークション / クラファン / 等の Surface 別 implementation 進捗
   → 本 v0.3 §12 + §16-bis に articulate 統合

✅ Q12 (旧): PX プロダクト一覧 implementation hardness 用 detail articulate
   → 本 v0.3 §12 に各プロダクト「実装 status」 行追加で articulate
```

---

```
PX Registry, Inc. · Tokyo · 2026
px-registry.org · hello@px-registry.org
```

---

# v0.4 (= 2026-05-23、strategic contract revision、Phase 10F-α 後 additive)

```
version: v0.4 (= Phase 10F-α 後 strategic contract revision)
status:  v0.3 sealed body byte-stable preserve、本 v0.4 zone は strictly additive
source:  v0.3 + Phase 10D / 10E / 10F-α implementation 実態 + Owner OS framing 確定
         + 5-layer Revenue Architecture articulate + Multi-Agent Era position
         + Multi-Agent Collaboration Architecture (= Phase 10K+ candidate)
         + Implementation Roadmap (= Phase 10F-β 以降 articulate)
predecessor: v0.3 (= 2026-05-18、棚卸し統合 + Wanted/Antenna pair + Phase 9A scope、
                    97a99ce で sealed、本 v0.4 では rewrite せず)
v0.3 baseline hash: 97a99ce (= 2026-05-18 確定、本 v0.4 起草時 git log で再確認済)
v0.4 scope:  docs-only。implementation 不在。Phase 10F-β / 10G / 10H / 10I / 10K の start
              ではない。Stage 5 起動でもない。business architecture 自体が evolve した
              ことの articulate である。
not started: Phase 10F-β / Phase 10G / Phase 10H / Phase 10I / Phase 10J / Phase 10K
             Stage 5 / Phase 9K
not changed: pxBoundaries × 5 (= noCustody / noAdjudication / noEscrow / noRecommendation
             / noJudgment)
             Public / Private Layer separation
             Memory body Owner-held
             Owner-mediated AI integration (= no PX-AI connector)
v0.3 update: v0.3 sealed body は byte-stable preserve、本 v0.4 zone は additive のみ。
             v0.3 articulations の refinement は §V0.4-7 supersede table で明示する。
```

## §V0.4-0 本 zone の位置付け

本 zone は PX_BUSINESS_CONTRACT.md v0.4 として、v0.3 (= 2026-05-18 sealed) の上に
strictly additive な articulate を加える。

含めるもの:
- Owner OS framing (= AI 時代の主体に「OS」 比喩の articulate と非対称強制ガード)
- 5-layer Revenue Architecture (= invariant-compatible revenue layering)
- Multi-Agent Era 位置付け (= 反AI ではない、特定 provider 反対でもない)
- Multi-Agent Collaboration Architecture (= Phase 10K+ candidate、long-term articulation)
- Implementation Roadmap (= Phase 10F-β 以降の architectural evolution 順序)
- v0.3 → v0.4 supersede table

含めないもの:
- v0.3 sealed history の rewrite
- v0.3 既存 §0-§24 + §22-bis + §A-E の reorder / 削除 / 上書き
- 新 SKU の launch 宣言
- production deploy / 法務 review 完了 / deploy verified の claim
- Phase 10F-β / Phase 10G / Phase 10H / Phase 10I / Phase 10K の start
- Stage 5 entry
- "Memory Commons" を positive product / branding term として採用 (= forbidden、§V0.4-4 参照)

cadence:
- engineering: Stage closeout で seal (= 短 cycle)
- business contract: business architecture 自体が evolve した時にのみ revise (= 長 cycle)
- 本 v0.4 は「Phase 10D + Phase 10E + Phase 10F-α で焼かれた Memory Card + Public Manifest
  + Memory Set Export/Import substrate が、business architecture の articulate を更新する
  根拠を提供した」 ことに対する revise。

---

## §V0.4-1 Vision Statement (= Owner OS framing)

### Core articulation

```
PXは、AI時代に任される主体のためのOwner OSである。

ここで言う「OS」とは、Owner自身が判断・公開・受け渡し・記憶・証跡を、
中央プラットフォームに吸い上げられずに保持・運用するための substrate を意味する。
```

### Required guards (= verbatim、絶対化)

```
PXは Owner の代わりに判断しない。
PXは Owner を評価しない。
PXは Owner の AI を選ばない。
PXは、Owner が自分の判断・宣言・受け渡し・証跡を持てる substrate を提供する。

Owner OS という比喩は、PXが Owner を所有・管理・最適化する OS ではないことを意味する。
PXは Owner の OS ではなく、Owner が PX を OS として使う関係である。
```

### articulate の意味

「Owner OS」 は PX の architectural inversion を表す。

- 既存 platform: platform が Owner を所有・管理・最適化する OS として振る舞う
- PX: Owner が自分自身を運用する substrate として PX を使う

この方向の非対称は v0.3 §1 (= 「あなたの自由を邪魔しない infrastructure」) と整合し、
§2 三原則 (= 持たない / 判定しない / 預からない) + Phase 10E-α pxBoundaries × 5 (= no
Custody / noAdjudication / noEscrow / noRecommendation / noJudgment) に物理 enforce
されている。

v0.4 が articulate するのは、AI 時代に「Owner が任される主体である」 ことを framing
言葉として明示することである。

### 反 articulate (= 必ず避ける言い回し)

以下は PX の自己 articulate として禁止:

- 「PX は Owner を最適化する」
- 「PX は Owner のために judge する」
- 「PX は Owner の AI を選んでくれる」
- 「PX は Owner を管理する OS」
- 「PX-managed Owner」
- 「PX-optimized Owner journey」

これらは Owner OS framing の非対称を violate するため、UI copy / marketing / docs 全
layer で不在を維持する。

---

## §V0.4-2 Revenue Architecture (= 5 invariant-compatible layers)

### Core articulation

```
PXの収益構造は、architectural invariants と整合する5層に articulate される。
各 layer は invariant-compatible であり、PXの三原則 (= 持たない / 判定しない / 預からない)
を一つも violate しない。
```

本 §V0.4-2 は「revenue layer の存在を articulate する」 ものであり、 個別 layer の
SKU launch 宣言ではない。各 layer の本実装 timing + 課金境界 + pricing は別 articulate
として確定される (= v0.3 §13 + §18 + §V0.4-6 参照)。

### Layer A — Substrate (= free forever)

```
内容:        PX protocol、manifest formats、Memory Card schema、MemorySetExport
            format、MemorySetImport format、Lighthouse semantics、Handoff semantics、
            self-hosted L0-L6 一式
articulate: 永続 free
役割:        adoption infrastructure
PX revenue:  本 layer は直接 revenue ではない、PX が成立するための土台

実装現実 (= v0.4 起草時 status):
  Memory Card schema:           Phase 10D で焼成、lib/memory-card.ts
  agent-public-manifest:        Phase 10E-α で焼成、lib/agent-public-manifest.ts
  MemorySetExport format:       Phase 10E-β で焼成、lib/memory-set-export.ts
  MemorySetImport format:       Phase 10F-α で焼成、lib/memory-set-import.ts
  Lighthouse semantics:         Phase 7d substrate 焼成済
  Handoff semantics:            Phase 7d substrate 焼成済
```

### Layer B — Managed Convenience (= Owner Pro subscription)

```
内容:        Owner は self-hosted で free 利用可能。
            PXは以下の operational convenience に対して subscription fee を取れる:
              - managed hosting
              - domain setup (= 独自 domain 設定支援)
              - owner-held encrypted sync (= Owner-held key、PX が body を持たない form)
              - backup (= Owner-controlled)
              - support
              - route health check
              - operational convenience
            
articulate: Owner Pro status は public trust status になってはならない。
            Pro 加入が Search Board / Lighthouse / Surface / Distillate catalog に
            表示されることはない。
            
            Pro は「operation / hosting / verification convenience が price に見合う」
            場合にのみ Owner が選ぶもの。
            Pro 加入で Owner の Surface が「優遇 ranking」 されることはない (= v0.3
            §7 ranking policy と整合)。

本実装 timing: Stage 5 production deploy 後、または並行として位置づけられる。
              v0.4 起草時点で SKU launch 宣言は不在。
              v0.3 §13 articulate「課金境界の決定は『全機能が user に触れる』 後」
              を honor。
              年間 10,000 円 (= v0.3 §13) は計算 base 維持、確定 SKU 価格は別 articulate。
```

### Layer C — Machine Attestation (= usage-based + enterprise SLA)

```
内容:        PXは agents、enterprises、verifier systems に対して、以下の machine-side
            consumption に対する usage-based pricing を提供する:
              - receipt verification
              - manifest fetch
              - provenance check
              - handoff envelope verification
              - revocation proof
              - webhook subscription
              - batch audit pipeline
            
articulate: PXが emit するのは proof であり、judgment ではない。
            
            本 layer の articulation では "certification" ではなく "attestation"
            を採用する。
            "certification" は「PX 認定」 を連想させ、judgment / recommendation
            への drift を招くため避ける。
            
意味:        Tier 上位通行税 (= v0.3 §15 + §18) の architectural articulate。
            「proof を生成する世界」 (= v0.3 §1 技術北極星) の machine-side
            monetization layer。

本実装 timing: Phase 10G で foundation 着手想定 (= §V0.4-6 Roadmap 参照)。
              v0.4 起草時点では未着手、本 v0.4 で start するわけではない。
```

### Layer D — Knowledge Commons (= PX transaction fee 0%)

```
内容:        Owner-approved Distillate (= Owner が確認・承認した蒸留版) が流通する
            場として、PXは以下を提供する:
              - format (= Distillate schema)
              - gallery (= 公開 catalog)
              - import/export flow
              - proof infrastructure (= chain + receipt + Lighthouse 接続)
            
articulate:  PXは raw memory を monetize しない。
            PXは popularity でランクしない。
            PXは Distillate を judgment として recommend しない。
            PXは curator ではなく substrate である。
            
            Knowledge Commons は Memory Commons ではない。
            Knowledge Commons は private Memory を publish しない。
            Knowledge Commons は Owner-approved external artifacts のみを扱う。
            
            Owner-to-Owner transaction は Stripe direct で PX 不介入、PXは 0% fee。
            これは v0.3 §12 個別 product「手数料 0」 の Knowledge Commons 領域への
            extend と整合する。

意味:        v0.3 §17 Growth Model「PX grows by reducing extraction」 の articulate
            を Owner-approved Distillate 流通領域に適用したもの。

本実装 timing: Phase 10I 想定 (= §V0.4-6 Roadmap 参照)。
              v0.4 起草時点では未着手、本 v0.4 で start するわけではない。
              Distillate Safety State + bad advice 防止の articulate は Phase 10F-β
              / Phase 10G で先行設計される想定。
```

### Layer E — Regulated Services (= separate legal entity / brand / contract)

```
内容:        mediation、insurance、legal dispatch、custody、escrow、certification、
            regulated judgment function は、PX core の外で別法人として運用される。

articulate:  PX core は noCustody / noAdjudication / noEscrow / noRecommendation /
            noJudgment を維持する。
            
            別法人は PX とは別の brand、別の domain、別の contract で運用される。
            PX surface に別法人の judgment が「PX 判定」 として表示されることはない。
            
            If a regulated-services entity uses certification wording, it must be
            legally and operationally separate from PX core.
            It must never surface inside PX core as "PX認定", "PX certified",
            "PX verified", or any equivalent recommendation / judgment label.

意味:        v0.3 §19 Boundary Commitment「将来 regulated business に進む場合: 別法人
            / 別 contract」 の articulate を「certification wording の core 不混入」
            に拡張したもの。
            Layer E は PX core の外、PX core invariants と物理隔離される。

本実装 timing: 本 v0.4 + 後続 contract layer で詳細を articulate する。
              v0.3 §19 + §22 (= Legal Review Input Q15) の延長線。
              本 v0.4 では「Layer E が PX core から分離されている」 ことの articulate
              のみを行い、別法人 setup / contract drafting / brand identity は別
              artifact + 別 session 対象とする。
```

### invariant compatibility table (= 各 layer × 三原則 + pxBoundaries × 5)

```
                 noCustody  noAdjudication  noEscrow  noRecommendation  noJudgment
Layer A         ✓          ✓               ✓         ✓                 ✓
Layer B         ✓          ✓               ✓         ✓ (= Pro non-status) ✓
Layer C         ✓          ✓               ✓         ✓ (= attestation not certify) ✓ (= proof not judgment)
Layer D         ✓          ✓               ✓         ✓ (= no popularity ranking) ✓ (= no curation judgment)
Layer E         (PX core 外で運用される、PX core invariants から物理隔離)
```

Layer A-D の全てで pxBoundaries × 5 を維持。
Layer E は PX core 外として隔離、PX core invariants は touch しない。

---

## §V0.4-3 Multi-Agent Era Position

### Core articulation

```
PXは、multi-agent AI era における civic infrastructure として位置づけられる。
```

### Required guards (= verbatim、絶対化)

```
PXは反AIではない。
PXは、AIが行動するための土台が単一の provider に閉じることに反対する。
PXは、Owner が複数のAIを選び替えられるための、読み取り可能で持ち運べる substrate
を提供する。
PXは、特定のAI provider に対抗するのではなく、多くのAIと連携可能な infrastructure
として設計される。
```

### Articulation body

主要 AI providers が「強いAIを持つ」「memory を抱える」「judgment を提供する」 方向に
進む中、PXは:

```
- AIを持たない (= substrate のみ、PX-AI connector 不在、Owner-mediated AI 整合)
- Memory を Owner 側に置く (= Phase 10D 焼成済、Memory Card body は Owner-held)
- judgment を発しない (= proof のみ、pxBoundaries noJudgment)
- 物理 action を Owner-mediated に保つ (= Phase 10F-α import flow も Owner per-card
  judgment + per-card import + 一括 import 不在)
```

という architectural inversion を取る。

これは limitation ではなく、PXのarchitectural moatである。

主要 AI providers の business model はAI所有 (= 強いAIを抱え込むこと) に依存しており、
substrate-only positioning を embrace できない構造的制約がある。
PXはこの structural gap を埋める唯一の architecture として機能する。

### 反 articulate (= 必ず避ける言い回し)

以下は PX の自己 articulate として禁止:

- 「PX は AI に対抗する」
- 「PX は (特定 AI provider 名) に対抗する」
- 「PX は AI を信用していない」
- 「PX は AI を制限する」
- 「PX は AI の影響から Owner を守る」 (= Owner OS framing と非対称が逆になる)
- 「PX は AI を選別する」

これらは Multi-Agent Era position の非対称を violate するため、UI copy / marketing
/ docs 全 layer で不在を維持する。

---

## §V0.4-4 Multi-Agent Collaboration Architecture (= Phase 10K+ candidate、long-term articulation)

### Core articulation

```
PXは、Owner-mediated multi-agent collaboration のための substrate を提供する。

これは Phase 10K+ candidate であり、現時点では long-term articulation である。
実装は Phase 10F / G / H / I + Stage 5 完成後に検討される。
```

本 §V0.4-4 は articulate のみ、本 v0.4 では実装に着手しない。
Phase 10K+ の atomic STOP #0 は将来 fresh session で別 Hiroto judgment driven。

### Required guards (= verbatim、絶対化)

```
PXは agent ではない。
PXは agent orchestrator ではない。
PXは agent recommendation service ではない。
PXは agent execution service ではない。
PXは、Owner が選んだ agent が読める材料・receipt・boundary・history を整える
substrate である。
```

### Candidate layers (= future implementation、articulation only)

本 v0.4 では articulate のみを行い、各 layer の schema / implementation / SKU は
未着手。

```
Capability Card     (= agent self-declaration、agent が自己 articulate するための schema)
Handoff Packet      (= work contract、Owner ↔ agent の作業引き渡しの receipt 構造)
Permission Scope    (= safety boundary、agent が触れる scope の Owner-explicit articulate)
Memory Lens         (= Owner-approved context extraction、Private Memory から外向け
                      view を Owner judgment で抽出するための extract pattern)
Receipt Ledger      (= history aggregation、agent ごとの作業 receipt の集計)
Trust Profile       (= receipt-history-derived facts、NOT PX judgment、§V0.4-4 内で
                      別 articulate)
Workflow Memory     (= successful pattern preservation、Owner が承認した workflow を
                      Memory Card 系として残す)
```

### Invariants (= 絶対化)

```
Owner が agent を選ぶ (= PXは選ばない)。
Critic Agent / Owner が agent output を judge する (= PXは judge しない)。
Memory Proposal のみが external agent から受け入れられる
(= Memory Proposal ではない direct write は不在)。
Raw Private Memory は Owner の vault から外に出ない。
External agent は Private Memory に直接 access できない。
External agent は Memory Proposal を返すことのみ可能。
PXは Receipt を emit し、judgment は emit しない。
```

これらは Phase 10D + Phase 10E + Phase 10F-α で既に substrate-level に焼成済の
invariants の延長:
- Memory body Owner-held (= Phase 10D)
- noJudgment / noRecommendation (= Phase 10E-α pxBoundaries × 5)
- Memory Proposal 経由 (= Phase 10E-β proposal intake、direct write 不在)
- per-card judgment + per-card import (= Phase 10F-α import flow)

### Trust Profile articulation

```
内容:        receipt history aggregation のみ。
            PXによる ranking / scoring / judgment は不在。

example (= allowed、事実集計のみ):
  Agent A code review: 8 accepted / 2 rejected / 0 disputed

forbidden articulations:
  high / medium / low ranking
  trustworthy: yes / no
  recommended: yes / no
  PX-certified
  verified Agent
  trust score
  hallucination risk score (= PXがhallucination を判定する)
```

Trust Profile は v0.3 §7 ranking policy「PX 単独 judgment による中央集権 ranking」
Forbidden + Phase 10E-α noRecommendation / noJudgment と整合。
Trust Profile は「事実集計の見え方」 のみ、agent 評価の judgment は PX を経由しない。

### Use case articulation

```
「PXがPXを作る」 ではない。
「Owner が PX Agent Commons を使って PX を開発する」 と articulate する。

現在の 4-agent review pattern (= Owner / Claude / GPT / CC) が、将来 PX Agent
Commons の reference implementation の prototype となる。
```

意味:

- v0.3 §21 Business Contract Governance Pattern「4-agent review (= Hiroto + Claude
  + GPT + 必要時 CC)」 で焼成された pattern は、Phase 10K+ の Agent Commons の
  reference implementation の prototype として位置づけられる。
- これは「PX が agent を統治する」 ではなく「Owner が複数 agent を選び、Owner が
  judgment する」 pattern の prototype。
- Phase 10K+ では本 pattern を schema / receipt / boundary として一般化する想定、
  本 v0.4 では articulate のみ。

### 反 articulate (= 必ず避ける言い回し)

以下は PX の自己 articulate として禁止:

- 「PX が agent を選ぶ」
- 「PX が agent を ranking する」
- 「PX が agent を recommend する」
- 「PX が agent の信頼度を judge する」
- 「PX が agent を orchestrate する」
- 「PX が agent を execute する」
- 「PX-orchestrated multi-agent workflow」

これらは §V0.4-4 invariants を violate するため、UI copy / marketing / docs 全
layer で不在を維持する。

---

## §V0.4-5 Strict invariants preserved in v0.4

本 v0.4 は以下の invariants を全 layer で維持する:

```
1. pxBoundaries × 5
   noCustody / noAdjudication / noEscrow / noRecommendation / noJudgment
   (= Phase 10E-α agent-public-manifest 焼成済)

2. Public / Private Layer separation
   (= Phase 10D Memory Card body Owner-held + Phase 10E manifest Public のみ articulate)

3. Memory body Owner-held
   (= Phase 10D 焼成、Phase 10E-β / 10F-α でも維持)

4. Owner-mediated AI integration (= no PX-AI connector)
   (= 本 v0.4 §V0.4-3 で再 articulate)

5. No production-ready / legal-reviewed / deploy-verified claim
   (= v0.3 §16 + §22-bis N9 + 本 v0.4 で維持)

6. Stage 5 remains Case C
   (= v0.3 §16 + §22-bis N9 + 本 v0.4 で維持)

7. Phase 9K not started
   (= 本 v0.4 で再 articulate)

8. "Memory Commons" branding 不在 (= positive product / branding term として)
   (= 本 v0.4 §V0.4-2 Layer D + §V0.4-4 Workflow Memory で「Memory Commons ではない」
     と articulate のみ)

9. All revenue articulations frame existence of layer, not active SKU launch
   (= 本 v0.4 §V0.4-2 Layer A-E 全てで「本実装 timing」 行を articulate、launch 宣言
     不在)
```

---

## §V0.4-6 Implementation Roadmap

### Core articulation

```
Implementation Roadmap は、PXの architectural evolution の phase sequence を
articulate する。

各 phase は独立した implementation step であり、各々が独立した STOP #0 + 
implementation + canonical sync の 2-commit form で焼成される。

本 Roadmap は「実装宣言」 ではなく、「architectural evolution の予期される順序」
の articulation である。
各 phase の実装着手は、 Hiroto judgment + STOP #0 + 4-agent review pattern を経て
初めて開始される。
```

### Phase sequence

```
Phase 10F-α  Memory Set Import                   [done — b64cbd5 (atomic) + de1ac8d (closeout marker)]
Phase 10F-β  Memory Distillate                   (Owner-driven AI compression)
Phase 10F-γ  Quiet Cockpit polish                (UX refinement、/me/memory 全体)
Phase 10F-δ  Public Layer manifest enrichment    (Layer C prereq)
Phase 10G    Attestation API foundation          (Layer C revenue start)
Phase 10H    Owner Pro infrastructure            (Layer B、post-Stage-5 想定)
Phase 10I    Knowledge Commons publishing        (Layer D)
Phase 10J+   Enterprise / Federated Registry     (Layer C 上位)
Phase 10K+   PX Agent Commons substrate          (long-term candidate、§V0.4-4)
Stage 5      External-input track                (parallel、Case C、v0.3 §16 articulate 継承)
```

note:

- Phase 10F-β の最終 sub-phase 分解 (= β / γ / δ 三分割か Phase 10F 内 sub-phase か)
  は本 v0.4 では確定しない。各 phase の atomic STOP #0 で確定。
- Phase 10G の Attestation API foundation は Layer C revenue の start ではあるが、
  enterprise SLA / batch audit / webhook subscription full launch ではない。foundation
  のみ。
- Phase 10H Owner Pro infrastructure は Stage 5 production deploy 後または parallel
  として位置づけられる (= §V0.4-2 Layer B articulate 整合)。
- Phase 10I Knowledge Commons publishing は Distillate Safety State + bad advice
  防止 articulate が Phase 10F-β / 10G で先行設計された後の着手想定。
- Phase 10K+ は §V0.4-4 articulate のみ、本 v0.4 では着手しない。
- Stage 5 は v0.3 §16 + §22-bis N9 articulate 継承、本 v0.4 で起動しない。

### Reference to operational backlog

```
Detailed operational task tracking、cross-cutting invariant gates、Stage 5
prerequisites、strategic docs backlog は、PX_IMPLEMENTATION_BACKLOG.md として
separate operational artifact で維持される。

その backlog file は各 phase closing 時に refresh される。
本 contract (v0.4) は、business architecture 自体が evolve したときにのみ revise
される。
```

note:
- PX_IMPLEMENTATION_BACKLOG.md は本 v0.4 起草時点では未作成 (= forward-looking
  reference)、Phase 10F-β 起動時 or 別 fresh session で初版を作成想定。
- backlog artifact は operational、本 contract は strategic。両者の cadence + scope
  + sealing 規律は独立。
- 本 v0.4 では backlog の作成自体には着手しない (= docs-only scope cap)。

---

## §V0.4-7 v0.3 → v0.4 supersede table

v0.3 から refine された articulations を supersede table として articulate する。
v0.3 sealed body は byte-stable preserve、本 table は v0.4 が v0.3 を更新する
form の明示。

```
v0.3 articulation                          v0.4 form
───────────────────────────────────────    ──────────────────────────────────────
「あなたの自由を邪魔しない infrastructure」    Owner OS framing として再 articulate
(= v0.3 §1)                                (= 本 v0.4 §V0.4-1)

PX 三原則 (= 持たない/判定しない/預からない)   pxBoundaries × 5 (10E-α manifest) と一貫
(= v0.3 §2)                                (= 本 v0.4 §V0.4-5)

10 product fee=0                            Layer A free forever / Layer D 0% fee と一貫
(= v0.3 §12)                               (= 本 v0.4 §V0.4-2)

Pro boundary 未確定                         Layer B Managed Convenience として articulate
(= v0.3 §13)                               (= 本 v0.4 §V0.4-2 Layer B、SKU launch 宣言不在)

将来 regulated business は別法人             Layer E Regulated Services として articulate
(= v0.3 §19)                               (= 本 v0.4 §V0.4-2 Layer E、certification
                                              wording の core 不混入を追加 articulate)

Memory body Owner-held (= 10D)              Multi-Agent Collaboration の invariant に carry
                                            (= 本 v0.4 §V0.4-4 invariants)

noJudgment / noRecommendation (= 10E-α)     Trust Profile / Attestation 全体に carry
                                            (= 本 v0.4 §V0.4-2 Layer C "attestation
                                              not certification" + §V0.4-4 Trust
                                              Profile facts only)
```

supersede の意味:

- v0.3 sealed body は touch しない (= byte-stable preserve)。
- 本 supersede table は「v0.4 zone を読む時に、v0.3 のどの articulate が refine
  されたか」 を navigate するための reference。
- v0.3 と v0.4 が矛盾する articulate を持つ場合、本 supersede table に明示し、
  v0.4 form を canonical とする。
- 本 supersede table に列挙されていない v0.3 articulate は v0.3 のまま canonical。

---

## §V0.4-8 v0.4 内 4 articulation guards (= 全 layer 跨り、再確認 reference)

本 v0.4 で articulate された 4 系統の guard を、reference として 1 箇所に集約。
詳細は各 §V0.4-1 / -2 / -3 / -4 を参照。

### Guard A — Owner OS guards (= §V0.4-1 由来)

```
PXは Owner の代わりに判断しない。
PXは Owner を評価しない。
PXは Owner の AI を選ばない。
PXは、Owner が自分の判断・宣言・受け渡し・証跡を持てる substrate を提供する。

Owner OS という比喩は、PXが Owner を所有・管理・最適化する OS ではないことを意味する。
PXは Owner の OS ではなく、Owner が PX を OS として使う関係である。
```

### Guard B — 5-layer guards (= §V0.4-2 由来)

```
attestation を採用、certification は採用しない (= Layer C)。
curator は不在、PXは substrate (= Layer D)。
Memory Commons branding は positive product / branding term として不在
(= Layer D + §V0.4-4 Workflow Memory)。
Knowledge Commons は Memory Commons ではない (= Layer D contrast articulate)。
Knowledge Commons は private Memory を publish しない (= Layer D)。
Layer E certification wording は PX core に surface しない
(= "PX認定" / "PX certified" / "PX verified" 不在)。
```

### Guard C — Multi-Agent Era guards (= §V0.4-3 由来)

```
PXは反AIではない。
PXは、特定のAI provider に対抗するのではなく、多くのAIと連携可能な infrastructure
として設計される。
PXは、AIが行動するための土台が単一の provider に閉じることに反対する。
PXは、Owner が複数のAIを選び替えられるための、読み取り可能で持ち運べる substrate
を提供する。
```

### Guard D — Agent Commons guards (= §V0.4-4 由来)

```
PXは agent ではない。
PXは agent orchestrator ではない。
PXは agent recommendation service ではない。
PXは agent execution service ではない。
PXは、Owner が選んだ agent が読める材料・receipt・boundary・history を整える
substrate である。
```

---

## §V0.4-9 v0.4 revision history

```
v0.4  (= 2026-05-23、本 zone)
  source: v0.3 sealed + Phase 10D / 10E / 10F-α implementation 実態 + Owner OS
          framing + 5-layer Revenue Architecture + Multi-Agent Era position +
          Multi-Agent Collaboration Architecture (= Phase 10K+ candidate) +
          Implementation Roadmap (= Phase 10F-β 以降)
  反映:
    - §V0.4-0 本 zone の位置付け
    - §V0.4-1 Vision Statement (= Owner OS framing)
    - §V0.4-2 Revenue Architecture (= 5 invariant-compatible layers)
    - §V0.4-3 Multi-Agent Era Position
    - §V0.4-4 Multi-Agent Collaboration Architecture (= Phase 10K+ candidate)
    - §V0.4-5 Strict invariants preserved in v0.4
    - §V0.4-6 Implementation Roadmap (= forward-looking、未着手 articulate)
    - §V0.4-7 v0.3 → v0.4 supersede table
    - §V0.4-8 v0.4 内 4 articulation guards (= guard 集約 reference)
    - §V0.4-9 本 revision history
  方針:
    - v0.3 sealed body は byte-stable preserve、本 v0.4 zone は strictly additive
    - production-ready / legal-reviewed / deploy-verified claim 不在
    - Phase 10F-β / 10G / 10H / 10I / 10K の start 不在
    - Stage 5 起動不在
    - "Memory Commons" は positive product / branding term として不在
      (= Knowledge Commons との contrast wording のみ allowed)
  v0.3 baseline hash 確認:
    - v0.3 baseline hash = 97a99ce (= 2026-05-18、Phase 9A canonical baseline)
    - 本 v0.4 起草時 git log で再確認済、preserve byte-stable
  Hiroto + Claude + GPT pre-review:
    - 本 v0.4 起草前 prompt で確定:
        Owner OS framing core articulation + required guards
        5-layer Revenue Architecture (= Layer A-E)
        Multi-Agent Era Position core articulation + required guards
        Multi-Agent Collaboration Architecture invariants + Trust Profile
        Implementation Roadmap (Phase 10F-α [done] + Phase 10F-β..10K + Stage 5)
        v0.3 → v0.4 supersede table 形式
        9 strict non-goals
        21 verification report items
    - GPT C1 (= Memory Commons wording rule)、C2 (= v0.3 baseline hash 確認)、
      C3 (= Layer E certification isolation) を本 v0.4 内に反映済

memory 更新 discipline:
  v0.3 で確立した「起草中の memory_user_edits 呼び出し禁止」 pattern を本 v0.4
  でも honor、本 v0.4 起草中の memory 更新を行わず。
  v0.4 acceptance 後の memory 更新は Hiroto 指示時のみ。
```

---

```
PX Registry, Inc. · Tokyo · 2026
px-registry.org · hello@px-registry.org
v0.4 zone end
```
