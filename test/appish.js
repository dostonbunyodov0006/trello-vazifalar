// test/appish.js — Vazifalar (Trello) API sinovlari: asl sinovlar/appish.js (344 ta) shu serverga ko'chirilgan.
// Asl fayldan farqi faqat ulanishda: modullar ../src/ dan, baza — src/db.js (node:sqlite) + migrations/,
// botdagi odamlar — ish_odam jadvali (Cloudflare'da KV «app:roles»), SHADOW=0 (soxta fetch tutadi),
// fayllar — vaqtinchalik papkada (diskka). Mazmunan o'zgargan 3 ta tekshiruv «[server]» deb belgilangan.
//   node test/appish.js      (XABAR=1 — xodimga boradigan xabar matnini ko'rsatadi)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bazaOch, migratsiya } from "../src/db.js";

const { ishApi, ishEslatma, ishTakror, ishTozala, jarimaHisob, bugun } = await import("../src/ish/api.js");
const { initDataYasa } = await import("../src/tma.js");
const { orasi, tormi } = await import("../src/ish/tartib.js");
const { turAniqla, nomTozala } = await import("../src/ish/saqlash.js");
const { mumkin } = await import("../src/ish/ruxsat.js");
const SOZ = await import("../src/ish/sozlama.js");
const FAYL_PAPKA = fs.mkdtempSync(path.join(os.tmpdir(), "trello-sinov-"));
process.on("exit", () => { try { fs.rmSync(FAYL_PAPKA, { recursive: true, force: true }); } catch {} });

const TOKEN = "123456789:AAFakeTokenForTestsOnly_abcdefghijk";
const DOSTON = 100000004, SARDOR = 100000002, MUROD = 100000003, ALI = 111222333, VALI = 444555666, BEGONA = 999000111;
const BLOK = new Set();
let TG = [];
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url), usul = u.split("/").pop();
  if (u.includes("/file/bot")) return new Response(new Uint8Array([1, 2, 3]));
  let chat = null, body = null;
  if (opt.body instanceof FormData) { body = opt.body; chat = Number(body.get("chat_id")); }
  else if (opt.body) { body = JSON.parse(opt.body); chat = Number(body.chat_id); }
  TG.push({ usul, chat, body });
  const j = (x) => new Response(JSON.stringify(x));
  if (chat && BLOK.has(chat)) return j({ ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" });
  if (usul === "sendDocument") return j({ ok: true, result: { document: { file_id: "DOC" + TG.length } } });
  if (usul === "getFile") return j({ ok: true, result: { file_path: "documents/x" } });
  return j({ ok: true, result: { message_id: 1 } });
};

let VAQT = Date.UTC(2026, 8, 22, 5, 0);           // 22.09.2026 10:00 Тошкент
Date.now = () => VAQT;
const kunOt = (n) => { VAQT += n * 86400_000; };

function yangiEnv(ochiq) {
  const DB = bazaOch(":memory:");
  migratsiya(DB);
  // Ботдаги ходимлар рўйхати (Cloudflare'да KV «app:roles».ismlar → бу серверда ish_odam): синов ходимлари бор, BEGONA — йўқ
  const ismlar = { [ALI]: "Али", [VALI]: "Вали", [MUROD]: "Мурод ака", [DOSTON]: "Достон", 100000011: "Руслан", 100000012: "Умрзоқ", 100000013: "Дилшод", ...Object.fromEntries(Array.from({ length: 42 }, (_, i) => [500000000 + i, "Ходим" + i])) };
  for (const [uid, ism] of Object.entries(ismlar)) DB.db.prepare("INSERT INTO ish_odam (uid, ism, bolim, vaqt) VALUES (?, ?, '', 'x')").run(Number(uid), ism);
  const FILES_DIR = fs.mkdtempSync(path.join(FAYL_PAPKA, "f-"));
  return { BOT_TOKEN: TOKEN, APP_URL: "https://app.example/app/", DB, SHADOW: "0", FILES_DIR, ...(ochiq ? { ISH_OCHIQ: "1" } : {}) };
}
const JPG = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PDF = () => new TextEncoder().encode("%PDF-1.4 test");
const fayl = (bytes, nom, type) => new File([bytes], nom, { type });
const rasm = (n = 1) => Array.from({ length: n }, (_, i) => fayl(JPG(), `r${i}.jpg`, "image/jpeg"));

async function sora(env, uid, yol, usul = "GET", body, { ism = "U" + uid, fayllar = [], xodimKozi = false, auth, rolKoz } = {}) {
  const headers = {};
  if (auth !== false) headers.authorization = auth || "tma " + await initDataYasa({ id: uid, first_name: ism }, TOKEN);
  if (xodimKozi) headers["x-ish-rol"] = "member";
  if (rolKoz) headers["x-ish-rol"] = rolKoz;
  let b;
  if (fayllar.length) {
    b = new FormData();
    for (const [k, v] of Object.entries(body || {})) b.append(k, typeof v === "string" ? v : JSON.stringify(v));
    for (const f of fayllar) b.append("fayl", f);
  } else if (body !== undefined) { headers["content-type"] = "application/json"; b = JSON.stringify(body); }
  const res = await ishApi(new Request("https://app/api/ish" + yol, { method: usul, headers, body: b }), env);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) return { status: res.status, ct, cd: res.headers.get("content-disposition"), bayt: new Uint8Array(await res.arrayBuffer()) };
  let d = {};
  try { d = await res.json(); } catch {}
  return { status: res.status, ...d };
}

let ok = 0, jami = 0;
const C = (n, shart, izoh) => { jami++; if (shart) ok++; console.log(`  ${shart ? "✅" : "❌"} ${n}${izoh ? "  — " + izoh : ""}`); };

/* ═══════════ 0. Соф функциялар ═══════════ */
console.log("\n🧮 Ёрдамчилар");
{
  C("жарима: муддат куни — 0", jarimaHisob({ muddat: "2026-09-22", tarif: 20000 }, "2026-09-22").summa === 0);
  C("жарима: 5 кун — 100 000", jarimaHisob({ muddat: "2026-09-22", tarif: 20000 }, "2026-09-27").summa === 100000);
  C("жарима: ой ошса (30.09 → 02.10) — 2 кун", jarimaHisob({ muddat: "2026-09-30", tarif: 20000 }, "2026-10-02").kun === 2);
  C("жарима: бажарилгач ўсмайди", jarimaHisob({ muddat: "2026-09-22", bajarildi: "2026-09-24T06:00:00.000Z", tarif: 20000 }, "2026-10-10").summa === 40000);
  C("жарима: Тошкент вақти (UTC 22.09 21:00 = 23.09 02:00) — 1 кун", jarimaHisob({ muddat: "2026-09-22", bajarildi: "2026-09-22T21:00:00.000Z", tarif: 20000 }, "2026-10-10").kun === 1);
  C("стандарт тариф 20 000", SOZ.TARIF === 20000);
  C("тартиб: ўртаси", orasi(1024, 2048) === 1536 && orasi(null, 1024) === 512 && orasi(2048, null) === 3072 && orasi(null, null) === 1024);
  C("тартиб: торайганини сезади", tormi(1, 1 + 1e-7, 1 + 5e-8) && !tormi(1024, 2048, 1536));
  C("файл тури байтлардан: JPEG", turAniqla(JPG(), "application/pdf") === "image/jpeg");
  C("файл тури: PDF", turAniqla(PDF(), "image/png") === "application/pdf");
  C("файл тури: EXE — рад", turAniqla(new Uint8Array([0x4d, 0x5a, 0, 0]), "image/jpeg") === null);
  C("файл тури: матн «png» деб юборилса — рад", turAniqla(new TextEncoder().encode("hello"), "image/png") === null);
  C("файл номи: йўл ва хавфли белгилар тозаланади", nomTozala("../../etc/<pa ss>.exe", "application/pdf") === "pa ss.pdf", nomTozala("../../etc/<pa ss>.exe", "application/pdf"));
  C("ҳуқуқ: member бошқанинг карточкасини кўрмайди", !mumkin({ rol: "member", uid: 1 }, "card.kor", { kimga: 2 }) && mumkin({ rol: "member", uid: 1 }, "card.kor", { kimga: 1 }));
  C("ҳуқуқ: admin (Мурод ака) ҳам ўчира олади, member — йўқ", mumkin({ rol: "admin", uid: 1 }, "card.ochir") && !mumkin({ rol: "member", uid: 1 }, "card.ochir"));
  let tashlandi = false; try { mumkin({ rol: "owner" }, "yoq.amal"); } catch { tashlandi = true; }
  C("ҳуқуқ: номаълум амал — хато (жимгина рухсат бермайди)", tashlandi);
}

/* ═══════════ 1. Кириш ва ёпиқ ҳолат ═══════════ */
console.log("\n🔒 Кириш · ёпиқ ҳолат (ҳозирги): фақат Достон");
{
  const env = yangiEnv(false); TG = [];
  C("имзосиз — 401", (await sora(env, ALI, "/men", "GET", undefined, { auth: false })).status === 401);
  C("сохта имзо — 401", (await sora(env, ALI, "/men", "GET", undefined, { auth: "tma user=%7B%22id%22%3A100000002%7D&auth_date=9999999999&hash=00" })).status === 401);
  const eski = await initDataYasa({ id: DOSTON, first_name: "D" }, TOKEN, { authDate: Math.floor(VAQT / 1000) - 2 * 86400 });
  C("муддати ўтган имзо — 401", (await sora(env, DOSTON, "/men", "GET", undefined, { auth: "tma " + eski })).status === 401);
  for (const [n, id] of [["ходим", ALI], ["бегона", BEGONA]]) C(`${n} — 403 (ёпиқ)`, (await sora(env, id, "/men")).status === 403);
  C("ёпиқ пайтда ходим аъзога айланмади", Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM ish_azo").first()).n) === 0);
  C("Сардор ака ёпиқ пайтда ҳам киради (KORADI рўйхатида)", (await sora(env, SARDOR, "/men")).ok === true);
  C("Мурод ака ҳам ёпиқ пайтда кира олмайди — 403", (await sora(env, MUROD, "/men")).status === 403);
  const [p1, p2] = await Promise.all([sora(env, DOSTON, "/boards"), sora(env, DOSTON, "/boards")]);
  C("бир вақтда биринчи кириш: битта workspace, битта доска", p1.ok && p2.ok && Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM ish_ws").first()).n) === 1 && Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM ish_board").first()).n) === 1);
  const m = await sora(env, DOSTON, "/men");
  C("Достон киради — owner, синовчи", m.ok && m.rol === "owner" && m.sinovchi && m.ochiq === false, JSON.stringify(m).slice(0, 150));
  const bs = await sora(env, DOSTON, "/boards");
  C("биринчи киришда «Асосий доска» ўзи яратилди", bs.boards.length === 1 && bs.boards[0].nom === "Асосий доска");
  const bd = await sora(env, DOSTON, `/boards/${bs.boards[0].id}`);
  C("стандарт устунлар: Янги · Жараёнда · Бажарилди(done)", bd.lists.map((l) => l.nom + l.tur).join("|") === "Янги|Жараёнда|Бажарилдиdone");
  C("стандарт label'лар бор", bd.labels.length === 4);
  C("Достон ўзини танлай олади (синов)", bd.azolar.some((x) => x.id === DOSTON));
  TG = [];
  const v = await sora(env, DOSTON, `/boards/${bd.board.id}/cards`, "POST", { nom: "Синов вазифа", kimga: DOSTON, muddat: "2026-09-23" }, { fayllar: rasm(1) });
  C("Достон ўзига вазифа берди", v.ok && v.card.kimga === DOSTON, JSON.stringify(v).slice(0, 150));
  C("Telegram хабари Достоннинг ўзига келди (расмсиз — фақат хабар)", TG.some((x) => x.chat === DOSTON && x.usul === "sendMessage") && !TG.some((x) => x.usul === "sendPhoto" || x.usul === "sendMediaGroup"));
  C("бошқа ҳеч кимга хабар кетмади", TG.every((x) => x.chat === DOSTON));
  C("X-Ish-Rol: member — раҳбар ходим сифатида кўради (фақат пасайтиради)", (await sora(env, DOSTON, "/men", "GET", undefined, { xodimKozi: true })).rol === "member");
  const ruslan = 100000011;   // ботдаги одам (ish_odam жадвалида)
  C("ходим кира олмайди", (await sora(env, ruslan, "/men")).status === 403);
  TG = [];
  const vr = await sora(env, DOSTON, `/boards/${bd.board.id}/cards`, "POST", { nom: "Руслонга", kimga: ruslan, muddat: "2026-09-23" });
  C("ёпиқ пайтда ходимга вазифа берилса ҳам Telegram хабари КЕТМАЙДИ", vr.ok && !TG.some((x) => x.chat === ruslan));
  C("вазифа берилган ходим ҳам кира олмайди (ёпиқ)", (await sora(env, ruslan, "/men")).status === 403);
  C("Сардор ака сайтга киради (KORADI рўйхатида)", (await sora(env, SARDOR, "/royxat")).ok === true);
}

/* ═══════════ 2. Очиқ ҳолат: тўлиқ оқим ═══════════ */
console.log("\n🔓 Очиқ ҳолат (ISH_OCHIQ = \"1\")");
{
  VAQT = Date.UTC(2026, 8, 22, 5, 0);
  const env = yangiEnv(true); TG = []; BLOK.clear();
  const S = (...a) => sora(env, ...a);
  const s = await S(SARDOR, "/men");
  C("Сардор ака — owner", s.rol === "owner" && s.owner);
  C("Мурод ака — admin", (await S(MUROD, "/men")).rol === "admin");
  const bg = await S(BEGONA, "/men", "GET", undefined, { ism: "Begona" });
  C("бегона (ботдаги рўйхатда йўқ) — 403, аъзо бўлмайди", bg.status === 403 && !(await env.DB.prepare("SELECT 1 AS x FROM ish_azo WHERE uid = ?").bind(BEGONA).first()));
  const a = await S(ALI, "/men", "GET", undefined, { ism: "Али" });
  C("янги одам — member (ўзи қўшилди)", a.rol === "member" && a.admin === false);
  await S(VALI, "/men", "GET", undefined, { ism: "Вали" });
  for (let i = 0; i < 42; i++) await S(500000000 + i, "/men", "GET", undefined, { ism: "Ходим" + i });
  const az = await S(SARDOR, "/azolar");
  C("46 аъзо (40+ ходим), бегона йўқ", az.azolar.length === 46 && !az.azolar.some((x) => x.id === BEGONA), String(az.azolar.length));
  C("«Ходимни танланг» рўйхатида бегона йўқ", !(await S(SARDOR, "/odamlar")).odamlar.some((x) => x.id === BEGONA));
  C("ходим аъзолар рўйхатини кўрмайди", (await S(ALI, "/azolar")).status === 403);
  C("ҳар бирининг тарифи 20 000", az.azolar.filter((x) => x.rol === "member").every((x) => x.tarif === 20000));

  const B1 = (await S(SARDOR, "/boards")).boards[0].id;
  const d0 = await S(SARDOR, `/boards/${B1}`);
  const [LY, LJ, LB] = d0.lists.map((l) => l.id);
  C("ходим доска/устун/label/вазифа яратолмайди", (await S(ALI, "/boards", "POST", { nom: "Меники" })).status === 403 &&
    (await S(ALI, `/boards/${B1}/lists`, "POST", { nom: "X" })).status === 403 && (await S(ALI, `/boards/${B1}/labels`, "POST", { nom: "X", rang: "#112233" })).status === 403 &&
    (await S(ALI, `/boards/${B1}/cards`, "POST", { nom: "X", kimga: ALI, muddat: "2026-09-23" })).status === 403);

  // доска фони (сайтда танланади)
  C("фон бошида бўш", d0.board.fon === "");
  C("фон сақланди", (await S(SARDOR, `/boards/${B1}`, "PATCH", { fon: "olov" })).ok && (await S(SARDOR, `/boards/${B1}`)).board.fon === "olov");
  C("рўйхатдаги фонлар рўйхатда чиқади", (await S(SARDOR, "/boards")).boards[0].fon === "olov");
  C("нотўғри фон рад этилди", (await S(SARDOR, `/boards/${B1}`, "PATCH", { fon: "<script>" })).status === 422);
  C("ходим фонни ўзгартиролмайди", (await S(ALI, `/boards/${B1}`, "PATCH", { fon: "kok" })).status === 403);
  await S(SARDOR, `/boards/${B1}`, "PATCH", { fon: "" });

  // яратиш текширувлари
  const V = (o = {}) => ({ nom: "20 та қутини омборга тушириш", tavsif: "Орқа эшикдан", kimga: ALI, muddat: "2026-09-23", muhim: "high", ...o });
  const P = (o, opt) => S(SARDOR, `/boards/${B1}/cards`, "POST", V(o), opt);
  C("номсиз — 422", (await P({ nom: " " })).status === 422);
  C("ходимсиз — 422", (await P({ kimga: "" })).status === 422);
  C("аъзо бўлмаган одамга — 422", (await P({ kimga: BEGONA })).status === 422);
  C("муддатсиз — 422", (await P({ muddat: "" })).status === 422);
  C("ўтган санага — 422", (await P({ muddat: "2026-09-21" })).status === 422);
  C("бегона доскадаги label — 422", (await P({ labels: [9999] })).status === 422);
  C("EXE файл — 422", (await P({}, { fayllar: [fayl(new Uint8Array([0x4d, 0x5a, 1, 2]), "virus.jpg", "image/jpeg")] })).status === 422);
  C("7 та файл — 422", (await P({}, { fayllar: rasm(7) })).status === 422);
  C("бошқа доскадаги устунга — 404", (await P({ list_id: 99999 })).status === 404);
  C("мавжуд бўлмаган доска — 404", (await S(SARDOR, "/boards/99999/cards", "POST", V())).status === 404);

  TG = [];
  const l1 = d0.labels[0].id;
  const v = await P({ labels: [l1] }, { fayllar: rasm(2) });
  C("Сардор ака расм ва label билан вазифа берди", v.ok && v.card.kimga === ALI && v.card.list_id === LY && v.card.tarif === 20000 && v.card.muhim === "high", JSON.stringify(v).slice(0, 200));
  const id = v.card.id;
  const xb = TG.find((x) => x.chat === ALI && x.usul === "sendMessage");
  if (process.env.XABAR) { console.log(["","──── ХОДИМГА БОРАДИГАН ХАБАР ────", xb.body.text.replace(/<[^>]+>/g, ""), "[ 📋 Вазифани очиш ]", "────────────────────────────────",""].join(String.fromCharCode(10))); }
  C("Алига расмий хабар: исм, вазифа, топширувчи, муддат, тартиб, тугма", xb
    && /^<b>.+<\/b>/.test(xb.body.text)
    && /вазифа бириктирилди/.test(xb.body.text)
    && xb.body.text.includes("20 та қутини омборга тушириш")
    && xb.body.text.includes("<b>Топширувчи:</b> Сардор ака")
    && /<b>Тугатиш муддати:<\/b> \d+ \S+/.test(xb.body.text)
    && /Тезроқ бажарилиши лозим/.test(xb.body.text)
    && xb.body.reply_markup.inline_keyboard[0][0].web_app.url.endsWith("card=" + id), xb && xb.body.text);
  C("Алига бошқа хабар (расм ва ҳ.к.) кетмади", TG.filter((x) => x.chat === ALI).length === 1);
  C("Сардор акага ўзига хабар кетмади", !TG.some((x) => x.chat === SARDOR));
  // [server] D1 ўрнига диск: файллар Telegram'га эмас, маҳаллий дискка (канал созланмаган)
  C("файллар Telegram'га эмас, дискка (канал созланмаган)", Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM ish_fayl WHERE kalit LIKE 'f:%'").first()).n) === 2
    && fs.readdirSync(env.FILES_DIR, { recursive: true }).filter((x) => /[0-9a-f]{24}$/.test(x)).length === 2);

  // кўриниш ва IDOR
  const da = await S(ALI, `/boards/${B1}`);
  C("Али доскада ўз вазифасини кўради (label, муқова, 2 файл)", da.cards.length === 1 && da.cards[0].labels[0] === l1 && da.cards[0].muqova && da.cards[0].soni.fayl === 2);
  C("Али ходимлар рўйхатини олмайди (доскада)", da.azolar.length === 0);
  C("Вали доскада ҳеч нима кўрмайди", (await S(VALI, `/boards/${B1}`)).cards.length === 0);
  C("Вали бегона карточкани id билан очолмайди (404)", (await S(VALI, `/cards/${id}`)).status === 404);
  C("Вали бегона карточкага изоҳ ёзолмайди (404)", (await S(VALI, `/cards/${id}/izohlar`, "POST", { matn: "x" })).status === 404);
  C("Вали бегона карточкани кўчиролмайди (404)", (await S(VALI, `/cards/${id}/kochir`, "POST", { list_id: LJ })).status === 404);
  const cd = await S(ALI, `/cards/${id}`);
  const fid = cd.fayllar[0].id;
  C("Вали бегона файлни ололмайди (404)", (await S(VALI, `/fayllar/${fid}`)).status === 404);
  const fa = await S(ALI, `/fayllar/${fid}`);
  C("Али файлни олади: тўғри тур", fa.status === 200 && fa.ct === "image/jpeg" && fa.bayt.length === 8);
  C("ходим карточкани таҳрирлай олмайди", (await S(ALI, `/cards/${id}`, "PATCH", { nom: "Бошқа" })).status === 403);
  C("ходим карточкада «tahrir» ҳуқуқини олмайди", cd.mumkin.tahrir === false && cd.mumkin.kochir === true && cd.mumkin.yoz === true);

  // ходим тушунди → Жараёнда
  TG = [];
  const k1 = await S(ALI, `/cards/${id}/kochir`, "POST", { list_id: LJ, ver: cd.card.ver });
  C("Али «Жараёнда»га ўтказди", k1.ok && k1.card.list_id === LJ && !k1.card.bajarildi);
  C("«Тушундим» — Сардор акага хабар кетди", TG.some((x) => x.chat === SARDOR && /Ходим вазифани тушунди/.test(x.body.text || "")));
  C("«Тушундим» — Мурод акага ҳам кетди", TG.some((x) => x.chat === MUROD && /Ходим вазифани тушунди/.test(x.body.text || "")));
  C("эски ver билан — 409 (бошқа ўзгартирган)", (await S(ALI, `/cards/${id}/kochir`, "POST", { list_id: LY, ver: cd.card.ver })).status === 409);
  C("расмсиз «Бажарилди» — 422", (await S(ALI, `/cards/${id}/kochir`, "POST", { list_id: LB })).status === 422);
  C("фақат изоҳ билан (расмсиз) — 422", (await S(ALI, `/cards/${id}/kochir`, "POST", { list_id: LB, matn: "тугатдим" })).status === 422);

  // муддат ўтди
  kunOt(3);   // 25.09
  const kc = (await S(SARDOR, `/boards/${B1}`)).cards.find((x) => x.id === id);
  C("25.09: 2 кун кечикди — 40 000", kc.kech && kc.jarimaKun === 2 && kc.tavsiya === 40000 && kc.jarima === 0, JSON.stringify({ k: kc.jarimaKun, j: kc.tavsiya }));
  TG = [];
  const k2 = await S(ALI, `/cards/${id}/kochir`, "POST", { list_id: LB, matn: "Ҳаммаси тушди, 20 та" }, { fayllar: rasm(2) });
  C("Али изоҳ + 2 расм билан «Бажарилди»", k2.ok && k2.card.bajarildi && k2.card.tavsiya === 40000, JSON.stringify(k2).slice(0, 150));
  const sb = TG.find((x) => x.chat === SARDOR && x.usul === "sendMessage");
  C("«Бажардим» — раҳбарларга хабар кетди", TG.some((x) => x.chat === SARDOR && /ВАЗИФА БАЖАРИЛДИ/.test(x.body.text || "")));
  C("хабарда вазифа номи, бажарувчи ва расм сони бор", TG.some((x) => x.chat === SARDOR
    && /20 та қутини омборга тушириш/.test(x.body.text || "")
    && /Бажарувчи:/.test(x.body.text || "")
    && /2 та расм юборилди/.test(x.body.text || "")), (TG.find((x) => x.chat === SARDOR) || {}).body && TG.find((x) => x.chat === SARDOR).body.text);
  C("ходимга ўзига хабар кетмади", !TG.some((x) => x.chat === ALI));
  C("ходим қайта очолмайди", (await S(ALI, `/cards/${id}/kochir`, "POST", { list_id: LJ })).status === 403);
  {
    // изоҳ мажбурий эмас: фақат расм билан ҳам бажариш мумкин
    const y = await S(SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Изоҳсиз ҳисобот", kimga: ALI, muddat: new Date(VAQT + 5 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10) });
    await S(ALI, `/cards/${y.card.id}/kochir`, "POST", { list_id: LJ });
    const fz = await S(ALI, `/cards/${y.card.id}/kochir`, "POST", { list_id: LB }, { fayllar: rasm(1) });
    C("изоҳсиз, фақат расм билан бажарилди", fz.ok && !!fz.card.bajarildi, JSON.stringify(fz).slice(0, 120));
  }
  const cd2 = await S(SARDOR, `/cards/${id}`);
  C("изоҳ ва унинг 2 расми карточкада", cd2.izohlar.length === 1 && cd2.izohlar[0].fayllar.length === 2 && cd2.izohlar[0].ism === "Али");
  C("фаоллик: яратилди, кўчди ×2, изоҳ", ["card.yarat", "card.kochir", "izoh"].every((a) => cd2.faol.some((f) => f.amal === a)) && cd2.faol.filter((f) => f.amal === "card.kochir").length === 2);
  C("бажарилган куни доскада туради", (await S(SARDOR, `/boards/${B1}`)).cards.some((x) => x.id === id));
  kunOt(1);   // 26.09
  C("эртасига: раҳбарнинг доскасида туради, ходимда йўқ", (await S(SARDOR, `/boards/${B1}`)).cards.some((x) => x.id === id) && !(await S(ALI, "/meniki")).cards.some((x) => x.id === id));
  const ar = await S(SARDOR, "/qidir?holat=arxiv");
  C("эртасига ҳам раҳбарда «Бажарилди»да туради (архив/ўчиришни ўзи ҳал қилади)", (await S(SARDOR, "/royxat")).cards.some((x) => x.id === id && x.holat === "bajarildi" && x.tavsiya === 40000));
  C("ходимда бажарилган вазифа кўринмайди", !(await S(ALI, "/royxat")).cards.some((x) => x.id === id));
  C("раҳбар ҳал қилмагунча архивда йўқ", !ar.cards.some((x) => x.id === id));
  C("архив ой бўйича: бўш ой — бўш рўйхат", (await S(SARDOR, "/qidir?holat=arxiv&oy=2026-10")).cards.length === 0);
  C("ходим архивни кўрмайди (фақат раҳбарлар) — 403", (await S(ALI, "/qidir?holat=arxiv")).status === 403);
  C("нотўғри ой — 422", (await S(SARDOR, "/qidir?holat=arxiv&oy=2026-13")).status === 422);
  TG = [];
  const qy = await S(MUROD, `/cards/${id}/kochir`, "POST", { list_id: LJ, matn: "Иккитаси ҳали ташқарида" });
  C("админ қайта очди — bajarildi тозаланди, доскага қайтди", qy.ok && !qy.card.bajarildi && (await S(ALI, `/boards/${B1}`)).cards.some((x) => x.id === id));
  C("раҳбар қайта очса — ходимга хабар кетади", TG.some((x) => x.chat === ALI && /қайта очилди/.test(x.body.text || "")));
  VAQT = Date.UTC(2026, 8, 22, 5, 0);

  // тартиб (drag & drop)
  const yarat = async (nom) => (await S(SARDOR, `/boards/${B1}/cards`, "POST", V({ nom, labels: [] }))).card;
  const [c1, c2, c3] = [await yarat("Бир"), await yarat("Икки"), await yarat("Уч")];
  const tartib = async () => (await S(SARDOR, `/boards/${B1}`)).cards.filter((x) => x.list_id === LY).map((x) => x.nom).join(",");
  C("янги карточкалар устун охирига", (await tartib()) === "Бир,Икки,Уч");
  await S(SARDOR, `/cards/${c3.id}/kochir`, "POST", { list_id: LY, oldin: c1.id, keyin: c2.id });
  C("«Уч» ни «Бир» ва «Икки» орасига", (await tartib()) === "Бир,Уч,Икки");
  await S(SARDOR, `/cards/${c2.id}/kochir`, "POST", { list_id: LY, keyin: c1.id });
  C("«Икки» ни бошига", (await tartib()) === "Икки,Бир,Уч");
  C("бошқа устундаги қўшни — 409 (эскирган)", (await S(SARDOR, `/cards/${c1.id}/kochir`, "POST", { list_id: LJ, oldin: c3.id })).status === 409);
  C("тескари қўшнилар (oldin > keyin) — 409", (await S(SARDOR, `/cards/${c1.id}/kochir`, "POST", { list_id: LY, oldin: c3.id, keyin: c2.id })).status === 409);
  for (let i = 0; i < 60; i++) {   // бир жойга қайта-қайта — жой торайиб, қайта рақамланади
    const ro = (await S(SARDOR, `/boards/${B1}`)).cards.filter((x) => x.list_id === LY);
    await S(SARDOR, `/cards/${ro[ro.length - 1].id}/kochir`, "POST", { list_id: LY, oldin: ro[0].id, keyin: ro[1].id });
  }
  const ro = (await S(SARDOR, `/boards/${B1}`)).cards.filter((x) => x.list_id === LY);
  C("60 марта орага қўйилса ҳам тартиб бузилмайди (қайта рақамланади)", ro.length === 3 && new Set(ro.map((x) => x.pos)).size === 3 && ro.every((x, i) => i === 0 || x.pos > ro[i - 1].pos));
  C("бир вақтда иккита кўчириш: иккинчиси 409", await (async () => {
    const cc = (await S(SARDOR, `/cards/${c1.id}`)).card;
    const [r1, r2] = await Promise.all([S(SARDOR, `/cards/${c1.id}/kochir`, "POST", { list_id: LJ, ver: cc.ver }), S(MUROD, `/cards/${c1.id}/kochir`, "POST", { list_id: LB, ver: cc.ver })]);
    return [r1.status, r2.status].sort().join() === "200,409";
  })());

  // таҳрир, ver, тариф
  const e = (await S(SARDOR, `/cards/${c2.id}`)).card;
  C("эски ver билан таҳрир — 409", (await S(MUROD, `/cards/${c2.id}`, "PATCH", { nom: "Янги ном", ver: e.ver - 1 })).status === 409);
  TG = [];
  const pt = await S(MUROD, `/cards/${c2.id}`, "PATCH", { nom: "Икки (таҳрир)", kimga: VALI, muhim: "urgent", ver: e.ver });
  C("админ таҳрирлади: ном, ходим (Вали), муҳимлик", pt.ok && pt.card.kimga === VALI && pt.card.muhim === "urgent" && pt.card.ver === e.ver + 1);
  C("Валига янги вазифа хабари", TG.some((x) => x.chat === VALI && x.body.text && /вазифа бириктирилди/.test(x.body.text)));
  C("Али энди бу карточкани кўрмайди", (await S(ALI, `/cards/${c2.id}`)).status === 404);
  C("нотўғри муҳимлик — 422", (await S(MUROD, `/cards/${c2.id}`, "PATCH", { muhim: "juda" })).status === 422);
  C("ходим жарима ёза олмайди", [403, 404].includes((await S(ALI, `/cards/${c2.id}/jarima`, "POST", { summa: 0 })).status));
  C("Мурод ака жарима ёзади (шу вазифа учун шу ходимга)", (await S(MUROD, `/cards/${c2.id}/jarima`, "POST", { summa: 15000 })).card.jarima === 15000);
  C("нотўғри сумма — 422", (await S(MUROD, `/cards/${c2.id}/jarima`, "POST", { summa: -5 })).status === 422);
  C("жарима фаолликда ёзилди", (await S(SARDOR, `/cards/${c2.id}`)).faol.some((f) => f.amal === "jarima"));
  await S(MUROD, `/cards/${c2.id}/jarima`, "POST", { summa: 0 });
  C("owner жаримани бекор қилади (0)", (await S(SARDOR, `/cards/${c2.id}`, "PATCH", { tarif: 0 })).card.tarif === 0);
  const fl = await S(SARDOR, `/cards/${c2.id}`);
  C("фаоллик: ном, ходим, муҳимлик, тариф", ["card.nom", "card.kimga", "card.muhim", "card.tarif"].every((a) => fl.faol.some((f) => f.amal === a)));

  // label
  const nl = await S(MUROD, `/boards/${B1}/labels`, "POST", { nom: "Backend", rang: "#3E8EDE" });
  C("админ label яратди", nl.ok);
  C("такрорий label — 409", (await S(MUROD, `/boards/${B1}/labels`, "POST", { nom: "Backend", rang: "#3E8EDE" })).status === 409);
  C("нотўғри ранг — 422", (await S(MUROD, `/boards/${B1}/labels`, "POST", { nom: "X", rang: "red;}" })).status === 422);
  await S(MUROD, `/cards/${c1.id}`, "PATCH", { labels: [nl.id, l1] });
  C("label фильтри", (await S(SARDOR, `/boards/${B1}?label=${nl.id}`)).cards.map((x) => x.id).join() === String(c1.id));
  await S(MUROD, `/cards/${c1.id}`, "PATCH", { labels: [l1] });
  C("label олиб ташланди, фаолликда ± бор", !(await S(SARDOR, `/boards/${B1}?label=${nl.id}`)).cards.length && (await S(SARDOR, `/cards/${c1.id}`)).faol.some((f) => f.amal === "label-"));

  // фильтр ва қидирув
  C("муҳимлик фильтри", (await S(SARDOR, `/boards/${B1}?muhim=urgent`)).cards.every((x) => x.muhim === "urgent"));
  C("ходим фильтри", (await S(SARDOR, `/boards/${B1}?kimga=${VALI}`)).cards.every((x) => x.kimga === VALI));
  C("қидирув: ном бўйича", (await S(SARDOR, `/boards/${B1}?q=Икки`)).cards.length === 1);
  C("қидирув: «%» ҳаммасини бермайди", (await S(SARDOR, `/boards/${B1}?q=%25%25`)).cards.length === 0);
  C("ходимнинг «kimga» фильтри бегонани очмайди", (await S(ALI, `/boards/${B1}?kimga=${VALI}`)).cards.every((x) => x.kimga === ALI));

  // checklist
  const cl = await S(ALI, `/cards/${c1.id}/checklists`, "POST", { nom: "Қадамлар" });
  C("ходим (эгаси) checklist яратди", cl.ok);
  const i1 = await S(ALI, `/checklists/${cl.id}/items`, "POST", { nom: "Қутиларни санаш" });
  const i2 = await S(ALI, `/checklists/${cl.id}/items`, "POST", { nom: "Стеллажга териш" });
  await S(ALI, `/items/${i1.id}`, "PATCH", { bajarildi: true });
  const pr = (await S(ALI, `/boards/${B1}`)).cards.find((x) => x.id === c1.id).soni;
  C("доскада 1 / 2 бажарилди", pr.chk === 2 && pr.chkOk === 1, JSON.stringify(pr));
  await S(ALI, `/items/${i2.id}`, "PATCH", { keyin: i1.id });
  C("бандлар тартиби ўзгарди", (await S(ALI, `/cards/${c1.id}`)).checklists[0].items[0].id === i2.id);
  C("бошқа ходим checklist'га тега олмайди", (await S(VALI, `/items/${i1.id}`, "PATCH", { bajarildi: false })).status === 404);
  C("фаолликда «chk.ok»", (await S(SARDOR, `/cards/${c1.id}`)).faol.some((f) => f.amal === "chk.ok"));
  await S(ALI, `/items/${i2.id}`, "DELETE");
  C("банд ўчирилди", (await S(ALI, `/cards/${c1.id}`)).checklists[0].items.length === 1);

  // изоҳлар
  const z1 = await S(ALI, `/cards/${c1.id}/izohlar`, "POST", { matn: "Бошладим", kalit: "abc-1" });
  const z1b = await S(ALI, `/cards/${c1.id}/izohlar`, "POST", { matn: "Бошладим", kalit: "abc-1" });
  C("такрорий юбориш — битта изоҳ", z1b.takror && z1b.id === z1.id && (await S(ALI, `/cards/${c1.id}`)).izohlar.length === 1);
  C("ўз изоҳини таҳрирлайди", (await S(ALI, `/izohlar/${z1.id}`, "PATCH", { matn: "Бошладим, 5 та қолди" })).ok);
  const z2 = await S(MUROD, `/cards/${c1.id}/izohlar`, "POST", { matn: "Тезроқ" });
  C("бошқанинг изоҳини таҳрирлай олмайди", (await S(ALI, `/izohlar/${z2.id}`, "PATCH", { matn: "x" })).status === 403);
  C("ходим бошқанинг изоҳини ўчиролмайди", (await S(ALI, `/izohlar/${z2.id}`, "DELETE")).status === 403);
  C("админ модерация: ходимнинг изоҳини ўчиради", (await S(MUROD, `/izohlar/${z1.id}`, "DELETE")).ok && (await S(ALI, `/cards/${c1.id}`)).izohlar.length === 1);
  TG = [];
  await S(ALI, `/cards/${c1.id}/izohlar`, "POST", { matn: "@Мурод қаерга қўяй?" });
  C("изоҳ — Telegram'га кетмади", !TG.some((x) => x.chat === MUROD));
  C("изоҳ — Сардор акага ҳам кетмади", !TG.some((x) => x.chat === SARDOR));
  C("бўш изоҳ — 422", (await S(ALI, `/cards/${c1.id}/izohlar`, "POST", { matn: "  " })).status === 422);
  C("XSS матн ҳам сақланади (Telegram'га кетмайди)", (await S(ALI, `/cards/${c1.id}/izohlar`, "POST", { matn: "<script>x</script>" })).ok);

  // файллар
  C("PDF юклаш", (await S(ALI, `/cards/${c1.id}/fayllar`, "POST", {}, { fayllar: [fayl(PDF(), "../../hisobot.pdf", "application/pdf")] })).ok);
  const pf = (await S(ALI, `/cards/${c1.id}`)).fayllar.find((x) => x.mime === "application/pdf");
  C("номи тозаланган, PDF — attachment", pf && pf.nom === "hisobot.pdf" && (await S(ALI, `/fayllar/${pf.id}`)).cd.startsWith("attachment"));
  C("«rasm.jpg» деб юборилган HTML — 422", (await S(ALI, `/cards/${c1.id}/fayllar`, "POST", {}, { fayllar: [fayl(new TextEncoder().encode("<html>"), "rasm.jpg", "image/jpeg")] })).status === 422);
  // [server] дискда чегара 8 МБ (D1 қатори чегараси 1,5 МБ эди): 2 МБ ўтади, 9 МБ — 413
  const katta = new Uint8Array(2_000_000); katta.set([0xff, 0xd8, 0xff]);
  const juda = new Uint8Array(9_000_000); juda.set([0xff, 0xd8, 0xff]);
  C("2 МБ файл дискка сиғади, 8 МБ дан катта — 413", (await S(ALI, `/cards/${c1.id}/fayllar`, "POST", {}, { fayllar: [fayl(katta, "k.jpg", "image/jpeg")] })).ok === true
    && (await S(ALI, `/cards/${c1.id}/fayllar`, "POST", {}, { fayllar: [fayl(juda, "j.jpg", "image/jpeg")] })).status === 413);
  const mf = await S(MUROD, `/cards/${c1.id}/fayllar`, "POST", {}, { fayllar: rasm(1) });
  const mfid = (await S(ALI, `/cards/${c1.id}`)).fayllar.find((x) => x.yukladi === MUROD).id;
  C("ходим бошқанинг файлини ўчиролмайди", mf.ok && (await S(ALI, `/fayllar/${mfid}`, "DELETE")).status === 403);
  C("ўз файлини ўчиради", (await S(ALI, `/fayllar/${pf.id}`, "DELETE")).ok && (await S(ALI, `/fayllar/${pf.id}`)).status === 404);

  // Telegram канал сақлагич
  const env2 = { ...env, ISH_FAYL_CHAT: "-100777" }; TG = [];
  await sora(env2, ALI, `/cards/${c1.id}/fayllar`, "POST", {}, { fayllar: rasm(1) });
  C("ISH_FAYL_CHAT бўлса — файл Telegram каналига", TG.some((x) => x.usul === "sendDocument" && x.chat === -100777));
  const tf = (await sora(env2, ALI, `/cards/${c1.id}`)).fayllar.at(-1);
  C("каналдаги файл ҳам очилади", (await sora(env2, ALI, `/fayllar/${tf.id}`)).status === 200);

  // архив/тиклаш/ўчириш
  C("ходим архивлай олмайди", (await S(ALI, `/cards/${c1.id}/arxiv`, "POST", {})).status === 403);
  await S(MUROD, `/cards/${c3.id}/arxiv`, "POST", {});
  C("архивланган доскада йўқ, архивда бор", !(await S(SARDOR, `/boards/${B1}`)).cards.some((x) => x.id === c3.id) && (await S(SARDOR, "/qidir?holat=arxiv")).cards.some((x) => x.id === c3.id));
  await S(MUROD, `/cards/${c3.id}/arxiv`, "POST", { arxiv: false });
  C("тикланди", (await S(SARDOR, `/boards/${B1}`)).cards.some((x) => x.id === c3.id));
  C("ходим ўчира олмайди", (await S(ALI, `/cards/${c1.id}`, "DELETE")).status === 403);
  C("архив ой бўйича: 2026-09 да бор", (await S(SARDOR, "/qidir?holat=arxiv&oy=2026-09")).cards.length >= 0);
  C("Мурод ака ўчиради; ҳеч қаерда кўринмайди", (await S(MUROD, `/cards/${c3.id}`, "DELETE")).ok && (await S(SARDOR, `/cards/${c3.id}`)).status === 404 && !(await S(SARDOR, "/qidir?holat=arxiv")).cards.some((x) => x.id === c3.id) && !(await S(SARDOR, "/royxat")).cards.some((x) => x.id === c3.id));

  // жарима ҳисоботи
  VAQT = Date.UTC(2026, 8, 26, 5, 0);
  const jr = await S(SARDOR, "/jarima?oy=2026-09");
  const ja = jr.xodimlar.find((x) => x.id === ALI);
  C("жарима ёзилмагунча ҳисобда йўқ (фақат таклиф)", !jr.xodimlar.some((x) => x.id === ALI));
  await S(SARDOR, `/cards/${id}/jarima`, "POST", { summa: 50000 });
  const jr2 = await S(SARDOR, "/jarima?oy=2026-09");
  C("Сардор ака 50 000 ёзди — Алига ҳисобланди", jr2.xodimlar.some((x) => x.id === ALI && x.summa === 50000) && jr2.jami >= 50000, JSON.stringify(jr2.xodimlar));
  C("жарима: тарифи 0 қилинган вазифа ҳисобга кирмайди", !jr.cards.some((x) => x.id === c2.id));
  C("ходим жаримани кўрмайди (фақат раҳбарлар) — 403", (await S(ALI, "/jarima?oy=2026-09")).status === 403);
  C("Мурод ака жаримани кўради", (await S(MUROD, "/jarima?oy=2026-09")).ok === true);
  VAQT = Date.UTC(2026, 8, 22, 5, 0);

  // эслатмалар (cron)
  await S(SARDOR, `/boards/${B1}/cards`, "POST", V({ nom: "Эртага", muddat: "2026-09-23", labels: [] }));
  await S(SARDOR, `/boards/${B1}/cards`, "POST", V({ nom: "Бугун", muddat: "2026-09-22", labels: [] }));
  TG = [];
  const e1 = await ishEslatma(env);
  const yq = TG.filter((x) => x.usul === "sendMessage");
  C("cron: 1 кун қолганда расмий эслатма", yq.some((x) => x.chat === ALI)
    && yq.every((x) => /муддат тугашига 1 кун қолди/.test(x.body.text) && /Тугатиш муддати:/.test(x.body.text) && x.body.reply_markup), JSON.stringify(e1));
  TG = [];
  await ishEslatma(env);
  C("cron: қайта юрса такрорламайди", !TG.some((x) => x.body && x.body.text && /Эртага муддат|Бугун муддат/.test(x.body.text)));
  kunOt(2);   // 24.09 — иккаласи кечикди
  TG = [];
  await ishEslatma(env);
  C("cron: кечикканда ҳам Telegram'га кетмайди", !TG.some((x) => x.usul === "sendMessage"));
  kunOt(1); TG = [];
  await ishEslatma(env);
  C("эртасига ҳам кетмайди", !TG.some((x) => x.usul === "sendMessage"));
  VAQT = Date.UTC(2026, 8, 22, 5, 0);

  // билдиришномалар
  const bl = await S(ALI, "/bildir");
  C("Алининг илова ичидаги билдиришномалари", bl.bildir.length >= 3 && bl.bildir.some((x) => x.tur === "berildi"));
  C("/men да ўқилмаганлар сони", (await S(ALI, "/men")).oqilmagan === bl.bildir.filter((x) => !x.oqildi).length);
  await S(ALI, "/bildir/oqildi", "POST", {});
  C("ҳаммасини ўқилди қилиш", (await S(ALI, "/men")).oqilmagan === 0);
  C("бошқанинг билдиришномасини кўрмайди", (await S(VALI, "/bildir")).bildir.every((x) => x.card_id !== c1.id));

  // Очиқ ҳолатда ҳар бир ходим киради; исми — ботдаги рўйхатдагидек
  const umr = 100000012;   // ботдаги одам
  const um = await S(umr, "/men", "GET", undefined, { ism: "Umrzoq TG" });
  C("очиқ ҳолатда ходим киради — member, исми ботдагидек (Умрзоқ)", um.ok && um.rol === "member" && um.ism === "Умрзоқ", JSON.stringify({ r: um.rol, i: um.ism }));
  C("ходим вазифа бера олмайди (фақат Сардор ака ва Мурод ака)", (await S(umr, `/boards/${B1}/cards`, "POST", V({ kimga: umr }))).status === 403);
  C("ходим «Кимга?» рўйхатини ҳам ололмайди", (await S(umr, "/odamlar")).status === 403);

  // «Кимга?» — ботдаги одамлар (ҳали Trello очмаган бўлса ҳам)
  const od = await S(SARDOR, "/odamlar");
  const DILSHOD = 100000013;   // ботда бор, Trello'ни ҳеч очмаган
  C("«Кимга?» рўйхатида ботдаги одамлар ҳам бор", od.ok && od.odamlar.some((x) => x.id === DILSHOD) && od.odamlar.some((x) => x.id === ALI));
  C("ходим «Кимга?» рўйхатини ололмайди", (await S(ALI, "/odamlar")).status === 403);
  const vd = await S(SARDOR, `/boards/${B1}/cards`, "POST", V({ nom: "Дилшодга", kimga: DILSHOD, labels: [] }));
  C("ботдаги одамга вазифа берилди — ўзи аъзо бўлди (member)", vd.ok && (await S(SARDOR, "/azolar")).azolar.some((x) => x.id === DILSHOD && x.rol === "member"));
  C("ботда йўқ бегонага — 422", (await S(SARDOR, `/boards/${B1}/cards`, "POST", V({ kimga: 123456789 }))).status === 422);
  // оддий рўйхат ва ҳолат
  const ry = await S(SARDOR, "/royxat");
  const ryc = ry.cards.find((x) => x.id === vd.card.id);
  C("/royxat: янги вазифа «yangi» ҳолатида", ryc && ryc.holat === "yangi" && ryc.board_nom);
  C("/royxat: ходим фақат ўзиникини кўради", (await S(ALI, "/royxat")).cards.every((x) => x.kimga === ALI));
  const hj = await S(SARDOR, `/cards/${vd.card.id}/kochir`, "POST", { holat: "jarayon" });
  C("ҳолат бўйича кўчириш: «jarayon» → Жараёнда устуни", hj.ok && hj.card.list_id === LJ);
  C("ходим «bajarildi» ҳолатини расмсиз қўя олмайди", (await S(ALI, `/cards/${id}/kochir`, "POST", { holat: "bajarildi" })).status === 422);
  C("нотўғри ҳолат — 404 (устун йўқ)", (await S(SARDOR, `/cards/${vd.card.id}/kochir`, "POST", { holat: "yoq" })).status === 404);

  // менинг вазифаларим
  const mn = await S(ALI, "/meniki");
  C("«Менинг вазифаларим»: фақат Алиники, доска номи билан", mn.cards.length > 0 && mn.cards.every((x) => x.kimga === ALI && x.board_nom));

  // доскалар ва устунлар
  const nb = await S(MUROD, "/boards", "POST", { nom: "Омбор" });
  C("админ доска яратди (стандарт устунлар билан)", nb.ok && (await S(MUROD, `/boards/${nb.id}`)).lists.length === 3);
  await S(MUROD, `/boards/${nb.id}`, "PATCH", { keyin: B1 });
  C("доскалар тартиби: «Омбор» биринчи", (await S(ALI, "/boards")).boards[0].id === nb.id);
  C("ходим доска номини ўзгартира олмайди", (await S(ALI, `/boards/${nb.id}`, "PATCH", { nom: "x" })).status === 403);
  const nl2 = await S(MUROD, `/boards/${nb.id}/lists`, "POST", { nom: "Текширувда" });
  const dl = (await S(MUROD, `/boards/${nb.id}`)).lists;
  await S(MUROD, `/lists/${nl2.id}`, "PATCH", { oldin: dl[1].id, keyin: dl[2].id });
  C("устун «Жараёнда» ва «Бажарилди» орасига", (await S(MUROD, `/boards/${nb.id}`)).lists.map((l) => l.nom).join() === "Янги,Жараёнда,Текширувда,Бажарилди");
  C("бошқа доскага кўчириш (бегона устун) — 404", (await S(MUROD, `/cards/${c1.id}/kochir`, "POST", { list_id: dl[0].id })).status === 404);
  C("вазифаси бор устунни архивлаш — 409", (await S(MUROD, `/lists/${LY}`, "PATCH", { arxiv: true })).status === 409);
  C("бўш устунни архивлаш", (await S(MUROD, `/lists/${nl2.id}`, "PATCH", { arxiv: true })).ok && (await S(MUROD, `/boards/${nb.id}`)).lists.length === 3);
  C("доскани архивлаш", (await S(MUROD, `/boards/${nb.id}`, "PATCH", { arxiv: true })).ok && !(await S(ALI, "/boards")).boards.some((b) => b.id === nb.id));
  C("охирги доскани архивлаб бўлмайди — 409", (await S(MUROD, `/boards/${B1}`, "PATCH", { arxiv: true })).status === 409);
  C("архивдаги доскага вазифа бериб бўлмайди — 404", (await S(MUROD, `/boards/${nb.id}/cards`, "POST", V())).status === 404);

  // аъзолар ва роллар
  C("админ роль ўзгартира олмайди", (await S(MUROD, `/azolar/${ALI}`, "PUT", { rol: "admin" })).status === 403);
  C("owner ўз ролини ўзгартира олмайди", (await S(SARDOR, `/azolar/${SARDOR}`, "PUT", { rol: "member" })).status === 403);
  C("нотўғри роль — 422", (await S(SARDOR, `/azolar/${ALI}`, "PUT", { rol: "god" })).status === 422);
  C("owner тариф ва бўлим беради", (await S(SARDOR, `/azolar/${VALI}`, "PUT", { tarif: 30000, bolim: "gruzchik", ism: "Вали Грузчик" })).ok);
  const vv = await S(SARDOR, `/boards/${B1}/cards`, "POST", V({ nom: "Валига", kimga: VALI, labels: [] }));
  C("янги вазифага ходимнинг тарифи (30 000) ёзилди", vv.card.tarif === 30000 && vv.card.kimgaIsm === "Вали Грузчик");
  C("манфий тариф — 422", (await S(SARDOR, `/azolar/${VALI}`, "PUT", { tarif: -1 })).status === 422);
  C("Алини админ қилиш", (await S(SARDOR, `/azolar/${ALI}`, "PUT", { rol: "admin" })).ok && (await S(ALI, "/men")).rol === "admin");
  await S(SARDOR, `/azolar/${ALI}`, "PUT", { rol: "member" });
  C("Валини чиқариш: у энди кира олмайди", (await S(SARDOR, `/azolar/${VALI}`, "PUT", { faol: false })).ok && (await S(VALI, "/men")).status === 403);
  C("чиқарилганга вазифа бериб бўлмайди", (await S(SARDOR, `/boards/${B1}/cards`, "POST", V({ kimga: VALI }))).status === 422);
  C("аъзолар ўзгариши аудитда", Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM ish_faol WHERE amal = 'azo.ozgardi'").first()).n) >= 4);

  // ҳимоя
  C("Мурод ака X-Ish-Rol: owner юборса ҳам owner бўлолмайди", (await S(MUROD, "/men", "GET", undefined, { rolKoz: "owner" })).rol === "admin");
  C("ходим X-Ish-Rol: owner юборса ҳам member", (await S(ALI, "/men", "GET", undefined, { rolKoz: "owner" })).rol === "member");
  C("Сардор ака X-Ish-Rol: member — ходим сифатида (вазифа бера олмайди)", (await S(SARDOR, "/men", "GET", undefined, { xodimKozi: true })).rol === "member" && (await S(SARDOR, `/boards/${B1}/cards`, "POST", V(), { xodimKozi: true })).status === 403);
  C("бузуқ JSON — 422", (await ishApi(new Request("https://app/api/ish/boards", { method: "POST", headers: { authorization: "tma " + await initDataYasa({ id: SARDOR, first_name: "S" }, TOKEN), "content-type": "application/json" }, body: "{bad" }), env)).status === 422);
  C("номаълум йўл — 404", (await S(SARDOR, "/yoq")).status === 404);
  C("SQL инъекция id да — 404", (await S(SARDOR, "/cards/1%20OR%201=1")).status === 404);
  // [server] бу базада бошқа бўлимлар йўқ: фақат ish_* ва сервер жадваллари
  C("бошқа жадвалларга тегмайди (базада фақат ish_* ва сервер жадваллари)", (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).results
    .every((t) => /^(ish_|tg_outbox$|cron_run$|_migratsiya$|sqlite_)/.test(t.name)));
}

/* ═══════════ 3. Веб-сайт: логин/парол ═══════════ */
console.log("\n🖥 Веб-сайт (Сардор ака, Мурод ака)");
{
  VAQT = Date.UTC(2026, 8, 22, 5, 0);
  const env = yangiEnv(true); TG = [];
  const { parolHash } = await import("../src/ish/sayt.js");
  const tuz = "a1".repeat(16);
  const kir = async (login, uid, parol) => env.DB.prepare("INSERT OR REPLACE INTO ish_kirish (login, uid, hash, tuz, takror, yangilandi) VALUES (?, ?, ?, ?, ?, ?)").bind(login, uid, await parolHash(parol, tuz, 1000), tuz, 1000, "x").run();
  await kir("sardor", SARDOR, "Kuchli-Parol-1"); await kir("ali", ALI, "ali-parol-12");
  await sora(env, ALI, "/men", "GET", undefined, { ism: "Али" });
  const R = (yol, usul = "GET", body, h = {}) => ishApi(new Request("https://app/api/ish" + yol, { method: usul, headers: { "content-type": "application/json", "cf-connecting-ip": "9.9.9.9", ...h }, body: body ? JSON.stringify(body) : undefined }), env);
  C("сессиясиз — 401", (await R("/men")).status === 401);
  const yomon = await R("/kirish", "POST", { login: "sardor", parol: "notogri" });
  C("нотўғри парол — 401, cookie йўқ", yomon.status === 401 && !yomon.headers.get("set-cookie"));
  C("йўқ логин — ҳам 401 (бир хил жавоб)", (await R("/kirish", "POST", { login: "yoq", parol: "x" })).status === 401);
  const ok = await R("/kirish", "POST", { login: " Sardor ", parol: "Kuchli-Parol-1" });
  const ck = ok.headers.get("set-cookie") || "";
  C("тўғри логин — cookie: HttpOnly, Secure, SameSite=Strict", ok.status === 200 && /ish_s=[A-Za-z0-9_-]{40,}/.test(ck) && /HttpOnly/.test(ck) && /Secure/.test(ck) && /SameSite=Strict/.test(ck));
  const cookie = ck.split(";")[0];
  const s = { cookie, "x-ish-sayt": "1" };
  const m = await (await R("/men", "GET", undefined, s)).json();
  C("сайтда Сардор ака — owner", m.ok && m.rol === "owner" && m.admin);
  C("сайтда X-Ish-Rol ишламайди (ходимга тушмайди)", (await (await R("/men", "GET", undefined, { ...s, "x-ish-rol": "member" })).json()).rol === "owner");
  const B1 = (await (await R("/boards", "GET", undefined, s)).json()).boards[0].id;
  const yangi = await (await R(`/boards/${B1}/cards`, "POST", { nom: "Сайтдан", kimga: ALI, muddat: "2026-09-23" }, s)).json();
  C("сайтдан вазифа берилди — ходимга хабар кетди", yangi.ok && TG.some((x) => x.chat === ALI && /вазифа бириктирилди/.test(x.body.text)));
  C("CSRF: сарлавҳасиз ўзгартириш — 403", (await R(`/boards/${B1}/cards`, "POST", { nom: "x", kimga: ALI, muddat: "2026-09-23" }, { cookie })).status === 403);
  C("ходимнинг логини бўлса ҳам сайтга кира олмайди", (await R("/kirish", "POST", { login: "ali", parol: "ali-parol-12" })).status === 401);
  C("сохта cookie — 401", (await R("/men", "GET", undefined, { cookie: "ish_s=" + "A".repeat(48) })).status === 401);
  await R("/chiqish", "POST", {}, s);
  C("чиққандан кейин эски cookie ишламайди", (await R("/men", "GET", undefined, s)).status === 401);
  for (let i = 0; i < 5; i++) await R("/kirish", "POST", { login: "sardor", parol: "xato" + i });
  C("5 марта нотўғри — блок (тўғри парол ҳам 429)", (await R("/kirish", "POST", { login: "sardor", parol: "Kuchli-Parol-1" })).status === 429);
  VAQT += 16 * 60_000;
  C("15 дақиқадан кейин яна киради", (await R("/kirish", "POST", { login: "sardor", parol: "Kuchli-Parol-1" })).status === 200);
  const eskiCk = (await R("/kirish", "POST", { login: "sardor", parol: "Kuchli-Parol-1" })).headers.get("set-cookie").split(";")[0];
  VAQT += 31 * 86400_000;
  C("30 кундан кейин сессия тугайди", (await R("/men", "GET", undefined, { cookie: eskiCk })).status === 401);
  const row = await env.DB.prepare("SELECT hash FROM ish_kirish WHERE login = 'sardor'").first();
  C("паролнинг ўзи базада сақланмайди", !String(row.hash).includes("Kuchli") && row.hash.length === 64);
}

/* ═══════════ 👥 Ходимлар ва «Бугун» панеллари, такрорланувчи вазифа, парол ═══════════ */
console.log("\n👥 Ходимлар · 📅 Бугун · 🔁 Такрор · 🔑 Парол");
{
  const env = yangiEnv(true); TG = [];
  const S = (uid, yol, usul = "GET", body, opt) => sora(env, uid, yol, usul, body, opt);
  await S(SARDOR, "/men"); await S(ALI, "/men"); await S(VALI, "/men");
  const B1 = (await S(SARDOR, "/boards")).boards[0].id;
  const bd = await S(SARDOR, `/boards/${B1}`);
  const [LY, , LB] = bd.lists.map((l) => l.id);
  const KUN = (n) => new Date(Date.now() + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
  const K = (o) => S(SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Иш", kimga: ALI, muddat: KUN(0), ...o });

  // кеча муддатли (кечиккан), бугунги ва эртанги
  const kech = await K({ nom: "Кечиккан иш", muddat: KUN(0) });
  await env.DB.prepare("UPDATE ish_card SET muddat = ? WHERE id = ?").bind(KUN(-5), kech.card.id).run();
  const bugunIsh = await K({ nom: "Бугунги иш", muddat: KUN(0) });
  const ertaga = await K({ nom: "Эртанги иш", kimga: VALI, muddat: KUN(1) });
  await K({ nom: "Кейинги ҳафта", kimga: VALI, muddat: KUN(8) });

  /* ─── /bugun ─── */
  const bg = await S(SARDOR, "/bugun");
  C("«Бугун»: кечиккан · бугун · эртага алоҳида", bg.ok && bg.kech.length === 1 && bg.shu.length === 1 && bg.ertaga.length === 1);
  C("«Бугун»да узоқ муддатли вазифа йўқ", !JSON.stringify(bg).includes("Кейинги ҳафта"));
  const bgAli = await S(ALI, "/bugun");
  C("ходим «Бугун»да фақат ўзиникини кўради", bgAli.ok && bgAli.kech.concat(bgAli.shu, bgAli.ertaga).every((c) => c.kimga === ALI));

  /* ─── /xodimlar ─── */
  const xo = await S(SARDOR, "/xodimlar");
  const ali = (xo.xodimlar || []).find((x) => x.id === ALI);
  C("«Ходимлар»: очиқ ва кечиккан сони тўғри", xo.ok && ali && ali.ochiq === 2 && ali.kech === 1 && ali.bugun === 1);
  C("«Ходимлар» кечикканлар бўйича тартибланади", xo.xodimlar[0].id === ALI);
  C("ходим «Ходимлар»ни кўролмайди", (await S(ALI, "/xodimlar")).status === 403);
  await S(ALI, `/cards/${bugunIsh.card.id}/kochir`, "POST", { list_id: LB, matn: "тайёр" }, { fayllar: rasm(1) });
  const xo2 = await S(SARDOR, "/xodimlar");
  C("бажарилгани «бажарди» устунига ўтди", xo2.xodimlar.find((x) => x.id === ALI).bajardi === 1);
  await S(SARDOR, `/cards/${kech.card.id}/jarima`, "POST", { summa: 40000 });
  C("жарима «Ходимлар»да кўринади", (await S(SARDOR, "/xodimlar")).xodimlar.find((x) => x.id === ALI).jarima === 40000);

  /* ─── қидирувда архив ─── */
  await S(SARDOR, `/cards/${ertaga.card.id}/arxiv`, "POST", {});
  C("оддий рўйхатда архивдаги йўқ", !JSON.stringify(await S(SARDOR, "/royxat")).includes("Эртанги иш"));
  C("қидирув (hammasi=1) архивдагини ҳам топади", JSON.stringify(await S(SARDOR, "/royxat?hammasi=1")).includes("Эртанги иш"));
  C("ходимга hammasi=1 таъсир қилмайди", (await S(ALI, "/royxat?hammasi=1")).cards.every((c) => c.kimga === ALI));

  /* ─── такрорланувчи вазифа ─── */
  C("ходим такрор яратолмайди", (await S(ALI, "/takror", "POST", { nom: "х", kimga: ALI, davr: "kun" })).status === 403);
  C("нотўғри давр рад этилади", (await S(SARDOR, "/takror", "POST", { nom: "Кассани санаш", kimga: ALI, davr: "yil" })).status === 422);
  const tk = await S(SARDOR, "/takror", "POST", { nom: "Кассани санаш", tavsif: "Ҳар куни", kimga: ALI, davr: "kun", board_id: B1 });
  C("такрорланувчи вазифа яратилди", tk.ok && tk.id > 0);
  const ro = await S(SARDOR, "/takror");
  C("рўйхатда кўринади — ким, қачон", ro.ok && ro.takror[0].nom === "Кассани санаш" && ro.takror[0].kimgaIsm && ro.takror[0].davr === "kun");
  TG = [];
  const n1 = (await ishTakror(env)).ok;
  C("крон: кунлик вазифа яратилди ва хабар кетди", n1 === 1 && TG.some((x) => x.chat === ALI));
  C("ўша куни иккинчи марта яратмайди", (await ishTakror(env)).ok === 0);
  C("янги вазифа доскада пайдо бўлди", JSON.stringify(await S(SARDOR, `/boards/${B1}`)).includes("Кассани санаш"));
  kunOt(1);
  C("эртаси куни яна яратилади", (await ishTakror(env)).ok === 1);
  await S(SARDOR, `/takror/${tk.id}`, "PATCH", { faol: false });
  kunOt(1);
  C("ўчирилган такрор яратмайди", (await ishTakror(env)).ok === 0);
  // ҳафталик: фақат ўз кунида
  const bugunKun = ((new Date(Date.parse(bugun() + "T00:00:00Z")).getUTCDay() + 6) % 7) + 1;
  const haft = await S(SARDOR, "/takror", "POST", { nom: "Ҳафталик санаш", kimga: ALI, davr: "hafta", kuni: (bugunKun % 7) + 1 });
  C("ҳафталик: бошқа кунда яратилмайди", (await ishTakror(env)).ok === 0 && haft.ok);
  await S(SARDOR, `/takror/${haft.id}`, "DELETE");
  C("такрор ўчирилди", (await S(SARDOR, "/takror")).takror.every((t) => t.nom !== "Ҳафталик санаш"));

  /* ─── қисқа билдиришнома ─── */
  const bil = (await S(ALI, "/bildir")).bildir || [];
  C("билдиришнома қисқа (160 белгидан кам, қатор ташлашсиз)", bil.length > 0 && bil.every((b) => b.matn.length <= 160 && !b.matn.includes("\n")));
  C("қисқа матнда вазифа номи бор", bil.some((b) => /Янги вазифа: /.test(b.matn)));
}

/* ═══════════ 🧹 Архивни автомат тозалаш (30 кундан кейин) ═══════════ */
console.log("\n🧹 Архивни автомат тозалаш");
{
  const env = yangiEnv(true); TG = [];
  const S = (uid, yol, usul = "GET", body) => sora(env, uid, yol, usul, body);
  await S(SARDOR, "/men"); await S(ALI, "/men");
  const B1 = (await S(SARDOR, "/boards")).boards[0].id;
  const KUN = (n) => new Date(Date.now() + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
  const K = (nom) => S(SARDOR, `/boards/${B1}/cards`, "POST", { nom, kimga: ALI, muddat: KUN(2) });

  const eski = await K("Эски архив");
  const yangiA = await K("Янги архив");
  const ochiqV = await K("Архивда эмас");
  await S(SARDOR, `/cards/${eski.card.id}/arxiv`, "POST", {});
  await S(SARDOR, `/cards/${yangiA.card.id}/arxiv`, "POST", {});
  // эскисини 31 кун олдинга суриб қўямиз
  const otgan = new Date(Date.now() - 31 * 86400_000).toISOString();
  await env.DB.prepare("UPDATE ish_card SET arxiv = ? WHERE id = ?").bind(otgan, eski.card.id).run();

  const t = await ishTozala(env);
  C("30 кундан эски архив ўчирилди", t.ok === 1);
  C("янги архивдаги қолди", (await S(SARDOR, `/cards/${yangiA.card.id}`)).ok);
  C("архивда бўлмагани тегилмади", (await S(SARDOR, `/cards/${ochiqV.card.id}`)).ok);
  C("ўчирилгани энди очилмайди", (await S(SARDOR, `/cards/${eski.card.id}`)).status === 404);
  C("ўчирилгани архив рўйхатида ҳам йўқ", !JSON.stringify(await S(SARDOR, "/qidir?holat=arxiv")).includes("Эски архив"));
  C("иккинчи марта ишлаганда ўчирадигани қолмади", (await ishTozala(env)).ok === 0);
}

/* ═══════════ 👥 Икки бажарувчи (битта вазифа — икки кишига) ═══════════ */
console.log("\n👥 Бир нечта бажарувчи");
{
  const env = yangiEnv(true); TG = [];
  const S = (uid, yol, usul = "GET", body) => sora(env, uid, yol, usul, body);
  await S(SARDOR, "/men"); await S(ALI, "/men"); await S(VALI, "/men");
  const B1 = (await S(SARDOR, "/boards")).boards[0].id;
  const KUN = (n) => new Date(Date.now() + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
  const K = (nom, o) => S(SARDOR, `/boards/${B1}/cards`, "POST", { nom, kimga: ALI, muddat: KUN(2), ...o });

  const v = (await K("Иккови бажаради", { ijrochilar: [VALI] })).card;
  C("иккаласи ҳам ўз исми билан мурожаат олди", [ALI, VALI].every((u) => TG.some((x) => x.chat === u && /^<b>/.test(x.body.text || ""))));
  C("икки бажарувчи сақланди", v.kimga === ALI && v.ijro.length === 2 && v.ijro[1].id === VALI && v.ijro[1].ism.length > 0);
  C("иккаласига ҳам хабар кетди", TG.filter((x) => x.usul === "sendMessage" && (x.chat === ALI || x.chat === VALI)).length === 2);

  C("биринчи ходим кўради", JSON.stringify(await S(ALI, "/meniki")).includes("Иккови бажаради"));
  C("иккинчи ходим ҳам кўради", JSON.stringify(await S(VALI, "/meniki")).includes("Иккови бажаради"));
  C("бегона ходим кўрмайди", !JSON.stringify(await S(BEGONA, "/meniki")).includes("Иккови бажаради"));
  C("иккинчи ходим карточкани очади", (await S(VALI, `/cards/${v.id}`)).ok);

  const yolgiz = (await K("Ёлғиз")).card;
  C("қўшимча бажарувчи ихтиёрий", yolgiz.ijro.length === 1);
  C("битта ходим икки марта танланмайди", (await K("Хато", { ijrochilar: [ALI] })).status === 422);

  // кейинроқ қўшиш ва олиб ташлаш
  const q = await S(SARDOR, `/cards/${yolgiz.id}`, "PATCH", { ijrochilar: [ALI, VALI], ver: yolgiz.ver });
  C("кейинроқ яна бир бажарувчи қўшилди", q.ok && q.card.ijro.length === 2 && q.card.ijro[1].id === VALI);
  C("қўшилганда хабар кетди", TG.some((x) => x.chat === VALI && x.usul === "sendMessage" && /Ёлғиз/.test(x.body.text)));
  const o = await S(SARDOR, `/cards/${yolgiz.id}`, "PATCH", { ijrochilar: [ALI], ver: q.card.ver });
  C("иккинчи бажарувчи олиб ташланди", o.ok && o.card.ijro.length === 1);
  C("олиб ташлангач кўрмайди", !JSON.stringify(await S(VALI, "/meniki")).includes("Ёлғиз"));

  // ҳисоботда иккаласи ҳам
  const oy = KUN(2).slice(0, 7);
  const x = await S(SARDOR, `/xodimlar?oy=${oy}`);
  C("Ходимлар бўлимида иккаласида ҳам ҳисобланди",
    (x.xodimlar.find((z) => z.id === ALI) || {}).ochiq >= 1 && (x.xodimlar.find((z) => z.id === VALI) || {}).ochiq >= 1);

  await S(SARDOR, `/cards/${v.id}/jarima`, "POST", { summa: 30000 });
  const h = await S(SARDOR, `/jarima?oy=${oy}`);
  C("жарима иккала ходим рўйхатида", h.xodimlar.length === 2 && h.xodimlar.every((z) => z.summa === 30000));
  C("жами жарима икки марта саналмади", h.jami === 30000);

  // учинчи бажарувчи
  const u3 = (await K("Учови бажаради", { ijrochilar: [VALI, MUROD] })).card;
  C("учта бажарувчи сақланди", u3.ijro.map((z) => z.id).join(",") === [ALI, VALI, MUROD].join(","));
  C("ijro рўйхатида исмлар бор", u3.ijro.every((z) => z.ism && z.ism !== "?"));
  C("учинчи ҳам кўради", JSON.stringify(await S(MUROD, "/royxat")).includes("Учови бажаради"));
  C("такрорланган ходим рад этилади", (await K("Хато3", { ijrochilar: [VALI, VALI] })).status === 422);

  // чекланмаган: 5 та ходим
  const besh = [VALI, MUROD, DOSTON, SARDOR];
  const b5 = (await K("Бешови бажаради", { ijrochilar: besh })).card;
  C("5 та бажарувчи сақланди", b5.ijro.length === 5);
  C("ҳамма бажарувчига хабар кетди", besh.concat([ALI]).every((u) => TG.some((x) => x.chat === u && x.usul === "sendMessage" && /Бешови бажаради/.test(x.body.text)) || u === SARDOR));

  const p3 = await S(SARDOR, `/cards/${u3.id}`, "PATCH", { ijrochilar: [ALI], ver: u3.ver });
  C("қўшимча бажарувчилар олиб ташланди", p3.ok && p3.card.ijro.length === 1);
  C("бўш рўйхат рад этилади", (await S(SARDOR, `/cards/${u3.id}`, "PATCH", { ijrochilar: [], ver: p3.card.ver })).status === 422);
}

/* ═══════════ 📑 Нусха олиш ═══════════ */
console.log("\n📑 Нусха олиш");
{
  const env = yangiEnv(true); TG = [];
  const S = (uid, yol, usul = "GET", body, fl) => sora(env, uid, yol, usul, body, fl);
  await S(SARDOR, "/men"); await S(ALI, "/men"); await S(VALI, "/men");
  const B1 = (await S(SARDOR, "/boards")).boards[0].id;
  const KUN = (n) => new Date(VAQT + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
  const a = await S(SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Ҳар ҳафта касса", tavsif: "Жума куни", kimga: ALI, ijrochilar: [VALI], muddat: KUN(2), muhim: "high" });
  await S(SARDOR, `/cards/${a.card.id}/jarima`, "POST", { summa: 30000 });
  TG = [];
  const n = await S(SARDOR, `/cards/${a.card.id}/nusxa`, "POST", { muddat: KUN(9) });
  C("нусха яратилди", n.ok && n.card.id !== a.card.id);
  C("ном, тавсиф, зарурлик кўчирилди", n.card.nom === "Ҳар ҳафта касса" && n.card.muhim === "high");
  C("бажарувчилар кўчирилди", n.card.ijro.map((x) => x.id).join(",") === [ALI, VALI].join(","));
  C("янги муддат қўйилди", n.card.muddat === KUN(9));
  C("жарима кўчирилмади", n.card.jarima === 0 && n.card.bonus === 0);
  C("«Янги» устунида турибди", !n.card.bajarildi);
  C("иккала ходимга хабар кетди", [ALI, VALI].every((u) => TG.some((x) => x.chat === u && /вазифа бириктирилди/.test(x.body.text || ""))));
  C("ўтган санага нусха олинмайди", (await S(SARDOR, `/cards/${a.card.id}/nusxa`, "POST", { muddat: KUN(-3) })).status === 422);
  C("ходим нусха ола олмайди", (await S(ALI, `/cards/${a.card.id}/nusxa`, "POST", { muddat: KUN(9) })).status === 403);
  C("асл вазифа ўзгармади", (await S(SARDOR, `/cards/${a.card.id}`)).card.jarima === 30000);
}

/* ═══════════ 📊 Excel ҳисобот (жарима ва бонус) ═══════════ */
console.log("\n📊 Excel ҳисобот");
{
  const env = yangiEnv(true); TG = [];
  const S = (uid, yol, usul = "GET", body, fl) => sora(env, uid, yol, usul, body, fl);
  await S(SARDOR, "/men"); await S(ALI, "/men"); await S(VALI, "/men");
  const B1 = (await S(SARDOR, "/boards")).boards[0].id;
  const KUN = (n) => new Date(VAQT + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
  const oy = KUN(2).slice(0, 7);

  const a = await S(SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Кассани санаш", kimga: ALI, muddat: KUN(2) });
  const b = await S(SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Омборни тозалаш", kimga: VALI, muddat: KUN(2) });
  await S(SARDOR, `/cards/${a.card.id}/jarima`, "POST", { summa: 40000 });
  await S(SARDOR, `/cards/${b.card.id}/bonus`, "POST", { summa: 60000 });

  // файл тушадими
  const init = "tma " + await initDataYasa({ id: SARDOR, first_name: "Сардор ака" }, TOKEN);
  const r = await ishApi(new Request(`https://x/api/ish/hisobot.xlsx?oy=${oy}`, { headers: { authorization: init } }), env);
  C("файл қайтди (200)", r.status === 200, String(r.status));
  C("тури .xlsx", /spreadsheetml/.test(r.headers.get("content-type") || ""));
  C("юклаб олинадиган файл номи билан", /attachment; filename\*=UTF-8/.test(r.headers.get("content-disposition") || ""));
  const buf = new Uint8Array(await r.arrayBuffer());
  C("ҳақиқий zip (xlsx) — PK сарлавҳаси", buf[0] === 0x50 && buf[1] === 0x4b && buf.length > 2000, "байт: " + buf.length);

  // ичида маълумот борми (zip'ни очмасдан — матн бўлаклари sharedStrings'да)
  C("ходим бўлмаса ҳам хато бермайди", (await ishApi(new Request(`https://x/api/ish/hisobot.xlsx?oy=2020-01`, { headers: { authorization: init } }), env)).status === 200);
  C("нотўғри ой — 422", (await ishApi(new Request("https://x/api/ish/hisobot.xlsx?oy=xato", { headers: { authorization: init } }), env)).status === 422);

  const aliInit = "tma " + await initDataYasa({ id: ALI, first_name: "Али" }, TOKEN);
  C("ходим ҳисоботни ола олмайди", (await ishApi(new Request(`https://x/api/ish/hisobot.xlsx?oy=${oy}`, { headers: { authorization: aliInit, "x-ish-rol": "member" } }), env)).status === 403);

  // /jarima эски жавоби бузилмаганми
  const j = await S(SARDOR, `/jarima?oy=${oy}`);
  C("/jarima аввалгидек ишлайди", j.ok && j.jami === 40000 && j.bonusJami === 60000 && j.cards.length === 1 && j.bonusCards.length === 1);
}

/* ═══════════ 📅 Тарих: сана бўйича бажарилган вазифалар ═══════════ */
console.log("\n📅 Тарих");
{
  const env = yangiEnv(true); TG = [];
  const S = (uid, yol, usul = "GET", body, fl) => sora(env, uid, yol, usul, body, fl);
  await S(SARDOR, "/men"); await S(ALI, "/men"); await S(VALI, "/men");
  const B1 = (await S(SARDOR, "/boards")).boards[0].id;
  const d0 = await S(SARDOR, `/boards/${B1}`);
  const [LY, LJ, LB] = d0.lists.map((l) => l.id);
  const KUN = (n) => new Date(VAQT + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
  const bugunS = KUN(0);

  // бугун иккита вазифа бажарилади
  const a1 = await S(SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Кассани санаш", kimga: ALI, muddat: KUN(2) });
  const a2 = await S(SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Омборни тозалаш", kimga: ALI, muddat: KUN(2) });
  const b1 = await S(SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Бегона иш", kimga: VALI, muddat: KUN(2) });
  for (const c of [a1, a2, b1]) {
    const u = c === b1 ? VALI : ALI;
    await S(u, `/cards/${c.card.id}/kochir`, "POST", { list_id: LJ });
    await S(u, `/cards/${c.card.id}/kochir`, "POST", { list_id: LB, matn: "тайёр" }, { fayllar: rasm(1) });
  }
  await S(SARDOR, `/cards/${a1.card.id}/bonus`, "POST", { summa: 50000 });
  await S(SARDOR, `/cards/${a2.card.id}/jarima`, "POST", { summa: 20000 });

  const t = await S(ALI, `/tarix?sana=${bugunS}`);
  C("ходим ўз тарихини кўради", t.ok && t.cards.length === 2);
  C("бегонанинг иши тарихда йўқ", !JSON.stringify(t).includes("Бегона иш"));
  C("жами: сони, бонус, жарима", t.jami.soni === 2 && t.jami.bonus === 50000 && t.jami.jarima === 20000);
  C("ҳар бир вазифада бонус/жарима кўринади", t.cards.some((x) => x.bonus === 50000) && t.cards.some((x) => x.jarima === 20000));
  C("расм сони ҳам келади", t.cards.every((x) => x.soni && x.soni.fayl === 1));

  C("бошқа кунда бўш", (await S(ALI, `/tarix?sana=${KUN(-5)}`)).cards.length === 0);
  C("нотўғри сана рад этилади", (await S(ALI, "/tarix?sana=xato")).status === 422);
  C("раҳбар ҳаммасини кўради", (await S(SARDOR, `/tarix?sana=${bugunS}`)).cards.length === 3);
  C("раҳбар битта ходим бўйича филтрлайди", (await S(SARDOR, `/tarix?sana=${bugunS}&kimga=${VALI}`)).cards.length === 1);

  // бажарилган вазифа автомат тозалашда ЎЧМАЙДИ
  await S(SARDOR, `/cards/${a1.card.id}/arxiv`, "POST", {});
  await env.DB.prepare("UPDATE ish_card SET arxiv = ? WHERE id = ?").bind(new Date(Date.now() - 40 * 86400_000).toISOString(), a1.card.id).run();
  await ishTozala(env);
  C("бажарилган вазифа 40 кундан кейин ҳам тарихда қолади", (await S(ALI, `/tarix?sana=${bugunS}`)).cards.length === 2);

  // бажарилмай архивга олингани эса тозаланади
  const bekor = await S(SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Бекор қилинган", kimga: ALI, muddat: KUN(2) });
  await S(SARDOR, `/cards/${bekor.card.id}/arxiv`, "POST", {});
  await env.DB.prepare("UPDATE ish_card SET arxiv = ? WHERE id = ?").bind(new Date(Date.now() - 40 * 86400_000).toISOString(), bekor.card.id).run();
  C("бажарилмай архивга олингани тозаланади", (await ishTozala(env)).ok === 1);
}

/* ═══════════ 🎁 Бонус (ўз вақтида бажарганга) ═══════════ */
console.log("\n🎁 Бонус");
{
  const env = yangiEnv(true); TG = [];
  const S = (uid, yol, usul = "GET", body) => sora(env, uid, yol, usul, body);
  await S(SARDOR, "/men"); await S(MUROD, "/men"); await S(ALI, "/men");
  const B1 = (await S(SARDOR, "/boards")).boards[0].id;
  const KUN = (n) => new Date(Date.now() + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
  const K = (nom, o) => S(SARDOR, `/boards/${B1}/cards`, "POST", { nom, kimga: ALI, muddat: KUN(2), ...o });

  const v = (await K("Бонусли иш")).card;
  C("янги вазифада бонус 0", v.bonus === 0);

  const b1 = await S(SARDOR, `/cards/${v.id}/bonus`, "POST", { summa: 150000 });
  C("Сардор ака бонус ёзди", b1.ok && b1.card.bonus === 150000);
  C("бонус карта маълумотида кўринади", (await S(SARDOR, `/cards/${v.id}`)).card.bonus === 150000);

  const b2 = await S(MUROD, `/cards/${v.id}/bonus`, "POST", { summa: 200000 });
  C("Мурод ака ҳам бонус ёза олади", b2.ok && b2.card.bonus === 200000);

  C("ходим бонус ёзолмайди", (await S(ALI, `/cards/${v.id}/bonus`, "POST", { summa: 1000 })).status === 403);
  C("манфий бонус қабул қилинмайди", (await S(SARDOR, `/cards/${v.id}/bonus`, "POST", { summa: -5 })).status === 422);
  C("каср бонус қабул қилинмайди", (await S(SARDOR, `/cards/${v.id}/bonus`, "POST", { summa: 10.5 })).status === 422);

  // ҳисоботда
  const oy = KUN(2).slice(0, 7);
  const h = await S(SARDOR, `/jarima?oy=${oy}`);
  C("ҳисоботда бонус жами", h.ok && h.bonusJami === 200000);
  C("ҳисоботда бонусли вазифа", h.bonusCards.length === 1 && h.bonusCards[0].bonus === 200000);
  C("бонус олган ходим рўйхати", h.bonusXodimlar.length === 1 && h.bonusXodimlar[0].id === ALI);

  // ходимлар бўлимида
  const x = await S(SARDOR, `/xodimlar?oy=${oy}`);
  const ali = x.xodimlar.find((z) => z.id === ALI);
  C("Ходимлар бўлимида бонус кўринади", !!ali && ali.bonus === 200000);

  // олиб ташлаш
  const b0 = await S(SARDOR, `/cards/${v.id}/bonus`, "POST", { summa: 0 });
  C("бонус олиб ташланди", b0.ok && b0.card.bonus === 0);
  C("олиб ташлангач ҳисоботда йўқ", (await S(SARDOR, `/jarima?oy=${oy}`)).bonusCards.length === 0);

  // жарима ва бонус бир вақтда
  await S(SARDOR, `/cards/${v.id}/jarima`, "POST", { summa: 20000 });
  await S(SARDOR, `/cards/${v.id}/bonus`, "POST", { summa: 50000 });
  const ikki = (await S(SARDOR, `/cards/${v.id}`)).card;
  C("жарима ва бонус бир-бирига халақит бермайди", ikki.jarima === 20000 && ikki.bonus === 50000);
}

/* ═══════════ 📌 Зарурлик (муҳимлик) ва бошланиш санаси ═══════════ */
console.log("\n📌 Зарурлик ва бошланиш санаси");
{
  const env = yangiEnv(true); TG = [];
  const S = (uid, yol, usul = "GET", body) => sora(env, uid, yol, usul, body);
  await S(SARDOR, "/men"); await S(ALI, "/men");
  const B1 = (await S(SARDOR, "/boards")).boards[0].id;
  const KUN = (n) => new Date(Date.now() + 5 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
  const K = (o) => S(SARDOR, `/boards/${B1}/cards`, "POST", { nom: "Иш", kimga: ALI, muddat: KUN(3), ...o });

  const v1 = await K({ nom: "Шошилинч иш", muhim: "urgent", boshlanish: KUN(1) });
  C("зарурлик ва бошланиш санаси сақланди", v1.ok && v1.card.muhim === "urgent" && v1.card.boshlanish === KUN(1));
  C("зарурлик кўрсатилмаса — «оддий»", (await K({ nom: "Оддий иш" })).card.muhim === "medium");
  C("нотўғри зарурлик «оддий»га тушади", (await K({ nom: "Хато зарурлик", muhim: "juda-muhim" })).card.muhim === "medium");
  C("бошланиш муддатдан кейин бўлса — рад", (await K({ nom: "Кечки бошланиш", boshlanish: KUN(5) })).status === 422);
  C("бошланиш нотўғри сана — рад", (await K({ nom: "Нотўғри сана", boshlanish: "кеча" })).status === 422);
  C("бошланишсиз ҳам яратилади", (await K({ nom: "Бошланишсиз" })).card.boshlanish === "");

  const v2 = await S(SARDOR, `/cards/${v1.card.id}`);
  C("зарурликни кейин ўзгартириш", (await S(SARDOR, `/cards/${v1.card.id}`, "PATCH", { muhim: "low", ver: v2.card.ver })).ok);
  const v3 = await S(SARDOR, `/cards/${v1.card.id}`);
  C("ўзгарган зарурлик сақланди", v3.card.muhim === "low");
  C("бошланишни олиб ташлаш мумкин",
    (await S(SARDOR, `/cards/${v1.card.id}`, "PATCH", { boshlanish: "", ver: v3.card.ver })).ok
    && (await S(SARDOR, `/cards/${v1.card.id}`)).card.boshlanish === "");
  C("ходим зарурликни ўзгартиролмайди", (await S(ALI, `/cards/${v1.card.id}`, "PATCH", { muhim: "urgent" })).status === 403);

  const sh = await K({ nom: "Яна шошилинч", muhim: "urgent" });
  const f = await S(SARDOR, `/boards/${B1}?muhim=urgent`);
  C("зарурлик бўйича фильтр", f.ok && f.cards.length === 1 && f.cards[0].id === sh.card.id);
  C("фаолликда зарурлик ўзгариши ёзилди", JSON.stringify(await S(SARDOR, `/cards/${v1.card.id}/faol`)).includes("card.muhim"));
}

/* ═══════════ 🔑 Паролни алмаштириш ═══════════ */
console.log("\n🔑 Паролни сайтдан алмаштириш");
{
  const env = yangiEnv(true); TG = [];
  await sora(env, SARDOR, "/men");
  const { parolHash } = await import("../src/ish/sayt.js");
  const tuz = "cd".repeat(16);
  await env.DB.prepare("INSERT INTO ish_kirish (login, uid, hash, tuz, takror, yangilandi) VALUES ('sardor', ?, ?, ?, 1000, 'x')")
    .bind(SARDOR, await parolHash("Eski-Parol-1", tuz, 1000), tuz).run();
  const R = (yol, usul = "GET", body, h = {}) => ishApi(new Request("https://x/api/ish" + yol, {
    method: usul, headers: { "content-type": "application/json", ...h }, body: body ? JSON.stringify(body) : undefined }), env);
  const kir = await R("/kirish", "POST", { login: "sardor", parol: "Eski-Parol-1" });
  const cookie = (kir.headers.get("set-cookie") || "").split(";")[0];
  const s = { cookie, "x-ish-sayt": "1" };
  C("эски парол нотўғри бўлса — рад", (await R("/parol", "POST", { eski: "boshqa", yangi: "Yangi-Parol-9" }, s)).status === 422);
  C("қисқа парол — рад", (await R("/parol", "POST", { eski: "Eski-Parol-1", yangi: "qisqa" }, s)).status === 422);
  C("эскиси билан бир хил — рад", (await R("/parol", "POST", { eski: "Eski-Parol-1", yangi: "Eski-Parol-1" }, s)).status === 422);
  C("парол алмашди", (await R("/parol", "POST", { eski: "Eski-Parol-1", yangi: "Yangi-Parol-9" }, s)).status === 200);
  C("эски парол энди ишламайди", (await R("/kirish", "POST", { login: "sardor", parol: "Eski-Parol-1" })).status === 401);
  C("янги парол билан кирилади", (await R("/kirish", "POST", { login: "sardor", parol: "Yangi-Parol-9" })).status === 200);
  const row = await env.DB.prepare("SELECT hash, tuz FROM ish_kirish WHERE login = 'sardor'").first();
  C("янги паролда туз ҳам алмашди", row.tuz !== tuz && !String(row.hash).includes("Yangi"));
  C("Mini App'дан парол алмаштириб бўлмайди", (await sora(env, SARDOR, "/parol", "POST", { eski: "Yangi-Parol-9", yangi: "Boshqa-Parol-7" })).status === 403);
}

console.log(`\n═══ ${ok}/${jami} ═══`);
process.exit(ok === jami ? 0 : 1);
