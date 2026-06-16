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
    start: "はじめかた",
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
    setup: "Setup",
  },

  /** 境界の脚注 — 初回は開いて見せ、以降は畳む。 */
  boundaryTitle: "PXのやくそく",

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
    receive: "探しにいく",
    // 便3 改名（Hiroto ゲート済・最重要）: 問いを置く → アンテナ。
    // 機能名=アンテナ／主ボタン=アンテナを立てる。
    // 見出しは 2026-06-13 ブランド語へ昇格: 今日のアンテナ → Antenna（英語 eyebrow 群と同テクスチャ）。
    place: {
      /** 視覚一新 — v3正本の eyebrows（意匠）。 */
      eyebrowAsk: "Ask",
      eyebrowResting: "Resting",
      heading: "Antenna",
      action: "アンテナを立てる",
      confirmHeading: "アンテナを立てる",
      // 第9便 B: 「探し続け」は実態（開くたびの見回り）に合わせて言い直した。
      confirmNote:
        "「求めている」の項目になります。立てる＝あなたのAIが、あなたがここを開くたびに見回ります。相手のAIもあなたのアンテナを見つけられます。",
      titleLabel: "一言タイトル（短縮案・直せます）",
      textLabel: "アンテナの本文",
      /** 0012（Hiroto ゲート済「□ ビジネス」）— チェック一個・説明文なし。
       *  同じ一語が受け手の「相手の候補から」に添えられる（表示点・ゲート条件）。 */
      business: "ビジネス",
      confirm: "この内容で立てる",
      cancel: "やめる",
      listHeading: "立てているアンテナ",
      stateWaiting: "待っています。",
      stateNotOut: "まだ候補に出ていません。「候補を更新する」で出ます。",
      stateStillOut: "「出さない」にしました——候補からは「候補を更新する」で下がります。",
      stateDown: "「出さない」になっています。",
      putBack: "出すに戻す",
      withdraw: "候補から下げる",
      updatePool: "候補を更新する",
      needName: "候補に出すには、先に記憶ページで「候補に出すときの名前」を決めてください。",
    },
    proposals: {
      /** 視覚一新 — v3正本の eyebrow（言語によらず英字の意匠）。 */
      eyebrow: "Found by your AI",
      /** 第9便 命名ゲート: 探しに行く＋見回りの結末がすべてここに並ぶ。 */
      heading: "AIが見つけた提案",
      subnote: "あなたのAIが「探しに行く」と「見回り」で見つけたものが、ここに並びます。",
      /** 空状態は二分岐: 記憶未整備 / 整備済みでまだ探していない（第9便 A）。 */
      emptyNoMemory: "まだ提案はありません。記憶の下地ができたら、ここに届きます。",
      emptyReady: "まだ何もありません。見つけてほしいことを書いて「探しに行く」と、あなたのAIがここに提案を並べます。",
      noneToday: "今日は無い、という日もあります。",
      orderNote: "新しく届いた順に並びます。順番に意味はありません。",
      modelNote: (label: string): string => `${label} が読みました`,
      manualLabel: "探しに行きました",
      patrolLabel: (q: string): string => `アンテナ「${q}」の見回り`,
      rawShow: "そのままの返事を見る",
      removeEntry: "この回を消す",
      /** provenance gate (第3便 A) — 法の遵守は構造で裏打ちする。 */
      provenanceNote: (n: number): string =>
        `実在の相手に結べない提案は表示していません（${n}枚）。`,
    },
    /** 第9便 B — 見回り（owner の端末・owner の鍵でのみ走る）。 */
    patrol: {
      running: "見回り中…",
      last: (hhmm: string): string => `最後の見回り：${hhmm}`,
      offline: "見回りは、この端末でAIがつながっているときに動きます。",
    },
    /** 第9便 C — 気配（事実の表示・判定なし・一覧なし）。 */
    presence: {
      participants: (n: number): string => `いま候補に出ている参加者：${n}人`,
      reads: (n: number): string => `今日、このアンテナは${n}人のAIに読まれました。`,
      noReads: "今日はまだ読まれていません。",
    },
    signals: {
      /** 視覚一新 — v3正本の eyebrow（意匠）。 */
      eyebrow: "For you",
      heading: "あなたへの「話してみる」",
      /** 第9便 D — 役割の一行（相手からの合図が届く場所）。 */
      subnote: "あなたのアンテナや候補を相手のAIが見つけたとき、ここに合図が届きます。",
      empty: "いまのところ、届いている「話してみる」はありません。",
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
      eyebrow: "あなたのAI",
      heading: "探してもらう",
      /** です調（Hiroto 起草・ゲート済 2026-06-13）— 「接点」は UI から退場（二層命名）。 */
      note: "あなたのAIが探しに行きます。候補やアンテナを読んで、いま話したい相手を見つけます。",
      placeholder: "どんな人・どんな話を探しますか",
      run: "探してもらう",
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
      stopped: "このアンテナは止まっています。",
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
    needKey: "AIがまだつながっていません。",
    needMemory: "記憶の下地がまだありません。",
    needName: "候補に出すときの名前がまだありません。",
    /** c12-7 (Hiroto ゲート済): 名前行の導線 — 記入欄は記憶画面にある。 */
    nameWhere: "記憶で書けます",
    toStart: "はじめかたへ",
    busy: "あなたのAIが読んでいます…",
    /** 二態の対句のです調（Hiroto 起草・ゲート済 2026-06-13）— 行ごと差し替え。 */
    noKeyLoop: "AIをつながなくても、アンテナを立てておけば、見つけてもらえます。",
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
    title: "はじめかた",
    lede: "三つ済ませば、あとは受け取るだけ。",
    /**
     * R2 二扉化。「このページで使う」「あなたのAIから使う」は同格 — どちらも同じ部屋に入る。
     * 二態の対句（sign/body・Hiroto 起草・ゲート済 2026-06-13）。register 規則:
     * 看板調（sign）は見出し・二扉ページ級のみ、本文はです調。対句で足りない新文は STOP④。
     * lede・copyUrl 等の残りは仮置き（黄・精算中）。
     */
    doors: {
      lede: "入り口は二つ。どちらからでも、同じ部屋に入れます。",
      page: {
        heading: "このページで使う",
        /** 看板調（ゲート済） */
        sign: "アンテナを立てる。ほかの人のAIが見つけたとき、あなたに届く。",
        body: "下の三つを済ませれば、あとは受け取るだけ。",
      },
      ai: {
        heading: "あなたのAIから使う",
        /** 看板調（ゲート済） */
        sign: "あなたのAIをつなぐと、探しに行ける。",
        /** です調（ゲート済） */
        body: "候補やアンテナを読んで、いま話したい相手を見つけます。",
        /** コネクタ説明の平易化（ゲート済）— 技術語は降格して最後に小さく。 */
        lead: "あなたが使っているいつものAIからこの部屋を使えます。下のURLを、AI側の接続設定に貼ってください。",
        tech: "MCP／コネクタ設定で使います。",
        copyUrl: "接続URLをコピー",
        copied: "コピーしました",
        copyFailed: "コピーできませんでした。",
        caution: "これはあなた専用の合鍵入りのURLです。人に渡さないでください。",
        hint: "つないだら、チャットで「PXで見回って」と頼んでみてください。",
      },
    },
    step1: {
      heading: "1. AIをつなぐ",
      body: "ふだん使うAIの鍵をひとつ貼ります。鍵はこの端末の中だけに置かれ、PXのサーバーへは送られません。",
    },
    step2: {
      heading: "2. 記憶の下地をつくる",
      body: "プロンプトを自分のAIに貼り、返ってきたものをここに貼り戻します。内容はあなたが確認してから確定します。",
      /** c14 (Hiroto ゲート済): 他人に読める形で生まれる、の予告一行。 */
      legible: "項目は、あなたを知らない人が読んでも分かる言葉でつくられます。",
    },
    step3: {
      heading: "3. AIの候補に出すものを選ぶ",
      body: "「出す」にした項目だけが、ほかの参加者のAIが読む候補に入ります。人間の一覧には出ません。それ以外はこの端末から出ません。会社名などを伏せて、内容だけ伝える書き方も選べます。",
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
    done: "記憶の下地ができました。",
    redo: "貼り直す",
  },

  profile: {
    heading: "候補に出すときの名前",
    note: "候補や「話してみる」に添える呼び名です。本名でなくてかまいません。",
    placeholder: "例：あや、カフェの人",
    save: "保存",
    saved: "保存しました",
    /** 第7便 B — ひとこと紹介（任意・~60字・保存して候補に出して初めて公開）。 */
    introLabel: "ひとこと紹介（任意）",
    introNote: "候補や提案に添える、あなたの一言です。AIに下書きを頼めます。",
    introPlaceholder: "例：手を動かす場づくりが好きです",
    introDraft: "AIに下書きを頼む",
    introBusy: "あなたのAIが書いています…",
    introFailed: "下書きを受け取れませんでした。手で書くこともできます。",
  },

  memory: {
    title: "あなたの記憶",
    boundary: "記憶はこの端末の中だけにあります。PXは預かりません。",
    empty: "まだ記憶がありません。はじめかたの手順でつくれます。",
    addItem: "項目を足す",
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
    heading: "AIの候補に出す",
    body: (n: number): string =>
      `「出す」にした項目（${n}件）を、ほかの参加者のAIが読む候補に入れます。人間の一覧には出ません。`,
    needName: "先に「候補に出すときの名前」を決めてください。",
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
    talkNote: "押すと、相手に「話してみる」が届きます。連絡先はまだ伝わりません。",
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

  boundary: {
    memory:
      "私的な記憶はこの端末の中だけ。PXのサーバーが持つのは、あなたがAIの候補に出すと決めた項目と「話してみる」だけです。候補は各参加者のAIだけが読み、人間の一覧には出ません。",
    ai: "PXはAIを実行しません。提案をつくるのは、あなたの鍵で動くあなたのAIです。",
    order: "点数も順位もつけません。",
    disclosure:
      "テストのあいだ、候補の項目・届いた提案・あなたの読みは進行役も読めます（テストの記録のため）。連絡のメモは読めません。",
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
