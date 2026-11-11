<script>
  // Карточка ойнаси — trello.com'нинг ўзидан ўлчаб қилинган: кенглиги 1080px, чапда мазмун,
  // ўнгда изоҳлар ва фаоллик; сарлавҳа 28px/653, бўлим номлари 14px/653, матн 14px/20px.
  import { onMount } from "svelte";
  import { api, faylUrl } from "./api.js";
  import { toshkentBugun, muddatNishon, vaqtT, harf, avatarRang, pul, siq, sanaT, MUHIMLIK, muhimlikRo } from "./util.js";
  import Ikon from "./Ikon.svelte";
  import OdamTanla from "./OdamTanla.svelte";
  let { id, men, xabar, onclose, onchange } = $props();
  const bugun = toshkentBugun();
  let d = $state(null), xato = $state(""), band = $state(false);
  let nom = $state(null), tavsif = $state(null), izoh = $state(""), panel = $state("");
  let kim = $state(null), odamOch = $state(false), muddatY = $state(""), jarimaY = $state(""), katta = $state(null), boshY = $state(""), bonusY = $state("");
  let kimlar = $state([]), nusxaSana = $state("");

  async function yukla() { try { d = await api("/cards/" + id); xato = ""; } catch (e) { xato = e.message; } }
  onMount(yukla);
  const v = $derived(d && d.card);
  const md = $derived(v ? muddatNishon(v, bugun) : { tur: "", matn: "" });
  const rasmlar = $derived(d ? d.fayllar.filter((f) => f.rasm) : []);
  const hujjatlar = $derived(d ? d.fayllar.filter((f) => !f.rasm) : []);
  const muqova = $derived(rasmlar.length ? faylUrl(rasmlar[0].id) : null);
  const tarix = $derived(d ? [...d.izohlar.map((z) => ({ ...z, tur: "izoh" })), ...d.faol.filter((f) => f.amal !== "izoh").map((f) => ({ ...f, tur: "faol" }))].sort((a, b) => (a.vaqt < b.vaqt ? 1 : -1)) : []);

  async function amal(fn, ok) {
    band = true;
    try { await fn(); if (ok) xabar(ok); await yukla(); onchange(); return true; }
    catch (e) { xabar(e.message, true); if (e.status === 409) await yukla(); return false; }
    finally { band = false; }
  }
  const patch = (body, ok = "Сақланди ✓") => amal(() => api("/cards/" + id, { method: "PATCH", body: { ...body, ver: v.ver } }), ok);
  const FAOL = { "card.yarat": "вазифа берди", "card.kochir": (m) => `«${m.dan}» → «${m.ga}»`, "card.nom": "номини ўзгартирди", "card.tavsif": "тавсифни ўзгартирди",
    "card.kimga": "бажарувчини алмаштирди",
    "card.ijro": (m) => `бажарувчиларни ўзгартирди (${m.soni} та)`, "card.muddat": (m) => `муддатни ўзгартирди: ${m.yangi}`, "card.boshlanish": (m) => `бошланиш санаси: ${m.yangi || "олиб ташланди"}`, "card.muhim": (m) => `зарурлик: ${m.yangi}`, "card.arxiv": "архивга олди", "card.tiklash": "архивдан қайтарди",
    "label+": "белги қўшди", "label-": "белги олиб ташлади", fayl: "файл қўшди", "fayl.ochir": (m) => `файл ўчирди: ${m.nom}`, jarima: (m) => (m.summa ? `жарима ёзди: ${pul(m.summa)} сўм` : "жаримани олиб ташлади"), bonus: (m) => (m.summa ? `бонус ёзди: ${pul(m.summa)} сўм` : "бонусни олиб ташлади"), "izoh.ochir": "изоҳни ўчирди", "izoh.tahrir": "изоҳни таҳрирлади" };
  const faolMatn = (f) => { const x = FAOL[f.amal]; return typeof x === "function" ? x(f.meta || {}) : x || f.amal; };
  const och = (p) => (panel = panel === p ? "" : p);
  async function yuklash(e) {
    const fl = await Promise.all([...e.target.files].map((f) => siq(f))); e.target.value = "";
    if (fl.length) amal(() => api(`/cards/${id}/fayllar`, { method: "POST", fayllar: fl }), "Юкланди ✓");
  }
</script>

<div class="qoplama" onclick={onclose} onkeydown={(e) => e.key === "Escape" && onclose()} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
    <button class="tugma shaffof yop" onclick={onclose} aria-label="Ёпиш"><Ikon nom="yop" /></button>
    {#if xato}<div class="xato" style="padding:24px">{xato}</div>
    {:else if !v}<div class="aylana"></div>
    {:else}
      {#if muqova}<div class="muqova"><img src={muqova} alt="" /></div>{/if}

      <div class="bosh">
        <span class="ik"><Ikon nom="doska" k={18} /></span>
        <div class="bw">
          {#if nom !== null}
            <form onsubmit={(e) => { e.preventDefault(); patch({ nom }).then((ok) => ok && (nom = null)); }}><input class="maydon nomm" bind:value={nom} maxlength="140" autocomplete="off" /></form>
          {:else}<button class="nomb" onclick={() => (nom = v.nom)}>{v.nom}</button>{/if}
          <div class="qaysi"><span class="holat {v.bajarildi ? 'tay' : md.tur}">{v.list_nom}</span>{#if v.arxiv}<span class="holat arx">Архивда</span>{/if}</div>
        </div>
      </div>

      <div class="tana">
        <div class="asos">
          <!-- 1-қадам: вазифа қайси босқичда -->
          <section class="qadam">
            <h4><span class="raqam">1</span> Ҳозирги ҳолати</h4>
            <div class="bosqich">
              {#each d.lists as l, i (l.id)}
                {@const joriy = d.lists.findIndex((x) => x.id === v.list_id)}
                <button class="bq" class:hozir={l.id === v.list_id} class:otgan={i < joriy} disabled={l.id === v.list_id || band}
                  onclick={() => amal(() => api(`/cards/${id}/kochir`, { method: "POST", body: { list_id: l.id, ver: v.ver } }), `«${l.nom}» ✓`)}>
                  {#if i < joriy}<Ikon nom="tasdiq" k={13} />{/if}{l.nom}
                </button>
                {#if i < d.lists.length - 1}<i class="strelka">›</i>{/if}
              {/each}
            </div>
            <p class="yordam">Ҳолатни ўзгартириш учун керакли босқич устига босинг.</p>
          </section>

          <!-- 2-қадам: вазифа маълумотлари -->
          <section class="qadam">
            <h4><span class="raqam">2</span> Вазифа маълумотлари</h4>

            <div class="sat">
              <span class="yorliq">Бажарувчи{v.ijro.length > 1 ? "лар" : ""}</span>
              <span class="qiy odamlar">{#each v.ijro as u (u.id)}<span class="od1"><span class="avatar" style="background:{avatarRang(u.ism)[0]};color:{avatarRang(u.ism)[1]}">{harf(u.ism)}</span>{u.ism}</span>{/each}</span>
              <button class="tugma kichik" class:tan={panel === "odam"} onclick={() => { och("odam"); kimlar = v.ijro.map((u) => ({ id: u.id, ism: u.ism })); odamOch = true; }}>Ўзгартириш</button>
            </div>
            {#if panel === "odam"}<div class="pn"><OdamTanla kop bind:kopTanlandi={kimlar} bind:ochiq={odamOch} />
              <button class="tugma asosiy" disabled={!kimlar.length || band}
                onclick={() => patch({ ijrochilar: kimlar.map((x) => x.id) }, "Бажарувчилар сақланди ✓").then((ok) => ok && (panel = ""))}>Сақлаш</button></div>{/if}

            <div class="sat">
              <span class="yorliq">Ким топширди</span>
              <span class="qiy">{v.yaratdiIsm}</span>
              <span></span>
            </div>

            <div class="sat">
              <span class="yorliq">Қачондан бошланади</span>
              <span class="qiy">{#if v.boshlanish}<span class="nishon kb">{sanaT(v.boshlanish)}</span>{:else}<span class="yoq">белгиланмаган</span>{/if}</span>
              <button class="tugma kichik" class:tan={panel === "muddat"} onclick={() => { och("muddat"); muddatY = v.muddat; boshY = v.boshlanish || ""; }}>Ўзгартириш</button>
            </div>

            <div class="sat">
              <span class="yorliq">Қачонгача тугайди</span>
              <span class="qiy"><span class="nishon {md.tur} kb"><Ikon nom="soat" /> {md.matn}</span></span>
              <button class="tugma kichik" class:tan={panel === "muddat"} onclick={() => { och("muddat"); muddatY = v.muddat; boshY = v.boshlanish || ""; }}>Ўзгартириш</button>
            </div>
            {#if panel === "muddat"}<div class="pn">
              <span class="yorliq">Қачондан бошлансин</span>
              <input class="maydon" type="date" bind:value={boshY} max={muddatY} />
              <span class="yorliq">Тугаш муддати</span>
              <input class="maydon" type="date" bind:value={muddatY} min={bugun} />
              <button class="tugma asosiy" disabled={band} onclick={() => patch({ muddat: muddatY, boshlanish: boshY }).then((ok) => ok && (panel = ""))}>Сақлаш</button></div>{/if}

            <div class="sat">
              <span class="yorliq">Зарурлиги</span>
              <span class="qiy"><span class="nishon kb"><span class="nuqta" style:--mr={MUHIMLIK[v.muhim || "medium"].rang}></span>{MUHIMLIK[v.muhim || "medium"].nom}</span></span>
              <button class="tugma kichik" class:tan={panel === "muhim"} onclick={() => och("muhim")}>Ўзгартириш</button>
            </div>
            {#if panel === "muhim"}<div class="pn">
              {#each muhimlikRo as mk2 (mk2)}
                <button class="tugma keng" class:tan={v.muhim === mk2} disabled={band} onclick={() => patch({ muhim: mk2 }, "Зарурлик ўзгарди ✓").then((ok) => ok && (panel = ""))}>
                  <span class="nuqta" style:--mr={MUHIMLIK[mk2].rang}></span>{MUHIMLIK[mk2].nom}</button>
              {/each}
            </div>{/if}
          </section>

          <!-- 3-бўлим: вазифа мазмуни -->
          <section class="qadam">
            <h4><span class="raqam">3</span> Вазифа мазмуни</h4>
            {#if tavsif !== null}
              <textarea class="maydon" bind:value={tavsif} maxlength="4000" autocomplete="off"></textarea>
              <div class="qator"><button class="tugma asosiy" disabled={band} onclick={() => patch({ tavsif }).then((ok) => ok && (tavsif = null))}>Сақлаш</button><button class="tugma" onclick={() => (tavsif = null)}>Бекор</button></div>
            {:else}
              <button class="tavsif" onclick={() => (tavsif = v.tavsif || "")}>{v.tavsif || "Тавсиф ёзиш учун босинг…"}</button>
            {/if}
          </section>

          <!-- 4-бўлим: жарима ва бонус -->
          <section class="qadam">
            <h4><span class="raqam">4</span> Жарима ва бонус</h4>
            <p class="yordam">{v.ijro.map((u) => u.ism).join(", ")} учун ёзилади. Ўз вақтида бажарса — бонус, бажармаса — жарима.</p>
            <div class="pulikki">
              <div class="pk jr">
                <div class="pksar"><Ikon nom="pul" /> Жарима</div>
                <div class="pkson">{#if v.jarima > 0}{pul(v.jarima)} сўм{:else}<span class="yoq">ёзилмаган</span>{/if}</div>
                {#if v.tavsiya && !v.jarima}<div class="pkiz">Таклиф: {v.jarimaKun} кун кечикди × {pul(v.tarif)} сўм = {pul(v.tavsiya)} сўм</div>{/if}
                <button class="tugma keng" class:tan={panel === "jarima"} onclick={() => { och("jarima"); jarimaY = String(v.jarima || v.tavsiya || ""); }}>{v.jarima > 0 ? "Ўзгартириш" : "Жарима ёзиш"}</button>
                {#if panel === "jarima"}<div class="pn ichki"><input class="maydon" type="number" min="0" step="1000" bind:value={jarimaY} placeholder="Сумма, сўм" />
                  <div class="tugmalar"><button class="tugma asosiy" disabled={band} onclick={() => amal(() => api(`/cards/${id}/jarima`, { method: "POST", body: { summa: Math.round(Number(jarimaY) || 0) } }), "Жарима ёзилди ✓").then(() => (panel = ""))}>Сақлаш</button>
                  {#if v.jarima > 0}<button class="tugma" disabled={band} onclick={() => amal(() => api(`/cards/${id}/jarima`, { method: "POST", body: { summa: 0 } }), "Олиб ташланди ✓").then(() => (panel = ""))}>Олиб ташлаш</button>{/if}</div></div>{/if}
              </div>
              <div class="pk bn">
                <div class="pksar"><Ikon nom="pul" /> Бонус</div>
                <div class="pkson">{#if v.bonus > 0}+{pul(v.bonus)} сўм{:else}<span class="yoq">ёзилмаган</span>{/if}</div>
                {#if !v.bajarildi}<div class="pkiz">Вазифа ҳали бажарилмаган</div>{/if}
                <button class="tugma keng" class:tan={panel === "bonus"} onclick={() => { och("bonus"); bonusY = String(v.bonus || ""); }}>{v.bonus > 0 ? "Ўзгартириш" : "Бонус ёзиш"}</button>
                {#if panel === "bonus"}<div class="pn ichki"><input class="maydon" type="number" min="0" step="1000" bind:value={bonusY} placeholder="Сумма, сўм" />
                  <div class="tugmalar"><button class="tugma asosiy" disabled={band} onclick={() => amal(() => api(`/cards/${id}/bonus`, { method: "POST", body: { summa: Math.round(Number(bonusY) || 0) } }), "Бонус ёзилди ✓").then(() => (panel = ""))}>Сақлаш</button>
                  {#if v.bonus > 0}<button class="tugma" disabled={band} onclick={() => amal(() => api(`/cards/${id}/bonus`, { method: "POST", body: { summa: 0 } }), "Олиб ташланди ✓").then(() => (panel = ""))}>Олиб ташлаш</button>{/if}</div></div>{/if}
              </div>
            </div>
          </section>

          <!-- 5-бўлим: файл ва расмлар -->
          <section class="qadam">
            <h4><span class="raqam">5</span> Ходим юборган расмлар</h4>
            {#if (d.ijroRasm || []).length}
              <p class="yordam">Ходим «Бажардим» деганда қўшган — иш қандай бажарилганини шу расмлардан кўринг.</p>
              <div class="rasmlar">{#each d.ijroRasm as f (f.id)}<button class="rs" onclick={() => (katta = faylUrl(f.id))}><img src={faylUrl(f.id)} alt="" loading="lazy" /></button>{/each}</div>
            {:else}<p class="yordam">Ходим ҳали расм юбормаган.</p>{/if}

            <div class="ajrat"></div>
            <p class="yordam">Вазифага ўзингиз бириктирган файллар:</p>
            {#if rasmlar.length}<div class="rasmlar">{#each rasmlar as f (f.id)}<button class="rs" onclick={() => (katta = faylUrl(f.id))}><img src={faylUrl(f.id)} alt="" loading="lazy" /></button>{/each}</div>{/if}
            {#each hujjatlar as f (f.id)}<div class="hj"><a href={faylUrl(f.id)} target="_blank" rel="noopener">📄 {f.nom}</a><button class="tugma shaffof kichik" onclick={() => amal(() => api("/fayllar/" + f.id, { method: "DELETE" }))}>Ўчириш</button></div>{/each}
            {#if !d.fayllar.length}<p class="yordam">Ҳозирча файл қўшилмаган.</p>{/if}
            <label class="tugma fayl"><Ikon nom="ilova" /> Файл қўшиш<input type="file" hidden multiple accept="image/jpeg,image/png,image/webp,application/pdf,.xlsx,.docx" onchange={yuklash} /></label>
          </section>

          <!-- 6-бўлим: якунлаш -->
          <section class="qadam">
            <h4><span class="raqam">6</span> Вазифани якунлаш</h4>
            <div class="qator">
              <button class="tugma" class:tan={panel === "nusxa"} disabled={band} onclick={() => { och("nusxa"); nusxaSana = bugun; }}><Ikon nom="kochir" /> Нусха олиш</button>
              {#if !v.arxiv}<button class="tugma" disabled={band} onclick={() => amal(() => api(`/cards/${id}/arxiv`, { method: "POST", body: {} }), "Архивга олинди ✓").then(onclose)}><Ikon nom="arxiv" /> Архивга олиш</button>
              {:else}<button class="tugma" disabled={band} onclick={() => amal(() => api(`/cards/${id}/arxiv`, { method: "POST", body: { arxiv: false } }), "Архивдан қайтди ✓")}><Ikon nom="qaytar" /> Архивдан қайтариш</button>{/if}
              <button class="tugma xavf" disabled={band} onclick={() => amal(() => api("/cards/" + id, { method: "DELETE" }), "Вазифа ўчирилди ✓").then(onclose)}><Ikon nom="ochir" /> Бутунлай ўчириш</button>
            </div>
            {#if panel === "nusxa"}<div class="pn">
              <span class="yorliq">Янги вазифанинг тугаш санаси</span>
              <input class="maydon" type="date" bind:value={nusxaSana} min={bugun} />
              <small class="kulrang">Ном, тавсиф, зарурлик ва бажарувчилар кўчирилади. Изоҳ, расм, жарима ва бонус кўчирилмайди.</small>
              <button class="tugma asosiy" disabled={band} onclick={() => amal(() => api(`/cards/${id}/nusxa`, { method: "POST", body: { muddat: nusxaSana } }), "Нусха олинди ✓").then((ok) => ok && (panel = ""))}>Нусха яратиш</button>
            </div>{/if}
            <p class="yordam">Архивга олинган вазифа «Архив» бўлимида туради ва 1 ойдан кейин ўзи ўчади.</p>
          </section>
        </div>

        <aside class="faol">
          <h4 class="fsar"><Ikon nom="izoh" /> Изоҳлар ва фаоллик</h4>
          <form class="izohf" onsubmit={(e) => { e.preventDefault(); const m = izoh.trim(); if (m) amal(async () => { await api(`/cards/${id}/izohlar`, { method: "POST", body: { matn: m, kalit: Date.now().toString(36) } }); izoh = ""; }); }}>
            <span class="avatar" style="background:{avatarRang(men.ism)[0]};color:{avatarRang(men.ism)[1]}">{harf(men.ism)}</span>
            <input class="maydon" bind:value={izoh} placeholder="Изоҳ ёзинг…" maxlength="2000" autocomplete="off" /><button class="tugma asosiy" disabled={!izoh.trim() || band}>Юбориш</button>
          </form>
          {#each tarix as t (t.tur + t.id)}
            {@const r = avatarRang(t.ism)}
            <div class="yozuv">
              <span class="avatar" style="background:{r[0]};color:{r[1]}">{harf(t.ism)}</span>
              <div class="ym">
                {#if t.tur === "izoh"}
                  <div><b>{t.ism}</b> <span class="vaqt">{vaqtT(t.vaqt)}</span></div>
                  {#if t.matn}<div class="izm">{t.matn}</div>{/if}
                  {#if t.fayllar.length}<div class="rasmlar">{#each t.fayllar as f (f.id)}{#if f.rasm}<button class="rs kich" onclick={() => (katta = faylUrl(f.id))}><img src={faylUrl(f.id)} alt="" loading="lazy" /></button>{:else}<a href={faylUrl(f.id)} target="_blank" rel="noopener">📄 {f.nom}</a>{/if}{/each}</div>{/if}
                {:else}
                  <div><b>{t.ism}</b> {faolMatn(t)} <span class="vaqt">{vaqtT(t.vaqt)}</span></div>
                {/if}
              </div>
            </div>
          {/each}
        </aside>
      </div>
    {/if}
  </div>
</div>
{#if katta}<div class="katta" onclick={() => (katta = null)} onkeydown={(e) => e.key === "Escape" && (katta = null)} role="presentation"><img src={katta} alt="" /></div>{/if}

<style>
  /* Ўлчамлар trello.com'дан: ойна 1080px, сарлавҳа 28px/32px, бўлим 14px/653, матн 14px/20px */
  .qoplama { position: fixed; inset: 0; background: #0304047a; display: flex; align-items: flex-start; justify-content: center; padding: 48px 16px; overflow-y: auto; z-index: 100; }
  .modal { position: relative; width: 100%; max-width: 1080px; background: var(--surf2); border-radius: 12px; box-shadow: var(--shadow2); overflow: hidden; }
  .yop { position: absolute; right: 10px; top: 10px; width: 32px; height: 32px; padding: 0; font-size: 15px; border-radius: 50%; background: var(--hover); z-index: 3; }
  .muqova { height: 160px; background: var(--hover); }
  .muqova img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bosh { display: flex; gap: 12px; padding: 20px 56px 8px 24px; }
  .ik { font-size: 17px; color: var(--muted); padding-top: 6px; }
  .bw { flex: 1; min-width: 0; }
  .nomb { border: 0; background: transparent; font-size: 30px; font-weight: 653; line-height: 34px; text-align: left; padding: 4px 8px; border-radius: 4px; width: 100%; color: var(--ink); }
  .nomb:hover { background: var(--hover); }
  .nomm { font-size: 21px; font-weight: 650; }
  .qaysi { font-size: 15px; line-height: 22px; color: var(--muted); padding: 2px 8px; }
  .tana { display: flex; align-items: stretch; }
  .asos { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0; padding: 8px 24px 28px; }
  .qadam { border-top: 1px solid var(--ajr); padding: 16px 0; }
  .qadam:first-child { border-top: 0; padding-top: 4px; }
  .raqam { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--brand); color: #fff; font-size: 13px; font-weight: 700; flex-shrink: 0; }
  .yordam { margin: 8px 0 0; font-size: 13px; line-height: 18px; color: var(--muted); }
  .sat { display: grid; grid-template-columns: 170px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--ajr); }
  .sat:last-of-type { border-bottom: 0; }
  .qiy { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 15px; }
  .odamlar { flex-wrap: wrap; gap: 4px 10px; }
  .od1 { display: inline-flex; align-items: center; gap: 6px; }
  .yoq { color: var(--muted); }
  .ajrat { height: 1px; background: var(--ajr); margin: 16px 0 12px; }
  .holat { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 12px; font-size: 13px; font-weight: 600; background: var(--hover); color: var(--ink); }
  .holat.kech { background: var(--rd); color: #fff; }
  .holat.yaqin { background: var(--amb); color: #533f04; }
  .holat.tay { background: var(--gr); color: #fff; }
  .holat.arx { margin-left: 6px; }
  .pulikki { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pk { border: 1px solid var(--ajr); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
  .pk.jr { border-left: 4px solid var(--rd); }
  .pk.bn { border-left: 4px solid var(--gr); }
  .pksar { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 653; color: var(--muted); }
  .pkson { font-size: 20px; font-weight: 700; line-height: 26px; }
  .pk.jr .pkson { color: var(--rdt); }
  .pk.bn .pkson { color: var(--gr); }
  .pkson .yoq { font-size: 15px; font-weight: 400; }
  .pkiz { font-size: 12px; line-height: 16px; color: var(--muted); }
  .pn.ichki { max-width: none; box-shadow: none; }
  .tugmalar { display: flex; gap: 6px; }
  @media (max-width: 820px) { .pulikki { grid-template-columns: 1fr; } }
  .nishon.kb.bns { background: var(--gr); color: #fff; font-weight: 600; }
  .fayl { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; width: fit-content; }
  .faol { width: 380px; flex-shrink: 0; border-left: 1px solid var(--ajr); padding: 20px 20px 28px; display: flex; flex-direction: column; }
  .fsar { margin: 0 0 14px; }
  .bosqich { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .bq { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 12px; border: 0; border-radius: 14px; font-size: 14px;
    background: var(--hover); color: var(--muted); cursor: pointer; }
  .bq:not(:disabled):hover { background: var(--press); color: var(--ink); }
  .bq:disabled { cursor: default; }
  .bq.otgan { color: var(--gr); }
  .bq.hozir { background: var(--brandsoft); color: var(--brand); font-weight: 600; }
  .strelka { color: var(--muted); font-style: normal; }
  .nishon.kb { height: 32px; padding: 0 10px; font-size: 15px; background: var(--hover); color: var(--ink); }
  .nishon.kb.kech { background: var(--rd); color: #fff; } .nishon.kb.yaqin { background: var(--amb); color: #533f04; } .nishon.kb.tayyor { background: var(--gr); color: #fff; }
  .lbs { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; min-height: 32px; }
  h4 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 653; line-height: 24px; margin: 0 0 10px; }
  .kichik { height: 26px; font-size: 13px; padding: 0 8px; }
  .tavsif { width: 100%; min-height: 56px; border: 0; border-radius: 4px; background: var(--hover); padding: 8px 12px; text-align: left; font-size: 15px; line-height: 22px; white-space: pre-wrap; color: var(--ink); }
  .tavsif:hover { background: var(--press); }
  .qator { display: flex; gap: 8px; margin-top: 8px; }
  .rasmlar { display: flex; gap: 8px; flex-wrap: wrap; }
  .rs { width: 150px; height: 100px; border: 0; padding: 0; border-radius: 6px; overflow: hidden; background: var(--press); }
  .rs.kich { width: 110px; height: 76px; }
  .rs img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hj { display: flex; align-items: center; gap: 8px; font-size: 15px; }
  .izohf { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
  .yozuv { display: flex; gap: 8px; margin: 0; padding: 10px 0; font-size: 15px; line-height: 22px; border-bottom: 1px solid var(--ajr); }
  .ym { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .vaqt { font-size: 13px; color: var(--muted); }
  .izm { background: var(--surf2); border: 1px solid var(--ajr); border-radius: 8px; padding: 8px 12px; white-space: pre-wrap; word-break: break-word; }
  .pn { background: var(--surf); border: 1px solid var(--ajr); border-radius: 8px; padding: 8px; box-shadow: var(--shadow2); display: flex; flex-direction: column; gap: 6px; max-width: 320px; }
  .lbt { border: 0; height: 30px; justify-content: flex-start; }
  .lbt.off { opacity: .55; }
  .tugma.tan { background: var(--brandsoft); color: var(--brand); }
  .kulrang { color: var(--muted); font-size: 13px; }
  .nuqta { width: 8px; height: 8px; border-radius: 50%; background: var(--mr); display: inline-block; margin-right: 6px; }
  .katta { position: fixed; inset: 0; z-index: 150; background: #000d; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .katta img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; }
  @media (max-width: 900px) {
    .tana { flex-direction: column; }
    .faol { width: 100%; border-left: 0; border-top: 1px solid var(--line); }
    .asos { padding-left: 24px; }
    h4 { margin-left: 0; }
  }
</style>
