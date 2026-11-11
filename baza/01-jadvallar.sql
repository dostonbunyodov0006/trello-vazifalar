-- 📊 Вазифалар (Trello) базаси — жадваллар ва индекслар
-- Cloudflare D1 «bigant» · олинган: 2026-11-09
-- Бу файл базани НОЛДАН тиклаш учун. Prod'га қўллаш керак эмас — у ерда аллақачон бор.

CREATE TABLE ish_azo (
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

CREATE TABLE ish_bildir (
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

CREATE TABLE ish_blob (
  id    TEXT PRIMARY KEY,
  bayt  BLOB NOT NULL,
  vaqt  TEXT NOT NULL
);

CREATE TABLE ish_board (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ws_id      INTEGER NOT NULL REFERENCES ish_ws(id),
  nom        TEXT    NOT NULL,
  tavsif     TEXT    NOT NULL DEFAULT '',
  pos        REAL    NOT NULL,
  yaratdi    INTEGER NOT NULL,
  vaqt       TEXT    NOT NULL,
  yangilandi TEXT    NOT NULL,
  arxiv      TEXT                             -- NULL = фаол
, fon TEXT);

CREATE TABLE ish_card (
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
, jarima INTEGER CHECK (jarima IS NULL OR jarima >= 0), jarima_kim INTEGER, jarima_vaqt TEXT, boshlanish TEXT, bonus INTEGER CHECK (bonus IS NULL OR bonus >= 0), bonus_kim INTEGER, bonus_vaqt TEXT, kimga2 INTEGER, kimga3 INTEGER, ijro TEXT);

CREATE TABLE ish_card_label (
  card_id  INTEGER NOT NULL REFERENCES ish_card(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES ish_label(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);

CREATE TABLE ish_checklist (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES ish_card(id) ON DELETE CASCADE,
  nom     TEXT    NOT NULL,
  pos     REAL    NOT NULL
);

CREATE TABLE ish_chk_item (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL REFERENCES ish_checklist(id) ON DELETE CASCADE,
  nom          TEXT    NOT NULL,
  bajarildi    INTEGER NOT NULL DEFAULT 0,
  pos          REAL    NOT NULL
);

CREATE TABLE ish_faol (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ws_id    INTEGER NOT NULL,
  board_id INTEGER,
  card_id  INTEGER,
  uid      INTEGER NOT NULL,
  amal     TEXT    NOT NULL,
  meta     TEXT    NOT NULL DEFAULT '{}',
  vaqt     TEXT    NOT NULL
);

CREATE TABLE ish_fayl (
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

CREATE TABLE ish_izoh (
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

CREATE TABLE ish_kirish (
  login      TEXT    PRIMARY KEY,           -- кичик ҳарф: sardor, murod
  uid        INTEGER NOT NULL,
  hash       TEXT    NOT NULL,              -- hex
  tuz        TEXT    NOT NULL,              -- hex (salt)
  takror     INTEGER NOT NULL,              -- PBKDF2 iterations
  yangilandi TEXT    NOT NULL
);

CREATE TABLE ish_label (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL REFERENCES ish_board(id),
  nom      TEXT    NOT NULL,
  rang     TEXT    NOT NULL,
  vaqt     TEXT    NOT NULL,
  UNIQUE (board_id, nom)
);

CREATE TABLE ish_list (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id   INTEGER NOT NULL REFERENCES ish_board(id),
  nom        TEXT    NOT NULL,
  tur        TEXT    NOT NULL DEFAULT '' CHECK (tur IN ('', 'done')),  -- done = «Бажарилди» устуни
  pos        REAL    NOT NULL,
  vaqt       TEXT    NOT NULL,
  yangilandi TEXT    NOT NULL,
  arxiv      TEXT
);

CREATE TABLE ish_sessiya (
  token_hash TEXT    PRIMARY KEY,
  uid        INTEGER NOT NULL,
  muddat     TEXT    NOT NULL,              -- ISO: шу вақтгача амал қилади
  vaqt       TEXT    NOT NULL
);

CREATE TABLE ish_takror (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ws_id INTEGER NOT NULL,
  board_id INTEGER NOT NULL,
  nom TEXT NOT NULL,
  tavsif TEXT NOT NULL DEFAULT '',
  kimga INTEGER NOT NULL,
  davr TEXT NOT NULL,                  -- kun | hafta | oy
  kuni INTEGER NOT NULL DEFAULT 1,     -- hafta: 1-7 (душанба=1), oy: 1-28
  muddat_kun INTEGER NOT NULL DEFAULT 0,  -- яратилган кундан неча кун кейин муддат
  faol INTEGER NOT NULL DEFAULT 1,
  yaratdi INTEGER NOT NULL,
  oxirgi TEXT,                         -- охирги марта қачон вазифа яратилган (YYYY-MM-DD)
  vaqt TEXT NOT NULL
);

CREATE TABLE ish_urinish (
  kalit TEXT    PRIMARY KEY,                -- "login:sardor" | "ip:1.2.3.4"
  soni  INTEGER NOT NULL,
  bosh  TEXT    NOT NULL                    -- ISO: ҳисоб бошланган вақт
);

CREATE TABLE ish_ws (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nom        TEXT    NOT NULL UNIQUE,         -- бир хил номли иккита workspace бўлмайди (биринчи кириш пойгаси)
  tavsif     TEXT    NOT NULL DEFAULT '',
  ega        INTEGER NOT NULL,               -- Telegram id
  vaqt       TEXT    NOT NULL,
  yangilandi TEXT    NOT NULL
);

CREATE INDEX ish_azo_uid ON ish_azo (uid);

CREATE INDEX ish_bildir_uid ON ish_bildir (uid, oqildi, id);

CREATE INDEX ish_board_ws ON ish_board (ws_id, arxiv, pos);

CREATE INDEX ish_card_board ON ish_card (board_id, ochirildi, arxiv);

CREATE INDEX ish_card_ijro_ix ON ish_card (ijro);

CREATE INDEX ish_card_kimga ON ish_card (kimga, ochirildi);

CREATE INDEX ish_card_label_l ON ish_card_label (label_id);

CREATE INDEX ish_card_list ON ish_card (list_id, ochirildi, pos);

CREATE INDEX ish_card_muddat ON ish_card (muddat, bajarildi);

CREATE INDEX ish_checklist_card ON ish_checklist (card_id, pos);

CREATE INDEX ish_chk_item_cl ON ish_chk_item (checklist_id, pos);

CREATE INDEX ish_faol_board ON ish_faol (board_id, id);

CREATE INDEX ish_faol_card ON ish_faol (card_id, id);

CREATE INDEX ish_fayl_card ON ish_fayl (card_id);

CREATE INDEX ish_izoh_card ON ish_izoh (card_id, id);

CREATE INDEX ish_list_board ON ish_list (board_id, arxiv, pos);

CREATE INDEX ish_sessiya_uid ON ish_sessiya (uid);

CREATE INDEX ish_takror_ws ON ish_takror (ws_id, faol);
