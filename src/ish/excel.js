// src/app/ish/excel.js — 📊 Вазифалар бўлимининг ойлик .xlsx ҳисоботи (Достон 2026-10-07).
// Бухгалтерия учун: ким қанча вазифа бажарган, қанча жарима ушланади, қанча бонус берилади.
// Excel ёзувчи (../../xlsxout.js) УМУМИЙ — унга тегилмайди, фақат ишлатилади.
import { buildXlsx, S, dollar } from "../xlsxout.js";

const OY = ["январ", "феврал", "март", "апрел", "май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
const c = (v, s) => ({ v, s });
const ikki = (n) => String(n).padStart(2, "0");
/** 2026-10 → «Октябр 2026» */
export function oyNomi(oy) {
  const [y, m] = String(oy).split("-");
  const nom = OY[Number(m) - 1] || "";
  return nom.charAt(0).toUpperCase() + nom.slice(1) + " " + y;
}
/** 2026-10-09 → 09.10.2026 */
const sana = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? s.slice(8) + "." + s.slice(5, 7) + "." + s.slice(0, 4) : "");

/**
 * Ойлик ҳисобот варақлари.
 * @param {object} d { oy, xodimlar, cards, bonusXodimlar, bonusCards }
 *   xodimlar      — жарима олганлар: { id, ism, soni, kun, summa }
 *   bonusXodimlar — бонус олганлар:  { id, ism, soni, summa }
 *   cards/bonusCards — вазифалар рўйхати (kartaDTO)
 */
export function varaqlar(d) {
  const oyM = oyNomi(d.oy);

  /* ── 1. Ходимлар бўйича якун ── */
  const jam = new Map();
  const qosh = (u, maydon, qiymat, soni) => {
    const o = jam.get(u.id) || { ism: u.ism, jarima: 0, jarimaSoni: 0, bonus: 0, bonusSoni: 0 };
    o[maydon] += qiymat; o[maydon + "Soni"] += soni; jam.set(u.id, o);
  };
  for (const x of d.xodimlar || []) qosh(x, "jarima", x.summa, x.soni);
  for (const x of d.bonusXodimlar || []) qosh(x, "bonus", x.summa, x.soni);

  const yakun = [[c("Ходим", S.BOSH), c("Жарима (та)", S.BOSH), c("Жарима (сўм)", S.BOSH),
                  c("Бонус (та)", S.BOSH), c("Бонус (сўм)", S.BOSH), c("Фарқ (сўм)", S.BOSH)]];
  const ro = [...jam.values()].sort((a, b) => (b.jarima - b.bonus) - (a.jarima - a.bonus) || a.ism.localeCompare(b.ism, "ru"));
  for (const x of ro) {
    yakun.push([c(x.ism, S.MATN), c(x.jarimaSoni, S.SON), c(x.jarima, dollar(S.SON)),
                c(x.bonusSoni, S.SON), c(x.bonus, dollar(S.SON)), c(x.bonus - x.jarima, dollar(S.SON))]);
  }
  const oxiri = ro.length + 1;
  yakun.push([c("ЖАМИ", S.JAMI_M),
    { f: `SUM(B2:B${oxiri})`, s: S.JAMI }, { f: `SUM(C2:C${oxiri})`, s: dollar(S.JAMI) },
    { f: `SUM(D2:D${oxiri})`, s: S.JAMI }, { f: `SUM(E2:E${oxiri})`, s: dollar(S.JAMI) },
    { f: `SUM(F2:F${oxiri})`, s: dollar(S.JAMI) }]);
  if (!ro.length) yakun.push([], [c("Бу ойда жарима ҳам, бонус ҳам ёзилмаган", S.MATN)]);

  /* ── 2. Жарималар (вазифа бўйича) ── */
  const jr = [[c("Вазифа", S.BOSH), c("Бажарувчи", S.BOSH), c("Муддат", S.BOSH), c("Кечикди (кун)", S.BOSH), c("Жарима (сўм)", S.BOSH)]];
  for (const x of d.cards || []) {
    jr.push([c(x.nom, S.MATN), c((x.ijro || []).map((u) => u.ism).join(", "), S.MATN),
             c(sana(x.muddat), S.MATN), c(x.jarimaKun || 0, S.SON), c(x.jarima, dollar(S.SON))]);
  }
  if (!(d.cards || []).length) jr.push([], [c("Бу ойда жарима ёзилмаган", S.MATN)]);

  /* ── 3. Бонуслар (вазифа бўйича) ── */
  const bn = [[c("Вазифа", S.BOSH), c("Бажарувчи", S.BOSH), c("Муддат", S.BOSH), c("Бонус (сўм)", S.BOSH)]];
  for (const x of d.bonusCards || []) {
    bn.push([c(x.nom, S.MATN), c((x.ijro || []).map((u) => u.ism).join(", "), S.MATN),
             c(sana(x.muddat), S.MATN), c(x.bonus, dollar(S.SON))]);
  }
  if (!(d.bonusCards || []).length) bn.push([], [c("Бу ойда бонус ёзилмаган", S.MATN)]);

  return [
    { name: "Якун — " + oyM, rows: yakun, cols: [24, 12, 15, 12, 15, 15], freeze: 1 },
    { name: "Жарималар", rows: jr, cols: [44, 24, 12, 14, 15], freeze: 1 },
    { name: "Бонуслар", rows: bn, cols: [44, 24, 12, 15], freeze: 1 },
  ];
}

/** .xlsx байтлари ва файл номи */
export async function ishExcel(d) {
  const bytes = await buildXlsx(varaqlar(d));
  const [y, m] = String(d.oy).split("-");
  return { bytes, nom: `Вазифалар — жарима ва бонус — ${ikki(m)}.${y}.xlsx` };
}
