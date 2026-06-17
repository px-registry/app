// R1.5 meet surface — copy label layer (rename-cheap: every user-facing string
// lives here, never inline in JSX; route names are provisional and cheap to
// rename because labels are centralized).
//
// Register: Japanese-native, quiet, honest. The boundary lines are FACTS about
// the architecture (device-only memory, browser-direct AI, server holds only
// the owner-chosen candidate items + the talk signal) — they must stay true in
// code. No ranking / no recommendation language anywhere (see ./forbidden.ts).
//
// 改修第1便 (fix1): the pool is AI-ONLY — 「候補に出す」 means entering the
// pool that each participant's AI reads; no human-browsable list exists. A
// person meets another's items only inside a delivered proposal. Internal
// words (合図) never appear on screen.

export const MEET = {
  /** Browser-tab / surface title. Naming is provisional (label layer). */
  title: "PX",
  lede: "お互いの記憶から、思いがけない接点を。",

  nav: {
    home: "ホーム",
    memory: "記憶",
    // 仕上げ便 ①修正（Hiroto 裁定 2026-06-16）: rail＝世界観の指針。サブページの
    // メニューも rail 語彙へ揃える — はじめかた → Setup（rail.setup と一致）。
    start: "Setup",
  },

  /** 視覚一新 — header toggles. The phase names are the 指示書 §3-2 values
   *  (data-theme="paper|sumi"); the language labels are the existing D12 pair. */
  theme: {
    paper: "paper",
    sumi: "sumi",
    group: "paper / sumi",
    ja: "日本語",
    en: "EN",
    langGroup: "EN / 日本語",
  },

  /** 視覚一新 — footer mark (the registry's existing name, quiet). */
  footerKk: "PX Registry KK",

  /** 墨工房 文言実験 第1手（Hiroto 裁定 2026-06-16）— rail の短語。
   *  これは「命名の最終」ではなく、墨の工房で言葉がどこまで減らせるかの実験
   *  （glyph ◆/◇ ＋ outline ring ＋ 色ドットが意味を語る今、説明見出しを短語へ）。
   *  canvas の見出し（home.proposals.heading 等）とは別系統：rail だけを短語にする
   *  ——道具は短語・状態は glyph・順序は配置の三層で語る。window は あなたのAI を
   *  据置（rail 内で一つだけ日本語＝所有格のアクセント・意図的）。 */
  rail: {
    antenna: "Antenna",
    finds: "Finds",
    talk: "Talk",
    // サブページ統一便（Hiroto 確定 2026-06-16）: 記憶 → Memory（rail 語彙＝英語短語へ
    // 揃える）。Memory・Setup はどちらも「面切替」でなく「ルート遷移の導線」— 仕切り線の
    // 下に2つ並ぶ（rail 構造＝3面＋2導線）。
    memory: "Memory",
    setup: "Setup",
    // 一行の本質（Hiroto 確定 2026-06-16）— rail/FAB のツールチップ（title）。
    // メニューバーが世界観の指針: 短い名詞＋一行で「その場が何か」を語る。
    tip: {
      antenna: "置いておく話。",
      finds: "今走らせる探索。",
      talk: "届いた話。",
      ai: "あなたのAI。",
      // Memory の一行本質（Hiroto 確定 2026-06-16）— 記憶ページの題と同じ register。
      memory: "あなたの記憶。",
      setup: "鍵と控え。",
    },
  },

  /** 境界の脚注 — 初回は開いて見せ、以降は畳む。
   *  表層語彙統一便（Hiroto 確定 2026-06-16）: 「PXのやくそく」→ Trust
   *  （表面は短い道具名／英字短語に寄せる・Antenna/Finds/Talk/Memory/Setup/Run と同テクスチャ）。 */
  boundaryTitle: "Trust",

  home: {
    question: {
      /**
       * Antenna 化の小便（設計役 黄宣言・2026-06-13）: 周辺ヘルパー文は入力欄へ
       * 畳む — placeholder が機能を語る。時間帯で変わる文言 v1（静的・ゲート済4本）。
       * 旧 twoTenses/note は退場（説明の役は placeholder と看板調の対句が担う）。
       */
      placeholderMorning: "おはようございます。今日は、どんな人や話を見つけてほしいですか。",
      placeholderDaytime: "今日は何を始めますか。探したい人や話を書いてみてください。",
      placeholderEvening: "今夜は、どんな話ができる人がいたらいいですか。",
      // 深夜文は 2026-06-13 言い換え（黄・傾きA）: Claude の深夜挨拶の声と離す
      // （敬意は保つ — 真似ない、が原則）。「書き置き」はアンテナ=留守中も働く札の比喩。
      placeholderNight: "静かな時間ですね。気になっていることを、書き置きしておきませんか。",
    },
    // 主動詞（Hiroto 確定）: 結果を約束せず行為だけを名指す。探すのであって、
    // つながるとは言わない。「今日は無い」が返っても嘘にならない名前。英語化する日は "Go find"。
    // 2026-06-13 Hiroto 指定（期待の追従）: ひらがな「探しにいく」へ。
    // 墨工房 文言 第3手（Hiroto 確定 2026-06-16）: 「探しにいく」→「Run」。
    // Finds の Run と一貫＝「今走らせる」。receive と dock は別機構だが体験は Run で統一。
    receive: "Run",
    // 便3 改名（Hiroto ゲート済・最重要）: 問いを置く → アンテナ。
    // 機能名=アンテナ／主ボタン=アンテナを立てる。
    // 見出しは 2026-06-13 ブランド語へ昇格: 今日のアンテナ → Antenna（英語 eyebrow 群と同テクスチャ）。
    place: {
      /** 視覚一新 — v3正本の eyebrows（意匠）。 */
      eyebrowAsk: "Ask",
      eyebrowResting: "Resting",
      heading: "Antenna",
      // 第3手（Hiroto 確定）: 「アンテナを立てる」→「＋Antenna」。置いて待つを「＋」で
      // 記号化（[Run]＝今動かす／[＋Antenna]＝置いて待つ の対句）。confirmHeading は別キーで存置。
      action: "＋Antenna",
      confirmHeading: "Antennaを立てる",
      // 第9便 B: 「探し続け」は実態（開くたびの見回り）に合わせて言い直した。
      // 表層語彙統一便（Hiroto 確定 2026-06-16）: アンテナ → Antenna（退場語彙）。
      confirmNote:
        "「求めている」の項目になります。立てる＝あなたのAIが、あなたがここを開くたびにRunします。ほかの人のAIもあなたのAntennaを見つけられます。",
      titleLabel: "一言タイトル（短縮案・直せます）",
      textLabel: "Antennaの本文",
      /** 0012（Hiroto ゲート済「□ ビジネス」）— チェック一個・説明文なし。
       *  同じ一語が受け手の「相手の候補から」に添えられる（表示点・ゲート条件）。 */
      business: "ビジネス",
      confirm: "この内容で立てる",
      cancel: "やめる",
      // 仕上げ便（Hiroto 確定 2026-06-16）: RESTING 欄の見出しを世界観の名詞へ。
      // 表層語彙統一便（Hiroto 確定 2026-06-16）: 「置いた話」→ 道具名「Antenna」
      // （表面は短い道具名に寄せる・rail/eyebrow と同テクスチャ）。
      listHeading: "Antenna",
      stateWaiting: "待っています。",
      stateNotOut: "まだ候補に出ていません。「候補を更新する」で出ます。",
      stateStillOut: "「出さない」にしました——候補からは「候補を更新する」で下がります。",
      stateDown: "「出さない」になっています。",
      putBack: "出すに戻す",
      withdraw: "候補から下げる",
      updatePool: "候補を更新する",
      needName: "先に「呼び名」を決めてください。",
    },
    proposals: {
      /** 視覚一新 — v3正本の eyebrow（言語によらず英字の意匠）。 */
      eyebrow: "Found by your AI",
      /** 第9便 命名ゲート: 探しに行く＋見回りの結末がすべてここに並ぶ。 */
      heading: "AIが見つけた提案",
      // 表層語彙統一便 第2手（Hiroto 確定 2026-06-16）: 主動詞 Run を明示
      // （探しに行く/見回り を退け、Run で見つけたものが並ぶ、と言う）。
      subnote: "あなたのAIがRunで見つけたものが、ここに並びます。",
      /** 空状態は二分岐: 記憶未整備 / 整備済みでまだ探していない（第9便 A）。 */
      emptyNoMemory: "まだ提案はありません。Memoryができたら、ここに届きます。",
      emptyReady: "まだ何もありません。見つけてほしいことを書いて「探しに行く」と、あなたのAIがここに提案を並べます。",
      noneToday: "今日は無い、という日もあります。",
      orderNote: "新しく届いた順です。順番に意味はありません。",
      // 表層語彙統一便 第2手（Hiroto 確定）: モデル名の生々しさを畳む — 常に「あなたのAI」。
      modelNote: (_label: string): string => "あなたのAIが読みました",
      manualLabel: "探しに行きました",
      // 見回り退場（Hiroto 確定）: 自動巡回の概念語は Run へ。
      patrolLabel: (q: string): string => `Antenna「${q}」のRun`,
      rawShow: "そのままの返事を見る",
      removeEntry: "この回を消す",
      /** provenance gate (第3便 A) — 法の遵守は構造で裏打ちする。 */
      provenanceNote: (n: number): string =>
        `実在の相手に結べない提案は表示していません（${n}枚）。`,
    },
    /** 第9便 B — 自動巡回（owner の端末・owner の鍵でのみ走る）。
     *  見回り退場（Hiroto 確定 2026-06-16）: 自動巡回の概念語を Run へ統一。 */
    patrol: {
      running: "Run中…",
      last: (hhmm: string): string => `前回のRun：${hhmm}`,
      offline: "Runは、この端末でAIがつながっているときに動きます。",
    },
    /** 第9便 C — 気配（事実の表示・判定なし・一覧なし）。 */
    presence: {
      participants: (n: number): string => `いま候補に出ている参加者：${n}人`,
      reads: (n: number): string => `今日、このAntennaは${n}人のAIに読まれました。`,
      noReads: "今日はまだ読まれていません。",
    },
    signals: {
      // 表層語彙統一便（Hiroto 確定 2026-06-16）: eyebrow を英字意匠の全大文字へ
      // （YOUR AI と同テクスチャ）。
      eyebrow: "FOR YOU",
      heading: "あなたへの「話してみる」",
      // 表層語彙統一便 第2手（Hiroto 確定 2026-06-16）: 「相手のAI」→「ほかの人のAI」。
      subnote: "ほかの人のAIが、あなたのAntennaや候補を見つけたとき、ここに届きます。",
      // 第3手→統一便（Hiroto 確定）: Talk＝届いた話の空状態（届く相手＝Talk の語に寄せる）。
      empty: "まだ届いていません。",
      incoming: (name: string): string => `${name}さんが「話してみる」を押しました。`,
      talkBack: "こちらも話してみる",
      mutual: "おたがいが「話してみる」を押しました。",
      contactHeading: "連絡のメモ",
      contactNote: "連絡のメモを交換できます。届くのはこの相手だけです。",
      /** R2 GOAL — 渡す遅延（spec §11-5 前倒し・黄・仮置き）: 渡すは任意・急がない。 */
      contactCanWait: "渡すのは、会う段になってからでも。",
      contactPlaceholder: "例：LINEのID、メール、電話など、つながれる窓口",
      contactSave: "渡す",
      contactSaved: "渡しました",
      theirNote: (name: string): string => `${name}さんからのメモ`,
      waitingNote: "相手のメモはまだ届いていません。",
      /** c18 — 行為時検証の正直な結末（文言は指示書 §3 ゲート済）。 */
      notInPool: "この相手は、いまは候補に出ていません。",
      nameFirst: "先に呼び名を決めてください。",
      /** c18b — 不在マークの合図カードだけに出る箒（ゲート済）。 */
      sweep: "片づける",
    },
    /**
     * 便6 — トーク（Hiroto ゲート済・2026-06-12 文言束）。
     * 圧なし: 既読・配達済み・入力中・未読バッジはこの面に存在しない（spec §10）。
     */
    talk: {
      send: "送る",
      placeholder: "メッセージを書く",
      /** 不達 tombstone — 両者に出る正直な一行（0013 §4）。 */
      expired: "期限が切れたため、このメッセージは届きませんでした。",
      /** 鍵世代が変わった事実の一行（判定なし・0013 §2）。 */
      keyChanged: "相手の鍵が変わりました。",
      /** ノート（spec §14 確定写像・edge に立つ一枚）。 */
      noteLabel: "ノート",
      /** 読者の明示（spec §10 文言原則・ゲート済） — AI だけが読むように見せない。 */
      noteReaders: "相手と、相手のAIが読めます。",
      /** R2 GOAL（黄・仮置き） — 下書きリンクの宛先が見つからない事実の一行。 */
      portDraftMiss: "あなたのAIからの下書きが指すトークが、いま見つかりません。",
    },
    /**
     * R2 GOAL — 後日談ループ（spec §11-6 前倒し・黄・仮置き文言）。
     * owner-local 完結: ここに書いたものは端末の外に出ない（サーバ無関与）。
     */
    epilogue: {
      fold: "会ったあとに",
      note: "会ったことを、あなたの記憶に残せます。ここに書いたものは端末の外に出ません。",
      placeholder: "どうでしたか。何が見つかりましたか。",
      distill: "あなたのAIに整えてもらう",
      add: "記憶に足す",
      added: "記憶に足しました。",
      addFailed: "記憶に足せませんでした。",
    },
    /**
     * Wave 2 — Dock Lite（spec §12・全句ゲート済の引用）。
     * 「あなたのAI」=確定呼称。preview の二文は記憶の住所の正直条項・送信単位版。
     * draft only: 返事は表示だけ — ここから実行される操作は存在しない。PX no-log。
     */
    dock: {
      ask: "あなたのAIに聞く",
      previewLead: "あなたのAIに渡す内容:",
      previewNote: "PXには送られません。接続先のAIには送られます。",
      /** R2 GOAL — Dock L3（黄・仮置き）: 下書きの取次ボタン（ノート・渡す文面で共用）。 */
      draftAsk: "あなたのAIに下書きを頼む",
    },
    /**
     * R2 GOAL — Dock L2: owner 向け検索（黄・仮置き文言）。
     * AIが読み、人間には提案と根拠で返す — 人間向け他者一覧は出さない（spec §12）。
     */
    dockSearch: {
      // 墨工房 仕上げ便（Hiroto 確定 2026-06-16）: Finds 面の世界観コピー。
      // eyebrow は英字意匠（Ask/For you 群と同テクスチャ）、見出しは rail と同じ Finds、
      // 主動詞は「探してもらう」→「Run」（"今走らせる探索" と呼応・rail 名詞系譜の能動動詞）。
      eyebrow: "YOUR AI",
      heading: "探してもらう", // 旧見出し（表示は rail.finds = Finds に集約・キーは保持）
      /** です調・簡潔版（Hiroto 確定）— 主体反復を畳む。 */
      note: "候補やAntennaを読み、いま話したい相手を見つけます。",
      placeholder: "どんな人・どんな話を探しますか",
      run: "Run",
      busy: "探しています…",
      lands: "見つかったものは「AIが見つけた提案」に入ります。",
      offline: "あなたのAIをつなぐと、ここから探してもらえます。",
      previewFold: "あなたのAIに渡す内容を見る",
      poolEmpty: "いまは公開候補がありません。",
    },
    /**
     * 便3 — 閉じ系・休眠の表示（Hiroto ゲート済・確定）。
     * 原則: 「縁」「接点」は UI に出さない。終わり方を UI で語り分けない
     * （closed_by の理由分類を表示に持ち込まない — 0010 invariant 4 の表示版）。
     * 行為語: a が取り下げる／b（と mutual 後の双方）が閉じる。
     */
    edge: {
      /** sent 段階の閉じ（T3/T4）— 行為しなかった側に出る一語。 */
      stopped: "このAntennaは止まっています。",
      /** mutual 後の閉じ（T5）— 双方に出る一語。 */
      talkClosed: "このトークは閉じられました。",
      /** dormant（読み時導出・状態ではない）。 */
      dormant: "しばらく動きがありません。",
      /** T3 — a の行為語。 */
      withdraw: "取り下げる",
      /** T4/T5 — b（と mutual 後の双方）の行為語。 */
      close: "閉じる",
    },

    /**
     * 記憶装置 層2(b) — 常駐の自由会話窓「あなたのAI」（設計正本 v0.7 §0.5）。
     * 命名裁定 2026-06-13（設計役・Hiroto 確定）:
     *   - 窓の名 = 「あなたのAI」（既存 UI と所有格を揃える）
     *   - 蒸留 = 「いまの、書きとめますか？」[書きとめる][今はいらない]
     *   - 永続 = 「続きを端末に残す（この端末だけ）」初期 OFF・説明「PXには送られません。」
     *   - reading 面は独立見出しを作らない（窓に畳む）
     * write 確認カードの本体は道具の説明（tools.ts・ゲート済）、行為語は道具ごとに
     * 既存ゲート済を流用（place=この内容で立てる／signal=話してみる／draft=あなたのAIに
     * 下書きを頼む／decline=やめる）— 新しい確認カード語は作らない。
     */
    aiWindow: {
      /** 裁定確定。 */
      title: "あなたのAI",
      /** 便b 候補（要 Hiroto 確認・STOP④）— 窓の招き・未接続・初見・開閉の語。 */
      placeholder: "話しかけてみてください。記憶のこと、探したい人のこと。",
      offline: "あなたのAIをつなぐと、ここで話せます。",
      intro: "あなたのAIです。記憶を読み、いっしょに探せます。",
      open: "あなたのAIをひらく",
      minimize: "閉じる",
      /** 蒸留の差し出し（裁定確定・verbatim）。 */
      distillAsk: "いまの、書きとめますか？",
      distillGo: "書きとめる",
      distillSkip: "今はいらない",
      /** 永続トグル（裁定確定・verbatim）。初期 OFF。 */
      persistToggle: "続きを端末に残す（この端末だけ）",
      persistNote: "PXには送られません。",
      /** write 確認カードの導入（道具の説明＝tools.ts を本体に添える）。 */
      confirmLead: "あなたのAIが、こうしようとしています。",
    },

    /**
     * 記憶装置 §0.6 — アンテナ候補（円環の最後の輪・2026-06-13 設計役）。
     * そっと置く: 今日の Antenna 欄の下に一枚、薄く。通知ではない（既読/presence/
     * バッジを作らない）。押せば立つ・無視すれば消える。
     * 文言の床: 候補は誘い・判定でない。立てる＝place.action（ゲート済）／見送り＝
     * aiWindow.distillSkip「今はいらない」（ゲート済）を流用 — 新しい行為語は作らない。
     * 便4 候補（要 Hiroto 確認・STOP④）— スロットの見出し・誘いの一行・暗黙の小印。
     */
    antennaCandidate: {
      eyebrow: "あなたのAIから",
      lead: "気になったら、立ててみてください。",
      implicitTag: "記憶から",
    },
  },

  connect: {
    tabKey: "鍵でつなぐ",
    tabLocal: "ローカルAI（Ollama）",
    keyLabel: "鍵（APIキー）",
    keyPlaceholder: "sk-… の鍵をここに貼り付け",
    detected: (label: string): string => `${label} につながります。`,
    keyLinksLabel: "鍵の取得：",
    endpointLabel: "つなぎ先（あなたのPC）",
    detailsLabel: "詳細（モデルを選ぶ）",
    save: "保存",
    saved: "保存しました",
    connected: (label: string): string => `つながっています（${label}）。`,
    privacy:
      "鍵はこの端末の中だけに置かれ、PXのサーバーへは送られません。呼び出しはこの端末からあなたの鍵で直接行われます。",
  },

  receive: {
    // 表層語彙統一便 第2手（Hiroto 確定 2026-06-16・verbatim）: 警告は短い状態語へ。
    // 「記憶の下地」「記憶で書けます」退場・Memory/Setup に寄せる。
    needKey: "AI未接続",
    needMemory: "Memory未作成",
    needName: "呼び名が未設定です。",
    /** 名前行の導線（Hiroto 確定）。注: 呼び名フィールドは Memory ページ（#name）に在る
     *  ため、リンク先は /meet/memory/#name のまま（着地は実フィールド＝正直）。 */
    nameWhere: "Setupで設定できます。",
    // 表層語彙統一便（Hiroto 確定 2026-06-16）: はじめかた → Setup（退場語彙）。
    toStart: "Setupへ",
    busy: "あなたのAIが読んでいます…",
    /** 二態の対句のです調（Hiroto 起草・ゲート済 2026-06-13）— 行ごと差し替え。
     *  表層語彙統一便: アンテナ → Antenna・読点を一つ落として締める。 */
    noKeyLoop: "AIをつながなくても、Antennaを立てておけば見つけてもらえます。",
    /** プール0件の短絡（第3便 A）: 生成せず、正直にこの2行。 */
    poolEmptyNote: "いまは候補に出ている参加者がいません。",
    errors: {
      auth: "鍵が通りませんでした。鍵を確かめてください。",
      rate: "少し混んでいます。間をおいてもう一度。",
      provider: "AIから返事が返りませんでした。もう一度お試しください。",
      network: "つながりませんでした。電波の良いところでもう一度。",
      pool: "候補を読み込めませんでした。もう一度お試しください。",
      // 第8便 B — 沈黙の禁止: ANY unexpected failure still says something.
      unknown: "うまくいきませんでした。画面を読み込み直して、もう一度お試しください。",
    } as Record<string, string>,
  },

  start: {
    title: "Setup",
    // 表層語彙統一便 第3手（Hiroto 確定 2026-06-17・verbatim）: Setup を「三ステップ直列の
    // 準備」でなく「Antenna と Run の違いが分かる画面」に。lead は二つのモードの対句。
    // 旧 lede「入り口は二つ…」「三つ済ませば…」と二扉（doors）は退場。
    lead: "置いて待つか、自分のAIで探しに行くか。",
    // 二つのモード（概念カード）— AI 接続を必須に見せない／Antenna を AI 必須に見せない。
    modes: {
      antenna: {
        heading: "Antenna",
        body: "AIをつながなくても立てられます。置いておけば、ほかの人のAIが見つけたときに届きます。",
      },
      run: {
        heading: "Run",
        body: "AIをつなぐと、候補やAntennaを読んで、自分から探しに行けます。",
      },
    },
    step1: {
      heading: "1. AI接続",
      body: "ふだん使うAIのAPIキーを、この端末に保存します。PXのサーバーには送られません。",
      // つなぐと何ができるか（Run の前提）。
      run: "つなぐと、あなたのAIが候補やAntennaを読んで、いま話したい相手を探しに行けます。",
    },
    step2: {
      heading: "2. Memoryを作る",
      body: "プロンプトをコピーして、ふだん使うAIに渡します。返ってきたものをここに貼って取り込みます。",
      why: "見つけてもらいやすくなり、Runの精度も上がります。内容は、あなたが確認してから確定します。",
      /** c14 (VR-10 pin): 他人に読める形で生まれる、の予告一行（キーは保持）。 */
      legible: "項目は、あなたを知らない人が読んでも分かる言葉でつくられます。",
    },
    // MCP 接続（AI接続の二つ目の方法）— 独立した「向き」カードにせず Step 1 内に畳む。
    // PortConnect が lead/copyUrl 等を使う（旧 doors.ai から移設）。
    mcp: {
      summary: "あなたのAIからつなぐ",
      lead: "あなたが使っているいつものAIからこの部屋を使えます。下のURLを、AI側の接続設定に貼ってください。",
      tech: "MCP／コネクタ設定で使います。",
      copyUrl: "接続URLをコピー",
      copied: "コピーしました",
      copyFailed: "コピーできませんでした。",
      caution: "これはあなた専用の合鍵入りのURLです。人に渡さないでください。",
      hint: "つないだら、チャットで「PXでRunして」と頼んでみてください。",
    },
  },

  /**
   * Device Mesh（内部名）／表層 Sync — 端末横断の同期（HOW v0.2・STOP-D 確定コピー verbatim）。
   * 足場（緑2・2026-06-17）: 確定コピーのみ・モック状態。鍵/relay/本番schema/本物 crypto 非接続。
   * 自分側の事実のみ（STOP-E）: 相手の届いた/読んだ/入力中/オンライン/相手端末同期 は出さない。
   * GPT 版そのまま採用の 5本（QR手引き/接続完了/handoff失敗/既存端末なし/同期を止める）は
   * paste 待ち＝ここに未掲載（受領次第ここへ追加し、足場の保留箇所へ流し込む）。
   */
  sync: {
    heading: "Sync",
    /** 入口（Setup の Sync セクション）。 */
    connect: "端末をつなぐ",
    listHeading: "接続済みの端末",
    thisDevice: "この端末",
    /** per-端末トグル（persistence opt-in）。 */
    syncOn: "同期",
    syncOff: "同期しない",
    /** 承認の問い（既存端末に出る・追加対象を名指し＋近接/時刻＝本物確認）。
     *  端末名・時刻は動的。場所は精密に出さず「近くの端末」＝近接確認だけを示す。 */
    approve: {
      title: "新しい端末を追加しますか？",
      proximity: "近くの端末",
      body: (device: string): string =>
        `追加すると、この ${device} で Antenna・Talk・Memory を使えるようになります。`,
      syncs: "同期するもの: Antenna / Talk / Memory / 呼び名 / ひとこと",
      noSyncs: "同期しないもの: APIキー / 生のAI会話 / 未確認の下書き",
      go: "追加する",
      cancel: "やめる",
      warn: "身に覚えのない端末なら、追加しないでください。",
    },
    /** 端末を外す（対象で二態）。 */
    remove: {
      action: "外す",
      go: "外す",
      cancel: "やめる",
      otherTitle: (device: string): string => `${device} を外しますか？`,
      otherBody:
        "外した端末は、これから届くものを読めません。すでにその端末にあった会話は、その端末の中に残ります（PXは消せません）。",
      thisTitle: "この端末を外しますか？",
      thisBody:
        "この端末は、これから届くものを読めなくなります。すでにこの端末にある会話は、この端末の中に残ります（PXは消せません）。",
    },
    /** 自分側の事実のみ（STOP-E・HOW §4.7）。「送った」＝relay に置いた事実（届いた保証でない）。 */
    status: {
      unsent: "未送信",
      sending: "送信中",
      sent: "送った",
      sendFailed: "送れませんでした",
      syncedHere: "この端末に同期済み",
    },
    /** 全消去（「同期を止める」とは別操作・着地は Memory/Trust・足場では未配線）。 */
    wipe: {
      title: "このPXのMemoryとTalkを消しますか？",
      body: "この端末から Memory と Talk を消し、接続済みの自分の端末にも削除を伝えます。まだ届いていない分も削除します。",
      others: "相手の端末にある会話は消えません。相手のPXには触れません。",
      publicNote: "公開済みの Antenna・呼び名・ひとことは、別に取り下げてください。",
      go: "すべて消す",
      cancel: "やめる",
    },
  },

  /** 記憶の種類 — rig kinds の表示名。 */
  kinds: {
    have: "持っている",
    want: "求めている",
    avoid: "避けたい",
    memory: "記憶",
  } as Record<string, string>,

  intake: {
    copyPrompt: "プロンプトをコピー",
    copied: "コピーしました",
    copyFailed: "コピーできませんでした。下の全文から手でコピーしてください。",
    showPrompt: "プロンプトの全文を見る",
    pasteLabel: "AIの返事をここに貼る",
    pastePlaceholder: "返ってきたJSONをそのまま貼り付けてください",
    parse: "取り込む",
    reviewHeading: "確認してから確定",
    reviewNote:
      "「出す」にした項目だけが、ほかの参加者のAIが読む候補に入ります。あとからいつでも変えられます。迷ったら出さないままで。",
    publicLabel: "出す",
    privateLabel: "出さない",
    confirm: (n: number): string => `この${n}件で確定する`,
    /** c15-4 (Hiroto ゲート済): 取り込みの二択。既定は破壊的でない「追加」。 */
    addMode: "既存の記憶に追加する",
    replaceMode: "すべて置き換える",
    // 表層語彙統一便 第2手（Hiroto 確定）: 「記憶の下地」退場 → Memory へ寄せる。
    done: "Memoryができました。",
    redo: "貼り直す",
  },

  profile: {
    // 表層語彙統一便 第2手（Hiroto 確定・verbatim）: 長い見出しを短い道具語へ。
    // 第3手（Hiroto 確定 2026-06-17・verbatim）: sub「添える」→「出る」・placeholder→Name。
    heading: "呼び名",
    note: "候補やTalkに出る名前です。本名でなくてかまいません。",
    placeholder: "Name",
    // 表層語彙統一便 第2手 (a) 仕上げ（Hiroto 確定 2026-06-16）: 状態表示は短く
    // （narrow ボタンで「保存しま／した」と折れない）。押せる=保存／保存後=保存済み。
    save: "保存",
    saved: "保存済み",
    /** 第7便 B — ひとこと（任意・~60字・保存して候補に出して初めて公開）。
     *  表層語彙統一便 第2手（Hiroto 確定）: 「ひとこと紹介（任意）」→「ひとこと」。 */
    introLabel: "ひとこと",
    // 第3手（Hiroto 確定 2026-06-17・verbatim）: sub・placeholder・button を締める。
    introNote: "候補に添える短い紹介です。あなたのAIに下書きできます。",
    introPlaceholder: "いま、していること",
    introDraft: "AIに下書き",
    introBusy: "あなたのAIが書いています…",
    introFailed: "下書きを受け取れませんでした。手で書くこともできます。",
  },

  memory: {
    title: "あなたの記憶",
    // 表層語彙統一便 第2手（Hiroto 確定・verbatim）: 締めた本文・Memory/Setup へ寄せる。
    boundary: "記憶はこの端末だけ。PXは預かりません。",
    empty: "まだMemoryはありません。Setupで作成できます。",
    // ボタンは「項目を足す」より「記憶を足す」が明確（Hiroto 確定）。
    addItem: "記憶を足す",
    edit: "直す",
    remove: "消す",
    save: "保存",
    cancel: "やめる",
    titleLabel: "一言タイトル",
    textLabel: "本文",
    tagsLabel: "タグ（、で区切る）",
    clearAll: "すべて消す",
    /** c15-2 (Hiroto ゲート済): 二段確認の本文。消すのは記憶カードのみ。
     *  旧 confirmClear（window.confirm 一段）はこの二段確認に置換された。 */
    confirmClearN: (n: number): string => `${n}件の記憶をすべて消します。元に戻せません。`,
    confirmClearGo: "消す",
    /** c15-3 案B (Hiroto ゲート済): 出した項目を消した時の注意行。 */
    poolNotice: "候補に出した項目が含まれていました。『候補に出す』を押し直すと反映されます。",
    housekeeping: "整理",
    exportLabel: "控えを保存",
    importLabel: "控えから戻す",
    importReport: (added: number, updated: number): string =>
      `${added}件を追加、${updated}件を更新しました。`,
    durability: "ブラウザのデータを消すと、ここも消えます。控えを保存しておくと戻せます。",
  },

  /**
   * 第4便 B — 伏せ字の反転。事前登録はない：AI が固有名を見つけて置き換え案
   * つきで差し出し、owner はタップで決める。リストは選択の副産物として育ち、
   * 決定論チェック（findMaskLeaks）の語彙になる。
   */
  maskWords: {
    offerLead: "この文には特定につながる言葉がありそうです：",
    offerPair: (word: string, mask: string): string => `「${word}」→ ${mask}`,
    maskAll: "ぜんぶ伏せる",
    pickEach: "一つずつ選ぶ",
    keepAsIs: "このまま出す",
    applyPicked: "選んだ語を伏せる",
    detectBusy: "あなたのAIが読んでいます…",
    detectFailed: "検出を受け取れませんでした。手で直すこともできます。",
    connectHint: "AIをつなぐと、固有名の検出と言い換えを手伝えます。",
    leakWarn: (words: string): string => `伏せたい言葉が残っています：${words}`,
    maskOne: (word: string): string => `「${word}」を伏せる`,
    historyLine: (words: string): string => `これまでに伏せた言葉：${words}`,
    historyEdit: "編集",
    historySave: "保存",
    leakChip: "固有名が出ます → 直す",
  },

  /** 第2便 B — 候補に出すときの書き方（公開用の言い方）。 */
  publicWriting: {
    summary: "候補に出すときの書き方",
    note: "固有名を伏せて、内容だけ伝える言い方にできます。例：「○○株式会社で SaaS の CS 部門を立ち上げ」→「BtoB SaaS の CS 立ち上げ経験」。空のままなら、上の本文がそのまま出ます。",
    titleLabel: "出すときの一言タイトル",
    textLabel: "出すときの本文",
    preview: "候補に出るのはこの文です：",
    activeBadge: "候補に出る書き方",
  },

  publish: {
    // 表層語彙統一便 第2手（Hiroto 確定）: 「AIの候補に出す」→「候補に出す」（簡潔）。
    heading: "候補に出す",
    body: (n: number): string =>
      `「出す」にした項目（${n}件）を、ほかの参加者のAIが読む候補に入れます。人間の一覧には出ません。`,
    // 呼び名へ寄せる（Hiroto 確定）。
    needName: "先に「呼び名」を決めてください。",
    none: "「出す」にした項目がまだありません。項目の「出さない」を押すと変わります。",
    action: "候補に出す",
    update: "候補を更新する",
    done: (n: number): string => `${n}件を候補に出しました。`,
    pending: (n: number): string => `候補の変更が${n}件あります——まだ出ていません。`,
    unpublishNote: "0件にして更新すると、取り下げになります。",
    failed: "出せませんでした。電波の良いところでもう一度お試しください。",
  },

  /** c17 Handoff Lite — mutual 直後の「この接点で話す」面（文言は指示書 §3 ゲート済）。 */
  firstNote: {
    eyebrow: "この接点で話す",
    make: "最初の一言を作る",
    copyAction: "コピー",
    assist: "AIが下書きします。送るのはあなたです。",
    failed: "下書きを作れませんでした。もう一度試すか、自分の言葉でどうぞ。",
    contactOpen: "連絡メモを開く",
  },

  proposal: {
    talk: "話してみる",
    /** c18: ペア単位の状態だと読める形（カード単位でない — edge単位化は R2）。 */
    talkSent: "この相手には「話してみる」を伝えてあります。",
    talkNote: "押すと、相手にTalkが届きます。連絡先はまだ伝わりません。",
    mutualNote: "おたがいが押したら、連絡のメモを交換できます。",
    /** 第7便 D — basisItemId の項目1件だけを開く折りたたみ。 */
    basisShow: "相手の候補から",
    readings: {
      heading: "読みを残す",
      /** c16-2: 帯の eyebrow — チップ＋ひとこと＋注記が「テストの計器」だと一目で分かる札。 */
      eyebrow: "テストのしつもん",
      /** チップ群の上の説明（第3便 B-3）。タップ即保存・ひとことは blur 保存（補遺 D）。 */
      note: "この読みはテストの記録です。提案の質を良くするために進行役が読みます。相手には伝わりません。",
      /** c16-1: 知覚系（〜わからない）の末尾に「わからない」、行動系（話したい）は最後尾。 */
      options: ["面白い", "腑に落ちる", "突飛", "わからない", "話したい"] as readonly string[],
      notePlaceholder: "ひとこと（あってもなくても）",
      /** c16-1b: わからない選択中だけ、ひとこと欄の placeholder を例示に切り替える。
       *  14字 — 390px で千切れず全文見える長さ（計器にも製品と同じ品位）。 */
      unknownChip: "わからない",
      notePlaceholderUnknown: "例：相手が何の人かわからない",
      recorded: "記録しました",
      recordFailed: "記録できませんでした",
    },
  },

  host: {
    title: "進行役",
    keyLabel: "進行役の合鍵",
    open: "開く",
    failed: "開けませんでした。合鍵を確かめてください。",
    empty: "まだ記録がありません。",
    poolHeading: "候補プール",
    signalsHeading: "「話してみる」のながれ",
    logsHeading: "提案と読み",
    readingLabel: "読み",
    noReading: "（読みはまだありません）",
  },

  // 表層語彙統一便（Hiroto 確定 2026-06-16・verbatim）: PXのやくそくを簡潔な4文へ。
  // 「話してみる」→ Talk・アンテナ語退け。憲法（PX は AI を実行しない／非ranking／
  // 預からない）は意味で保持: 「PXが持つのは…だけ」「点数も順位もつけません」「提案を
  // つくるのは…あなたのAI」。HomeView の並びは memory→order→ai→disclosure（spec 順）。
  boundary: {
    // 表層語彙統一便 第2手（Hiroto 確定・verbatim）: Trust 本文をさらに締める。
    // 記憶＝預からない を一行、持つもの＝候補と届いたTalk だけを別行（holds）に分ける。
    memory: "記憶はこの端末だけ。PXは預かりません。",
    holds: "PXが持つのは、あなたが候補に出すと決めた項目と、届いたTalkだけです。",
    order: "PXは点数も順位もつけません。",
    ai: "提案をつくるのは、あなたの鍵で動く、あなたのAIです。",
    disclosure:
      "テスト中は、候補・届いた提案・読みの記録を確認する場合があります。連絡先やメモは読みません。",
  },
} as const;

/** Every user-facing string the meet surface renders (for the forbidden scan). */
export function allMeetCopyStrings(): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "function") out.push((v as (s: string) => string)("参加者A"));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object" && v !== null) Object.values(v).forEach(walk);
  };
  walk(MEET);
  return out;
}

/**
 * 時間帯 → アンテナ欄の placeholder（v1・静的・ゲート済4本）。
 * 帯の切れ目は実装裁量（緑）: 朝=5-10時台／昼=11-16時台／夜=17-22時台／深夜=23-4時台。
 */
export function questionPlaceholderByHour(hour: number): string {
  if (hour >= 5 && hour < 11) return MEET.home.question.placeholderMorning;
  if (hour >= 11 && hour < 17) return MEET.home.question.placeholderDaytime;
  if (hour >= 17 && hour < 23) return MEET.home.question.placeholderEvening;
  return MEET.home.question.placeholderNight;
}
