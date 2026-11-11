// test/cron.test.js — 09:30 (Toshkent) cron: bir kunda bir marta, qayta ishga tushganda ikki marta yubormaydi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchTut, yangiEnv, sora, kunSana, SARDOR, ALI } from "./yordam.js";
import { cronTekshir, toshkent } from "../src/cron.js";

let VAQT = Date.UTC(2026, 10, 9, 3, 0);    // 09.11.2026 08:00 Toshkent
Date.now = () => VAQT;
const soat = (s, d = 0, kun = 0) => Date.UTC(2026, 10, 9 + kun, s - 5, d);   // Toshkent soati → UTC ms

async function tayyorla(qoshimcha = {}) {
  const env = yangiEnv(qoshimcha);
  await sora(env, SARDOR, "/men");
  await sora(env, ALI, "/men");
  const B1 = (await sora(env, SARDOR, "/boards")).boards[0].id;
  assert.ok((await sora(env, SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Ertaga tugaydi", kimga: ALI, muddat: kunSana(VAQT, 1) })).ok);
  assert.ok((await sora(env, SARDOR, "/takror", "POST", { nom: "Har kuni hisobot", kimga: ALI, davr: "kun", muddatKun: 0 })).ok);
  return env;
}
const sanoq = async (env, sql) => Number((await env.DB.prepare(sql).first()).n);

test("toshkent(): UTC+5", () => {
  assert.deepEqual(toshkent(Date.UTC(2026, 10, 9, 4, 30)), { sana: "2026-11-09", daqiqa: 9 * 60 + 30 });
  assert.equal(toshkent(Date.UTC(2026, 10, 9, 19, 30)).sana, "2026-11-10");   // 00:30 ertasi kuni
});

test("09:30 dan oldin ishlamaydi; 09:30 da bir marta; qayta chaqirilsa — yo'q", async () => {
  fetchTut();
  const env = await tayyorla();
  assert.deepEqual(await cronTekshir(env, soat(9, 29)), []);
  VAQT = soat(9, 30);
  const r1 = await cronTekshir(env, VAQT);
  assert.equal(r1.length, 1);
  assert.equal(r1[0].natija.takror.ok, 1, "takroriy vazifa yaratildi");
  assert.ok(r1[0].natija.eslatma.tekshirildi >= 1);
  const yaqin1 = await sanoq(env, "SELECT COUNT(*) AS n FROM ish_bildir WHERE tur = 'yaqin'");
  const ob1 = await sanoq(env, "SELECT COUNT(*) AS n FROM tg_outbox");
  const kartalar1 = await sanoq(env, "SELECT COUNT(*) AS n FROM ish_card");
  assert.ok(yaqin1 >= 1);
  // shu kuni yana 10 marta (masalan, har 30 soniyada) — hech narsa
  for (let i = 1; i <= 10; i++) { VAQT = soat(9, 30 + i); assert.deepEqual(await cronTekshir(env, VAQT), []); }
  assert.equal(await sanoq(env, "SELECT COUNT(*) AS n FROM ish_bildir WHERE tur = 'yaqin'"), yaqin1);
  assert.equal(await sanoq(env, "SELECT COUNT(*) AS n FROM tg_outbox"), ob1);
  assert.equal(await sanoq(env, "SELECT COUNT(*) AS n FROM ish_card"), kartalar1);
});

test("server qayta ishga tushsa (yangi jarayon, o'sha baza) — o'sha kuni qayta yubormaydi; ertasi kuni yana ishlaydi", async () => {
  fetchTut();
  const env = await tayyorla();
  VAQT = soat(9, 31);
  assert.equal((await cronTekshir(env, VAQT)).length, 1);
  const ob = await sanoq(env, "SELECT COUNT(*) AS n FROM tg_outbox");
  // "qayta ishga tushish": modul xotirasi emas, faqat bazadagi belgi qaror qiladi
  const { cronTekshir: yangi } = await import("../src/cron.js?qayta=" + Date.now());
  VAQT = soat(14, 0);
  assert.deepEqual(await yangi(env, VAQT), []);
  assert.equal(await sanoq(env, "SELECT COUNT(*) AS n FROM tg_outbox"), ob);
  VAQT = soat(9, 30, 1);
  const r = await yangi(env, VAQT);
  assert.equal(r.length, 1);
  assert.equal(r[0].sana, "2026-11-10");
  assert.equal(r[0].natija.takror.ok, 1, "ertasiga yangi takroriy vazifa");
});

test("server 09:30 da o'chiq bo'lsa — kech yoqilganda shu kun bir marta bajariladi", async () => {
  fetchTut();
  const env = await tayyorla();
  VAQT = soat(16, 45);
  assert.equal((await cronTekshir(env, VAQT)).length, 1);
  assert.deepEqual(await cronTekshir(env, VAQT + 60_000), []);
});

test("yarim yo'lda to'xtagan bo'lsa (tugadi = NULL) — qayta bajariladi, lekin xabarlar takrorlanmaydi", async () => {
  fetchTut();
  const env = await tayyorla();
  VAQT = soat(9, 30);
  await cronTekshir(env, VAQT);
  const yaqin = await sanoq(env, "SELECT COUNT(*) AS n FROM ish_bildir");
  const ob = await sanoq(env, "SELECT COUNT(*) AS n FROM tg_outbox");
  const kartalar = await sanoq(env, "SELECT COUNT(*) AS n FROM ish_card");
  await env.DB.prepare("UPDATE cron_run SET tugadi = NULL").run();   // "o'chib qolgan"
  VAQT = soat(9, 35);
  assert.equal((await cronTekshir(env, VAQT)).length, 1, "qayta urinildi");
  assert.equal(await sanoq(env, "SELECT COUNT(*) AS n FROM ish_bildir"), yaqin);
  assert.equal(await sanoq(env, "SELECT COUNT(*) AS n FROM tg_outbox"), ob);
  assert.equal(await sanoq(env, "SELECT COUNT(*) AS n FROM ish_card"), kartalar);
});

test("cron SHADOW'da ham (standart) Telegram'ga hech narsa yubormaydi", async () => {
  const f = fetchTut();
  const env = await tayyorla();
  VAQT = soat(9, 30);
  await cronTekshir(env, VAQT);
  assert.equal(f.length, 0);
  assert.ok(await sanoq(env, "SELECT COUNT(*) AS n FROM tg_outbox WHERE shadow = 1") >= 1);
});
