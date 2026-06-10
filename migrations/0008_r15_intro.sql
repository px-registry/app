-- R1.5 第7便 B — ひとこと紹介 (owner-written one-liner, OPTIONAL).
-- Same standing as display_name: part of the owner-chosen PUBLIC projection,
-- published only when the owner presses 候補に出す. Empty = not set.
ALTER TABLE r15_pool_item ADD COLUMN intro TEXT NOT NULL DEFAULT '';
