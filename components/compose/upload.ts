// Upload relay (sender → delivery storage).
//
// Each file is PUT to /api/upload/{pack_id}/{path}; the Function streams it into
// R2 and PX holds it for 30 days. We use XMLHttpRequest (not fetch) purely for
// its upload-progress events, so the sender sees per-file progress. The content
// pack_id is computed before any upload and used as the storage prefix, so the
// share link's identity is fixed before a single byte leaves the browser.
//
// Requests are same-origin and relative ("/api/..."). The canonical surface,
// app.px-registry.org, is fronted by the px-registry.org zone router, which now
// forwards every method (GET for navigation, PUT/POST for the /api Functions) to
// the Pages deployment — so a relative PUT reaches the upload Function whether
// the page is served from app.px-registry.org, a *.pages.dev preview, or
// localhost. The Function reflects the request's own host into the download base
// it returns, keeping the manifest self-describing wherever it was composed.

import type { PxDelivery } from "@/lib/pack/index.ts";
import type { FileState } from "./types.ts";

export type UploadItem = { fullPath: string; blob: Blob };
type UploadResponse = {
  ok: boolean;
  base: string;
  expires_at: string;
  error?: string;
};

/** Encode a pack-relative path for a URL, segment by segment (spaces, unicode). */
export const encodeSegments = (p: string): string =>
  p.split("/").map(encodeURIComponent).join("/");

function putWithProgress(
  url: string,
  blob: Blob,
  onProgress: (pct: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResponse);
        } catch {
          reject(new Error("Upload response was not readable"));
        }
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try {
          const j = JSON.parse(xhr.responseText) as UploadResponse;
          if (j?.error) msg = j.error;
        } catch {
          /* non-JSON error body */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(blob);
  });
}

export async function uploadAll(
  packId: string,
  items: UploadItem[],
  onItemProgress: (fullPath: string, pct: number, state: FileState) => void,
  concurrency = 6,
): Promise<PxDelivery> {
  let base = "";
  let expires_at = "";
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const it = items[next++];
      const url = `/api/upload/${packId}/${encodeSegments(it.fullPath)}`;
      onItemProgress(it.fullPath, 0, "uploading");
      try {
        const res = await putWithProgress(url, it.blob, (p) =>
          onItemProgress(it.fullPath, p, "uploading"),
        );
        base = res.base;
        expires_at = res.expires_at;
        onItemProgress(it.fullPath, 1, "done");
      } catch (err) {
        onItemProgress(it.fullPath, 0, "error");
        throw err;
      }
    }
  }
  const pool = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(pool);
  return { base, expires_at };
}
