// tools/outbox.mjs — Telegram'ga ketgan / SHADOW'da ketmagan xabarlar ro'yxati (tg_outbox).
//   docker compose exec trello node tools/outbox.mjs [soni=20]
import { bazaOch } from "../src/db.js";
import { sozlamaOl } from "../src/env.js";

const n = Math.max(1, Math.min(500, Number(process.argv[2]) || 20));
const DB = bazaOch(sozlamaOl().DB_FAYL);
const ro = DB.db.prepare("SELECT id, vaqt, method, chat_id, shadow, ok, payload FROM tg_outbox ORDER BY id DESC LIMIT ?").all(n);
for (const r of ro.reverse()) {
  let p = {}; try { p = JSON.parse(r.payload); } catch { /* yo'q */ }
  const matn = String(p.text || p.caption || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").slice(0, 110);
  console.log(`#${r.id} ${r.vaqt.slice(0, 16).replace("T", " ")}Z ${r.shadow ? "SHADOW" : r.ok ? "YUBORILDI" : "XATO"} ${r.method} → ${r.chat_id ?? "-"}  ${matn}`);
}
const j = DB.db.prepare("SELECT SUM(shadow) AS s, COUNT(*) AS n FROM tg_outbox").get();
console.log(`— jami ${j.n || 0} ta (SHADOW: ${j.s || 0})`);
DB.yop();
