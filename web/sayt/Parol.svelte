<script>
  // 🔑 Паролни алмаштириш (профиль менюсидан)
  import { api } from "./api.js";
  let { xabar, onclose } = $props();
  let eski = $state(""), yangi = $state(""), yana = $state(""), kor = $state(false), xato = $state(""), yuk = $state(false);
  async function yubor(e) {
    e.preventDefault();
    xato = !eski ? "Эски паролни киритинг" : yangi.length < 8 ? "Янги парол камида 8 белги бўлсин" : yangi !== yana ? "Янги пароллар мос эмас" : "";
    if (xato) return;
    yuk = true;
    try { await api("/parol", { method: "POST", body: { eski, yangi } }); xabar("Парол алмашди ✓"); onclose(); }
    catch (er) { xato = er.message; }
    yuk = false;
  }
</script>

<div class="qoplama" onclick={onclose} onkeydown={(e) => e.key === "Escape" && onclose()} role="presentation">
  <form class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} onsubmit={yubor} role="dialog" tabindex="-1">
    <h2>Паролни алмаштириш</h2>
    <label class="yorliq" for="pe">Эски парол</label>
    <input id="pe" class="maydon" type={kor ? "text" : "password"} bind:value={eski} autocomplete="current-password" />
    <label class="yorliq" for="py">Янги парол (камида 8 белги)</label>
    <input id="py" class="maydon" type={kor ? "text" : "password"} bind:value={yangi} autocomplete="new-password" />
    <label class="yorliq" for="pq">Янги паролни қайтаринг</label>
    <input id="pq" class="maydon" type={kor ? "text" : "password"} bind:value={yana} autocomplete="new-password" />
    <label class="kor"><input type="checkbox" bind:checked={kor} /> Парол кўринсин</label>
    {#if xato}<div class="xato">{xato}</div>{/if}
    <div class="past">
      <button type="button" class="tugma" onclick={onclose}>Бекор</button>
      <button class="tugma asosiy" disabled={yuk}>{yuk ? "…" : "Сақлаш"}</button>
    </div>
  </form>
</div>

<style>
  .qoplama { position: fixed; inset: 0; background: #0304047a; display: flex; align-items: flex-start; justify-content: center; padding: 64px 16px; z-index: 120; }
  .modal { width: 100%; max-width: 420px; background: var(--surf2); border-radius: 12px; padding: 20px 24px 20px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow2); }
  h2 { margin: 0 0 8px; font-size: 17px; font-weight: 653; }
  .kor { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); margin-top: 4px; }
  .kor input { width: 15px; height: 15px; }
  .past { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
</style>
