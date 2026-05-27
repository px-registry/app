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
}) {
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
      <h2 className="compose-sub-h">Share</h2>

      {uploadState !== "done" && (
        <p className="delivery-articulation">
          PX briefly relays your files to delivery storage. PX does not read file
          contents. They are held for 30 days, then automatically deleted —
          long-term storage is not PX&rsquo;s role. The receiver verifies each
          file against its hash.
        </p>
      )}

      {/* Per-file upload progress. */}
      {uploadState === "uploading" && (
        <div className="upload-progress">
          <p className="compose-note">
            Relaying {uploadDone}/{uploadTotal} file(s) to delivery storage… (
            {aggregatePct}%)
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
                      ? "failed"
                      : `${Math.round(fp.pct * 100)}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {uploadState === "error" && (
        <p className="upload-error" role="alert">
          Upload failed: {uploadError}. Nothing was shared.{" "}
          <button type="button" className="share-retry" onClick={onUploadAndShare}>
            Try again
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
              {uploadState === "uploading"
                ? "Uploading…"
                : "Upload & create share link"}
            </button>
          )}
          <button
            type="button"
            className="share-btn-secondary"
            onClick={onCreateShareLink}
            disabled={!hasContent || uploadState === "uploading"}
          >
            Share file list only (no upload)
          </button>
        </div>
      ) : (
        <div className="share-result">
          <p className={delivery ? "delivery-confirmed" : "metadata-only-note"}>
            {delivery ? (
              <>
                Files uploaded. This link delivers the bytes and expires{" "}
                {new Date(delivery.expires_at).toLocaleDateString()} (30 days).
                The receiver downloads and verifies each file.
              </>
            ) : (
              <>
                Metadata-only link — the file list and hashes travel in the URL;
                no bytes were uploaded.
              </>
            )}
          </p>
          <div className="share-out">
            <input className="share-url" readOnly value={shareUrl} />
            <button type="button" className="share-copy" onClick={onCopyLink}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
