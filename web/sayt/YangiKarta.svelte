<script>
  // ➕ Вазифа бериш (модал): вазифа, ходим, муддат (мажбурий) · тавсиф, белгилар, расм (ихтиёрий)
  import { onMount } from "svelte";
  import { api } from "./api.js";
  import { toshkentBugun, kunQosh, siq, MUHIMLIK, muhimlikRo } from "./util.js";
  import OdamTanla from "./OdamTanla.svelte";
  let { men, xabar, boardId = null, listId = null, onclose, ondone } = $props();
  const bugun = toshkentBugun();
  let nom = $state(""), tavsif = $state(""), muddat = $state(kunQosh(bugun, 1));
  let muhim = $state("medium"), boshlanish = $state("");
  let fayllar = $state([]), kor = $state([]), xato = $state(""), yuk = $state(false), board = $state(boardId), ochiqOdam = $state(false);
  // Бажарувчилар: 1 тадан 3 тагача ходим (рўйхатдан белгиланади)
  let kimlar = $state([]);
  onMount(async () => {
    try {
      if (!board) board = (await api("/boards")).boards[0].id;
    } catch (e) { xato = e.message; }
  });
  async function faylQosh(e) {
    const tan = [...(e.target.files || [])].slice(0, 6 - fayllar.length); e.target.value = "";
    const y = await Promise.all(tan.map((f) => siq(f)));
    fayllar = [...fayllar, ...y]; kor = [...kor, ...y.map((f) => (/^image\//.test(f.type) ? URL.createObjectURL(f) : null))];
  }
  function olib(i) { if (kor[i]) URL.revokeObjectURL(kor[i]); fayllar = fayllar.filter((_, j) => j !== i); kor = kor.filter((_, j) => j !== i); }
  async function yubor(e) {
    e.preventDefault();
    xato = !nom.trim() ? "Вазифа номини ёзинг"
      : !kimlar.length ? "Бажарувчини танланг"
      : !muddat || muddat < bugun ? "Тугаш санасини танланг"
      : "";
    if (xato) return;
    yuk = true;
    try {
      await api(`/boards/${board}/cards`, { method: "POST", fayllar, body: { nom, tavsif, kimga: kimlar[0].id, ijrochilar: kimlar.slice(1).map((x) => x.id), muddat, boshlanish, muhim, ...(listId ? { list_id: listId } : {}) } });
      xabar(`Вазифа ${kimlar.map((x) => x.ism).join(", ")}га берилди ✓`); ondone();
    } catch (er) { xato = er.message; }
    yuk = false;
  }
</script>

<div class="qoplama" onclick={onclose} onkeydown={(e) => e.key === "Escape" && onclose()} role="presentation">
  <form class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} onsubmit={yubor} role="dialog" tabindex="-1">
    <div class="sar"><h2>Вазифа бериш</h2><button type="button" class="tugma shaffof yop" onclick={onclose}>✕</button></div>
    <div class="ikki">
      <div><label class="yorliq" for="yn">1. Қандай вазифа? *</label>
        <input id="yn" class="maydon" bind:value={nom} maxlength="140" autocomplete="off" />
      </div>
      <div><span class="yorliq">2. Кимга? *</span><OdamTanla kop bind:kopTanlandi={kimlar} bind:ochiq={ochiqOdam} /></div>
    </div>
    <div class="ikki">
      <div><label class="yorliq" for="yb">3. Қачондан бошланади?</label>
        <input id="yb" class="maydon" type="date" bind:value={boshlanish} max={muddat} />
      </div>
      <div><label class="yorliq" for="ym">4. Қачонгача тугайди? *</label>
        <input id="ym" class="maydon" type="date" bind:value={muddat} min={bugun} />
      </div>
    </div>
    <span class="yorliq">5. Қандай бажарилсин? *</span>
    <div class="muhim">
      {#each muhimlikRo as mk2 (mk2)}
        <button type="button" class="mb" class:tan={muhim === mk2} style:--mr={MUHIMLIK[mk2].rang} onclick={() => (muhim = mk2)}>
          <i></i>{MUHIMLIK[mk2].nom}
        </button>
      {/each}
    </div>
    <div class="ikki tr">
      <div>
        <label class="yorliq" for="yt">6. Тавсиф — вазифа нимадан иборат?</label>
        <textarea id="yt" class="maydon" bind:value={tavsif} maxlength="4000" autocomplete="off"></textarea>
      </div>
      <div>
        <span class="yorliq">7. Расм</span>
        <div class="fy">
          {#each fayllar as f, i (i + f.name)}
            <div class="pv">{#if kor[i]}<img src={kor[i]} alt="" />{:else}<span>{f.name}</span>{/if}<button type="button" onclick={() => olib(i)}>✕</button></div>
          {/each}
          {#if fayllar.length < 6}<label class="qosh">+ Қўшиш<input type="file" hidden multiple accept="image/jpeg,image/png,image/webp,application/pdf,.xlsx,.docx" onchange={faylQosh} /></label>{/if}
        </div>
      </div>
    </div>
    {#if xato}<div class="xato">{xato}</div>{/if}
    <div class="past"><button type="button" class="tugma" onclick={onclose}>Бекор</button><button class="tugma asosiy" disabled={yuk}>{yuk ? "Юборилмоқда…" : "Вазифа бериш"}</button></div>
  </form>
</div>

<style>
  .qoplama { position: fixed; inset: 0; background: #0304047a; display: flex; align-items: flex-start; justify-content: center; padding: 48px 16px; overflow-y: auto; z-index: 100; }
  .modal { width: 100%; max-width: 760px; background: var(--surf2); border-radius: 12px; padding: 24px 32px 24px; display: flex; flex-direction: column; gap: 18px; box-shadow: var(--shadow2); }
  .sar { display: flex; align-items: center; justify-content: space-between; padding-bottom: 6px; border-bottom: 1px solid var(--ajr); }
  h2 { margin: 0; font-size: 21px; }
  .yop { width: 32px; padding: 0; }
  .yorliq { margin-bottom: 8px; }
  .fy { margin-top: 2px; }
  .ikki { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .ikki.tr { align-items: start; }
  .ikki.tr textarea.maydon { min-height: 92px; }
  .muhim { display: flex; flex-wrap: nowrap; gap: 10px; }
  .mb { flex: 1 1 0; min-width: 0; justify-content: center; }
  .mb { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border: 1px solid var(--ajr); border-radius: 8px;
    background: var(--hover); color: var(--ink); font-size: 13px; }
  .mb i { width: 8px; height: 8px; border-radius: 50%; background: var(--mr); }
  .mb.tan { background: var(--brandsoft); color: var(--brand); border-color: var(--brand); font-weight: 600; }
  .fy { display: flex; gap: 8px; flex-wrap: wrap; }
  .pv { position: relative; width: 88px; height: 64px; border-radius: 6px; overflow: hidden; background: var(--list); font-size: 13px; display: flex; align-items: center; justify-content: center; padding: 4px; text-align: center; }
  .pv img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .pv button { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border-radius: 8px; border: 0; background: #0009; color: #fff; font-size: 13px; padding: 0; }
  .qosh { width: 88px; height: 64px; border-radius: 6px; border: 2px dashed var(--line); display: flex; align-items: center; justify-content: center; font-size: 15px; color: var(--muted); cursor: pointer; }
  .past { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; padding-top: 18px; border-top: 1px solid var(--ajr); }
  @media (max-width: 700px) {
    .modal { padding: 20px 18px; gap: 14px; }
    .ikki { grid-template-columns: 1fr; gap: 14px; }
    .muhim { flex-wrap: wrap; }
  }
</style>
