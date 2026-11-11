<script>
  // 📋 Trello (Mini App) — фақат ходим: ўзига берилган вазифалар → «Тушундим» → изоҳ билан «Бажардим».
  // Вазифани Сардор ака ва Мурод ака сайтда (/trello/) беради.
  import { onMount } from "svelte";
  import { ish, muddatT, harf } from "./ishapi.js";
  import { haptic } from "../lib/tg.js";
  import { pul, sanaQ } from "../lib/format.js";
  import Icon from "../lib/Icon.svelte";
  import Karta from "./Karta.svelte";
  let { xabar, ochId = null } = $props();

  let men = $state(null), cards = $state(null), xato = $state(""), karta = $state(null), katta = $state(null);
  async function yukla() {
    try { const [m, r] = await Promise.all([ish("/men"), ish("/royxat")]); men = m; cards = r.cards; xato = ""; }
    catch (e) { xato = e.message; }
  }
  onMount(async () => { await yukla(); if (ochId) karta = Number(ochId); });
  const GURUH = [["yangi", "Янги"], ["jarayon", "Жараёнда"]];
  const RANG = { yangi: "var(--or)", jarayon: "var(--amb)" };
  const och = (c) => { karta = c.id; haptic(); window.scrollTo(0, 0); };

  // 📆 Давр: ходим ўзи танлайди — танламагунча вазифалар кўринмайди
  const DAVR = [["kun", "Кунлик", 0], ["hafta", "Ҳафталик", 7], ["oy", "Ойлик", 30]];
  // Бўлим очилиши билан «Кунлик» ўзи танланган туради (Достон 2026-10-07)
  let davr = $state("kun");
  const kunQo = (sana, n) => new Date(Date.parse(sana + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  /** Муддати шу давр ичида (ўтиб кетганлари ҳар доим кўринади) */
  function davrda(c, kun) {
    if (!men) return false;
    if (!c.muddat) return kun >= 30;
    return c.muddat <= kunQo(men.bugun, kun);
  }
  const soni = (kun) => (cards || []).filter((c) => davrda(c, kun)).length;

  // ⚠️ Огоҳлантириш: вазифа ҳолати (доим кўриниб туради)
  const ertagaS = $derived(men ? kunQo(men.bugun, 1) : "");
  const kechikkan = $derived((cards || []).filter((c) => c.kech));
  const bugunT = $derived((cards || []).filter((c) => !c.kech && c.muddat === (men ? men.bugun : "")));
  const ertagaT = $derived((cards || []).filter((c) => c.muddat === ertagaS));
  const yangiT = $derived((cards || []).filter((c) => c.holat === "yangi"));
  /** Битта вазифанинг огоҳлантириши */
  function ogoh(c) {
    if (c.kech) return { matn: "Кечикди", rang: "var(--rd)" };
    if (men && c.muddat === men.bugun) return { matn: "Бугун тугайди", rang: "var(--or)" };
    if (c.muddat === ertagaS) return { matn: "1 кун қолди", rang: "var(--amb)" };
    if (c.holat === "yangi") return { matn: "Янги вазифа", rang: "var(--acc, #3E8EDE)" };
    return null;
  }
  const korinadi = $derived(!davr ? [] : (cards || []).filter((c) => davrda(c, (DAVR.find((d) => d[0] === davr) || [])[2] || 0)));
  const davrNom = $derived((DAVR.find((d) => d[0] === davr) || ["", ""])[1]);
  const tanla = (d) => { davr = davr === d ? "" : d; tarix = false; haptic(); };

  // 📅 Тарих: ходим истаган кунни танлаб, ўша куни нима бажарганини кўради
  let tarix = $state(false), sana = $state(""), tro = $state(null), tyuk = $state(false);
  function tarixOch() { tarix = !tarix; if (tarix) { davr = ""; if (!sana) sana = men ? men.bugun : ""; } haptic(); }
  $effect(() => { if (tarix && sana) tarixYukla(); });
  async function tarixYukla() {
    if (!sana) { tro = null; return; }
    tyuk = true;
    try { tro = await ish("/tarix?sana=" + sana); } catch (e) { xabar(e.message, true); tro = null; }
    tyuk = false;
  }
</script>

{#if xato}
  <div class="body"><div class="note rd">{xato}</div></div>
{:else if !men || !cards}
  <div class="body"><div class="spin"></div></div>
{:else if karta}
  {#key karta}<Karta id={karta} {men} {xabar} onclose={() => { karta = null; window.scrollTo(0, 0); }} onchange={yukla} onrasm={(u) => (katta = u)} />{/key}
{:else}
  <div class="body pb">
    {#if kechikkan.length || bugunT.length || ertagaT.length || yangiT.length}
      <div class="ogoh">
        {#if kechikkan.length}<div class="og rd"><b>{kechikkan.length} та кечикди</b><span>муддати ўтиб кетган — тезроқ бажаринг</span></div>{/if}
        {#if bugunT.length}<div class="og or"><b>{bugunT.length} та бугун тугайди</b><span>бугун топширилмаса эртадан жарима ёзилади</span></div>{/if}
        {#if ertagaT.length}<div class="og am"><b>{ertagaT.length} тасига 1 кун қолди</b><span>муддати эртага тугайди</span></div>{/if}
        {#if yangiT.length}<div class="og bl"><b>{yangiT.length} та янги вазифа</b><span>очиб кўринг ва «Тушундим» деб белгиланг</span></div>{/if}
      </div>
    {/if}
    <div class="davr">
      {#each DAVR as [d, nom, kun] (d)}
        <button class="db" class:tan={davr === d} onclick={() => tanla(d)}>{nom}<span class="ds">{soni(kun)}</span></button>
      {/each}
    </div>
    <button class="db keng" class:tan={tarix} onclick={tarixOch}>📅 Сана бўйича — бажарган ишларим</button>
    {#if tarix}
      <div class="card tq">
        <label class="tl" for="ts">Қайси кунни кўрмоқчисиз?</label>
        <input id="ts" class="tsana" type="date" bind:value={sana} max={men.bugun} />
      </div>
      {#if tyuk}<div class="spin"></div>
      {:else if tro}
        <div class="tjami">
          <b>{sanaQ(sana)}</b>
          <span>{tro.jami.soni} та вазифа бажарилган</span>
          {#if tro.jami.bonus}<span class="ym">+{pul(tro.jami.bonus)} сўм бонус</span>{/if}
          {#if tro.jami.jarima}<span class="jm">−{pul(tro.jami.jarima)} сўм жарима</span>{/if}
        </div>
        {#each tro.cards as c (c.id)}
          <div class="card it" style="--c:{c.kechBajarildi ? 'var(--rd)' : 'var(--gr, #1F845A)'}">
            <button class="ib" onclick={() => och(c)}>
              <span class="ust"><b>{c.nom}</b><span class="hp" style="color:{c.kechBajarildi ? 'var(--rd)' : 'var(--gr, #1F845A)'}">{c.kechBajarildi ? "Кечикиб бажарилган" : "Ўз вақтида"}</span></span>
              <span class="od"><span class="av kich">{harf(c.yaratdiIsm)}</span><i>Кимдан</i><span>{c.yaratdiIsm}</span></span>
              <span class="pst">
                <span class="pill" style="--p:var(--muted)">Муддат: {muddatT(c, men.bugun).sana}</span>
                {#if c.bonus > 0}<span class="pill" style="--p:var(--gr, #1F845A)">+{pul(c.bonus)} сўм</span>{/if}
                {#if c.jarima > 0}<span class="pill" style="--p:var(--rd)">−{pul(c.jarima)} сўм</span>{/if}
                {#if c.soni && c.soni.fayl}<span class="pill" style="--p:var(--muted)">{c.soni.fayl} та расм</span>{/if}
              </span>
            </button>
          </div>
        {/each}
        {#if !tro.cards.length}<div class="muted bo">Бу куни бажарилган вазифа йўқ</div>{/if}
      {/if}
    {/if}
    {#if !davr}
      {#if !tarix}<div class="muted bo">Қайси вазифаларни кўрмоқчисиз?<br />Юқоридан <b>Кунлик</b>, <b>Ҳафталик</b> ёки <b>Ойлик</b>ни танланг.</div>{/if}
    {:else}
    {#each GURUH as [g, nom] (g)}
      {@const ro = korinadi.filter((c) => c.holat === g)}
      {#if ro.length}
        <div class="gs"><i class="nuq" style="background:{RANG[g]}"></i><b>{nom}</b><span class="son">{ro.length}</span></div>
        {#each ro as c (c.id)}
          {@const md = muddatT(c, men.bugun)}
          <div class="card it" class:kech={c.kech} style="--c:{c.kech ? 'var(--rd)' : RANG[g]}">
            <button class="ib" onclick={() => och(c)}>
              <span class="ust"><b>{c.nom}</b>{#if ogoh(c)}<span class="hp" style="color:{ogoh(c).rang};background:var(--soft)">{ogoh(c).matn}</span>{:else}<span class="hp">{nom}</span>{/if}</span>
              <span class="od"><span class="av kich">{harf(c.yaratdiIsm)}</span><i>Кимдан</i><span>{c.yaratdiIsm}</span></span>
              <span class="pst">
                <span class="pill" style="--p:{md.rang || 'var(--muted)'}"><Icon name="cal" size={14} />{md.sana}{md.izoh ? " · " + md.izoh : ""}</span>
                {#if c.jarima > 0}<span class="pill" style="--p:var(--rd)">{pul(c.jarima)} сўм</span>{/if}
              </span>
            </button>
          </div>
        {/each}
      {/if}
    {/each}
      {#if !korinadi.length}<div class="muted bo">{davrNom} вазифа йўқ</div>{/if}
    {/if}
  </div>
{/if}

{#if katta}<div class="katta" onclick={() => (katta = null)} onkeydown={(e) => e.key === "Escape" && (katta = null)} role="presentation"><img src={katta} alt="" /></div>{/if}

<style>
  .pb { padding-bottom: 96px; }
  .ogoh { display: flex; flex-direction: column; gap: 8px; padding: 4px 0 10px; }
  .og { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 10px; border-left: 4px solid var(--g); background: var(--soft); }
  .og b { font-size: 15px; color: var(--g); }
  .og span { font-size: 13px; line-height: 18px; color: var(--muted); }
  .og.rd { --g: var(--rd); }
  .og.or { --g: var(--or); }
  .og.am { --g: var(--amb); }
  .og.bl { --g: var(--acc, #3E8EDE); }
  .davr { display: flex; gap: 8px; padding: 4px 0 10px; }
  .db { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; padding: 0 8px;
    border: 1px solid var(--soft); border-radius: 10px; background: var(--card, var(--soft)); color: var(--ink); font-size: 14px; font-weight: 600; }
  .db .ds { min-width: 22px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--soft); color: var(--muted); font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
  .db.tan { background: var(--acc, #3E8EDE); border-color: var(--acc, #3E8EDE); color: #fff; }
  .db.tan .ds { background: rgba(255, 255, 255, .25); color: #fff; }
  .db.keng { width: 100%; margin-bottom: 10px; }
  .tq { padding: 12px 14px; margin-bottom: 10px; }
  .tl { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
  .tsana { width: 100%; height: 44px; padding: 0 12px; border: 1px solid var(--soft); border-radius: 10px; background: var(--card, #fff); color: var(--ink); font-size: 16px; }
  .tjami { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 4px 4px 10px; font-size: 14px; color: var(--muted); }
  .tjami b { font-size: 16px; color: var(--ink); }
  .tjami .ym { color: var(--gr, #1F845A); font-weight: 700; }
  .tjami .jm { color: var(--rd); font-weight: 700; }
  .gs { display: flex; align-items: center; gap: 8px; padding: 6px 4px 0; font-size: 15px; }
  .gs .nuq { width: 10px; height: 10px; border-radius: 5px; }
  .gs .son { margin-left: auto; min-width: 26px; height: 22px; padding: 0 8px; border-radius: 11px; background: var(--soft); color: var(--muted); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .it { gap: 12px; padding: 14px 16px 14px 18px; border-left: 4px solid var(--c); }
  .it.kech { border-color: var(--rd); }
  .ib { display: flex; flex-direction: column; gap: 8px; background: none; border: 0; padding: 0; text-align: left; color: var(--ink); }
  .ust { display: flex; align-items: flex-start; gap: 10px; }
  .ust b { flex: 1; font-size: 16px; line-height: 1.3; }
  .hp { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 10px; color: var(--c); background: var(--soft); }
  .od { display: flex; align-items: center; gap: 8px; font-size: 14px; }
  .od i { font-style: normal; color: var(--muted); width: 54px; }
  .av.kich { width: 24px; height: 24px; font-size: 11px; }
  .pst { display: flex; gap: 8px; flex-wrap: wrap; }
  .pill { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 14px; font-size: 13px; font-weight: 600; color: var(--p); background: var(--soft); }
  .bo { text-align: center; padding: 24px 0; }
  .katta { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, .92); display: flex; align-items: center; justify-content: center; padding: 12px; }
  .katta img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; }
</style>
