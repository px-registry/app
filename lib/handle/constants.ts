// PX handle constants — ported from the px-box box-constants.js (read-only
// reference). A handle is the owner's subdomain label under px-registry.org, so
// the rules are DNS-shaped and the reserved set guards infra / auth / brand /
// impersonation names. Values mirror the px-box copy deliberately; they are the
// same namespace.

/** The parent domain a handle lives under: `${handle}.px-registry.org`. */
export const PX_REGISTRY_DOMAIN = "px-registry.org";

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 32;

// DNS-safe handle: lowercase letters, digits, hyphens. No leading/trailing
// hyphen. (Consecutive hyphens are rejected separately in validateHandle.)
export const HANDLE_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

// Reserved subdomain names: infra / auth / marketing / impersonation-risk
// words. Not exhaustive; additions are cheap, removals should be deliberate.
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  // Infrastructure
  "www", "api", "app", "apps", "mail", "webmail", "smtp", "pop", "imap",
  "ftp", "ns", "ns1", "ns2", "dns", "vpn", "proxy", "cdn", "assets",
  "static", "media", "img", "images", "files", "download", "downloads",
  // Service naming
  "px", "pxbox", "box", "boxes", "lighthouse", "registry", "official",
  "home", "index", "public",
  // Auth / account
  "login", "logout", "signin", "signout", "signup", "register",
  "account", "accounts", "profile", "settings", "dashboard", "admin",
  "administrator", "root", "sudo", "sys", "sysop", "superuser", "operator",
  "moderator", "mod", "staff", "support", "help", "helpdesk", "team",
  "security", "auth", "oauth", "password", "verify", "verified",
  // Meta
  "search", "explore", "discover", "trending", "popular", "new", "latest",
  // Legal / info
  "about", "legal", "privacy", "terms", "tos", "policy", "pricing",
  "contact", "docs", "doc", "blog", "news", "press", "status",
  // Commerce-abuse
  "pay", "payment", "payments", "billing", "invoice", "invoices",
  "checkout", "cart", "shop", "store", "buy", "sell", "deal", "deals",
  "offer", "offers", "discount", "sale", "free", "bonus",
  // Stopwords / placeholders
  "null", "undefined", "none", "nil", "test", "testing", "demo", "example",
  "sample", "placeholder", "localhost", "local",
]);
