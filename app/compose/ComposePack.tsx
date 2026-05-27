"use client";

// Send-a-pack entry point. Two surfaces share one route:
//   • no fragment      → the composer (PackComposerBody)
//   • #pack=<manifest> → the receiver's view, rebuilt from the link
// The composing experience lives in components/compose/PackComposerBody so the
// Day-8 Mode-2 dashboard can mount the same body; this file is just the router
// plus the receiver (SharedView). PX holds nothing either way: the composer
// reads files locally, and a shared link carries the manifest in the URL.

import { useEffect, useState } from "react";
import {
  computePackId,
  hasDelivery,
  type Pack,
  type PxManifestCoreV1,
} from "@/lib/pack/index.ts";
import { PX_REGISTRY_DOMAIN } from "@/lib/handle/index.ts";
import { fetchMe } from "@/lib/auth-client.ts";
import { PackView } from "../PackView";
import {
  PackComposerBody,
  type ComposerIdentity,
} from "@/components/compose/PackComposerBody.tsx";
import { decodeManifest } from "@/components/compose/share-codec.ts";

export function ComposePack() {
  const [shared, setShared] = useState<PxManifestCoreV1 | null>(null);
  const [decodeError, setDecodeError] = useState(false);
  // Owner auto-fill (Phase E): if the visitor is signed in, hand the composer
  // their identity so the sender/domain fields pre-fill. Optional — a failed or
  // absent session simply leaves identity null and the composer behaves as ever.
  const [identity, setIdentity] = useState<ComposerIdentity | null>(null);

  useEffect(() => {
    const match = window.location.hash.match(/[#&]pack=([^&]+)/);
    if (!match) return;
    try {
      setShared(decodeManifest(decodeURIComponent(match[1])));
    } catch {
      setDecodeError(true);
    }
  }, []);

  useEffect(() => {
    let live = true;
    fetchMe().then((m) => {
      if (!live || !m.signed_in || !m.handle) return;
      setIdentity({
        handle: m.handle,
        sender: m.display_name?.trim() || m.handle,
        domain: `${m.handle}.${PX_REGISTRY_DOMAIN}`,
      });
    });
    return () => {
      live = false;
    };
  }, []);

  if (decodeError) {
    return (
      <section className="compose">
        <h1 className="compose-h">This share link could not be read</h1>
        <p className="compose-intro">
          The link may be truncated. <a href="/compose/pack/">Compose a new pack →</a>
        </p>
      </section>
    );
  }

  if (shared) return <SharedView core={shared} />;
  return <PackComposerBody identity={identity} />;
}

// ── shared (receiver) view ──────────────────────────────────────────────

function SharedView({ core }: { core: PxManifestCoreV1 }) {
  const [pack, setPack] = useState<Pack | null>(null);

  useEffect(() => {
    let live = true;
    computePackId(core).then((pack_id) => {
      if (live) setPack({ pack_id, core });
    });
    return () => {
      live = false;
    };
  }, [core]);

  const delivered = hasDelivery(core);
  return (
    <section className="compose">
      <p className="demo-banner">
        {delivered ? (
          <>
            Rebuilt from the link. The files were briefly relayed through PX into
            delivery storage and are held for 30 days, then automatically
            deleted. PX does not read file contents. Each download is verified
            against its hash below.
          </>
        ) : (
          <>
            Demo pack — rebuilt from the link. PX stored nothing; the manifest
            travelled in the URL. File contents are not carried, so downloads are
            a later phase.
          </>
        )}
      </p>
      {pack ? (
        <PackView pack={pack} ancestors={[]} mode="preview" />
      ) : (
        <p className="compose-intro">Reading pack…</p>
      )}
      <p className="send-your-own">
        <a href="/compose/pack/">Send a pack of your own →</a>
      </p>
    </section>
  );
}
