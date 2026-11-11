<script>
  // 🖥 BIGANT Вазифалар — сайт қобиғи: кириш, юқори панел, саҳифалар (hash: #/, #/b/1, #/b/1/c/5, #/arxiv, #/jarima)
  import { onMount } from "svelte";
  import { versiyaKuzat } from "./versiya.svelte.js";
  import { api, chiqqandaQoy } from "./api.js";
  import { harf, avatarRang, mavzuTanlov, mavzuQoy, mos, vaqtT } from "./util.js";
  import { qidiruv } from "./holat.svelte.js";
  import Ikon from "./Ikon.svelte";
  import Kirish from "./Kirish.svelte";
  import Doska from "./Doska.svelte";
  import Hisobot from "./Hisobot.svelte";
  import Bugun from "./Bugun.svelte";
  import Xodimlar from "./Xodimlar.svelte";
  import Parol from "./Parol.svelte";
  import YangiKarta from "./YangiKarta.svelte";

  let men = $state(null), holat = $state("yuk"), yol = $state(location.hash || "#/");
  let toast = $state(""), toastRd = $state(false), yangi = $state(false), tt = null;
  export function xabar(t, rd = false) { toast = t; toastRd = rd; clearTimeout(tt); tt = setTimeout(() => (toast = ""), 2800); }

  async function yukla() {
    try { men = await api("/men"); holat = "ichkari"; }
    catch (e) { holat = e.status === 401 ? "kirish" : "xato"; if (e.status !== 401) xabar(e.message, true); }
  }
  onMount(() => {
    chiqqandaQoy(() => { men = null; holat = "kirish"; });
    const f = () => (yol = location.hash || "#/");
    window.addEventListener("hashchange", f);
    yukla().then(async () => {
      if (!men) return;
      bildirYukla(); bTimer = setInterval(bildirYukla, 60000);
    });
    // 🔄 Янги версия чиқса сайт ўзи янгиланади — F5 босиш шарт эмас
    const vToxtat = versiyaKuzat();
    return () => { window.removeEventListener("hashchange", f); clearInterval(bTimer); vToxtat(); };
  });
  // Доска ўзи очилади — алоҳида «Доскалар» саҳифаси керак эмас
  let ochilmoqda = false;
  $effect(() => {
    if (!men || ochilmoqda || (yol && yol !== "#/" && yol !== "#")) return;
    ochilmoqda = true;
    api("/boards").then((r) => { if (r.boards[0]) location.hash = "#/b/" + r.boards[0].id; }).catch(() => {}).finally(() => (ochilmoqda = false));
  });
  async function chiq() { try { await api("/chiqish", { method: "POST", body: {} }); } catch {} men = null; holat = "kirish"; }
  const r = $derived.by(() => {
    let m;
    if (yol.startsWith("#/arxiv") || yol.startsWith("#/jarima")) return { sahifa: "yonga", tur: yol.slice(2).split("/")[0] };
    if ((m = yol.match(/^#\/b\/(\d+)(?:\/c\/(\d+))?/))) return { sahifa: "doska", board: Number(m[1]), card: m[2] ? Number(m[2]) : null };
    if ((m = yol.match(/^#\/c\/(\d+)/))) return { sahifa: "karta", card: Number(m[1]) };
    if (yol.startsWith("#/arxiv")) return { sahifa: "arxiv" };
    if (yol.startsWith("#/jarima")) return { sahifa: "jarima" };
    return { sahifa: "bosh" };
  });
  const av = $derived(men ? avatarRang(men.ism) : ["", ""]);
  $effect(() => {                                   // эски ҳавола → панелни очади
    if (r.sahifa !== "yonga") return;
    if (!panel[r.tur]) panelBos(r.tur);
    location.hash = "#/";
  });
  $effect(() => {                                   // #/c/12 → #/b/1/c/12
    if (r.sahifa !== "karta") return;
    api("/cards/" + r.card).then((x) => (location.hash = `#/b/${x.card.board_id}/c/${r.card}`)).catch((e) => { xabar(e.message, true); location.hash = "#/"; });
  });
  // Профиль менюси (Trello каби): Созламалар → Мавзу, Чиқиш
  let mavzu = $state(mavzuTanlov());        // yorug · qorongu · tizim
  let profil = $state(false), sozlama = $state(false), parolOyna = $state(false);
  const MAVZULAR = [["yorug", "quyosh", "Ёруғ"], ["qorongu", "oy", "Қоронғи"], ["tizim", "ekran", "Тизим бўйича"]];
  function menyuYop() { profil = false; sozlama = false; }
  // Ёнма-ён панеллар (Trello: Inbox · Planner · Board) — ҳар бири босилса очилади/ёпилади
  const PKALIT = "ish_panel";
  let panel = $state((() => {
    try { const x = JSON.parse(localStorage.getItem(PKALIT) || "null"); if (x) return x; } catch {}
    return { bugun: false, xodim: false, arxiv: false, jarima: false, doska: true };
  })());
  const yonSoni = $derived([panel.bugun, panel.xodim, panel.arxiv, panel.jarima].filter(Boolean).length);
  function panelBos(k) {
    const yangi = { ...panel, [k]: !panel[k] };
    if (!yangi.bugun && !yangi.xodim && !yangi.arxiv && !yangi.jarima && !yangi.doska) yangi.doska = true;   // камида биттаси очиқ қолсин
    panel = yangi;
    try { localStorage.setItem(PKALIT, JSON.stringify(panel)); } catch {}
  }
  // 🔔 Билдиришномалар: ходим «Тушундим»/«Бажардим» босса — шу ерда кўринади
  let bildir = $state(null), bOch = $state(false), oqilmagan = $state(0), bTimer = null;
  async function bildirYukla() {
    try {
      const r = await api("/bildir");
      bildir = r.bildir;
      oqilmagan = r.bildir.filter((x) => !x.oqildi).length;
    } catch { /* жим */ }
  }
  async function bildirOch() {
    bOch = !bOch; profil = false;
    if (bOch) { hammaKarta = null; await bildirYukla(); }
  }
  async function bildirOqildi(b) {
    bOch = false;
    if (b.oqildi) return;
    b.oqildi = true; oqilmagan = Math.max(0, oqilmagan - 1);
    try { await api("/bildir/oqildi", { method: "POST", body: { id: b.id } }); } catch {}
  }
  async function hammasiOqildi() {
    try { await api("/bildir/oqildi", { method: "POST", body: {} }); } catch {}
    await bildirYukla();
  }
  // 🔍 Қидирув натижалари (Trello'да ҳам шундай рўйхат чиқади)
  let natija = $state(null), qOch = $state(false), qTimer = null, hammaKarta = null;
  function qidirdi() {
    clearTimeout(qTimer);
    const t = qidiruv.matn.trim();
    if (t.length < 2) { natija = null; qOch = false; return; }
    qOch = true;
    qTimer = setTimeout(async () => {
      try {
        if (!hammaKarta) hammaKarta = (await api("/royxat?hammasi=1")).cards;   // лотин/кирилл фарқи бўлмасин, архив ҳам
        natija = hammaKarta.filter((c) => mos(c.nom + " " + c.kimgaIsm + " " + (c.tavsif || ""), t)).slice(0, 7);
      } catch { natija = []; }
    }, 250);
  }
</script>

{#if holat === "yuk"}
  <div class="aylana"></div>
{:else if holat === "kirish"}
  <Kirish onkirdi={yukla} />
{:else if men}
  <div class="sahifa" class:doskada={r.sahifa === "doska"}>
    <header class="tepa">
      <a class="logo" href="#/"><span class="belgi">▦</span>BIGANT <b>Вазифалар</b></a>
      <div class="qidiruv">
        <span class="lupa"><Ikon nom="qidir" k={15} /></span>
        <input bind:value={qidiruv.matn} oninput={qidirdi} onfocus={qidirdi} placeholder="Қидириш" autocomplete="off" aria-label="Қидириш" />
        {#if qOch}
          <div class="parda" onclick={() => (qOch = false)} onkeydown={(e) => e.key === "Escape" && (qOch = false)} role="presentation"></div>
          <div class="qnat">
            <div class="mb">БЎЛИМЛАР</div>
            {#if !natija}<div class="aylana" style="margin:16px auto"></div>
            {:else if !natija.length}<div class="bosh">Бундай вазифа топилмади</div>
            {:else}
              {#each natija as c (c.id)}
                {@const ar = avatarRang(c.kimgaIsm)}
                <a class="qn" href="#/c/{c.id}" onclick={() => (qOch = false)}>
                  <span class="avatar" style="background:{ar[0]};color:{ar[1]}">{harf(c.kimgaIsm)}</span>
                  <span class="qnm"><b>{c.nom}</b><small>{c.board_nom} · {c.kimgaIsm}{#if c.arxiv}{" · "}архивда{/if}</small></span>
                </a>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
      <button class="tugma asosiy yarat" onclick={() => (yangi = true)}><Ikon nom="yulduzcha" k={15} /><span class="yz">Вазифа бериш</span></button>
      <div class="ong">
        <button class="tugma shaffof qng" onclick={bildirOch} aria-label="Билдиришномалар" title="Билдиришномалар"><Ikon nom="qongiroq" k={17} />{#if oqilmagan}<span class="son">{oqilmagan > 9 ? "9+" : oqilmagan}</span>{/if}</button>
        {#if bOch}
          <div class="parda" onclick={() => (bOch = false)} onkeydown={(e) => e.key === "Escape" && (bOch = false)} role="presentation"></div>
          <div class="menyu bmenyu">
            <div class="bsar"><b>Билдиришномалар</b>{#if oqilmagan}<button class="tugma shaffof kch" onclick={hammasiOqildi}>Ҳаммасини ўқилди</button>{/if}</div>
            <hr />
            {#if !bildir}<div class="aylana" style="margin:24px auto"></div>
            {:else if !bildir.length}<div class="bosh">Ҳозирча билдиришнома йўқ</div>
            {:else}
              <div class="bro">
                {#each bildir as b (b.id)}
                  <a class="bq" class:yangi={!b.oqildi} href={b.card_id ? `#/c/${b.card_id}` : "#/"} onclick={() => bildirOqildi(b)}>
                    <span class="bm">{b.matn}</span><span class="bv">{vaqtT(b.vaqt)}</span>
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
        <button class="avatar avt" style="background:{av[0]};color:{av[1]}" onclick={() => (profil = !profil)} title={men.ism} aria-label="Профиль">{harf(men.ism)}</button>
        {#if profil}
          <div class="parda" onclick={menyuYop} onkeydown={(e) => e.key === "Escape" && menyuYop()} role="presentation"></div>
          <div class="menyu">
            {#if !sozlama}
              <div class="mb">ФОЙДАЛАНУВЧИ</div>
              <div class="odam">
                <span class="avatar katta" style="background:{av[0]};color:{av[1]}">{harf(men.ism)}</span>
                <span><b>{men.ism}</b><small>{men.owner ? "Супер админ" : "Админ"}</small></span>
              </div>
              <hr />
              <div class="mb">БЎЛИМЛАР</div>
              <button class="qator" class:tan={panel.doska} onclick={() => { panelBos("doska"); menyuYop(); }}><Ikon nom="doska" />Доска{#if panel.doska}<span class="ok">✓</span>{/if}</button>
              <button class="qator" class:tan={panel.bugun} onclick={() => { panelBos("bugun"); menyuYop(); }}><Ikon nom="soat" />Бугун{#if panel.bugun}<span class="ok">✓</span>{/if}</button>
              <button class="qator" class:tan={panel.xodim} onclick={() => { panelBos("xodim"); menyuYop(); }}><Ikon nom="odam" />Ходимлар{#if panel.xodim}<span class="ok">✓</span>{/if}</button>
              <button class="qator" class:tan={panel.arxiv} onclick={() => { panelBos("arxiv"); menyuYop(); }}><Ikon nom="arxiv" />Архив{#if panel.arxiv}<span class="ok">✓</span>{/if}</button>
              <button class="qator" class:tan={panel.jarima} onclick={() => { panelBos("jarima"); menyuYop(); }}><Ikon nom="pul" />Жарималар{#if panel.jarima}<span class="ok">✓</span>{/if}</button>
              <hr />
              <div class="mb">СОЗЛАМАЛАР</div>
              <button class="qator" onclick={() => (sozlama = true)}><Ikon nom="mavzu" />Мавзу танлаш<span class="ok">›</span></button>
              <button class="qator" onclick={() => { parolOyna = true; menyuYop(); }}><Ikon nom="chiqish" />Паролни алмаштириш</button>
              <hr />
              <button class="qator" onclick={chiq}><Ikon nom="chiqish" />Чиқиш</button>
            {:else}
              <button class="qator orqa" onclick={() => (sozlama = false)}><Ikon nom="yigish" />Мавзу танлаш</button>
              <hr />
              {#each MAVZULAR as [k, ik, nom] (k)}
                <button class="qator" class:tan={mavzu === k} onclick={() => (mavzu = mavzuQoy(k))}><Ikon nom={ik} />{nom}{#if mavzu === k}<span class="ok">✓</span>{/if}</button>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </header>
    <main>
      {#if yonSoni}
        <!-- Ён бўлимлар: 1-2 таси ёнма-ён, 3-4 таси иккита устунга — ҳаммаси экранга сиғади -->
        <div class="yonlar" style:--ustun={yonSoni}>
          {#if panel.bugun}
            <section class="yon"><Bugun {men} {xabar} tor /></section>
          {/if}
          {#if panel.xodim}
            <section class="yon"><Xodimlar {men} {xabar} tor /></section>
          {/if}
          {#if panel.arxiv}
            <section class="yon"><Hisobot tur="arxiv" {men} {xabar} tor /></section>
          {/if}
          {#if panel.jarima}
            <section class="yon"><Hisobot tur="jarima" {men} {xabar} tor /></section>
          {/if}
        </div>
      {/if}
      {#if panel.doska}
        <section class="taxta">
          {#if r.sahifa === "doska"}
            {#key r.board}<Doska boardId={r.board} ochCard={r.card} {men} {xabar} />{/key}
          {:else if r.sahifa === "karta"}
            <div class="aylana"></div>
          {:else}
            <div class="aylana"></div>
          {/if}
        </section>
      {/if}
    </main>
    <nav class="past">
      <button class="pt" class:on={panel.doska} onclick={() => panelBos("doska")}><Ikon nom="doska" />Доска</button>
      <button class="pt" class:on={panel.bugun} onclick={() => panelBos("bugun")}><Ikon nom="soat" />Бугун</button>
      <button class="pt" class:on={panel.xodim} onclick={() => panelBos("xodim")}><Ikon nom="odam" />Ходимлар</button>
      <button class="pt" class:on={panel.arxiv} onclick={() => panelBos("arxiv")}><Ikon nom="arxiv" />Архив</button>
      <button class="pt" class:on={panel.jarima} onclick={() => panelBos("jarima")}><Ikon nom="pul" />Жарималар</button>
    </nav>
  </div>
  {#if parolOyna}<Parol {xabar} onclose={() => (parolOyna = false)} />{/if}
  {#if yangi}<YangiKarta {men} {xabar} boardId={r.sahifa === "doska" ? r.board : null} onclose={() => (yangi = false)} ondone={() => { yangi = false; window.dispatchEvent(new Event("ish-yangila")); }} />{/if}
{:else}
  <div class="aylana"></div>
{/if}
{#if toast}<div class="bildirish" class:rd={toastRd}>{toast}</div>{/if}

<style>
  .sahifa { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  .sahifa { background: var(--bg); }
  .tepa { display: flex; align-items: center; gap: 16px; height: 48px; padding: 0 16px; background: var(--tepa); border-bottom: 1px solid var(--ajr); position: sticky; top: 0; z-index: 20; }
  .logo { display: flex; align-items: center; gap: 6px; font-size: 17px; font-weight: 700; color: var(--ink); text-decoration: none; white-space: nowrap; }
  .logo b { font-weight: 500; opacity: .75; }
  .belgi { color: var(--brand); font-size: 21px; }
  .qidiruv { flex: 1 1 auto; max-width: 640px; min-width: 0; position: relative; display: flex; align-items: center; }
  .qidiruv .lupa { position: absolute; left: 9px; font-size: 13px; opacity: .8; pointer-events: none; }
  .qidiruv input { width: 100%; height: 32px; padding: 0 10px 0 30px; border-radius: 4px; border: 1px solid var(--line);
    background: var(--surf); color: var(--ink); font-size: 15px; outline: none; }
  .qidiruv input:focus { border-color: var(--brand); background: var(--bg); }
  .qnat { position: absolute; left: 0; right: 0; top: 38px; z-index: 31; background: var(--surf2); border: 1px solid var(--ajr);
    border-radius: 8px; box-shadow: var(--shadow2); padding: 6px 0; max-height: 70vh; overflow-y: auto; }
  .qn { display: flex; align-items: center; gap: 10px; padding: 10px 14px; text-decoration: none; color: var(--ink); border-bottom: 1px solid var(--ajr); }
  .qn:hover { background: var(--hover); }
  .qnm { display: flex; flex-direction: column; min-width: 0; }
  .qnm b { font-size: 15px; font-weight: 500; }
  .qnm small { font-size: 13px; color: var(--muted); }
  .yarat { margin-left: 4px; flex: 0 0 auto; gap: 6px; }
  .ong { margin-left: auto; display: flex; align-items: center; gap: 10px; position: relative; }
  .qng { position: relative; width: 34px; padding: 0; font-size: 15px; }
  .qng .son { position: absolute; top: 0; right: 0; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--rd);
    color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .bmenyu { width: 360px; right: 40px; padding-bottom: 4px; }
  .bsar { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px 6px 16px; font-size: 15px; }
  .kch { height: 26px; font-size: 13px; padding: 0 8px; color: var(--brand); }
  .bosh { text-align: center; color: var(--muted); padding: 28px 0; font-size: 15px; }
  .bro { max-height: 60vh; overflow-y: auto; }
  .bq { display: flex; flex-direction: column; gap: 2px; padding: 10px 16px; text-decoration: none; color: var(--ink); border-left: 3px solid transparent; border-bottom: 1px solid var(--ajr); }
  .bq:hover { background: var(--hover); }
  .bq.yangi { border-left-color: var(--brand); background: var(--brandsoft); }
  .bm { font-size: 15px; line-height: 1.35; white-space: pre-wrap; }
  .bv { font-size: 13px; color: var(--muted); }
  .avt { width: 32px; height: 32px; border: 0; font-size: 15px; }
  .avt:hover { filter: brightness(.92); }
  .parda { position: fixed; inset: 0; z-index: 30; }
  .menyu { position: absolute; right: 0; top: 40px; width: 304px; z-index: 31; background: var(--surf2); border: 1px solid var(--ajr);
    border-radius: 8px; box-shadow: var(--shadow2); padding: 8px 0; display: flex; flex-direction: column; }
  .mb { font-size: 13px; font-weight: 700; letter-spacing: .04em; color: var(--muted); padding: 6px 16px; }
  .odam { display: flex; align-items: center; gap: 10px; padding: 4px 16px 10px; }
  .odam span { display: flex; flex-direction: column; }
  .odam b { font-size: 15px; }
  .avatar.katta { width: 36px; height: 36px; font-size: 15px; }
  .odam small { font-size: 13px; color: var(--muted); }
  hr { border: 0; border-top: 1px solid var(--ajr); margin: 4px 0; width: 100%; }
  .qator { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: transparent; color: var(--ink);
    padding: 8px 16px; font-size: 15px; text-align: left; text-decoration: none; }
  .qator:hover { background: var(--hover); }
  .qator.tan { color: var(--brand); font-weight: 600; }
  .qator :global(.ik) { opacity: .85; }
  .qator .ok { margin-left: auto; color: var(--muted); }
  .qator.tan .ok { color: var(--brand); }
  .orqa { font-weight: 600; }
  main { flex: 1; display: flex; min-height: 0; gap: 8px; padding: 0 8px 8px; overflow: hidden; }
  .taxta { flex: 1 1 420px; min-width: 360px; display: flex; flex-direction: column; border: 1px solid var(--ajr); border-radius: 12px; overflow: hidden; background: var(--board); }
  .yonlar { flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: repeat(var(--ustun), minmax(0, 320px)); grid-template-rows: minmax(0, 1fr); gap: 8px; min-height: 0; }
  .yon { min-height: 0; overflow-y: auto; border: 1px solid var(--ajr); border-radius: 12px; background: var(--surf); box-shadow: var(--shadow); }
  /* Пастки марказий панел — Trello (Inbox · Planner · Board) каби */
  .past { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; gap: 4px; padding: 4px; border-radius: 12px;
    background: var(--surf2); border: 1px solid var(--ajr); box-shadow: 0 8px 20px #03040466; z-index: 30; }
  .past .pt { display: flex; align-items: center; gap: 8px; padding: 8px 12px 6px; border-radius: 8px; font-size: 15px; font-weight: 500;
    color: var(--ink); background: transparent; border: 0; border-bottom: 2px solid transparent; white-space: nowrap; }
  .past .pt :global(.ik) { opacity: .85; }
  .past .pt:hover { background: var(--hover); }
  .past .pt.on { background: var(--brandsoft); color: var(--brand); border-bottom-color: var(--brand); }
  @media (max-width: 1400px) {
    .yonlar { grid-template-columns: repeat(var(--ustun), minmax(0, 300px)); }
    .taxta { flex-basis: 320px; min-width: 300px; }
  }
  @media (max-width: 980px) { .yonlar { grid-template-columns: repeat(var(--ustun), minmax(0, 280px)); } }
  /* 📱 Телефон: тепа панел ихчам, пастки панел сурилади */
  @media (max-width: 720px) {
    .tepa { gap: 8px; padding: 0 8px; }
    .logo { font-size: 16px; }
    .logo b { display: none; }
    .qidiruv { max-width: none; min-width: 0; }
    .yonlar { display: none; }
    main { padding: 0 6px 6px; gap: 6px; }
    .past { left: 8px; right: 8px; transform: none; max-width: calc(100vw - 16px); overflow-x: auto; justify-content: flex-start; }
    .past .pt { padding: 8px 10px; }
    .menyu, .bmenyu { width: calc(100vw - 24px); right: -4px; }
  }
  @media (max-width: 560px) {
    .yarat { width: 36px; padding: 0; }
    .yz { display: none; }
    .past .pt { padding: 8px; font-size: 13px; }
  }
</style>
