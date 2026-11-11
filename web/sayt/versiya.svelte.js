// 🔄 Янги версия текшируви (Достон 2026-10-08).
// Сайт деплой қилингач фойдаланувчи F5 босмасин: ҳар 60 сонияда / саҳифасининг ([server] асли /trello/)
// юклайдиган JS файли номи ўзгарганми — қаралади. Ўзгарган бўлса → сайт ўзи янгиланади.
// Фойдаланувчи ёзаётган бўлса (майдонда фокус ёки модал очиқ) — янгиланиш кутиб турилади.

/** Ҳозирги саҳифа юклаган асосий JS файл номи */
function joriySkript() {
  try {
    const s = [...document.querySelectorAll("script[src]")].map((x) => x.getAttribute("src") || "");
    return s.find((x) => /^\/assets\/index-.*\.js$/.test(x)) || "";
  } catch { return ""; }
}

/** Сервердаги index.html'дан асосий JS файл номини олиш */
async function serverSkript() {
  const r = await fetch("/index.html?v=" + Date.now(), { cache: "no-store", credentials: "same-origin" });
  if (!r.ok) throw new Error("html " + r.status);
  const t = await r.text();
  const m = t.match(/src="(\/assets\/index-[^"]*\.js)"/);
  return m ? m[1] : "";
}

/** Фойдаланувчи ҳозир ёзяптими — шундай пайтда янгиламаймиз */
function bandmi() {
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
  return !!document.querySelector(".qoplama");      // очиқ модал ойна
}

/**
 * Текширувни бошлайди. Янги версия топилса — сайт ўзи янгиланади.
 * @returns {() => void} тўхтатиш функцияси
 */
export function versiyaKuzat(oraliq = 60000) {
  const joriy = joriySkript();
  if (!joriy) return () => {};
  let yangi = "";
  const tekshir = async () => {
    try {
      const s = await serverSkript();
      if (s && s !== joriy) yangi = s;
    } catch { /* интернет йўқ — кейинги сафар */ }
    if (yangi && !bandmi()) location.reload();
  };
  const t = setInterval(tekshir, oraliq);
  // Бошқа ойнадан қайтганда ҳам дарров қараймиз
  const kor = () => { if (document.visibilityState === "visible") tekshir(); };
  document.addEventListener("visibilitychange", kor);
  return () => { clearInterval(t); document.removeEventListener("visibilitychange", kor); };
}
