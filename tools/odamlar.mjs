// tools/odamlar.mjs — «Botdagi odamlar» ro'yxati (ish_odam): kimga vazifa berish mumkin, kim mini ilovaga kira oladi.
// Cloudflare'da bu ro'yxat KV «app:roles».ismlar + bot kodidagi ISM (sklad.js) edi — ular bu serverda yo'q.
//
//   node tools/odamlar.mjs royxat
//   node tools/odamlar.mjs qosh 123456789 "Ism Familiya" [bolim]
//   node tools/odamlar.mjs ochir 123456789
//   node tools/odamlar.mjs import odamlar.json
//       odamlar.json: { "123456789": "Ism", ... }  yoki  KV «app:roles» qiymati ({ "ismlar": {...} })
//                     yoki  [{ "uid": 123, "ism": "Ism", "bolim": "" }, ...]
// Takroriy import xavfsiz (bor bo'lsa ism yangilanadi).
import fs from "node:fs";
import { bazaOch, migratsiya } from "../src/db.js";
import { sozlamaOl } from "../src/env.js";
import { botOdamlari } from "../src/odamlar.js";

const [buyruq, ...arg] = process.argv.slice(2);
const s = sozlamaOl();
const DB = bazaOch(s.DB_FAYL);
migratsiya(DB);
const hozir = new Date().toISOString();
const yoz = DB.db.prepare("INSERT INTO ish_odam (uid, ism, bolim, vaqt) VALUES (?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET ism = excluded.ism, bolim = excluded.bolim, vaqt = excluded.vaqt");
const toza = (x) => String(x ?? "").trim().slice(0, 60);

if (buyruq === "qosh" && /^\d{3,15}$/.test(arg[0] || "") && toza(arg[1])) {
  yoz.run(Number(arg[0]), toza(arg[1]), toza(arg[2]), hozir);
  console.log("✅ qo'shildi:", arg[0], toza(arg[1]));
} else if (buyruq === "ochir" && /^\d{3,15}$/.test(arg[0] || "")) {
  console.log(DB.db.prepare("DELETE FROM ish_odam WHERE uid = ?").run(Number(arg[0])).changes ? "✅ o'chirildi" : "yo'q edi");
} else if (buyruq === "import" && arg[0]) {
  let d = JSON.parse(fs.readFileSync(arg[0], "utf8"));
  if (d && !Array.isArray(d) && d.ismlar) d = d.ismlar;
  const ro = Array.isArray(d) ? d.map((x) => [x.uid ?? x.id, x.ism, x.bolim]) : Object.entries(d || {}).map(([uid, ism]) => [uid, ism, ""]);
  let n = 0;
  DB.db.exec("BEGIN");
  for (const [uid, ism, bolim] of ro) if (/^\d{3,15}$/.test(String(uid)) && toza(ism)) { yoz.run(Number(uid), toza(ism), toza(bolim), hozir); n++; }
  DB.db.exec("COMMIT");
  console.log(`✅ ${n} ta odam yuklandi`);
} else if (buyruq === "royxat") {
  const m = await botOdamlari({ DB });
  for (const [id, o] of m) console.log(String(id).padStart(12), " ", o.ism, o.bolim ? `(${o.bolim})` : "");
  console.log(`— jami ${m.size} ta (ish_odam: ${DB.db.prepare("SELECT COUNT(*) AS n FROM ish_odam").get().n}, qolgani koddagi ro'yxatlar)`);
} else {
  console.log("Foydalanish: node tools/odamlar.mjs royxat | qosh <uid> <ism> [bolim] | ochir <uid> | import <fayl.json>");
  process.exitCode = 1;
}
DB.yop();
