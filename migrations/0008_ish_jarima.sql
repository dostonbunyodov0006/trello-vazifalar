-- 📋 Вазифалар: жаримани Сардор ака ёки Мурод ака ҚЎЛДА ёзади (Достон 2026-09-22).
-- NULL — жарима ёзилмаган. Кечиккан кунлар × тариф — фақат таклиф (иловада олдиндан ёзилиб туради).
ALTER TABLE ish_card ADD COLUMN jarima INTEGER CHECK (jarima IS NULL OR jarima >= 0);
ALTER TABLE ish_card ADD COLUMN jarima_kim INTEGER;
ALTER TABLE ish_card ADD COLUMN jarima_vaqt TEXT;
