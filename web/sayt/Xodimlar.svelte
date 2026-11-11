<script>
  // 👥 Ходимлар — кимда нечта иш бор: очиқ · кечиккан · бугун · бажарди (ой) · жарима (ой)
  import { onMount } from "svelte";
  import { api } from "./api.js";
  import { harf, avatarRang, pul } from "./util.js";
  import Ikon from "./Ikon.svelte";
  let { men, xabar, tor = false } = $props();
  let d = $state(null), azolar = $state([]), ochiq = $state(null), tarifY = $state(""), bolimY = $state("");
  let sonKor = $state(false);                 // сарлавҳа босилса — нечта ходим, нечта иш
  const BOLIMLAR = { buxgalter: "Бухгалтер", dasturchi: "Дастурчи", gruzchik: "Грузчик", sotuvchi: "Сотувчи", haydovchi: "Ҳайдовчи", boshqa: "Бошқа" };
  async function yukla() {
    try { d = await api("/xodimlar"); } catch (e) { xabar(e.message, true); }
    try { azolar = (await api("/azolar")).azolar; } catch { azolar = []; }
  }
  const azo = (id) => azolar.find((a) => a.id === id) || {};
  async function saqla(id) {
    const b = {};
    if (tarifY !== "") b.tarif = Math.round(Number(tarifY) || 0);
    if (bolimY !== "") b.bolim = bolimY;
    if (!Object.keys(b).length) { ochiq = null; return; }
    try { await api("/azolar/" + id, { method: "PUT", body: b }); xabar("Сақланди ✓"); ochiq = null; yukla(); }
    catch (e) { xabar(e.message, true); }
  }
  async function faolAlmash(a) {
    try { await api("/azolar/" + a.id, { method: "PUT", body: { faol: !a.faol } }); xabar(a.faol ? "Ходим чиқарилди" : "Ходим қайтарилди ✓"); yukla(); }
    catch (e) { xabar(e.message, true); }
  }
  const tashqi = () => yukla();
  onMount(() => { yukla(); window.addEventListener("ish-yangila", tashqi); return () => window.removeEventListener("ish-yangila", tashqi); });
  const jami = $derived(d ? d.xodimlar.reduce((s, x) => ({ ochiq: s.ochiq + x.ochiq, kech: s.kech + x.kech, jarima: s.jarima + x.jarima, bonus: s.bonus + (x.bonus || 0) }), { ochiq: 0, kech: 0, jarima: 0, bonus: 0 }) : null);
</script>

<div class="ich" class:tor>
  <div class="sar">
    <button class="sarb" onclick={() => (sonKor = !sonKor)} title="Сонини кўрсатиш">Ходимлар</button>
    {#if sonKor && jami}<span class="jami">{d.xodimlar.length} та ходим · {jami.ochiq} та иш</span>{/if}
  </div>
  {#if !d}<div class="aylana"></div>
  {:else}
    <div class="ro">
      {#each d.xodimlar as x (x.id)}
        {@const r = avatarRang(x.ism)}
        <div class="qator">
          <span class="avatar" style="background:{r[0]};color:{r[1]}">{harf(x.ism)}</span>
          <span class="mt">
            <b>{x.ism}</b>
            {#if x.ochiq || x.bugun}<small>{#if x.ochiq}{x.ochiq} та бажарилмаган{/if}{#if x.ochiq && x.bugun}{" · "}{/if}{#if x.bugun}бугун {x.bugun} та{/if}</small>{/if}
            {#if x.bajardi}<small>шу ойда {x.bajardi} та бажарди</small>{/if}
          </span>
          <span class="ong">
            {#if x.kech}<span class="nishon kech">{x.kech} та кечикди</span>{/if}
            {#if x.bonus > 0}<span class="bn">+{pul(x.bonus)}</span>{/if}{#if x.jarima > 0}<span class="jr">−{pul(x.jarima)}</span>{/if}
            {#if men.owner}
              <button class="tugma shaffof sz" title="Созлаш" onclick={() => { ochiq = ochiq === x.id ? null : x.id; tarifY = String(azo(x.id).tarif ?? ""); bolimY = azo(x.id).bolim || ""; }}><Ikon nom="nuqta" k={16} /></button>
            {/if}
          </span>
        </div>
        {#if ochiq === x.id}
          <div class="sozla">
            <div class="qt2"><span class="yorliq">Кунлик жарима тарифи (сўм)</span>
              <input class="maydon" type="number" min="0" step="1000" bind:value={tarifY} /></div>
            <div class="qt2"><span class="yorliq">Бўлими</span>
              <select class="maydon" bind:value={bolimY}><option value="">—</option>{#each Object.entries(BOLIMLAR) as [kd, nm] (kd)}<option value={kd}>{nm}</option>{/each}</select></div>
            <div class="tug">
              <button class="tugma asosiy" onclick={() => saqla(x.id)}>Сақлаш</button>
              <button class="tugma xavf" onclick={() => faolAlmash(azo(x.id))}>{azo(x.id).faol === false ? "Қайтариш" : "Рўйхатдан чиқариш"}</button>
              <button class="tugma" onclick={() => (ochiq = null)}>Бекор</button>
            </div>
          </div>
        {/if}
      {/each}
    </div>
    {#if jami && (jami.kech || jami.jarima || jami.bonus)}
      <div class="yakun">Жами: {jami.kech} та кечиккан вазифа{#if jami.jarima}{" · "}{pul(jami.jarima)} сўм жарима{/if}{#if jami.bonus}{" · "}{pul(jami.bonus)} сўм бонус{/if}</div>
    {/if}
  {/if}
</div>

<style>
  .ich { max-width: 760px; width: 100%; margin: 0 auto; padding: 24px; }
  .ich.tor { max-width: none; padding: 0 0 80px; }
  .sar { display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 12px; }
  .tor .sar { position: sticky; top: 0; z-index: 2; background: var(--surf); border-bottom: 1px solid var(--ajr); height: auto; min-height: 56px; flex-wrap: wrap; align-content: center; gap: 0 8px; padding: 8px 12px; }
  .jami { font-size: 13px; color: var(--muted); white-space: nowrap; }
  .sarb { border: 0; background: none; padding: 0; margin: 0; color: var(--ink); font-size: 17px; font-weight: 653; line-height: 24px; cursor: pointer; }
  .sarb:hover { color: var(--brand); }
  .ro { padding: 8px 12px; }
  .qator { display: flex; align-items: center; gap: 8px; padding: 10px 8px; border-radius: 8px; flex-wrap: wrap; }
  .qator { border-bottom: 1px solid var(--ajr); border-radius: 0; }
  .qator:hover { background: var(--hover); }
  .mt { display: flex; flex-direction: column; min-width: 0; flex: 1 1 120px; }
  .mt b { font-size: 15px; font-weight: 500; }
  .mt small { font-size: 13px; color: var(--muted); line-height: 18px; }
  .ong { display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: auto; }
  .jr { font-size: 13px; font-weight: 600; color: var(--rdt); }
  .bn { font-size: 13px; font-weight: 600; color: var(--gr); }
  .sz { width: 28px; padding: 0; }
  .sozla { display: flex; flex-direction: column; gap: 8px; padding: 12px; margin: 0 0 8px; background: var(--hover); border: 1px solid var(--ajr); border-radius: 8px; }
  .qt2 { display: flex; flex-direction: column; gap: 4px; }
  .tug { display: flex; gap: 6px; flex-wrap: wrap; }
  .yakun { padding: 12px; font-size: 13px; color: var(--muted); border-top: 1px solid var(--line); margin: 8px 12px 0; }
</style>
