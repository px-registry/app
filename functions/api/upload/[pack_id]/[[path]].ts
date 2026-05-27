// PUT /api/upload/{pack_id}/{path}
//
// Relay a single file's bytes into delivery storage. The body is streamed
// straight into R2 — PX never buffers or reads the contents, it only passes
// them through. The object lands at key "{pack_id}/{path}" and is deleted by
// the bucket's 30-day lifecycle rule.
//
// The sender computes the content pack_id locally (it is the SHA-256 of the
// manifest, with no delivery field), then uploads each file under that prefix
// and embeds the returned base + expiry into the share link. Receivers verify
// every downloaded file against the manifest hash, so this endpoint does not
// need to hash anything — it is a dumb, honest relay.

import {
  type Env,
  CORS,
  MAX_BYTES,
  deliveryKey,
  downloadBase,
  expiresAt,
  isPackId,
  isSafePath,
  joinPath,
  json,
  onRequestOptions,
} from "../../../_lib.ts";

export { onRequestOptions };

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const { request, env, params } = ctx;
  const packId = String(params.pack_id);
  const path = joinPath(params.path as string | string[] | undefined);

  if (!isPackId(packId)) return json({ ok: false, error: "bad pack_id" }, 400);
  if (!isSafePath(path)) return json({ ok: false, error: "bad path" }, 400);

  // Enforce the size ceiling up front from the declared length. A browser PUT
  // of a Blob/File always sets Content-Length, so a missing one is suspect.
  const declared = request.headers.get("content-length");
  if (declared === null) {
    return json({ ok: false, error: "Content-Length required" }, 411);
  }
  const size = Number(declared);
  if (!Number.isFinite(size) || size < 0) {
    return json({ ok: false, error: "bad Content-Length" }, 400);
  }
  if (size > MAX_BYTES) {
    return json(
      { ok: false, error: `file exceeds ${MAX_BYTES} bytes`, max_bytes: MAX_BYTES },
      413,
    );
  }
  if (!request.body) return json({ ok: false, error: "empty body" }, 400);

  const key = deliveryKey(packId, path);
  await env.DELIVERIES.put(key, request.body, {
    httpMetadata: {
      contentType:
        request.headers.get("content-type") || "application/octet-stream",
      // Bytes are immutable for their lifetime under a content-addressed prefix.
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { pack_id: packId },
  });

  const base = downloadBase(env, request.url, packId);
  return json({
    ok: true,
    key,
    path,
    base,
    url: base + path.split("/").map(encodeURIComponent).join("/"),
    expires_at: expiresAt(),
  });
};
