-- 📋 Вазифалар (Trello каби) — Workspace → Board → Устун → Карточка (Достон 2026-09-22).
-- Тўлиқ АЛОҲИДА бўлим: фақат «ish_» бошланадиган янги жадваллар. Ошхона, бонус, омбор,
-- Ўрикзор жадвалларига ва эски «app:tasks» (src/app/vazifa.js) га тегилмайди.
--
-- Бизнес қоидалари:
--   • Вазифани owner/admin (Сардор ака, Мурод ака) беради — битта ходимга.
--   • Муддат ўтса — кечиккан ҳар кун × ходимнинг тарифи (ҳозирча 20 000 сўм) жарима.
--   • Ҳолат — карточка турган УСТУНдан (tur = 'done' устунга тушса — бажарилди).
--   • Бажарилганлар эртасидан доскада кўринмайди — архивда қолади.
-- Тартиб: pos REAL (қўшниларнинг ўртаси) — бутун устунни қайта рақамлаш шарт эмас.
-- Ўчириш: асосан архив/юмшоқ ўчириш; CASCADE фақат карточканинг ички қисмлари учун.

CREATE TABLE IF NOT EXISTS ish_ws (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nom        TEXT    NOT NULL UNIQUE,         -- бир хил номли иккита workspace бўлмайди (биринчи кириш пойгаси)
  tavsif     TEXT    NOT NULL DEFAULT '',
  ega        INTEGER NOT NULL,               -- Telegram id
  vaqt       TEXT    NOT NULL,
  yangilandi TEXT    NOT NULL
);

-- Аъзолар: ким, қайси ролда. Исм/бўлим/тариф — шу workspace ичидаги маълумот
CREATE TABLE IF NOT EXISTS ish_azo (
  ws_id    INTEGER NOT NULL REFERENCES ish_ws(id),
  uid      INTEGER NOT NULL,
  rol      TEXT    NOT NULL DEFAULT 'member' CHECK (rol IN ('owner', 'admin', 'member')),
  ism      TEXT    NOT NULL,
  bolim    TEXT    NOT NULL DEFAULT '',
  tarif    INTEGER NOT NULL DEFAULT 20000 CHECK (tarif >= 0),
  faol     INTEGER NOT NULL DEFAULT 1,       -- 0 = чиқарилган (эски ёзувлари учун исми қолади)
  qoshildi TEXT    NOT NULL,
  PRIMARY KEY (ws_id, uid)
);
CREATE INDEX IF NOT EXISTS ish_azo_uid ON ish_azo (uid);

CREATE TABLE IF NOT EXISTS ish_board (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ws_id      INTEGER NOT NULL REFERENCES ish_ws(id),
  nom        TEXT    NOT NULL,
  tavsif     TEXT    NOT NULL DEFAULT '',
  pos        REAL    NOT NULL,
  yaratdi    INTEGER NOT NULL,
  vaqt       TEXT    NOT NULL,
  yangilandi TEXT    NOT NULL,
  arxiv      TEXT                             -- NULL = фаол
);
CREATE INDEX IF NOT EXISTS ish_board_ws ON ish_board (ws_id, arxiv, pos);

CREATE TABLE IF NOT EXISTS ish_list (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id   INTEGER NOT NULL REFERENCES ish_board(id),
  nom        TEXT    NOT NULL,
  tur        TEXT    NOT NULL DEFAULT '' CHECK (tur IN ('', 'done')),  -- done = «Бажарилди» устуни
  pos        REAL    NOT NULL,
  vaqt       TEXT    NOT NULL,
  yangilandi TEXT    NOT NULL,
  arxiv      TEXT
);
CREATE INDEX IF NOT EXISTS ish_list_board ON ish_list (board_id, arxiv, pos);

CREATE TABLE IF NOT EXISTS ish_card (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id   INTEGER NOT NULL REFERENCES ish_board(id),
  list_id    INTEGER NOT NULL REFERENCES ish_list(id),
  nom        TEXT    NOT NULL,
  tavsif     TEXT    NOT NULL DEFAULT '',
  pos        REAL    NOT NULL,
  muhim      TEXT    NOT NULL DEFAULT 'medium' CHECK (muhim IN ('low', 'medium', 'high', 'urgent')),
  yaratdi    INTEGER NOT NULL,
  kimga      INTEGER,                         -- битта ходим (ish_azo.uid)
  muddat     TEXT,                            -- 2026-09-22 — шу кунгача
  tarif      INTEGER NOT NULL DEFAULT 0 CHECK (tarif >= 0),  -- берилган пайтдаги жарима/кун
  vaqt       TEXT    NOT NULL,
  yangilandi TEXT    NOT NULL,
  bajarildi  TEXT,                            -- done устунга тушган вақт
  arxiv      TEXT,
  ochirildi  INTEGER NOT NULL DEFAULT 0,
  ver        INTEGER NOT NULL DEFAULT 1       -- бир вақтда ўзгартиришдан ҳимоя
);
CREATE INDEX IF NOT EXISTS ish_card_list ON ish_card (list_id, ochirildi, pos);
CREATE INDEX IF NOT EXISTS ish_card_board ON ish_card (board_id, ochirildi, arxiv);
CREATE INDEX IF NOT EXISTS ish_card_kimga ON ish_card (kimga, ochirildi);
CREATE INDEX IF NOT EXISTS ish_card_muddat ON ish_card (muddat, bajarildi);

CREATE TABLE IF NOT EXISTS ish_label (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL REFERENCES ish_board(id),
  nom      TEXT    NOT NULL,
  rang     TEXT    NOT NULL,
  vaqt     TEXT    NOT NULL,
  UNIQUE (board_id, nom)
);
CREATE TABLE IF NOT EXISTS ish_card_label (
  card_id  INTEGER NOT NULL REFERENCES ish_card(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES ish_label(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);
CREATE INDEX IF NOT EXISTS ish_card_label_l ON ish_card_label (label_id);

CREATE TABLE IF NOT EXISTS ish_checklist (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES ish_card(id) ON DELETE CASCADE,
  nom     TEXT    NOT NULL,
  pos     REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS ish_checklist_card ON ish_checklist (card_id, pos);
CREATE TABLE IF NOT EXISTS ish_chk_item (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL REFERENCES ish_checklist(id) ON DELETE CASCADE,
  nom          TEXT    NOT NULL,
  bajarildi    INTEGER NOT NULL DEFAULT 0,
  pos          REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS ish_chk_item_cl ON ish_chk_item (checklist_id, pos);

CREATE TABLE IF NOT EXISTS ish_izoh (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id   INTEGER NOT NULL REFERENCES ish_card(id) ON DELETE CASCADE,
  uid       INTEGER NOT NULL,
  matn      TEXT    NOT NULL,
  kalit     TEXT,                              -- иккинчи марта юборилса — такрорланмасин
  vaqt      TEXT    NOT NULL,
  tahrir    TEXT,
  ochirildi TEXT,
  UNIQUE (card_id, kalit)
);
CREATE INDEX IF NOT EXISTS ish_izoh_card ON ish_izoh (card_id, id);

-- Файллар: жойи «saqlash.js» ҳал қилади (kalit = «t:<telegram file_id>» ёки «d:<ish_blob.id>»)
CREATE TABLE IF NOT EXISTS ish_fayl (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id   INTEGER NOT NULL REFERENCES ish_card(id) ON DELETE CASCADE,
  izoh_id   INTEGER REFERENCES ish_izoh(id),
  nom       TEXT    NOT NULL,
  kalit     TEXT    NOT NULL,
  mime      TEXT    NOT NULL,
  hajm      INTEGER NOT NULL,
  yukladi   INTEGER NOT NULL,
  vaqt      TEXT    NOT NULL,
  ochirildi TEXT
);
CREATE INDEX IF NOT EXISTS ish_fayl_card ON ish_fayl (card_id);
CREATE TABLE IF NOT EXISTS ish_blob (
  id    TEXT PRIMARY KEY,
  bayt  BLOB NOT NULL,
  vaqt  TEXT NOT NULL
);

-- Фаоллик тарихи (аудит)
CREATE TABLE IF NOT EXISTS ish_faol (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ws_id    INTEGER NOT NULL,
  board_id INTEGER,
  card_id  INTEGER,
  uid      INTEGER NOT NULL,
  amal     TEXT    NOT NULL,
  meta     TEXT    NOT NULL DEFAULT '{}',
  vaqt     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ish_faol_card ON ish_faol (card_id, id);
CREATE INDEX IF NOT EXISTS ish_faol_board ON ish_faol (board_id, id);

-- Илова ичидаги билдиришномалар (Telegram'га ҳам боради). kalit — эслатма такрорланмаслиги учун
CREATE TABLE IF NOT EXISTS ish_bildir (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  uid     INTEGER NOT NULL,
  ws_id   INTEGER NOT NULL,
  card_id INTEGER,
  tur     TEXT    NOT NULL,
  matn    TEXT    NOT NULL,
  kalit   TEXT,
  oqildi  INTEGER NOT NULL DEFAULT 0,
  vaqt    TEXT    NOT NULL,
  UNIQUE (uid, kalit)
);
CREATE INDEX IF NOT EXISTS ish_bildir_uid ON ish_bildir (uid, oqildi, id);
