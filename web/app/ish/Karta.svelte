<script>
  // Вазифа (ходим): ҳолат · вазифа · расмлар · кимдан, муддат · «Тушундим» → изоҳ (+ расм) билан «Бажардим».
  // Архив, ўчириш, жарима — фақат сайтда (Сардор ака, Мурод ака). Ҳуқуқни сервер текширади.
  import { onMount } from "svelte";
  import { ish, vaqtQ, faylUrl, muddatT } from "./ishapi.js";
  import { haptic } from "../lib/tg.js";
  import { pul, sanaQ } from "../lib/format.js";
  import Rasm from "./Rasm.svelte";
  import FaylTanla from "./FaylTanla.svelte";
  import Icon from "../lib/Icon.svelte";
  let { id, men, xabar, onclose, onchange, onrasm, bajarsin = false } = $props();

  let d = $state(null), xato = $state(""), band = $state(false), matn = $state(""), fayllar = $state([]);
  const yukla = () => ish("/cards/" + id).then((r) => { d = r; xato = ""; }).catch((e) => (xato = e.message));
  onMount(yukla);
  const v = $derived(d && d.card);
  const holat = $derived(!d || !v ? "" : v.list_tur === "done" ? "bajarildi" : d.lists.filter((l) => l.tur !== "done")[0]?.id === v.list_id ? "yangi" : "jarayon");
  const HOLAT = { yangi: "Янги", jarayon: "Жараёнда", bajarildi: "Бажарилди" };
  const meniki = $derived(!!v && (v.ijro || []).some((u) => u.id === men.uid));
  // Зарурлик: ходимга қандай бажариш кераклигини кўрсатади
  const MUHIM = {
    urgent: { nom: "Зудлик билан", rang: "var(--rd)" },
    high: { nom: "Тезроқ", rang: "var(--amb)" },
    medium: { nom: "Сифат билан", rang: "var(--gr, #1F845A)" },
    low: { nom: "Сифат билан", rang: "var(--gr, #1F845A)" },
  };
  const rasmlar = $derived(d ? d.fayllar.filter((f) => f.rasm) : []);

  async function holatQoy(h, ok, body = {}, fl = []) {
    if (h === "bajarildi" && !fl.length) { xabar("Бажарганингизни расм билан кўрсатинг", true); return; }   // изоҳ — ихтиёрий
    band = true;
    try {
      await ish(`/cards/${id}/kochir`, { method: "POST", body: { holat: h, ver: v.ver, ...body }, fayllar: fl });
      haptic("medium"); xabar(ok); matn = ""; fayllar = [];
      await yukla(); onchange();
    } catch (e) { xabar(e.message, true); if (e.status === 409) await yukla(); }
    band = false;
  }
</script>

<div class="body sahifa">
    <button class="chip" style="align-self:flex-start" onclick={onclose}><Icon name="back" size={14} />Орқага</button>
    {#if xato}
      <div class="note rd">{xato}</div>
    {:else if !v}
      <div class="spin"></div>
    {:else}
      {@const md = muddatT(v, men.bugun)}
      {@const qi = ["yangi", "jarayon", "bajarildi"].indexOf(holat)}
      <div class="qad">
        {#each ["Янги", "Жараёнда", "Бажарилди"] as n, i (n)}
          <div class="qd" class:otdi={i < qi} class:hozir={i === qi}><span class="dr">{i < qi ? "✓" : i + 1}</span><small>{n}</small></div>
          {#if i < 2}<i class="ch" class:otdi={i < qi}></i>{/if}
        {/each}
      </div>
      <div class="card vz">
        <span class="lb">Вазифа</span>
        <h2>{v.nom}</h2>
        {#if v.tavsif}<div class="tv">{v.tavsif}</div>{/if}
      </div>
      {#if rasmlar.length}<div class="gal">{#each rasmlar as f (f.id)}<Rasm id={f.id} h={140} w={rasmlar.length === 1 ? null : 170} onclick={onrasm} />{/each}</div>{/if}
      <div class="card list">
        <div class="row"><span class="l">Ким берди</span><span class="v">{v.yaratdiIsm}</span></div>
        <div class="row"><span class="l">Берилган сана</span><span class="v">{sanaQ(v.vaqt)}</span></div>
        <div class="row"><span class="l">Тугатиш санаси</span><span class="v" style:color={md.rang || null}>{md.sana}{md.izoh ? " · " + md.izoh : ""}</span></div>
        <div class="row"><span class="l">Зарурлиги</span><span class="v" style="color:{(MUHIM[v.muhim] || MUHIM.medium).rang}">{(MUHIM[v.muhim] || MUHIM.medium).nom}</span></div>
        {#if v.jarima > 0}<div class="row"><span class="l">Жарима</span><span class="v" style="color:var(--rd)">{pul(v.jarima)} сўм</span></div>{/if}
      </div>

      {#if d.izohlar.length}
        {#each d.izohlar as z (z.id)}
          <div class="card jv">
            <div class="row"><b>{z.ism}</b><span class="muted">{vaqtQ(z.vaqt)}</span></div>
            {#if z.matn}<div class="tv">{z.matn}</div>{/if}
            {#if z.fayllar.length}<div class="gal">{#each z.fayllar.filter((f) => f.rasm) as f (f.id)}<Rasm id={f.id} h={110} w={110} onclick={onrasm} />{/each}</div>{/if}
          </div>
        {/each}
      {/if}

      <!-- Ходим: ўқийди → «Тушундим» (1 марта); кейин изоҳ (+ расм) → «Бажардим» (1 марта) -->
      {#if meniki && holat === "yangi"}
        <button class="btn" disabled={band} onclick={() => holatQoy("jarayon", "Жараёнда ✓")}>Тушундим</button>
      {:else if meniki && holat === "jarayon"}
        <FaylTanla bind:fayllar yozuv="Расм *" />
        <div class="field"><label for="bm">Изоҳ (ихтиёрий)</label><textarea id="bm" name="ish-javob" class="ta" bind:value={matn} maxlength="2000" autocomplete="off"></textarea></div>
        <button class="btn green" disabled={band || !fayllar.length} onclick={() => holatQoy("bajarildi", "Юборилди ✓", { matn }, fayllar)}>Бажардим</button>
      {/if}
    {/if}
</div>

<style>
  .sahifa { padding-bottom: 96px; }
  .tv { font-size: 15px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
  .gal { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; flex-shrink: 0; }
  .jv { gap: 8px; }
  .vz { gap: 6px; }
  .vz h2 { margin: 0; font-size: 20px; line-height: 1.3; }
  .lb { font-size: 12px; font-weight: 700; color: var(--muted); }
  .qad { display: flex; align-items: flex-start; padding: 2px 0 4px; }
  .qd { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 80px; color: var(--muted); flex-shrink: 0; }
  .qd small { font-size: 12px; font-weight: 600; }
  .dr { width: 30px; height: 30px; border-radius: 15px; border: 2px solid var(--off); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; background: var(--surf); }
  .qd.otdi .dr { background: var(--gr); border-color: var(--gr); color: #fff; }
  .qd.hozir .dr { background: var(--or); border-color: var(--or); color: #fff; }
  .qd.hozir small { color: var(--ink); }
  .ch { flex: 1; height: 2px; margin-top: 15px; background: var(--off); }
  .ch.otdi { background: var(--gr); }
</style>
