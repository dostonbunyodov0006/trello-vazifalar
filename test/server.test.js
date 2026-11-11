// test/server.test.js — HTTP qatlami: /api/ish (Request/Response o'rami), statik fayllar, yo'naltirishlar, cookie.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ilovaYasa } from "../src/server.js";
import { parolHash } from "../src/ish/sayt.js";
import { initDataYasa } from "../src/tma.js";
import { fetchTut, yangiEnv, TOKEN, SARDOR } from "./yordam.js";

const asl = globalThis.fetch;   // server'ga so'rovlar uchun haqiqiy fetch (Telegram uchun — soxta)
let server, URL0, env;
before(async () => {
  const web = fs.mkdtempSync(path.join(os.tmpdir(), "trello-web-"));
  fs.mkdirSync(path.join(web, "sayt", "assets"), { recursive: true });
  fs.mkdirSync(path.join(web, "app"), { recursive: true });
  fs.writeFileSync(path.join(web, "sayt", "index.html"), "<html>SAYT</html>");
  fs.writeFileSync(path.join(web, "sayt", "assets", "index-abc.js"), "console.log(1)");
  fs.writeFileSync(path.join(web, "app", "index.html"), "<html>APP</html>");
  fetchTut();
  env = yangiEnv();
  const tuz = "ab".repeat(16);
  await env.DB.prepare("INSERT INTO ish_kirish (login, uid, hash, tuz, takror, yangilandi) VALUES ('sardor', ?, ?, ?, 1000, 'x')").bind(SARDOR, await parolHash("Sinov-Parol-1", tuz, 1000), tuz).run();
  server = http.createServer(ilovaYasa({ env, webDir: web }));
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  URL0 = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test("/healthz", async () => {
  const r = await asl(URL0 + "/healthz").then((x) => x.json());
  assert.deepEqual(r, { ok: true, shadow: true });
});

test("statik: sayt /, SPA fallback, assets keshlanadi, /app/ alohida, /trello → /", async () => {
  let r = await asl(URL0 + "/");
  assert.equal(await r.text(), "<html>SAYT</html>");
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.match(r.headers.get("cache-control"), /no-cache/);
  r = await asl(URL0 + "/biror/sahifa");
  assert.equal(await r.text(), "<html>SAYT</html>");
  r = await asl(URL0 + "/assets/index-abc.js");
  assert.match(r.headers.get("cache-control"), /immutable/);
  r = await asl(URL0 + "/app/?bolim=ish&card=5");
  assert.equal(await r.text(), "<html>APP</html>");
  assert.equal(r.headers.get("x-frame-options"), null, "Telegram Web mini ilovani iframe'da ochadi");
  r = await asl(URL0 + "/trello/", { redirect: "manual" });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "/");
  r = await asl(URL0 + "/../../etc/passwd");
  assert.ok([400, 404].includes(r.status) || (await r.text()) === "<html>SAYT</html>");
  r = await asl(URL0 + "/yoq.js");
  assert.equal(r.status, 404);
});

test("API: imzosiz 401, initData bilan 200", async () => {
  assert.equal((await asl(URL0 + "/api/ish/men")).status, 401);
  const init = await initDataYasa({ id: SARDOR, first_name: "S" }, TOKEN);
  const r = await asl(URL0 + "/api/ish/men", { headers: { authorization: "tma " + init } }).then((x) => x.json());
  assert.equal(r.ok, true);
  assert.equal(r.rol, "owner");
  assert.equal((await asl(URL0 + "/api/boshqa")).status, 404);
});

test("sayt: login → cookie → /men, CSRF sarlavhasiz o'zgartirish 403, chiqish", async () => {
  const k = await asl(URL0 + "/api/ish/kirish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: "sardor", parol: "Sinov-Parol-1" }) });
  assert.equal(k.status, 200);
  const ck = k.headers.get("set-cookie");
  assert.match(ck, /ish_s=.*HttpOnly; Secure; SameSite=Strict/);
  const cookie = ck.split(";")[0];
  const m = await asl(URL0 + "/api/ish/men", { headers: { cookie } }).then((x) => x.json());
  assert.equal(m.ok, true);
  assert.equal((await asl(URL0 + "/api/ish/boards", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await asl(URL0 + "/api/ish/chiqish", { method: "POST", headers: { cookie, "x-ish-sayt": "1" } })).status, 200);
  assert.equal((await asl(URL0 + "/api/ish/men", { headers: { cookie } })).status, 401);
});

test("login urinishlari IP bo'yicha: mijoz yuborgan cf-connecting-ip hisobga olinmaydi", async () => {
  // 20 ta noto'g'ri urinish turli soxta cf-connecting-ip bilan — baribir bitta IP (X-Real-IP yo'q → socket) sanaladi
  for (let i = 0; i < 20; i++) {
    await asl(URL0 + "/api/ish/kirish", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "10.0.0." + i }, body: JSON.stringify({ login: "yoq" + i, parol: "x" }) });
  }
  const r = await asl(URL0 + "/api/ish/kirish", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "1.2.3.4" }, body: JSON.stringify({ login: "sardor", parol: "Sinov-Parol-1" }) });
  assert.equal(r.status, 429);
  await env.DB.prepare("DELETE FROM ish_urinish").run();
});

test("juda katta so'rov — 413 (Content-Length bo'yicha, tanani o'qimasdan)", async () => {
  const port = new URL(URL0).port;
  const status = await new Promise((ok, rad) => {
    const q = http.request({ host: "127.0.0.1", port, path: "/api/ish/boards", method: "POST", headers: { "content-type": "application/octet-stream", "content-length": String(60 * 1024 * 1024) } }, (r) => { ok(r.statusCode); r.resume(); });
    q.on("error", rad);
    q.write("x");
  });
  assert.equal(status, 413);
});
