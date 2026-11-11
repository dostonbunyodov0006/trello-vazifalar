// src/ish/api.js (асли: src/app/ish/api.js) — 📋 Вазифалар (Trello каби) API: /api/ish/*  (Достон 2026-09-22)
//
// Workspace → Board → Устун → Карточка (+ label, checklist, изоҳ, файл, фаоллик, билдиришнома).
// Ким эканлиги — ФАҚАТ Telegram initData имзосидан (tma.js); роль — базадаги аъзоликдан.
// Ҳуқуқлар — ruxsat.js; тартиб — tartib.js; файллар — saqlash.js; хабарлар — bildirish.js.
// Ошхона, бонус, омбор, Ўрикзор кодига ва маълумотига ТЕГМАЙДИ (фақат ish_* жадваллари).
//
// Жавоб: { ok: true, ... } ёки { ok: false, xato } + HTTP ҳолат:
//   401 имзо йўқ · 403 рухсат йўқ · 404 топилмади (бегона объект ҳам — борлиги ошкор қилинмайди)
//   409 бошқа одам ўзгартириб улгурди · 422 маълумот нотўғри
import { initDataTekshir } from "../tma.js";
import { mumkin, kamida } from "./ruxsat.js";
import { orasi, tormi, qaytaRaqam, QADAM } from "./tartib.js";
import * as F from "./saqlash.js";
import { bildir, esc } from "./bildirish.js";
import { saytYol, sessiyaOl, parolAlmash } from "./sayt.js";
// Ботдаги мавжуд одамлар рўйхати — ФАҚАТ ЎҚИШ учун («Кимга?» танловида ходим ҳали Trello'ни очмаган бўлса ҳам чиқсин)
// [server] Cloudflare'да rollar.js (KV) + bonus.js эди; бу серверда — src/odamlar.js (ish_odam жадвали + нусхалар)
import { botOdamlari } from "../odamlar.js";
import {
  ochiqmi, KORADI, SINOVCHILAR, ASOSIY_WS, RAHBARLAR, ROLLAR, MUHIM, BOLIMLAR, LABEL_RANG, STANDART_USTUN, STANDART_LABEL,
  TARIF, MAX_TARIF, CHEGARA, FAYL_TUR, FONLAR, ARXIV_KUN,
} from "./sozlama.js";

/* ───────────────────────── ёрдамчилар ───────────────────────── */
const BOSH = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: BOSH });
const xato = (msg, s = 422) => json({ ok: false, xato: msg }, s);
class Xato extends Error { constructor(msg, s = 422) { super(msg); this.s = s; } }
const rad = (msg, s = 422) => { throw new Xato(msg, s); };

const hozir = () => new Date(Date.now()).toISOString();
const SOAT5 = 5 * 3600_000;
export const bugun = () => new Date(Date.now() + SOAT5).toISOString().slice(0, 10);
const tSana = (iso) => new Date(Date.parse(iso) + SOAT5).toISOString().slice(0, 10);
const kunBoshi = (sana) => new Date(Date.parse(sana + "T00:00:00Z") - SOAT5).toISOString();
const kunQosh = (sana, n) => new Date(Date.parse(sana + "T00:00:00Z") + n * 86400_000).toISOString().slice(0, 10);
const sanaMi = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
const oyMi = (s) => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const matn = (v, n) => String(v ?? "").trim().slice(0, n);
const butun = (v) => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : null; };
const sumF = (n) => Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ");
const likeQoch = (s) => "%" + String(s).replace(/[\\%_]/g, (x) => "\\" + x) + "%";
const jsonOl = (s, d) => { try { return JSON.parse(s) ?? d; } catch { return d; } };

/** Жарима: муддатдан кейинги ҳар кун × тариф. Муддат куни — йўқ. Бажарилса — ўша кунгача. */
export function jarimaHisob(c, B = bugun()) {
  if (!sanaMi(c.muddat)) return { kun: 0, summa: 0 };
  const oxiri = c.bajarildi ? tSana(c.bajarildi) : B;
  const kun = Math.max(0, Math.round((Date.parse(oxiri + "T00:00:00Z") - Date.parse(c.muddat + "T00:00:00Z")) / 86400_000));
  return { kun, summa: kun * (Number(c.tarif) || 0) };
}

/** Сўров танаси: JSON ёки multipart (файллар текширилади — тури байтларидан) */
async function tanaOl(request) {
  const ct = request.headers.get("content-type") || "";
  const uzunlik = Number(request.headers.get("content-length") || 0);
  if (uzunlik > CHEGARA.faylBayt * CHEGARA.fayllar + 65536) rad("Сўров жуда катта", 413);
  if (/multipart\/form-data/i.test(ct)) {
    let fd;
    try { fd = await request.formData(); } catch { rad("Сўров бузуқ"); }
    const m = {}, fayllar = [];
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string") { if (!(k in m)) m[k] = v; continue; }
      if (!v || typeof v.arrayBuffer !== "function" || !v.size) continue;
      if (fayllar.length >= CHEGARA.fayllar) rad(`Кўпи билан ${CHEGARA.fayllar} та файл`);
      if (v.size > CHEGARA.faylBayt) rad("Файл жуда катта (8 МБ гача)", 413);
      const bytes = new Uint8Array(await v.arrayBuffer());
      const mime = F.turAniqla(bytes, v.type || "");
      if (!mime || !FAYL_TUR[mime]) rad("Бу турдаги файл қабул қилинмайди (расм, PDF, Excel, Word)");
      fayllar.push({ bytes, mime, nom: F.nomTozala(v.name, mime) });
    }
    return { m, fayllar };
  }
  if (!/json/i.test(ct)) return { m: {}, fayllar: [] };
  try { const m = await request.json(); return { m: m && typeof m === "object" && !Array.isArray(m) ? m : {}, fayllar: [] }; }
  catch { rad("JSON бузуқ"); }
}

/* ───────────────────────── workspace ва аъзолик ───────────────────────── */
const WS_KESH = new WeakMap();   // env.DB → ws id (изолят ичида)
async function wsTayyorla(env) {
  if (WS_KESH.has(env.DB)) return WS_KESH.get(env.DB);
  let w = await env.DB.prepare("SELECT id FROM ish_ws WHERE nom = ? ORDER BY id LIMIT 1").bind(ASOSIY_WS).first();
  if (!w) {
    const v = hozir();
    const ega = Number(Object.keys(RAHBARLAR).find((id) => RAHBARLAR[id].rol === "owner"));
    // Икки киши бир вақтда биринчи марта кирса — UNIQUE(nom): биттаси яратади, иккинчиси ўшани олади
    const r = await env.DB.prepare("INSERT OR IGNORE INTO ish_ws (nom, tavsif, ega, vaqt, yangilandi) VALUES (?, '', ?, ?, ?)").bind(ASOSIY_WS, ega, v, v).run();
    w = await env.DB.prepare("SELECT id FROM ish_ws WHERE nom = ? ORDER BY id LIMIT 1").bind(ASOSIY_WS).first();
    if (r.meta.changes) await boardYarat(env, w.id, ega, "Асосий доска", "Кундалик вазифалар");
  }
  WS_KESH.set(env.DB, w.id);
  return w.id;
}

async function boardYarat(env, ws, uid, nom, tavsif) {
  const v = hozir();
  const mx = await env.DB.prepare("SELECT MAX(pos) AS p FROM ish_board WHERE ws_id = ?").bind(ws).first();
  const r = await env.DB.prepare("INSERT INTO ish_board (ws_id, nom, tavsif, pos, yaratdi, vaqt, yangilandi) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(ws, nom, tavsif, (Number(mx && mx.p) || 0) + QADAM, uid, v, v).run();
  const id = Number(r.meta.last_row_id);
  await env.DB.batch([
    ...STANDART_USTUN.map(([n, tur], i) => env.DB.prepare("INSERT INTO ish_list (board_id, nom, tur, pos, vaqt, yangilandi) VALUES (?, ?, ?, ?, ?, ?)").bind(id, n, tur, (i + 1) * QADAM, v, v)),
    ...STANDART_LABEL.map(([n, rang]) => env.DB.prepare("INSERT INTO ish_label (board_id, nom, rang, vaqt) VALUES (?, ?, ?, ?)").bind(id, n, rang, v)),
  ]);
  return id;
}

/** Ким сўраяпти: имзо → аъзолик → роль. Хато бўлса — Response. */
async function kontekst(request, env) {
  // Икки йўл: Mini App (Telegram initData имзоси) ёки веб-сайт (логин/парол → сессия cookie)
  const am = (request.headers.get("authorization") || "").match(/^tma\s+(.+)$/i);
  if (!env.DB) return xato("База (D1) уланмаган", 500);
  let uid, sayt = false;
  if (am) {
    if (!env.BOT_TOKEN) return xato("BOT_TOKEN созланмаган", 500);
    const t = await initDataTekshir(am[1], env.BOT_TOKEN);
    if (!t.ok) return xato(t.xato, 401);
    uid = t.uid;
  } else {
    const s = await sessiyaOl(env, request);
    if (!s) return xato("Кириш керак", 401);
    // CSRF ҳимояси: ўзгартирувчи сўровда сайтнинг ўз сарлавҳаси бўлиши шарт (бошқа сайт юбора олмайди)
    if (request.method !== "GET" && request.method !== "HEAD" && request.headers.get("x-ish-sayt") !== "1") return xato("Рухсат йўқ", 403);
    uid = s.uid; sayt = true;
  }
  const sinovchi = SINOVCHILAR.includes(uid);
  const ws = await wsTayyorla(env);
  let a = await env.DB.prepare("SELECT * FROM ish_azo WHERE ws_id = ? AND uid = ?").bind(ws, uid).first();
  // Сайт — фақат раҳбарлар (Сардор ака, Мурод ака)
  if (sayt && !(RAHBARLAR[uid] || (a && a.faol && kamida(a.rol, "admin")))) return xato("Сайт фақат раҳбарлар учун", 403);
  // Ёпиқ пайтда: фақат KORADI рўйхатидагилар киради — аъзо бўлса ҳам бошқа ҳеч ким кира олмайди
  if (!ochiqmi(env) && !KORADI.includes(uid)) return xato("Бу бўлим ҳозирча ёпиқ", 403);
  if (!a) {
    // Биринчи кириш: раҳбарлар — созламадаги роли билан; ходим — ФАҚАТ ботдаги рўйхатда бўлса (Бонуслар каби).
    // Бегона Telegram фойдаланувчиси аъзо бўлмайди ва «Ходимни танланг» рўйхатига тушмайди.
    const r = RAHBARLAR[uid];
    const bot = r ? null : (await botOdamlari(env)).get(uid);
    if (!r && !bot) return xato("Сиз ходимлар рўйхатида йўқсиз", 403);
    const ism = r ? r.ism : bot.ism.slice(0, CHEGARA.ism);
    await env.DB.prepare("INSERT OR IGNORE INTO ish_azo (ws_id, uid, rol, ism, tarif, qoshildi) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(ws, uid, r ? r.rol : "member", ism, TARIF, hozir()).run();
    a = await env.DB.prepare("SELECT * FROM ish_azo WHERE ws_id = ? AND uid = ?").bind(ws, uid).first();
  }
  if (!a.faol) return xato("Сиз бу бўлимдан чиқарилгансиз", 403);
  // Роль — базадаги аъзоликдан. Илова бошқа бўлимда (сотувчи ва ҳ.к.) турса «X-Ish-Rol: member» юборади —
  // раҳбар ҳам ўша ерда ходим сифатида кўради (Достон 2026-09-22). Сарлавҳа фақат ПАСАЙТИРАДИ, ҳеч қачон оширмайди.
  const rol = !sayt && request.headers.get("x-ish-rol") === "member" ? "member" : a.rol;
  if (sayt && !kamida(rol, "admin")) return xato("Сайт фақат раҳбарлар учун", 403);
  return { uid, ws, rol, ism: a.ism, sinovchi, sayt };
}

/* botOdamlari() — src/odamlar.js да (асл мантиқ ўзгармаган) */
/** Вазифа бериладиган одам: аъзо бўлса — ўзи; ботда бор бўлса — аъзо қилиб қўшилади (member) */
async function ijrochiOl(env, k, uid) {
  if (!uid) rad("Кимга беришни танланг");
  let a = await env.DB.prepare("SELECT uid, tarif, faol FROM ish_azo WHERE ws_id = ? AND uid = ?").bind(k.ws, uid).first();
  if (a && !a.faol) rad("Бу ходим бўлимдан чиқарилган");
  if (a) return a;
  const bot = (await botOdamlari(env)).get(uid);
  if (!bot) rad("Бу одам ботда топилмади");
  await env.DB.prepare("INSERT OR IGNORE INTO ish_azo (ws_id, uid, rol, ism, bolim, tarif, qoshildi) VALUES (?, ?, 'member', ?, '', ?, ?)")
    .bind(k.ws, uid, bot.ism.slice(0, CHEGARA.ism), TARIF, hozir()).run();
  return env.DB.prepare("SELECT uid, tarif, faol FROM ish_azo WHERE ws_id = ? AND uid = ?").bind(k.ws, uid).first();
}
/** Устун → оддий ҳолат: done — бажарилди; доскадаги биринчи оддий устун — янги; қолгани — жараёнда */
function holatTop(lists) {
  const bir = new Map();
  for (const l of [...lists].sort((a, b) => a.pos - b.pos)) if (l.tur !== "done" && !bir.has(l.board_id)) bir.set(l.board_id, l.id);
  return (c) => { const l = lists.find((x) => x.id === c.list_id); return !l ? "jarayon" : l.tur === "done" ? "bajarildi" : bir.get(l.board_id) === l.id ? "yangi" : "jarayon"; };
}

/* ───────────────────────── ўқиш ───────────────────────── */
async function azolarOl(env, ws) {
  const { results } = await env.DB.prepare("SELECT uid, ism, rol, bolim, tarif, faol FROM ish_azo WHERE ws_id = ?").bind(ws).all();
  return new Map((results || []).map((r) => [Number(r.uid), r]));
}
const ismi = (M, id) => (id == null ? "" : (M.get(Number(id)) || {}).ism || String(id));

async function boardOl(env, k, id, { faol = true } = {}) {
  const b = await env.DB.prepare(`SELECT * FROM ish_board WHERE id = ? AND ws_id = ?${faol ? " AND arxiv IS NULL" : ""}`).bind(butun(id) || 0, k.ws).first();
  if (!b || !mumkin(k, "board.kor")) rad("Доска топилмади", 404);
  return b;
}
async function listOl(env, boardId, id) {
  const l = await env.DB.prepare("SELECT * FROM ish_list WHERE id = ? AND board_id = ? AND arxiv IS NULL").bind(butun(id) || 0, boardId).first();
  if (!l) rad("Устун топилмади", 404);
  return l;
}
/** Карточка + ҳуқуқ. Бегона/кўринмайдиган карточка — 404 (борлиги ошкор қилинмайди) */
async function kartaOl(env, k, id, amal = "card.kor") {
  const c = await env.DB.prepare(
    "SELECT c.*, b.ws_id, l.tur AS list_tur, l.nom AS list_nom FROM ish_card c JOIN ish_board b ON b.id = c.board_id JOIN ish_list l ON l.id = c.list_id WHERE c.id = ? AND c.ochirildi = 0 AND b.ws_id = ?")
    .bind(butun(id) || 0, k.ws).first();
  if (!c || !mumkin(k, "card.kor", c)) rad("Вазифа топилмади", 404);
  if (amal !== "card.kor" && !mumkin(k, amal, c)) rad("Бунга рухсатингиз йўқ", 403);
  return c;
}

/** Бажарувчилар рўйхати: ",1,2,3," → [1, 2, 3] */
const ijroRo = (c) => {
  const r = String(c.ijro || "").split(",").map(Number).filter((n) => n > 0);
  if (!r.length && c.kimga != null) return [Number(c.kimga)];
  return r;
};
/** [1,2,3] → ",1,2,3," */
const ijroMatn = (ro) => (ro.length ? "," + ro.join(",") + "," : null);
/** SQL шарти: шу одам бажарувчиларданми (битта bind) */
const IJRO_SH = "instr(COALESCE(c.ijro, ',' || c.kimga || ','), ',' || CAST(? AS INTEGER) || ',') > 0";

function kartaDTO(c, M, B) {
  const j = jarimaHisob(c, B);
  return {
    id: c.id, board_id: c.board_id, list_id: c.list_id, nom: c.nom, tavsif: c.tavsif, pos: c.pos, muhim: c.muhim, boshlanish: c.boshlanish || "",
    yaratdi: Number(c.yaratdi), yaratdiIsm: ismi(M, c.yaratdi), kimga: c.kimga == null ? null : Number(c.kimga), kimgaIsm: ismi(M, c.kimga),
    kimgaBolim: c.kimga == null ? "" : (M.get(Number(c.kimga)) || {}).bolim || "",
    // Қўшимча бажарувчилар (ихтиёрий) — битта вазифани 3 тагача кишига бериш (Достон 2026-10-06)
    ijro: ijroRo(c).map((u) => ({ id: u, ism: ismi(M, u) })),
    muddat: c.muddat || null, tarif: Number(c.tarif) || 0, vaqt: c.vaqt, yangilandi: c.yangilandi,
    bajarildi: c.bajarildi || null, arxiv: c.arxiv || null, ver: Number(c.ver),
    kech: !c.bajarildi && !!c.muddat && c.muddat < B, jarimaKun: j.kun,
    // Жарима — Сардор ака / Мурод ака ҚЎЛДА ёзгани (Достон 2026-09-22); tavsiya — кечиккан кун × тариф (фақат таклиф)
    jarima: Number(c.jarima) || 0, tavsiya: j.summa,
    // Бонус — вазифа ўз вақтида бажарилганда раҳбар ёзади (Достон 2026-10-06)
    bonus: Number(c.bonus) || 0,
  };
}

/** Карточкалар учун қўшимча (N+1 йўқ: ҳар бири битта GROUP BY сўров, board/рўйхат бўйича) */
async function qoshimcha(env, sub, arg) {
  const [iz, fy, ch, lb, mq] = await Promise.all([
    env.DB.prepare(`SELECT card_id, COUNT(*) AS n FROM ish_izoh WHERE ochirildi IS NULL AND card_id IN (${sub}) GROUP BY card_id`).bind(...arg).all(),
    env.DB.prepare(`SELECT card_id, COUNT(*) AS n FROM ish_fayl WHERE ochirildi IS NULL AND card_id IN (${sub}) GROUP BY card_id`).bind(...arg).all(),
    env.DB.prepare(`SELECT cl.card_id, COUNT(i.id) AS n, COALESCE(SUM(i.bajarildi), 0) AS ok FROM ish_checklist cl JOIN ish_chk_item i ON i.checklist_id = cl.id WHERE cl.card_id IN (${sub}) GROUP BY cl.card_id`).bind(...arg).all(),
    env.DB.prepare(`SELECT card_id, label_id FROM ish_card_label WHERE card_id IN (${sub})`).bind(...arg).all(),
    env.DB.prepare(`SELECT card_id, MIN(id) AS id FROM ish_fayl WHERE ochirildi IS NULL AND izoh_id IS NULL AND mime LIKE 'image/%' AND card_id IN (${sub}) GROUP BY card_id`).bind(...arg).all(),
  ]);
  const m = (r) => new Map((r.results || []).map((x) => [x.card_id, x]));
  const I = m(iz), Fy = m(fy), C = m(ch), Q = m(mq), L = new Map();
  for (const x of lb.results || []) L.set(x.card_id, [...(L.get(x.card_id) || []), x.label_id]);
  return (id) => ({
    soni: { izoh: Number((I.get(id) || {}).n) || 0, fayl: Number((Fy.get(id) || {}).n) || 0, chk: Number((C.get(id) || {}).n) || 0, chkOk: Number((C.get(id) || {}).ok) || 0 },
    labels: L.get(id) || [], muqova: (Q.get(id) || {}).id || null,
  });
}

/** Фаоллик ёзуви (аудит) — statement қайтаради, batch'га қўшиш учун */
const faolSt = (env, k, board, card, amal, meta = {}) =>
  env.DB.prepare("INSERT INTO ish_faol (ws_id, board_id, card_id, uid, amal, meta, vaqt) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(k.ws, board ?? null, card ?? null, k.uid, amal, JSON.stringify(meta), hozir());

/** Карточка фильтрлари (board ва қидирув учун умумий) — SQL бўлаги + параметрлар */
function filtrlar(q, k, B) {
  const w = [], a = [];
  if (!kamida(k.rol, "admin")) { w.push(IJRO_SH); a.push(k.uid); }
  else if (butun(q.get("kimga"))) { w.push(IJRO_SH); a.push(butun(q.get("kimga"))); }
  if (MUHIM.includes(q.get("muhim"))) { w.push("c.muhim = ?"); a.push(q.get("muhim")); }
  if (butun(q.get("label"))) { w.push("EXISTS (SELECT 1 FROM ish_card_label x WHERE x.card_id = c.id AND x.label_id = ?)"); a.push(butun(q.get("label"))); }
  const s = matn(q.get("q"), 60);
  if (s.length >= 2) { w.push("(c.nom LIKE ? ESCAPE '\\' OR c.tavsif LIKE ? ESCAPE '\\')"); a.push(likeQoch(s), likeQoch(s)); }
  const md = q.get("muddat");
  if (md === "kech") { w.push("c.bajarildi IS NULL AND c.muddat < ?"); a.push(B); }
  else if (md === "bugun") { w.push("c.bajarildi IS NULL AND c.muddat = ?"); a.push(B); }
  else if (md === "hafta") { w.push("c.bajarildi IS NULL AND c.muddat BETWEEN ? AND ?"); a.push(B, kunQosh(B, 7)); }
  return { w, a };
}

/* ───────────────────────── тартиб ───────────────────────── */
/**
 * Янги ўрин: мижоз фақат қўшниларнинг id сини беради (oldin — тепадаги, keyin — пастдаги).
 * Қўшнилар шу рўйхатда эканлиги текширилади; жой торайса — ўша рўйхат қайта рақамланади.
 * jadval/ota — масалан ish_card/list_id.
 */
async function orinTop(env, jadval, ota, otaId, oldinId, keyinId, qoshimchaShart = "") {
  const posOl = async (id) => {
    if (!butun(id)) return null;
    const r = await env.DB.prepare(`SELECT pos FROM ${jadval} WHERE id = ? AND ${ota} = ?${qoshimchaShart}`).bind(butun(id), otaId).first();
    if (!r) rad("Тартиб эскирган — саҳифани янгиланг", 409);
    return Number(r.pos);
  };
  let [o, kk] = [await posOl(oldinId), await posOl(keyinId)];
  if (o == null && kk == null) {
    const mx = await env.DB.prepare(`SELECT MAX(pos) AS p FROM ${jadval} WHERE ${ota} = ?${qoshimchaShart}`).bind(otaId).first();
    return (Number(mx && mx.p) || 0) + QADAM;
  }
  if (o != null && kk != null && o >= kk) rad("Тартиб эскирган — саҳифани янгиланг", 409);
  let p = orasi(o, kk);
  if (tormi(o, kk, p)) {
    const { results } = await env.DB.prepare(`SELECT id FROM ${jadval} WHERE ${ota} = ?${qoshimchaShart} ORDER BY pos, id`).bind(otaId).all();
    await env.DB.batch(qaytaRaqam((results || []).map((r) => r.id)).map(([id, pos]) => env.DB.prepare(`UPDATE ${jadval} SET pos = ? WHERE id = ?`).bind(pos, id)));
    [o, kk] = [await posOl(oldinId), await posOl(keyinId)];
    p = orasi(o, kk);
  }
  return p;
}

/* ───────────────────────── файллар ───────────────────────── */
async function fayllarSaqla(env, k, card, fayllar, izohId = null) {
  const st = [];
  for (const f of fayllar) {
    const r = await F.yukla(env, f);
    if (r.xato) rad(r.xato, 413);
    st.push(env.DB.prepare("INSERT INTO ish_fayl (card_id, izoh_id, nom, kalit, mime, hajm, yukladi, vaqt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(card.id, izohId, f.nom, r.kalit, f.mime, f.bytes.length, k.uid, hozir()));
  }
  return st;
}

/* ───────────────────────── билдиришнома матнлари ───────────────────────── */
/** Сана: 2026-10-09 → «9 октябр» */
const TG_OY = ["январ", "феврал", "март", "апрел", "май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
function sanaMatn(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [, oy, kun] = s.split("-");
  return Number(kun) + " " + (TG_OY[Number(oy) - 1] || "");
}
/** Муддат ҳолати — расмий тилда */
function qolgan(muddat, B2) {
  if (!muddat) return "";
  const k = Math.round((Date.parse(muddat + "T00:00:00Z") - Date.parse(B2 + "T00:00:00Z")) / 86400000);
  if (k < 0) return ` (муддат ${-k} кунга ўтиб кетган)`;
  if (k === 0) return " (муддат бугун тугайди)";
  if (k === 1) return " (муддат тугашига 1 кун қолди)";
  return ` (муддат тугашига ${k} кун қолди)`;
}
const TG_MUHIM = {
  urgent: "🔴 Зудлик билан бажарилиши лозим",
  high: "🟡 Тезроқ бажарилиши лозим",
  medium: "🟢 Шошилмасдан, сифатли бажарилиши лозим",
  low: "🟢 Шошилмасдан, сифатли бажарилиши лозим",
};

/** Ходимга Telegram'га кетадиган расмий хабар. Қайтариши — (uid) => матн */
function berildiMatn(c, k, B2, M) {
  const ism = (u) => { const a = M && M.get(Number(u)); return a && a.ism ? a.ism : ""; };
  return (uid) => {
    const q = [];
    const kimga = ism(uid);
    if (kimga) q.push(`<b>${esc(kimga)}</b>`);
    q.push("Сизга қуйидаги вазифа бириктирилди.");
    q.push("");
    q.push("📌 <b>Вазифа</b>");
    q.push(esc(c.nom));
    if (c.tavsif) {
      q.push("");
      q.push("📝 <b>Вазифа мазмуни</b>");
      q.push(esc(String(c.tavsif).slice(0, 500)));
    }
    q.push("");
    q.push(`👤 <b>Топширувчи:</b> ${esc(k && k.ism ? k.ism : "Раҳбарият")}`);
    if (c.boshlanish) q.push(`🗓 <b>Бошланиш санаси:</b> ${sanaMatn(c.boshlanish)}`);
    if (c.muddat) q.push(`⏳ <b>Тугатиш муддати:</b> ${sanaMatn(c.muddat)}${qolgan(c.muddat, B2 || bugun())}`);
    q.push(`🚦 <b>Бажариш тартиби:</b> ${TG_MUHIM[c.muhim] || TG_MUHIM.medium}`);
    return q.join("\n");
  };
}
/** Ходим жавоб берса — ҳамма раҳбарларга (Сардор ака, Мурод ака) + вазифани берганга */
async function rahbarlar(env, k, c) {
  const M = await azolarOl(env, k.ws);
  const ro = [...M.values()].filter((a) => a.faol && kamida(a.rol, "admin") && !SINOVCHILAR.includes(Number(a.uid))).map((a) => Number(a.uid));
  return [...new Set([...ro, Number(c.yaratdi)])];
}

/* ═════════════════════════ API ═════════════════════════ */
export async function ishApi(request, env) {
  try {
    return await yonaltir(request, env);
  } catch (e) {
    if (e instanceof Xato) return xato(e.message, e.s);
    console.error("ish api:", e && e.stack || e);
    return xato("Сервер хатоси — қайта уриниб кўринг", 500);
  }
}

async function yonaltir(request, env) {
  const url = new URL(request.url);
  const yol = url.pathname.replace(/^\/api\/ish/, "") || "/";
  const usul = request.method.toUpperCase();
  const q = url.searchParams;
  // 🖥 Сайтга кириш/чиқиш — сессия ҳали йўқ пайтда (фақат раҳбарлар кира олади)
  const sy = await saytYol(request, env, yol, async (uid) => {
    if (RAHBARLAR[uid]) return true;
    const a = await env.DB.prepare("SELECT rol, faol FROM ish_azo WHERE uid = ? LIMIT 1").bind(uid).first();
    return !!a && !!a.faol && kamida(a.rol, "admin");
  });
  if (sy) return sy;
  const k = await kontekst(request, env);
  if (k instanceof Response) return k;
  const B = bugun();
  let mm;
  const DB = env.DB;

  /* ─── мен ─── */
  if (yol === "/men" && usul === "GET") {
    const n = await DB.prepare("SELECT COUNT(*) AS n FROM ish_bildir WHERE uid = ? AND oqildi = 0").bind(k.uid).first();
    const ws = await DB.prepare("SELECT id, nom FROM ish_ws WHERE id = ?").bind(k.ws).first();
    return json({ ok: true, uid: k.uid, ism: k.ism, rol: k.rol, admin: kamida(k.rol, "admin"), owner: kamida(k.rol, "owner"),
      sinovchi: k.sinovchi, ochiq: ochiqmi(env), bugun: B, ws, bolimlar: BOLIMLAR, muhim: MUHIM, ranglar: LABEL_RANG, tarif: TARIF,
      oqilmagan: Number(n && n.n) || 0 });
  }

  /* ─── аъзолар ─── */
  if (yol === "/azolar" && usul === "GET") {
    if (!mumkin(k, "azo.kor")) rad("Рухсат йўқ", 403);
    const M = await azolarOl(env, k.ws);
    return json({ ok: true, azolar: [...M.values()].map((a) => ({ id: Number(a.uid), ism: a.ism, rol: a.rol, bolim: a.bolim, tarif: Number(a.tarif), faol: !!a.faol }))
      .sort((x, y) => (y.faol - x.faol) || x.ism.localeCompare(y.ism, "ru")) });
  }
  if ((mm = yol.match(/^\/azolar\/(\d{1,15})$/)) && usul === "PUT") {
    if (!mumkin(k, "azo.boshqar")) rad("Аъзоларни фақат эгаси (owner) ўзгартиради", 403);
    const id = Number(mm[1]);
    const a = await DB.prepare("SELECT * FROM ish_azo WHERE ws_id = ? AND uid = ?").bind(k.ws, id).first();
    if (!a) rad("Аъзо топилмади", 404);
    const { m: f } = await tanaOl(request);
    const st = [], meta = {};
    if (f.ism !== undefined) { const ism = matn(f.ism, CHEGARA.ism); if (ism.length < 2) rad("Исм жуда қисқа"); st.push(DB.prepare("UPDATE ish_azo SET ism = ? WHERE ws_id = ? AND uid = ?").bind(ism, k.ws, id)); meta.ism = ism; }
    if (f.bolim !== undefined) { if (f.bolim && !BOLIMLAR[f.bolim]) rad("Бўлим нотўғри"); st.push(DB.prepare("UPDATE ish_azo SET bolim = ? WHERE ws_id = ? AND uid = ?").bind(f.bolim || "", k.ws, id)); meta.bolim = f.bolim || ""; }
    if (f.tarif !== undefined) { const t = Number(f.tarif); if (!Number.isInteger(t) || t < 0 || t > MAX_TARIF) rad("Тариф 0 … 10 000 000 сўм"); st.push(DB.prepare("UPDATE ish_azo SET tarif = ? WHERE ws_id = ? AND uid = ?").bind(t, k.ws, id)); meta.tarif = t; }
    if (f.rol !== undefined || f.faol !== undefined) {
      if (id === k.uid) rad("Ўз ролингизни ўзгартира олмайсиз", 403);
      if (a.rol === "owner") {
        const n = await DB.prepare("SELECT COUNT(*) AS n FROM ish_azo WHERE ws_id = ? AND rol = 'owner' AND faol = 1").bind(k.ws).first();
        if (Number(n.n) <= 1) rad("Охирги эгасини ўзгартириб бўлмайди", 409);
      }
    }
    if (f.rol !== undefined) { if (!ROLLAR.includes(f.rol)) rad("Роль нотўғри"); st.push(DB.prepare("UPDATE ish_azo SET rol = ? WHERE ws_id = ? AND uid = ?").bind(f.rol, k.ws, id)); meta.rol = f.rol; }
    if (f.faol !== undefined) { st.push(DB.prepare("UPDATE ish_azo SET faol = ? WHERE ws_id = ? AND uid = ?").bind(f.faol ? 1 : 0, k.ws, id)); meta.faol = !!f.faol; }
    if (!st.length) rad("Ўзгариш йўқ");
    st.push(faolSt(env, k, null, null, "azo.ozgardi", { uid: id, ...meta }));
    await DB.batch(st);
    return json({ ok: true });
  }

  /* ─── доскалар ─── */
  if (yol === "/boards" && usul === "GET") {
    const { results } = await DB.prepare("SELECT id, nom, tavsif, pos, fon FROM ish_board WHERE ws_id = ? AND arxiv IS NULL ORDER BY pos, id").bind(k.ws).all();
    const menSh = kamida(k.rol, "admin") ? "" : " AND " + IJRO_SH;
    const { results: s } = await DB.prepare(
      `SELECT c.board_id, COUNT(*) AS ochiq, SUM(CASE WHEN c.muddat < ? THEN 1 ELSE 0 END) AS kech FROM ish_card c JOIN ish_board b ON b.id = c.board_id
       WHERE b.ws_id = ? AND c.ochirildi = 0 AND c.arxiv IS NULL AND c.bajarildi IS NULL${menSh} GROUP BY c.board_id`)
      .bind(B, k.ws, ...(menSh ? [k.uid] : [])).all();
    const S = new Map((s || []).map((x) => [x.board_id, x]));
    return json({ ok: true, boards: (results || []).map((b) => ({ ...b, ochiq: Number((S.get(b.id) || {}).ochiq) || 0, kech: Number((S.get(b.id) || {}).kech) || 0 })) });
  }
  if (yol === "/boards" && usul === "POST") {
    if (!mumkin(k, "board.boshqar")) rad("Доскани раҳбар яратади", 403);
    const { m: f } = await tanaOl(request);
    const nom = matn(f.nom, 80);
    if (nom.length < 2) rad("Доска номини ёзинг");
    const id = await boardYarat(env, k.ws, k.uid, nom, matn(f.tavsif, 300));
    await faolSt(env, k, id, null, "board.yarat", { nom }).run();
    return json({ ok: true, id });
  }
  if ((mm = yol.match(/^\/boards\/(\d+)$/))) {
    if (usul === "GET") return boardKorish(env, k, mm[1], q, B);
    if (usul === "PATCH") {
      if (!mumkin(k, "board.boshqar")) rad("Рухсат йўқ", 403);
      const b = await boardOl(env, k, mm[1], { faol: false });
      const { m: f } = await tanaOl(request);
      const st = [], meta = {};
      if (f.nom !== undefined) { const nom = matn(f.nom, 80); if (nom.length < 2) rad("Доска номини ёзинг"); st.push(DB.prepare("UPDATE ish_board SET nom = ? WHERE id = ?").bind(nom, b.id)); meta.nom = nom; }
      if (f.tavsif !== undefined) st.push(DB.prepare("UPDATE ish_board SET tavsif = ? WHERE id = ?").bind(matn(f.tavsif, 300), b.id));
      if (f.fon !== undefined) { const fn = String(f.fon || ""); if (fn && !FONLAR.includes(fn)) rad("Бундай фон йўқ"); st.push(DB.prepare("UPDATE ish_board SET fon = ? WHERE id = ?").bind(fn, b.id)); }
      if (f.arxiv !== undefined) {
        if (f.arxiv) { const n = await DB.prepare("SELECT COUNT(*) AS n FROM ish_board WHERE ws_id = ? AND arxiv IS NULL").bind(k.ws).first(); if (Number(n.n) <= 1 && !b.arxiv) rad("Битта доска қолиши керак", 409); }
        st.push(DB.prepare("UPDATE ish_board SET arxiv = ? WHERE id = ?").bind(f.arxiv ? hozir() : null, b.id)); meta.arxiv = !!f.arxiv;
      }
      if (f.oldin !== undefined || f.keyin !== undefined) st.push(DB.prepare("UPDATE ish_board SET pos = ? WHERE id = ?").bind(await orinTop(env, "ish_board", "ws_id", k.ws, f.oldin, f.keyin, " AND arxiv IS NULL"), b.id));
      if (!st.length) rad("Ўзгариш йўқ");
      st.push(DB.prepare("UPDATE ish_board SET yangilandi = ? WHERE id = ?").bind(hozir(), b.id));
      if (Object.keys(meta).length) st.push(faolSt(env, k, b.id, null, meta.arxiv !== undefined ? (meta.arxiv ? "board.arxiv" : "board.tiklash") : "board.ozgardi", meta));
      await DB.batch(st);
      return json({ ok: true });
    }
  }

  /* ─── устунлар ─── */
  if ((mm = yol.match(/^\/boards\/(\d+)\/lists$/)) && usul === "POST") {
    if (!mumkin(k, "list.boshqar")) rad("Устунни раҳбар яратади", 403);
    const b = await boardOl(env, k, mm[1]);
    const { m: f } = await tanaOl(request);
    const nom = matn(f.nom, 40);
    if (!nom) rad("Устун номини ёзинг");
    const tur = f.tur === "done" ? "done" : "";
    const pos = await orinTop(env, "ish_list", "board_id", b.id, f.oldin, f.keyin, " AND arxiv IS NULL");
    const r = await DB.prepare("INSERT INTO ish_list (board_id, nom, tur, pos, vaqt, yangilandi) VALUES (?, ?, ?, ?, ?, ?)").bind(b.id, nom, tur, pos, hozir(), hozir()).run();
    await faolSt(env, k, b.id, null, "list.yarat", { nom }).run();
    return json({ ok: true, id: Number(r.meta.last_row_id) });
  }
  if ((mm = yol.match(/^\/lists\/(\d+)$/)) && usul === "PATCH") {
    if (!mumkin(k, "list.boshqar")) rad("Рухсат йўқ", 403);
    const l0 = await DB.prepare("SELECT l.* FROM ish_list l JOIN ish_board b ON b.id = l.board_id WHERE l.id = ? AND b.ws_id = ? AND l.arxiv IS NULL").bind(Number(mm[1]), k.ws).first();
    if (!l0) rad("Устун топилмади", 404);
    const { m: f } = await tanaOl(request);
    const st = [], meta = {};
    if (f.nom !== undefined) { const nom = matn(f.nom, 40); if (!nom) rad("Устун номини ёзинг"); st.push(DB.prepare("UPDATE ish_list SET nom = ? WHERE id = ?").bind(nom, l0.id)); meta.nom = nom; }
    if (f.tur !== undefined) st.push(DB.prepare("UPDATE ish_list SET tur = ? WHERE id = ?").bind(f.tur === "done" ? "done" : "", l0.id));
    if (f.arxiv) {
      const n = await DB.prepare("SELECT COUNT(*) AS n FROM ish_card WHERE list_id = ? AND ochirildi = 0 AND arxiv IS NULL AND (bajarildi IS NULL OR bajarildi >= ?)").bind(l0.id, kunBoshi(B)).first();
      if (Number(n.n)) rad("Аввал устундаги вазифаларни бошқа устунга ўтказинг", 409);
      const m2 = await DB.prepare("SELECT COUNT(*) AS n FROM ish_list WHERE board_id = ? AND arxiv IS NULL").bind(l0.board_id).first();
      if (Number(m2.n) <= 1) rad("Доскада камида битта устун қолиши керак", 409);
      st.push(DB.prepare("UPDATE ish_list SET arxiv = ? WHERE id = ?").bind(hozir(), l0.id)); meta.arxiv = true;
    }
    if (f.oldin !== undefined || f.keyin !== undefined) st.push(DB.prepare("UPDATE ish_list SET pos = ? WHERE id = ?").bind(await orinTop(env, "ish_list", "board_id", l0.board_id, f.oldin, f.keyin, " AND arxiv IS NULL"), l0.id));
    if (!st.length) rad("Ўзгариш йўқ");
    st.push(DB.prepare("UPDATE ish_list SET yangilandi = ? WHERE id = ?").bind(hozir(), l0.id));
    if (Object.keys(meta).length) st.push(faolSt(env, k, l0.board_id, null, meta.arxiv ? "list.arxiv" : "list.ozgardi", meta));
    await DB.batch(st);
    return json({ ok: true });
  }

  /* ─── label ─── */
  if ((mm = yol.match(/^\/boards\/(\d+)\/labels$/)) && usul === "POST") {
    if (!mumkin(k, "label.boshqar")) rad("Рухсат йўқ", 403);
    const b = await boardOl(env, k, mm[1]);
    const { m: f } = await tanaOl(request);
    const nom = matn(f.nom, CHEGARA.label), rang = String(f.rang || "");
    if (!nom) rad("Label номини ёзинг");
    if (!/^#[0-9A-Fa-f]{6}$/.test(rang)) rad("Ранг нотўғри");
    const bor = await DB.prepare("SELECT id FROM ish_label WHERE board_id = ? AND nom = ?").bind(b.id, nom).first();
    if (bor) rad("Бундай label бор", 409);
    const r = await DB.prepare("INSERT INTO ish_label (board_id, nom, rang, vaqt) VALUES (?, ?, ?, ?)").bind(b.id, nom, rang, hozir()).run();
    return json({ ok: true, id: Number(r.meta.last_row_id) });
  }
  if ((mm = yol.match(/^\/labels\/(\d+)$/)) && (usul === "PATCH" || usul === "DELETE")) {
    if (!mumkin(k, "label.boshqar")) rad("Рухсат йўқ", 403);
    const lb = await DB.prepare("SELECT x.* FROM ish_label x JOIN ish_board b ON b.id = x.board_id WHERE x.id = ? AND b.ws_id = ?").bind(Number(mm[1]), k.ws).first();
    if (!lb) rad("Label топилмади", 404);
    if (usul === "DELETE") {
      await DB.batch([DB.prepare("DELETE FROM ish_card_label WHERE label_id = ?").bind(lb.id), DB.prepare("DELETE FROM ish_label WHERE id = ?").bind(lb.id)]);
      return json({ ok: true });
    }
    const { m: f } = await tanaOl(request);
    const nom = f.nom !== undefined ? matn(f.nom, CHEGARA.label) : lb.nom, rang = f.rang !== undefined ? String(f.rang) : lb.rang;
    if (!nom) rad("Label номини ёзинг");
    if (!/^#[0-9A-Fa-f]{6}$/.test(rang)) rad("Ранг нотўғри");
    const bor = await DB.prepare("SELECT id FROM ish_label WHERE board_id = ? AND nom = ? AND id != ?").bind(lb.board_id, nom, lb.id).first();
    if (bor) rad("Бундай label бор", 409);
    await DB.prepare("UPDATE ish_label SET nom = ?, rang = ? WHERE id = ?").bind(nom, rang, lb.id).run();
    return json({ ok: true });
  }

  /* ─── карточка яратиш ─── */
  if ((mm = yol.match(/^\/boards\/(\d+)\/cards$/)) && usul === "POST") {
    if (!mumkin(k, "card.yarat")) rad("Вазифани фақат Сардор ака ва Мурод ака беради", 403);
    const b = await boardOl(env, k, mm[1]);
    const { m: f, fayllar } = await tanaOl(request);
    const nom = matn(f.nom, CHEGARA.nom);
    if (nom.length < 2) rad("Вазифа номини ёзинг");
    const list = f.list_id ? await listOl(env, b.id, f.list_id)
      : await DB.prepare("SELECT * FROM ish_list WHERE board_id = ? AND arxiv IS NULL AND tur = '' ORDER BY pos LIMIT 1").bind(b.id).first();
    if (!list) rad("Устун топилмади", 404);
    const kimga = butun(f.kimga);
    const azo = await ijrochiOl(env, k, kimga);
    // Қўшимча бажарувчилар — хоҳлаганча (биринчиси kimga, қолгани ijro'да)
    const qoshimcha = (typeof f.ijrochilar === "string" ? jsonOl(f.ijrochilar, []) : f.ijrochilar) || [];
    const ijro = [kimga, ...(Array.isArray(qoshimcha) ? qoshimcha : []).map(butun).filter(Boolean)];
    if (new Set(ijro).size !== ijro.length) rad("Битта ходим икки марта танланмасин");
    if (ijro.length > CHEGARA.ijro) rad(`Кўпи билан ${CHEGARA.ijro} та ходим`);
    for (const u of ijro.slice(1)) await ijrochiOl(env, k, u);
    const muddat = matn(f.muddat, 10);
    if (!sanaMi(muddat)) rad("Муддатни (санани) танланг");
    if (muddat < B) rad("Муддат ўтиб кетган санага қўйилмайди");
    const muhim = MUHIM.includes(f.muhim) ? f.muhim : "medium";
    const boshlanish = matn(f.boshlanish, 10);                       // ихтиёрий: қачондан бошлаш
    if (boshlanish && !sanaMi(boshlanish)) rad("Бошланиш санаси нотўғри");
    if (boshlanish && boshlanish > muddat) rad("Бошланиш санаси муддатдан кейин бўлмасин");
    const labels = await labelTekshir(env, b.id, typeof f.labels === "string" ? jsonOl(f.labels, []) : f.labels);
    const v = hozir();
    const pos = await orinTop(env, "ish_card", "list_id", list.id, null, null, " AND ochirildi = 0");
    const r = await DB.prepare(
      "INSERT INTO ish_card (board_id, list_id, nom, tavsif, pos, muhim, yaratdi, kimga, ijro, muddat, boshlanish, tarif, vaqt, yangilandi, bajarildi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(b.id, list.id, nom, matn(f.tavsif, CHEGARA.tavsif), pos, muhim, k.uid, kimga, ijroMatn(ijro), muddat, boshlanish || null, Number(azo.tarif) || 0, v, v, list.tur === "done" ? v : null).run();
    const card = { id: Number(r.meta.last_row_id), board_id: b.id };
    await DB.batch([
      faolSt(env, k, b.id, card.id, "card.yarat", { nom, list: list.nom, kimga, ijro, muddat }),
      ...labels.map((l) => DB.prepare("INSERT INTO ish_card_label (card_id, label_id) VALUES (?, ?)").bind(card.id, l)),
      ...(await fayllarSaqla(env, k, card, fayllar)),
    ]);
    const c = await DB.prepare("SELECT * FROM ish_card WHERE id = ?").bind(card.id).first();
    // Хабарда фақат «Сизга вазифа келди» + кимдан; вазифа ўзи (матн, расм) — тугма орқали иловада
    const M = await azolarOl(env, k.ws);
    await bildir(env, { ws: k.ws, cardId: c.id, kimlarga: ijro, muallif: k.uid, tur: "berildi", matn: berildiMatn(c, k, B, M), qisqa: `Янги вазифа: ${nom}` });
    return json({ ok: true, card: kartaDTO(c, M, B) });
  }

  /* ─── карточка ─── */
  if ((mm = yol.match(/^\/cards\/(\d+)$/))) {
    if (usul === "GET") return kartaKorish(env, k, mm[1], B);
    if (usul === "PATCH") return kartaTahrir(env, k, mm[1], request, B);
    if (usul === "DELETE") {
      const c = await kartaOl(env, k, mm[1], "card.ochir");
      await DB.batch([DB.prepare("UPDATE ish_card SET ochirildi = 1, yangilandi = ?, ver = ver + 1 WHERE id = ?").bind(hozir(), c.id),
        faolSt(env, k, c.board_id, c.id, "card.ochir", { nom: c.nom })]);
      return json({ ok: true });
    }
  }
  if ((mm = yol.match(/^\/cards\/(\d+)\/kochir$/)) && usul === "POST") return kartaKochir(env, k, mm[1], request, B);
  // 📑 Вазифадан нусха: бир хил ишни қайта бериш учун (Достон 2026-10-08).
  // Ном, тавсиф, зарурлик, бажарувчилар кўчирилади; муддат — янгиси; изоҳ, файл, жарима/бонус — йўқ.
  if ((mm = yol.match(/^\/cards\/(\d+)\/nusxa$/)) && usul === "POST") {
    const c = await kartaOl(env, k, mm[1], "card.yarat");
    const { m: f } = await tanaOl(request);
    const muddat = matn(f.muddat, 10);
    if (!sanaMi(muddat)) rad("Муддатни (санани) танланг");
    if (muddat < B) rad("Муддат ўтиб кетган санага қўйилмайди");
    const ijro = ijroRo(c);
    const azo = await ijrochiOl(env, k, ijro[0]);
    const list = await DB.prepare("SELECT * FROM ish_list WHERE board_id = ? AND arxiv IS NULL AND tur = '' ORDER BY pos LIMIT 1").bind(c.board_id).first();
    if (!list) rad("Доскада мос устун йўқ", 404);
    const v = hozir();
    const pos = await orinTop(env, "ish_card", "list_id", list.id, null, null, " AND ochirildi = 0");
    const r = await DB.prepare(
      "INSERT INTO ish_card (board_id, list_id, nom, tavsif, pos, muhim, yaratdi, kimga, ijro, muddat, tarif, vaqt, yangilandi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(c.board_id, list.id, c.nom, c.tavsif || "", pos, c.muhim, k.uid, ijro[0], ijroMatn(ijro), muddat, Number(azo.tarif) || 0, v, v).run();
    const yangi = await DB.prepare("SELECT * FROM ish_card WHERE id = ?").bind(Number(r.meta.last_row_id)).first();
    const M = await azolarOl(env, k.ws);
    await DB.batch([faolSt(env, k, c.board_id, yangi.id, "card.yarat", { nom: c.nom, list: list.nom, kimga: ijro[0], ijro, muddat })]);
    await bildir(env, { ws: k.ws, cardId: yangi.id, kimlarga: ijro, muallif: k.uid, tur: "berildi",
      matn: berildiMatn(yangi, k, B, M), qisqa: `Янги вазифа: ${c.nom}` });
    return json({ ok: true, card: kartaDTO(yangi, M, B) });
  }
  // 💸 Жарима ёзиш (Сардор ака / Мурод ака): шу вазифа учун шу ходимга. summa = 0 — жаримани олиб ташлаш
  if ((mm = yol.match(/^\/cards\/(\d+)\/jarima$/)) && usul === "POST") {
    const c = await kartaOl(env, k, mm[1], "card.jarima");
    const { m: f } = await tanaOl(request);
    const summa = Number(f.summa);
    if (!Number.isInteger(summa) || summa < 0 || summa > MAX_TARIF * 10) rad("Жарима суммасини тўғри ёзинг");
    await DB.batch([
      DB.prepare("UPDATE ish_card SET jarima = ?, jarima_kim = ?, jarima_vaqt = ?, yangilandi = ?, ver = ver + 1 WHERE id = ?").bind(summa || null, k.uid, hozir(), hozir(), c.id),
      faolSt(env, k, c.board_id, c.id, "jarima", { summa, kimga: Number(c.kimga) }),
    ]);
    const M = await azolarOl(env, k.ws);
    return json({ ok: true, card: kartaDTO(await DB.prepare("SELECT * FROM ish_card WHERE id = ?").bind(c.id).first(), M, B) });
  }
  // 🎁 Бонус ёзиш (Сардор ака / Мурод ака): вазифа ўз вақтида бажарилса. summa = 0 — бонусни олиб ташлаш
  if ((mm = yol.match(/^\/cards\/(\d+)\/bonus$/)) && usul === "POST") {
    const c = await kartaOl(env, k, mm[1], "card.jarima");
    const { m: f } = await tanaOl(request);
    const summa = Number(f.summa);
    if (!Number.isInteger(summa) || summa < 0 || summa > MAX_TARIF * 10) rad("Бонус суммасини тўғри ёзинг");
    await DB.batch([
      DB.prepare("UPDATE ish_card SET bonus = ?, bonus_kim = ?, bonus_vaqt = ?, yangilandi = ?, ver = ver + 1 WHERE id = ?").bind(summa || null, k.uid, hozir(), hozir(), c.id),
      faolSt(env, k, c.board_id, c.id, "bonus", { summa, kimga: Number(c.kimga) }),
    ]);
    const M = await azolarOl(env, k.ws);
    return json({ ok: true, card: kartaDTO(await DB.prepare("SELECT * FROM ish_card WHERE id = ?").bind(c.id).first(), M, B) });
  }
  if ((mm = yol.match(/^\/cards\/(\d+)\/arxiv$/)) && usul === "POST") {
    const c = await kartaOl(env, k, mm[1], "card.arxiv");
    const { m: f } = await tanaOl(request);
    const ar = f.arxiv !== false;
    await DB.batch([DB.prepare("UPDATE ish_card SET arxiv = ?, yangilandi = ?, ver = ver + 1 WHERE id = ?").bind(ar ? hozir() : null, hozir(), c.id),
      faolSt(env, k, c.board_id, c.id, ar ? "card.arxiv" : "card.tiklash", {})]);
    return json({ ok: true });
  }
  if ((mm = yol.match(/^\/cards\/(\d+)\/faol$/)) && usul === "GET") {
    const c = await kartaOl(env, k, mm[1]);
    return json({ ok: true, faol: await faolOl(env, c.id, butun(q.get("oldin"))) });
  }

  /* ─── изоҳлар ─── */
  if ((mm = yol.match(/^\/cards\/(\d+)\/izohlar$/)) && usul === "POST") {
    const c = await kartaOl(env, k, mm[1], "card.yoz");
    const { m: f, fayllar } = await tanaOl(request);
    const izoh = matn(f.matn, CHEGARA.izoh);
    if (!izoh && !fayllar.length) rad("Изоҳ ёки файл керак");
    const kalit = f.kalit ? matn(f.kalit, 64) : null;
    if (kalit) {
      const bor = await DB.prepare("SELECT id FROM ish_izoh WHERE card_id = ? AND kalit = ?").bind(c.id, kalit).first();
      if (bor) return json({ ok: true, id: bor.id, takror: true });   // такрорий юбориш — иккинчи марта ёзилмайди
    }
    const r = await DB.prepare("INSERT OR IGNORE INTO ish_izoh (card_id, uid, matn, kalit, vaqt) VALUES (?, ?, ?, ?, ?)").bind(c.id, k.uid, izoh, kalit, hozir()).run();
    if (!r.meta.changes) { const bor = await DB.prepare("SELECT id FROM ish_izoh WHERE card_id = ? AND kalit = ?").bind(c.id, kalit).first(); return json({ ok: true, id: bor.id, takror: true }); }
    const izohId = Number(r.meta.last_row_id);
    await DB.batch([...(await fayllarSaqla(env, k, c, fayllar, izohId)), faolSt(env, k, c.board_id, c.id, "izoh", { izoh: izohId, fayl: fayllar.length }),
      DB.prepare("UPDATE ish_card SET yangilandi = ? WHERE id = ?").bind(hozir(), c.id)]);
    await izohBildir(env, k, c, izoh, fayllar);
    return json({ ok: true, id: izohId });
  }
  if ((mm = yol.match(/^\/izohlar\/(\d+)$/)) && (usul === "PATCH" || usul === "DELETE")) {
    const z = await DB.prepare("SELECT * FROM ish_izoh WHERE id = ? AND ochirildi IS NULL").bind(Number(mm[1])).first();
    if (!z) rad("Изоҳ топилмади", 404);
    const c = await kartaOl(env, k, z.card_id);
    const ozi = Number(z.uid) === k.uid;
    if (usul === "PATCH") {
      if (!ozi) rad("Фақат ўз изоҳингизни таҳрирлай оласиз", 403);
      const { m: f } = await tanaOl(request);
      const izoh = matn(f.matn, CHEGARA.izoh);
      if (!izoh) rad("Изоҳ бўш");
      await DB.batch([DB.prepare("UPDATE ish_izoh SET matn = ?, tahrir = ? WHERE id = ?").bind(izoh, hozir(), z.id), faolSt(env, k, c.board_id, c.id, "izoh.tahrir", { izoh: z.id })]);
      return json({ ok: true });
    }
    if (!ozi && !mumkin(k, "izoh.moderat")) rad("Фақат ўз изоҳингизни ўчира оласиз", 403);
    await DB.batch([DB.prepare("UPDATE ish_izoh SET ochirildi = ?, matn = '' WHERE id = ?").bind(hozir(), z.id),
      DB.prepare("UPDATE ish_fayl SET ochirildi = ? WHERE izoh_id = ?").bind(hozir(), z.id),
      faolSt(env, k, c.board_id, c.id, "izoh.ochir", { izoh: z.id, muallif: Number(z.uid) })]);
    return json({ ok: true });
  }

  /* ─── checklist ─── */
  if ((mm = yol.match(/^\/cards\/(\d+)\/checklists$/)) && usul === "POST") {
    const c = await kartaOl(env, k, mm[1], "card.yoz");
    const { m: f } = await tanaOl(request);
    const nom = matn(f.nom, CHEGARA.checklist) || "Checklist";
    const pos = await orinTop(env, "ish_checklist", "card_id", c.id, null, null);
    const r = await DB.prepare("INSERT INTO ish_checklist (card_id, nom, pos) VALUES (?, ?, ?)").bind(c.id, nom, pos).run();
    await faolSt(env, k, c.board_id, c.id, "chk.yarat", { nom }).run();
    return json({ ok: true, id: Number(r.meta.last_row_id) });
  }
  if ((mm = yol.match(/^\/checklists\/(\d+)(\/items)?$/))) {
    const cl = await DB.prepare("SELECT * FROM ish_checklist WHERE id = ?").bind(Number(mm[1])).first();
    if (!cl) rad("Checklist топилмади", 404);
    const c = await kartaOl(env, k, cl.card_id, "card.yoz");
    if (mm[2] && usul === "POST") {
      const { m: f } = await tanaOl(request);
      const nom = matn(f.nom, CHEGARA.item);
      if (!nom) rad("Банд матнини ёзинг");
      const pos = await orinTop(env, "ish_chk_item", "checklist_id", cl.id, null, null);
      const r = await DB.prepare("INSERT INTO ish_chk_item (checklist_id, nom, pos) VALUES (?, ?, ?)").bind(cl.id, nom, pos).run();
      return json({ ok: true, id: Number(r.meta.last_row_id) });
    }
    if (!mm[2] && usul === "PATCH") {
      const { m: f } = await tanaOl(request);
      const nom = matn(f.nom, CHEGARA.checklist);
      if (!nom) rad("Номини ёзинг");
      await DB.prepare("UPDATE ish_checklist SET nom = ? WHERE id = ?").bind(nom, cl.id).run();
      return json({ ok: true });
    }
    if (!mm[2] && usul === "DELETE") {
      await DB.batch([DB.prepare("DELETE FROM ish_chk_item WHERE checklist_id = ?").bind(cl.id), DB.prepare("DELETE FROM ish_checklist WHERE id = ?").bind(cl.id),
        faolSt(env, k, c.board_id, c.id, "chk.ochir", { nom: cl.nom })]);
      return json({ ok: true });
    }
  }
  if ((mm = yol.match(/^\/items\/(\d+)$/)) && (usul === "PATCH" || usul === "DELETE")) {
    const it = await DB.prepare("SELECT i.*, cl.card_id FROM ish_chk_item i JOIN ish_checklist cl ON cl.id = i.checklist_id WHERE i.id = ?").bind(Number(mm[1])).first();
    if (!it) rad("Банд топилмади", 404);
    const c = await kartaOl(env, k, it.card_id, "card.yoz");
    if (usul === "DELETE") { await DB.prepare("DELETE FROM ish_chk_item WHERE id = ?").bind(it.id).run(); return json({ ok: true }); }
    const { m: f } = await tanaOl(request);
    const st = [];
    if (f.nom !== undefined) { const nom = matn(f.nom, CHEGARA.item); if (!nom) rad("Банд матнини ёзинг"); st.push(DB.prepare("UPDATE ish_chk_item SET nom = ? WHERE id = ?").bind(nom, it.id)); }
    if (f.bajarildi !== undefined && !!f.bajarildi !== !!it.bajarildi) {
      st.push(DB.prepare("UPDATE ish_chk_item SET bajarildi = ? WHERE id = ?").bind(f.bajarildi ? 1 : 0, it.id));
      st.push(faolSt(env, k, c.board_id, c.id, f.bajarildi ? "chk.ok" : "chk.qaytdi", { nom: it.nom }));
    }
    if (f.oldin !== undefined || f.keyin !== undefined) st.push(DB.prepare("UPDATE ish_chk_item SET pos = ? WHERE id = ?").bind(await orinTop(env, "ish_chk_item", "checklist_id", it.checklist_id, f.oldin, f.keyin), it.id));
    if (st.length) await DB.batch(st);
    return json({ ok: true });
  }

  /* ─── файллар ─── */
  if ((mm = yol.match(/^\/cards\/(\d+)\/fayllar$/)) && usul === "POST") {
    const c = await kartaOl(env, k, mm[1], "card.yoz");
    const { fayllar } = await tanaOl(request);
    if (!fayllar.length) rad("Файл танланг");
    await DB.batch([...(await fayllarSaqla(env, k, c, fayllar)), faolSt(env, k, c.board_id, c.id, "fayl", { soni: fayllar.length, nom: fayllar.map((x) => x.nom).slice(0, 3) })]);
    return json({ ok: true });
  }
  if ((mm = yol.match(/^\/fayllar\/(\d+)$/))) {
    const fy = await DB.prepare("SELECT * FROM ish_fayl WHERE id = ? AND ochirildi IS NULL").bind(Number(mm[1])).first();
    if (!fy) rad("Файл топилмади", 404);
    const c = await kartaOl(env, k, fy.card_id);
    if (usul === "GET") {
      const o = await F.ol(env, fy.kalit);
      if (!o) rad("Файл очилмади", 502);
      return new Response(o.body, { headers: { "content-type": fy.mime, "cache-control": "private, max-age=604800", "x-content-type-options": "nosniff",
        "content-disposition": `${F.rasmmi(fy.mime) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fy.nom)}` } });
    }
    if (usul === "DELETE") {
      if (Number(fy.yukladi) !== k.uid && !kamida(k.rol, "admin")) rad("Фақат ўзингиз юклаган файлни ўчира оласиз", 403);
      await DB.batch([DB.prepare("UPDATE ish_fayl SET ochirildi = ? WHERE id = ?").bind(hozir(), fy.id), faolSt(env, k, c.board_id, c.id, "fayl.ochir", { nom: fy.nom })]);
      return json({ ok: true });
    }
  }

  /* ─── оддий кўриниш: ҳамма очиқ вазифалар (раҳбарга — ҳаммаси, ходимга — ўзиники) ─── */
  /* ─── 🔑 Паролни алмаштириш (фақат сайтдан) ─── */
  if (yol === "/parol" && usul === "POST") {
    if (!k.sayt) rad("Фақат сайтда", 403);
    const { m: f } = await tanaOl(request);
    const r = await parolAlmash(env, k.uid, f.eski, f.yangi);
    if (!r.ok) rad(r.xato);
    return json({ ok: true });
  }

  /* ─── 👥 Ходимлар: кимда нечта иш бор ─── */
  if (yol === "/xodimlar" && usul === "GET") {
    if (!kamida(k.rol, "admin")) rad("Фақат раҳбарларга", 403);
    const oy = (q.get("oy") && oyMi(q.get("oy")) ? q.get("oy") : B.slice(0, 7));
    const { results } = await DB.prepare(
      `SELECT a.uid AS kimga,
         SUM(CASE WHEN c.bajarildi IS NULL AND c.arxiv IS NULL THEN 1 ELSE 0 END) AS ochiq,
         SUM(CASE WHEN c.bajarildi IS NULL AND c.arxiv IS NULL AND c.muddat < ? THEN 1 ELSE 0 END) AS kech,
         SUM(CASE WHEN c.bajarildi IS NULL AND c.arxiv IS NULL AND c.muddat = ? THEN 1 ELSE 0 END) AS bugun,
         SUM(CASE WHEN c.bajarildi IS NOT NULL AND substr(c.bajarildi, 1, 7) = ? THEN 1 ELSE 0 END) AS bajardi,
         SUM(CASE WHEN c.jarima > 0 AND substr(COALESCE(c.bajarildi, c.yangilandi), 1, 7) = ? THEN c.jarima ELSE 0 END) AS jarima,
         SUM(CASE WHEN c.bonus > 0 AND substr(COALESCE(c.bajarildi, c.yangilandi), 1, 7) = ? THEN c.bonus ELSE 0 END) AS bonus
       FROM ish_card c
       JOIN ish_board b ON b.id = c.board_id
       JOIN ish_azo a ON a.ws_id = b.ws_id AND instr(COALESCE(c.ijro, ',' || c.kimga || ','), ',' || a.uid || ',') > 0
       WHERE b.ws_id = ? AND c.ochirildi = 0 AND c.kimga IS NOT NULL
       GROUP BY a.uid`).bind(B, B, oy, oy, oy, k.ws).all();
    const M = await azolarOl(env, k.ws);
    const xo = (results || []).map((r) => {
      const a = M.get(Number(r.kimga));
      return { id: Number(r.kimga), ism: a ? a.ism : "?", bolim: a ? a.bolim : "",
        ochiq: Number(r.ochiq) || 0, kech: Number(r.kech) || 0, bugun: Number(r.bugun) || 0,
        bajardi: Number(r.bajardi) || 0, jarima: Number(r.jarima) || 0, bonus: Number(r.bonus) || 0 };
    }).filter((x) => x.ochiq || x.bajardi || x.jarima || x.bonus)
      .sort((a, b2) => b2.kech - a.kech || b2.ochiq - a.ochiq || a.ism.localeCompare(b2.ism, "ru"));
    return json({ ok: true, oy, xodimlar: xo });
  }

  /* ─── 📅 Бугун: кечиккан · бугун · эртага ─── */
  if (yol === "/bugun" && usul === "GET") {
    const men = kamida(k.rol, "admin") ? "" : " AND " + IJRO_SH;
    const { results } = await DB.prepare(
      `SELECT c.*, b.nom AS board_nom, l.nom AS list_nom FROM ish_card c
         JOIN ish_board b ON b.id = c.board_id JOIN ish_list l ON l.id = c.list_id
       WHERE b.ws_id = ? AND b.arxiv IS NULL AND c.ochirildi = 0 AND c.arxiv IS NULL
         AND c.bajarildi IS NULL AND c.muddat IS NOT NULL AND c.muddat <= ?${men}
       ORDER BY c.muddat, c.id LIMIT 200`).bind(k.ws, kunQosh(B, 1), ...(men ? [k.uid] : [])).all();
    const M = await azolarOl(env, k.ws);
    const ro = (results || []).map((c) => ({ ...kartaDTO(c, M, B), board_nom: c.board_nom, list_nom: c.list_nom }));
    return json({ ok: true, bugun: B,
      kech: ro.filter((c) => c.muddat < B), shu: ro.filter((c) => c.muddat === B), ertaga: ro.filter((c) => c.muddat > B) });
  }

  /* ─── 🔁 Такрорланувчи вазифалар ─── */
  if (yol === "/takror" && usul === "GET") {
    if (!kamida(k.rol, "admin")) rad("Фақат раҳбарларга", 403);
    const { results } = await DB.prepare("SELECT * FROM ish_takror WHERE ws_id = ? ORDER BY id DESC").bind(k.ws).all();
    const M = await azolarOl(env, k.ws);
    return json({ ok: true, takror: (results || []).map((t) => ({
      id: t.id, board_id: t.board_id, nom: t.nom, tavsif: t.tavsif, kimga: Number(t.kimga),
      kimgaIsm: (M.get(Number(t.kimga)) || {}).ism || "?", davr: t.davr, kuni: Number(t.kuni),
      muddatKun: Number(t.muddat_kun), faol: !!t.faol, oxirgi: t.oxirgi })) });
  }
  if (yol === "/takror" && usul === "POST") {
    if (!kamida(k.rol, "admin")) rad("Фақат раҳбарларга", 403);
    const { m: f } = await tanaOl(request);
    const nom = matn(f.nom, CHEGARA.nom);
    if (nom.length < 2) rad("Вазифа номини ёзинг");
    if (!["kun", "hafta", "oy"].includes(f.davr)) rad("Такрорланиш даврини танланг");
    const b = await boardOl(env, k, f.board_id || (await DB.prepare("SELECT id FROM ish_board WHERE ws_id = ? AND arxiv IS NULL ORDER BY pos, id LIMIT 1").bind(k.ws).first()).id);
    const azo = await ijrochiOl(env, k, butun(f.kimga));
    const kuni = Math.max(1, Math.min(f.davr === "hafta" ? 7 : 28, butun(f.kuni) || 1));
    const mk = Math.max(0, Math.min(30, butun(f.muddatKun) || 0));
    const r = await DB.prepare(
      `INSERT INTO ish_takror (ws_id, board_id, nom, tavsif, kimga, davr, kuni, muddat_kun, faol, yaratdi, vaqt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
      .bind(k.ws, b.id, nom, matn(f.tavsif, CHEGARA.tavsif), Number(azo.uid), f.davr, kuni, mk, k.uid, hozir()).run();
    return json({ ok: true, id: Number(r.meta.last_row_id) });
  }
  if ((mm = yol.match(/^\/takror\/(\d+)$/)) && (usul === "PATCH" || usul === "DELETE")) {
    if (!kamida(k.rol, "admin")) rad("Фақат раҳбарларга", 403);
    const t = await DB.prepare("SELECT * FROM ish_takror WHERE id = ? AND ws_id = ?").bind(butun(mm[1]), k.ws).first();
    if (!t) rad("Топилмади", 404);
    if (usul === "DELETE") { await DB.prepare("DELETE FROM ish_takror WHERE id = ?").bind(t.id).run(); return json({ ok: true }); }
    const { m: f } = await tanaOl(request);
    if (f.faol === undefined) rad("Ўзгариш йўқ");
    await DB.prepare("UPDATE ish_takror SET faol = ? WHERE id = ?").bind(f.faol ? 1 : 0, t.id).run();
    return json({ ok: true });
  }

  if (yol === "/royxat" && usul === "GET") {
    // Раҳбарда бажарилганлар ҳам туради — архивга ёки ўчиришни ўзи ҳал қилади (Достон 2026-09-22).
    // Ходимда бажарилган вазифа рўйхатдан кетади.
    const men = kamida(k.rol, "admin") ? "" : " AND " + IJRO_SH + " AND c.bajarildi IS NULL";
    // Қидирув учун раҳбар архивдагиларни ҳам кўра олсин (hammasi=1)
    const arx = kamida(k.rol, "admin") && q.get("hammasi") === "1" ? "" : " AND c.arxiv IS NULL";
    const [cards, lists, M] = await Promise.all([
      DB.prepare(`SELECT c.*, b.nom AS board_nom FROM ish_card c JOIN ish_board b ON b.id = c.board_id
        WHERE b.ws_id = ? AND b.arxiv IS NULL AND c.ochirildi = 0${arx}${men}
        ORDER BY c.muddat, c.id LIMIT 1000`).bind(k.ws, ...(men ? [k.uid] : [])).all(),
      DB.prepare("SELECT l.id, l.board_id, l.tur, l.pos FROM ish_list l JOIN ish_board b ON b.id = l.board_id WHERE b.ws_id = ? AND l.arxiv IS NULL").bind(k.ws).all(),
      azolarOl(env, k.ws),
    ]);
    const holat = holatTop(lists.results || []);
    const qo = await qoshimcha(env, "SELECT c.id FROM ish_card c JOIN ish_board b ON b.id = c.board_id WHERE b.ws_id = ? AND c.ochirildi = 0", [k.ws]);
    return json({ ok: true, cards: (cards.results || []).map((c) => ({ ...kartaDTO(c, M, B), tavsif: String(c.tavsif || "").slice(0, 160), board_nom: c.board_nom, holat: holat(c), ...qo(c.id) })) });
  }
  /* ─── «Кимга?» танлови: аъзолар + ботдаги одамлар ─── */
  if (yol === "/odamlar" && usul === "GET") {
    if (!mumkin(k, "card.yarat")) rad("Рухсат йўқ", 403);
    const [M, bot] = await Promise.all([azolarOl(env, k.ws), botOdamlari(env)]);
    const ro = new Map();
    for (const a of M.values()) if (a.faol) ro.set(Number(a.uid), { id: Number(a.uid), ism: a.ism, bolim: BOLIMLAR[a.bolim] || "", rol: a.rol, tarif: Number(a.tarif) });
    for (const [id, o] of bot) if (!M.has(id)) ro.set(id, { id, ism: o.ism, bolim: o.bolim, rol: "member", tarif: TARIF });
    return json({ ok: true, odamlar: [...ro.values()].sort((x, y) => x.ism.localeCompare(y.ism, "ru")) });
  }

  /* ─── менинг вазифаларим · қидирув · архив · жарима ─── */
  if (yol === "/meniki" && usul === "GET") {
    const { results } = await DB.prepare(
      `SELECT c.*, b.nom AS board_nom, l.nom AS list_nom FROM ish_card c JOIN ish_board b ON b.id = c.board_id JOIN ish_list l ON l.id = c.list_id
       WHERE b.ws_id = ? AND b.arxiv IS NULL AND ${IJRO_SH} AND c.ochirildi = 0 AND c.arxiv IS NULL AND (c.bajarildi IS NULL OR c.bajarildi >= ?)
       ORDER BY c.bajarildi IS NOT NULL, c.muddat, c.id LIMIT 200`).bind(k.ws, k.uid, kunBoshi(B)).all();
    const M = await azolarOl(env, k.ws);
    return json({ ok: true, cards: (results || []).map((c) => ({ ...kartaDTO(c, M, B), board_nom: c.board_nom, list_nom: c.list_nom })) });
  }
  if (yol === "/qidir" && usul === "GET") {
    if (!kamida(k.rol, "admin")) rad("Архив фақат раҳбарларга", 403);   // Сардор ака, Мурод ака
    const { w, a } = filtrlar(q, k, B);
    const holat = q.get("holat");
    if (holat === "bajarildi") w.push("c.bajarildi IS NOT NULL");
    else if (holat === "arxiv") w.push("c.arxiv IS NOT NULL");   // архив — раҳбар «Архивга» босганлари
    else w.push("c.arxiv IS NULL AND c.bajarildi IS NULL");
    const oy = q.get("oy");
    if (oy && !oyMi(oy)) rad("Ой формати: YYYY-MM");
    if (oy) { w.push("COALESCE(c.bajarildi, c.arxiv, c.vaqt) >= ? AND COALESCE(c.bajarildi, c.arxiv, c.vaqt) < ?"); a.push(kunBoshi(oy + "-01"), kunBoshi(oyKeyin(oy) + "-01")); }
    const sahifa = Math.max(0, Math.min(1000, Number(q.get("sahifa")) || 0));
    const { results } = await DB.prepare(
      `SELECT c.*, b.nom AS board_nom, l.nom AS list_nom FROM ish_card c JOIN ish_board b ON b.id = c.board_id JOIN ish_list l ON l.id = c.list_id
       WHERE b.ws_id = ? AND c.ochirildi = 0${w.length ? " AND " + w.join(" AND ") : ""}
       ORDER BY COALESCE(c.bajarildi, c.arxiv, c.yangilandi) DESC, c.id DESC LIMIT ? OFFSET ?`)
      .bind(k.ws, ...a, CHEGARA.sahifa + 1, sahifa * CHEGARA.sahifa).all();
    const ro = results || [];
    const M = await azolarOl(env, k.ws);
    return json({ ok: true, cards: ro.slice(0, CHEGARA.sahifa).map((c) => ({ ...kartaDTO(c, M, B), board_nom: c.board_nom, list_nom: c.list_nom })), yana: ro.length > CHEGARA.sahifa });
  }
  if (yol === "/jarima" && usul === "GET") {
    if (!kamida(k.rol, "admin")) rad("Жарима фақат раҳбарларга", 403);
    const oy = q.get("oy") || B.slice(0, 7);
    if (!oyMi(oy)) rad("Ой формати: YYYY-MM");
    const d = await jarimaOy(env, k, oy, B);
    return json({ ok: true, oy, jami: d.jami, xodimlar: d.xodimlar, cards: d.cards.slice(0, 300),
      bonusJami: d.bonusJami, bonusXodimlar: d.bonusXodimlar, bonusCards: d.bonusCards.slice(0, 300) });
  }

  // 📊 Ойлик .xlsx ҳисобот (бухгалтерия учун): якун · жарималар · бонуслар
  if (yol === "/hisobot.xlsx" && usul === "GET") {
    if (!kamida(k.rol, "admin")) rad("Ҳисобот фақат раҳбарларга", 403);
    const oy = q.get("oy") || B.slice(0, 7);
    if (!oyMi(oy)) rad("Ой формати: YYYY-MM");
    const { ishExcel } = await import("./excel.js");
    const { bytes, nom } = await ishExcel({ oy, ...(await jarimaOy(env, k, oy, B)) });
    return new Response(bytes, { headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "cache-control": "no-store",
    } });
  }

  // 📅 Тарих: танланган кунда бажарилган вазифалар (ходим ўзиникини, раҳбар ҳаммасини)
  if (yol === "/tarix" && usul === "GET") {
    const sana = matn(q.get("sana"), 10);
    if (!sanaMi(sana)) rad("Санани танланг");
    const kim = butun(q.get("kimga"));
    const men = kamida(k.rol, "admin") ? (kim ? ` AND ${IJRO_SH}` : "") : ` AND ${IJRO_SH}`;
    const arg = kamida(k.rol, "admin") ? (kim ? [kim] : []) : [k.uid];
    const { results } = await DB.prepare(
      `SELECT c.*, b.nom AS board_nom, l.nom AS list_nom FROM ish_card c
         JOIN ish_board b ON b.id = c.board_id JOIN ish_list l ON l.id = c.list_id
        WHERE b.ws_id = ? AND c.ochirildi = 0 AND c.bajarildi IS NOT NULL
          AND c.bajarildi >= ? AND c.bajarildi < ?${men}
        ORDER BY c.bajarildi DESC LIMIT 200`)
      .bind(k.ws, kunBoshi(sana), kunBoshi(kunQosh(sana, 1)), ...arg).all();
    const M = await azolarOl(env, k.ws);
    const qo = await qoshimcha(env, "SELECT c.id FROM ish_card c JOIN ish_board b ON b.id = c.board_id WHERE b.ws_id = ? AND c.ochirildi = 0", [k.ws]);
    const cards = (results || []).map((c) => ({
      ...kartaDTO(c, M, B), board_nom: c.board_nom, list_nom: c.list_nom,
      kechBajarildi: !!c.muddat && tSana(c.bajarildi) > c.muddat, ...qo(c.id),
    }));
    return json({ ok: true, sana, cards,
      jami: { soni: cards.length, jarima: cards.reduce((s, x) => s + x.jarima, 0), bonus: cards.reduce((s, x) => s + x.bonus, 0) } });
  }

  /* ─── билдиришномалар ─── */
  if (yol === "/bildir" && usul === "GET") {
    const oldin = butun(q.get("oldin"));
    const { results } = await DB.prepare(`SELECT id, card_id, tur, matn, oqildi, vaqt FROM ish_bildir WHERE uid = ?${oldin ? " AND id < ?" : ""} ORDER BY id DESC LIMIT 50`)
      .bind(k.uid, ...(oldin ? [oldin] : [])).all();
    return json({ ok: true, bildir: (results || []).map((x) => ({ ...x, oqildi: !!x.oqildi })) });
  }
  if (yol === "/bildir/oqildi" && usul === "POST") {
    const { m: f } = await tanaOl(request);
    if (butun(f.id)) await DB.prepare("UPDATE ish_bildir SET oqildi = 1 WHERE id = ? AND uid = ?").bind(butun(f.id), k.uid).run();
    else await DB.prepare("UPDATE ish_bildir SET oqildi = 1 WHERE uid = ? AND oqildi = 0").bind(k.uid).run();
    return json({ ok: true });
  }

  return xato("Топилмади", 404);
}

const oyKeyin = (oy) => { const [y, m] = oy.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };

async function labelTekshir(env, boardId, ro) {
  const ids = [...new Set((Array.isArray(ro) ? ro : []).map(butun).filter(Boolean))];
  if (!ids.length) return [];
  if (ids.length > 20) rad("Label жуда кўп");
  const { results } = await env.DB.prepare(`SELECT id FROM ish_label WHERE board_id = ? AND id IN (${ids.map(() => "?").join(",")})`).bind(boardId, ...ids).all();
  if ((results || []).length !== ids.length) rad("Label бу доскага тегишли эмас");
  return ids;
}

/* ─── доска (устунлар + карточкалар, фильтр билан) ─── */
async function boardKorish(env, k, id, q, B) {
  const b = await boardOl(env, k, id);
  const DB = env.DB;
  const { w, a } = filtrlar(q, k, B);
  const [lists, labels, cards, M] = await Promise.all([
    DB.prepare("SELECT id, nom, tur, pos FROM ish_list WHERE board_id = ? AND arxiv IS NULL ORDER BY pos, id").bind(b.id).all(),
    DB.prepare("SELECT id, nom, rang FROM ish_label WHERE board_id = ? ORDER BY id").bind(b.id).all(),
    DB.prepare(`SELECT c.* FROM ish_card c WHERE c.board_id = ? AND c.ochirildi = 0 AND c.arxiv IS NULL AND (? OR c.bajarildi IS NULL OR c.bajarildi >= ?)${w.length ? " AND " + w.join(" AND ") : ""} ORDER BY c.pos, c.id LIMIT 1000`)
      .bind(b.id, kamida(k.rol, "admin") ? 1 : 0, kunBoshi(B), ...a).all(),   // раҳбарда бажарилганлар туради — архив/ўчиришни ўзи ҳал қилади
    azolarOl(env, k.ws),
  ]);
  const qo = await qoshimcha(env, "SELECT id FROM ish_card WHERE board_id = ? AND ochirildi = 0", [b.id]);
  const azolar = kamida(k.rol, "admin")
    ? [...M.values()].filter((x) => x.faol).map((x) => ({ id: Number(x.uid), ism: x.ism, bolim: x.bolim, tarif: Number(x.tarif) }))
        .sort((x, y) => x.ism.localeCompare(y.ism, "ru"))
    : [];
  return json({ ok: true, board: { id: b.id, nom: b.nom, tavsif: b.tavsif, fon: b.fon || "" }, lists: lists.results || [], labels: labels.results || [],
    cards: (cards.results || []).map((c) => ({ ...kartaDTO(c, M, B), tavsif: String(c.tavsif || "").slice(0, 160), ...qo(c.id) })), azolar });
}

/* ─── карточка тафсилоти ─── */
async function faolOl(env, cardId, oldin) {
  const { results } = await env.DB.prepare(`SELECT f.id, f.uid, f.amal, f.meta, f.vaqt, a.ism FROM ish_faol f LEFT JOIN ish_azo a ON a.ws_id = f.ws_id AND a.uid = f.uid
    WHERE f.card_id = ?${oldin ? " AND f.id < ?" : ""} ORDER BY f.id DESC LIMIT 50`).bind(cardId, ...(oldin ? [oldin] : [])).all();
  return (results || []).map((x) => ({ id: x.id, uid: Number(x.uid), ism: x.ism || String(x.uid), amal: x.amal, meta: jsonOl(x.meta, {}), vaqt: x.vaqt }));
}
async function kartaKorish(env, k, id, B) {
  const c = await kartaOl(env, k, id);
  const DB = env.DB;
  const [M, lists, labels, cl, items, iz, fy, faol] = await Promise.all([
    azolarOl(env, k.ws),
    DB.prepare("SELECT id, nom, tur, pos FROM ish_list WHERE board_id = ? AND arxiv IS NULL ORDER BY pos, id").bind(c.board_id).all(),
    DB.prepare("SELECT x.id, x.nom, x.rang, EXISTS (SELECT 1 FROM ish_card_label y WHERE y.card_id = ? AND y.label_id = x.id) AS bor FROM ish_label x WHERE x.board_id = ? ORDER BY x.id").bind(c.id, c.board_id).all(),
    DB.prepare("SELECT id, nom, pos FROM ish_checklist WHERE card_id = ? ORDER BY pos, id").bind(c.id).all(),
    DB.prepare("SELECT i.id, i.checklist_id, i.nom, i.bajarildi, i.pos FROM ish_chk_item i JOIN ish_checklist cl ON cl.id = i.checklist_id WHERE cl.card_id = ? ORDER BY i.pos, i.id").bind(c.id).all(),
    DB.prepare("SELECT id, uid, matn, vaqt, tahrir FROM ish_izoh WHERE card_id = ? AND ochirildi IS NULL ORDER BY id LIMIT 300").bind(c.id).all(),
    DB.prepare("SELECT id, izoh_id, nom, mime, hajm, yukladi, vaqt FROM ish_fayl WHERE card_id = ? AND ochirildi IS NULL ORDER BY id").bind(c.id).all(),
    faolOl(env, c.id, null),
  ]);
  const fayl = (fy.results || []).map((f) => ({ ...f, rasm: F.rasmmi(f.mime), yukladiIsm: ismi(M, f.yukladi) }));
  return json({ ok: true,
    card: { ...kartaDTO(c, M, B), list_nom: c.list_nom, list_tur: c.list_tur },
    lists: lists.results || [],
    labels: (labels.results || []).map((x) => ({ id: x.id, nom: x.nom, rang: x.rang, bor: !!x.bor })),
    checklists: (cl.results || []).map((x) => ({ ...x, items: (items.results || []).filter((i) => i.checklist_id === x.id).map((i) => ({ ...i, bajarildi: !!i.bajarildi })) })),
    izohlar: (iz.results || []).map((z) => ({ ...z, uid: Number(z.uid), ism: ismi(M, z.uid), meniki: Number(z.uid) === k.uid, fayllar: fayl.filter((f) => f.izoh_id === z.id) })),
    fayllar: fayl.filter((f) => !f.izoh_id),
    // Ходим «Бажардим» деганда қўшган расмлар — раҳбар уларни алоҳида кўради
    ijroRasm: fayl.filter((f) => f.izoh_id && f.rasm),
    // Ходим «Бажардим» деганда қўшган расмлар — раҳбар уларни алоҳида кўради
    ijroRasm: fayl.filter((f) => f.izoh_id && f.rasm),
    // Ходим «Бажардим» деганда қўшган расмлар — раҳбар уларни алоҳида кўради
    ijroRasm: fayl.filter((f) => f.izoh_id && f.rasm),
    faol,
    azolar: kamida(k.rol, "admin") ? [...M.values()].filter((x) => x.faol).map((x) => ({ id: Number(x.uid), ism: x.ism, rol: x.rol, tarif: Number(x.tarif) })) : [],
    mumkin: { tahrir: mumkin(k, "card.tahrir", c), kochir: mumkin(k, "card.kochir", c), yoz: mumkin(k, "card.yoz", c), arxiv: mumkin(k, "card.arxiv", c), ochir: mumkin(k, "card.ochir", c), jarima: mumkin(k, "card.jarima", c), moderat: mumkin(k, "izoh.moderat", c) },
  });
}

/* ─── карточкани таҳрирлаш ─── */
async function kartaTahrir(env, k, id, request, B) {
  const c = await kartaOl(env, k, id, "card.tahrir");
  const DB = env.DB;
  const { m: f } = await tanaOl(request);
  if (f.ver !== undefined && Number(f.ver) !== Number(c.ver)) rad("Бу вазифани бошқа одам ўзгартириб улгурди — янгиланг", 409);
  const set = [], arg = [], faol = [];
  let yangiKimga = null;
  if (f.nom !== undefined) { const nom = matn(f.nom, CHEGARA.nom); if (nom.length < 2) rad("Вазифа номини ёзинг"); if (nom !== c.nom) { set.push("nom = ?"); arg.push(nom); faol.push(["card.nom", { eski: c.nom, yangi: nom }]); } }
  if (f.tavsif !== undefined) { const t = matn(f.tavsif, CHEGARA.tavsif); if (t !== c.tavsif) { set.push("tavsif = ?"); arg.push(t); faol.push(["card.tavsif", {}]); } }
  if (f.boshlanish !== undefined) {
    const bs = matn(f.boshlanish, 10);
    if (bs && !sanaMi(bs)) rad("Бошланиш санаси нотўғри");
    if (bs && bs > (f.muddat !== undefined ? matn(f.muddat, 10) : c.muddat)) rad("Бошланиш санаси муддатдан кейин бўлмасин");
    if ((bs || null) !== (c.boshlanish || null)) { set.push("boshlanish = ?"); arg.push(bs || null); faol.push(["card.boshlanish", { yangi: bs }]); }
  }
  if (f.muhim !== undefined) { if (!MUHIM.includes(f.muhim)) rad("Муҳимлик нотўғри"); if (f.muhim !== c.muhim) { set.push("muhim = ?"); arg.push(f.muhim); faol.push(["card.muhim", { eski: c.muhim, yangi: f.muhim }]); } }
  if (f.muddat !== undefined) {
    const md = matn(f.muddat, 10);
    if (!sanaMi(md)) rad("Муддатни (санани) танланг");
    if (md !== c.muddat) { if (md < B) rad("Муддат ўтиб кетган санага қўйилмайди"); set.push("muddat = ?"); arg.push(md); faol.push(["card.muddat", { eski: c.muddat, yangi: md }]); }
  }
  if (f.kimga !== undefined) {
    const kg = butun(f.kimga);
    if (!kg) rad("Битта ходимни танланг");
    if (kg !== Number(c.kimga)) {
      const azo = await ijrochiOl(env, k, kg);
      set.push("kimga = ?"); arg.push(kg);
      if (f.ijrochilar === undefined) {
        const qolgan = ijroRo(c).slice(1).filter((u) => u !== kg);
        set.push("ijro = ?"); arg.push(ijroMatn([kg, ...qolgan]));
      }
      if (f.tarif === undefined) { set.push("tarif = ?"); arg.push(Number(azo.tarif) || 0); }
      faol.push(["card.kimga", { eski: c.kimga, yangi: kg }]); yangiKimga = kg;
    }
  }
  const yangiQosh = [];
  if (f.ijrochilar !== undefined) {
    const ro = (Array.isArray(f.ijrochilar) ? f.ijrochilar : jsonOl(f.ijrochilar, [])).map(butun).filter(Boolean);
    if (!ro.length) rad("Камида битта ходим танланг");
    if (new Set(ro).size !== ro.length) rad("Битта ходим икки марта танланмасин");
    if (ro.length > CHEGARA.ijro) rad(`Кўпи билан ${CHEGARA.ijro} та ходим`);
    const eski = ijroRo(c);
    if (ijroMatn(ro) !== ijroMatn(eski)) {
      for (const u of ro) await ijrochiOl(env, k, u);
      set.push("ijro = ?"); arg.push(ijroMatn(ro));
      if (ro[0] !== eski[0]) {
        const azo = await ijrochiOl(env, k, ro[0]);
        set.push("kimga = ?"); arg.push(ro[0]);
        if (f.tarif === undefined) { set.push("tarif = ?"); arg.push(Number(azo.tarif) || 0); }
      }
      faol.push(["card.ijro", { soni: ro.length }]);
      for (const u of ro) if (!eski.includes(u)) yangiQosh.push(u);
    }
  }
  if (f.tarif !== undefined) {
    if (!mumkin(k, "card.jarima", c)) rad("Жаримани фақат эгаси (owner) ўзгартиради", 403);
    const t = Number(f.tarif);
    if (!Number.isInteger(t) || t < 0 || t > MAX_TARIF) rad("Тариф 0 … 10 000 000 сўм");
    set.push("tarif = ?"); arg.push(t); faol.push(["card.tarif", { eski: Number(c.tarif), yangi: t }]);
  }
  const st = [];
  if (f.labels !== undefined) {
    const yangi = await labelTekshir(env, c.board_id, f.labels);
    const { results } = await DB.prepare("SELECT label_id FROM ish_card_label WHERE card_id = ?").bind(c.id).all();
    const eski = (results || []).map((x) => x.label_id);
    for (const l of yangi.filter((x) => !eski.includes(x))) { st.push(DB.prepare("INSERT OR IGNORE INTO ish_card_label (card_id, label_id) VALUES (?, ?)").bind(c.id, l)); faol.push(["label+", { label: l }]); }
    for (const l of eski.filter((x) => !yangi.includes(x))) { st.push(DB.prepare("DELETE FROM ish_card_label WHERE card_id = ? AND label_id = ?").bind(c.id, l)); faol.push(["label-", { label: l }]); }
  }
  if (!set.length && !st.length) return json({ ok: true, ver: Number(c.ver) });
  // ver — атомик текширув: орада бошқа одам ўзгартирган бўлса, ҳеч нима ёзилмайди
  const r = await DB.prepare(`UPDATE ish_card SET ${[...set, "yangilandi = ?", "ver = ver + 1"].join(", ")} WHERE id = ? AND ver = ?`).bind(...arg, hozir(), c.id, c.ver).run();
  if (!r.meta.changes) rad("Бу вазифани бошқа одам ўзгартириб улгурди — янгиланг", 409);
  await DB.batch([...st, ...faol.map(([a, m]) => faolSt(env, k, c.board_id, c.id, a, m))]);
  const yangi = await DB.prepare("SELECT * FROM ish_card WHERE id = ?").bind(c.id).first();
  const Mb = await azolarOl(env, k.ws);
  if (yangiKimga || yangiQosh.length) await bildir(env, { ws: k.ws, cardId: c.id, kimlarga: [yangiKimga, ...yangiQosh].filter(Boolean), muallif: k.uid, tur: "berildi", matn: berildiMatn(yangi, k, B, Mb) });
  else if (faol.some(([a]) => a === "card.muddat") && yangi.kimga) {
    await bildir(env, { ws: k.ws, cardId: c.id, kimlarga: [yangi.kimga], muallif: k.uid, tur: "muddat", qisqa: `Муддат ўзгарди: ${yangi.nom}`, matn: `📅 <b>Муддат ўзгарди</b>\n📋 ${esc(yangi.nom)}\nЯнги муддат: <b>${yangi.muddat}</b> гача` });
  }
  const M = await azolarOl(env, k.ws);
  return json({ ok: true, card: kartaDTO(yangi, M, B) });
}

/* ─── карточкани кўчириш (drag & drop ва «Жараёнда»/«Бажардим» тугмалари) ─── */
async function kartaKochir(env, k, id, request, B) {
  const c = await kartaOl(env, k, id, "card.kochir");
  const DB = env.DB;
  const { m: f, fayllar } = await tanaOl(request);
  if (f.ver !== undefined && Number(f.ver) !== Number(c.ver)) rad("Бу вазифани бошқа одам ўзгартириб улгурди — янгиланг", 409);
  // Оддий кўриниш «ҳолат» юборади (yangi/jarayon/bajarildi) — устунни сервер ўзи танлайди
  if (!f.list_id && ["yangi", "jarayon", "bajarildi"].includes(f.holat)) {
    const { results } = await DB.prepare("SELECT id, tur FROM ish_list WHERE board_id = ? AND arxiv IS NULL ORDER BY pos, id").bind(c.board_id).all();
    const oddiy = (results || []).filter((l) => l.tur !== "done"), done = (results || []).find((l) => l.tur === "done");
    const t = f.holat === "bajarildi" ? done : f.holat === "yangi" ? oddiy[0] : oddiy[1] || oddiy[0];
    if (!t) rad("Доскада мос устун йўқ");
    f.list_id = t.id;
  }
  const list = await listOl(env, c.board_id, f.list_id);
  const izoh = matn(f.matn, CHEGARA.izoh);
  const bajarmoqda = list.tur === "done" && c.list_tur !== "done";
  // Ходим «Бажарилди»га ўтказса — РАСМ мажбурий, изоҳ ихтиёрий (Достон 2026-10-06)
  if (bajarmoqda && !kamida(k.rol, "admin") && !fayllar.length) rad("Бажарганингизни расм билан кўрсатинг");
  if (c.list_tur === "done" && list.tur !== "done" && !kamida(k.rol, "admin")) rad("Бажарилган вазифани раҳбар қайта очади", 403);
  const pos = await orinTop(env, "ish_card", "list_id", list.id, f.oldin, f.keyin, " AND ochirildi = 0");
  const bajarildi = list.tur === "done" ? (c.bajarildi || hozir()) : null;
  const r = await DB.prepare("UPDATE ish_card SET list_id = ?, pos = ?, bajarildi = ?, yangilandi = ?, ver = ver + 1 WHERE id = ? AND ver = ?")
    .bind(list.id, pos, bajarildi, hozir(), c.id, c.ver).run();
  if (!r.meta.changes) rad("Бу вазифани бошқа одам ўзгартириб улгурди — янгиланг", 409);
  const boshqaUstun = list.id !== c.list_id;
  const st = boshqaUstun ? [faolSt(env, k, c.board_id, c.id, "card.kochir", { dan: c.list_nom, ga: list.nom })] : [];
  if (izoh || fayllar.length) {
    const z = await DB.prepare("INSERT INTO ish_izoh (card_id, uid, matn, vaqt) VALUES (?, ?, ?, ?)").bind(c.id, k.uid, izoh, hozir()).run();
    st.push(...(await fayllarSaqla(env, k, c, fayllar, Number(z.meta.last_row_id))), faolSt(env, k, c.board_id, c.id, "izoh", { izoh: Number(z.meta.last_row_id), fayl: fayllar.length }));
  }
  if (st.length) await DB.batch(st);
  const yangi = await DB.prepare("SELECT * FROM ish_card WHERE id = ?").bind(c.id).first();
  if (boshqaUstun) {
    const j = jarimaHisob(yangi, B);
    const kimdan = esc(k.ism);
    const xodimdan = !kamida(k.rol, "admin");
    const sarlavha = bajarmoqda ? "✅ <b>ВАЗИФА БАЖАРИЛДИ</b>"
      : c.list_tur === "done" ? "↩️ <b>Вазифа қайта очилди</b>"
      : xodimdan ? "🔄 <b>Ходим вазифани тушунди</b>"
      : `➡️ <b>Вазифа «${esc(list.nom)}» устунига ўтди</b>`;
    const q = [sarlavha, "", "📌 <b>Вазифа</b>", esc(yangi.nom), ""];
    q.push(`👤 <b>${bajarmoqda || (xodimdan && !bajarmoqda) ? "Бажарувчи" : "Ким ўзгартирди"}:</b> ${kimdan}`);
    if (yangi.muddat) q.push(`⏳ <b>Тугатиш муддати:</b> ${sanaMatn(yangi.muddat)}${bajarmoqda ? (tSana(yangi.bajarildi) > yangi.muddat ? " — кечикиб бажарилди" : " — ўз вақтида") : ""}`);
    if (j.summa > 0) q.push(`💸 <b>Ҳисобланган жарима:</b> ${sumF(j.summa)} сўм (${j.kun} кун)`);
    if (izoh) { q.push("", "💬 <b>Изоҳ</b>", esc(izoh)); }
    if (bajarmoqda && fayllar.length) q.push("", `📷 ${fayllar.length} та расм юборилди`);
    q.push("", "👇 Тугмани босиб текширинг");
    const text = q.join("\n");
    // Ходим кўчирса — раҳбарларга (Сардор ака, Мурод ака); раҳбар кўчирса — ходимга
    const boshqa = ijroRo(yangi).filter((u) => u !== k.uid);
    const kimga = xodimdan ? await rahbarlar(env, k, yangi) : boshqa.length ? boshqa : [yangi.yaratdi];
    await bildir(env, { ws: k.ws, cardId: c.id, kimlarga: kimga, muallif: k.uid, tur: bajarmoqda ? "bajarildi" : "kochdi", matn: text, fayllar,
      qisqa: `${k.ism} ${bajarmoqda ? "бажарди" : "жараёнга олди"}: ${c.nom}` });
  }
  const M = await azolarOl(env, k.ws);
  return json({ ok: true, card: kartaDTO(yangi, M, B) });
}

/** Изоҳ: иккинчи томонга хабар + @эслатилганларга */
async function izohBildir(env, k, c, izoh, fayllar) {
  const M = await azolarOl(env, k.ws);
  const kora = (u) => { const a = M.get(Number(u)); return a && a.faol && (kamida(a.rol, "admin") || ijroRo(c).includes(Number(u))); };
  // Ходим ёзса — раҳбарларга (Сардор ака, Мурод ака); раҳбар ёзса — ходимга
  const xodimdan = ijroRo(c).includes(k.uid) && !kamida(k.rol, "admin");
  const ikkinchilar = xodimdan ? await rahbarlar(env, k, c) : ijroRo(c);
  const eslatilgan = [];
  const kichik = izoh.toLowerCase();
  for (const a of M.values()) {
    const bosh = String(a.ism).split(/\s+/)[0].toLowerCase();
    if (bosh.length >= 2 && kichik.includes("@" + bosh) && kora(a.uid) && !ikkinchilar.includes(Number(a.uid))) eslatilgan.push(Number(a.uid));
  }
  const text = (xodimdan ? `📩 <b>Сизга жавоб келди</b>\n\n👤 ${esc(k.ism)}` : `💬 <b>${esc(k.ism)}</b>`) + `\n📋 ${esc(c.nom)}${izoh ? `\n\n💬 ${esc(izoh)}` : ""}`;
  if (ikkinchilar.length) await bildir(env, { ws: k.ws, cardId: c.id, kimlarga: ikkinchilar, muallif: k.uid, tur: "izoh", matn: text, fayllar,
    qisqa: `${k.ism} изоҳ ёзди: ${izoh.slice(0, 60)}` });
  if (eslatilgan.length) await bildir(env, { ws: k.ws, cardId: c.id, kimlarga: eslatilgan, muallif: k.uid, tur: "eslatildi", qisqa: `${k.ism} сизни эслатди: ${c.nom}`, matn: `📣 <b>${esc(k.ism)} сизни эслатди</b>\n📋 ${esc(c.nom)}\n\n${esc(izoh)}` });
}

/** Ойлик жарима ва бонус: ходимлар кесимида + вазифалар рўйхати */
async function jarimaOy(env, k, oy, B) {
  const DB = env.DB;
  const davr = [k.ws, oy + "-01", oyKeyin(oy) + "-01"];
  const ol = (ustun) => DB.prepare(
    `SELECT c.* FROM ish_card c JOIN ish_board b ON b.id = c.board_id
      WHERE b.ws_id = ? AND c.ochirildi = 0 AND c.kimga IS NOT NULL AND c.${ustun} > 0
        AND c.muddat >= ? AND c.muddat < ? ORDER BY c.muddat LIMIT 2000`).bind(...davr).all();
  const [jq, bq, M] = await Promise.all([ol("jarima"), ol("bonus"), azolarOl(env, k.ws)]);
  const yig = (rows, maydon, kunHam) => {
    const cards = (rows.results || []).map((c) => kartaDTO(c, M, B)).filter((x) => x[maydon] > 0);
    const jam = new Map();
    for (const x of cards) for (const u of x.ijro) {
      const o = jam.get(u.id) || { id: u.id, ism: u.ism, soni: 0, ...(kunHam ? { kun: 0 } : {}), summa: 0 };
      o.soni++; if (kunHam) o.kun += x.jarimaKun; o.summa += x[maydon]; jam.set(u.id, o);
    }
    return { cards, xodimlar: [...jam.values()].sort((a, b) => b.summa - a.summa),
      jami: cards.reduce((t, x) => t + x[maydon], 0) };
  };
  const j = yig(jq, "jarima", true), b = yig(bq, "bonus", false);
  return { cards: j.cards, xodimlar: j.xodimlar, jami: j.jami,
    bonusCards: b.cards, bonusXodimlar: b.xodimlar, bonusJami: b.jami };
}

/* ─── эслатмалар (cron, кунига бир марта) ─── */
/** 🧹 Кунлик крон: архивда ARXIV_KUN кундан ортиқ турган вазифалар ўчирилади */
export async function ishTozala(env) {
  if (!env.DB) return { ok: 0 };
  const chegara = new Date(Date.now() - ARXIV_KUN * 86400_000).toISOString();
  // Бажарилган вазифалар ТАРИХ — улар ҳеч қачон ўчирилмайди (Достон 2026-10-07).
  // Фақат бажарилмай архивга олинганлари (бекор қилинганлари) тозаланади.
  const r = await env.DB.prepare("UPDATE ish_card SET ochirildi = 1, yangilandi = ? WHERE ochirildi = 0 AND bajarildi IS NULL AND arxiv IS NOT NULL AND arxiv < ?")
    .bind(hozir(), chegara).run();
  return { ok: Number((r.meta && r.meta.changes) || 0) };
}

/** 🔁 Кунлик крон: такрорланувчи вазифалардан янгисини яратади */
export async function ishTakror(env) {
  if (!env.DB) return { ok: 0 };
  const B = bugun();
  const d = new Date(Date.parse(B + "T00:00:00Z"));
  const haftaKun = ((d.getUTCDay() + 6) % 7) + 1;        // душанба = 1
  const oyKun = d.getUTCDate();
  const { results } = await env.DB.prepare("SELECT * FROM ish_takror WHERE faol = 1").all();
  let n = 0;
  for (const t of results || []) {
    if (t.oxirgi === B) continue;                        // бугун аллақачон яратилган
    const mos = t.davr === "kun" || (t.davr === "hafta" && Number(t.kuni) === haftaKun) || (t.davr === "oy" && Number(t.kuni) === oyKun);
    if (!mos) continue;
    const b = await env.DB.prepare("SELECT * FROM ish_board WHERE id = ? AND arxiv IS NULL").bind(t.board_id).first();
    if (!b) continue;
    const list = await env.DB.prepare("SELECT * FROM ish_list WHERE board_id = ? AND arxiv IS NULL ORDER BY pos, id LIMIT 1").bind(b.id).first();
    if (!list) continue;
    const azo = await env.DB.prepare("SELECT * FROM ish_azo WHERE ws_id = ? AND uid = ? AND faol = 1").bind(t.ws_id, t.kimga).first();
    if (!azo) continue;
    const v = hozir();
    const mx = await env.DB.prepare("SELECT MAX(pos) AS p FROM ish_card WHERE list_id = ? AND ochirildi = 0").bind(list.id).first();
    const r = await env.DB.prepare(
      `INSERT INTO ish_card (board_id, list_id, nom, tavsif, pos, muhim, yaratdi, kimga, ijro, muddat, tarif, vaqt, yangilandi)
       VALUES (?, ?, ?, ?, ?, 'medium', ?, ?, ?, ?, ?, ?, ?)`)
      .bind(b.id, list.id, t.nom, t.tavsif || "", (Number(mx && mx.p) || 0) + 1000, t.yaratdi, t.kimga, "," + Number(t.kimga) + ",",
        kunQosh(B, Number(t.muddat_kun) || 0), Number(azo.tarif) || TARIF, v, v).run();
    await env.DB.prepare("UPDATE ish_takror SET oxirgi = ? WHERE id = ?").bind(B, t.id).run();
    const bergan = (await azolarOl(env, t.ws_id)).get(Number(t.yaratdi));
    await bildir(env, { ws: t.ws_id, cardId: Number(r.meta.last_row_id), kimlarga: [Number(t.kimga)], tur: "berildi",
      matn: berildiMatn({ nom: t.nom, tavsif: t.tavsif, muddat: kunQosh(B, Number(t.muddat_kun) || 0), muhim: "medium" }, bergan || { ism: "Раҳбарият" }, B, await azolarOl(env, t.ws_id)),
      qisqa: `Янги вазифа: ${t.nom}` });
    n++;
  }
  return { ok: n };
}

export async function ishEslatma(env) {
  if (!env.DB) return { ok: false };
  const B = bugun(), ertaga = kunQosh(B, 1);
  const { results } = await env.DB.prepare(
    `SELECT c.*, b.ws_id FROM ish_card c JOIN ish_board b ON b.id = c.board_id
     WHERE c.ochirildi = 0 AND c.arxiv IS NULL AND b.arxiv IS NULL AND c.bajarildi IS NULL AND c.kimga IS NOT NULL AND c.muddat IS NOT NULL AND c.muddat <= ?
     ORDER BY c.muddat LIMIT 1000`).bind(ertaga).all();
  let n = 0;
  for (const c of results || []) {
    const j = jarimaHisob(c, B);
    const ijro = ijroRo(c);
    if (c.muddat === ertaga) n += await bildir(env, { ws: c.ws_id, cardId: c.id, kimlarga: ijro, tur: "yaqin", kalit: `yaqin:${c.id}:${c.muddat}`, qisqa: `1 кун қолди: ${c.nom}`,
      matn: `⏳ <b>Эслатма: муддат тугашига 1 кун қолди</b>\n\n📌 <b>Вазифа</b>\n${esc(c.nom)}\n\n⏳ <b>Тугатиш муддати:</b> ${sanaMatn(c.muddat)} (эртага)\n\nВазифани ўз вақтида топширишингизни сўраймиз.` });
    else if (c.muddat === B) n += await bildir(env, { ws: c.ws_id, cardId: c.id, kimlarga: ijro, tur: "bugun", kalit: `bugun:${c.id}:${c.muddat}`, qisqa: `Бугун муддати тугайди: ${c.nom}`, matn: `⏰ <b>Эслатма: муддат бугун тугайди</b>\n\n📌 <b>Вазифа</b>\n${esc(c.nom)}\n\nВазифа бугун топширилмаса, эртанги кундан бошлаб ҳар кун учун ${sumF(c.tarif)} сўм жарима ҳисобланади.` });
    else {
      n += await bildir(env, { ws: c.ws_id, cardId: c.id, kimlarga: ijro, tur: "kech", kalit: `kech:${c.id}:${B}`, qisqa: `${j.kun} кун кечикди: ${c.nom}`, matn: `⚠️ <b>Диққат: вазифа муддати ўтиб кетди</b>\n\n📌 <b>Вазифа</b>\n${esc(c.nom)}\n\n⏳ <b>Тугатиш муддати:</b> ${sanaMatn(c.muddat)} (${j.kun} кунга кечикди)\n💸 <b>Ҳисобланган жарима:</b> ${sumF(j.summa)} сўм (ҳар кун учун ${sumF(c.tarif)} сўм)\n\nВазифани имкон қадар тезроқ топширишингизни сўраймиз.` });
      n += await bildir(env, { ws: c.ws_id, cardId: c.id, kimlarga: [c.yaratdi], tur: "kech", kalit: `kechr:${c.id}:${c.muddat}`, qisqa: `Муддатида бажарилмади: ${c.nom}`, matn: `⚠️ <b>Вазифа муддатида бажарилмади</b>\n\n📌 <b>Вазифа</b>\n${esc(c.nom)}\n\n👤 <b>Бажарувчи:</b> ${esc(ismi(await azolarOl(env, c.ws_id), c.kimga))}\n⏳ <b>Тугатиш муддати:</b> ${sanaMatn(c.muddat)}` });
    }
  }
  return { ok: true, tekshirildi: (results || []).length, yuborildi: n };
}
