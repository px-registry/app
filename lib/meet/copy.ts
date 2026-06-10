// R1.5 meet surface — copy label layer (rename-cheap: every user-facing string
// lives here, never inline in JSX; route names are provisional and cheap to
// rename because labels are centralized).
//
// Register: Japanese-native, quiet, honest. The boundary lines are FACTS about
// the architecture (device-only memory, browser-direct AI, server holds only
// the public projection + the talk signal) — they must stay true in code.
// No ranking / no recommendation language anywhere (see ./forbidden.ts).

export const MEET = {
  /** Browser-tab / surface title. Naming is provisional (label layer). */
  title: "PX",
  lede: "お互いの記憶から、思いがけない接点を。",

  nav: {
    home: "ホーム",
    memory: "記憶",
    pool: "公開",
    start: "はじめかた",
  },

  home: {
    question: {
      heading: "今日の問い",
      placeholder: "例：PXを広めるシナジーがある相手を探したい",
      note: "いつでも書き換えられます。空でもかまいません。",
    },
    receive: "提案を受け取る",
    proposals: {
      heading: "届いた提案",
      empty: "まだ提案はありません。記憶の下地ができたら、ここに届きます。",
      noneToday: "今日は無い、という日もあります。",
      orderNote: "新しく届いた順に並びます。順番に意味はありません。",
      modelNote: (label: string): string => `${label} が読みました`,
      rawShow: "そのままの返事を見る",
      removeEntry: "この回を消す",
    },
    signals: {
      heading: "合図",
      empty: "いまのところ合図はありません。",
      incoming: (ref: string): string => `${ref} から「話してみる」の合図が届いています。`,
    },
  },

  connect: {
    modelLabel: "つかうAI",
    keyLabel: "鍵（APIキー）",
    endpointLabel: "つなぎ先（あなたのPC）",
    save: "保存",
    saved: "保存しました",
    connected: "つながっています。",
    privacy:
      "鍵はこの端末の中だけに置かれ、PXのサーバーへは送られません。呼び出しはこの端末からあなたの鍵で直接行われます。",
  },

  receive: {
    needKey: "AIがまだつながっていません。",
    needMemory: "記憶の下地がまだありません。",
    needName: "公開のときの名前がまだありません。",
    toStart: "はじめかたへ",
    busy: "あなたのAIが読んでいます…",
    errors: {
      auth: "鍵が通りませんでした。鍵を確かめてください。",
      rate: "少し混んでいます。間をおいてもう一度。",
      provider: "AIから返事が返りませんでした。もう一度お試しください。",
      network: "つながりませんでした。電波の良いところでもう一度。",
      pool: "公開の候補を読み込めませんでした。もう一度お試しください。",
    } as Record<string, string>,
  },

  start: {
    title: "はじめかた",
    lede: "三つ済ませば、あとは受け取るだけ。",
    step1: {
      heading: "1. AIをつなぐ",
      body: "ふだん使うAIの鍵をひとつ入れます。鍵はこの端末の中だけに置かれ、PXのサーバーへは送られません。",
    },
    step2: {
      heading: "2. 記憶の下地をつくる",
      body: "プロンプトを自分のAIに貼り、返ってきたものをここに貼り戻します。内容はあなたが確認してから確定します。",
    },
    step3: {
      heading: "3. 公開するものを選ぶ",
      body: "公開すると決めた項目だけが、ほかの参加者の候補に並びます。それ以外はこの端末から出ません。",
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
    pasteLabel: "AIの返事をここに貼る",
    pastePlaceholder: "返ってきたJSONをそのまま貼り付けてください",
    parse: "取り込む",
    reviewHeading: "確認してから確定",
    reviewNote:
      "公開にした項目だけが、ほかの参加者の候補に出ます。あとからいつでも変えられます。迷ったら非公開のままで。",
    publicLabel: "公開",
    privateLabel: "非公開",
    confirm: (n: number): string => `この${n}件で確定する`,
    done: "記憶の下地ができました。",
    redo: "貼り直す",
  },

  profile: {
    heading: "公開のときの名前",
    note: "公開の項目や合図に添える呼び名です。本名でなくてかまいません。",
    placeholder: "例：あや、カフェの人",
    save: "保存",
    saved: "保存しました",
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
    exportLabel: "控えを保存",
    importLabel: "控えから戻す",
    importReport: (added: number, updated: number): string =>
      `${added}件を追加、${updated}件を更新しました。`,
    durability: "ブラウザのデータを消すと、ここも消えます。控えを保存しておくと戻せます。",
  },

  pool: {
    title: "公開されているもの",
    note: "それぞれの参加者が公開すると決めた項目だけが、ここに並びます。",
    empty: "まだ何も公開されていません。",
    loading: "読み込んでいます…",
    failed: "読み込めませんでした。電波の良いところでもう一度お試しください。",
    reload: "もう一度読み込む",
  },

  publish: {
    heading: "みんなの候補に出す",
    body: (n: number): string =>
      `公開の項目（${n}件）を、ほかの参加者から見える候補に出します。出すかどうかはあなたが決めます。`,
    needName: "先に「公開のときの名前」を決めてください。",
    none: "公開の項目がまだありません。項目の「非公開」を押すと公開に変わります。",
    action: "公開する",
    update: "公開を更新する",
    done: (n: number): string => `${n}件を出しました。`,
    unpublishNote: "公開の項目を0件にして更新すると、取り下げになります。",
    failed: "出せませんでした。電波の良いところでもう一度お試しください。",
  },

  proposal: {
    talk: "話してみる",
    talkNote: "押すと、相手にその合図が表示されます。連絡先はまだ伝わりません。",
    mutualNote: "おたがいが押したら、連絡のメモを交換できます。",
    readings: {
      heading: "読みを残す",
      options: ["面白い", "腑に落ちる", "突飛", "話したい"] as readonly string[],
      note: "読みはあなたの私的なメモです。相手には見えません。進行役がテストのために読みます。",
    },
  },

  boundary: {
    memory: "私的な記憶はこの端末の中だけ。PXのサーバーが持つのは、公開すると決めた項目と「話してみる」の合図だけです。",
    ai: "PXはAIを実行しません。提案をつくるのは、あなたの鍵で動くあなたのAIです。",
    order: "点数も順位もつけません。",
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
