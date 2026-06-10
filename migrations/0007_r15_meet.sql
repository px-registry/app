-- R1.5 meet — the five-person test's server-side surface, ALL of it.
--
-- What the server may hold (constitution): the PUBLIC projection each owner
-- chose to publish, the 話してみる signal, the mutual-only contact note, and
-- the test-disclosed facilitator log (proposals + readings; the five testers
-- are told the facilitator reads these). NO private memory, NO raw owner
-- token, NO score/rank column anywhere.
--
-- participant_ref is an opaque server-derived hash of the owner's device-local
-- secret token. The token itself is NEVER stored (publish derives the ref and
-- drops the token); knowing a ref (they are visible in the pool) does not let
-- anyone write as that owner.

-- ── public projection (the candidate pool) ─────────────────────────────────────
CREATE TABLE r15_pool_item (
  participant_ref TEXT NOT NULL,
  display_name    TEXT NOT NULL,            -- owner-chosen public pseudonym
  kind            TEXT NOT NULL CHECK (kind IN ('have','want','avoid','memory')),
  title           TEXT NOT NULL,
  text            TEXT NOT NULL,
  tags            TEXT NOT NULL,            -- JSON array of strings
  position        INTEGER NOT NULL,         -- input order; arrival order only
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (participant_ref, position)
);

-- ── 話してみる (one-sided signal; shown to the receiver) ───────────────────────
CREATE TABLE r15_signal (
  from_ref      TEXT NOT NULL,
  to_ref        TEXT NOT NULL,
  from_name     TEXT NOT NULL,              -- sender's public pseudonym at send time
  anchor        TEXT NOT NULL DEFAULT '',   -- one short proposal anchor for context
  created_at    TEXT NOT NULL,
  PRIMARY KEY (from_ref, to_ref)
);

-- ── contact note (disclosed ONLY when the signal is mutual) ────────────────────
CREATE TABLE r15_contact_note (
  writer_ref  TEXT NOT NULL,
  peer_ref    TEXT NOT NULL,                -- the one party this note may be shown to
  note        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (writer_ref, peer_ref)
);

-- ── facilitator log (test-disclosed: proposals as received + owner readings) ───
CREATE TABLE r15_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_ref TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  question        TEXT NOT NULL DEFAULT '',
  proposal_text   TEXT NOT NULL,
  reading         TEXT NOT NULL DEFAULT '', -- JSON: owner's marks + free note
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
