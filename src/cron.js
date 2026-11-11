// src/cron.js — jarayon ichidagi kunlik vazifalar (Toshkent vaqti, UTC+5, yozgi vaqt yo'q).
//
// wrangler.app.toml dagi 5 ta krondan Trello'ga tegishlisi FAQAT bittasi:
//   "30 4 * * *" (09:30 Toshkent) → worker.js: ishTozala → ishTakror → ishEslatma
// Qolganlari (09:00/09:20/09:30 Oshxona, 09:45/09:50 Oshxona yakuni, har 30 daqiqa 1С/Omborda) — boshqa
// bo'limlar, bu serverga ko'chirilmaydi.
//
// Takrorlanmaslik: cron_run (nom, sana) jadvali. Bir kunda bir marta: server qayta ishga tushsa ham,
// soat 09:30 dan keyin birinchi tekshiruvda bajariladi, keyin shu kun uchun boshqa bajarilmaydi.
// Yarim yo'lda to'xtab qolgan bo'lsa (tugadi = NULL) — qayta bajariladi; ichidagi uchala funksiya ham
// o'zi takrorlanmas (ish_bildir.kalit UNIQUE, ish_takror.oxirgi, arxiv sanasi), shuning uchun xavfsiz.
import { ishTozala, ishTakror, ishEslatma } from "./ish/api.js";

const SOAT5 = 5 * 3600_000;
/** ms → Toshkent { sana: "YYYY-MM-DD", daqiqa: kun boshidan daqiqa } */
export function toshkent(ms = Date.now()) {
  const d = new Date(ms + SOAT5);
  return { sana: d.toISOString().slice(0, 10), daqiqa: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export const VAZIFALAR = [
  {
    nom: "ish-0930",
    boshi: 9 * 60 + 30,          // 09:30 Toshkent
    oxiri: 23 * 60 + 59,         // shu kun ichida kech qolsa ham (server o'chiq bo'lgan bo'lsa) bir marta bajariladi
    async ish(env) {
      const r = {};
      try { r.tozala = await ishTozala(env); } catch (e) { r.tozala = "xato: " + String(e); console.error("ish tozala:", e); }
      try { r.takror = await ishTakror(env); } catch (e) { r.takror = "xato: " + String(e); console.error("ish takror:", e); }
      try { r.eslatma = await ishEslatma(env); } catch (e) { r.eslatma = "xato: " + String(e); console.error("vazifa eslatmasi:", e); }
      return r;
    },
  },
];

const ishlayapti = new Set();

/** Hozir bajarilishi kerak bo'lgan vazifalarni bajaradi. @returns [{ nom, sana, natija }] */
export async function cronTekshir(env, ms = Date.now(), vazifalar = VAZIFALAR) {
  const { sana, daqiqa } = toshkent(ms);
  const bajarildi = [];
  for (const v of vazifalar) {
    if (daqiqa < v.boshi || daqiqa > v.oxiri) continue;
    const kalit = v.nom + ":" + sana;
    if (ishlayapti.has(kalit)) continue;
    const row = await env.DB.prepare("SELECT tugadi FROM cron_run WHERE nom = ? AND sana = ?").bind(v.nom, sana).first();
    if (row && row.tugadi) continue;
    if (!row) {
      const r = await env.DB.prepare("INSERT OR IGNORE INTO cron_run (nom, sana, boshlandi) VALUES (?, ?, ?)")
        .bind(v.nom, sana, new Date(Date.now()).toISOString()).run();
      if (!r.meta.changes) continue;
    }
    ishlayapti.add(kalit);
    try {
      const natija = await v.ish(env);
      await env.DB.prepare("UPDATE cron_run SET tugadi = ?, natija = ? WHERE nom = ? AND sana = ?")
        .bind(new Date(Date.now()).toISOString(), JSON.stringify(natija).slice(0, 2000), v.nom, sana).run();
      console.log(`cron ${v.nom} ${sana}:`, JSON.stringify(natija));
      bajarildi.push({ nom: v.nom, sana, natija });
    } catch (e) {
      console.error(`cron ${v.nom}:`, e && e.stack || e);
    } finally { ishlayapti.delete(kalit); }
  }
  return bajarildi;
}

/** Har 30 soniyada tekshiradi. To'xtatish funksiyasini qaytaradi. */
export function cronBoshla(env, oraliq = 30_000) {
  const t = () => cronTekshir(env).catch((e) => console.error("cron:", e && e.stack || e));
  t();
  const id = setInterval(t, oraliq);
  return () => clearInterval(id);
}
