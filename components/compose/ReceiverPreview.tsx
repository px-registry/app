"use client";

// Receiver preview — a live render of exactly what the receiver will see, using
// PackView in "preview" mode. Shared by the pack and sale composers; `kind`
// selects the heading ("Receiver's view" vs "Buyer's view"). Only this wrapper's
// copy is localized — the PackView render inside is a sealed viewer and stays in
// its own (EN / dual-label) rendering until the viewers get their own i18n.

import { PackView } from "@/app/PackView";
import type { Pack } from "@/lib/pack/index.ts";
import { useT } from "@/lib/i18n/context.tsx";

export function ReceiverPreview({
  pack,
  kind = "pack",
}: {
  pack: Pack | null;
  kind?: "pack" | "sale";
}) {
  const t = useT();
  return (
    <section className="compose-preview">
      <h2 className="compose-sub-h">
        {kind === "sale" ? t("preview.buyerLabel") : t("preview.receiverLabel")}
      </h2>
      {pack ? (
        <div className="preview-frame">
          <PackView pack={pack} ancestors={[]} mode="preview" />
        </div>
      ) : (
        <p className="compose-note">{t("preview.building")}</p>
      )}
    </section>
  );
}
