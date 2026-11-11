// src/ish/saqlash.js — файл сақлаш абстракцияси (асли: src/app/ish/saqlash.js).
// Бизнес мантиқ файл ҚАЕРДА турганини билмайди:
//   yukla(env, fayl) → kalit      ol(env, kalit) → { body } | null
// Жойлар (калитнинг бошидан аниқланади):
//   "f:" DiskSaqlash     — [server] маҳаллий диск (Docker томи /data/files) — 8 МБ гача. ЁЗИШ УЧУН СТАНДАРТ.
//   "t:" TelegramSaqlash — env.ISH_FAYL_CHAT бўлса ВА SHADOW=0 бўлса (SHADOW'да Telegram'га ҳеч нима кетмайди → диск)
//   "d:" D1Saqlash       — ish_blob жадвали: ФАҚАТ ЎҚИШ (Cloudflare'дан кўчирилган эски файллар)
// Кейин S3 қўшиш — шу ерга битта объект.
import fs from "node:fs";
import path from "node:path";
import { tgFaylYubor, tg, telegramFaylOl, shadowmi } from "../telegram.js";
import { CHEGARA, FAYL_TUR } from "./sozlama.js";

const id12 = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");

/** Файлнинг ҲАҚИҚИЙ турини байтларидан аниқлаш (мижоз айтган MIME'га ишонилмайди) */
export function turAniqla(bytes, mijozMime = "") {
  const b = bytes || new Uint8Array(0);
  const bosh = (...x) => x.every((v, i) => b[i] === v);
  if (bosh(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (bosh(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (bosh(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (bosh(0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  if (bosh(0x50, 0x4b, 0x03, 0x04)) {   // zip: xlsx/docx — мижоз айтганидан фақат шу иккаласи
    return /spreadsheetml/.test(mijozMime) ? FAYL_TUR_KALIT.xlsx : /wordprocessingml/.test(mijozMime) ? FAYL_TUR_KALIT.docx : null;
  }
  return null;
}
const FAYL_TUR_KALIT = Object.fromEntries(Object.entries(FAYL_TUR).map(([m, e]) => [e, m]));
export const rasmmi = (mime) => /^image\//.test(mime || "");

/** Номни тозалаш: йўл, бошқарув белгилари олиб ташланади, кенгайтма — турдан */
export function nomTozala(nom, mime) {
  const ext = FAYL_TUR[mime] || "bin";
  let n = String(nom || "").split(/[\\/]/).pop().replace(/[\u0000-\u001f<>:"|?*]/g, "").replace(/\.[^.]*$/, "").trim().slice(0, 80);
  if (!n) n = rasmmi(mime) ? "rasm" : "fayl";
  return `${n}.${ext}`;
}

const TelegramSaqlash = {
  nom: "telegram",
  max: CHEGARA.faylBayt,
  async yukla(env, f) {
    const r = await tgFaylYubor(env, "sendDocument", "document",
      { chat_id: env.ISH_FAYL_CHAT, disable_notification: true, caption: "📋 ish" }, { bytes: f.bytes, nom: f.nom, mime: f.mime });
    const id = r && r.ok && r.result && r.result.document && r.result.document.file_id;
    return id ? "t:" + id : null;
  },
  async ol(env, kalit) {
    const g = await tg(env, "getFile", { file_id: kalit.slice(2) }).catch(() => null);
    if (!g || !g.ok || !g.result || !g.result.file_path) return null;
    const r = await telegramFaylOl(env, g.result.file_path);
    return r ? { body: new Uint8Array(await r.arrayBuffer()) } : null;
  },
};

const D1Saqlash = {
  nom: "d1",
  max: CHEGARA.blobBayt,
  async ol(env, kalit) {
    const r = await env.DB.prepare("SELECT bayt FROM ish_blob WHERE id = ?").bind(kalit.slice(2)).first();
    return r ? { body: new Uint8Array(r.bayt) } : null;
  },
};

/** [server] Маҳаллий диск: <FILES_DIR>/<ab>/<abcdef…> — номи тасодифий, мижоз номи ишлатилмайди */
export const faylPapka = (env) => (env && env.FILES_DIR) || "/data/files";
const diskYol = (env, id) => {
  if (!/^[0-9a-f]{24}$/.test(id)) return null;
  return path.join(faylPapka(env), id.slice(0, 2), id);
};
const DiskSaqlash = {
  nom: "disk",
  max: CHEGARA.faylBayt,
  async yukla(env, f) {
    const id = id12();
    const yol = diskYol(env, id);
    await fs.promises.mkdir(path.dirname(yol), { recursive: true });
    const vaqt = yol + ".tmp";
    await fs.promises.writeFile(vaqt, f.bytes);
    await fs.promises.rename(vaqt, yol);
    return "f:" + id;
  },
  async ol(env, kalit) {
    const yol = diskYol(env, kalit.slice(2));
    if (!yol) return null;
    try { return { body: new Uint8Array(await fs.promises.readFile(yol)) }; } catch { return null; }
  },
};

/** Ёзиш учун жой: канал созланган ва SHADOW ўчиқ бўлса — Telegram, бўлмаса — диск */
export const saqlovchi = (env) => (env && env.ISH_FAYL_CHAT && !shadowmi(env) ? TelegramSaqlash : DiskSaqlash);
/** Ўқиш учун — калитнинг бошидан */
const oquvchi = (kalit) => {
  const k = String(kalit);
  return k.startsWith("f:") ? DiskSaqlash : k.startsWith("t:") ? TelegramSaqlash : k.startsWith("d:") ? D1Saqlash : null;
};

export async function yukla(env, f) {
  const s = saqlovchi(env);
  if (f.bytes.length > s.max) return { xato: `Файл жуда катта (${Math.floor(s.max / 1e6 * 10) / 10} МБ гача)` };
  const kalit = await s.yukla(env, f).catch((e) => { console.error("fayl saqlash:", e && e.message); return null; });
  return kalit ? { kalit } : { xato: "Файл сақланмади — қайта уриниб кўринг" };
}
export async function ol(env, kalit) {
  const s = oquvchi(kalit);
  return s ? s.ol(env, kalit) : null;
}
