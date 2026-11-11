<script>
  // Ходимни танлаш: қидирув + рўйхат (лотин/кирилл фарқи йўқ).
  //   bind:tanlandi = { id, ism }            — битта ходим
  //   kop={true} + bind:kopTanlandi = [...]  — бир нечта ходим (кўпи билан `maks` та)
  import { onMount } from "svelte";
  import { api } from "./api.js";
  import { mos, harf, avatarRang } from "./util.js";
  let { tanlandi = $bindable(null), kopTanlandi = $bindable([]), ochiq = $bindable(false), kop = false } = $props();
  let ro = $state(null), qidir = $state(""), inp = $state(null);
  onMount(() => api("/odamlar").then((r) => (ro = r.odamlar)).catch(() => (ro = [])));
  const kor = $derived(ro ? ro.filter((o) => mos(o.ism + " " + (o.bolim || ""), qidir)) : []);
  $effect(() => { if (ochiq && inp) inp.focus(); });
  const bormi = (id) => kopTanlandi.some((x) => x.id === id);
  function belgila(o) {
    if (bormi(o.id)) kopTanlandi = kopTanlandi.filter((x) => x.id !== o.id);
    else kopTanlandi = [...kopTanlandi, { id: o.id, ism: o.ism }];
  }
</script>

<div class="ot">
  <button type="button" class="tanlov" onclick={() => (ochiq = !ochiq)}>
    {#if kop}
      {#if kopTanlandi.length}
        <span class="chiplar">{#each kopTanlandi as t (t.id)}{@const r = avatarRang(t.ism)}<span class="chip"><span class="avatar" style="background:{r[0]};color:{r[1]}">{harf(t.ism)}</span>{t.ism}</span>{/each}</span>
      {:else}<span class="bosh">Бажарувчиларни танланг</span>{/if}
    {:else if tanlandi}
      {@const r = avatarRang(tanlandi.ism)}<span class="avatar" style="background:{r[0]};color:{r[1]}">{harf(tanlandi.ism)}</span><b>{tanlandi.ism}</b>
    {:else}<span class="bosh">Бажарувчини танланг</span>{/if}
    <span class="ok">▾</span>
  </button>
  {#if ochiq}
    <div class="menyu">
      <input bind:this={inp} class="maydon" bind:value={qidir} placeholder="Исм бўйича қидириш…" autocomplete="off" />
      <div class="ro">
        {#if !ro}<div class="bosh" style="padding:8px">Юкланмоқда…</div>{/if}
        {#each kor as o (o.id)}
          {@const r = avatarRang(o.ism)}
          {#if kop}
            <button type="button" class="od" class:on={bormi(o.id)} onclick={() => belgila(o)}>
              <span class="bl" class:tan={bormi(o.id)}>{bormi(o.id) ? "✓" : ""}</span>
              <span class="avatar" style="background:{r[0]};color:{r[1]}">{harf(o.ism)}</span><span class="m"><b>{o.ism}</b>{#if o.bolim}<small>{o.bolim}</small>{/if}</span>
            </button>
          {:else}
            <button type="button" class="od" class:on={tanlandi && tanlandi.id === o.id} onclick={() => { tanlandi = o; ochiq = false; qidir = ""; }}>
              <span class="avatar" style="background:{r[0]};color:{r[1]}">{harf(o.ism)}</span><span class="m"><b>{o.ism}</b>{#if o.bolim}<small>{o.bolim}</small>{/if}</span>
            </button>
          {/if}
        {/each}
        {#if ro && !kor.length}<div class="bosh" style="padding:8px">Топилмади</div>{/if}
      </div>
      {#if kop}<button type="button" class="tugma asosiy keng" onclick={() => { ochiq = false; qidir = ""; }}>Ёпиш{#if kopTanlandi.length}{" · "}{kopTanlandi.length} та танланди{/if}</button>{/if}
    </div>
  {/if}
</div>

<style>
  .ot { position: relative; }
  .tanlov { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 4px 10px; border: 2px solid var(--line); border-radius: 4px; background: var(--surf); text-align: left; font-size: 15px; }
  .tanlov:hover { border-color: #091e4240; }
  .bosh { color: var(--muted); }
  .ok { margin-left: auto; color: var(--muted); }
  .chiplar { display: flex; flex-wrap: wrap; gap: 4px; min-width: 0; }
  .chip { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 8px 0 2px; border-radius: 13px; background: var(--hover); font-size: 14px; }
  .chip .avatar { width: 22px; height: 22px; font-size: 12px; }
  .menyu { position: absolute; left: 0; right: 0; top: calc(100% + 4px); background: var(--surf2); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow2); padding: 8px; z-index: 30; }
  .ro { max-height: 260px; overflow-y: auto; margin-top: 6px; display: flex; flex-direction: column; }
  .od { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border: 0; border-radius: 4px; background: transparent; text-align: left; }
  .od:hover, .od.on { background: var(--brandsoft); }
  .od .m { display: flex; flex-direction: column; font-size: 15px; }
  .od small { color: var(--muted); font-size: 13px; }
  .bl { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; flex-shrink: 0; border: 2px solid var(--line); border-radius: 4px; font-size: 13px; font-weight: 700; }
  .bl.tan { background: var(--brand); border-color: var(--brand); color: #fff; }
  .keng { width: 100%; margin-top: 8px; }
</style>
