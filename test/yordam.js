// test/yordam.js — node:test sinovlari uchun umumiy yordamchilar
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bazaOch, migratsiya } from "../src/db.js";
import { initDataYasa } from "../src/tma.js";
import { ishApi } from "../src/ish/api.js";

export const TOKEN = "123456789:AAFakeTokenForTestsOnly_abcdefghijk";
export const SARDOR = 100000002, ALI = 111222333;

/** fetch'ni tutib oladi: har bir chaqiriq ro'yxatga tushadi (Telegram'ga hech narsa ketmaydi) */
export function fetchTut() {
  const chaqiriqlar = [];
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url);
    chaqiriqlar.push({ url: u, usul: u.split("/").pop(), body: opt.body });
    if (u.endsWith("/sendDocument")) return new Response(JSON.stringify({ ok: true, result: { document: { file_id: "DOC1" } } }));
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
  };
  return chaqiriqlar;
}

export function yangiEnv(qoshimcha = {}) {
  const DB = bazaOch(":memory:");
  migratsiya(DB);
  DB.db.prepare("INSERT INTO ish_odam (uid, ism, bolim, vaqt) VALUES (?, 'Али', '', 'x')").run(ALI);
  const FILES_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "trello-t-"));
  return { BOT_TOKEN: TOKEN, APP_URL: "https://trello.example/app/", DB, FILES_DIR, ISH_OCHIQ: "1", ...qoshimcha };
}

export async function sora(env, uid, yol, usul = "GET", body, { fayllar = [] } = {}) {
  const headers = { authorization: "tma " + await initDataYasa({ id: uid, first_name: "U" }, TOKEN) };
  let b;
  if (fayllar.length) {
    b = new FormData();
    for (const [k, v] of Object.entries(body || {})) b.append(k, typeof v === "string" ? v : JSON.stringify(v));
    for (const f of fayllar) b.append("fayl", f);
  } else if (body !== undefined) { headers["content-type"] = "application/json"; b = JSON.stringify(body); }
  const r = await ishApi(new Request("https://x/api/ish" + yol, { method: usul, headers, body: b }), env);
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
}

export const rasm = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "r.jpg", { type: "image/jpeg" });
export const kunSana = (ms, n = 0) => new Date(ms + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
