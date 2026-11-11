// 🚫 Telegram'ga yozish taqiqi — ixtiyoriy «qora ro'yxat».
//
// Ba'zi guruh yoki odamlarga bot hech narsa yubormasligi kerak bo'ladi
// (masalan, bot guruhni faqat O'QIYDI, lekin unga yozmaydi). Shu ikki
// ro'yxatga chat id qo'shilsa, telegram.js o'sha chatga yuborishni
// jimgina to'xtatadi — xato bermaydi, shunchaki { ok: false } qaytaradi.
//
// O'qish metodlari (getChat, getFile, …) har doim o'tadi.
// Standart holatda ikkala ro'yxat ham BO'SH.

/** Yozish taqiqlangan GURUHLAR: masalan -1001234567890 */
export const YOZISH_TAQIQ = new Set([]);

/** Yozish taqiqlangan ODAMLAR (shaxsiy chat): masalan 100000004 */
export const ODAMGA_TAQIQ = new Set([]);

const OQISH = new Set(["getChat", "getChatMember", "getChatMemberCount", "getChatAdministrators", "getFile"]);

/** true — shu odamga (shaxsiy chatga) yozish taqiqlangan */
export function odamgaTaqiq(method, payload, opts) {
  if (opts?.istisno || payload?.istisno) return false;
  const chat = payload && payload.chat_id;
  return chat !== undefined && chat !== null && ODAMGA_TAQIQ.has(Number(chat)) && !OQISH.has(method);
}

/** true — Telegram'ga yuborish mumkin; false — taqiqlangan guruh yoki odam */
export function yozishMumkin(method, payload, opts) {
  const chat = payload && payload.chat_id;
  if (chat === undefined || chat === null) return true;
  if (YOZISH_TAQIQ.has(Number(chat))) return OQISH.has(method);
  if (odamgaTaqiq(method, payload, opts)) return false;
  return true;
}

/** tg() uchun tayyor javob — xato emas, jimgina «ketmadi» */
export function taqiqJavob(method, payload) {
  console.log("taqiq: yozilmadi (taqiqlangan guruh/odam) —", method, payload && payload.chat_id);
  return { ok: false, error_code: 0, description: "taqiq: bu chatga yozish to'xtatilgan", taqiq: true };
}
