<script>
  // Кириш: логин + парол (фақат Сардор ака ва Мурод ака)
  import { api } from "./api.js";
  let { onkirdi } = $props();
  let login = $state(""), parol = $state(""), kor = $state(false), xato = $state(""), yuk = $state(false);
  async function kir(e) {
    e.preventDefault();
    if (!login.trim() || !parol) { xato = "Логин ва паролни киритинг"; return; }
    yuk = true; xato = "";
    try { await api("/kirish", { method: "POST", body: { login, parol } }); parol = ""; onkirdi(); }
    catch (er) { xato = er.message; }
    yuk = false;
  }
</script>

<div class="fon">
  <form class="oyna" onsubmit={kir}>
    <div class="logo"><span class="belgi">▦</span>BIGANT <b>Вазифалар</b></div>
    <h1>Тизимга кириш</h1>
    <label class="yorliq" for="l">Логин</label>
    <input id="l" class="maydon" bind:value={login} autocomplete="username" autocapitalize="off" spellcheck="false" />
    <label class="yorliq" for="p">Парол</label>
    <div class="parol">
      <input id="p" class="maydon" type={kor ? "text" : "password"} bind:value={parol} autocomplete="current-password" />
      <button type="button" class="tugma shaffof kor" onclick={() => (kor = !kor)}>{kor ? "Яшириш" : "Кўрсатиш"}</button>
    </div>
    {#if xato}<div class="xato">{xato}</div>{/if}
    <button class="tugma asosiy katta" disabled={yuk}>{yuk ? "…" : "Кириш"}</button>
  </form>
</div>

<style>
  .fon { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--board); padding: 16px; }
  .oyna { width: 100%; max-width: 380px; background: var(--surf2); border: 1px solid var(--line); border-radius: 12px; padding: 32px 32px 28px; box-shadow: 0 12px 40px #03040466; display: flex; flex-direction: column; gap: 10px; }
  .logo { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 21px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
  .logo b { font-weight: 500; color: var(--muted); }
  .belgi { color: var(--brand); font-size: 21px; }
  h1 { font-size: 17px; text-align: center; margin: 0 0 10px; color: var(--muted); font-weight: 600; }
  .parol { position: relative; }
  .parol .maydon { padding-right: 96px; }
  .kor { position: absolute; right: 4px; top: 2px; height: 32px; font-size: 13px; }
  .katta { height: 40px; margin-top: 8px; font-size: 15px; }
</style>
