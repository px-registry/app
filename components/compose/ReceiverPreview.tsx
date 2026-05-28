"use client";

// Receiver preview — a live render of exactly what the receiver will see,
// using PackView in "preview" mode (viewer layout, without claiming an open was
// recorded). Shared by the composer (Mode 1) and the Day-8 dashboard (Mode 2).

import { PackView } from "@/app/PackView";
import type { Pack } from "@/lib/pack/index.ts";

export function ReceiverPreview({
  pack,
  label = "Receiver’s view",
}: {
  pack: Pack | null;
  /** Heading override — "Buyer's view" for the sale composer, etc. */
  label?: string;
}) {
  return (
    <section className="compose-preview">
      <h2 className="compose-sub-h">{label}</h2>
      {pack ? (
        <div className="preview-frame">
          <PackView pack={pack} ancestors={[]} mode="preview" />
        </div>
      ) : (
        <p className="compose-note">Building preview…</p>
      )}
    </section>
  );
}
