// Сайт → сервер (/api/ish/*). Кириш — сессия cookie (HttpOnly). Ўзгартирувчи сўровда X-Ish-Sayt: 1 (CSRF ҳимояси).
let chiqishHodisa = () => {};
export const chiqqandaQoy = (f) => { chiqishHodisa = f; };

export async function api(path, { method = "GET", body, fayllar } = {}) {
  const headers = { "x-ish-sayt": "1" };
  let b;
  if (fayllar && fayllar.length) {
    b = new FormData();
    for (const [k, v] of Object.entries(body || {})) if (v !== undefined && v !== null) b.append(k, typeof v === "string" ? v : JSON.stringify(v));
    for (const f of fayllar) b.append("fayl", f, f.name || "fayl");
  } else if (body !== undefined) { headers["content-type"] = "application/json"; b = JSON.stringify(body); }
  let r;
  try { r = await fetch("/api/ish" + path, { method, headers, body: b, credentials: "same-origin" }); }
  catch { const e = new Error("Интернет алоқаси йўқ"); e.status = 0; throw e; }
  let j = null;
  try { j = await r.json(); } catch { j = null; }
  if (r.status === 401 && path !== "/kirish") chiqishHodisa();
  if (!r.ok || !j || j.ok === false) { const e = new Error((j && j.xato) || `Хато (${r.status})`); e.status = r.status; throw e; }
  return j;
}
/** Файл/расм манзили — cookie ўзи юборилади */
export const faylUrl = (id) => `/api/ish/fayllar/${id}`;
