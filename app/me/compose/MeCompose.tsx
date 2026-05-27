"use client";

// Auth gate for the Mode-2 dashboard. Static export has no server session at
// render time, so we gate client-side: read /api/auth/me, and if there's no
// session redirect to /signin/ carrying a ?next= back to wherever we were
// (mode included), so sign-in returns the owner to the same place.

import { useEffect, useState } from "react";
import { fetchMe, toComposerIdentity, type ComposerIdentity } from "@/lib/auth-client.ts";
import { ComposerShell } from "@/components/compose/ComposerShell.tsx";

type Gate = "checking" | "in";

export function MeCompose() {
  const [gate, setGate] = useState<Gate>("checking");
  const [identity, setIdentity] = useState<ComposerIdentity | null>(null);

  useEffect(() => {
    let live = true;
    fetchMe().then((m) => {
      if (!live) return;
      if (!m.signed_in) {
        const next = window.location.pathname + window.location.search;
        window.location.replace(`/signin/?next=${encodeURIComponent(next)}`);
        return;
      }
      setIdentity(toComposerIdentity(m));
      setGate("in");
    });
    return () => {
      live = false;
    };
  }, []);

  if (gate === "checking") {
    return <p className="shell-checking">Checking your session…</p>;
  }

  return <ComposerShell identity={identity} />;
}
