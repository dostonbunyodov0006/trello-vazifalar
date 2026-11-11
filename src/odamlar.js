// src/odamlar.js — «Botdagi odamlar» ro'yxati (Telegram id → ism, bo'lim).
//
// Vazifa kimga biriktirilishi mumkinligi shu ro'yxat bilan aniqlanadi.
// Ro'yxat **bazada** (`ish_odam` jadvali) saqlanadi — kodda hech kimning
// ismi ham, Telegram id'si ham yozilmaydi.
//
// To'ldirish:
//   node tools/odamlar.mjs qosh <telegram_id> "Ism" [bo'lim]
//   node tools/odamlar.mjs royxat
//
// Quyidagi ikki ro'yxat — ixtiyoriy «kod ichidagi qo'shimcha»: bazaga
// yozishni xohlamasangiz, shu yerga qo'lda qo'shsangiz ham bo'ladi.
// Standart holatda bo'sh.

/** Qo'shimcha ismlar: { telegram_id: "Ism" } */
export const KOD_ISM = {
  // 100000004: "Doston",
};

/** Qo'shimcha xodimlar: { id, nom, bolim, tg, tglar? } */
export const HODIMLAR = [
  // { id: 1, nom: "Doston", bolim: "Dasturchi", tg: 100000004 },
];

export const hodimTgLari = (h) => [h.tg, ...(h.tglar || [])].filter(Boolean);

/** ish_odam jadvalidagi odamlar: { uid, ism, bolim } */
async function jadvaldan(env) {
  try {
    const { results } = await env.DB.prepare("SELECT uid, ism, bolim FROM ish_odam").all();
    return results || [];
  } catch { return []; }
}

/** Map(uid → { ism, bolim }) — baza + KOD_ISM + HODIMLAR, alifbo tartibida */
export async function botOdamlari(env) {
  const m = new Map();
  const ism = new Map(), bol = new Map();
  for (const r of await jadvaldan(env)) { ism.set(Number(r.uid), String(r.ism)); if (r.bolim) bol.set(Number(r.uid), String(r.bolim)); }
  for (const [id, i] of Object.entries(KOD_ISM)) ism.set(Number(id), i);
  const ro = [...ism].map(([id, i]) => ({ id, ism: i })).sort((a, b) => a.ism.localeCompare(b.ism, "ru"));
  for (const o of ro) if (Number(o.id) > 100000) m.set(Number(o.id), { ism: String(o.ism), bolim: bol.get(Number(o.id)) || "" });
  for (const h of HODIMLAR) for (const id of hodimTgLari(h)) if (!m.has(Number(id))) m.set(Number(id), { ism: String(h.nom), bolim: String(h.bolim || "") });
  return m;
}
