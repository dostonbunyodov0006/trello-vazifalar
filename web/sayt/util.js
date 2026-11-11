// Ёрдамчилар: сана, исм, қидирув, бошқалар
const OY = ["январ", "феврал", "март", "апрел", "май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
export const toshkentBugun = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
export const kunQosh = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400_000).toISOString().slice(0, 10);
export function sanaT(s) { const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]} ${OY[+m[2] - 1]}` : ""; }
/** Муддат нишони: kech (қизил) · yaqin (сариқ: бугун/эртага) · tayyor (яшил) · оддий */
export function muddatNishon(c, bugun) {
  if (!c.muddat) return { tur: "", matn: "" };
  const sana = sanaT(c.muddat);
  if (c.bajarildi) return { tur: "tayyor", matn: sana };
  if (c.muddat < bugun) return { tur: "kech", matn: sana + " · кечикди" };
  if (c.muddat === bugun) return { tur: "yaqin", matn: sana + " · бугун" };
  // Trello қоидаси: фақат бугунги (сариқ) ва кечикканлари (қизил) рангли — қолгани рангсиз
  if (c.muddat === kunQosh(bugun, 1)) return { tur: "", matn: sana + " · эртага" };
  return { tur: "", matn: sana };
}
export function vaqtT(iso) {
  const d = new Date(Date.parse(iso) + 5 * 3600_000);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${OY[d.getUTCMonth()]}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
export const harf = (s) => (String(s || "?").trim()[0] || "?").toUpperCase();
export const pul = (n) => Math.round(n || 0).toLocaleString("ru-RU").replace(/ /g, " ");
const X = { а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", қ: "q", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ў: "o", ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ь: "", ы: "i", э: "e", ю: "yu", я: "ya" };
const lotin = (s) => String(s || "").toLowerCase().replace(/[а-яёқғўҳ]/g, (h) => X[h] ?? h).replace(/[''`ʻʼ‘’\s.-]/g, "");
export const mos = (matn, q) => !q || lotin(matn).includes(lotin(q));
/** Ходим аватари учун ранг (исмга қараб доим бир хил) */
const RANGLAR = [["#dfd8fd", "#352c63"], ["#c6edfb", "#164555"], ["#baf3db", "#164b35"], ["#f8e6a0", "#533f04"], ["#ffd5d2", "#5d1f1a"], ["#fedec8", "#702e00"]];
export function avatarRang(ism) { let h = 0; for (const c of String(ism || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return RANGLAR[h % RANGLAR.length]; }
/** Расмни кичрайтириш (1600px, JPEG) */
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

/** Мавзу: "yorug" · "qorongu" · "tizim" (компьютер созламаси бўйича). Танлов браузерда сақланади. */
export const tizimMavzu = () => { try { return window.matchMedia("(prefers-color-scheme: light)").matches ? "yorug" : "qorongu"; } catch { return "qorongu"; } };
export function mavzuTanlov() { try { return localStorage.getItem("ish_mavzu") || "tizim"; } catch { return "tizim"; } }
export const mavzuOl = () => { try { return document.documentElement.dataset.mavzu || "qorongu"; } catch { return "qorongu"; } };
export function mavzuQoy(m) {
  try { localStorage.setItem("ish_mavzu", m); } catch {}
  document.documentElement.dataset.mavzu = m === "tizim" ? tizimMavzu() : m;
  return m;
}

/** Вазифанинг зарурлиги: ном, ранг, қисқа белги */
export const MUHIMLIK = {
  urgent: { nom: "Зудлик билан", qisqa: "Зудлик билан", rang: "#C9372C", izoh: "Ҳозироқ бажарилсин" },
  high: { nom: "Тезроқ", qisqa: "Тезроқ", rang: "#E2B203", izoh: "Қўлдан келганича тез бажарилсин" },
  medium: { nom: "Сифат билан", qisqa: "", rang: "#1F845A", izoh: "Шошилмасдан, сифатли бажарилсин" },
  low: { nom: "Сифат билан", qisqa: "", rang: "#1F845A", izoh: "Шошилмасдан, сифатли бажарилсин" },
};
export const muhimlikRo = ["urgent", "high", "medium"];
