// Unit tests for the owner-publish input validator. Run with `node --test`.
//
// Pure, no D1: proves the body allowlist + canonical 3×3 + structural minimum +
// payload caps, and — critically — that identity-bearing and out-of-scope body
// fields are IGNORED, never surfaced into a validated row.

import { test } from "node:test";
import assert from "node:assert/strict";

import { validatePublishInput, PUBLISH_CAPS } from "./owner-publish.ts";

const link = { kind: "public_external_link", externalActionUrl: "https://aoi.example/contact" };

function goodBody(overrides: Record<string, unknown> = {}) {
  return {
    boardTitle: "Aoi Bonsai — spring stand",
    rows: [{ surfaceShape: "stand", intent: "wanted", title: "Looking for shohin pots" }],
    contact: link,
    ...overrides,
  };
}

test("OBP-impl-1: a valid minimal body passes; the contact URL is applied to each row", () => {
  const v = validatePublishInput(goodBody());
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(v.rows.length, 1);
  assert.equal(v.rows[0].surfaceShape, "stand");
  assert.equal(v.rows[0].intent, "wanted");
  assert.equal(v.rows[0].title, "Looking for shohin pots");
  assert.equal(v.rows[0].externalActionUrl, "https://aoi.example/contact");
});

test("OBP-impl-2: structural minimum is re-checked — title, rows, contact each required", () => {
  assert.deepEqual(validatePublishInput(goodBody({ boardTitle: "   " })), { ok: false, reason: "title_required" });
  assert.deepEqual(validatePublishInput(goodBody({ rows: [] })), { ok: false, reason: "rows_required" });
  assert.deepEqual(validatePublishInput(goodBody({ contact: undefined })), { ok: false, reason: "contact_required" });
  assert.deepEqual(validatePublishInput(null), { ok: false, reason: "empty_body" });
});

test("OBP-impl-3: canonical 3×3 — a non-canonical surface_shape or intent is rejected", () => {
  assert.deepEqual(
    validatePublishInput(goodBody({ rows: [{ surfaceShape: "matching", intent: "wanted", title: "x" }] })),
    { ok: false, reason: "non_canonical" },
  );
  assert.deepEqual(
    validatePublishInput(goodBody({ rows: [{ surfaceShape: "stand", intent: "buy", title: "x" }] })),
    { ok: false, reason: "non_canonical" },
  );
});

test("OBP-impl-4: payload caps reject oversized input before any row is built", () => {
  const many = Array.from({ length: PUBLISH_CAPS.maxRows + 1 }, () => ({
    surfaceShape: "stand",
    intent: "wanted",
    title: "row",
  }));
  assert.deepEqual(validatePublishInput(goodBody({ rows: many })), { ok: false, reason: "too_many_rows" });
  assert.deepEqual(
    validatePublishInput(goodBody({ boardTitle: "a".repeat(PUBLISH_CAPS.maxBoardTitleLen + 1) })),
    { ok: false, reason: "title_too_long" },
  );
  assert.deepEqual(
    validatePublishInput(goodBody({ rows: [{ surfaceShape: "stand", intent: "wanted", title: "a".repeat(PUBLISH_CAPS.maxTitleLen + 1) }] })),
    { ok: false, reason: "row_title_too_long" },
  );
  assert.deepEqual(
    validatePublishInput(goodBody({ rows: [{ surfaceShape: "stand", intent: "wanted", title: "ok", summary: "a".repeat(PUBLISH_CAPS.maxSummaryLen + 1) }] })),
    { ok: false, reason: "summary_too_long" },
  );
  assert.deepEqual(
    validatePublishInput(goodBody({ contact: { kind: "public_external_link", externalActionUrl: "https://x.example/" + "a".repeat(PUBLISH_CAPS.maxUrlLen) } })),
    { ok: false, reason: "url_too_long" },
  );
});

test("OBP-impl-5: manual_copy contact is present with no action URL", () => {
  const v = validatePublishInput(goodBody({ contact: { kind: "manual_copy" } }));
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.ok(!("externalActionUrl" in v.rows[0]));
});

test("OBP-impl-6: an unsafe contact URL is dropped (fail-closed), contact still present", () => {
  const v = validatePublishInput(goodBody({ contact: { kind: "public_external_link", externalActionUrl: "javascript:alert(1)" } }));
  assert.equal(v.ok, true); // kind is set → contact present; the link is just omitted
  if (!v.ok) return;
  assert.ok(!("externalActionUrl" in v.rows[0]));
  assert.ok(!JSON.stringify(v.rows).includes("javascript:"));
});

test("OBP-impl-7: an unknown contact kind is rejected", () => {
  assert.deepEqual(validatePublishInput(goodBody({ contact: { kind: "px_inbox" } })), { ok: false, reason: "invalid_contact" });
});

test("OBP-impl-8: identity + out-of-scope body fields are IGNORED, never surfaced", () => {
  const v = validatePublishInput(
    goodBody({
      // identity the server owns — must not be read
      owner_handle: "mallory",
      owner_public_ref: "Spoofed Ref",
      record_id: "rec-existing-victim",
      credential: "auth:secret",
      // out-of-scope fields — Minimal first-write does not accept these
      rows: [
        {
          surfaceShape: "stand",
          intent: "wanted",
          title: "ok",
          mediaRefs: [{ kind: "image", url: "https://x.example/p.jpg" }],
          paymentHandOffKind: "external_payment_link",
          category: "audio",
          region: "JP",
          record_id: "rec-row-victim",
        },
      ],
    }),
  );
  assert.equal(v.ok, true);
  if (!v.ok) return;
  const row = v.rows[0];
  // Only the four allowlisted row fields (+ derived url) ever appear.
  assert.deepEqual(Object.keys(row).sort(), ["externalActionUrl", "intent", "surfaceShape", "title"].sort());
  const dump = JSON.stringify(v);
  for (const leaked of ["mallory", "Spoofed Ref", "rec-existing-victim", "rec-row-victim", "auth:secret", "mediaRefs", "external_payment_link", "audio"]) {
    assert.ok(!dump.includes(leaked), `must not surface ${leaked}`);
  }
});

test("OBP-impl-9: a blank or non-string row title is rejected (existence, not quality)", () => {
  assert.deepEqual(validatePublishInput(goodBody({ rows: [{ surfaceShape: "stand", intent: "wanted", title: "  " }] })), { ok: false, reason: "invalid_row" });
  assert.deepEqual(validatePublishInput(goodBody({ rows: [{ surfaceShape: "stand", intent: "wanted", title: 5 }] })), { ok: false, reason: "invalid_row" });
});
