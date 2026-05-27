"use client";

// /compose/ is adaptive: signed-out visitors get the public chooser (Mode 1);
// signed-in owners get the Mode-2 dashboard (ComposerShell). The chooser is the
// SSR/initial render (the public default), so the static page is the chooser and
// signed-in owners swap to the dashboard after the session check — no separate
// /me/compose/ route, no auth gate that blocks the public entry.

import { useEffect, useState } from "react";
import { fetchMe, toComposerIdentity, type ComposerIdentity } from "@/lib/auth-client.ts";
import { ComposeChooser } from "./ComposeChooser.tsx";
import { ComposerShell } from "./ComposerShell.tsx";

export function ComposeAdaptive() {
  const [dashboard, setDashboard] = useState(false);
  const [identity, setIdentity] = useState<ComposerIdentity | null>(null);

  useEffect(() => {
    let live = true;
    fetchMe().then((m) => {
      if (!live) return;
      if (m.signed_in) {
        setIdentity(toComposerIdentity(m));
        setDashboard(true);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  if (dashboard) {
    return (
      <main className="shell-main">
        <ComposerShell identity={identity} />
      </main>
    );
  }
  return <ComposeChooser />;
}
