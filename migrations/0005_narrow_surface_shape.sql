-- Attested Board — canonical narrowing: remove "matching" from surface_shape.
--
-- surface_shape goes 4 → 3 (offered / auction_like / stand). intent is unchanged.
-- "matching" was never a placement; it is a WORKING (how wanted meets offered/ask),
-- now carried by the intent axis + owner-side proposals (B+1) — not a PX surface.
--
-- SQLite/D1 cannot ALTER a CHECK in place, so this is a table REBUILD. A rebuild
-- is NOT a sealed violation: the sealed guarantee is the schema's logical
-- invariants, not the physical table. The only logical change here is the
-- surface_shape CHECK (4 → 3); every other column, type, and constraint is copied
-- byte-for-byte from 0001, and record_id is preserved (A2 transaction/declaration
-- reference listings by record_id). board_records has no foreign keys.
--
-- Order matters: remap "matching" rows to "stand" WHILE the old CHECK still
-- permits both, THEN rebuild with the narrowed CHECK.

-- 1. Remap every matching row to stand, preserving intent (§3 default rule:
--    matching+wanted→stand+wanted, matching+offered→stand+offered, matching+ask→stand+ask).
--    'stand' is allowed by the old (4-value) CHECK, so this UPDATE is legal pre-rebuild.
UPDATE board_records SET surface_shape = 'stand', updated_at = updated_at
  WHERE surface_shape = 'matching';

-- 2. Drop the board seed's own category="matching" so the board is 100%
--    matching-free (Axis 1). Scoped to the seed record_ids by explicit id — never
--    a blanket change, so a user row referencing the (retained) register category
--    is left untouched.
UPDATE board_records SET category = NULL
  WHERE record_id IN (
    'rec-hansei-press-operator',
    'rec-minato-darkroom-time',
    'rec-tidecraft-field-collab'
  ) AND category = 'matching';

-- 3. Rebuild with the narrowed surface_shape CHECK. intent CHECK and all other
--    columns are identical to 0001.
CREATE TABLE board_records_new (
  record_id           TEXT PRIMARY KEY,
  owner_handle        TEXT NOT NULL,
  owner_public_ref    TEXT NOT NULL,
  surface_shape       TEXT NOT NULL
    CHECK (surface_shape IN ('offered', 'auction_like', 'stand')),
  intent              TEXT NOT NULL
    CHECK (intent IN ('wanted', 'offered', 'ask')),
  category            TEXT,
  region              TEXT,
  title               TEXT NOT NULL,
  summary             TEXT,
  media_refs          TEXT,
  external_action_url TEXT,
  evidence_refs       TEXT,
  receipt_refs        TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

-- 4. Explicit column copy — NO SELECT *. Every column carried over; none dropped
--    (record_id, receipt_refs, evidence_refs, external_action_url, owner_handle,
--    timestamps all preserved).
INSERT INTO board_records_new
  (record_id, owner_handle, owner_public_ref, surface_shape, intent, category, region,
   title, summary, media_refs, external_action_url, evidence_refs, receipt_refs,
   created_at, updated_at)
SELECT
  record_id, owner_handle, owner_public_ref, surface_shape, intent, category, region,
  title, summary, media_refs, external_action_url, evidence_refs, receipt_refs,
  created_at, updated_at
FROM board_records;

-- 5. Swap.
DROP TABLE board_records;
ALTER TABLE board_records_new RENAME TO board_records;

-- 6. Recreate the indices (identical to 0001).
CREATE INDEX IF NOT EXISTS idx_board_surface_shape ON board_records (surface_shape);
CREATE INDEX IF NOT EXISTS idx_board_intent        ON board_records (intent);
CREATE INDEX IF NOT EXISTS idx_board_category      ON board_records (category);
CREATE INDEX IF NOT EXISTS idx_board_created_at    ON board_records (created_at);
