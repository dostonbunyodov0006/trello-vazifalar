// src/telegram.js — Telegram'ga YAGONA yo'l. Butun serverda boshqa hech qayerda api.telegram.org chaqirilmaydi.
//
//   SHADOW=1 (standart)  — HECH NARSA yuborilmaydi: chaqiriq tg_outbox jadvaliga yoziladi va logga chiqadi,
//                          javob sifatida { ok: true, shadow: true } qaytadi (biznes oqimi o'zgarmaydi).
//   SHADOW=0             — haqiqiy yuborish (BOT_TOKEN bilan), natija ham tg_outbox'ga yoziladi.
//
// Eski Cloudflare versiyasi egasi o'tkazmaguncha yuborishda davom etadi — ikki joydan bir xil xabar
// ketmasligi uchun standart doim SHADOW.
//
// Qoidalar asl tgapi.js dan: 429 da kutadi, tarmoq xatosida 2 marta qayta urinadi; taqiq.js (guruh/odamga
// yozish taqiqi) har bir yozishdan oldin tekshiriladi.
import { yozishMumkin, taqiqJavob } from "./taqiq.js";

const URINISH = 2, KUTISH_MAX = 5;
const kut = (ms) => new Promise((r) => setTimeout(r, ms));
const OQISH = new Set(["getFile", "getMe", "getChat", "getChatMember"]);

/** SHADOW yoqilganmi? Faqat aniq "0" — o'chiq. Yo'q yoki boshqa qiymat — yoqiq (xavfsiz tomon). */
export const shadowmi = (env) => String((env && env.SHADOW) ?? "1").trim() !== "0";

/** FormData / obyekt → jurnal uchun JSON (fayl baytlari emas, faqat nomi/turi/hajmi) */
function jurnalga(body) {
  if (body instanceof FormData) {
    const o = {};
    for (const [k, v] of body.entries()) o[k] = typeof v === "string" ? v : { fayl: v.name || "", mime: v.type || "", hajm: v.size };
    return o;
  }
  return body || {};
}
const chatOl = (body) => {
  const c = body instanceof FormData ? body.get("chat_id") : body && body.chat_id;
  return c === undefined || c === null ? null : String(c);
};

function yoz(env, method, body, shadow, javob) {
  try {
    if (!env || !env.DB || typeof env.DB.prepare !== "function") return;
    const p = jurnalga(body);
    const s = env.DB.prepare("INSERT INTO tg_outbox (vaqt, method, chat_id, payload, shadow, ok, javob) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(new Date(Date.now()).toISOString(), method, chatOl(body), JSON.stringify(p).slice(0, 20000), shadow ? 1 : 0,
        javob ? (javob.ok ? 1 : 0) : null, javob ? JSON.stringify(javob).slice(0, 500) : null);
    if (s.__runSync) s.__runSync(); else s.run().catch(() => {});
  } catch (e) { console.error("tg_outbox:", e && e.message); }
}

/**
 * YAGONA yuborish funksiyasi.
 * @param {object} env  { BOT_TOKEN, SHADOW, DB }
 * @param {string} method  sendMessage / sendPhoto / sendMediaGroup / sendDocument / getFile ...
 * @param {object|FormData} body
 */
export async function telegram(env, method, body = {}) {
  const yozish = !OQISH.has(method);
  if (yozish && !yozishMumkin(method, body instanceof FormData ? { chat_id: body.get("chat_id") } : body)) return taqiqJavob(method, body);
  if (yozish && shadowmi(env)) {
    yoz(env, method, body, true, null);
    console.log(`[SHADOW] ${method} → ${chatOl(body) ?? "-"} (yuborilmadi)`);
    return { ok: true, shadow: true, result: { message_id: 0 } };
  }
  // O'qish (getFile) SHADOW'da ham ruxsat: hech kimga hech narsa yubormaydi, eski "t:" fayllarni ochish uchun kerak.
  if (!env || !env.BOT_TOKEN) {
    const j = { ok: false, error_code: 0, description: "BOT_TOKEN yo'q" };
    if (yozish) yoz(env, method, body, false, j);
    return j;
  }
  const json = !(body instanceof FormData);
  let j = null;
  for (let urinish = 0; ; urinish++) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, json
        ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        : { method: "POST", body });
      j = await r.json();
    } catch (e) {
      if (urinish < URINISH) { await kut(700 * (urinish + 1)); continue; }
      j = { ok: false, error_code: 0, description: String(e) };
      break;
    }
    if (j && j.ok === false && j.error_code === 429 && urinish < URINISH) {
      await kut(Math.min(Math.max(Number(j.parameters && j.parameters.retry_after) || 1, 1), KUTISH_MAX) * 1000);
      continue;
    }
    break;
  }
  if (j && j.ok === false) console.error("tg:", method, j.error_code, j.description);
  if (yozish) yoz(env, method, body, false, j);
  return j;
}

/** Telegram serveridagi faylni yuklab olish (faqat o'qish; eski "t:" kalitli fayllar uchun) */
export async function telegramFaylOl(env, filePath) {
  if (!env || !env.BOT_TOKEN) return null;
  const r = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${filePath}`);
  return r.ok ? r : null;
}

/* ── asl tgapi.js bilan mos yordamchilar (endi env oladi, token emas) ── */
export const tg = (env, method, payload) => {
  if (payload && payload.reply_to_message_id && payload.allow_sending_without_reply === undefined) payload = { ...payload, allow_sending_without_reply: true };
  return telegram(env, method, payload);
};
/** Fayl bilan yuborish (multipart). fayl = { bytes, nom, mime } */
export function tgFaylYubor(env, method, maydon, fields, fayl) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    fd.append(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  fd.append(maydon, new Blob([fayl.bytes], { type: fayl.mime || "application/octet-stream" }), fayl.nom || "file");
  return telegram(env, method, fd);
}
