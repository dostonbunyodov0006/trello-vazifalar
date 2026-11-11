// test/shadow.test.js — SHADOW=1 (standart): Telegram'ga HECH NARSA ketmaydi, faqat tg_outbox'ga yoziladi.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fetchTut, yangiEnv, sora, rasm, kunSana, SARDOR, ALI } from "./yordam.js";
import { ishEslatma } from "../src/ish/api.js";
import { shadowmi, telegram } from "../src/telegram.js";
import { YOZISH_TAQIQ } from "../src/taqiq.js";

let VAQT = Date.UTC(2026, 10, 9, 5, 0);   // 09.11.2026 10:00 Toshkent
Date.now = () => VAQT;

test("shadowmi: faqat aniq \"0\" o'chiradi", () => {
  assert.equal(shadowmi({}), true);
  assert.equal(shadowmi({ SHADOW: "" }), true);
  assert.equal(shadowmi({ SHADOW: "1" }), true);
  assert.equal(shadowmi({ SHADOW: "yo'q" }), true);
  assert.equal(shadowmi({ SHADOW: "0" }), false);
  assert.equal(shadowmi({ SHADOW: " 0 " }), false);
});

test("SHADOW standart: butun oqimda fetch BIRORTA ham chaqirilmaydi, hammasi tg_outbox'da", async () => {
  const f = fetchTut();
  const env = yangiEnv({ ISH_FAYL_CHAT: "-100777" });   // kanal bo'lsa ham SHADOW'da Telegram'ga fayl ketmaydi
  assert.equal(env.SHADOW, undefined);
  await sora(env, SARDOR, "/men");
  await sora(env, ALI, "/men");
  const B1 = (await sora(env, SARDOR, "/boards")).boards[0].id;
  const v = await sora(env, SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Shadow vazifa", kimga: ALI, muddat: kunSana(VAQT, 1) }, { fayllar: [rasm()] });
  assert.ok(v.ok, JSON.stringify(v));
  const d = await sora(env, SARDOR, `/boards/${B1}`);
  const [, LJ, LB] = d.lists.map((l) => l.id);
  assert.ok((await sora(env, ALI, `/cards/${v.card.id}/kochir`, "POST", { list_id: LJ })).ok);
  assert.ok((await sora(env, ALI, `/cards/${v.card.id}/izohlar`, "POST", { matn: "savol bor" })).ok);
  // Ikkinchi vazifa — ertaga muddat: cron eslatmasi ham SHADOW'da ketmaydi
  await sora(env, SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Ertaga", kimga: ALI, muddat: kunSana(VAQT, 1) });
  const k = await sora(env, ALI, `/cards/${v.card.id}/kochir`, "POST", { list_id: LB, matn: "bajardim" }, { fayllar: [rasm(), rasm()] });
  assert.ok(k.ok, JSON.stringify(k));
  await ishEslatma(env);

  assert.equal(f.length, 0, "Telegram'ga so'rov ketdi: " + f.map((x) => x.usul).join(","));
  const ob = (await env.DB.prepare("SELECT method, chat_id, shadow, payload FROM tg_outbox ORDER BY id").all()).results;
  assert.ok(ob.length >= 4, "outbox: " + ob.length);
  assert.ok(ob.every((x) => x.shadow === 1));
  assert.ok(ob.some((x) => x.method === "sendMessage" && x.chat_id === String(ALI) && /Shadow vazifa/.test(x.payload)), "xodimga «berildi»");
  assert.ok(ob.some((x) => x.method === "sendMessage" && x.chat_id === String(SARDOR) && /БАЖАРИЛДИ/.test(x.payload)), "rahbarga «bajarildi»");
  assert.ok(ob.some((x) => x.method === "sendMediaGroup"), "rasmlar ham yozib qo'yildi");
  assert.ok(ob.some((x) => /1 кун қолди/.test(x.payload)), "cron eslatmasi");
  assert.ok(!ob.some((x) => x.method === "sendDocument"), "fayl kanalga yuborilmadi");
  // Fayllar diskka tushdi
  const kalitlar = (await env.DB.prepare("SELECT kalit FROM ish_fayl").all()).results.map((x) => x.kalit);
  assert.equal(kalitlar.length, 3);
  assert.ok(kalitlar.every((x) => x.startsWith("f:")));
  assert.equal(fs.readdirSync(env.FILES_DIR, { recursive: true }).filter((x) => /[0-9a-f]{24}$/.test(x)).length, 3);
  // Fayl qaytib ochiladi
  const fid = (await sora(env, SARDOR, `/cards/${v.card.id}`)).fayllar[0].id;
  const { ishApi } = await import("../src/ish/api.js");
  const { initDataYasa } = await import("../src/tma.js");
  const { TOKEN } = await import("./yordam.js");
  const r = await ishApi(new Request(`https://x/api/ish/fayllar/${fid}`, { headers: { authorization: "tma " + await initDataYasa({ id: SARDOR }, TOKEN) } }), env);
  assert.equal(r.status, 200);
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())].slice(0, 3), [0xff, 0xd8, 0xff]);
});

test("SHADOW=0: haqiqatan yuboriladi va natijasi outbox'da (shadow=0)", async () => {
  const f = fetchTut();
  const env = yangiEnv({ SHADOW: "0" });
  await sora(env, SARDOR, "/men");
  const B1 = (await sora(env, SARDOR, "/boards")).boards[0].id;
  assert.ok((await sora(env, SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Real", kimga: ALI, muddat: kunSana(VAQT, 3) })).ok);
  assert.ok(f.some((x) => x.usul === "sendMessage"));
  const ob = (await env.DB.prepare("SELECT shadow, ok FROM tg_outbox").all()).results;
  assert.ok(ob.length >= 1 && ob.every((x) => x.shadow === 0 && x.ok === 1));
});

test("SHADOW'da ham taqiq.js ishlaydi (taqiqlangan guruhga hatto outbox'ga ham yozilmaydi)", async () => {
  const f = fetchTut();
  const env = yangiEnv();
  const guruh = -1001234567890;
  YOZISH_TAQIQ.add(guruh);                 // taqiq ro'yxati standart holatda bo'sh — sinov uchun qo'shamiz
  const r = await telegram(env, "sendMessage", { chat_id: guruh, text: "x" });
  assert.equal(r.ok, false);
  assert.equal(r.taqiq, true);
  assert.equal(f.length, 0);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM tg_outbox").first()).n, 0);
  YOZISH_TAQIQ.delete(guruh);
});

test("BOT_TOKEN'siz SHADOW=0 — yuborilmaydi, xato qaytadi", async () => {
  const f = fetchTut();
  const env = yangiEnv({ SHADOW: "0", BOT_TOKEN: "" });
  const r = await telegram(env, "sendMessage", { chat_id: ALI, text: "x" });
  assert.equal(r.ok, false);
  assert.equal(f.length, 0);
});
