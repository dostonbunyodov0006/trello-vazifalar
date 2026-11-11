-- 📊 Namuna (demo) ma'lumot. Haqiqiy baza bu yerda YO'Q — id lar ham, ismlar ham soxta.
-- Bo'sh bazani to'ldirish: avval 01-jadvallar.sql, keyin shu fayl (yoki `npm run import`).
-- ⚠️ Parol yo'q: login qatorlari bo'sh xesh bilan tushadi, parolni
--    `node tools/sayt-parol.mjs <login> <telegram_id>` bilan o'zingiz qo'yasiz.

-- ── Workspace ──
INSERT INTO ish_ws (id, nom) VALUES (1, 'BIGANT');

-- ── Doska ──
INSERT INTO ish_board (id, nom, tavsif, fon) VALUES (1, 'Асосий доска', 'Кундалик вазифалар', NULL);

-- ── Ustunlar ──
INSERT INTO ish_list (id, board_id, nom, tur, pos) VALUES (1, 1, 'Янги', '', 1024);
INSERT INTO ish_list (id, board_id, nom, tur, pos) VALUES (2, 1, 'Жараёнда', '', 2048);
INSERT INTO ish_list (id, board_id, nom, tur, pos) VALUES (3, 1, 'Бажарилди', 'done', 3072);

-- ── Belgilar ──
INSERT INTO ish_label (id, board_id, nom, rang) VALUES (1, 1, 'Шошилинч', '#E5484D');
INSERT INTO ish_label (id, board_id, nom, rang) VALUES (2, 1, 'Мижоз', '#3E8EDE');
INSERT INTO ish_label (id, board_id, nom, rang) VALUES (3, 1, 'Омбор', '#F2751A');
INSERT INTO ish_label (id, board_id, nom, rang) VALUES (4, 1, 'Ҳисобот', '#8E4EC6');

-- ── Namuna xodimlar (soxta Telegram id) ──
INSERT INTO ish_azo (ws_id, uid, rol, ism, bolim, tarif, faol) VALUES (1, 100000004, 'member', 'Ходим',  'dasturchi', 20000, 1);
INSERT INTO ish_azo (ws_id, uid, rol, ism, bolim, tarif, faol) VALUES (1, 100000002, 'owner',  'Раҳбар', '',          20000, 1);

-- ── Saytga kirish loginlari (parol keyin qo'yiladi) ──
INSERT INTO ish_kirish (login, uid) VALUES ('rahbar', 100000002);
INSERT INTO ish_kirish (login, uid) VALUES ('xodim', 100000004);
