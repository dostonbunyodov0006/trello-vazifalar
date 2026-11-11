// test/import.test.js — tools/import.mjs: 02-malumot.sql va keyingi to'liq eksport, takroriy yuklash xavfsiz.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { bazaOch, migratsiya } from "../src/db.js";
import { importla, bol } from "../tools/import.mjs";
import { fetchTut, sora, SARDOR } from "./yordam.js";

const MALUMOT = fs.readFileSync(new URL("../baza/02-malumot.sql", import.meta.url), "utf8");
const sanoq = (DB, j) => DB.db.prepare(`SELECT COUNT(*) AS n FROM ${j}`).get().n;
const jim = { log: () => {} };

test("bol(): satr ichidagi ; va izohlar buyruqni bo'lmaydi", () => {
  const r = bol("-- izoh; bu yerda\nINSERT INTO a VALUES ('x;y', 'it''s');\n/* ; */ INSERT INTO b VALUES (1);");
  assert.equal(r.length, 2);
  assert.match(r[0], /'x;y'/);
});

test("02-malumot.sql: yuklanadi, ikki marta yuklansa ham bir xil; yetishmagan ustunlar to'ldiriladi", () => {
  const DB = bazaOch(":memory:"); migratsiya(DB);
  const r1 = importla(DB, MALUMOT, jim);
  assert.deepEqual(r1.hisob, { ish_board: 1, ish_list: 3, ish_label: 4, ish_azo: 2, ish_kirish: 2, ish_ws: 1 });
  assert.equal(r1.ogoh.length, 2, "ikkala login uchun parol ogohlantirishi");
  importla(DB, MALUMOT, jim);
  for (const [j, n] of [["ish_ws", 1], ["ish_board", 1], ["ish_list", 3], ["ish_label", 4], ["ish_azo", 2], ["ish_kirish", 2]]) assert.equal(sanoq(DB, j), n, j);
  const ws = DB.db.prepare("SELECT * FROM ish_ws").get();
  assert.equal(ws.nom, "BIGANT");
  assert.equal(ws.ega, 100000002);
  const k = DB.db.prepare("SELECT * FROM ish_kirish WHERE login = 'rahbar'").get();
  assert.equal(k.hash, "");
  assert.equal(k.uid, 100000002);
});

test("parol (sayt-parol.mjs) qo'yilgandan keyin qayta yuklash xeshni o'chirmaydi", () => {
  const DB = bazaOch(":memory:"); migratsiya(DB);
  importla(DB, MALUMOT, jim);
  DB.db.prepare("UPDATE ish_kirish SET hash = 'abc', tuz = 'def', takror = 20000 WHERE login = 'rahbar'").run();
  importla(DB, MALUMOT, jim);
  assert.equal(DB.db.prepare("SELECT hash FROM ish_kirish WHERE login = 'rahbar'").get().hash, "abc");
});

test("yuklangan ma'lumot bilan API ishlaydi: mavjud doska ishlatiladi, yangisi yaratilmaydi", async () => {
  fetchTut();
  const DB = bazaOch(":memory:"); migratsiya(DB);
  importla(DB, MALUMOT, jim);
  const env = { BOT_TOKEN: "123456789:AAFakeTokenForTestsOnly_abcdefghijk", DB, FILES_DIR: "/tmp/yoq" };
  const b = await sora(env, SARDOR, "/boards");
  assert.equal(b.ok, true);
  assert.equal(b.boards.length, 1);
  assert.equal(b.boards[0].nom, "Асосий доска");
  const d = await sora(env, SARDOR, `/boards/${b.boards[0].id}`);
  assert.deepEqual(d.lists.map((l) => l.nom), ["Янги", "Жараёнда", "Бажарилди"]);
  assert.equal(sanoq(DB, "ish_board"), 1);
});

// wrangler d1 export / sqlite3 .dump uslubidagi fayl: CREATE TABLE, ustun nomlarisiz INSERT, BLOB, boshqa bo'lim jadvali
const EKSPORT = `PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE osh_ovoz (id INTEGER PRIMARY KEY, uid INTEGER);
INSERT INTO "osh_ovoz" VALUES(1, 5);
CREATE TABLE ish_ws (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT NOT NULL UNIQUE, tavsif TEXT NOT NULL DEFAULT '', ega INTEGER NOT NULL, vaqt TEXT NOT NULL, yangilandi TEXT NOT NULL);
INSERT INTO "ish_ws" VALUES(1,'BIGANT','',100000002,'2026-09-22T05:00:00.000Z','2026-09-22T05:00:00.000Z');
CREATE TABLE ish_card (id INTEGER PRIMARY KEY AUTOINCREMENT, board_id INTEGER NOT NULL, list_id INTEGER NOT NULL, nom TEXT NOT NULL, tavsif TEXT NOT NULL DEFAULT '', pos REAL NOT NULL, muhim TEXT NOT NULL DEFAULT 'medium', yaratdi INTEGER NOT NULL, kimga INTEGER, muddat TEXT, tarif INTEGER NOT NULL DEFAULT 0, vaqt TEXT NOT NULL, yangilandi TEXT NOT NULL, bajarildi TEXT, arxiv TEXT, ochirildi INTEGER NOT NULL DEFAULT 0, ver INTEGER NOT NULL DEFAULT 1, jarima INTEGER, jarima_kim INTEGER, jarima_vaqt TEXT, boshlanish TEXT, bonus INTEGER, bonus_kim INTEGER, bonus_vaqt TEXT, kimga2 INTEGER, kimga3 INTEGER, ijro TEXT);
INSERT INTO "ish_card" VALUES(7,1,1,'Hisobot; tayyorlash','it''s ok',1024.0,'high',100000002,111222333,'2026-11-12',20000,'2026-11-09T05:00:00.000Z','2026-11-09T05:00:00.000Z',NULL,NULL,0,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,',111222333,');
INSERT INTO "ish_blob" ("id","bayt","vaqt") VALUES('aabbccddeeff00112233aabb',X'FFD8FF01','2026-11-09T05:00:00.000Z');
`;

test("to'liq eksport --toza: eski ma'lumot o'chadi, yangisi yuklanadi; boshqa bo'limlar o'tkazib yuboriladi", () => {
  const DB = bazaOch(":memory:"); migratsiya(DB);
  importla(DB, MALUMOT, jim);
  DB.db.prepare("INSERT INTO ish_card (board_id, list_id, nom, pos, yaratdi, vaqt, yangilandi) VALUES (1, 1, 'shadow nusxa', 1, 1, 'x', 'x')").run();
  const r = importla(DB, MALUMOT + "\n" + EKSPORT, { toza: true, ...jim });
  assert.equal(r.otdi.osh_ovoz, 1);
  assert.equal(sanoq(DB, "ish_card"), 1);
  const c = DB.db.prepare("SELECT * FROM ish_card").get();
  assert.equal(c.id, 7);
  assert.equal(c.nom, "Hisobot; tayyorlash");
  assert.equal(c.tavsif, "it's ok");
  assert.equal(c.ijro, ",111222333,");
  assert.deepEqual([...DB.db.prepare("SELECT bayt FROM ish_blob").get().bayt], [0xff, 0xd8, 0xff, 0x01]);
  // AUTOINCREMENT davom etadi (keyingi karta 8)
  DB.db.prepare("INSERT INTO ish_card (board_id, list_id, nom, pos, yaratdi, vaqt, yangilandi) VALUES (1, 1, 'yangi', 1, 1, 'x', 'x')").run();
  assert.equal(DB.db.prepare("SELECT MAX(id) AS m FROM ish_card").get().m, 8);
  // takroriy yuklash
  importla(DB, EKSPORT, jim);
  assert.equal(sanoq(DB, "ish_card"), 2);
});

test("--sinov hech narsa yozmaydi", () => {
  const DB = bazaOch(":memory:"); migratsiya(DB);
  const r = importla(DB, MALUMOT, { sinov: true, ...jim });
  assert.equal(r.hisob.ish_list, 3);
  assert.equal(sanoq(DB, "ish_list"), 0);
});
