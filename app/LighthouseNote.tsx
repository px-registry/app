"use client";

import { useEffect, useState } from "react";

// The Lighthouse open event, stated as fact — not as surveillance.
//
// Opening a pack is a public register event: the open is logged, the opener is
// not. We render the note only after mount (it describes *this* open, which is
// a client moment) and we time-stamp it client-side. The copy is deliberately
// flat: what happened, and what it is not.

export function LighthouseNote() {
  const [at, setAt] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setAt(
      now.toISOString().slice(0, 16).replace("T", " ") + " UTC",
    );
  }, []);

  return (
    <aside className="lighthouse" aria-live="polite">
      <span className="lighthouse-line">
        Lighthouse recorded this open{at ? <> · <time className="lighthouse-at">{at}</time></> : null}.
      </span>
      <span className="lighthouse-sub">
        Opens are public register events — the event, not who you are.
      </span>
    </aside>
  );
}
