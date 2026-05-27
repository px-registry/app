# PX_DESIGN_INTENT.md

**Version**: v0.3.2 (= in-conversation Claude draft、 post-T9 revenue architecture absorption)
**Status**: NOT sealed / NOT a contract amendment
**Tier**: constitutional design reference
**Precedence**: 既存 sealed contract (= PXBC v0.4 / Phase 10 Direction Contract 等) が conflict 時 wins、 本 doc は revise される
**Not**: legal-reviewed / production claim / public copy
**History**:
- v0.1-draft: T1-T7 articulation
- v0.2-draft: T8 新設 + T1/T3/T4/T5 full rewrite + Q3-Q7 disposition
- v0.3-draft: §2 PX Brand Spirit 新設 + 機能名 minimize + 体感 articulation 化 + T9 (= revenue tier as designed-in) 新設 + 自己尊大表現除去
- v0.3.1-draft: T9 を本命/副次/取らない構造 + dual-customer + forbidden/allowed articulation + Phase ordering で再整理、 §2 に「Substrate, not center」 原則追加
- v0.3.2: T1+T8 fingerprint content boundary 追加、 T8 major-change trigger 追加、 M10 attribution discipline 強化、 §8 non-authorization list 4 項目追加 (= GPT adversarial review v0.2 baseline genuine refinements)

---

## §0 Purpose

PX の各 feature・各 atomic は意図せず増えてきたのではなく、 Hiroto が articulate してきた integrated design intent の puzzle piece として 1 つずつ実装されてきた。 本 doc はその intent を **完成の UIUX 設計憲法** として明文化し、 以降の判断 (= 新 feature 是非、 UI 整理、 命名、 boundary articulation) で参照される constitutional reference を提供する。

本 doc は:
- 既存 feature を「偶然の集積」 ではなく「intent の partial realization」 として読み直す map である
- 未実装の体感方向を明示し、 次の path 選定の基準を提供する
- 既存 sealed boundary と矛盾せず、 それらを統合する layer である
- 内部実装の how には介入しない (= UIUX 体感の方向のみ articulate)

本 doc は:
- 個別 implementation atomic の authorization ではない
- 既存 contract の amendment ではない
- public claim や legal-reviewed copy ではない
- 機能仕様書ではない (= 機能名は実装層、 doc は体感層)

### v0.3.1 transformation context

v0.2 が機能名 heavy で「内部仕様の制約 doc」 に drift していた問題を、 v0.3 で §2 PX Brand Spirit 新設 + 体感 articulation 化で解消。 v0.3.1 で T9 revenue architecture を 過去 GPT articulation の精緻さを absorb して本命 (= Layer C) / 副次 (= Layer B) / 原則取らない の 3 軸構造で再整理。

---

## §1 Core Premise

PX は **「privacy default + public optional + AI personal layer + user-side cross-service integration + tiered revenue with max value at machine attestation」** の 5 つを独立した特性ではなく、 1 つの統合的 design philosophy として実装する。

```
旧 framing (= apps/px-composer era):
  publish-first
  公開すること前提
  動画・スパチャ手数料 0 が第一波及
  per-owner homepage building が中核

新 framing (= 統合 era):
  privacy default (= 人間可読 surface に出さない)
  publish は per-element opt-in
  AI が「個人ツール感」 を作る中央 layer
  user の AI が cross-service preference を user 側で統合
  PX 「持たない」 が user の安心 connect を支える
  revenue は AI agent 時代の証明 substrate を本命とし、 initial design 完備
  Pro は維持装置として副次、 main profit path ではない
  著名人も一般 user も対称利用可能
  「PX の AI」 ではなく「私の AI」 を体感
```

この shift は **既存実装の廃棄ではなく layer 追加 + 配置再評価**。 apps/px-composer が示した UX 知見は中核として継承。 doc が articulate するのは「user 体感の方向」 のみ、 内部実装の how は CC の領域。

---

## §2 PX Brand Spirit (= 核 compass)

本 section が doc 全体の compass。 以降の全 tenet / mapping / missing / discipline はこの spirit と整合する範囲で articulate される。

### Subtraction over accumulation (= 持たないことで通る)

PX は「持つことで強くなる」 ではなく「持たないことで通る」 を選ぶ。 これは制約ではなく姿勢。 機能を加えるたびに「これは subtraction philosophy と整合するか」 を問う。

### Substrate, not center (= 主体ではなく道)

PX は中央決済者・仲介者・認定者・推奨者ではない。 PX は AI / agent / enterprise / verifier が読むための substrate であり、 Owner 同士の取引や判断の中央で稼ぐ model ではない。 これは subtraction philosophy と直接連結する: 「持たない」「判定しない」「預からない」 が architectural position として substrate 性を支える。

### 謙虚な articulation (= 自己尊大に響かない)

PX は「他が持っていない」「真の中央」「構造的に追随困難」 のような自己尊大に響く articulation を避ける。 たとえ事実として相対的差異が大きくても、 PX は謙虚な事実 articulation で表現する。

internal compass としても、 public copy としても、 この discipline は同じ。 internal で強い articulation を使う場合も、 「直訳しても自己尊大に響かない表現」 を選ぶ美意識を持つ。

例:
```
❌ "誰も持っていない integrated profile"
✓ "PX 側に統合 profile が存在しない、 user 側にのみ統合が宿る"

❌ "構造的に追随困難"
✓ "既存 platform の data-aggregation model とは異なる構造"

❌ "真の中央 hub"
✓ "user の AI が integration point になる仕組みを提供する"
```

### 体感優先、 機能名は controlled

PX の design intent は「user が何を感じるか」 を中核に。 内部機能名 (= fingerprint / broker / connector / attestation API 等) は実装選択肢として実装層に残し、 design intent doc は「体感の方向」 を articulate する。

**言葉の発し方の discipline**:
- 言葉で伝えなければならないのは **戦略的なもののみ** (= 注意書き必須事項、 ブランドイメージ構築事項)
- 「迷わないためのサイン」 は なるべく UI で自然に cover する (= 文言追加で説明するのではなく、 触れば分かる UI で解決)
- できるだけ **user のワーキングメモリを奪わない**
- UI 自体が説明である状態を目指す

### 必要な機能は増えていい、 壊してはいけないのは UIUX

機能を増やすことを禁止しない。 内部実装の進化を doc が止めることはない。 ただし、 機能追加が UIUX 体感を壊すなら、 それは design 不在の機能追加。 本 doc は「機能の order」 ではなく「完成時の UIUX」 を守る compass。

### 道具らしさ (= tool-feel)

PX は user の道具。 「自分が便利な道具を持っている」 感を作る。 道具は持ち主を judge しない、 push しない、 hoard しない。 道具を持つことが user の能動性を増す方向。

### Visibility discipline (= 強表現の fence)

戦略 articulation は internal compass。 外向け copy への transfer は厳格な discipline で fence する。

```
internal で使える (= compass):
  T1-T9 strategic implications
  本 doc 全文

public copy で使える (= legal review 後):
  ブランドメッセージ
  product copy
  marketing material

internal でも避ける (= 自己尊大に響く):
  「他が持っていない」 直訳
  「真の中央」 直訳
  「構造的に追随困難」 直訳
```

---

## §3 Nine Design Tenets (= T1-T9)

本 section の各 tenet は §2 Brand Spirit と整合。 機能名は実装層 escape、 articulation は user 体感の方向。

### T1. Privacy posture (= 非公開を first class に)

**Statement**: 非公開は「人間可読 surface に出さない」 を意味する。 ただし非公開状態のまま、 user の AI 経由で 発見・接触・開示確認 が成立する余地がある。 PX の privacy は「閉じ込め」 ではなく、 「user 側で disclosure control を持つ」 layered model。

**体感の方向**:
- 「これは私だけが見ている」 感を default で持つ
- 「探されている / マッチしている」 機会は失わない
- 開示するかは user の意思 (= 設定で auto も可、 default は意思的)
- 「何を / どこまで / 誰に」 が user の手元
- Wanted (= 探している) も非公開のまま表明可能
- 「公開すると不安」 を user に積み上げない

**Architectural articulation (= internal compass)**:
非公開要素は user の AI 経由で discovery / contact / proposal の対象になりうる。 disclosure / negotiation / transaction は Owner-confirmed か Owner-preconfigured (= field-scoped / auditable / default-off)。 PX は judge / settle / rank しない。 internal mechanism (= signature / broker 等) は実装層、 本 doc は user 体感のみ articulate。

**Forbids**:
- 「private」 を name するが AI も読めない実装 (= 機会消失)
- disclosure の自動化が user pre-config なしに起きる
- match notification が PX 側 ranking 経由で生じる
- 「公開しないと使えない」 archetype
- 「公開すると不安」 を積み上げる UI

**Fingerprint / signature content boundary** (= internal compass):

AI-readable fingerprints / signatures must not contain:
- raw private content
- PII
- Memory body
- reversible preference profiles
- full cross-service context

They are minimal discovery signals, not user profiles. This bound
applies whether the fingerprint is published, brokered, or transmitted.

**Relates to existing**:
- Antenna (= Wanted substrate)
- Memory Distillate (= private knowledge substrate)
- Sandbox (= 限定 publish 経路)
- WebAuthn (= privacy preserving identity)
- AI-Origin Boundary Doctrine "AI reads; Owner judges"

### T2. AI centrality (= 中央性)

**Statement**: AI 連動は付加機能ではなく中央 layer。 一度 setup したら以後の体験が AI を経由して軽くなる。 T8 と組み合わせで、 user の AI が真の integration point になる仕組みを PX が提供する。

**体感の方向**:
- AI 設定は 1-2 step で完了 (= 深い場所ではない導線)
- AI ありの体験は明確に軽い
- AI なしでも使える (= 強制ではない)
- AI 関連 affordance は中央 (= 末端 panel ではない)
- 「私の AI」 と感じる (= 「PX の AI」 ではない所有感)

**Forbids**:
- AI 設定が深い場所にある
- AI affordance が末端
- AI なしと AI ありで体験差がほぼない
- 「PX の AI が動きます」 のような所有感の言い回し

**Relates to existing**:
- apps/px-composer ai-adapters.js (= reference)
- lib/ai-adapter/ vNext scaffold
- PXBC v0.4 §V0.4-3 (= Multi-Agent positioning)

### T3. Individual algorithm feel

**Statement**: PX 自体は ranking / 人気 / 上位 を持たない。 各 user の AI が個人 algorithm として そうした体感を生成する余地を、 PX の設計は支える。

**体感の方向**:
- 「これは私の AI が選んだ」 感
- 全 user 共通の trending 不在
- 同じ Public register entry でも、 user A と user B では surface 表示が異なる
- 「中央から push される」 体感不在
- 「私だけの並べ方」 を私の AI が作る

**Architectural articulation**:
PX = substrate (= activity index、 message broker、 Memory Distillate)
Per-user AI = personal algorithm
両者の分担で「個人 algorithm 感」 が user 側に宿る。

**Forbids**:
- PX UI に global trending / popular section
- 全 user に同一の「人気」「上位」 push
- AI 不在で機能する recommendation logic
- 中央集権 feed の implication

**Relates to existing**:
- Memory Distillate
- Antenna
- AI-Origin Boundary Doctrine
- forbidden-words discipline
- PXBC v0.4 §V0.4-4 PX Agent Commons

### T4. AI-assisted creation, including AI-native invention

**Statement**: 出品 / 公開 / 私的整理 全てが AI 連動で軽くなる。 ただし「軽くする」 を超えて、 AI 連動でしか体験できない workflow を発明する余地を意図的に開ける。 既存 platform との差別化軸。

**体感の方向 (Tier 1、 既存平準化)**:
- 写真 + 価格 → AI が draft を提示
- archetype 自動判別
- user は review / edit / 拒否
- 「埋める」 から「確認する」 への shift

**体感の方向 (Tier 2、 発明スペース)**:
- AI 同士が下交渉する体感 (= owner 最終 judgment)
- 非公開のまま AI 経由で match が見つかる体感
- 自分の portfolio を AI が summarize する体感
- AI が長期的に owner を理解していく体感
- 言語 / 文化 障壁を AI が薄める体感
- 「言葉にできなかった intent」 を AI が clarify する体感
- T3 output (= 個人 ranking) を AI が curate して見せる体感

T4 Tier 2 は T3 output を使うが、 T3 そのものではない (= T3 は ranking 生成、 T4 Tier 2 は workflow 発明)。

**Forbids**:
- 既存 platform UX の AI 表面化のみ (= 差別化失敗)
- AI が後付け panel
- AI なしと AI ありで体験差が小さい
- AI が「補助」 でしかない位置づけ

**Relates to existing**:
- apps/px-composer ai-adapters + ai-field-mapping (= Tier 1 reference)
- composer-templates.js 10 archetype
- lib/ai-adapter/ vNext scaffold
- PXBC v0.4 §V0.4-4 PX Agent Commons

### T5. No custody, multiple payment paths

**Statement**: PX 自体は金 / content / keys / PII を持たない。 owner の payment 接続は user の選択で複数 path から。 PX は処理ではなく connect / facilitate。

**体感の方向**:
- payment path は owner の選択
- PX が「保証する」 感不在
- 「PX を経由して払う」 ではなく「owner に直接払う / 振り込む」 感
- transaction の判断は owner 同士

**Reference (= design candidates, not implementation authorization)**:
- Stripe Connect = owner-direct payment、 PX は credentials 不保持
- 銀行振込 = owner 口座を相手に直接開示 (= T1 disclosure 経由)
- 他 non-custody path = 将来追加候補

**Discipline**: 上記 path は design-intent candidates。 個別実装認可は別 STOP #0 + legal review が必要 (= §8 参照)。

**Forbids**:
- escrow 実装
- PX 名義での payment processing
- owner credentials の PX 保持
- 「PX 保証」 体感
- 単一 path lock-in
- PX が transaction の成立判断

**Relates to existing**:
- PXBC v0.4 §V0.4-2 (= 5-Layer Revenue Architecture)
- 持たない・判定しない・預からない
- apps/px-composer Phase C4 Stripe Payment Chip (= reference)

### T6. Seamless cross-surface (= 行き来が軽い)

**Statement**: Public register と My PX は UI 上で 1 つの統合 function に見える程度に行き来が軽い。

**体感の方向**:
- 「別 app に飛ぶ」 感不在
- mode 切替で context 失わない
- 「ここから探す → ここで作る」 が同じ場で

**Reference pattern (= 実装層 candidate)**:
- 右側 movable / dockable menu pattern (= Photoshop 風)
- menu 項目選択 → 同 screen 内で作業完結
- menu は user が drag で位置移動可
- 当時 (= apps/px-composer) は menu = 公開 homepage components
- 現在 (= 戦略 shift 後) は menu = user 操作の自然な分類 (= user の AI / archetype / Public register filter 等の candidates)
- 具体 menu 中身は別 STOP #0

**Forbids**:
- 「別 app に飛ぶ」 体感
- 検索結果から My PX への route が深い
- surface 切替の度に context 再構築要求

**Relates to existing**:
- apps/px-composer state machine
- apps/px-composer style.css menu styling
- vNext route base (= state machine layer 追加 candidate)

### T7. First-time understanding (= 初見理解)

**Statement**: 検索 から来た初見 visitor が、 説明文を読まずに design 自体から意味を掴める。 触れば「何ができる場か」 が分かる。

**体感の方向**:
- 説明 page を読まなくても触れば分かる
- 用語先行不在
- 著名人 first-time も一般 first-time も対称的に理解可能
- 「まず使い方を学ぶ」 動線が primary ではない
- ワーキングメモリを奪わない (= §2 Brand Spirit と整合)

**Forbids**:
- 「説明文を読まないと分からない」 UI
- 用語先行 (= 専門用語 initial UI 登場)
- onboarding tour が必須
- modal 連打で説明する UX

**Relates to existing**:
- apps/px-composer tone mode (= 3 種 aesthetic identity)
- trust spine UI lock

### T8. User-side cross-service preference integration

**Statement**: PX 自体が user の preference profile を保有しないことで、 user の AI 側で cross-service の体験統合が成立する余地が生まれる。 PX の「持たない」 は防御的 constraint だけでなく、 user 側に integration が宿る condition を提供する layer。 user の AI が integration point になる仕組みを、 PX が提供する。

**体感の方向**:
- 「私の AI が私の他のサービスを知っている」 感
- 「PX は私を分析していない」 安心感
- service 間に分散していた preference が、 自分の AI 内で統合される
- 統合の結果が PX 経由 search の質を上げる
- 「PX が私を理解する」 ではなく「私の AI が私を理解する、 PX は道」

**Architectural articulation (= internal compass)**:
- PX = profile を見ない
- user の AI = integration point になる仕組みが提供される
- 統合は user 側に宿る、 service 間に分散しない
- これは existing data-aggregation model とは異なる構造
- 「持たない」 が user 側 integration の condition

**Fingerprint / signature content boundary** (= T1 と整合):

User-side AI が PX 経由で交換するいかなる signature / fingerprint も:
- raw private content
- PII
- Memory body
- reversible preference profiles
- full cross-service context
を含まない。 これは「持たない」 invariant の concrete safeguard。

**Trust caveat**:
本体験は user の AI の選択 / connector の選択 / 拡張 / OS / 物理 device の trust に依存。 PX の保証は「PX 側に統合 profile が存在しない」 ことのみ。 AI provider / browser extension / local agent / MCP / OS compromise 等は PX の管轄外。

**Forbids**:
- PX が cross-service profile を集約
- PX が user の AI 側 query 内容に access
- 「PX が user を理解する」 implication
- AI provider lock-in (= 単一 AI 強制)
- user の AI を bypass する personalization

**T8 major-change trigger** (= 本 tenet の境界が動く signal):

以下が起きる場合は本 doc + PXBC review:
- PX が cross-service connector を broker / store / verify / display する方向の検討
- PX が user の AI 側 query 内容に access する方向の検討
- 「PX が user を理解する」 articulation が public copy に現れる方向の検討
- AI provider lock-in (= 単一 AI 強制) の方向の検討

**Relates to existing**:
- PXBC v0.4 §V0.4-3 (= Multi-Agent positioning)
- PXBC v0.4 §V0.4-4 (= PX Agent Commons)
- 持たない・判定しない・預からない
- Memory Distillate

### T9. Tiered revenue as designed-in, max value at machine attestation layer

**Statement**: PX の revenue 設計は initial design に組み込まれる (= PXBC v0.4 §V0.4-2 5-Layer Revenue Architecture)。 user 体感は free 体験 (= Layer A) を完結とし、 Pro 体験 (= Layer B) は維持を支える tier として自然に出現。 本命収益 (= Layer C Machine Attestation) は AI agent / enterprise / verifier 向けの machine-readable substrate であり、 owner 視点ではほぼ invisible。 設計は initial から完備、 exposure timing は戦略的。

**Revenue layer 構造**:

```
本命 (= Layer C: Machine Attestation):
  - Machine Attestation API
  - Enterprise / Federated Registry
  - verifier / agent / audit systems 向けの
    usage / SLA / verification substrate
  - AI agent / enterprise / verifier が読むための substrate
  - 改竄されにくい事実・境界・receipt・attestation の
    machine-readable layer

副次 (= Layer B: Owner Pro):
  - managed convenience
  - managed hosting / backup / support / health check 等
  - 維持 cost gap の補完
  - main profit path ではない、 ただし sustainability 上の重要 layer

原則的に取らない:
  - Owner-to-Owner transaction fee
  - payment / escrow / checkout
  - winner settlement
  - paid boost / hidden ranking
  - recommendation monetization

PX の収益 model 中核:
  「売買や受け渡しの中央決済者」 ではない
  AI / agent / enterprise / verifier が読むための substrate
  改竄されにくい事実・境界・receipt・attestation で稼ぐ
```

**Dual user 構造**:

PX には 2 種の user 圏が存在:

```
Owner (= primary user):
  - Layer A free + 任意 Layer B Pro
  - 体感は「自分の道具 / 場所」
  - UIUX 設計の中核対象
  - 本 doc のほぼ全 tenet が Owner 体感の articulation

AI agent / enterprise / verifier (= infrastructure consumer):
  - Layer C 経由で PX を読む
  - 体感は「API / protocol substrate」
  - Owner UI には登場しない (= 別 surface)
  - 本命収益の源、 ただし Owner UI 設計から見えない
```

**体感の方向 (= Owner 視点)**:
- Layer A 完結: paywall 圧力なし、 「これだけで十分使える」
- Layer B Pro: 「より深いところまで完結する」 自然な出現、 維持を支える
- Layer C: ほぼ invisible (= owner 体感には登場しない)
- ただし「自分の活動が attestable」 感は得る (= Receipt chip 等)
- 「PX は売買仲介で稼ぐ」 体感は不在

**Strategic disclosure pattern**:

```
visible now (= Phase 10 段階):
  Layer A 完結体験
  Layer B Pro (= Phase 10H で decision-only 進行中)

designed-in, timed exposure (= AI agent 時代):
  Layer C attestation pricing
  Phase 10G machine-readable self-declaration が foundation 既 shipped
  Phase 10F-δ manifest alignment が continuous 支え
  exposure は AI agent traffic 浸透度に合わせる

Phase ordering の意図 (= 本命 protect):
  Phase 10G machine-readable substrate
    = Layer C 本命を支える
  Phase 10F-δ manifest alignment
    = consistency 強化、 Layer C の質を上げる
  Phase 10H Pro 境界 decision-only
    = Layer B を急がず Layer C に混ぜない
  全体の順序: 本命 (= Layer C) を壊さず、 副次 (= Layer B) を早まらせない
```

**してはいけない articulation (= public copy / internal compass 両方で避ける)**:

- 「PX が信用を認定する」
- 「PX が安全を保証する」
- 「PX が売買を仲介して手数料を取る」
- 「Pro 加入が Search / Lighthouse 上の信頼表示になる」
- 「PX は judge / certify する」
- 「PX が transaction の成立を保証」

**正しい articulation**:

- 「PX は判定しない」
- 「PX は材料・receipt・attestation を出す」
- 「外部 AI / agent / verifier が読める」
- 「判断は Owner または外部 consumer 側」
- 「PX は substrate、 judgment ではない」

**Forbids**:

- Free experience を Pro feature 隠しで degrade
- 「your free trial expires」 等の圧力体感
- paywall as afterthought
- Pro を「max revenue」 として誤って位置づけ
- 「Pro でしかできない」 を free user の primary message にする
- Attestation を「機能」 として後付け追加
- AI agent traffic 不足段階で Attestation pricing を visible 化
- Owner-to-Owner transaction fee の導入
- Owner-to-Owner payment / escrow / checkout の実装
- winner settlement の PX 経由実装
- paid boost / hidden ranking の導入
- recommendation monetization (= ranking 経由収益)
- Pro 加入と Search / Lighthouse 信頼表示の結合 UI
- 「PX が認定 / 保証」 articulation
- Layer C を Owner 視点に露出する UI (= AI 専用 substrate を Owner panel 化)

**維持される invariant (= 全 Layer で)**:

- 「持たない」: Layer C も事実刻印、 content 保有ではない
- 「判定しない」: attestation は「いつ / 何が / 誰により」 の記録、 「良い」 judgment ではない
- 「預からない」: Layer C も escrow ではない
- substrate 性: PX は読まれる対象、 push する主体ではない

**Relates to existing**:
- PXBC v0.4 §V0.4-2 (= 5-Layer Revenue Architecture)
- Phase 10G a6a40f3 (= machine-readable self-declaration foundation shipped)
- Phase 10F-δ (= manifest alignment 継続)
- Phase 10H (= Pro 境界 decision-only、 Layer B 早まり防止)
- 持たない・判定しない・預からない (= 全 Layer で維持)
- T8 (= cross-service integration、 attestation は cross-AI verification 版)
- AI-Origin Boundary Doctrine ("AI reads; Owner judges" との整合、 Layer C は AI reads 側の substrate)
- PRODUCTIZATION_NAMING_ROADMAP (= Layer A shipped / B deferred / C foundation shipped status)

---

## §4 Existing UIUX Realization Mapping

既存実装が各 tenet に対してどう partial realization になっているか。

| Implementation                              | Location                  | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 |
|---------------------------------------------|---------------------------|----|----|----|----|----|----|----|----|----|
| Antenna                                     | vNext app/me/antenna      | ◎  |    | ○  |    |    |    |    |    |    |
| Memory Distillate                           | vNext app/me/memory       | ○  | ○  | ◎  |    |    |    |    | ○  |    |
| Memory Distillate parser                    | vNext lib                 | ○  |    | ○  |    |    |    |    |    |    |
| Memory cards / Memory Proposal pattern      | vNext                     | ○  | ○  | ○  |    |    |    |    |    |    |
| MemoryPasteIntakePreview                    | vNext components          |    |    | ○  |    |    |    | ○  |    |    |
| WebAuthn (Phase 8 Stage 2)                  | vNext                     | ◎  |    |    |    | ○  |    |    |    |    |
| Worker / D1 / R2 substrate                  | vNext _worker             |    |    |    |    | ◎  |    |    | ○  |    |
| db/migrations 0001-0016                     | vNext db                  |    |    |    |    | ○  |    |    |    |    |
| Sandbox publish pipeline                    | vNext                     | ○  |    |    | ○  |    |    |    |    |    |
| Trust spine UI lock                         | vNext (locked)            |    |    |    |    |    |    | ◎  |    |    |
| Manifest byte-identity                      | vNext (locked)            |    |    | ○  |    | ○  |    |    |    |    |
| lib/ai-adapter/ scaffold                    | vNext                     |    | ◎  |    | ○  |    |    |    | ○  |    |
| Search Board (= vNext partial)              | vNext                     | ○  |    | ○  |    |    | ○  |    |    |    |
| offered/Sale + auction_like/入札型          | vNext (partial)           |    |    |    | ○  |    |    |    |    |    |
| Stand path                                  | vNext (partial)           |    |    |    | ○  |    |    |    |    |    |
| Handoff/Receipt paths                       | vNext (partial)           |    |    |    |    | ○  |    |    |    |    |
| ⚠ P1-a 公開面 card (= 543dc1c)              | vNext components/me       | △  |    |    | △  |    | △  |    |    |    |
| AI-Origin Boundary Doctrine                 | doc                       |    |    | ◎  |    |    |    |    |    |    |
| PX Agent Commons concept                    | PXBC v0.4 §V0.4-4         |    | ◎  | ○  |    |    |    |    | ◎  |    |
| Multi-Agent positioning                     | PXBC v0.4 §V0.4-3         |    | ◎  |    |    |    |    |    | ◎  |    |
| 5-Layer Revenue Architecture                | PXBC v0.4 §V0.4-2         |    |    |    |    | ○  |    |    |    | ◎  |
| Phase 10G machine-readable self-declaration | vNext (a6a40f3)           |    |    |    |    |    |    |    |    | ◎  |
| Phase 10F-δ manifest alignment              | vNext (sealed)            |    |    |    |    | ○  |    |    |    | ○  |
| Phase 10H Pro 境界 decision-only             | strategy (= deferred)     |    |    |    |    |    |    |    |    | ○  |
| Composer templates (10 archetype)           | apps/px-composer          |    |    |    | ◎  |    |    |    |    |    |
| AI adapters + field mapping                 | apps/px-composer          |    | ◎  |    | ○  |    |    |    |    |    |
| Stripe Payment Chip (Phase C4)              | apps/px-composer          |    |    |    |    | ◎  |    |    |    | ○  |
| Surface state machine                       | apps/px-composer          |    |    |    |    |    | ◎  |    |    |    |
| Tone mode (3 種)                             | apps/px-composer style    |    |    |    |    |    |    | ◎  |    |    |
| 5-level ink hierarchy                       | apps/px-composer style    |    |    |    |    |    |    | ○  |    |    |
| 4-family typography palette                 | apps/px-composer style    |    |    |    |    |    |    | ○  |    |    |
| Per-archetype dummy data                    | apps/px-composer data     |    |    |    | ○  |    |    | ○  |    |    |
| 4-agent loop discipline                     | meta-process              |    |    |    |    |    |    |    |    |    |

凡例:
- ◎ = 主要 realization
- ○ = 部分 contribution
- △ = 戦略 shift 後の位置で再評価対象
- ⚠ = warning tag

### P1-a 公開面 card 再評価注記

P1-a card (= 543dc1c) は Hiroto Q6 disposition (= 「今の UI には使えない」) により再評価対象。

```
disposition:
  - commit 543dc1c 自体は durable (= 削除しない、 history 保存)
  - card UI 実装は new direction で superseded 想定
  - 動線「OwnerHome → U2 chooser」 conceptual value は durable
  - 正式 supersession は新 /me design atomic で行う
  - AG-P1A-1..13 の supersession は明示的 STOP #0 で
  - Retired pattern であって delete ではない (= §6 参照)
```

---

## §5 UIUX Missing Directions

機能名ベースではなく、 「user 体感の方向」 として未実現項目を articulate。

### M1. Privacy default の体感

「これは私だけが見ている」 と user が自然に感じる状態を default にする体感。 element / surface ごとに「公開する」 が明示的 action として現れる。 「公開しないと使えない」 感を取り除く。

### M2. AI individual feel の体感

「私の AI が私のために動いている」 と continuous に感じる体感。 AI memory が「私の AI の記憶」 として visible に現れる affordance。 substrate (= Memory Distillate) は既に存在、 surface が未確立。

### M3. Public register AI lens の体感

同じ public-domain activity index でも、 「私の AI が私のために選んでいる」 体感が宿る surface。 全 user 共通の trending feed ではなく、 個人 lens で見える状態。

### M4. AI integration onboarding の体感

AI 設定が 1-2 step で軽く完了する体感。 設定後の全 operation で「あ、 これも AI が手伝ってくれるんだ」 と自然に気付く出現。

### M5. Cross-surface seamless navigation の体感

Public register と My PX を「同じ場の別 mode」 として感じる体感。 mode 切替が context loss なし。 右側 movable menu pattern (= 実装候補) は §2 Brand Spirit と整合する範囲で。

### M6. First-time understanding の体感

検索から来た visitor が、 説明文を読まずに touch だけで「ここで何ができるか」 を掴む体感。 ワーキングメモリを奪わない初期表現。

### M7. Per-archetype の体感

各 archetype (= sale / 入札型 / stand / wanted / 音楽 / 書き物 / service / membership 等) で、 user 体感が schema 駆動で軽く成立する状態。 vNext は既に Search Board / Antenna/Wanted / offered/Sale / auction_like / stand / Handoff/Receipt paths / OwnerHome links まで partial 実現済。 残作業は各 archetype の sealed vocabulary mapping + legal/commercial gate + productization UX の体感統合。

### M8. AI 経由 matching の体感 (= T1 mechanism realization)

「非公開のまま誰かが私の AI 経由で見つけてくれる」 体感。 「開示するかは私の手元にある」 体感。 内部 mechanism (= signature 等) は実装層、 doc は「user 体感」 のみ articulate。

### M9. Cross-service connector の体感 (= T8 realization)

「私の AI が他のサービスの私を知っている」 体感。 PX 内で「ここでもその私が活きている」 感が邪魔されない状態。 PX 自身は connector を仲介しない (= user の AI 側、 §8 参照)。 PX 内 connector status 表示があるなら user-declared / locally observed のみ。

### M10. AI-generated personal output の体感 (= T3 realization)

「これは私の AI が選んだ」 と明示的に分かる surface。 PX 自身が選んでいる
ような誤読を避ける attribution。

**Attribution discipline** (= 強化):
- AI-generated ranking / curation は visual に user の AI の出力として
  attributed される (= PX UI と区別される)
- 「PX recommendation」 のような言い回しは不在
- AI-generated content は PX substrate output と分離して表示
- AI-Origin Boundary Doctrine "AI reads; Owner judges" と整合

### M11. Tier 2 AI-native invention の体感空間 (= T4 Tier 2)

AI 連動でしか体験できない workflow / UX を発明する余地。 既存 platform をなぞらない方向。 各 invention は別 STOP #0、 別 atomic。

### M12. Retired patterns active retirement

戦略 shift 後に obsolete とされた pattern を、 fresh STOP #0 を経て段階的に supersede していく作業 (= §6 Retired patterns 参照)。

### M13. Tiered revenue layer の Owner 側 invisibility 維持 + machine substrate 完備

Layer A 完結 + Layer B Pro seamless 出現 (= Owner UIUX) が成立する状態。 Layer C は Owner UI ほぼ invisible、 ただし machine-readable substrate として完備 (= Phase 10G foundation shipped)。 Owner UI に Layer C 露出が leak しない discipline。 AI agent / enterprise consumer 側の surface (= API / protocol) は Owner UI と別領域として維持。 具体的 Pro 境界 / 価格 / 認証 / 課金 / Stage 5 onboarding / Layer C exposure timing は別 STOP #0 + legal review。

---

## §6 Boundary Inheritance

本 doc は以下を **継承する** (= 上書きせず、 統合する):

### From PX_BUSINESS_CONTRACT.md v0.4

- 持たない・判定しない・預からない (= founding principle)
- Multi-Agent positioning (= anti-monopolization-of-substrate)
- PX Agent Commons concept (= §V0.4-4)
- AI 持たない / Memory を Owner 側 / judgment 発しない

### From PXBC v0.4 §V0.4-2 (= 5-Layer Revenue Architecture 詳述)

```
Layer A: Substrate (free forever)
Layer B: Pro (= maintenance tier、 副次収益、 post-Stage-5)
Layer C: Machine Attestation (= 本命収益、 AI agent era 中核)
  - Machine Attestation API
  - Enterprise / Federated Registry
  - verifier / agent / audit systems 向け
  - usage / SLA / verification substrate
Layer D: Knowledge Commons (= 0% fee、 contribution layer)
Layer E: Regulated Services (= 別法人)

本 doc は上記 layer 構造を design-intent level で honor:
  - 「Layer C = max revenue」 認識は internal compass
  - Layer C exposure timing は戦略的判断
  - Owner UIUX に Layer C が leak しない discipline 維持
  - Owner-to-Owner transaction fee 系は原則取らない
```

### From PHASE_10_DIRECTION_CONTRACT.md

- boundary articulation の累積
- 各 articulation の named pattern

### From AI_ORIGIN_BOUNDARY_DOCTRINE.md

- "AI reads; the Owner judges" core principle
- AI 出力の attribution discipline
- C2/C3/C5/C6/C7/C8 trigger 待ち項目

### From Phase 1-10 implementation history

- 全 AG framework
- trust spine byte-stable lock
- N2 4-value surface_shape / N3 3-value intent
- manifest byte-identity (= 8882 / 1876)
- forbidden-words discipline
- scope-cap discipline

### From PRODUCTIZATION_NAMING_ROADMAP.md @ 64357c4

- P-series split (= P1-a/b/c/d)
- naming dictionary
- 「Composer」 internal 用語、 user-facing label 慎重

本 doc はこれらを **読み替えない**。 矛盾が見つかった場合は本 doc を revise する (= 既存 sealed を変えない)。

### Retired patterns (= 明示的に廃止された past pattern)

以下は過去 design で検討 / 部分実装されたが、 統合 design intent では **採用しない** ことを明示。 **Retired pattern ≠ delete implementation**: landed code / route / commit は durable、 history 保存。 future design が fresh STOP #0 を経て段階的に supersede していく。

```
per-owner homepage building (= 旧 apps/px-composer Composer dashboard 前提):
  - owner が自身の homepage を element 並べで build する model
  → 廃止: Public register が public surface を subsume

  ただし以下は durable:
    - composer-templates.js 10 archetype schema
    - 各 archetype の field schema
    - publish 時の coherent_chips logic
  これらは「homepage 部品」 ではなく「公開 item の schema」 として継続。

PX Direct Bank:
  - PX が金を保持する model
  → 廃止: 持たない invariant を vacate するため不採用
  → 代替: Stripe / 銀行振込 / 他 non-custody path (= T5)

Owner-to-Owner transaction fee:
  - PX が売買仲介で手数料を取る model
  → 廃止: substrate not center positioning (= §2) と T9 原則取らない 違反
  → 代替: Layer C Machine Attestation が本命収益

/me/box の role 再解釈:
  - 「外からの見え方」 label 維持
  - homepage 編集ではなく、 owner の Public register footprint を outside 視点で確認する役割
  - 既存実装 byte-stable preserve
  - role 解釈の更新であり code 変更ではない

P1-a 公開面 card UI:
  - commit 543dc1c durable
  - /me OwnerHome 内 card 配置は new direction で superseded 想定
  - 動線 conceptual value は durable
  - 正式 supersession は新 /me design atomic で
  - AG-P1A-1..13 supersession は明示的 STOP #0 経由必須

旧 /me OwnerHome card-grid pattern:
  - generic SaaS-feel への drift 源
  - 新 design で supersede
  - supersession は M12 active retirement で扱う
```

### AI provider / connector trust caveat (= T8 関連)

T8 の cross-service integration は user の AI 経由で機能する。 PX の no-custody 保証は **PX 側のみ**。 以下は PX の管轄外:
- user の AI provider (= OpenAI / Anthropic 等)
- connector permissions
- browser extensions
- local agents
- MCP / plugins
- OS / browser compromise
- user-granted third-party access

user の AI provider に対する trust は user 自身の判断。 PX は AI provider 中立 (= PXBC v0.4 §V0.4-3 と整合)。

---

## §7 Document Map

```
constitutional tier (= 同列、 conflict 時の precedence は別):
  PX_BUSINESS_CONTRACT.md     → 全 contract の root、 5-Layer 等
  PHASE_10_DIRECTION_CONTRACT → boundary articulation 累積
  AI_ORIGIN_BOUNDARY_DOCTRINE → AI 出力 attribution discipline
  PX_DESIGN_INTENT.md (本 doc) → integrated UIUX design intent / 9 tenets

  precedence: 上記 sealed contract が conflict 時 wins、 本 doc は revise

reference artifact tier (= 参照専用、 amendment しない):
  PRODUCTIZATION_NAMING_ROADMAP → product split / naming dictionary
  UIUX_PREPOLISH_AUDIT          → UX risks audit

operational tier (= 日常更新):
  INVENTORY.md                  → state markers (§10.18.X)
  PHASE_10_BUILD_LEDGER.md      → commit history (latest-first)
  PX_IMPLEMENTATION_BACKLOG.md  → active queue + roadmap rows

design contributing source (= direct code copy 禁止、 conceptual ref 1st-class):
  apps/px-composer/             → UX / aesthetic / archetype 知見の source
    style.css                   → tone mode / token reference
    composer-templates.js       → 10 archetype schema reference
    ai-adapters.js              → AI integration pattern reference
    ai-field-mapping.js         → AI draft mapping reference
    app.js                      → surface state machine reference

production code (= 全 source / test / component / Worker / D1):
  app/                          → Next.js route 群
  components/                   → React 系
  app/_worker/                  → Worker
  db/migrations/                → 0001-0016 sealed
  tests/                        → 4977+ spec across 176+ files
```

新規 reader への navigation:
1. PX_BUSINESS_CONTRACT.md v0.4 で全体 stance 確認
2. 本 PX_DESIGN_INTENT.md で integrated UIUX design 確認 (= §2 Brand Spirit 必読)
3. PRODUCTIZATION_NAMING_ROADMAP で product split 確認
4. INVENTORY 最新 marker で current state 確認
5. 個別領域は 該当 doc + apps/px-composer 該当 file 参照

---

## §8 Discipline

### 本 doc が **する** こと

- integrated UIUX design intent を constitutional level で明文化
- 既存 implementation の puzzle piece map を提供
- UIUX missing directions の identification
- 以降の STOP #0 で参照可能な judgment axis (= T1-T9) を提供
- §2 Brand Spirit を全 design 判断の compass として供給

### 本 doc が **しない** こと

- 個別 implementation atomic の authorization
- 既存 sealed boundary の amendment
- public claim / legal-reviewed copy としての使用
- 内部実装 how への介入 (= CC の領域)
- 機能の order 指定 (= Hiroto は実装順に口出ししない、 完成時 UIUX のみ守る)

### 非認可項目 (= 明示)

本 doc は以下を **authorize しない**:
- AI provider integration の認可
- cross-service connector の自動認可 (= T8 機能の実装は別 STOP #0)
- payment 実装の認可 (= Stripe / 銀行振込 / 他、 個別 STOP #0 + legal)
- Pro / billing / Stage 5 / R2 self-serve の認可
- Layer C Attestation の visible exposure timing 判断 (= 別 STOP #0)
- Layer C pricing / 課金 / billing 実装 (= 別 STOP #0 + legal review)
- 「PX max revenue」 を public copy で articulate する判断
- Owner-to-Owner transaction fee の実装
- Owner-to-Owner payment / escrow / checkout の実装
- paid boost / hidden ranking の実装
- recommendation monetization の実装
- Pro 加入を Search / Lighthouse の信頼表示と結合する UI
- 「universal SHALL rule」 の追加
- P1-a card の自動 supersession (= 別 STOP #0)
- "My PX" label の自動 deployment (= 既存 "PX Workbench" 置換は別 STOP #0)
- 既存 sealed AG (= AG-P1A / U2 / U5 等) の supersession
- AI 経由 disclosure / contact / proposal mechanism の実装認可
- public-deploy 用 copy としての本 doc 各 phrase の使用 (= public deploy は別 legal review)
- AI-readable fingerprint / signature publication の実装認可
- AI-to-AI message broker の実装認可
- auto-disclosure behavior の実装認可
- AI-generated ranking display を PX UI で行う認可

### Strategic disclosure discipline (= Layer C 関連)

Layer C は initial design に組み込まれるが visible exposure は timed:
- 設計を持つ ≠ user に見せる
- 設計を持っておくことで、 出した時に自然に見える
- 露出 timing 判断は別 STOP #0
- 露出前から implementation 段階は段階的に進められる (= Phase 10G foundation 既 shipped、 Phase 10F-δ 継続、 Phase 10H decision-only 維持)
- 本命 (Layer C) を壊さず、 副次 (Layer B) を早まらせない順序

### Update discipline

- version は v0.3.1-draft → v0.3.1 (= Hiroto sign-off 後) → v0.4 (= 後続改訂)
- 各 update は INVENTORY §X marker + LEDGER record を伴う
- T1-T9 への追加 / 削除は Hiroto + GPT 両方の sign-off を要する
- M1-M13 missing direction の更新は 各 implementation atomic の closeout sync で 1-line 更新
- Retired patterns への追加は Hiroto explicit decision を要する
- §2 Brand Spirit の修正は構造的 review が必要 (= 部分修正 困難)

### Major-change trigger

以下が起きる場合は本 doc + PXBC review:
- PX が cross-service connector を仲介する方向の検討
- PX が cross-service profile を保有する方向の検討
- PX が transaction を judge / settle する方向の検討
- ranking / trending を PX 側で持つ方向の検討
- Free tier degradation で Pro 圧力をかける方向の検討
- Owner-to-Owner transaction fee の導入検討
- Layer C を Owner UI に露出する方向の検討
- Pro 加入を Search / Lighthouse の信頼表示と結合する方向の検討

### Single-instance vs universal

- 本 doc の tenets (T1-T9) は **universal stance**
- 本 doc の mapping (§4) と missing directions (§5) は **point-in-time snapshot**
- 各 tenet の concrete / forbid は **guideline** (= STOP #0 で context 適用)

---

## §9 Naming considerations

### "My PX" 採用

旧 /me OwnerHome / "Composer dashboard" 領域の user-facing label として **"My PX"** を採用。

```
意図:
  - 「My」 で user の operating space であることを示す
  - 「PX」 を product label として user が自分の場として claim
  - subtraction philosophy 整合 (= 最 minimal label)
  - first-time 直感性高
  - 4-family typography で美しい
  - 日本語 UI 内では補助文 (= 「あなたの作業場」 等) が必要な場合あり
```

**"My PX" は以下を意味しない** (= 限定句):
- PX infrastructure ownership
- Pro status / certification
- public identity
- exclusive namespace
- 既存 sealed term の自動置換

### 既存 term との関係

```
PX Workbench (= shipped term):
  - internal / route label として継続可
  - user-facing primary label は "My PX" に shift 予定
  - 置換 timing は別 STOP #0 で決定
  - 自動置換ではない

Composer (= internal / architecture term):
  - internal / 実装層では継続使用
  - user-facing label には使用しない
  - "My PX" が user-facing primary

公開面 (= U2 chooser h1):
  - 既存 sealed label として preserve
  - "My PX" 領域内の 1 action label として活用可能
```

### PX 全体 naming etymology (= 後回し)

```
起源 (= Hiroto 余談):
  protocol + X = protocolX (= 初期 cloud LLM 議論で名称伏せた呼称)
  略して PX

可能な expansion:
  Personal Exchange (= 戦略 shift 後 fit する候補)
  expansion の明文化は本 v0.3.1 で扱わない
  別 turn / 別 doc で finalize
  軽量で undo 可能な決定として後回し
```

---

**v0.3.2 ここまで**

draft 作成: Claude (= in-conversation)
作成日: 2026-05-26
review pending: Hiroto + GPT
landing pending: CC artifact 化 (= Hiroto sign-off + GPT review 後)
expected commit subject (= 仮): `docs: add PX_DESIGN_INTENT.md v0.3.1 integrated UIUX design intent constitutional`
