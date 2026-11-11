<script>
  // Архив ва Жарималар — ой бўйича жадвал
  import { api } from "./api.js";
  import { sanaT, vaqtT, pul, harf, avatarRang, toshkentBugun } from "./util.js";
  import Ikon from "./Ikon.svelte";
  let { tur, men, xabar, tor = false } = $props();
  const OY = ["Январ", "Феврал", "Март", "Апрел", "Май", "Июн", "Июл", "Август", "Сентябр", "Октябр", "Ноябр", "Декабр"];
  const joriy = toshkentBugun().slice(0, 7);
  let oy = $state(joriy), d = $state(null), sahifa = $state(0), tahrir = $state(null), summa = $state("");
  const oyQosh = (o, n) => { const [y, m] = o.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
  const oyNom = (o) => { const [y, m] = o.split("-"); return `${OY[+m - 1]} ${y}`; };
  async function yukla(qosh = false) {
    try {
      const r = await api(tur === "jarima" ? `/jarima?oy=${oy}` : `/qidir?holat=arxiv&oy=${oy}&sahifa=${sahifa}`);
      d = qosh && d ? { ...r, cards: [...d.cards, ...r.cards] } : r;
    } catch (e) { xabar(e.message, true); }
  }
  $effect(() => { oy; sahifa = 0; d = null; yukla(); });
  async function tikla(c) { try { await api(`/cards/${c.id}/arxiv`, { method: "POST", body: { arxiv: false } }); xabar("Архивдан қайтди ✓"); yukla(); } catch (e) { xabar(e.message, true); } }
  async function ochir(c) { try { await api("/cards/" + c.id, { method: "DELETE" }); xabar("Вазифа ўчирилди ✓"); yukla(); } catch (e) { xabar(e.message, true); } }
  async function jarimaSaqla(c) {
    try { await api(`/cards/${c.id}/jarima`, { method: "POST", body: { summa: Math.round(Number(summa) || 0) } });
      xabar(Number(summa) > 0 ? "Жарима ўзгарди ✓" : "Жарима олиб ташланди ✓"); tahrir = null; yukla(); }
    catch (e) { xabar(e.message, true); }
  }
</script>

<div class="ich" class:tor={tor}>
  <div class="sar">
    <h2>{tur === "jarima" ? "Жарималар" : "Архив"}</h2>
    <div class="oy"><button class="tugma" onclick={() => (oy = oyQosh(oy, -1))}>‹</button><b>{oyNom(oy)}</b><button class="tugma" disabled={oy >= joriy} onclick={() => (oy = oyQosh(oy, 1))}>›</button></div>
  </div>
  {#if !d}<div class="aylana"></div>
  {:else if tur === "jarima"}
    {#if d.cards.length || (d.bonusCards || []).length}
      <div class="jami">Шу ойдаги жами жарима: <b>{pul(d.jami)} сўм</b></div>
      <a class="tugma excel" href="/api/ish/hisobot.xlsx?oy={oy}" download>
        <Ikon nom="ilova" /> Excel'га юклаб олиш
      </a>
    {/if}
    {#if d.xodimlar.length}
      <table><thead><tr><th>Бажарувчи</th>{#if !tor}<th>Вазифа</th><th>Кечикди</th>{/if}<th class="o">Жарима</th></tr></thead><tbody>
        {#each d.xodimlar as x (x.id)}{@const r = avatarRang(x.ism)}<tr><td><span class="od"><span class="avatar" style="background:{r[0]};color:{r[1]}">{harf(x.ism)}</span><span class="nm">{x.ism}{#if tor}<small>{x.soni} та · {x.kun} кун</small>{/if}</span></span></td>{#if !tor}<td>{x.soni} та</td><td>{x.kun} кун</td>{/if}<td class="o q">{pul(x.summa)}{#if !tor}{" сўм"}{/if}</td></tr>{/each}
      </tbody></table>
      <h3>Вазифалар рўйхати</h3>
      <table><thead><tr><th>Вазифа</th>{#if !tor}<th>Бажарувчи</th><th>Муддат</th>{/if}<th class="o">Жарима</th>{#if !tor}<th></th>{/if}</tr></thead><tbody>
        {#each d.cards as c (c.id)}<tr>
          <td><a href="#/b/{c.board_id}/c/{c.id}" class="nm"><span class="nmt">{c.nom}</span>{#if tor}<small>{c.kimgaIsm} · {sanaT(c.muddat)}</small>{/if}</a></td>
          {#if !tor}<td>{c.kimgaIsm}</td><td>{sanaT(c.muddat)}</td>{/if}
          {#if tahrir === c.id}
            <td class="o amal"><input class="maydon jm" type="number" min="0" step="1000" bind:value={summa} /><span class="tg"><button class="tugma kch" onclick={() => jarimaSaqla(c)}>Сақлаш</button><button class="tugma shaffof kch" onclick={() => (tahrir = null)}>✕</button></span></td>
            {#if !tor}<td class="o"></td>{/if}
          {:else}
            <td class="o q amal">{pul(c.jarima)}{#if !tor}{" сўм"}{/if}{#if tor}<span class="tg"><button class="tugma shaffof kch" title="Жаримани ўзгартириш" onclick={() => { tahrir = c.id; summa = String(c.jarima); }}><Ikon nom="tavsif" k={15} /></button><button class="tugma shaffof kch" title="Жаримани олиб ташлаш" onclick={() => { tahrir = c.id; summa = "0"; jarimaSaqla(c); }}><Ikon nom="ochir" k={15} /></button></span>{/if}</td>
            {#if !tor}<td class="o"><button class="tugma shaffof kch" title="Жаримани ўзгартириш" onclick={() => { tahrir = c.id; summa = String(c.jarima); }}><Ikon nom="tavsif" k={15} /></button>
              <button class="tugma shaffof kch" title="Жаримани олиб ташлаш" onclick={() => { tahrir = c.id; summa = "0"; jarimaSaqla(c); }}><Ikon nom="ochir" k={15} /></button></td>{/if}
          {/if}
        </tr>{/each}
      </tbody></table>
    {/if}

    {#if (d.bonusCards || []).length}
      <h3>🎁 Бонуслар</h3>
      <div class="jami">Шу ойдаги жами бонус: <b class="ym">{pul(d.bonusJami || 0)} сўм</b></div>
      <table><thead><tr><th>Вазифа</th>{#if !tor}<th>Бажарувчи</th>{/if}<th class="o">Бонус</th></tr></thead><tbody>
        {#each d.bonusCards as c (c.id)}<tr>
          <td><a href="#/b/{c.board_id}/c/{c.id}" class="nm"><span class="nmt">{c.nom}</span>{#if tor}<small>{c.kimgaIsm}</small>{/if}</a></td>
          {#if !tor}<td>{c.kimgaIsm}</td>{/if}
          <td class="o ym">+{pul(c.bonus)}{#if !tor}{" сўм"}{/if}</td>
        </tr>{/each}
      </tbody></table>
    {/if}
  {:else}
    {#if d.cards.length}
      <table><thead><tr><th>Вазифа</th>{#if !tor}<th>Бажарувчи</th><th>Ким топширди</th><th>Муддат</th>{/if}<th>Бажарилди</th><th></th></tr></thead><tbody>
        {#each d.cards as c (c.id)}<tr><td><a href="#/b/{c.board_id}/c/{c.id}" class="nm"><span class="nmt">{c.nom}</span>{#if tor}<small>{c.kimgaIsm}</small>{/if}</a></td>{#if !tor}<td>{c.kimgaIsm}</td><td>{c.yaratdiIsm}</td><td>{sanaT(c.muddat)}</td>{/if}<td class="sn">{c.bajarildi ? (tor ? sanaT(c.bajarildi) : vaqtT(c.bajarildi)) : "—"}</td><td class="o nowr">
            <button class="tugma qt" onclick={() => tikla(c)} title="Архивдан қайтариш">{#if tor}<Ikon nom="qaytar" />{:else}Қайтариш{/if}</button>
            <button class="tugma qt shaffof" onclick={() => ochir(c)} title="Бутунлай ўчириш"><Ikon nom="ochir" /></button></td></tr>{/each}
      </tbody></table>
      {#if d.yana}<button class="tugma" style="margin-top:12px" onclick={() => { sahifa++; yukla(true); }}>Яна юклаш</button>{/if}
    {/if}
  {/if}
</div>

<style>
  .ich { max-width: 1100px; width: 100%; margin: 0 auto; padding: 28px 24px; }
  .ich.tor { padding: 0 0 80px; }
  .tor .sar { position: sticky; top: 0; z-index: 2; height: 56px; margin: 0; padding: 0 12px; background: var(--surf);
    border-bottom: 1px solid var(--line); }
  .tor .jami, .tor table, .tor h3 { margin-left: 12px; margin-right: 12px; width: auto; }
  .tor table { table-layout: fixed; max-width: 100%; }
  .tor .nm small { white-space: normal; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
  .tor th:last-child, .tor td:last-child { width: 96px; white-space: nowrap; }
  .tor .sn { width: 74px; white-space: nowrap; color: var(--muted); font-size: 13px; }
  .tor td:last-child:has(.qt) { width: 40px; }
  .tor .qt { width: 32px; padding: 0; }
  .nowr { white-space: nowrap; }
  .kch { height: 26px; font-size: 13px; padding: 0 6px; }
  .jm { width: 92px; height: 28px; font-size: 13px; }
  .tor td:first-child { overflow: hidden; }
  .nm { display: flex; flex-direction: column; min-width: 0; }
  .nm small { color: var(--muted); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tor .nm { overflow: hidden; }
  .tor .od { min-width: 0; }
  .tor h2 { font-size: 17px; }
  .tor table { font-size: 13px; }
  .tor th, .tor td { padding: 8px 8px; }
  .tor .oy b { min-width: 0; font-size: 14px; white-space: nowrap; }
  .tor .sar { flex-wrap: wrap; gap: 4px 8px; }
  .tor .oy { gap: 4px; }
  .tor h2 { white-space: nowrap; }
  .tor table { table-layout: fixed; }
  .tor th, .tor td { padding: 8px 6px; }
  .tor .o { white-space: nowrap; }
  .tor .nmt { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .tor th.o { width: 84px; }
  .tor .amal { white-space: nowrap; }
  .tor .jm { width: 70px; }
  .tor .tg { display: flex; gap: 4px; margin-top: 4px; justify-content: flex-end; }
  .tor .q { font-size: 12px; }
  .tor .jami { padding: 0 2px; }
  .tor .tugma { height: 26px; font-size: 13px; padding: 0 8px; }
  .sar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  h2 { margin: 0; font-size: 21px; }
  h3 { font-size: 15px; margin: 24px 0 8px; }
  .oy { display: flex; align-items: center; gap: 10px; }
  .oy b { min-width: 130px; text-align: center; }
  .jami { font-size: 15px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; background: var(--surf); border: 1px solid var(--ajr); border-radius: 8px; overflow: hidden; box-shadow: var(--shadow); font-size: 15px; }
  th { text-align: left; font-size: 13px; color: var(--muted); font-weight: 700; padding: 10px 12px; background: var(--list); border-bottom: 1px solid var(--ajr); }
  td { padding: 10px 12px; border-top: 1px solid var(--ajr); }
  td a { color: var(--ink); text-decoration: none; font-weight: 500; }
  td a:hover { color: var(--brand); text-decoration: underline; }
  .o { text-align: right; } .q { color: var(--rdt); font-weight: 700; }
  .ym { color: var(--grt, var(--gr)); font-weight: 700; }
  .excel { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; margin-bottom: 12px; width: fit-content; }
  .tor .excel { height: 32px; font-size: 13px; padding: 0 10px; }
  .od { display: flex; align-items: center; gap: 8px; }
</style>
