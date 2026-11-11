-- 📋 Вазифалар: битта вазифа — хоҳлаганча ходимга (Достон 2026-10-06).
-- ijro — бажарувчилар рўйхати, ",uid,uid," кўринишида (қидириш учун иккала четида ҳам вергул).
-- kimga аввалгидек биринчи (асосий) бажарувчи бўлиб қолади — тариф ўшанга қараб олинади.
ALTER TABLE ish_card ADD COLUMN ijro TEXT;
UPDATE ish_card SET ijro = ',' ||
  COALESCE(kimga, '') ||
  CASE WHEN kimga2 IS NOT NULL THEN ',' || kimga2 ELSE '' END ||
  CASE WHEN kimga3 IS NOT NULL THEN ',' || kimga3 ELSE '' END || ','
WHERE kimga IS NOT NULL;
CREATE INDEX IF NOT EXISTS ish_card_ijro_ix ON ish_card (ijro);
