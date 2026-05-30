-- Attested Board — public board records (Stage A1 spine).
--
-- The board spine table. The canonical vocabulary is enforced HERE, at the DB
-- layer, by CHECK constraints — so a non-canonical surface_shape/intent cannot
-- be written even if application code is bypassed (gate 9A-13). This is the
-- third lock on the closed road (alongside the TypeScript union and the runtime
-- guards in lib/board/canonical.ts).
--
-- Boundary notes baked into the shape:
--   * owner_handle is PRIVATE (the owning auth identity). The public projection
--     (lib/board/project.ts) never emits it — only owner_public_ref is public.
--   * NO pack_id column. The universal identifier is record_id; pack_id is for
--     pack-backed artifacts only (Stage C), never forced onto a board row (9A-14).
--   * NO machine_readable_boundary column. The boundary is invariant across the
--     whole board (PX never sells/settles/recommends; owner controls the action),
--     so it is a code constant stamped by the projection — it cannot drift.

CREATE TABLE IF NOT EXISTS board_records (
  record_id           TEXT PRIMARY KEY,
  owner_handle        TEXT NOT NULL,                 -- PRIVATE: never served
  owner_public_ref    TEXT NOT NULL,
  surface_shape       TEXT NOT NULL
    CHECK (surface_shape IN ('offered', 'auction_like', 'matching', 'stand')),
  intent              TEXT NOT NULL
    CHECK (intent IN ('wanted', 'offered', 'ask')),
  category            TEXT,
  region              TEXT,
  title               TEXT NOT NULL,
  summary             TEXT,
  media_refs          TEXT,                          -- JSON array, nullable
  external_action_url TEXT,
  evidence_refs       TEXT,                          -- JSON array, nullable
  receipt_refs        TEXT,                          -- JSON array, nullable
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

-- Filter columns the board narrows on. Free-text stays in application code at
-- A1 scale; these indices are what the equality filters move onto in A2+.
CREATE INDEX IF NOT EXISTS idx_board_surface_shape ON board_records (surface_shape);
CREATE INDEX IF NOT EXISTS idx_board_intent        ON board_records (intent);
CREATE INDEX IF NOT EXISTS idx_board_category      ON board_records (category);
CREATE INDEX IF NOT EXISTS idx_board_created_at    ON board_records (created_at);
