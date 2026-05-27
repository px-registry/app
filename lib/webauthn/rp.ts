// Relying Party id resolution.
//
// The rpId must be a registrable suffix of the page's effective domain. For PX
// the owner identity lives across the whole px-registry.org family
// (app.px-registry.org for the app, <handle>.px-registry.org for owners), so we
// scope passkeys to the parent domain "px-registry.org" — one credential, valid
// across the family.
//
// Local dev is the exception: Chromium permits rpId "localhost" as a special
// case but rejects raw IPs, so serve dev from http://localhost:<port> (not
// 127.0.0.1). Pure function of the hostname so it is trivially testable.

// Relative (not "@/...") import: the Pages Functions bundle these modules with
// esbuild, which does not understand the tsconfig "@/*" path alias.
import { PX_REGISTRY_DOMAIN } from "../handle/index.ts";

export function getWebAuthnRpId(hostname: string): string {
  const host = (hostname || "").split(":")[0].toLowerCase();
  if (host === "localhost") return "localhost";
  // Any host within the px-registry.org family (app., <handle>., or the apex)
  // scopes to the parent domain.
  if (host === PX_REGISTRY_DOMAIN || host.endsWith(`.${PX_REGISTRY_DOMAIN}`)) {
    return PX_REGISTRY_DOMAIN;
  }
  // A *.pages.dev preview (or any other host): rpId is that exact host. A
  // credential enrolled there is scoped to that host, which is correct.
  return host;
}
