-- R2 便3 — 0010 追補: 閉じの遷移元と宛先 pseudonym（docs/r2/0010 §2 追記参照）。
--
-- closed_from: T3/T4（sent から）と T5（mutual から）の表示文言が裁定で別語
-- （「このアンテナは止まっています。」／「このトークは閉じられました。」）のため、
-- 遷移元という**状態機械の事実**を残す。理由（なぜ）の列ではない — invariant 4
-- （reason 列を作らない）はそのまま。
--
-- to_name: 宛先の公開 pseudonym を送信時点で固定（from_name と同格・同じデータ階級）。
-- a 側の pair 面（mutual 後の前室）が、相手がプールを離脱しても名前を失わないため。
ALTER TABLE r15_edge ADD COLUMN closed_from TEXT NOT NULL DEFAULT '';
ALTER TABLE r15_edge ADD COLUMN to_name TEXT NOT NULL DEFAULT '';
