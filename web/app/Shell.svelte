<script>
  // Mini ilova qobig'i — asl bogliq-frontend/App.svelte dagi «faqatIsh» shoxining nusxasi:
  //   tepa sarlavha «Trello» + <Ishlar {xabar} ochId /> + toast.
  // Telegram xabaridagi tugma ?bolim=ish&card=<id> bilan ochadi → shu vazifa darhol ochiladi.
  import { onMount } from "svelte";
  import { tgTayyor } from "./lib/tg.js";
  import Icon from "./lib/Icon.svelte";
  import Ishlar from "./ish/Ishlar.svelte";
  import { ish } from "./ish/ishapi.js";

  let holat = $state("yuk"), xato = $state(null), toast = $state(""), toastRd = $state(false);
  let toastT = null;
  const ishId = (() => { try { return new URLSearchParams(location.search).get("card"); } catch { return null; } })();

  function xabar(t, rd = false) {
    toast = t; toastRd = rd;
    clearTimeout(toastT); toastT = setTimeout(() => (toast = ""), 2600);
  }

  onMount(async () => {
    tgTayyor();
    try { await ish("/men"); holat = "ok"; }
    catch (e) { xato = e; holat = "xato"; }
  });
</script>

{#if holat === "ok"}
  <div class="app">
    <div class="top"><div class="tt"><h1>Trello</h1></div></div>
    <Ishlar {xabar} ochId={ishId} />
  </div>
{:else if holat === "xato"}
  <div class="app"><div class="center">
    <Icon name="alert" size={36} />
    <div style="font-size:16px;font-weight:600;color:var(--ink)">{xato.status === 401 ? "Иловани Telegram орқали қайта очинг" : xato.message}</div>
    <div>{xato.status === 401 ? "Кириш муддати тугаган ёки имзо йўқ" : "@your_bot"}</div>
  </div></div>
{:else}
  <div class="app"><div class="center"><div class="spin"></div></div></div>
{/if}
{#if toast}<div class="toast" class:rd={toastRd}>{toast}</div>{/if}
