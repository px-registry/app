// GET /api/download/{pack_id}/{path}
//
// Stream a delivered file back out of R2. Same-origin proxy so receivers can
// fetch + hash the bytes without any cross-origin/CORS setup; PX relays the
// bytes and never reads them. When DELIVERY_PUBLIC_BASE points at a public R2
// custom domain instead, this endpoint is unused (R2 serves the bytes directly).
//
// A missing object → 404. After the 30-day lifecycle rule deletes the bytes the
// object is simply gone, so an expired delivery also surfaces here as 404; the
// receiver UI additionally greys out downloads once the manifest's expiry passes.

import {
  type Env,
  CORS,
  deliveryKey,
  isPackId,
  isSafePath,
  joinPath,
  onRequestOptions,
} from "../../../_lib.ts";

export { onRequestOptions };

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { env, params } = ctx;
  const packId = String(params.pack_id);
  const path = joinPath(params.path as string | string[] | undefined);

  if (!isPackId(packId) || !isSafePath(path)) {
    return new Response("Bad request", { status: 400, headers: CORS });
  }

  const object = await env.DELIVERIES.get(deliveryKey(packId, path));
  if (!object) {
    return new Response("Not found or expired", { status: 404, headers: CORS });
  }

  const headers = new Headers(CORS);
  object.writeHttpMetadata(headers); // Content-Type, Cache-Control from upload
  headers.set("ETag", object.httpEtag);
  headers.set("Content-Length", String(object.size));

  // Prompt a save with the file's own name (last path segment), encoded safely.
  const filename = path.slice(path.lastIndexOf("/") + 1);
  const asciiName = filename.replace(/["\\\r\n]/g, "_");
  headers.set(
    "Content-Disposition",
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );

  return new Response(object.body, { status: 200, headers });
};
