# Vazifalar — Trello uslubidagi vazifa boshqaruvi

Kichik jamoa uchun vazifa boshqarish tizimi: **rahbarlar uchun veb-sayt** va
**xodimlar uchun Telegram Mini App**. Bitta Node.js jarayoni, bitta SQLite fayli,
tashqi xizmatlarsiz — Docker bilan istalgan serverga qo'yiladi.

> **In short.** A task-management system for small teams: a web dashboard for managers
> and a Telegram Mini App for employees. Single Node.js process, single SQLite file,
> no external services. UI is in Uzbek (Cyrillic).

---

## Nima qiladi

**Rahbar (sayt):**
- vazifa yaratadi — nomi, mazmuni, boshlanish va tugash sanasi, zarurligi (🔴 зудлик билан · 🟡 тезроқ · 🟢 сифат билан)
- bitta vazifani **bir nechta xodimga** biriktiradi
- **jarima** va **bonus** yozadi (kechikkanga jarima, vaqtida bajarganga bonus)
- doska (Янги · Жараёнда · Бажарилди), «Бугун» paneli (кечиккан · бугун · эртага), xodimlar ro'yxati
- arxiv, jarima/bonus hisoboti, **oylik .xlsx hisobot** (3 varaq: якун · жарималар · бонуслар)
- vazifadan **nusxa olish**, tahrirlash, arxivga olish, butunlay o'chirish

**Xodim (Telegram Mini App):**
- o'ziga biriktirilgan vazifalarni ko'radi — **Кунлик · Ҳафталик · Ойлик**
- tepada ogohlantirish: кечикди / бугун тугайди / 1 кун қолди / янги вазифа
- oqim: **«Тушундим»** → **rasm** (majburiy) + izoh (ixtiyoriy) → **«Бажардим»**
- sana bo'yicha tarix: qaysi kuni nima bajargan, qancha bonus/jarima olgan

**Telegram xabarlari:** yangi vazifa · 1 kun qoldi · bugun muddat · kechikdi ·
xodim «Тушундим»/«Бажардим» deganda rahbarga.

---

## Tuzilma

| Joy | Nima |
|---|---|
| `src/server.js` | HTTP server (framework'siz, `node:http`): `/api/ish`, `/app/`, `/`, `/healthz` |
| `src/ish/*.js` | Biznes kodi: `api.js` (yo'llar), `ruxsat.js` (huquqlar), `bildirish.js` (xabarlar), `sayt.js` (login/sessiya), `saqlash.js` (fayl), `excel.js` (hisobot), `sozlama.js` (sozlamalar) |
| `src/db.js` | SQLite (`node:sqlite`) ustida Cloudflare D1 bilan bir xil API + migratsiyalar |
| `src/telegram.js` | Telegram'ga **yagona** yo'l; `SHADOW` rejimi shu yerda |
| `src/cron.js` | Kuniga bir marta 09:30: arxiv tozalash, takroriy vazifalar, muddat eslatmalari |
| `src/odamlar.js` | «Botdagi odamlar» — kimga vazifa berish mumkin (`ish_odam` jadvali) |
| `src/tma.js` | Telegram Mini App `initData` imzosini tekshirish (HMAC-SHA256) |
| `migrations/` | Baza sxemasi, tartib bilan qo'llanadi |
| `web/sayt/` | Rahbarlar sayti (Svelte 5) → `dist/sayt` |
| `web/app/` | Mini ilova (Svelte 5) → `dist/app` |
| `tools/` | `import.mjs`, `sayt-parol.mjs`, `odamlar.mjs`, `outbox.mjs`, `dev.mjs` |
| `test/` | 367 ta sinov: `appish.js` (344) + `shadow`, `cron`, `import`, `server` |

**Texnologiya:** Node.js 22.13+ · `node:sqlite` · `node:http` (framework yo'q) ·
Svelte 5 (runes) · Vite · Docker. Ishlash vaqtida **tashqi npm paketi yo'q**.

---

## Xavfsizlik

- **Sayt:** login/parol — PBKDF2-SHA256, 20 000 iteratsiya, har foydalanuvchiga alohida tuz.
  Sessiya — tasodifiy token, bazada faqat uning SHA-256 xeshi. Cookie: `HttpOnly`, `Secure`, `SameSite=Strict`.
- **Urinishlar cheklangan:** bitta login uchun 5 ta, bitta IP uchun 20 ta xato — 15 daqiqa.
- **Mini App:** har so'rovda Telegram `initData` imzosi tekshiriladi (bot tokeni bilan HMAC).
- **CSRF:** GET'dan boshqa har so'rovda `x-ish-sayt: 1` sarlavhasi shart.
- **Huquqlar:** `owner` → `admin` → `member`. Xodim faqat o'ziga biriktirilgan vazifani ko'radi va
  faqat o'z holatini o'zgartira oladi; jarima/bonus va tahrir — faqat rahbarda.
- Fayl turi MIME bo'yicha tekshiriladi (nomi mijozdan olinmaydi), hajmi cheklangan.

---

## Ishga tushirish

Node 22.13+ kerak.

```bash
npm install
npm run build          # ikkala frontendni yig'adi → dist/
npm test               # 367 ta sinov
npm run dev            # http://localhost:8080   (baza: ./data, SHADOW=1)
```

`npm run dev` bo'sh bazaga `baza/02-malumot.sql` (namuna ma'lumot) ni o'zi yuklaydi va
mini ilovani sinash uchun ikkita `initData` chiqaradi. Brauzerda:
`http://localhost:8080/app/` → konsolda `localStorage.devInitData = "<initData>"` → sahifani yangilang.

Saytga login qo'yish:

```bash
DATA_DIR=./data node tools/sayt-parol.mjs rahbar 100000002
```

### Docker

```bash
cp .env.example .env     # BOT_TOKEN ni yozing
docker compose up -d --build
docker compose exec -T trello node tools/import.mjs baza/02-malumot.sql </dev/null
docker compose exec trello node tools/sayt-parol.mjs rahbar 100000002
```

Konteyner tashqariga port ochmaydi — oldiga nginx yoki boshqa reverse proxy qo'yiladi
(`trello:8080` ga uzatiladi). Tekshirish: `/healthz` → `{"ok":true,...}`.

---

## Sozlamalar

`.env` (namuna: `.env.example`):

| Kalit | Nima |
|---|---|
| `BOT_TOKEN` | Telegram bot tokeni (@BotFather). Mini ilova imzosi shu bilan tekshiriladi |
| `SHADOW` | `1` (standart) — Telegram'ga **hech narsa yuborilmaydi**, xabarlar `tg_outbox` jadvaliga yoziladi. Sinash uchun qulay. Haqiqiy ishga tushirganda `0` |
| `PUBLIC_URL` | Saytning tashqi manzili (Telegram xabaridagi tugma shuni ochadi) |
| `TZ` | Vaqt mintaqasi, masalan `Asia/Tashkent` |
| `ISH_OCHIQ` | `0` — faqat `src/ish/sozlama.js` dagi `KORADI` ro'yxati kiradi; `1` — hamma xodimga ochiq |
| `ISH_FAYL_CHAT` | bo'sh — fayllar diskda (`/data/files`); kanal id berilsa — Telegram kanalida |
| `CRON` | `0` — kunlik eslatmalar o'chiq |

Rahbarlar va zarurlik darajalari, chegaralar, kunlik jarima tarifi — hammasi
`src/ish/sozlama.js` da, bitta joyda.

**Kimga vazifa berish mumkin** (`ish_odam` jadvali):

```bash
node tools/odamlar.mjs qosh 100000002 "Исм" dasturchi
node tools/odamlar.mjs royxat
node tools/odamlar.mjs import odamlar.json      # { "telegram_id": "Исм" }
```

---

## Ma'lumot yuklash

```bash
node tools/import.mjs baza/02-malumot.sql       # namuna: doska, 3 ustun, 4 belgi, 2 a'zo, 2 login
node tools/import.mjs eksport.sql --toza        # eski ish_* tozalanadi, yangisi yuklanadi
node tools/import.mjs eksport.sql --sinov       # faqat ko'rsatadi, yozmaydi
```

Takroriy yuklash xavfsiz: qatorlar birlamchi kalit bo'yicha yangilanadi, faylda yo'q
ustunlar tegilmaydi — masalan `sayt-parol.mjs` bilan qo'yilgan parol qayta yuklashda o'chmaydi.
Faqat `ish_*` jadvallari olinadi.

`baza/01-jadvallar.sql` — bo'sh bazani noldan tiklash uchun to'liq sxema.
`baza/02-malumot.sql` — **namuna** (demo) ma'lumot: soxta Telegram id lar, parol xeshi yo'q.

---

## Kutilayotgan ishlar

- `/takror` (takrorlanuvchi vazifalar) va checklist API'si ishlaydi, lekin interfeysi yo'q —
  yo interfeys qo'shiladi, yo kod olib tashlanadi.
- Ko'p tilli interfeys (hozircha faqat o'zbekcha, kirill).

---

## Litsenziya

MIT — `LICENSE` fayliga qarang.
