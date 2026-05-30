-- Attested Board — transaction events (Stage A2).
--
-- The record chain for a listing: contact → handoff draft → owner declaration →
-- receipt ref. EVENT MATERIAL ONLY. The kind column is CHECK-pinned to the four
-- non-judgment kinds — there is no completed/settled/paid/safe status, because
-- PX does not decide whether a transaction succeeded.
--
-- ★ No message body, no PII: there is deliberately NO column for body, message,
-- email, phone, counterparty_name, or counterparty_contact. PX does not hold the
-- message body (§1). `ref` is an opaque declaration id or a sanitized
-- owner-controlled URL (handoff draft) — never free-form contact content.

CREATE TABLE IF NOT EXISTS transaction_events (
  event_id          TEXT PRIMARY KEY,        -- opaque, public-safe
  listing_record_id TEXT NOT NULL,           -- the BoardRecordV1 this belongs to
  kind              TEXT NOT NULL
    CHECK (kind IN ('contact_opened', 'handoff_draft_created',
                    'owner_declaration_created', 'receipt_ref_attached')),
  ref               TEXT,                     -- opaque declaration id OR sanitized URL
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_txevent_listing ON transaction_events (listing_record_id);
CREATE INDEX IF NOT EXISTS idx_txevent_created ON transaction_events (created_at);
