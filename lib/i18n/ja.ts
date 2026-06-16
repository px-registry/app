// lib/i18n — 日本語 dictionary. Natively authored (not translated from EN).
// Mirrors every key in en.ts; any key omitted falls back to EN. Dashboard and
// composer are both fully authored now. {handle} / {name} / {noun} / {done} /
// {total} / {pct} / {date} / {error} are interpolation tokens — left as-is.

import type { Dict } from "./index.ts";

export const ja: Dict = {
  // toggle
  "lang.en": "EN",
  "lang.ja": "日本語",

  // ── tools panel ───────────────────────────────────────────
  "nav.title": "ツール",
  "nav.group.create": "つくる",
  "nav.group.setup": "準備",
  "nav.tool.pack": "ファイルを送る",
  "nav.tool.settings": "設定",
  "nav.tool.ai": "AI 連携",
  "nav.signin": "サインイン",

  // ── PX intro ──────────────────────────────────────────────
  "intro.heading": "記録が、それ自体の証明になる。",
  "intro.lead":
    "あなたがつくるもの——ファイルの受け渡しや、販売——は、中身そのものが ID になる記録になります。価格やファイルを変えれば、ID も一緒に変わる。",
  "intro.body":
    "ツールを選んで、はじめてください。作業のあいだ、PX は何も預かりません。サインインが必要なのは、最後にあなたの名前で公開する一手だけです。",
  "intro.pick.pack.title": "ファイルを送る",
  "intro.pick.pack.sub":
    "ファイルごとにメモを添えて渡す——ファイルはブラウザの中にとどまります。",
  "intro.pick.sale.title": "出品する",
  "intro.pick.sale.sub":
    "ひとつの品を出品——価格と写真がハッシュされ、あとから変わらない。",
  "intro.foot":
    "オークション、クラウドファンディング、動画、音楽、文章、サービス、マッチングは近日中に。",

  // ── settings panel + shared OwnerSettingsForm ─────────────
  "settings.heading": "設定",
  "settings.introSignedIn":
    "表示名とデフォルトのカテゴリ——作成画面にあらかじめ入ります。オーナーカードと同じ設定です。",
  "settings.introSignedOut":
    "設定——表示名とデフォルトのカテゴリ——は、あなた自身に紐づきます。表示・変更にはサインインを。サインインなしでも、ツールは自由に試せます。",
  "settings.signinCta": "設定するにはサインイン",
  "settings.signedInAs": "@{handle} でサインイン中。",
  "settings.form.displayName": "表示名",
  "settings.form.defaultCategory": "デフォルトのカテゴリ",
  "settings.form.noDefault": "指定なし",
  "settings.form.save": "保存",
  "settings.form.saving": "保存中…",
  "settings.form.saved": "保存しました ✓",
  "settings.form.error": "保存できませんでした。",

  // ── AI panel (redesigned) ─────────────────────────────────
  "ai.heading": "AI アシスト",
  "ai.intro":
    "写真と短い言葉から、出品の下書き——タイトル、説明、価格——をつくります。使う前に、あなたが確認して直せます。AI の提案が、あなたの確認なしに反映されることはありません。",
  "ai.model.label": "モデル",
  "ai.model.help": "モデルを選ぶと、接続の設定が下に出ます。",
  "ai.provider.openai": "OpenAI",
  "ai.provider.anthropic": "Anthropic",
  "ai.provider.ollama": "Ollama（ローカル）",
  "ai.key.label": "API キー",
  "ai.endpoint.label": "エンドポイント",
  "ai.endpoint.help": "Ollama はあなたのマシンで動きます——キーは不要です。",
  "ai.privacy":
    "キーやエンドポイントは、このブラウザの中だけに保存され、プロバイダへ直接つながります——PX には送られません。PX に AI の窓口はありません。",
  "ai.profile.label": "つくり手プロフィール",
  "ai.profile.placeholder":
    "あなた自身と、つくるものについて一言二言——文脈としてモデルに渡されます。",
  "ai.saved": "このブラウザに保存しました ✓",
  "ai.preview.label": "写真から下書き",
  "ai.preview.tag": "カテゴリの作成画面とともに登場します",
  "ai.preview.body":
    "カテゴリの作成画面が動き出したら、ここに写真を置くだけで、アシストが項目を埋めます——あなたが確認できます。いまは、出来上がっている二つのツールが直接入力を受け取ります:",
  "ai.preview.sale": "出品する →",
  "ai.preview.pack": "ファイルを送る →",

  // ── inline sign-in modal ──────────────────────────────────
  "signin.title": "続けるにはサインイン",
  "signin.reasonDefault":
    "ハンドルとパスキーだけ——覚える必要も、フィッシングの心配もありません。",
  "signin.reasonSale":
    "販売を公開すると、あなたの名前で掲載されます——この出品をあなたに紐づけるためサインインを。",
  "signin.draftNote": "下書きは、この後ろで開いたままです。",
  "signin.handle": "ハンドル",
  "signin.submit": "パスキーでサインイン",
  "signin.submitWorking": "パスキーを待っています…",
  "signin.cancel": "あとで",
  "signin.altNew": "はじめてですか？",
  "signin.altCreate": "ハンドルをつくる →",
  "signin.errHandle": "ハンドルを入力してください。",
  "signin.errUnsupported": "このブラウザはパスキーに対応していません。",
  "signin.errStart": "サインインを開始できませんでした。",
  "signin.errCancelled": "サインインがキャンセルされました。",
  "signin.errFailed": "サインインに失敗しました。",
  "signin.errGeneric": "サインインに失敗しました。もう一度お試しください。",

  // ── coming-soon ───────────────────────────────────────────
  "soon.tag": "近日公開",
  "soon.heading": "{name} の作成画面",
  "soon.body":
    "ファイルを送るは、いま使えます。ほかのカテゴリの作成画面は近日中に——ここで {name} を作れるようになります。",
  "soon.alt": "いま、ファイルを渡したいですか？",
  "soon.altLink": "ファイルを送るに切り替える →",

  // ── common ────────────────────────────────────────────────
  "common.optional": "任意",
  "common.remove": "外す",

  // ── PackComposerBody ──────────────────────────────────────
  "pack.head.title": "ファイルを送る",
  "pack.head.intro":
    "ファイルはまずブラウザの中で読まれ、そこでハッシュ化されます。どう渡すかは、あなたが選べます。",
  "pack.head.signedinHint":
    "@{handle} でサインイン中——送り主とドメインは下にあらかじめ入っています。",
  "pack.head.dashboardLink": "ダッシュボードを試す →",
  "pack.drop.line": "ファイルかフォルダをドロップ",
  "pack.drop.chooseFiles": "ファイルを選ぶ",
  "pack.drop.addFolder": "フォルダを追加",
  "pack.hashing": "{n} 個のファイルをブラウザでハッシュ化中…",
  "pack.contents.title": "中身",
  "pack.contents.unit": "件",
  "pack.entry.folder": "フォルダ",
  "pack.entry.archive": "アーカイブ",
  "pack.entry.unit": "件",
  "pack.note.leafPlaceholder": "まず読んでください——何が変わったか…",
  "pack.note.folderPlaceholder": "このフォルダへのメモ…",
  "pack.details.summary": "詳細（任意）",
  "pack.field.title": "タイトル",
  "pack.field.titlePlaceholder": "潮汐表——最終ファイル",
  "pack.field.sender": "送り主",
  "pack.field.senderPlaceholder": "アステリズム書房",
  "pack.field.domain": "ドメイン",
  "pack.field.domainPlaceholder": "asterism-books.example",
  "pack.field.coverNote": "添え書き",
  "pack.field.coverNotePlaceholder":
    "確認に必要なものは揃っています——まずメモを読んでください。",
  "pack.share.upload": "アップロードして共有リンクをつくる",
  "pack.share.metadata": "ファイル一覧だけ共有（アップロードなし）",
  "pack.share.noun": "ファイル",

  // ── SaleComposerBody ──────────────────────────────────────
  "sale.intro":
    "ひとつの品を出品します。価格・タイトル・写真が ID にハッシュされるので、あとから条件はすり替わりません。PX は決済を行いません——販売は、あなた自身のドメインで。",
  "sale.field.title": "タイトル",
  "sale.field.titlePlaceholder": "ろくろ挽きのマグカップ",
  "sale.field.price": "価格",
  "sale.field.pricePlaceholderJPY": "4800",
  "sale.field.pricePlaceholderOther": "48.00",
  "sale.field.currency": "通貨",
  "sale.drop.line": "写真をドロップ",
  "sale.drop.choose": "写真を選ぶ",
  "sale.hashing": "{n} 枚の写真をブラウザでハッシュ化中…",
  "sale.photos.title": "写真",
  "sale.photos.unit": "枚",
  "sale.field.description": "説明",
  "sale.field.descriptionPlaceholder":
    "マグひとつ、薪窯。高台に釉薬がたまり——底に小さな窯印。",
  "sale.seller.summary": "出品者",
  "sale.field.seller": "出品者",
  "sale.field.sellerPlaceholder": "真理子窯",
  "sale.field.domain": "ドメイン",
  "sale.field.domainPlaceholder": "mariko.example",
  "sale.share.upload": "出品する",
  "sale.share.metadata": "掲載内容だけ共有（写真なし）",
  "sale.share.noun": "写真",

  // ── ShareBar (JA uses {noun} everywhere) ──────────────────
  "share.heading": "共有",
  "share.delivery":
    "PX は {noun} を配信ストレージへ一時的に中継します。PX が {noun} の中身を読むことはありません。30 日間だけ保管され、その後は自動的に削除されます——長期保管は PX の役目ではありません。受け取り手は、{noun} ごとにハッシュと照合して検証します。",
  "share.progress": "{done}/{total} {noun} を配信ストレージへ中継中…（{pct}%）",
  "share.stateFailed": "失敗",
  "share.uploadFailed":
    "アップロードに失敗しました：{error}。何も共有されていません。",
  "share.retry": "もう一度",
  "share.resultDelivered":
    "{noun} をアップロードしました。このリンクは中身を届け、{date}（30 日後）に期限切れになります。受け取り手は {noun} をダウンロードして検証します。",
  "share.resultMetadata":
    "メタデータのみのリンク——{noun} の一覧とハッシュが URL に含まれます。中身はアップロードされていません。",
  "share.copy": "リンクをコピー",
  "share.copied": "コピーしました",

  // ── PackIdentityBar ───────────────────────────────────────
  "identity.heading": "ID",
  "identity.hintPack": "これが、この受け渡しの ID です。",
  "identity.hintSale": "これが、この出品の ID です。",
  "identity.computing": "計算中…",
  "identity.manifestSummary": "正規マニフェスト（ハッシュ対象）",

  // ── ReceiverPreview (wrapper only) ────────────────────────
  "preview.receiverLabel": "受け取り手の画面",
  "preview.buyerLabel": "買い手の画面",
  "preview.building": "プレビューを生成中…",

  // ── meet 視覚一新（指示書 §6 命名ゲート済 + v3正本の文言）───
  "meet.hero.lead": "あなたのAIが、あなたの人を見つける。",
  "meet.hero.accentPre": "間に、",
  "meet.hero.accentEm": "誰もいない",
  "meet.hero.accentPost": "。",
  "meet.hero.sub":
    "お互いの記憶から、ひとりでは届かなかった接点を。探しに行くのはあなたのAI。決めるのは、あなた。",
  "meet.meter.lastPre": "前回のRun ",
  "meet.meter.auto": "開くと自動でRun",
  "meet.meter.keys": "鍵はこの端末にあります",
  "meet.empty.title": "今日は、ありませんでした。",
  "meet.empty.evPre": "Runは ",
  "meet.empty.evMid": " に済んでいます。読めるものは読みました。",
  "meet.empty.evRest": "提案できる接点は、今日は見つかりませんでした。",
  "meet.empty.herePre": "いま、この場には ",
  "meet.empty.herePost": "人",
  "meet.empty.next": "明日も、開くと自動でRunします。",
  "meet.signal.notYet": "あなたはまだ押していません。",
};
