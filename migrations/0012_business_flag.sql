-- R2 0012 — ビジネス旗（docs/r2/0012-business-flag.md・ゲート通過 2026-06-12）。
-- boolean 一枚で打ち止め: 第二の旗は列の追加＝STOP②＋追補一行対話を物理的に要求する。
-- 旗は項目に付く — 人に付かない。PX は判定・絞込・順位付けに使わない（serve は素通し）。
ALTER TABLE r15_pool_item ADD COLUMN business INTEGER NOT NULL DEFAULT 0;
