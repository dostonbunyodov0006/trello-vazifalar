// src/app/ish/sozlama.js — 📋 Вазифалар бўлимининг созламалари (битта жойда).

/* 🔒 ҲОЗИРЧА ФАҚАТ ДОСТОН КЎРАДИ (Достон 2026-09-23): бошқа ҳеч ким — на раҳбарлар, на ходимлар.
 * Ёпиқ пайтда фақат KORADI рўйхатидагилар киради, вазифа берилган ходим ҳам кира олмайди
 * ва унга Telegram хабари ҳам кетмайди.
 * Очиш: KORADI га Сардор ака (100000002) ва Мурод ака (100000003) ни қайтариш,
 * ҳаммага очиш учун эса ISH_OCHIQ = true ёки wrangler да ISH_OCHIQ = "1". */
export const ISH_OCHIQ = false;
export const KORADI = [100000004, 100000002];           // Достон, Сардор ака (2026-10-26)
/** Ўзига ҳам хабар оладиган (ўзига вазифа бериб синаш учун) */
export const SINOVCHILAR = [100000004];                 // Достон
export const ochiqmi = (env) => ISH_OCHIQ || String((env && env.ISH_OCHIQ) || "") === "1";

/** Асосий workspace ва раҳбарлар. Workspace биринчи киришда ўзи яратилади. */
export const ASOSIY_WS = "BIGANT";
export const RAHBARLAR = {
  100000002: { ism: "Сардор ака", rol: "owner" },        // супер админ
  100000003: { ism: "Мурод ака", rol: "admin" },
  100000004: { ism: "Достон", rol: "owner" },           // синов учун
};

export const ROLLAR = ["owner", "admin", "member"];
export const MUHIM = ["low", "medium", "high", "urgent"];
export const BOLIMLAR = { buxgalter: "Бухгалтер", dasturchi: "Дастурчи", gruzchik: "Грузчик", sotuvchi: "Сотувчи", haydovchi: "Ҳайдовчи", boshqa: "Бошқа" };
export const LABEL_RANG = ["#E5484D", "#F2751A", "#E0A53A", "#43A832", "#3E8EDE", "#8E4EC6", "#D6409F", "#6B7280"];
/** Янги доскадаги устунлар (Достоннинг оқими: янги → тушунди → бажарди) */
export const STANDART_USTUN = [["Янги", ""], ["Жараёнда", ""], ["Бажарилди", "done"]];
/** Доска фонлари (сайтда танланади; базада фақат калит сақланади) */
export const FONLAR = ["kok", "siyoh", "yashil", "olov", "siyarang", "dengiz"];
export const STANDART_LABEL = [["Шошилинч", "#E5484D"], ["Мижоз", "#3E8EDE"], ["Омбор", "#F2751A"], ["Ҳисобот", "#8E4EC6"]];

/** Telegram'га кетадиган хабарлар:
 *  ходимга — «вазифа келди», «1 кун қолди»;
 *  раҳбарга — ходим «Тушундим» (kochdi) ва «Бажардим» (bajarildi) деганда (Достон 2026-10-08).
 *  Изоҳлар эса фақат илова ичида қолади. */
export const TG_TURLAR = ["berildi", "yaqin", "bajarildi", "kochdi"];

/** Кечиккан ҳар кун учун жарима (сўм) — ходимга алоҳида тариф берилмаган бўлса */
/** Архивдаги вазифа шунча кундан кейин автомат ўчирилади */
export const ARXIV_KUN = 30;
export const TARIF = 20000;
export const MAX_TARIF = 10_000_000;

export const CHEGARA = {
  nom: 140, tavsif: 4000, izoh: 2000, ism: 60, label: 30, checklist: 100, item: 200,
  ijro: 20,                          // битта вазифага нечта ходим
  fayllar: 6,                        // битта сўровда
  faylBayt: 8 * 1024 * 1024,         // Telegram'да сақланса
  blobBayt: 1_500_000,               // D1'да сақланса (қатор чегараси 2 МБ)
  sahifa: 50,                        // рўйхатлар саҳифаси
};
/** Рухсат этилган файллар: MIME → кенгайтма (номи мижоздан олинмайди, фақат шу ердан) */
export const FAYL_TUR = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
