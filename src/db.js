// src/db.js — SQLite fayli (node:sqlite) ustida Cloudflare D1 bilan bir xil API.
// api.js va boshqa modullar D1 uslubida yozilgan: prepare().bind().first()/all()/run(), batch().
// Shu o'ram tufayli biznes kodi o'zgarmadi.
//
// batch() — bitta tranzaksiya, SINXRON bajariladi: orada boshqa so'rov "tiqilib" qolmaydi.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MIGRATSIYA_PAPKA = fileURLToPath(new URL("../migrations/", import.meta.url));

const qiymat = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

/** D1 ga o'xshash ob'ekt. fayl — ":memory:" yoki /data/trello.sqlite */
export function bazaOch(fayl = ":memory:") {
  if (fayl !== ":memory:") fs.mkdirSync(path.dirname(fayl), { recursive: true });
  const db = new DatabaseSync(fayl);
  db.exec("PRAGMA busy_timeout = 5000;");
  if (fayl !== ":memory:") db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  const kesh = new Map();
  const st = (sql) => { let s = kesh.get(sql); if (!s) { s = db.prepare(sql); if (kesh.size > 500) kesh.clear(); kesh.set(sql, s); } return s; };

  const runSync = (sql, a) => { const r = st(sql).run(...a); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; };
  const tayyorla = (sql, args = []) => {
    const a = args.map(qiymat);
    return {
      bind: (...b) => tayyorla(sql, b),
      all: async () => ({ success: true, results: st(sql).all(...a), meta: {} }),
      first: async (col) => { const r = st(sql).get(...a); if (r === undefined) return null; return col ? r[col] : r; },
      run: async () => runSync(sql, a),
      raw: async () => st(sql).all(...a).map((r) => Object.values(r)),
      __sql: sql, __args: a, __runSync: () => runSync(sql, a),
    };
  };
  return {
    db,
    prepare: (sql) => tayyorla(sql),
    batch: async (stmts) => {
      db.exec("BEGIN IMMEDIATE");
      try { const r = stmts.map((s) => s.__runSync()); db.exec("COMMIT"); return r; }
      catch (e) { try { db.exec("ROLLBACK"); } catch { /* yo'q */ } throw e; }
    },
    exec: async (sql) => { db.exec(sql); return { count: 1, duration: 0 }; },
    yop: () => db.close(),
  };
}

/** Migratsiyalarni tartib bilan qo'llaydi (har biri bir marta; _migratsiya jadvalida qayd). */
export function migratsiya(DB, papka = MIGRATSIYA_PAPKA) {
  const db = DB.db;
  db.exec("CREATE TABLE IF NOT EXISTS _migratsiya (nom TEXT PRIMARY KEY, vaqt TEXT NOT NULL)");
  const bor = new Set(db.prepare("SELECT nom FROM _migratsiya").all().map((r) => r.nom));
  const qollandi = [];
  for (const f of fs.readdirSync(papka).filter((x) => x.endsWith(".sql")).sort()) {
    if (bor.has(f)) continue;
    const sql = fs.readFileSync(path.join(papka, f), "utf8");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO _migratsiya (nom, vaqt) VALUES (?, ?)").run(f, new Date().toISOString());
      db.exec("COMMIT");
      qollandi.push(f);
    } catch (e) { db.exec("ROLLBACK"); throw new Error(`migratsiya ${f}: ${e.message}`); }
  }
  return qollandi;
}
