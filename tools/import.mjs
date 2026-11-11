// tools/import.mjs — Cloudflare D1 dan olingan .sql faylni shu server bazasiga yuklash.
//
//   node tools/import.mjs baza/02-malumot.sql            # boshlang'ich ma'lumot (doska, ustunlar, a'zolar, loginlar)
//   node tools/import.mjs eksport.sql --toza             # cut-over: ish_* jadvallarini tozalab, YANGI eksportni yuklash
//   node tools/import.mjs eksport.sql --sinov            # hech narsa yozmaydi, faqat nima bo'lishini ko'rsatadi
//
// Qanday fayllarni tushunadi:
//   • baza/02-malumot.sql — ustunlari to'liq bo'lmagan INSERT'lar (vaqt, pos, hash... yo'q) — yetishmaganlari to'ldiriladi;
//   • `wrangler d1 export bigant --remote --table ish_card ... --output x.sql` yoki `sqlite3 .dump` natijasi —
//     CREATE TABLE + INSERT (ustun nomlari bilan yoki nomsiz).
// Faqat ish_* jadvallari olinadi; boshqa bo'limlarning jadvallari (osh_*, bonus_*, urik_* ...) o'tkazib yuboriladi.
//
// Takroriy yuklash xavfsiz (idempotent): har bir qator birlamchi kalit bo'yicha UPSERT qilinadi —
// faylda BOR ustunlar yangilanadi, YO'Q ustunlar (masalan, sayt-parol.mjs bilan qo'yilgan parol xeshi) tegilmaydi.
// Server ishlab turgan bo'lsa ham bo'ladi, lekin cut-over'da avval `docker compose stop trello` tavsiya etiladi.
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { bazaOch, migratsiya } from "../src/db.js";
import { sozlamaOl } from "../src/env.js";
import { RAHBARLAR } from "../src/ish/sozlama.js";

/** SQL matnini alohida buyruqlarga bo'lish (satr ichidagi ; va izohlarni hisobga oladi) */
export function bol(sql) {
  const ro = [];
  let bosh = 0, i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (c === "'" || c === '"' || c === "`") {
      const q = c; i++;
      while (i < n) { if (sql[i] === q) { if (sql[i + 1] === q) { i += 2; continue; } break; } i++; }
      i++; continue;
    }
    if (c === "[") { while (i < n && sql[i] !== "]") i++; i++; continue; }
    if (c === "-" && sql[i + 1] === "-") { const j = sql.indexOf("\n", i); const oxir = j < 0 ? n : j; sql = sql.slice(0, i) + " ".repeat(oxir - i) + sql.slice(oxir); i = oxir; continue; }
    if (c === "/" && sql[i + 1] === "*") { const j = sql.indexOf("*/", i + 2); const oxir = j < 0 ? n : j + 2; sql = sql.slice(0, i) + " ".repeat(oxir - i) + sql.slice(oxir); i = oxir; continue; }
    if (c === ";") { const s = sql.slice(bosh, i).trim(); if (s) ro.push(s); bosh = i + 1; }
    i++;
  }
  const s = sql.slice(bosh).trim(); if (s) ro.push(s);
  return ro;
}

const ID = String.raw`["\`\[]?(\w+)["\`\]]?`;
const INSERT_RE = new RegExp(String.raw`^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(?:\w+\.)?${ID}\s*(?:\(([^)]*)\))?\s*VALUES\s*([\s\S]+)$`, "i");
const CREATE_RE = new RegExp(String.raw`^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${ID}`, "i");
const ustunNom = (s) => s.split(",").map((x) => x.trim().replace(/^["`\[]|["`\]]$/g, "")).filter(Boolean);

// Birinchi owner (asl wsTayyorla() kabi: RAHBARLAR kalitlari son tartibida)
const EGA = Number(Object.keys(RAHBARLAR).find((id) => RAHBARLAR[id].rol === "owner"));
let WS_ID = 1;

/** Yetishmagan NOT NULL ustun uchun qiymat (02-malumot.sql da vaqt, pos, hash va h.k. yo'q) */
function standart(jadval, ustun, tur, hozir, tartib) {
  if (ustun === "hash") return "";                 // parol yo'q — tools/sayt-parol.mjs bilan qo'yiladi; bo'sh xesh bilan kirib bo'lmaydi
  if (ustun === "tuz") return "00".repeat(16);
  if (ustun === "takror") return 20000;
  if (ustun === "ega" || ustun === "yaratdi" || ustun === "uid") return EGA;
  if (ustun === "pos") return 1024 * (tartib + 1);
  if (ustun === "ws_id") return WS_ID;                // 02-malumot.sql: ish_board da ws_id yo'q — yagona workspace'niki
  if (/^(vaqt|yangilandi|qoshildi|bosh|muddat)$/.test(ustun)) return hozir;
  return /INT|REAL|NUM/i.test(tur) ? 0 : "";
}

export function importla(DB, sql, { toza = false, sinov = false, log = console.log } = {}) {
  const db = DB.db;
  const jadvallar = new Map();   // ish_* → { ustunlar: [{name,type,notnull,dflt,pk}] }
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'ish\\_%' ESCAPE '\\'").all()) {
    if (name === "ish_odam") continue;   // Cloudflare'da yo'q — tools/odamlar.mjs
    jadvallar.set(name, db.prepare(`PRAGMA table_info(${name})`).all());
  }
  const qoralama = new DatabaseSync(":memory:");   // fayldagi CREATE TABLE lar va VALUES ni SQLite'ning o'zi o'qishi uchun
  const hozir = new Date().toISOString();
  const hisob = {}; const otdi = {}; const ogoh = [];
  const tartib = {};
  const ishlar = [];

  for (const st of bol(sql)) {
    const cm = st.match(CREATE_RE);
    if (cm) { try { qoralama.exec(st); } catch { /* boshqa bo'limning g'alati sxemasi — muhim emas */ } continue; }
    const m = st.match(INSERT_RE);
    if (!m) continue;
    const [, jadval, ustS, qiymatS] = m;
    if (!jadvallar.has(jadval)) { otdi[jadval] = (otdi[jadval] || 0) + 1; continue; }
    let ustunlar = ustS ? ustunNom(ustS) : null;
    if (!ustunlar) {
      let info = [];
      try { info = qoralama.prepare(`PRAGMA table_info("${jadval}")`).all(); } catch { info = []; }
      ustunlar = (info.length ? info : jadvallar.get(jadval)).map((x) => x.name);
    }
    let qatorlar;
    try { qatorlar = qoralama.prepare("VALUES " + qiymatS).all().map((r) => Object.values(r)); }
    catch (e) { throw new Error(`${jadval}: qiymatlarni o'qib bo'lmadi (${e.message}): ${st.slice(0, 120)}`); }
    for (const q of qatorlar) ishlar.push({ jadval, ustunlar, q });
  }

  // Yagona workspace (BIGANT) ning id si: fayldagi ish_ws qatoridan, bo'lmasa bazadagidan, bo'lmasa 1
  {
    const w = ishlar.find((x) => x.jadval === "ish_ws");
    const bazada = db.prepare("SELECT id FROM ish_ws ORDER BY id LIMIT 1").get();
    WS_ID = w && w.ustunlar.includes("id") ? Number(w.q[w.ustunlar.indexOf("id")]) : bazada ? Number(bazada.id) : 1;
  }
  const bajar = () => {
    if (toza) {
      for (const j of jadvallar.keys()) db.exec(`DELETE FROM ${j}`);
      try { db.exec(`DELETE FROM sqlite_sequence WHERE name LIKE 'ish\\_%' ESCAPE '\\'`); } catch { /* yo'q */ }
      log("tozalandi:", [...jadvallar.keys()].join(", "));
    }
    for (const { jadval, ustunlar, q } of ishlar) {
      const info = jadvallar.get(jadval);
      const bor = new Map(info.map((x) => [x.name, x]));
      const ust = [], qiy = [];
      ustunlar.forEach((u, i) => { if (bor.has(u)) { ust.push(u); qiy.push(q[i] === undefined ? null : q[i]); } });
      const tr = tartib[jadval] = (tartib[jadval] ?? -1) + 1;
      for (const x of info) {
        if (ust.includes(x.name) || !x.notnull || x.dflt_value !== null || x.pk) continue;
        ust.push(x.name); qiy.push(standart(jadval, x.name, x.type, hozir, tr));
        if (x.name === "hash") ogoh.push(`ish_kirish: «${q[ustunlar.indexOf("login")]}» — parol xeshi faylda yo'q (kirish uchun: node tools/sayt-parol.mjs ${q[ustunlar.indexOf("login")]} ${q[ustunlar.indexOf("uid")]})`);
      }
      const pk = info.filter((x) => x.pk).sort((a, b) => a.pk - b.pk).map((x) => x.name);
      const faylda = new Set(ustunlar);
      const yangila = ust.filter((u) => faylda.has(u) && !pk.includes(u));
      const sqlI = `INSERT INTO ${jadval} (${ust.join(", ")}) VALUES (${ust.map(() => "?").join(", ")})` +
        (pk.length ? ` ON CONFLICT(${pk.join(", ")}) DO ${yangila.length ? "UPDATE SET " + yangila.map((u) => `${u} = excluded.${u}`).join(", ") : "NOTHING"}` : "");
      db.prepare(sqlI).run(...qiy);
      hisob[jadval] = (hisob[jadval] || 0) + 1;
    }
  };

  // D1 eksporti kabi (PRAGMA defer_foreign_keys): jadvallar tartibi ixtiyoriy bo'lgani uchun yuklash paytida FK o'chiq
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    if (sinov) {
      db.exec("BEGIN");
      try { bajar(); } finally { db.exec("ROLLBACK"); }
    } else {
      db.exec("BEGIN IMMEDIATE");
      try { bajar(); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
    }
  } finally { db.exec("PRAGMA foreign_keys = ON"); }
  qoralama.close();
  return { hisob, otdi, ogoh: [...new Set(ogoh)] };
}

/* ── buyruq qatori ── */
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/import.mjs")) {
  const arg = process.argv.slice(2);
  const fayl = arg.find((x) => !x.startsWith("--"));
  if (!fayl) { console.log("Foydalanish: node tools/import.mjs <fayl.sql> [--toza] [--sinov]"); process.exit(1); }
  const s = sozlamaOl();
  const DB = bazaOch(s.DB_FAYL);
  migratsiya(DB);
  const toza = arg.includes("--toza"), sinov = arg.includes("--sinov");
  console.log(`baza: ${s.DB_FAYL}${toza ? " · --toza (ish_* jadvallari avval tozalanadi)" : ""}${sinov ? " · --sinov (hech narsa yozilmaydi)" : ""}`);
  const r = importla(DB, fs.readFileSync(fayl, "utf8"), { toza, sinov });
  console.log("yuklandi:", JSON.stringify(r.hisob));
  if (Object.keys(r.otdi).length) console.log("o'tkazib yuborildi (Trello'ga tegishli emas):", JSON.stringify(r.otdi));
  for (const o of r.ogoh) console.log("⚠️ ", o);
  DB.yop();
}
