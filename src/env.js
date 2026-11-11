// src/env.js — Cloudflare'dagi `env` obyektining o'rnini bosuvchi: .env (process.env) → env.
// api.js va boshqa modullar env.DB, env.BOT_TOKEN, env.APP_URL, env.ISH_OCHIQ ... ni kutadi.
import path from "node:path";

export function sozlamaOl(asl = process.env) {
  // Windows'da tahrirlangan .env da qator oxiridagi CR va bo'shliqlar qiymatga qo'shilib qolmasin
  const p = Object.fromEntries(Object.entries(asl).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
  const DATA_DIR = p.DATA_DIR || "/data";
  const PUBLIC_URL = String(p.PUBLIC_URL || "http://localhost:8080").replace(/\/+$/, "");
  return {
    PORT: Number(p.PORT) || 8080,
    DATA_DIR,
    DB_FAYL: p.DB_FAYL || path.join(DATA_DIR, "trello.sqlite"),
    WEB_DIR: p.WEB_DIR || "",
    env: {
      BOT_TOKEN: p.BOT_TOKEN || "",
      SHADOW: p.SHADOW ?? "1",                       // standart: HECH NARSA yuborilmaydi
      ISH_OCHIQ: p.ISH_OCHIQ || "0",                 // Cloudflare'dagi kabi: "0" — faqat KORADI ro'yxati
      ISH_FAYL_CHAT: p.ISH_FAYL_CHAT || "",          // bo'sh — fayllar diskda
      PUBLIC_URL,
      APP_URL: p.APP_URL || PUBLIC_URL + "/app/",    // Telegram xabaridagi «📋 Вазифани очиш» tugmasi
      FILES_DIR: p.FILES_DIR || path.join(DATA_DIR, "files"),
      CRON: p.CRON ?? "1",                           // "0" — cron o'chiq (masalan, sinov nusxasida)
    },
  };
}
