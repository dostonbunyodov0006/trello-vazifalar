<script>
  // Доска (Trello каби): устунлар, карточкалар, сичқонча билан суриш, фильтр, устун менюси.
  // Кўчиришда сервер фақат «кимнинг орасига» (oldin/keyin) ни олади; ҳуқуқ ва тартибни ўзи текширади.
  import { onMount, onDestroy } from "svelte";
  import { api, faylUrl } from "./api.js";
  import { toshkentBugun, muddatNishon, harf, avatarRang, pul, mos, MUHIMLIK } from "./util.js";
  import Ikon from "./Ikon.svelte";
  import KartaOyna from "./KartaOyna.svelte";
  import YangiKarta from "./YangiKarta.svelte";
  let { boardId, ochCard = null, men, xabar } = $props();

  const bugun = toshkentBugun();
  let d = $state(null), xato = $state(""), karta = $state(ochCard), yangiList = $state(null);
  let fOch = $state(false), kalit = $state(""), f = $state({ kimga: "", label: "", muddat: "", muhim: "" });
  let nomTahrir = $state(null);
  let menyu = $state(false), yangiLabel = $state(""), yangiRang = $state("#3E8EDE");
  /* ★ юлдузча ва устун менюси олиб ташланди — учта ҳолат (Янги · Жараёнда · Бажарилди) ўзгармайди */
  let yulduz = $state((() => { try { return JSON.parse(localStorage.getItem(YKALIT2) || "[]").includes(boardId); } catch { return false; } })());
  const YKALIT = "ish_yigilgan_" + boardId;
  let yigilgan = $state(((() => { try { return JSON.parse(localStorage.getItem(YKALIT) || "[]"); } catch { return []; } })()));
  function yig(id) {
    yigilgan = yigilgan.includes(id) ? yigilgan.filter((x) => x !== id) : [...yigilgan, id];
    try { localStorage.setItem(YKALIT, JSON.stringify(yigilgan)); } catch {}
  }
  const FONLAR = [["kok", "linear-gradient(145deg,#6E5DC6 2%,#E774BB 100%)"], ["siyoh", "linear-gradient(145deg,#0C66E4 2%,#227D9B 100%)"], ["yashil", "linear-gradient(145deg,#1F845A 2%,#0C66E4 100%)"], ["olov", "linear-gradient(145deg,#E56910 2%,#C9372C 100%)"], ["siyarang", "linear-gradient(145deg,#803FA5 2%,#D6409F 100%)"], ["dengiz", "linear-gradient(145deg,#227D9B 2%,#1F845A 100%)"]];
  const LABEL_RANG = ["#E5484D", "#F2751A", "#E0A53A", "#43A832", "#3E8EDE", "#8E4EC6", "#D6409F", "#6B7280"];
  let colsEl = $state(null);

  async function yukla() {
    const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    try { d = await api(`/boards/${boardId}${p.size ? "?" + p : ""}`); xato = ""; }
    catch (e) { xato = e.message; }
  }
  const tashqi = () => yukla();
  $effect(() => { if (d && d.board) { const g = (FONLAR.find((x) => x[0] === (d.board.fon || "kok")) || FONLAR[0])[1]; document.documentElement.style.setProperty("--board", g); } });
  onMount(() => { yukla(); window.addEventListener("ish-yangila", tashqi); });
  onDestroy(() => { window.removeEventListener("ish-yangila", tashqi); cancelAnimationFrame(raf); });

  const ustun = (lid) => (d ? d.cards.filter((c) => c.list_id === lid && mos(c.nom + " " + c.kimgaIsm, kalit)).sort((a, b) => a.pos - b.pos || a.id - b.id) : []);
  const lb = (id) => (d ? d.labels.find((x) => x.id === id) : null);
  const fSoni = $derived(Object.values(f).filter(Boolean).length + (kalit.trim() ? 1 : 0));
  function kartaOch(id) { karta = id; history.replaceState(null, "", `#/b/${boardId}/c/${id}`); }
  function kartaYop() { karta = null; history.replaceState(null, "", `#/b/${boardId}`); }

  /* ───── суриш (drag & drop) ───── */
  let drag = $state(null), bos = null, raf = 0, clickYoq = false;
  function bosildi(e, c) {
    if (e.button !== 0) return;
    bos = { c, el: e.currentTarget, x: e.clientX, y: e.clientY };
    window.addEventListener("pointermove", sur); window.addEventListener("pointerup", qoy, { once: true });
  }
  function sur(e) {
    if (bos && !drag && Math.hypot(e.clientX - bos.x, e.clientY - bos.y) > 6) {
      const r = bos.el.getBoundingClientRect();
      drag = { c: bos.c, x: e.clientX, y: e.clientY, w: r.width, h: r.height, ox: bos.x - r.left, oy: bos.y - r.top, toList: bos.c.list_id, oldin: null, keyin: null };
      document.body.classList.add("surilyapti");
      raf = requestAnimationFrame(avto);
    }
    if (!drag) return;
    drag.x = e.clientX; drag.y = e.clientY;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const col = el && el.closest("[data-list]");
    if (!col) return;
    const ro = [...col.querySelectorAll("[data-card]")].filter((x) => Number(x.dataset.card) !== drag.c.id);
    let oldin = null, keyin = null;
    for (const x of ro) { const r = x.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { keyin = Number(x.dataset.card); break; } oldin = Number(x.dataset.card); }
    drag.toList = Number(col.dataset.list); drag.oldin = oldin; drag.keyin = keyin;
  }
  function avto() {
    if (!drag) return;
    if (colsEl) { if (drag.x < 60) colsEl.scrollLeft -= 14; else if (drag.x > window.innerWidth - 60) colsEl.scrollLeft += 14; }
    const el = document.elementFromPoint(drag.x, drag.y);      // устун ичида ҳам ўзи сурилсин
    const ich = el && el.closest(".kartalar");
    if (ich) { const r = ich.getBoundingClientRect(); if (drag.y < r.top + 40) ich.scrollTop -= 12; else if (drag.y > r.bottom - 40) ich.scrollTop += 12; }
    raf = requestAnimationFrame(avto);
  }
  async function qoy() {
    window.removeEventListener("pointermove", sur);
    bos = null;
    if (!drag) return;
    cancelAnimationFrame(raf);
    document.body.classList.remove("surilyapti");
    const { c, toList, oldin, keyin } = drag;
    drag = null; clickYoq = true; setTimeout(() => (clickYoq = false), 50);
    const ro = ustun(c.list_id), i = ro.findIndex((x) => x.id === c.id);
    if (toList === c.list_id && (ro[i - 1]?.id ?? null) === oldin && (ro[i + 1]?.id ?? null) === keyin) return;
    const k = d.cards.find((x) => x.id === c.id), eski = { list_id: k.list_id, pos: k.pos };
    const yangi = ustun(toList).filter((x) => x.id !== c.id), o = yangi.find((x) => x.id === oldin), kk = yangi.find((x) => x.id === keyin);
    k.list_id = toList; k.pos = o && kk ? (o.pos + kk.pos) / 2 : kk ? kk.pos - 1 : o ? o.pos + 1 : 1;   // дарҳол кўринсин
    try {
      const r = await api(`/cards/${c.id}/kochir`, { method: "POST", body: { list_id: toList, oldin, keyin, ver: c.ver } });
      Object.assign(k, { ...r.card, labels: k.labels, soni: k.soni, muqova: k.muqova, tavsif: k.tavsif });
    } catch (e) { Object.assign(k, eski); xabar(e.message, true); if (e.status === 409) yukla(); }
  }

  async function doskaSaqla(body) {
    try { await api(`/boards/${boardId}`, { method: "PATCH", body }); xabar("Сақланди ✓"); yukla(); } catch (e) { xabar(e.message, true); }
  }
  async function labelQosh(e) {
    e.preventDefault();
    const nom = yangiLabel.trim(); if (!nom) return;
    try { await api(`/boards/${boardId}/labels`, { method: "POST", body: { nom, rang: yangiRang } }); yangiLabel = ""; yukla(); } catch (er) { xabar(er.message, true); }
  }
  async function labelOchir(l) {
    try { await api(`/labels/${l.id}`, { method: "DELETE" }); yukla(); } catch (e) { xabar(e.message, true); }
  }
  async function doskaNom(e) {
    e.preventDefault();
    try { await api(`/boards/${boardId}`, { method: "PATCH", body: { nom: nomTahrir } }); d.board.nom = nomTahrir; nomTahrir = null; } catch (er) { xabar(er.message, true); }
  }
</script>

{#if xato}
  <div class="bo"><div class="xat">{xato}</div></div>
{:else if !d}
  <div class="aylana" style="border-top-color:#fff"></div>
{:else}
  <div class="panel">
    {#if nomTahrir !== null}
      <form onsubmit={doskaNom}><input class="maydon nomi" bind:value={nomTahrir} maxlength="80" onblur={() => (nomTahrir = null)} autocomplete="off" /></form>
    {:else}
      <button class="doska-nom" onclick={() => (nomTahrir = d.board.nom)}>{d.board.nom}</button>
    {/if}
    <div class="fil">
      <button class="tugma oq fl" onclick={() => { fOch = !fOch; menyu = false; }} title="Фильтр"><Ikon nom="filtr" />{#if fSoni}<b class="fson">{fSoni}</b>{/if}</button>
      {#if fOch}
        <div class="popover">
          <div class="psar"><b>Фильтр</b><button class="tugma shaffof x" onclick={() => (fOch = false)}>✕</button></div>
          <div class="yorliq">Калит сўз</div>
          <input class="maydon" bind:value={kalit} placeholder="Вазифа ёки ходим номи" autocomplete="off" />
          <div class="yorliq">Бажарувчи</div>
          <label class="qt"><input type="radio" checked={!f.kimga} onchange={() => { f.kimga = ""; yukla(); }} /><span>Ҳаммаси</span></label>
          {#each d.azolar as a (a.id)}
            {@const ar = avatarRang(a.ism)}
            <label class="qt"><input type="radio" checked={f.kimga === String(a.id)} onchange={() => { f.kimga = String(a.id); yukla(); }} />
              <span class="avatar" style="background:{ar[0]};color:{ar[1]}">{harf(a.ism)}</span><span>{a.ism}</span></label>
          {/each}
          <div class="yorliq">Муддат</div>
          {#each [["", "Ҳаммаси"], ["kech", "Кечиккан"], ["bugun", "Бугун тугайди"], ["hafta", "7 кун ичида"]] as [k, n] (k)}
            <label class="qt"><input type="radio" checked={f.muddat === k} onchange={() => { f.muddat = k; yukla(); }} /><span>{n}</span></label>
          {/each}
          <div class="yorliq">Зарурлиги</div>
          <label class="qt"><input type="radio" checked={!f.muhim} onchange={() => { f.muhim = ""; yukla(); }} /><span>Ҳаммаси</span></label>
          {#each ["urgent", "high"] as mk2 (mk2)}
            <label class="qt"><input type="radio" checked={f.muhim === mk2} onchange={() => { f.muhim = mk2; yukla(); }} />
              <span class="muhimb" style:--mr={MUHIMLIK[mk2].rang}></span><span>{MUHIMLIK[mk2].nom}</span></label>
          {/each}
          {#if fSoni}<button class="tugma" style="margin-top:10px" onclick={() => { f = { kimga: "", label: "", muddat: "", muhim: "" }; kalit = ""; yukla(); }}>Фильтрни тозалаш</button>{/if}
        </div>
      {/if}
    </div>
    <button class="tugma oq uch" onclick={() => { menyu = !menyu; fOch = false; }} aria-label="Меню"><Ikon nom="nuqta" k={18} /></button>
  </div>

  {#if menyu}
    <div class="parda" onclick={() => (menyu = false)} onkeydown={(e) => e.key === "Escape" && (menyu = false)} role="presentation"></div>
    <aside class="drawer">
      <div class="dsar"><b>Меню</b><button class="tugma shaffof x" onclick={() => (menyu = false)}>✕</button></div>
      <div class="dich">
        <div class="yorliq">Доска номи ва тавсифи</div>
        <input class="maydon" bind:value={d.board.nom} maxlength="80" autocomplete="off" />
        <textarea class="maydon" bind:value={d.board.tavsif} maxlength="300" placeholder="Доска нима ҳақида (ихтиёрий)" autocomplete="off"></textarea>
        <button class="tugma asosiy" onclick={() => doskaSaqla({ nom: d.board.nom, tavsif: d.board.tavsif })}>Сақлаш</button>


        <a class="tugma keng" href="#/arxiv" onclick={() => (menyu = false)}><Ikon nom="arxiv" /> Архивланган вазифалар</a>
      </div>
    </aside>
  {/if}

  <div class="ustunlar" bind:this={colsEl}>
    {#each d.lists as l (l.id)}
      {@const ro = ustun(l.id)}
      {#if yigilgan.includes(l.id)}
        <button class="ustun yigiq" onclick={() => yig(l.id)} title="Очиш">
          <span class="son">{ro.length}</span>
          <span class="tik">{l.tur === "done" ? "✓ " : ""}{l.nom}</span>
        </button>
      {:else}
      <section class="ustun" data-list={l.id} class:ustida={drag && drag.toList === l.id}>
        <header>
          <h3>{l.tur === "done" ? "✓ " : ""}{l.nom}</h3><span class="son">{ro.length}</span>
          <button class="tugma shaffof uc" onclick={() => yig(l.id)} title="Устунни йиғиш"><Ikon nom="yigish" /></button>
        </header>
        <div class="kartalar">
          {#each ro as c (c.id)}
            {@const md = muddatNishon(c, bugun)}
            {@const ar = avatarRang(c.kimgaIsm)}
            {#if drag && drag.toList === l.id && drag.keyin === c.id}<div class="joy" style="height:{drag.h}px"></div>{/if}
            <button class="karta" data-card={c.id} class:suz={drag && drag.c.id === c.id} onpointerdown={(e) => bosildi(e, c)} onclick={() => { if (!clickYoq) kartaOch(c.id); }}>
              {#if c.muqova}<img class="muqova" src={faylUrl(c.muqova)} alt="" draggable="false" loading="lazy" />{/if}
              {#if c.labels.length}<span class="kl">{#each c.labels as id (id)}{@const x = lb(id)}{#if x}<span class="label" style="background:{x.rang}">{x.nom}</span>{/if}{/each}</span>{/if}
              <span class="kn">{#if c.muhim === "urgent" || c.muhim === "high"}<span class="muhimb" style:--mr={MUHIMLIK[c.muhim].rang} title={MUHIMLIK[c.muhim].nom}></span>{/if}{c.nom}</span>
              <span class="kp">
                {#if md.matn}<span class="nishon {md.tur}"><Ikon nom="soat" k={14} />{md.matn}</span>{/if}
                {#if c.tavsif}<span class="nishon" title="Тавсиф"><Ikon nom="tavsif" k={14} /></span>{/if}
                {#if c.soni.izoh}<span class="nishon"><Ikon nom="izoh" k={14} />{c.soni.izoh}</span>{/if}
                {#if c.soni.fayl}<span class="nishon"><Ikon nom="ilova" k={14} />{c.soni.fayl}</span>{/if}
                {#if c.soni.chk}<span class="nishon" class:tayyor={c.soni.chk === c.soni.chkOk}><Ikon nom="checklist" k={14} />{c.soni.chkOk}/{c.soni.chk}</span>{/if}
                {#if c.jarima > 0}<span class="nishon qizil">−{pul(c.jarima)}</span>{/if}
                <span class="avatar kim" style="background:{ar[0]};color:{ar[1]}" title={c.kimgaIsm}>{harf(c.kimgaIsm)}</span>
              </span>
            </button>
          {/each}
          {#if drag && drag.toList === l.id && drag.keyin == null}<div class="joy" style="height:{drag.h}px"></div>{/if}
        </div>
        {#if l.tur !== "done"}<button class="tugma shaffof keng qk" onclick={() => (yangiList = l.id)}>+ Вазифа бериш</button>{/if}
      </section>
      {/if}
    {/each}
  </div>
{/if}

{#if drag}<div class="arvoh" style="left:{drag.x - drag.ox}px;top:{drag.y - drag.oy}px;width:{drag.w}px">{#if drag.c.labels.length}<span class="kl">{#each drag.c.labels as id (id)}{@const x = lb(id)}{#if x}<span class="label" style="background:{x.rang}">{x.nom}</span>{/if}{/each}</span>{/if}<span>{drag.c.nom}</span></div>{/if}
{#if karta}{#key karta}<KartaOyna id={karta} {men} {xabar} onclose={kartaYop} onchange={yukla} />{/key}{/if}
{#if yangiList}<YangiKarta {men} {xabar} {boardId} listId={yangiList} onclose={() => (yangiList = null)} ondone={() => { yangiList = null; yukla(); }} />{/if}

<style>
  .panel { display: flex; align-items: center; gap: 8px; height: 56px; padding: 0 12px; background: #0000003d; color: #fff; flex-shrink: 0; border-bottom: 1px solid var(--ajr); }
  .doska-nom { background: transparent; border: 0; color: #fff; font-size: 17px; font-weight: 653; line-height: 34px; padding: 0 12px; border-radius: 4px; }
  .doska-nom:hover { background: #ffffff33; }
  .nomi { width: 280px; font-size: 17px; font-weight: 700; }
  .fil { position: relative; }
  .yld { width: 36px; padding: 0; font-size: 17px; margin-left: auto; }
  .sariq { color: #F5CD47; }
  .tugma.oq { background: #ffffff33; color: #fff; }
  .tugma.oq:hover { background: #ffffff4d; }
  .popover { position: absolute; top: calc(100% + 6px); left: 0; width: 290px; max-width: calc(100vw - 24px); max-height: calc(100vh - 190px); overflow-y: auto; overscroll-behavior: contain; background: var(--surf2); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow2); padding: 0 12px 12px; z-index: 40; display: flex; flex-direction: column; gap: 6px; }
  .chq { display: flex; gap: 6px; flex-wrap: wrap; }
  .tugma.tan { background: var(--brandsoft); color: var(--brand); }
  .ustunlar { flex: 1; display: flex; align-items: flex-start; gap: 12px; padding: 12px; overflow-x: auto; overflow-y: hidden; }
  .ustun { width: 272px; flex-shrink: 0; background: var(--list); color: var(--muted); border: 1px solid var(--ajr); border-radius: 12px; padding: 0 8px 8px; display: flex; flex-direction: column; gap: 8px; max-height: calc(100vh - 170px); box-shadow: var(--shadow); }
  .ustun.ustida { box-shadow: 0 0 0 2px var(--brand), var(--shadow2); }
  .ustun header { position: relative; display: flex; align-items: center; gap: 6px; padding: 8px 8px 8px; border-bottom: 1px solid var(--ajr); }
  h3 { margin: 0; font-size: 21px; font-weight: 653; line-height: 24px; color: var(--muted); flex: 1; }
  .son { font-size: 15px; color: var(--muted); }
  .uc { width: 32px; padding: 0; font-size: 15px; }
  .yigiq { width: 44px; min-height: 180px; align-items: center; gap: 12px; padding: 10px 4px; border: 0; cursor: pointer; }
  .yigiq:hover { background: var(--press); }
  .yigiq .tik { writing-mode: vertical-rl; font-size: 15px; font-weight: 600; white-space: nowrap; }
  .um { right: auto; left: 0; top: 36px; }
  .xavfm { color: var(--rd); }
  .kartalar { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding: 2px 2px 4px; min-height: 8px; }
  .karta { cursor: pointer; display: flex; flex-direction: column; gap: 6px; width: 100%; padding: 8px 12px 8px; border: 1px solid var(--ajr); border-radius: var(--r); background: var(--surf); box-shadow: var(--shadow); text-align: left; touch-action: none; user-select: none; position: relative; }
  .karta:hover { background: var(--surfh); }
  .karta:focus-visible { outline: 0; box-shadow: 0 0 0 2px var(--brand), var(--shadow); }
  .karta.suz { display: none; }
  .muqova { width: calc(100% + 24px); margin: -8px -12px 0; height: 120px; object-fit: cover; border-radius: var(--r) var(--r) 0 0; pointer-events: none; }
  .kl { display: flex; gap: 4px; flex-wrap: wrap; }
  .kl .label { height: 16px; font-size: 13px; padding: 0 6px; }
  .kn { font-size: 15px; line-height: 22px; word-break: break-word; }
  .muhimb { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--mr); margin-right: 6px; vertical-align: 1px; }
  .kp { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .kim { margin-left: auto; width: 24px; height: 24px; font-size: 13px; }
  .joy { border-radius: var(--r); background: var(--press); border: 1px dashed var(--line); }
  .qk { color: var(--muted); border-radius: 8px; justify-content: flex-start; padding: 0 8px; }
  .qk:hover { background: var(--press); color: var(--ink); }
  .qo { background: #ffffff1f; box-shadow: none; }
  .yu { background: transparent; color: #fff; }
  .yu:hover { background: #ffffff33 !important; }
  .uq { display: flex; flex-direction: column; gap: 6px; background: var(--list); border-radius: 8px; padding: 4px; }
  .arvoh { position: fixed; z-index: 90; pointer-events: none; background: var(--surf); color: var(--ink); border-radius: var(--r); padding: 8px 12px; box-shadow: var(--shadow2), 0 12px 24px #03040466; transform: rotate(4deg); font-size: 15px; display: flex; flex-direction: column; gap: 6px; }
  .arvoh .kl { display: flex; gap: 4px; flex-wrap: wrap; }
  .arvoh .label { height: 16px; font-size: 13px; padding: 0 6px; }
  .psar { display: flex; align-items: center; justify-content: center; position: sticky; top: 0; z-index: 1; background: var(--surf2); padding: 12px 0 8px; border-bottom: 1px solid var(--line); margin-bottom: 6px; font-size: 15px; }
  .x { position: absolute; right: -4px; top: -4px; width: 28px; padding: 0; }
  .qt { display: flex; align-items: center; gap: 8px; padding: 4px 4px; border-radius: 4px; font-size: 15px; cursor: pointer; }
  .qt:hover { background: var(--hover); }
  .qt input { width: 15px; height: 15px; margin: 0; }
  .qt .avatar { width: 24px; height: 24px; font-size: 13px; }
  .uch { width: 36px; padding: 0; font-size: 17px; }
  .fl { min-width: 36px; padding: 0 8px; }
  .fson { font-size: 13px; margin-left: 4px; }
  .nishon :global(.ik) { opacity: .85; }
  .parda { position: fixed; inset: 0; z-index: 45; }
  .drawer { position: fixed; right: 0; top: 48px; bottom: 0; width: 340px; max-width: 100vw; z-index: 46; background: var(--surf2); border-left: 1px solid var(--line);
    box-shadow: var(--shadow2); display: flex; flex-direction: column; }
  .dsar { display: flex; align-items: center; justify-content: center; position: relative; height: 48px; border-bottom: 1px solid var(--line); font-size: 15px; }
  .dsar .x { right: 8px; top: 10px; }
  .dich { padding: 12px 12px 32px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  .bo { padding: 32px; } .xat { background: var(--surf2); color: var(--rdt); padding: 12px 16px; border-radius: 8px; }
</style>
