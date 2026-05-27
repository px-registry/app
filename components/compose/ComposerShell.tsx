"use client";

// ComposerShell — the post-login Mode-2 dashboard: a left rail of composer modes
// and a center pane that swaps without navigating. "Send a pack" is fully
// functional (it mounts the Day-7 PackComposerBody unchanged); the eight
// category composers are honest "coming soon" placeholders.
//
// Two load-bearing decisions:
//   • PackComposerBody stays MOUNTED across mode switches (toggled with
//     display:none, not conditionally rendered) so its internal draft — file
//     blobs, upload progress, notes — survives a detour through another mode.
//   • Mode lives in the URL (?mode=…) via replaceState: deep-linkable and
//     back-button-clean, but never triggers a navigation (single-page UX).

import { useCallback, useState } from "react";
import { categories } from "@/app/categories";
import { PackComposerBody } from "./PackComposerBody.tsx";
import { ComingSoon } from "./ComingSoon.tsx";
import type { ComposerIdentity } from "@/lib/auth-client.ts";

const PACK_MODE = "pack";

type RailItem = { mode: string; labelEn: string; labelJa: string };

// Rail order: Send-a-pack first, then the eight categories in their canonical
// order (app/categories.ts).
const RAIL: RailItem[] = [
  { mode: PACK_MODE, labelEn: "Send a pack", labelJa: "パックを送る" },
  ...categories.map((c) => ({ mode: c.slug, labelEn: c.name, labelJa: c.ja })),
];
const KNOWN = new Set(RAIL.map((r) => r.mode));

function readModeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const m = new URLSearchParams(window.location.search).get("mode");
  return m && KNOWN.has(m) ? m : null;
}

export function ComposerShell({
  identity,
  initialMode,
}: {
  identity: ComposerIdentity | null;
  initialMode?: string;
}) {
  // Lazy initializer reads ?mode= directly (the shell only mounts client-side,
  // after the auth gate, so there is no SSR/hydration concern).
  const [mode, setMode] = useState<string>(
    () =>
      readModeFromUrl() ??
      (initialMode && KNOWN.has(initialMode) ? initialMode : PACK_MODE),
  );

  const selectMode = useCallback((next: string) => {
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    // replaceState — no navigation, no history entry per click.
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  const active = RAIL.find((r) => r.mode === mode) ?? RAIL[0];

  return (
    <div className="shell">
      <nav className="shell-rail" aria-label="Composer modes">
        <span className="shell-rail-brand">PX</span>
        <ul className="shell-rail-list">
          {RAIL.map((item) => (
            <li key={item.mode}>
              <button
                type="button"
                className={`shell-rail-item${item.mode === mode ? " is-active" : ""}`}
                aria-current={item.mode === mode ? "page" : undefined}
                onClick={() => selectMode(item.mode)}
              >
                <span className="shell-rail-en">{item.labelEn}</span>
                <span className="shell-rail-ja" lang="ja">
                  {item.labelJa}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <a className="shell-rail-me" href="/me/">
          ⌂ me
        </a>
      </nav>

      <div className="shell-pane">
        {/* Always mounted; visibility toggled so the draft survives switches. */}
        <div
          className="shell-pane-pack"
          style={mode === PACK_MODE ? undefined : { display: "none" }}
        >
          <PackComposerBody mode="mode2" identity={identity} />
        </div>
        {mode !== PACK_MODE && (
          <ComingSoon labelEn={active.labelEn} labelJa={active.labelJa} />
        )}
      </div>
    </div>
  );
}
