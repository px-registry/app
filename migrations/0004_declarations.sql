-- Attested Board — owner declarations (Stage A2).
--
-- The owner's own statement that an event (a handoff, an exchange) took place.
-- MATERIAL, not judgment: the kind is CHECK-pinned to neutral nouns — never
-- "completed"/"settled"/"paid"/"safe". PX records that the owner declared it; it
-- does not verify or settle anything.
--
-- Boundary, mirroring A1:
--   * owner_handle is PRIVATE (the declaring owner's auth identity). The public
--     read path SELECTs explicit columns and never returns it; only
--     owner_public_ref (a non-reversible display label) is public.
--   * declaration_id is an opaque, public-safe token — it is what fills
--     BoardRecordV1.receiptRefs, and it cannot be reversed to the owner.
--   * NO body/PII columns (no message, email, phone, counterparty).

CREATE TABLE IF NOT EXISTS declarations (
  declaration_id    TEXT PRIMARY KEY,         -- opaque, public-safe (→ receiptRefs)
  owner_handle      TEXT NOT NULL,            -- PRIVATE: never served
  listing_record_id TEXT NOT NULL,
  owner_public_ref  TEXT NOT NULL,
  kind              TEXT NOT NULL
    CHECK (kind IN ('handoff', 'exchange')),
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_declaration_listing ON declarations (listing_record_id);
