-- R1.5 第9便 C — 気配: how many AIs read a placed question TODAY.
-- COUNT-ONLY by design: no viewer column exists. Each serve writes one
-- day-scoped, one-way dedup token (sha-256 of day:viewer:owner:position) —
-- the same viewer on the same day collapses to one row, so the count is an
-- honest 人数, while nothing here lists or recovers who read whom.
-- No score, no rank; a per-day fact.
CREATE TABLE r15_question_serve (
  owner_ref TEXT NOT NULL,    -- participant_ref of the QUESTION's owner
  position  INTEGER NOT NULL, -- the served item's position in that projection
  day       TEXT NOT NULL,    -- YYYY-MM-DD (UTC)
  dedup     TEXT NOT NULL,    -- opaque one-way token (never a viewer id)
  PRIMARY KEY (owner_ref, position, day, dedup)
);
