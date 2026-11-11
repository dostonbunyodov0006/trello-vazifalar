<script>
  // Файл танлаш (камера/галерея; hujjat=true бўлса PDF/Excel/Word ҳам). Расмлар кичрайтирилади. bind:fayllar
  import { siq } from "./ishapi.js";
  import { haptic } from "../lib/tg.js";
  import Icon from "../lib/Icon.svelte";
  let { fayllar = $bindable([]), max = 6, hujjat = false, yozuv = "Расм" } = $props();
  let kor = $state([]), band = $state(false), inp = $state(null);
  const QABUL = "image/jpeg,image/png,image/webp" + (hujjat ? ",application/pdf,.xlsx,.docx" : "");
  async function tanla(e) {
    const tan = [...(e.target.files || [])].slice(0, max - fayllar.length);
    e.target.value = "";
    if (!tan.length) return;
    band = true;
    const yangi = await Promise.all(tan.map((f) => siq(f)));
    fayllar = [...fayllar, ...yangi];
    kor = [...kor, ...yangi.map((f) => ({ url: /^image\//.test(f.type) ? URL.createObjectURL(f) : null, nom: f.name }))];
    band = false; haptic();
  }
  function olib(i) {
    if (kor[i].url) URL.revokeObjectURL(kor[i].url);
    fayllar = fayllar.filter((_, j) => j !== i);
    kor = kor.filter((_, j) => j !== i);
  }
  export function tozala() { kor.forEach((k) => k.url && URL.revokeObjectURL(k.url)); kor = []; fayllar = []; }
</script>

<div class="ft">
  {#each kor as k, i (i + k.nom)}
    <div class="pv">
      {#if k.url}<img src={k.url} alt="" />{:else}<span class="doc"><Icon name="file" size={20} /><small>{k.nom}</small></span>{/if}
      <button class="x" onclick={() => olib(i)} aria-label="Олиб ташлаш">×</button>
    </div>
  {/each}
  {#if fayllar.length < max}
    <button class="qosh" disabled={band} onclick={() => inp.click()}>
      {#if band}<i class="ay"></i>{:else}<Icon name="upload" size={20} /><span>{yozuv}</span>{/if}
    </button>
  {/if}
  <input bind:this={inp} type="file" accept={QABUL} multiple hidden onchange={tanla} />
</div>

<style>
  .ft { display: flex; gap: 8px; flex-wrap: wrap; }
  .pv { position: relative; width: 72px; height: 72px; border-radius: 12px; overflow: hidden; background: var(--soft); }
  .pv img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .doc { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 100%; padding: 4px; color: var(--muted); }
  .doc small { font-size: 9px; line-height: 1.1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .x { position: absolute; top: 3px; right: 3px; width: 22px; height: 22px; border-radius: 11px; border: 0; background: rgba(0, 0, 0, .6); color: #fff; font-size: 15px; line-height: 1; padding: 0; }
  .qosh { width: 72px; height: 72px; border-radius: 12px; border: 1.5px dashed var(--dash); background: transparent; color: var(--muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11px; font-weight: 600; }
  .ay { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--off); border-top-color: var(--muted); animation: ay 0.8s linear infinite; }
  @keyframes ay { to { transform: rotate(360deg); } }
</style>
