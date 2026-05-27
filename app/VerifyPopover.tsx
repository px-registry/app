"use client";

import { useState } from "react";
import { shortId } from "@/lib/pack/index.ts";

// "Verify externally" — a native Popover (no library, no JS framework widget)
// that hands the reader the commands to check a pack with standard tools. The
// point of the whole register: you do not have to trust PX. Recompute the id
// yourself; check the transparency log yourself.

export function VerifyPopover({ packId }: { packId: string }) {
  const [copied, setCopied] = useState(false);

  // Illustrative for these examples: signing/anchoring lands in a later phase.
  // The id line is real — it is the sha-256 of the canonical manifest.
  const command = [
    "# pack id — sha-256 of the canonical (RFC 8785) manifest",
    `PACK_ID=${packId}`,
    "",
    "# recompute the manifest hash and confirm it matches",
    "px pack verify $PACK_ID",
    "",
    "# or verify the Sigstore transparency-log entry once published",
    "cosign verify-blob --bundle $PACK_ID.sigstore manifest.json",
  ].join("\n");

  const popoverId = `verify-${shortId(packId, 8)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (insecure context / denied) — the command is
      // visible above for manual selection; nothing else to do.
    }
  }

  return (
    <>
      <button
        type="button"
        className="verify-trigger"
        popoverTarget={popoverId}
      >
        Verify externally
      </button>

      <div id={popoverId} popover="auto" className="verify-pop">
        <p className="verify-lead">Verify this pack with standard tools:</p>
        <pre className="verify-cmd">{command}</pre>
        <div className="verify-actions">
          <button type="button" className="verify-copy" onClick={copy}>
            {copied ? "Copied" : "Copy to clipboard"}
          </button>
          <a
            className="verify-why"
            href="https://www.rfc-editor.org/rfc/rfc8785"
            target="_blank"
            rel="noopener noreferrer"
          >
            Why is this verifiable?
          </a>
        </div>
      </div>
    </>
  );
}
