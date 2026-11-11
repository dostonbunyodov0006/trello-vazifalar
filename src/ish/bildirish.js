// src/ish/bildirish.js (асли: src/app/ish/bildirish.js) — билдиришнома хизмати. API ичидан Telegram'га тўғридан-тўғри ёзилмайди:
// ҳамма хабар шу ердан ўтади. Каналлар: илова ичидаги рўйхат (ish_bildir) + Telegram.
// Янги канал (масалан, e-mail) — KANALLAR га битта объект.
// [server] Ҳамма Telegram чақириғи — src/telegram.js (ЯГОНА йўл, SHADOW шу ерда)
import { tg, telegram } from "../telegram.js";
import { yozishMumkin } from "../taqiq.js";
import { KORADI, SINOVCHILAR, TG_TURLAR, ochiqmi } from "./sozlama.js";
import { rasmmi } from "./saqlash.js";

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Ёпиқ пайтда Telegram хабари фақат KORADI рўйхатидагиларга кетади */
function yuborsaBoladi(env, uid) {
  return ochiqmi(env) || KORADI.includes(Number(uid));
}

function tugma(env, cardId) {
  if (!env || !env.APP_URL || !cardId) return undefined;
  const asos = String(env.APP_URL).replace(/\/?$/, "/");
  return { inline_keyboard: [[{ text: "📋 Вазифани очиш", web_app: { url: `${asos}?bolim=ish&card=${cardId}` } }]] };
}

/** Расмларни битта хабарда (1 та — sendPhoto, кўп — sendMediaGroup) */
async function rasmlarYubor(env, chat, rasmlar) {
  if (!rasmlar.length || !yozishMumkin("sendMediaGroup", { chat_id: chat })) return;
  const fd = new FormData();
  fd.append("chat_id", String(chat));
  const blob = (r, i) => new Blob([r.bytes], { type: r.mime });
  if (rasmlar.length === 1) fd.append("photo", blob(rasmlar[0]), "rasm.jpg");
  else {
    rasmlar.slice(0, 10).forEach((r, i) => fd.append("f" + i, blob(r, i), `rasm${i}.jpg`));
    fd.append("media", JSON.stringify(rasmlar.slice(0, 10).map((_, i) => ({ type: "photo", media: "attach://f" + i }))));
  }
  try {
    await telegram(env, rasmlar.length === 1 ? "sendPhoto" : "sendMediaGroup", fd);
  } catch (e) { console.error("ish rasm:", String(e)); }
}

const TelegramKanal = {
  async yubor(env, uid, x) {
    if (!TG_TURLAR.includes(x.tur)) return false;   // бошқа хабарлар Telegram'га бормайди
    if (!yuborsaBoladi(env, uid)) return false;
    const matn = typeof x.matn === "function" ? x.matn(uid) : x.matn;
    const r = await tg(env, "sendMessage", { chat_id: uid, text: matn, parse_mode: "HTML", reply_markup: tugma(env, x.cardId) }).catch(() => null);
    if (!r || !r.ok) return false;                       // ботни бошламаган / блоклаган
    await rasmlarYubor(env, uid, (x.fayllar || []).filter((f) => rasmmi(f.mime)));
    return true;
  },
};
const KANALLAR = [TelegramKanal];

/**
 * @param {object} x { ws, cardId, kimlarga:[uid], muallif, tur, matn (HTML), kalit?, fayllar?:[{bytes,mime}] }
 *   muallif — ҳаракатни қилган одам: унинг ўзига юборилмайди (синовчидан ташқари — ўзини текшириши учун)
 *   kalit — такрорланмаслиги учун (эслатмалар): шу одамга шу калит билан аввал юборилган бўлса — ўтказилади
 */
export async function bildir(env, x) {
  const kimlar = [...new Set((x.kimlarga || []).map(Number).filter((n) => n > 0))]
    .filter((u) => u !== Number(x.muallif) || SINOVCHILAR.includes(u));
  let yetdi = 0;
  // Сайтдаги қўнғироқ учун қисқа матн (x.qisqa), бўлмаса — тўлиқ хабарнинг тозаланган кўриниши
  const toza = (t) => String(t).replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const matn0 = typeof x.matn === "function" ? x.matn(0) : x.matn;
  const oddiy = (x.qisqa ? toza(x.qisqa) : toza(matn0).replace(/\n+/g, " · ")).slice(0, 160);
  for (const uid of kimlar) {
    const r = await env.DB.prepare("INSERT OR IGNORE INTO ish_bildir (uid, ws_id, card_id, tur, matn, kalit, vaqt) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(uid, x.ws, x.cardId || null, x.tur, oddiy, x.kalit || null, new Date(Date.now()).toISOString()).run();
    if (x.kalit && !(r.meta && r.meta.changes)) continue;   // аввал юборилган эслатма
    for (const k of KANALLAR) if (await k.yubor(env, uid, x).catch(() => false)) yetdi++;
  }
  return yetdi;
}
