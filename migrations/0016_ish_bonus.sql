-- 📋 Вазифалар: БОНУС — вазифа ўз вақтида бажарилса, Сардор ака ёки Мурод ака қўлда ёзади.
-- NULL — бонус ёзилмаган. Жарима билан бир хил тартибда (0008_ish_jarima).
ALTER TABLE ish_card ADD COLUMN bonus INTEGER CHECK (bonus IS NULL OR bonus >= 0);
ALTER TABLE ish_card ADD COLUMN bonus_kim INTEGER;
ALTER TABLE ish_card ADD COLUMN bonus_vaqt TEXT;
