"use client";

// Identity bar — the live pack_id and the canonical manifest that produced it.
// Shared between the send-a-pack composer (Mode 1) and the Day-8 dashboard
// (Mode 2): a pack's identity is the same artifact wherever it is composed.

import {
  canonicalize,
  stripDelivery,
  type JsonValue,
  type PxManifestCoreV1,
} from "@/lib/pack/index.ts";

export function PackIdentityBar({
  packId,
  core,
}: {
  packId: string | null;
  core: PxManifestCoreV1;
}) {
  return (
    <section className="compose-identity">
      <h2 className="compose-sub-h">Identity</h2>
      <p className="identity-hint">This is your pack&rsquo;s identity.</p>
      <code className="identity-id">{packId ?? "computing…"}</code>
      <details className="identity-manifest">
        <summary>Canonical manifest (what gets hashed)</summary>
        <pre className="identity-json">
          {canonicalize(stripDelivery(core) as unknown as JsonValue)}
        </pre>
      </details>
    </section>
  );
}
