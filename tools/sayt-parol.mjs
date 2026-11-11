// tools/sayt-parol.mjs — rahbarlar saytiga login/parol o'rnatish (asli: vositalar/sayt-parol.mjs, u wrangler orqali
// Cloudflare D1 ga yozardi; bu nusxa shu serverning SQLite bazasiga yozadi). Parol ekranga chiqmaydi, bazaga faqat
// PBKDF2-SHA256 xeshi (tuz bilan) yoziladi. Shu loginning eski sessiyalari o'chadi.
//
//   docker compose exec trello node tools/sayt-parol.mjs sardor 100000002
//   (lokal: DATA_DIR=./data node tools/sayt-parol.mjs sardor 100000002)
import readline from "node:readline";
import { bazaOch, migratsiya } from "../src/db.js";
import { sozlamaOl } from "../src/env.js";
import { parolHash, TAKROR } from "../src/ish/sayt.js";

const [login, uidS] = process.argv.slice(2);
if (!/^[a-z0-9_.-]{3,32}$/.test(login || "") || !/^\d{3,15}$/.test(uidS || "")) {
  console.log("Foydalanish: node tools/sayt-parol.mjs <login> <telegram_id>\n  masalan: node tools/sayt-parol.mjs sardor 100000002");
  process.exit(1);
}
function yashirinSora(savol) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(savol)) process.stdout.write(s); else process.stdout.write("*"); };
    rl.question(savol, (j) => { rl.close(); process.stdout.write("\n"); ok(j); });
  });
}
const p1 = process.env.PAROL || await yashirinSora(`«${login}» uchun yangi parol: `);
if (p1.length < 8) { console.log("❌ Parol kamida 8 belgi bo'lsin"); process.exit(1); }
if (!process.env.PAROL) {
  const p2 = await yashirinSora("Parolni qayta kiriting: ");
  if (p1 !== p2) { console.log("❌ Parollar bir xil emas"); process.exit(1); }
}
const tuz = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex");
const hash = await parolHash(p1, tuz, TAKROR);
const s = sozlamaOl();
const DB = bazaOch(s.DB_FAYL);
migratsiya(DB);
DB.db.prepare(`INSERT INTO ish_kirish (login, uid, hash, tuz, takror, yangilandi) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(login) DO UPDATE SET uid = excluded.uid, hash = excluded.hash, tuz = excluded.tuz, takror = excluded.takror, yangilandi = excluded.yangilandi`)
  .run(login, Number(uidS), hash, tuz, TAKROR, new Date().toISOString());
DB.db.prepare("DELETE FROM ish_sessiya WHERE uid = ?").run(Number(uidS));
DB.yop();
console.log(`✅ «${login}» uchun parol o'rnatildi (${s.DB_FAYL}).`);
