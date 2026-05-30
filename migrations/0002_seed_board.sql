-- Attested Board — seed records.
--
-- Authored FROM lib/board/seed.ts (the source of truth). A gate test asserts
-- every recordId in that module appears in this file, so the two cannot drift.
-- Every domain is a `.example` placeholder. media/evidence/receipt refs are
-- empty arrays in A1 (evidence/receipt begin to fill in Stage A2/D).

INSERT OR REPLACE INTO board_records
  (record_id, owner_handle, owner_public_ref, surface_shape, intent, category, region, title, summary, media_refs, external_action_url, evidence_refs, receipt_refs, created_at, updated_at)
VALUES
  ('rec-ito-notebook-edition', 'auth:ito-atelier-7f3a', 'Ito Atelier · ito-atelier.example', 'auction_like', 'offered', NULL, 'Kyoto',
   'Hand-bound notebook set, edition of seven',
   'Linen-thread binding on acid-free paper. Ships from Kyoto when bidding closes.',
   '[]', 'https://ito-atelier.example/lots/notebook-seven', '[]', '[]', '2026-05-20T09:00:00Z', '2026-05-20T09:00:00Z'),

  ('rec-kellner-radio-1962', 'auth:kellner-9b21', 'Kellner Repair · kellner.example', 'auction_like', 'offered', NULL, NULL,
   'Restored 1962 tabletop radio',
   'Chassis recapped, speaker reconditioned. In working order before it ships.',
   '[]', 'https://kellner.example/lots/radio-1962', '[]', '[]', '2026-05-25T18:30:00Z', '2026-05-25T18:30:00Z'),

  ('rec-mariko-stoneware-mug', 'auth:mariko-kiln-4d10', 'Mariko Kiln · mariko.example', 'offered', 'offered', 'sale', 'Kyoto',
   'Wheel-thrown mug, stoneware',
   'Thrown and glazed in small batches. Each one a little different.',
   '[]', 'https://mariko.example/shop/stoneware-mug', '[]', '[]', '2026-05-23T10:45:00Z', '2026-05-23T10:45:00Z'),

  ('rec-hansei-calling-cards', 'auth:hansei-press-1c88', 'Hansei Press · hansei-press.example', 'offered', 'offered', 'sale', NULL,
   'Letterpress calling cards, edition of fifty',
   'Hand-set metal type, printed on cotton stock. Fifty cards to an edition.',
   '[]', 'https://hansei-press.example/shop/calling-cards', '[]', '[]', '2026-05-22T14:00:00Z', '2026-05-22T14:00:00Z'),

  ('rec-hasegawa-knife-sharpening', 'auth:hasegawa-forge-6e52', 'Hasegawa Forge · hasegawa-forge.example', 'stand', 'offered', 'service', NULL,
   'Knife sharpening by post',
   'Send a blade; it comes back sharp. Turnaround about a week.',
   '[]', 'https://hasegawa-forge.example/sharpening', '[]', '[]', '2026-05-15T13:00:00Z', '2026-05-15T13:00:00Z'),

  ('rec-quiet-tapes-shop', 'auth:quiet-tapes-2a47', 'Quiet Tapes · quiet-tapes.example', 'stand', 'offered', 'music', NULL,
   'Quiet Tapes — standing catalogue',
   'A small label''s tapes and records, always open. New coastal recordings each season.',
   '[]', 'https://quiet-tapes.example/catalogue', '[]', '[]', '2026-05-05T16:20:00Z', '2026-05-05T16:20:00Z'),

  ('rec-morning-draft-readers', 'auth:morning-draft-8f0c', 'Morning Draft · morning-draft.example', 'stand', 'ask', 'writing', NULL,
   'Morning Draft — open call for reader notes',
   'A weekly letter on revising in the open, asking readers what a week of notes should change.',
   '[]', 'https://morning-draft.example/notes', '[]', '[]', '2026-05-18T05:00:00Z', '2026-05-18T05:00:00Z'),

  ('rec-hansei-press-operator', 'auth:hansei-press-1c88', 'Hansei Press · hansei-press.example', 'matching', 'wanted', 'matching', 'Kyoto',
   'Looking for a letterpress operator, two days a month',
   'A small studio looking for someone who knows platen presses. Quiet work, regular hours.',
   '[]', 'https://hansei-press.example/openings/operator', '[]', '[]', '2026-05-19T12:00:00Z', '2026-05-19T12:00:00Z'),

  ('rec-minato-darkroom-time', 'auth:minato-studio-3b9d', 'Minato Studio · minato-studio.example', 'matching', 'offered', 'matching', 'Kyoto',
   'Offering darkroom time, central Kyoto',
   'A shared darkroom with two enlargers, open to careful hands on weekday evenings.',
   '[]', 'https://minato-studio.example/darkroom', '[]', '[]', '2026-05-21T19:10:00Z', '2026-05-21T19:10:00Z'),

  ('rec-tidecraft-field-collab', 'auth:tidecraft-5c63', 'Tidecraft · tidecraft.example', 'matching', 'ask', 'matching', NULL,
   'Coastal field-recording trade — who''s nearby?',
   'Asking other recordists on the coast whether anyone wants to swap a season of tapes.',
   '[]', 'https://tidecraft.example/trade', '[]', '[]', '2026-05-10T11:00:00Z', '2026-05-10T11:00:00Z');
