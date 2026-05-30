"use client";

// Contact Kit v1 — the device-side connect surface on a board record.
//
// Everything here happens on the owner's device. PX keeps no contact/message
// body, generates no contact link of its own, relays nothing. Three explicit
// actions: copy the intro packet (built locally from PUBLIC board material), open
// the owner-provided external link (behind an invite-key interstitial), or open a
// chosen external tool with the packet to paste. No fetch, no auto-copy, no
// mailto — contact is resolved by the owner inside the external tool.

import { useCallback, useState } from "react";
import {
  buildIntroPacket,
  introPacketText,
  toolOpenUrl,
  TOOL_LABELS,
  TOOL_USE_CASE_GUIDE,
  CONTACT_COPY,
  CONTACT_INTERSTITIAL,
  CONTACT_BOUNDARY,
  type ToolKind,
} from "@/lib/contact/index.ts";
import { sanitizeExternalActionUrl } from "@/lib/board/index.ts";

export function ContactKit({
  record,
}: {
  record: { recordId: string; title: string; externalActionUrl?: string };
}) {
  const [copied, setCopied] = useState(false);
  const [interstitial, setInterstitial] = useState(false);
  const [openUseCase, setOpenUseCase] = useState<string | null>(null);

  const safeExternal = sanitizeExternalActionUrl(record.externalActionUrl);

  // Built on demand from PUBLIC fields only — no owner/memory/proposal/query.
  const packetText = useCallback(
    () => introPacketText(buildIntroPacket({ recordId: record.recordId, title: record.title }, window.location.origin, "en")),
    [record.recordId, record.title],
  );

  // Explicit user action only — never on load (C4).
  const copyPacket = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(packetText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied — nothing is sent anywhere */
    }
  }, [packetText]);

  const openTool = useCallback(
    async (tool: ToolKind) => {
      await copyPacket(); // copy the packet so the owner can paste it
      const url = toolOpenUrl(tool);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    [copyPacket],
  );

  const continueExternal = useCallback(() => {
    if (safeExternal) window.open(safeExternal, "_blank", "noopener,noreferrer");
    setInterstitial(false);
  }, [safeExternal]);

  return (
    <section className="contact-kit" aria-label="Contact">
      <h2 className="board-tx-h">{CONTACT_COPY.heading.en}</h2>
      <p className="board-action-note">{CONTACT_COPY.intro.en}</p>

      <div className="contact-actions">
        <button type="button" className="board-chip" onClick={copyPacket}>
          {copied ? CONTACT_COPY.copied.en : CONTACT_COPY.copyPacket.en}
        </button>
        {safeExternal && (
          <button type="button" className="board-chip" onClick={() => setInterstitial(true)}>
            {CONTACT_COPY.openExternal.en}
          </button>
        )}
      </div>

      {interstitial && safeExternal && (
        <div className="contact-interstitial" role="alertdialog" aria-label="External link notice">
          <p>{CONTACT_INTERSTITIAL.en}</p>
          <div className="contact-actions">
            <button type="button" className="board-chip board-chip-active" onClick={continueExternal}>
              Continue to the external link →
            </button>
            <button type="button" className="board-chip" onClick={() => setInterstitial(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <h3 className="board-tx-h contact-tools-h">Tools</h3>
      <p className="board-action-note">{CONTACT_COPY.toolGuide.en}</p>
      <ul className="contact-usecases">
        {TOOL_USE_CASE_GUIDE.map((uc) => (
          <li key={uc.key}>
            <button
              type="button"
              className={`board-chip${openUseCase === uc.key ? " board-chip-active" : ""}`}
              aria-expanded={openUseCase === uc.key}
              onClick={() => setOpenUseCase(openUseCase === uc.key ? null : uc.key)}
            >
              {uc.en}
            </button>
            {openUseCase === uc.key && (
              <span className="contact-tool-row">
                {uc.tools.map((t) => (
                  <button key={t} type="button" className="board-chip contact-tool" onClick={() => openTool(t)}>
                    {TOOL_LABELS[t]}
                  </button>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>

      <details className="mem-boundary">
        <summary>What PX does (and does not) do here</summary>
        <ul>
          <li>PX keeps no contact or message body, and relays nothing.</li>
          <li>PX generates no contact link of its own; the owner controls the destination.</li>
          <li>PX does not vet or recommend people or tools.</li>
        </ul>
        <pre className="mem-boundary-json">{JSON.stringify(CONTACT_BOUNDARY, null, 2)}</pre>
      </details>
    </section>
  );
}
