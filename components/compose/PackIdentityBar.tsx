"use client";

// Identity bar — the live pack_id and the canonical manifest that produced it.
// Shared between the send-a-pack composer and the sale composer; `kind` selects
// the right hint ("pack's identity" vs "offer's identity"). Copy is
// dictionary-sourced; the pack_id and canonical manifest are unchanged (b7c5).

import {
  canonicalize,
  stripDelivery,
  type JsonValue,
  type PxManifestCoreV1,
} from "@/lib/pack/index.ts";
import { useT } from "@/lib/i18n/context.tsx";

export function PackIdentityBar({
  packId,
  core,
  kind = "pack",
}: {
  packId: string | null;
  core: PxManifestCoreV1;
  kind?: "pack" | "sale";
}) {
  const t = useT();
  return (
    <section className="compose-identity">
      <h2 className="compose-sub-h">{t("identity.heading")}</h2>
      <p className="identity-hint">
        {kind === "sale" ? t("identity.hintSale") : t("identity.hintPack")}
      </p>
      <code className="identity-id">{packId ?? t("identity.computing")}</code>
      <details className="identity-manifest">
        <summary>{t("identity.manifestSummary")}</summary>
        <pre className="identity-json">
          {canonicalize(stripDelivery(core) as unknown as JsonValue)}
        </pre>
      </details>
    </section>
  );
}
