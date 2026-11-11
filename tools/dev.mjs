// tools/dev.mjs — lokal ishga tushirish (Telegram'siz): npm run build && npm run dev → http://localhost:8080
//   • baza: ./data/trello.sqlite (bo'sh bo'lsa baza/02-malumot.sql avtomatik yuklanadi)
//   • SHADOW=1 — hech narsa yuborilmaydi; BOT_TOKEN bo'lmasa soxta token (faqat lokal imzo uchun)
//   • mini ilova (http://localhost:8080/app/): pastda chiqqan initData'ni brauzer konsolida
//       localStorage.devInitData = "<initData>"   deb qo'ying (lib/tg.js shuni o'qiydi; server imzoni baribir tekshiradi)
//   • sayt logini: node tools/sayt-parol.mjs sardor 100000002  (DATA_DIR=./data)
import fs from "node:fs";
process.env.DATA_DIR ??= "./data";
process.env.PUBLIC_URL ??= "http://localhost:" + (process.env.PORT || 8080);
process.env.SHADOW ??= "1";
process.env.BOT_TOKEN ??= "123456789:DEV-faqat-lokal-imzo-uchun";
const { sozlamaOl } = await import("../src/env.js");
const { bazaOch, migratsiya } = await import("../src/db.js");
const { importla } = await import("./import.mjs");
const { initDataYasa } = await import("../src/tma.js");
const s = sozlamaOl();
{
  const DB = bazaOch(s.DB_FAYL); migratsiya(DB);
  if (!DB.db.prepare("SELECT COUNT(*) AS n FROM ish_ws").get().n) {
    const r = importla(DB, fs.readFileSync(new URL("../baza/02-malumot.sql", import.meta.url), "utf8"), { log: () => {} });
    console.log("boshlang'ich ma'lumot yuklandi:", JSON.stringify(r.hisob));
  }
  DB.yop();
}
for (const [ism, id] of [["Достон", 100000004], ["Сардор ака", 100000002]]) {
  console.log(`initData (${ism}, 24 soat):\n  ${await initDataYasa({ id, first_name: ism }, process.env.BOT_TOKEN)}`);
}
const { ishgaTushir } = await import("../src/server.js");
ishgaTushir(sozlamaOl());
