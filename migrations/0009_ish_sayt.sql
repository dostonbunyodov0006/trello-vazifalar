-- 🖥 Вазифалар веб-сайти (Сардор ака ва Мурод ака учун) — логин/парол (Достон 2026-09-22).
-- Фақат ish_* жадваллари. Парол ҳеч қачон очиқ сақланмайди: PBKDF2-SHA256 (туз + такрор сони).

-- Кириш маълумотлари: логин → Telegram id (роль ва исм ish_azo дан олинади)
CREATE TABLE IF NOT EXISTS ish_kirish (
  login      TEXT    PRIMARY KEY,           -- кичик ҳарф: sardor, murod
  uid        INTEGER NOT NULL,
  hash       TEXT    NOT NULL,              -- hex
  tuz        TEXT    NOT NULL,              -- hex (salt)
  takror     INTEGER NOT NULL,              -- PBKDF2 iterations
  yangilandi TEXT    NOT NULL
);

-- Сессиялар: браузердаги cookie'нинг SHA-256 си (cookie ўзи базада сақланмайди)
CREATE TABLE IF NOT EXISTS ish_sessiya (
  token_hash TEXT    PRIMARY KEY,
  uid        INTEGER NOT NULL,
  muddat     TEXT    NOT NULL,              -- ISO: шу вақтгача амал қилади
  vaqt       TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ish_sessiya_uid ON ish_sessiya (uid);

-- Нотўғри уринишлар (логин ва IP бўйича): кўп бўлса — вақтинча блок
CREATE TABLE IF NOT EXISTS ish_urinish (
  kalit TEXT    PRIMARY KEY,                -- "login:sardor" | "ip:1.2.3.4"
  soni  INTEGER NOT NULL,
  bosh  TEXT    NOT NULL                    -- ISO: ҳисоб бошланган вақт
);
