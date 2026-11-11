// 📋 Вазифалар (Trello каби) — илова томони. Сервер: src/app/ish/api.js (/api/ish/*).
// Бошқа бўлимларга тегмайди: ўз API ўрами, ўз файл кеши. Ҳуқуқни сервер ҳал қилади —
// бу ердаги «admin/owner» белгилари фақат тугмаларни кўрсатиш учун.
import { initData } from "../lib/tg.js";

// Mini App — фақат ходимлар учун (Достон 2026-09-22): раҳбарлар вазифани сайтда (/trello/) беради.
// Шунинг учун ҳар доим ходим сифатида (X-Ish-Rol: member — сервер фақат пасайтиради).
const sarlavhalar = () => ({ authorization: "tma " + initData(), "x-ish-rol": "member" });

export const MUHIM = { low: ["Паст", "var(--muted)"], medium: ["Ўрта", "var(--amb)"], high: ["Юқори", "var(--or)"], urgent: ["Шошилинч", "var(--rd)"] };

export async function ish(path, { method = "GET", body, fayllar } = {}) {
  const headers = sarlavhalar();
  let b;
  if (fayllar && fayllar.length) {
    b = new FormData();
    for (const [k, v] of Object.entries(body || {})) if (v !== undefined && v !== null) b.append(k, typeof v === "string" ? v : JSON.stringify(v));
    fayllar.forEach((f) => b.append("fayl", f, f.name || "fayl"));
  } else if (body !== undefined) { headers["content-type"] = "application/json"; b = JSON.stringify(body); }
  let r;
  try { r = await fetch("/api/ish" + path, { method, headers, body: b }); }
  catch { const e = new Error("Интернет алоқаси йўқ — қайта уриниб кўринг"); e.status = 0; throw e; }
  let j = null;
  try { j = await r.json(); } catch { j = null; }
  if (!r.ok || !j || j.ok === false) {
    const e = new Error((j && j.xato) || (r.status === 413 ? "Файл жуда катта" : `Хато (${r.status})`));
    e.status = r.status; throw e;
  }
  return j;
}

/** Бўлим шу одамга очиқми (ёпиқ пайтда фақат синовчига) */
export const ishBorMi = () => ish("/men").then(() => true).catch(() => false);
/** Такрорий юборишдан ҳимоя учун калит */
export const kalit = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Расмни кичрайтириш (энг катта томони 1600px, JPEG); расм бўлмаса — ўзи */
export async function siq(file, max = 1600, q = 0.82) {
  if (!/^image\//.test(file.type || "")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", q));
    return blob && blob.size < file.size ? new File([blob], "rasm.jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

// Файллар имзо билан олинади (<img src> сарлавҳа юбора олмайди) → blob URL, кешда
const kesh = new Map();
export function faylUrl(id) {
  if (!kesh.has(id)) {
    kesh.set(id, fetch("/api/ish/fayllar/" + id, { headers: sarlavhalar() })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => URL.createObjectURL(b))
      .catch(() => { kesh.delete(id); return null; }));
  }
  return kesh.get(id);
}

/** «2026-09-22T09:05:00Z» → «22.09 14:05» (Тошкент) */
export function vaqtQ(iso) {
  const d = new Date(Date.parse(iso) + 5 * 3600_000);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
export const harf = (s) => (String(s || "?").trim()[0] || "?").toUpperCase();
export const hajmQ = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + " МБ" : Math.max(1, Math.round(n / 1e3)) + " КБ");

/** Фаоллик ёзувини одам тилига */
export function faolMatn(f, labels = []) {
  const m = f.meta || {};
  const lb = (id) => (labels.find((x) => x.id === id) || {}).nom || "label";
  switch (f.amal) {
    case "card.yarat": return "вазифа берди";
    case "card.nom": return `номини ўзгартирди: «${m.yangi}»`;
    case "card.tavsif": return "тафсилотни ўзгартирди";
    case "card.kochir": return `«${m.dan}» → «${m.ga}»`;
    case "card.kimga": return "бошқа ходимга берди";
    case "card.muhim": return `муҳимлик: ${(MUHIM[m.yangi] || [m.yangi])[0]}`;
    case "card.muddat": return `муддат: ${m.yangi}`;
    case "card.tarif": return `жарима тарифи: ${m.yangi} сўм/кун`;
    case "card.arxiv": return "архивга олди";
    case "card.tiklash": return "архивдан қайтарди";
    case "label+": return `label қўшди: ${lb(m.label)}`;
    case "label-": return `label олиб ташлади: ${lb(m.label)}`;
    case "izoh": return m.fayl ? `изоҳ ёзди (${m.fayl} файл)` : "изоҳ ёзди";
    case "izoh.tahrir": return "изоҳни таҳрирлади";
    case "izoh.ochir": return "изоҳни ўчирди";
    case "chk.yarat": return `checklist қўшди: ${m.nom}`;
    case "chk.ochir": return `checklist ўчирди: ${m.nom}`;
    case "chk.ok": return `✓ ${m.nom}`;
    case "chk.qaytdi": return `✗ ${m.nom}`;
    case "fayl": return `файл юклади (${m.soni})`;
    case "fayl.ochir": return `файл ўчирди: ${m.nom}`;
    default: return f.amal;
  }
}

import { OY } from "../lib/format.js";
/** Муддат: «22 сентябр» + (бугун / эртага / кечикди) */
export function muddatT(c, bugun) {
  const m = String(c.muddat || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { sana: "—", izoh: "", rang: "" };
  const sana = `${+m[3]} ${OY[+m[2] - 1].toLowerCase()}`;
  if (c.bajarildi) return { sana, izoh: "", rang: "" };
  const ertaga = new Date(Date.parse(bugun + "T00:00:00Z") + 86400_000).toISOString().slice(0, 10);
  if (c.muddat < bugun) return { sana, izoh: "кечикди", rang: "var(--rd)" };
  if (c.muddat === bugun) return { sana, izoh: "бугун", rang: "var(--amb)" };
  if (c.muddat === ertaga) return { sana, izoh: "эртага", rang: "var(--amb)" };
  return { sana, izoh: "", rang: "" };
}
