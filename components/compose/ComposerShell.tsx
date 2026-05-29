"use client";

// ComposerShell — the composer dashboard, the single /compose/ surface for
// everyone (the old signed-out chooser is subsumed). A floating tools panel on
// the left and a center workspace that swaps without navigating; sign-in is
// deferred to the last attributable step.
//
// Three load-bearing decisions:
//   • No auth gate to arrive. A visitor explores every tool and builds a draft
//     with no account; fetchMe runs in the background only to pre-fill identity
//     once known. The pre-tool center is a plain PX explanation (ComposeWelcome).
//   • The two built composers stay MOUNTED across tool switches (toggled with
//     display:none, not conditionally rendered) so a draft — file blobs, photo
//     thumbnails, prices, notes — survives a detour through another tool.
//   • The active tool lives in the URL (?mode=…) via replaceState: deep-linkable
//     and back-button-clean, never a navigation. The query name stays ?mode= so
//     the sealed /compose/pack/ receiver's "?mode=sale" link still lands here.
//
// Deferred sign-in: the inline SignInModal overlays the still-mounted dashboard,
// so the draft underneath is never lost. Publishing a sale (an attributable act)
// summons it; sending a pack does not (a pack link is a private fragment hand-off
// that PX never sees — no account needed).

import { useCallback, useEffect, useRef, useState } from "react";
import { categories, type Category } from "@/app/categories";
import { PackComposerBody } from "./PackComposerBody.tsx";
import { SaleComposerBody } from "./SaleComposerBody.tsx";
import { ComingSoon } from "./ComingSoon.tsx";
import { ComposeWelcome } from "./ComposeWelcome.tsx";
import { SettingsPanel } from "./SettingsPanel.tsx";
import { AiAssistPanel } from "./AiAssistPanel.tsx";
import { SignInModal } from "./SignInModal.tsx";
import { LangToggle } from "./LangToggle.tsx";
import { useT, useLang } from "@/lib/i18n/context.tsx";
import {
  fetchMe,
  toComposerIdentity,
  type ComposerIdentity,
  type MeResponse,
} from "@/lib/auth-client.ts";

const WELCOME_MODE = "welcome";
const PACK_MODE = "pack";
const SALE_MODE = "sale";
const SETTINGS_MODE = "settings";
const AI_MODE = "ai";

// A tool is either a dictionary-keyed label (pack/settings/ai) or a category
// (label sourced from categories.ts by active language).
type ToolItem = { mode: string; tKey?: string; cat?: Category };

// "Create" group: Send-a-pack first, then the eight categories in canonical
// order (app/categories.ts).
const CREATE: ToolItem[] = [
  { mode: PACK_MODE, tKey: "nav.tool.pack" },
  ...categories.map((c) => ({ mode: c.slug, cat: c })),
];

// "Setup" group: settings and the AI assist, equal tools below the create types.
const SETUP: ToolItem[] = [
  { mode: SETTINGS_MODE, tKey: "nav.tool.settings" },
  { mode: AI_MODE, tKey: "nav.tool.ai" },
];

const ALL_ITEMS = [...CREATE, ...SETUP];
const KNOWN = new Set<string>([WELCOME_MODE, ...ALL_ITEMS.map((i) => i.mode)]);
// The seven category tools that are honest placeholders (every category except
// "sale", which has a real composer; pack is not a category).
const COMING = new Set(
  categories.filter((c) => c.slug !== SALE_MODE).map((c) => c.slug),
);

function readModeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const m = new URLSearchParams(window.location.search).get("mode");
  return m && KNOWN.has(m) ? m : null;
}

export function ComposerShell() {
  const t = useT();
  const [lang] = useLang();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [identity, setIdentity] = useState<ComposerIdentity | null>(null);

  // The pre-tool center is the explanation. A deep link (?mode=) is read in an
  // effect, not the initializer: this shell is prerendered (SSG), so reading the
  // URL during hydration would diverge from the server's welcome render. Starting
  // at WELCOME on both sides keeps hydration clean; a ?mode= link corrects on mount.
  const [mode, setMode] = useState<string>(WELCOME_MODE);

  // Inline sign-in: open state, an explanatory line, and a resolver so an action
  // that asked for sign-in can continue (or abort) once the modal closes.
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInReasonKey, setSignInReasonKey] = useState<string | undefined>(undefined);
  const pendingRef = useRef<((me: MeResponse | null) => void) | null>(null);

  // Honor a deep link (?mode=) once mounted (see the mode state note above).
  useEffect(() => {
    const m = readModeFromUrl();
    if (m) setMode(m);
  }, []);

  // Background identity read — never blocks the surface.
  useEffect(() => {
    let live = true;
    fetchMe().then((m) => {
      if (!live) return;
      setMe(m);
      setIdentity(toComposerIdentity(m));
    });
    return () => {
      live = false;
    };
  }, []);

  const selectMode = useCallback((next: string) => {
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    // replaceState — no navigation, no history entry per click.
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  // Open the inline modal and resolve when the ceremony ends. Returns the live
  // session on success, or null if the visitor dismissed it.
  const requestSignIn = useCallback((reasonKey?: string): Promise<MeResponse | null> => {
    setSignInReasonKey(reasonKey);
    setSignInOpen(true);
    return new Promise((resolve) => {
      pendingRef.current = resolve;
    });
  }, []);

  function settleSignIn(result: MeResponse | null) {
    setSignInOpen(false);
    const resolve = pendingRef.current;
    pendingRef.current = null;
    resolve?.(result);
  }

  function handleSignedIn(m: MeResponse) {
    setMe(m);
    setIdentity(toComposerIdentity(m));
    // Let the root AuthBadge (corner identity chip + its popover) catch up.
    window.dispatchEvent(new CustomEvent("px:session-changed"));
    settleSignIn(m);
  }

  // Sale's attribution gate: publishing lists the offer under the seller's name,
  // so a signed-out seller is asked to sign in first; on success the composer
  // gets the identity and continues.
  const saleRequireAuth = useCallback(async (): Promise<ComposerIdentity | null> => {
    const m = await requestSignIn("signin.reasonSale");
    return m ? toComposerIdentity(m) : null;
  }, [requestSignIn]);

  const isComingSoon = COMING.has(mode);
  const activeCat = categories.find((c) => c.slug === mode);

  function renderItem(item: ToolItem) {
    const isActive = item.mode === mode;
    // Single language per the toggle: dictionary label, or the category label
    // in the active language (categories.ts).
    const label = item.tKey
      ? t(item.tKey)
      : lang === "ja"
        ? item.cat!.ja
        : item.cat!.name;
    const isJa = !item.tKey && lang === "ja";
    return (
      <li key={item.mode}>
        <button
          type="button"
          className={`tools-item${isActive ? " is-active" : ""}`}
          aria-current={isActive ? "page" : undefined}
          onClick={() => selectMode(item.mode)}
        >
          <span className="tools-item-label" lang={isJa ? "ja" : undefined}>
            {label}
          </span>
        </button>
      </li>
    );
  }

  return (
    <main className="dash">
      <nav className="tools-panel" aria-label="Composer tools">
        <div className="tools-panel-head">
          <a className="tools-brand" href="/">
            PX
          </a>
          <span className="tools-panel-title">{t("nav.title")}</span>
        </div>
        <div className="tools-langrow">
          <LangToggle />
        </div>

        <div className="tools-group">
          <p className="tools-group-label">{t("nav.group.create")}</p>
          <ul className="tools-list">{CREATE.map(renderItem)}</ul>
        </div>

        <div className="tools-group">
          <p className="tools-group-label">{t("nav.group.setup")}</p>
          <ul className="tools-list">{SETUP.map(renderItem)}</ul>
        </div>

        <div className="tools-foot">
          {identity ? (
            <button
              type="button"
              className="tools-owner"
              onClick={() => window.dispatchEvent(new CustomEvent("px:open-owner"))}
            >
              <span className="tools-owner-dot" aria-hidden />@{identity.handle}
            </button>
          ) : (
            <button
              type="button"
              className="tools-signin"
              onClick={() => void requestSignIn()}
            >
              {t("nav.signin")}
            </button>
          )}
        </div>
      </nav>

      <div className="dash-pane">
        {/* Built composers stay mounted; visibility toggled so each draft
            survives switching to another tool and back. */}
        <div
          className="dash-body"
          style={mode === PACK_MODE ? undefined : { display: "none" }}
        >
          <PackComposerBody mode="mode2" identity={identity} />
        </div>
        <div
          className="dash-body"
          style={mode === SALE_MODE ? undefined : { display: "none" }}
        >
          <SaleComposerBody
            identity={identity}
            signedIn={!!identity}
            onRequireAuth={saleRequireAuth}
          />
        </div>

        {mode === WELCOME_MODE && <ComposeWelcome onPick={selectMode} />}
        {mode === SETTINGS_MODE && (
          <SettingsPanel me={me} onRequireSignIn={() => void requestSignIn()} />
        )}
        {mode === AI_MODE && <AiAssistPanel onPick={selectMode} />}
        {isComingSoon && activeCat && (
          <ComingSoon labelEn={activeCat.name} labelJa={activeCat.ja} />
        )}
      </div>

      <SignInModal
        open={signInOpen}
        reasonKey={signInReasonKey}
        onClose={() => settleSignIn(null)}
        onSignedIn={handleSignedIn}
      />
    </main>
  );
}
