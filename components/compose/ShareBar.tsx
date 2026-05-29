"use client";

// Share/upload bar — the two ways to share a composed pack:
//   • "Upload & create share link" — relay the bytes into delivery storage
//     (held 30 days), then the link delivers the files.
//   • "Share file list only (no upload)" — the metadata-only 持たない share;
//     the file list + hashes travel in the URL, no bytes leave the browser.
//
// Purely presentational: PackComposerBody owns the state and passes it down, so
// the same bar can serve the Day-8 Mode-2 composer without change.

import type { PxDelivery } from "@/lib/pack/index.ts";
import type { FileProgress } from "./types.ts";
import { useT } from "@/lib/i18n/context.tsx";

export type ShareState = "idle" | "uploading" | "done" | "error";

export function ShareBar({
  hasContent,
  fileCount,
  uploadState,
  progress,
  uploadError,
  shareUrl,
  copied,
  delivery,
  onUploadAndShare,
  onCreateShareLink,
  onCopyLink,
  noun = "file",
  uploadLabel = "Upload & create share link",
  metadataLabel = "Share file list only (no upload)",
}: {
  hasContent: boolean;
  fileCount: number;
  uploadState: ShareState;
  progress: Record<string, FileProgress>;
  uploadError: string | null;
  shareUrl: string | null;
  copied: boolean;
  delivery: PxDelivery | null;
  onUploadAndShare: () => void;
  onCreateShareLink: () => void;
  onCopyLink: () => void;
  /** Singular for the thing being shared ("file" | "photo"); drives the prose. */
  noun?: string;
  /** Primary (upload) button label. */
  uploadLabel?: string;
  /** Secondary (metadata-only) button label. */
  metadataLabel?: string;
}) {
  const t = useT();
  // EN templates use {plural}/{Plural}; JA templates use {noun} only. Both are
  // passed; each language's string references what it needs.
  const plural = `${noun}s`;
  const Plural = plural.charAt(0).toUpperCase() + plural.slice(1);
  // Aggregate upload progress for the status line.
  const progressValues = Object.values(progress);
  const uploadTotal = progressValues.length;
  const uploadDone = progressValues.filter((p) => p.state === "done").length;
  const aggregatePct = uploadTotal
    ? Math.round(
        (progressValues.reduce(
          (s, p) => s + (p.state === "done" ? 1 : p.pct),
          0,
        ) /
          uploadTotal) *
          100,
      )
    : 0;

  return (
    <section className="compose-share">
      <h2 className="compose-sub-h">{t("share.heading")}</h2>

      {uploadState !== "done" && (
        <p className="delivery-articulation">
          {t("share.delivery", { noun, plural })}
        </p>
      )}

      {/* Per-file upload progress. */}
      {uploadState === "uploading" && (
        <div className="upload-progress">
          <p className="compose-note">
            {t("share.progress", {
              done: uploadDone,
              total: uploadTotal,
              noun,
              pct: aggregatePct,
            })}
          </p>
          <ul className="upload-list">
            {Object.entries(progress).map(([path, fp]) => (
              <li className="upload-item" key={path}>
                <span className="upload-path">{path}</span>
                <span className="upload-bar" aria-hidden>
                  <span
                    className="upload-bar-fill"
                    style={{
                      width: `${Math.round(
                        (fp.state === "done" ? 1 : fp.pct) * 100,
                      )}%`,
                    }}
                  />
                </span>
                <span className={`upload-state upload-state-${fp.state}`}>
                  {fp.state === "done"
                    ? "✓"
                    : fp.state === "error"
                      ? t("share.stateFailed")
                      : `${Math.round(fp.pct * 100)}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {uploadState === "error" && (
        <p className="upload-error" role="alert">
          {t("share.uploadFailed", { error: uploadError ?? "" })}{" "}
          <button type="button" className="share-retry" onClick={onUploadAndShare}>
            {t("share.retry")}
          </button>
        </p>
      )}

      {!shareUrl ? (
        <div className="share-actions">
          {fileCount > 0 && (
            <button
              type="button"
              className="share-btn"
              onClick={onUploadAndShare}
              disabled={uploadState === "uploading"}
            >
              {uploadState === "uploading" ? "Uploading…" : uploadLabel}
            </button>
          )}
          <button
            type="button"
            className="share-btn-secondary"
            onClick={onCreateShareLink}
            disabled={!hasContent || uploadState === "uploading"}
          >
            {metadataLabel}
          </button>
        </div>
      ) : (
        <div className="share-result">
          <p className={delivery ? "delivery-confirmed" : "metadata-only-note"}>
            {delivery
              ? t("share.resultDelivered", {
                  Plural,
                  noun,
                  date: new Date(delivery.expires_at).toLocaleDateString(),
                })
              : t("share.resultMetadata", { noun })}
          </p>
          <div className="share-out">
            <input className="share-url" readOnly value={shareUrl} />
            <button type="button" className="share-copy" onClick={onCopyLink}>
              {copied ? t("share.copied") : t("share.copy")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
