// src/app/ish/tartib.js — тартиб (pos) ҳисоблаш. Мижоз юборган позицияга ишонилмайди:
// мижоз фақат «кимнинг орасига» (олдинги/кейинги id) дейди, сон сервер ўзи ҳисоблайди.
export const QADAM = 1024;
const ENG_KICHIK = 1e-6;

/** Олдинги ва кейинги pos орасидаги ўрин. null — йўқ (бошида/охирида). */
export function orasi(oldin, keyin) {
  if (oldin == null && keyin == null) return QADAM;
  if (oldin == null) return keyin / 2;
  if (keyin == null) return oldin + QADAM;
  return (oldin + keyin) / 2;
}
/** Ўрин жуда торайиб қолдими — ўша рўйхатни қайта рақамлаш керак */
export const tormi = (oldin, keyin, yangi) =>
  (oldin != null && yangi - oldin < ENG_KICHIK) || (keyin != null && keyin - yangi < ENG_KICHIK) || (oldin == null && keyin != null && yangi < ENG_KICHIK);
/** Қайта рақамлаш: 1024, 2048, … (фақат битта рўйхат ичида, камдан-кам) */
export const qaytaRaqam = (idlar) => idlar.map((id, i) => [id, (i + 1) * QADAM]);
