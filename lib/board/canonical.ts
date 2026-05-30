// Attested Board — canonical vocabulary (Phase 9A, fixed).
//
// This is the spine's closed road. surface_shape (3) and intent (3) are the
// ONLY public board vocabulary. They do not grow: the strategy may say
// "sale/auction", but the public/canonical mapping is fixed —
//   sale  → offered
//   auction → auction_like   (never bare "auction"/"オークション" in public copy)
//
// ★ Canonical narrowing: "matching" was removed from surface_shape (4 → 3). It is
// NOT a placement ("what to put"); it is a WORKING — how wanted meets offered/ask.
// That working is carried by the intent axis + owner-side proposals (B+1), never
// a PX-central surface or recommendation. The board avoids the dating-app
// "マッチング" reading; meeting becomes "your AI surfaces candidates / people
// gather / the owner approves and connects with existing tools".
//
// New public kinds (ticket/rental/local, GPT's collaborate/hire/sell/bid, …) are
// NOT added here. The closed set is enforced three ways: this type, the runtime
// guards below, and a CHECK constraint in the D1 migration.
//
// ★ Boundary note: leaf module. Relative imports only, no "@/*", no React, no
// Cloudflare globals — so the Pages Function bundle (esbuild, no alias) and the
// app/test layers can all import it unchanged.

/** surface_shape — how the activity is shaped. Strict, 3 values, never extended.
 *  ("matching" was narrowed out — it is a working carried by intent + proposals,
 *  not a surface placement.) */
export const SURFACE_SHAPES = ["offered", "auction_like", "stand"] as const;
export type SurfaceShape = (typeof SURFACE_SHAPES)[number];

/** intent — an independent axis (what the owner is doing). 3 values. */
export const INTENTS = ["wanted", "offered", "ask"] as const;
export type Intent = (typeof INTENTS)[number];

const SURFACE_SET: ReadonlySet<string> = new Set(SURFACE_SHAPES);
const INTENT_SET: ReadonlySet<string> = new Set(INTENTS);

export function isSurfaceShape(v: unknown): v is SurfaceShape {
  return typeof v === "string" && SURFACE_SET.has(v);
}
export function isIntent(v: unknown): v is Intent {
  return typeof v === "string" && INTENT_SET.has(v);
}

/**
 * The machine-readable boundary — PX's role, stamped on every board record.
 *
 * This is MATERIAL, not judgment: it states what PX does NOT do, so a later
 * external AI / verifier reading a PX record can see the boundary mechanically.
 * It is invariant across the whole board (PX never sells, settles, recommends;
 * the owner controls the action everywhere), so it is a constant — not per-row
 * data that could drift. The public projection stamps it on every record.
 */
export interface MachineReadableBoundary {
  pxDoesNotSell: true;
  pxDoesNotSettle: true;
  pxDoesNotRecommend: true;
  ownerControlsAction: true;
}

export const MACHINE_READABLE_BOUNDARY: MachineReadableBoundary = Object.freeze({
  pxDoesNotSell: true,
  pxDoesNotSettle: true,
  pxDoesNotRecommend: true,
  ownerControlsAction: true,
});
