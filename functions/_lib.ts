// Shared helpers for the delivery Functions. The leading underscore keeps this
// file from being routed — Pages only routes files that do not start with "_".
//
// Delivery custody in one place: PX relays a send-a-pack's file bytes through
// these Functions into R2, which holds them for TTL_DAYS and then deletes them
// (a lifecycle rule on the bucket enforces the deletion — these Functions only
// stream bytes and never read or parse them).

export interface Env {
  /** R2 bucket bound in wrangler.toml ([[r2_buckets]] binding = "DELIVERIES"). */
  DELIVERIES: R2Bucket;
  /**
   * Optional. When set (e.g. "https://files.px-registry.org"), downloads are
   * pointed straight at a public R2 custom domain (zero egress). When unset,
   * downloads route through the same-origin /api/download proxy below.
   */
  DELIVERY_PUBLIC_BASE?: string;
}

/** How long bytes are held before the lifecycle rule deletes them. */
export const TTL_DAYS = 30;

/** Per-file size ceiling. Beyond this, the sender gets a clear error, not a
 *  half-written object. Multipart/larger files are a later phase. */
export const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

const HEX64 = /^[0-9a-f]{64}$/;

/** A pack_id is the lowercase-hex SHA-256 that prefixes every delivery key. */
export function isPackId(s: string): boolean {
  return HEX64.test(s);
}

/**
 * Validate a pack-relative path the same way the manifest does (pack-spec §5):
 * relative, "/"-separated, no empty/"."/".." segments. Rejecting ".." here is
 * what stops a key from escaping its pack_id prefix in R2.
 */
export function isSafePath(p: string): boolean {
  if (!p || p.startsWith("/")) return false;
  return p.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}

/** R2 object key for a file: "{pack_id}/{path}". Deterministic, prefix-scoped. */
export function deliveryKey(packId: string, path: string): string {
  return `${packId}/${path}`;
}

/** Join a catch-all `params.path` (string | string[]) back into one path. */
export function joinPath(path: string | string[] | undefined): string {
  if (Array.isArray(path)) return path.join("/");
  return path ?? "";
}

/** ISO instant when custody ends — informational; deletion is the lifecycle rule. */
export function expiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + TTL_DAYS * 86_400_000).toISOString();
}

/**
 * The browser-effective origin of a request. The app's canonical host
 * (app.px-registry.org) is fronted by the px-registry.org zone router, which
 * proxies to the Pages origin — so the Function's own URL/Host can read as
 * *.pages.dev while the request really arrived at app.px-registry.org. We honor
 * X-Forwarded-Host / X-Forwarded-Proto when the router supplies them, then fall
 * back to the Host header, then the URL. This keeps the download base in a new
 * manifest pointed at the brand host the sender actually used. (Requests made
 * directly to *.pages.dev or localhost have no forwarded headers, so the origin
 * resolves to that same host — unchanged behavior.)
 */
export function effectiveOrigin(request: Request): string {
  const url = new URL(request.url);
  const fwdHost = request.headers.get("X-Forwarded-Host");
  const host = fwdHost
    ? fwdHost.split(",")[0].trim()
    : request.headers.get("Host") || url.host;
  const fwdProto = request.headers.get("X-Forwarded-Proto");
  const proto = fwdProto
    ? fwdProto.split(",")[0].trim()
    : url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/**
 * The absolute download base for a pack: "{root}/{pack_id}/". `root` is the
 * public R2 custom domain when configured, else this deployment's own
 * /api/download proxy (derived from the request's effective origin so the
 * manifest is self-describing — and brand-symmetric — wherever it is opened).
 */
export function downloadBase(env: Env, request: Request, packId: string): string {
  const root = (
    env.DELIVERY_PUBLIC_BASE || `${effectiveOrigin(request)}/api/download`
  ).replace(/\/+$/, "");
  return `${root}/${packId}/`;
}

/** Permissive CORS so a browser on any origin can PUT/GET. Same-origin in the
 *  app's own flow, but a future cross-origin composer should work too. */
export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/** Preflight handler shared by both endpoints. */
export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: CORS });
