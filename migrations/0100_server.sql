-- 🖥 Alohida server (trello.example.com) uchun qo'shimcha jadvallar. Cloudflare D1 da YO'Q —
-- faqat shu serverda. ish_* jadvallari o'zgarmaydi.

-- Telegram'ga ketgan (yoki SHADOW rejimida ketishi kerak bo'lgan) har bir chaqiriq.
-- shadow = 1 — Telegram'ga YUBORILMADI, faqat shu yerda saqlandi.
CREATE TABLE IF NOT EXISTS tg_outbox (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  vaqt     TEXT    NOT NULL,
  method   TEXT    NOT NULL,
  chat_id  TEXT,
  payload  TEXT    NOT NULL,                -- JSON (fayllar o'rniga faqat nomi/turi/hajmi)
  shadow   INTEGER NOT NULL,                -- 1 = yuborilmadi (SHADOW=1)
  ok       INTEGER,                         -- Telegram javobi (shadow'da NULL)
  javob    TEXT                             -- Telegram javobining qisqa matni
);
CREATE INDEX IF NOT EXISTS tg_outbox_vaqt ON tg_outbox (vaqt);

-- Kunlik cron belgisi: bir kunda bir marta (server qayta ishga tushsa ham ikki marta yubormaydi)
CREATE TABLE IF NOT EXISTS cron_run (
  nom      TEXT NOT NULL,                   -- "ish-0930"
  sana     TEXT NOT NULL,                   -- Toshkent sanasi YYYY-MM-DD
  boshlandi TEXT NOT NULL,
  tugadi   TEXT,
  natija   TEXT,
  PRIMARY KEY (nom, sana)
);

-- Botdagi odamlar ro'yxati («Kimga?» tanlovi va ruxsat): Cloudflare'da bu KV «app:roles».ismlar
-- va bot kodidagi ISM edi. Bu yerda — o'z jadvali (tools/odamlar.mjs bilan to'ldiriladi).
CREATE TABLE IF NOT EXISTS ish_odam (
  uid   INTEGER PRIMARY KEY,
  ism   TEXT    NOT NULL,
  bolim TEXT    NOT NULL DEFAULT '',
  vaqt  TEXT    NOT NULL
);
