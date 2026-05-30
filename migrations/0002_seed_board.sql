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
   '[]', 'https://tidecraft.example/trade', '[]', '[]', '2026-05-10T11:00:00Z', '2026-05-10T11:00:00Z'),

  -- Launch demo seed (#5) — 5 beta boards (bonsai / designer / 3D / SE musician /
  -- restaurant), authored FROM lib/board/seed.ts. A LAUNCH DEMO SEED, not real
  -- consented beta-owner boards: `.example` domains + synthetic `auth:` handles, no
  -- fabricated activity (evidence/receipt refs empty). Canonical surface_shape only
  -- (no 'matching'); each board is a group of rows under one owner_public_ref.

  -- 1 — bonsai
  ('rec-aoi-bonsai-piece', 'auth:aoi-bonsai-3f21', 'Aoi Bonsai · aoi-bonsai.example', 'auction_like', 'offered', NULL, 'Kyoto',
   '一点物の黒松、入札で譲ります',
   '一点ものの黒松。入札を受け付けています。',
   '[]', 'https://aoi-bonsai.example/lots/black-pine', '[]', '[]', '2026-05-24T09:00:00Z', '2026-05-24T09:00:00Z'),

  ('rec-aoi-bonsai-care-ask', 'auth:aoi-bonsai-3f21', 'Aoi Bonsai · aoi-bonsai.example', 'stand', 'ask', NULL, NULL,
   '盆栽の手入れ相談、受けています',
   '植え替えや剪定の相談を受けています。',
   '[]', 'https://aoi-bonsai.example/care', '[]', '[]', '2026-05-16T10:00:00Z', '2026-05-16T10:00:00Z'),

  ('rec-aoi-bonsai-care-meet', 'auth:aoi-bonsai-3f21', 'Aoi Bonsai · aoi-bonsai.example', 'stand', 'wanted', NULL, 'Kyoto',
   '月一の手入れ会、一緒にやる方を探しています',
   '月に一度の手入れ会。一緒に手を動かす方を探しています。',
   '[]', 'https://aoi-bonsai.example/meetup', '[]', '[]', '2026-05-12T11:00:00Z', '2026-05-12T11:00:00Z'),

  -- 2 — designer
  ('rec-midori-logo', 'auth:midori-design-7a4c', 'Midori Design · midori-design.example', 'offered', 'offered', NULL, NULL,
   'ロゴ制作を受けています',
   '小さなお店やプロジェクトのロゴをつくっています。',
   '[]', 'https://midori-design.example/logo', '[]', '[]', '2026-05-26T09:30:00Z', '2026-05-26T09:30:00Z'),

  ('rec-midori-commission-wanted', 'auth:midori-design-7a4c', 'Midori Design · midori-design.example', 'offered', 'wanted', NULL, NULL,
   '限定の制作で組める方を探しています',
   '期間限定の制作で一緒に動けるイラストレーターを探しています。',
   '[]', 'https://midori-design.example/collab', '[]', '[]', '2026-05-17T13:00:00Z', '2026-05-17T13:00:00Z'),

  ('rec-midori-goods', 'auth:midori-design-7a4c', 'Midori Design · midori-design.example', 'offered', 'offered', NULL, 'Osaka',
   'オリジナル小物を販売しています',
   'ステッカーや栞などの小物を不定期に販売しています。',
   '[]', 'https://midori-design.example/goods', '[]', '[]', '2026-05-11T15:00:00Z', '2026-05-11T15:00:00Z'),

  -- 3 — 3D printer
  ('rec-hina-parts', 'auth:hina-fab-9c12', 'Hina Fabrication · hina-fab.example', 'offered', 'offered', NULL, NULL,
   '部品の制作・出力を受けています',
   'STLからの出力や試作の部品制作を受けています。',
   '[]', 'https://hina-fab.example/print', '[]', '[]', '2026-05-27T09:00:00Z', '2026-05-27T09:00:00Z'),

  ('rec-hina-modelfix-wanted', 'auth:hina-fab-9c12', 'Hina Fabrication · hina-fab.example', 'offered', 'wanted', NULL, NULL,
   'モデル修正を手伝える方を探しています',
   '出力前のモデル修正を手伝ってくれる方を探しています。',
   '[]', 'https://hina-fab.example/modelfix', '[]', '[]', '2026-05-14T13:00:00Z', '2026-05-14T13:00:00Z'),

  ('rec-hina-print-clinic', 'auth:hina-fab-9c12', 'Hina Fabrication · hina-fab.example', 'stand', 'ask', NULL, NULL,
   '出力の相談会、随時ひらいています',
   '素材や設定の相談会を随時ひらいています。',
   '[]', 'https://hina-fab.example/clinic', '[]', '[]', '2026-05-09T10:30:00Z', '2026-05-09T10:30:00Z'),

  -- 4 — SE musician
  ('rec-nagi-se', 'auth:nagi-sound-2b88', 'Nagi Sound · nagi-sound.example', 'offered', 'offered', NULL, NULL,
   '効果音の制作を受けています',
   'ゲームや映像向けの効果音を制作しています。',
   '[]', 'https://nagi-sound.example/se', '[]', '[]', '2026-05-28T09:00:00Z', '2026-05-28T09:00:00Z'),

  ('rec-nagi-soundpack', 'auth:nagi-sound-2b88', 'Nagi Sound · nagi-sound.example', 'offered', 'offered', NULL, NULL,
   '音素材を配布・販売しています',
   '環境音や効果音の素材をまとめて配布・販売しています。',
   '[]', 'https://nagi-sound.example/packs', '[]', '[]', '2026-05-13T14:30:00Z', '2026-05-13T14:30:00Z'),

  ('rec-nagi-gamemates', 'auth:nagi-sound-2b88', 'Nagi Sound · nagi-sound.example', 'stand', 'wanted', NULL, NULL,
   '一緒にゲームを作る仲間を募集しています',
   '個人制作のゲームで音まわりを一緒にやる仲間を募集しています。',
   '[]', 'https://nagi-sound.example/team', '[]', '[]', '2026-05-08T08:00:00Z', '2026-05-08T08:00:00Z'),

  -- 5 — restaurant
  ('rec-komorebi-event', 'auth:komorebi-6d55', 'Komorebi Kitchen · komorebi-kitchen.example', 'stand', 'offered', NULL, 'Kobe',
   '週末の間借りイベント、やっています',
   '週末だけの間借りキッチン。月替わりの料理を出しています。',
   '[]', 'https://komorebi-kitchen.example/events', '[]', '[]', '2026-05-29T17:00:00Z', '2026-05-29T17:00:00Z'),

  ('rec-komorebi-menu', 'auth:komorebi-6d55', 'Komorebi Kitchen · komorebi-kitchen.example', 'offered', 'offered', NULL, NULL,
   '季節の限定メニューを出しています',
   '季節の食材で限定メニューを不定期に出しています。',
   '[]', 'https://komorebi-kitchen.example/menu', '[]', '[]', '2026-05-15T12:00:00Z', '2026-05-15T12:00:00Z'),

  ('rec-komorebi-staff-wanted', 'auth:komorebi-6d55', 'Komorebi Kitchen · komorebi-kitchen.example', 'stand', 'wanted', NULL, 'Kobe',
   '週末の手伝いスタッフを募集しています',
   '週末の数時間、ホールを手伝ってくれる方を募集しています。',
   '[]', 'https://komorebi-kitchen.example/staff', '[]', '[]', '2026-05-07T16:00:00Z', '2026-05-07T16:00:00Z');
