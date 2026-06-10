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

  /** 境界の脚注 — 初回は開いて見せ、以降は畳む。 */
  boundaryTitle: "PXのやくそく",

  home: {
    question: {
      placeholder: "例：PXを広めるシナジーがある相手を探したい",
      note: "いつでも書き換えられます。空でもかまいません。",
      twoTenses: "いま探しに行くか、置いて待つか。置いた問いは、ほかの参加者のAIにも見つけられます。",
    },
    // 主動詞（Hiroto 確定）: 結果を約束せず行為だけを名指す。探すのであって、
    // つながるとは言わない。「今日は無い」が返っても嘘にならない名前。英語化する日は "Go find"。
    receive: "探しに行く",
    place: {
      action: "置いておく",
      confirmHeading: "問いを置く",
      // 第9便 B: 「探し続け」は実態（開くたびの見回り）に合わせて言い直した。
      confirmNote:
        "「求めている」の項目になります。置く＝あなたのAIが、あなたがここを開くたびに見回ります。相手のAIもあなたの問いを見つけられます。",
      titleLabel: "一言タイトル（短縮案・直せます）",
      textLabel: "問いの本文",
      confirm: "この内容で置く",
      cancel: "やめる",
      listHeading: "置いてある問い",
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
      /** 第9便 命名ゲート: 探しに行く＋見回りの結末がすべてここに並ぶ。 */
      heading: "AIが見つけた提案",
      subnote: "あなたのAIが「探しに行く」と「見回り」で見つけたものが、ここに並びます。",
      /** 空状態は二分岐: 記憶未整備 / 整備済みでまだ探していない（第9便 A）。 */
      emptyNoMemory: "まだ提案はありません。記憶の下地ができたら、ここに届きます。",
      emptyReady: "まだ何もありません。問いを書いて「探しに行く」と、あなたのAIがここに提案を並べます。",
      noneToday: "今日は無い、という日もあります。",
      orderNote: "新しく届いた順に並びます。順番に意味はありません。",
      modelNote: (label: string): string => `${label} が読みました`,
      manualLabel: "探しに行きました",
      patrolLabel: (q: string): string => `置いた問い「${q}」の見回り`,
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
      reads: (n: number): string => `今日、この問いは${n}人のAIに読まれました。`,
      noReads: "今日はまだ読まれていません。",
    },
    signals: {
      heading: "あなたへの「話してみる」",
      /** 第9便 D — 役割の一行（相手からの合図が届く場所）。 */
      subnote: "あなたの問いや候補を相手のAIが見つけたとき、ここに合図が届きます。",
      empty: "いまのところ、届いている「話してみる」はありません。",
      incoming: (name: string): string => `${name}さんが「話してみる」を押しました。`,
      talkBack: "こちらも話してみる",
      mutual: "おたがいが「話してみる」を押しました。",
      contactHeading: "連絡のメモ",
      contactNote: "連絡のメモを交換できます。届くのはこの相手だけです。",
      contactPlaceholder: "例：LINEのID、メール、電話など、つながれる窓口",
      contactSave: "渡す",
      contactSaved: "渡しました",
      theirNote: (name: string): string => `${name}さんからのメモ`,
      waitingNote: "相手のメモはまだ届いていません。",
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
    toStart: "はじめかたへ",
    busy: "あなたのAIが読んでいます…",
    noKeyLoop:
      "AIをつながなくても、記憶を候補に出しておけば、ほかの参加者のAIがあなたを見つけます。「話してみる」が届いたらここに出ます。",
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
    step1: {
      heading: "1. AIをつなぐ",
      body: "ふだん使うAIの鍵をひとつ貼ります。鍵はこの端末の中だけに置かれ、PXのサーバーへは送られません。",
    },
    step2: {
      heading: "2. 記憶の下地をつくる",
      body: "プロンプトを自分のAIに貼り、返ってきたものをここに貼り戻します。内容はあなたが確認してから確定します。",
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
    confirmClear: "この端末の記憶をすべて消します。よろしいですか？",
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

  proposal: {
    talk: "話してみる",
    talkSent: "「話してみる」を伝えました",
    talkNote: "押すと、相手に「話してみる」が届きます。連絡先はまだ伝わりません。",
    mutualNote: "おたがいが押したら、連絡のメモを交換できます。",
    /** 第7便 D — basisItemId の項目1件だけを開く折りたたみ。 */
    basisShow: "相手の候補から",
    readings: {
      heading: "読みを残す",
      /** チップ群の上の説明（第3便 B-3）。タップ即保存・ひとことは blur 保存（補遺 D）。 */
      note: "この読みはテストの記録です。提案の質を良くするために進行役が読みます。相手には伝わりません。",
      options: ["面白い", "腑に落ちる", "突飛", "話したい"] as readonly string[],
      notePlaceholder: "ひとこと（あってもなくても）",
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
