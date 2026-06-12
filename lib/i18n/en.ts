// lib/i18n — English dictionary. Source of truth for the key set; ja.ts mirrors
// every key (falling back here until authored). Flat dotted keys. Tokens in {…}.

import type { Dict } from "./index.ts";

export const en: Dict = {
  // toggle
  "lang.en": "EN",
  "lang.ja": "日本語",

  // ── tools panel (chrome) ──────────────────────────────────
  "nav.title": "Tools",
  "nav.group.create": "Create",
  "nav.group.setup": "Setup",
  "nav.tool.pack": "Send a pack",
  "nav.tool.settings": "Settings",
  "nav.tool.ai": "AI assist",
  "nav.signin": "Sign in",

  // ── PX intro (center default) ─────────────────────────────
  "intro.heading": "A record that is its own proof.",
  "intro.lead":
    "What you make — a file delivery, an offer for sale — becomes a record whose identity is its own contents. Change a price or a file and the id changes with it.",
  "intro.body":
    "Pick a tool and start. Nothing is held by PX while you work; you sign in only at the last step, to publish under your name.",
  "intro.pick.pack.title": "Send a pack",
  "intro.pick.pack.sub":
    "Deliver files with a note for each — they stay in your browser.",
  "intro.pick.sale.title": "List a sale",
  "intro.pick.sale.sub":
    "One thing for sale as a verifiable offer — price and photos hashed in.",
  "intro.foot":
    "Auction, crowdfund, video, music, writing, service and matching arrive in upcoming days.",

  // ── settings panel + shared OwnerSettingsForm ─────────────
  "settings.heading": "Settings",
  "settings.introSignedIn":
    "Your display name and default category — used to pre-fill the composer. The same settings as the card in your owner popover.",
  "settings.introSignedOut":
    "Settings — your display name and default category — belong to your identity. Sign in to view and change them. You can keep exploring the tools without one.",
  "settings.signinCta": "Sign in to manage settings",
  "settings.signedInAs": "Signed in as @{handle}.",
  "settings.form.displayName": "Display name",
  "settings.form.defaultCategory": "Default category",
  "settings.form.noDefault": "No default",
  "settings.form.save": "Save",
  "settings.form.saving": "Saving…",
  "settings.form.saved": "Saved ✓",
  "settings.form.error": "Could not save.",

  // ── AI panel (redesigned: model dropdown → provider input) ─
  "ai.heading": "AI assist",
  "ai.intro":
    "Turn a photo and a few words into a draft listing — title, description, price — that you review and edit before anything is used. Nothing it proposes is applied without your confirmation.",
  "ai.model.label": "Model",
  "ai.model.help": "Pick a model; its connection details appear below.",
  "ai.provider.openai": "OpenAI",
  "ai.provider.anthropic": "Anthropic",
  "ai.provider.ollama": "Ollama (local)",
  "ai.key.label": "API key",
  "ai.endpoint.label": "Endpoint",
  "ai.endpoint.help": "Ollama runs on your machine — no key needed.",
  "ai.privacy":
    "Your key or endpoint is saved in this browser only and goes straight to the provider — never to PX. PX has no AI endpoint.",
  "ai.profile.label": "Maker profile",
  "ai.profile.placeholder":
    "A line or two about you and what you make — given to the model as context.",
  "ai.saved": "Saved to this browser ✓",
  "ai.preview.label": "Draft from a photo",
  "ai.preview.tag": "Arriving with the category composers",
  "ai.preview.body":
    "Once a category composer is live, drop a photo here and the assist fills its fields for you to review. Today the two built tools take their input directly:",
  "ai.preview.sale": "List a sale →",
  "ai.preview.pack": "Send a pack →",

  // ── inline sign-in modal ──────────────────────────────────
  "signin.title": "Sign in to continue",
  "signin.reasonDefault":
    "Your handle and passkey — nothing to remember, nothing to phish.",
  "signin.reasonSale":
    "Publishing a sale lists it under your name — sign in to attribute the offer.",
  "signin.draftNote": "Your draft stays open behind this.",
  "signin.handle": "Handle",
  "signin.submit": "Sign in with passkey",
  "signin.submitWorking": "Waiting for passkey…",
  "signin.cancel": "Not now",
  "signin.altNew": "New here?",
  "signin.altCreate": "Create an identity →",
  "signin.errHandle": "Enter your handle.",
  "signin.errUnsupported": "This browser doesn’t support passkeys.",
  "signin.errStart": "Could not start sign-in.",
  "signin.errCancelled": "Sign-in was cancelled.",
  "signin.errFailed": "Sign-in failed.",
  "signin.errGeneric": "Sign-in failed. Please try again.",

  // ── coming-soon ───────────────────────────────────────────
  "soon.tag": "Coming soon",
  "soon.heading": "{name} composer",
  "soon.body":
    "Send a pack works today. The other category composers arrive in upcoming days — this is where you’ll create a {name} listing.",
  "soon.alt": "Want to send a file delivery now?",
  "soon.altLink": "Switch to Send a pack →",

  // ── common ────────────────────────────────────────────────
  "common.optional": "optional",
  "common.remove": "remove",

  // ── PackComposerBody ──────────────────────────────────────
  "pack.head.title": "Send a pack",
  "pack.head.intro":
    "Files are read in your browser first and hashed there. How you share is your choice.",
  "pack.head.signedinHint":
    "Signed in as @{handle} — your sender and domain are pre-filled below.",
  "pack.head.dashboardLink": "Try the dashboard →",
  "pack.drop.line": "Drop files or a folder",
  "pack.drop.chooseFiles": "Choose files",
  "pack.drop.addFolder": "Add folder",
  "pack.hashing": "Hashing {n} file(s) in your browser…",
  "pack.contents.title": "Contents",
  "pack.contents.unit": "files",
  "pack.entry.folder": "folder",
  "pack.entry.archive": "archive",
  "pack.entry.unit": "files",
  "pack.note.leafPlaceholder": "Read this first — what changed…",
  "pack.note.folderPlaceholder": "Note for this folder…",
  "pack.details.summary": "Pack details (optional)",
  "pack.field.title": "Title",
  "pack.field.titlePlaceholder": "The Tide Tables — final files",
  "pack.field.sender": "Sender",
  "pack.field.senderPlaceholder": "Asterism Books",
  "pack.field.domain": "Domain",
  "pack.field.domainPlaceholder": "asterism-books.example",
  "pack.field.coverNote": "Cover note",
  "pack.field.coverNotePlaceholder":
    "Everything you need to sign off is here — read the notes first.",
  "pack.share.upload": "Upload & create share link",
  "pack.share.metadata": "Share file list only (no upload)",
  "pack.share.noun": "file",

  // ── SaleComposerBody ──────────────────────────────────────
  "sale.intro":
    "List one thing for sale as a verifiable offer. The price, title and photos hash into the pack id — the terms can’t change after the fact. PX runs no payment; the sale happens on your own domain.",
  "sale.field.title": "Title",
  "sale.field.titlePlaceholder": "Wheel-thrown stoneware mug",
  "sale.field.price": "Price",
  "sale.field.pricePlaceholderJPY": "4800",
  "sale.field.pricePlaceholderOther": "48.00",
  "sale.field.currency": "Currency",
  "sale.drop.line": "Drop photos",
  "sale.drop.choose": "Choose photos",
  "sale.hashing": "Hashing {n} photo(s) in your browser…",
  "sale.photos.title": "Photos",
  "sale.photos.unit": "photos",
  "sale.field.description": "Description",
  "sale.field.descriptionPlaceholder":
    "One mug, wood-fired. Glaze pools at the foot — small kiln marks on the base.",
  "sale.seller.summary": "Seller",
  "sale.field.seller": "Seller",
  "sale.field.sellerPlaceholder": "Mariko Kiln",
  "sale.field.domain": "Domain",
  "sale.field.domainPlaceholder": "mariko.example",
  "sale.share.upload": "Upload photos & create link",
  "sale.share.metadata": "Share listing only (no photos)",
  "sale.share.noun": "photo",

  // ── ShareBar (shared prose) ───────────────────────────────
  // tokens: {noun} {plural} {Plural} {done} {total} {pct} {date} {error}
  "share.heading": "Share",
  "share.delivery":
    "PX briefly relays your {plural} to delivery storage. PX does not read {noun} contents. They are held for 30 days, then automatically deleted — long-term storage is not PX’s role. The receiver verifies each {noun} against its hash.",
  "share.progress":
    "Relaying {done}/{total} {noun}(s) to delivery storage… ({pct}%)",
  "share.stateFailed": "failed",
  "share.uploadFailed": "Upload failed: {error}. Nothing was shared.",
  "share.retry": "Try again",
  "share.resultDelivered":
    "{Plural} uploaded. This link delivers the bytes and expires {date} (30 days). The receiver downloads and verifies each {noun}.",
  "share.resultMetadata":
    "Metadata-only link — the {noun} list and hashes travel in the URL; no bytes were uploaded.",
  "share.copy": "Copy link",
  "share.copied": "Copied",

  // ── PackIdentityBar ───────────────────────────────────────
  "identity.heading": "Identity",
  "identity.hintPack": "This is your pack’s identity.",
  "identity.hintSale": "This is your offer’s identity.",
  "identity.computing": "computing…",
  "identity.manifestSummary": "Canonical manifest (what gets hashed)",

  // ── ReceiverPreview (wrapper only) ────────────────────────
  "preview.receiverLabel": "Receiver’s view",
  "preview.buyerLabel": "Buyer’s view",
  "preview.building": "Building preview…",

  // ── meet visual refresh ───────────────────────────────────
  // EN: draft, ungated — initial values from the attached EN mocks
  // (px-home-english-ver / px-home-daylight-final); the few lines those mocks
  // don't cover (empty face, notYet) are gap-fill drafts in the same voice.
  // The toggle defaults to JA; there is no public EN entry point.
  "meet.hero.lead": "Your AI finds your people. ",
  "meet.hero.accentPre": "",
  "meet.hero.accentEm": "No one in between.",
  "meet.hero.accentPost": "",
  "meet.hero.sub":
    "Out of each other's memory — connections neither side could have reached alone. Your AI goes looking. You decide.",
  "meet.meter.lastPre": "Last sweep ",
  "meet.meter.auto": "Sweeps automatically when you open",
  "meet.meter.keys": "Your keys never leave this device",
  "meet.empty.title": "Nothing today.",
  "meet.empty.evPre": "The sweep ran at ",
  "meet.empty.evMid": " — everything readable was read.",
  "meet.empty.evRest": "No connection to propose today.",
  "meet.empty.herePre": "Right now, ",
  "meet.empty.herePost": " here",
  "meet.empty.next": "Tomorrow too, it sweeps when you open.",
  "meet.signal.notYet": "You haven't pressed yet.",
};
