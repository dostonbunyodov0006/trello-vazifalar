// src/server.js — Vazifalar (Trello) alohida serveri: trello.example.com
//
//   /api/ish/*   → src/ish/api.js (Cloudflare'dagi bilan bir xil API; Web Request/Response orqali)
//   /app/        → xodimlar mini ilovasi (Telegram Mini App) — dist/app
//   /            → rahbarlar sayti — dist/sayt
//   /trello/...  → / ga yo'naltiriladi (eski havolalar)
//   /healthz     → { ok: true }
//
// Framework yo'q: node:http + Web Request/Response (Node 22 da bor).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bazaOch, migratsiya } from "./db.js";
import { sozlamaOl } from "./env.js";
import { ishApi } from "./ish/api.js";
import { cronBoshla } from "./cron.js";
import { shadowmi } from "./telegram.js";

const MAX_TANA = 8 * 1024 * 1024 * 6 + 65536;   // api.js tanaOl() chegarasi bilan bir xil
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8", ".map": "application/json",
};
const JSONH = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function tanaOqi(req) {
  return new Promise((ok, rad) => {
    const bolak = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > MAX_TANA) { rad(Object.assign(new Error("katta"), { s: 413 })); req.destroy(); } else bolak.push(c); });
    req.on("end", () => ok(Buffer.concat(bolak)));
    req.on("error", rad);
  });
}

/** node IncomingMessage → Web Request. IP: faqat old nginx'ning X-Real-IP si (mijoz yuborgan cf-connecting-ip o'chiriladi) */
async function webRequest(req) {
  const h = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (k === "cf-connecting-ip" || k.startsWith(":")) continue;
    if (Array.isArray(v)) v.forEach((x) => h.append(k, x)); else if (v !== undefined) h.set(k, v);
  }
  const ip = String(req.headers["x-real-ip"] || req.socket.remoteAddress || "?");
  h.set("cf-connecting-ip", ip);   // sayt.js shu sarlavhani o'qiydi (login urinishlari chegarasi)
  const url = "http://" + (req.headers.host || "localhost") + req.url;
  const usul = req.method.toUpperCase();
  const init = { method: usul, headers: h };
  if (usul !== "GET" && usul !== "HEAD") {
    const uz = Number(req.headers["content-length"] || 0);
    if (uz > MAX_TANA) throw Object.assign(new Error("katta"), { s: 413 });
    init.body = await tanaOqi(req);
  }
  return new Request(url, init);
}

async function webJavob(res, r, head = false) {
  const h = {};
  r.headers.forEach((v, k) => { if (k !== "set-cookie") h[k] = v; });
  const ck = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  if (ck.length) h["set-cookie"] = ck;
  const body = head || !r.body ? null : Buffer.from(await r.arrayBuffer());
  if (body) h["content-length"] = String(body.length);
  res.writeHead(r.status, h);
  res.end(body || undefined);
}

function statik(res, root, rel, { fallback, sayt, head }) {
  let yol;
  try { yol = path.normalize(path.join(root, decodeURIComponent(rel))); } catch { yol = null; }
  if (!yol || !yol.startsWith(root)) { res.writeHead(400); return res.end(); }
  let st = null;
  try { st = fs.statSync(yol); if (st.isDirectory()) { yol = path.join(yol, "index.html"); st = fs.statSync(yol); } } catch { st = null; }
  if (!st && fallback && !path.extname(rel)) { yol = path.join(root, "index.html"); try { st = fs.statSync(yol); } catch { st = null; } }
  if (!st) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); return res.end("not found"); }
  const ext = path.extname(yol).toLowerCase();
  const h = { "content-type": MIME[ext] || "application/octet-stream", "content-length": String(st.size), "x-content-type-options": "nosniff" };
  if (ext === ".html") h["cache-control"] = "no-cache, must-revalidate";
  else if (/[\\/]assets[\\/]/.test(yol)) h["cache-control"] = "public, max-age=31536000, immutable";
  else h["cache-control"] = "public, max-age=3600";
  if (sayt) { h["x-frame-options"] = "DENY"; h["referrer-policy"] = "same-origin"; }   // asl worker.js kabi (faqat sayt)
  res.writeHead(200, h);
  if (head) return res.end();
  fs.createReadStream(yol).pipe(res);
}

export function ilovaYasa({ env, webDir }) {
  const SAYT = path.join(webDir, "sayt"), APP = path.join(webDir, "app");
  return async (req, res) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    const usul = req.method.toUpperCase();
    try {
      if (p === "/healthz") { res.writeHead(200, JSONH); return res.end(JSON.stringify({ ok: true, shadow: shadowmi(env) })); }
      if (p === "/api/ish" || p.startsWith("/api/ish/")) {
        let r;
        try { r = await ishApi(await webRequest(req), env); }
        catch (e) {
          if (e && e.s === 413) r = new Response(JSON.stringify({ ok: false, xato: "Сўров жуда катта" }), { status: 413, headers: JSONH });
          else { console.error("api:", e && e.stack || e); r = new Response(JSON.stringify({ ok: false, xato: "сервер хатоси" }), { status: 500, headers: JSONH }); }
        }
        return await webJavob(res, r, usul === "HEAD");
      }
      if (p === "/api" || p.startsWith("/api/")) { res.writeHead(404, JSONH); return res.end(JSON.stringify({ ok: false, xato: "Топилмади" })); }
      if (usul !== "GET" && usul !== "HEAD") { res.writeHead(405); return res.end(); }
      if (p === "/trello" || p.startsWith("/trello/")) { res.writeHead(301, { location: "/" + url.search }); return res.end(); }
      if (p === "/app") { res.writeHead(302, { location: "/app/" + url.search }); return res.end(); }
      if (p.startsWith("/app/")) return statik(res, APP, p.slice(5) || "index.html", { fallback: true, head: usul === "HEAD" });
      return statik(res, SAYT, p.slice(1) || "index.html", { fallback: true, sayt: true, head: usul === "HEAD" });
    } catch (e) {
      console.error("server:", e && e.stack || e);
      if (!res.headersSent) { res.writeHead(500, JSONH); res.end(JSON.stringify({ ok: false, xato: "сервер хатоси" })); } else res.end();
    }
  };
}

/* ── ishga tushirish ── */
export function ishgaTushir(s = sozlamaOl()) {
  const DB = bazaOch(s.DB_FAYL);
  const yangi = migratsiya(DB);
  if (yangi.length) console.log("migratsiya:", yangi.join(", "));
  const env = { ...s.env, DB };
  const webDir = s.WEB_DIR || fileURLToPath(new URL("../dist/", import.meta.url));
  const server = http.createServer(ilovaYasa({ env, webDir }));
  server.requestTimeout = 120_000;
  server.listen(s.PORT, () => console.log(`trello: :${s.PORT} · baza ${s.DB_FAYL} · SHADOW=${shadowmi(env) ? "1 (hech narsa yuborilmaydi)" : "0 (YUBORILADI)"} · ISH_OCHIQ=${env.ISH_OCHIQ}${env.BOT_TOKEN ? "" : " · ⚠️ BOT_TOKEN yo'q (mini ilova kira olmaydi)"}`));
  const toxtat = env.CRON !== "0" ? cronBoshla(env) : () => {};
  const yop = () => { toxtat(); server.close(() => { DB.yop(); process.exit(0); }); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on("SIGTERM", yop); process.on("SIGINT", yop);
  return { server, env, DB };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) ishgaTushir();
