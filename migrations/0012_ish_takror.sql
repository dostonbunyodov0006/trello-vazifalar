-- 🔁 Такрорланувчи вазифалар: ҳар куни крон шу жадвалдан янги вазифа яратади
CREATE TABLE IF NOT EXISTS ish_takror (
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
CREATE INDEX IF NOT EXISTS ish_takror_ws ON ish_takror (ws_id, faol);
