-- Attested Board — owner publish lane: publication_state (Owner Board Publish v0).
--
-- The first OWNER-WRITE lane (A1 had a read surface only). An owner publishes
-- their own rows to the public board, and can retire (unpublish) them. That needs
-- exactly one new piece of stored state: whether a row is public or retired.
--
-- ★ Additive supersede only (no rebuild, no sealed migration rewritten). SQLite
-- ALTER TABLE ADD COLUMN carries a CHECK constraint, so the canonical lock pattern
-- (TS union + runtime guard + DB CHECK) holds for publication_state too — a row
-- can never be written with a state outside {public, retired} even if app code is
-- bypassed. The DEFAULT 'public' BACKFILLS every existing row (the seed) to public
-- in the same statement, so the read path keeps serving them unchanged.
--
-- updated_at already exists (from 0001) — the unpublish path stamps it; no column
-- is added for it here. The only new column is publication_state.

ALTER TABLE board_records
  ADD COLUMN publication_state TEXT NOT NULL DEFAULT 'public'
    CHECK (publication_state IN ('public', 'retired'));

-- The public read query filters on this column (WHERE publication_state = 'public'),
-- so it gets its own index alongside the other filter columns from 0001.
CREATE INDEX IF NOT EXISTS idx_board_publication_state ON board_records (publication_state);
