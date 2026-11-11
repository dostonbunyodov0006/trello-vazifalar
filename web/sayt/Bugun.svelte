<script>
  // 📅 Бугун — раҳбар эрталаб очадиган панел: кечиккан · бугун тугайди · эртага
  import { onMount } from "svelte";
  import { api } from "./api.js";
  import { sanaT, harf, avatarRang, pul } from "./util.js";
  import Ikon from "./Ikon.svelte";
  let { men, xabar, tor = false } = $props();
  let d = $state(null);
  async function yukla() { try { d = await api("/bugun"); } catch (e) { xabar(e.message, true); } }
  const tashqi = () => yukla();
  onMount(() => { yukla(); window.addEventListener("ish-yangila", tashqi); return () => window.removeEventListener("ish-yangila", tashqi); });
  let kor = $state("hammasi");
  const BOLIM = [
    ["kech", "Кечиккан", "kech"],
    ["shu", "Бугун тугайди", "yaqin"],
    ["ertaga", "Эртага тугайди", ""],
  ];
</script>

<div class="ich" class:tor>
  <div class="sar"><h2>Бугун</h2>{#if d}<span class="jami">{d.kech.length + d.shu.length + d.ertaga.length} та</span>{/if}</div>
  {#if d}
    <div class="tablar">
      <button class="tb" class:on={kor === "hammasi"} onclick={() => (kor = "hammasi")}>Ҳаммаси</button>
      <button class="tb" class:on={kor === "kech"} onclick={() => (kor = "kech")}>Кечиккан {d.kech.length}</button>
      <button class="tb" class:on={kor === "shu"} onclick={() => (kor = "shu")}>Бугун {d.shu.length}</button>
      <button class="tb" class:on={kor === "ertaga"} onclick={() => (kor = "ertaga")}>Эртага {d.ertaga.length}</button>
    </div>
  {/if}
  {#if !d}<div class="aylana"></div>
  {:else}
    {#each BOLIM as [kalit, nomi, tur] (kalit)}
      {#if d[kalit].length && (kor === "hammasi" || kor === kalit)}
        <div class="blk">
          <h3 class="b{tur}"><Ikon nom="soat" k={14} /> {nomi} <b>{d[kalit].length}</b></h3>
          {#each d[kalit] as c (c.id)}
            {@const r = avatarRang(c.kimgaIsm)}
            <a class="qator" href="#/b/{c.board_id}/c/{c.id}">
              <span class="avatar" style="background:{r[0]};color:{r[1]}" title={c.kimgaIsm}>{harf(c.kimgaIsm)}</span>
              <span class="mt"><b>{c.nom}</b><small>{c.kimgaIsm} · {sanaT(c.muddat)}{#if c.jarima > 0}{" · "}<span class="qz">{pul(c.jarima)} сўм</span>{/if}</small></span>
            </a>
          {/each}
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .ich { max-width: 760px; width: 100%; margin: 0 auto; padding: 24px; }
  .ich.tor { max-width: none; padding: 0 0 80px; }
  .sar { display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 12px; }
  .tor .sar { position: sticky; top: 0; z-index: 2; background: var(--surf); border-bottom: 1px solid var(--ajr); }
  h2 { margin: 0; font-size: 17px; font-weight: 653; white-space: nowrap; }
  .jami { font-size: 13px; color: var(--muted); }
  /* 2x2: Ҳаммаси | Кечиккан · Бугун | Эртага (Достон 2026-10-08) */
  .tablar { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--ajr); }
  .tb { height: 32px; padding: 0 10px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; border: 1px solid var(--ajr); border-radius: 6px; background: var(--hover); color: var(--ink); font-size: 13px; }
  .tb.on { background: var(--brandsoft); color: var(--brand); border-color: var(--brand); font-weight: 600; }
  .blk { padding: 12px 12px 4px; }
  h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 13px; font-weight: 653; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
  h3 b { margin-left: auto; font-size: 13px; }
  h3.bkech { color: var(--rdt); }
  h3.byaqin { color: #B38600; }
  .qator { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; text-decoration: none; color: var(--ink); }
  .qator { border-bottom: 1px solid var(--ajr); border-radius: 0; }
  .qator:hover { background: var(--hover); }
  .mt { display: flex; flex-direction: column; min-width: 0; }
  .mt b { font-size: 15px; font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mt small { font-size: 13px; color: var(--muted); }
  .qz { color: var(--rdt); }
  .bo { text-align: center; color: var(--muted); padding: 40px 16px; }
</style>
