// src/app/ish/sayt.js — 🖥 веб-сайтга кириш (Сардор ака ва Мурод ака): логин/парол → сессия cookie.
//   POST /api/ish/kirish  { login, parol }  → Set-Cookie: ish_s=… (HttpOnly, Secure, SameSite=Strict)
//   POST /api/ish/chiqish                    → сессия ўчади
// Парол: PBKDF2-SHA256, ҳар логинга алоҳида туз. Cookie'нинг ўзи базада эмас — фақат SHA-256 си.
// Кўп нотўғри уриниш: логин бўйича 5 та / IP бўйича 20 та — 15 дақиқа блок.
// Паролни ўрнатиш: node tools/sayt-parol.mjs <login> <telegram_id>  (Достон ўз компьютерида)
export const COOKIE = "ish_s";
export const TAKROR = 20000;                      // Workers CPU чегараси учун; базада ҳар логинда ёзилади
const SESSIYA_KUN = 30;
const OYNA_MS = 15 * 60_000, MAX_LOGIN = 5, MAX_IP = 20;

const enc = new TextEncoder();
const hex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const hexdan = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
const JSONH = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const javob = (d, s = 200, extra = {}) => new Response(JSON.stringify(d), { status: s, headers: { ...JSONH, ...extra } });

export async function parolHash(parol, tuzHex, takror = TAKROR) {
  const kalit = await crypto.subtle.importKey("raw", enc.encode(String(parol)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hexdan(tuzHex), iterations: takror }, kalit, 256);
  return hex(bits);
}
const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
function tengmi(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cookieOl(request, nom) {
  const c = request.headers.get("cookie") || "";
  for (const q of c.split(/;\s*/)) { const i = q.indexOf("="); if (i > 0 && q.slice(0, i) === nom) return decodeURIComponent(q.slice(i + 1)); }
  return "";
}
const hozir = () => new Date(Date.now()).toISOString();

/** Cookie бўйича сессия → { uid } ёки null */
export async function sessiyaOl(env, request) {
  const token = cookieOl(request, COOKIE);
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const s = await env.DB.prepare("SELECT uid, muddat FROM ish_sessiya WHERE token_hash = ?").bind(await sha256(token)).first();
  if (!s || s.muddat < hozir()) return null;
  return { uid: Number(s.uid) };
}

async function urinishOl(env, kalit) {
  const r = await env.DB.prepare("SELECT soni, bosh FROM ish_urinish WHERE kalit = ?").bind(kalit).first();
  if (!r || Date.parse(r.bosh) + OYNA_MS < Date.now()) return 0;
  return Number(r.soni);
}
async function urinishQosh(env, kalit) {
  const r = await env.DB.prepare("SELECT soni, bosh FROM ish_urinish WHERE kalit = ?").bind(kalit).first();
  if (!r || Date.parse(r.bosh) + OYNA_MS < Date.now()) await env.DB.prepare("INSERT OR REPLACE INTO ish_urinish (kalit, soni, bosh) VALUES (?, 1, ?)").bind(kalit, hozir()).run();
  else await env.DB.prepare("UPDATE ish_urinish SET soni = soni + 1 WHERE kalit = ?").bind(kalit).run();
}

/**
 * /kirish ва /chiqish — kontekst'дан ОЛДИН (ҳали сессия йўқ). Бошқа йўл бўлса — null.
 * @param {(uid:number) => Promise<boolean>} rahbarmi — шу одам раҳбар (owner/admin) эканини текширади
 */
/** Паролни алмаштириш: эски парол тўғри бўлса — янгисини PBKDF2 билан ёзади */
export async function parolAlmash(env, uid, eski, yangi) {
  const u = await env.DB.prepare("SELECT * FROM ish_kirish WHERE uid = ?").bind(uid).first();
  if (!u) return { ok: false, xato: "Логин топилмади" };
  const h = await parolHash(String(eski || ""), u.tuz, Number(u.takror) || TAKROR);
  if (h !== u.hash) return { ok: false, xato: "Эски парол нотўғри" };
  const y = String(yangi || "");
  if (y.length < 8) return { ok: false, xato: "Янги парол камида 8 белги бўлсин" };
  if (y === String(eski || "")) return { ok: false, xato: "Янги парол эскисидан фарқ қилсин" };
  const tuz = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const yh = await parolHash(y, tuz, TAKROR);
  await env.DB.prepare("UPDATE ish_kirish SET hash = ?, tuz = ?, takror = ?, yangilandi = ? WHERE login = ?")
    .bind(yh, tuz, TAKROR, new Date(Date.now()).toISOString(), u.login).run();
  return { ok: true };
}

export async function saytYol(request, env, yol, rahbarmi) {
  const usul = request.method.toUpperCase();
  if (yol === "/chiqish" && usul === "POST") {
    const token = cookieOl(request, COOKIE);
    if (token) await env.DB.prepare("DELETE FROM ish_sessiya WHERE token_hash = ?").bind(await sha256(token)).run();
    return javob({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  }
  if (yol !== "/kirish" || usul !== "POST") return null;
  if (!env.DB) return javob({ ok: false, xato: "База уланмаган" }, 500);
  let f = {};
  try { f = await request.json(); } catch { f = {}; }
  const login = String(f.login || "").trim().toLowerCase().slice(0, 40);
  const parol = String(f.parol || "");
  if (!login || !parol || parol.length > 200) return javob({ ok: false, xato: "Логин ва паролни киритинг" }, 422);
  const ip = request.headers.get("cf-connecting-ip") || "?";
  const kL = "login:" + login, kI = "ip:" + ip;
  if ((await urinishOl(env, kL)) >= MAX_LOGIN || (await urinishOl(env, kI)) >= MAX_IP) {
    return javob({ ok: false, xato: "Кўп марта нотўғри киритилди. 15 дақиқадан кейин уриниб кўринг" }, 429);
  }
  const u = await env.DB.prepare("SELECT uid, hash, tuz, takror FROM ish_kirish WHERE login = ?").bind(login).first();
  // Логин йўқ бўлса ҳам ҳисоб бажарилади — жавоб вақтидан логин борлигини билиб бўлмасин
  const h = await parolHash(parol, u ? u.tuz : "00".repeat(16), u ? Number(u.takror) : TAKROR);
  if (!u || !tengmi(h, u.hash) || !(await rahbarmi(Number(u.uid)))) {
    await urinishQosh(env, kL); await urinishQosh(env, kI);
    return javob({ ok: false, xato: "Логин ёки парол нотўғри" }, 401);
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ish_urinish WHERE kalit = ?").bind(kL),
    env.DB.prepare("DELETE FROM ish_sessiya WHERE muddat < ?").bind(hozir()),
  ]);
  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(36)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const muddat = new Date(Date.now() + SESSIYA_KUN * 86400_000).toISOString();
  await env.DB.prepare("INSERT INTO ish_sessiya (token_hash, uid, muddat, vaqt) VALUES (?, ?, ?, ?)").bind(await sha256(token), Number(u.uid), muddat, hozir()).run();
  return javob({ ok: true }, 200, { "set-cookie": `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSIYA_KUN * 86400}` });
}
