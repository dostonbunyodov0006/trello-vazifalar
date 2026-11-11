// src/app/ish/ruxsat.js — ким нима қила олади. Ҳамма текширув ШУ ЕРДА (API ичида тарқалмайди).
//
//   owner  — Сардор ака: ҳаммаси, шу жумладан аъзолар, роллар, тариф, ўчириш
//   admin  — Мурод ака: вазифа беради, доска/устун/label, ҳамма карточкани кўради
//   member — ходим: фақат ЎЗИГА берилган карточкаларни кўради ва юритади
//
// kontekst: { rol, uid } — сервер initData'дан аниқлаган; мижоз юборган роль ишлатилмайди.

const DARAJA = { member: 1, admin: 2, owner: 3 };
export const kamida = (rol, kerak) => (DARAJA[rol] || 0) >= DARAJA[kerak];

/** Карточка шу одамники (берилган ходим) */
/** Вазифа шу одамга берилганми (бажарувчилардан бири) */
export const menikimi = (k, card) => !!card &&
  (String(card.ijro || "").includes("," + Number(k.uid) + ",") || Number(card.kimga) === Number(k.uid));

const QOIDA = {
  "ws.kor": (k) => kamida(k.rol, "member"),
  "azo.kor": (k) => kamida(k.rol, "admin"),
  "azo.boshqar": (k) => kamida(k.rol, "owner"),     // роль, тариф, бўлим, чиқариш
  "board.kor": (k) => kamida(k.rol, "member"),
  "board.boshqar": (k) => kamida(k.rol, "admin"),   // яратиш, номлаш, тартиб, архив
  "list.boshqar": (k) => kamida(k.rol, "admin"),
  "label.boshqar": (k) => kamida(k.rol, "admin"),
  "card.yarat": (k) => kamida(k.rol, "admin"),
  "card.kor": (k, c) => kamida(k.rol, "admin") || menikimi(k, c),
  "card.tahrir": (k) => kamida(k.rol, "admin"),     // ном, тавсиф, муддат, ходим, муҳимлик, label
  "card.kochir": (k, c) => kamida(k.rol, "admin") || menikimi(k, c),
  "card.arxiv": (k) => kamida(k.rol, "admin"),
  "card.ochir": (k) => kamida(k.rol, "admin"),      // Сардор ака ва Мурод ака (Достон 2026-09-22)
  "card.jarima": (k) => kamida(k.rol, "admin"),     // жаримани Сардор ака ва Мурод ака ёзади
  "card.yoz": (k, c) => kamida(k.rol, "admin") || menikimi(k, c),   // изоҳ, checklist, файл
  "izoh.moderat": (k) => kamida(k.rol, "admin"),
};

/** @returns {boolean} */
export function mumkin(k, amal, obj) {
  const q = QOIDA[amal];
  if (!q) throw new Error("номаълум амал: " + amal);
  return !!k && !!k.rol && q(k, obj);
}
