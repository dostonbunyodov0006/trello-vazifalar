<script>
  // Имзо билан юкланадиган расм (файл id бўйича). Босилса — onclick(url).
  import { faylUrl } from "./ishapi.js";
  let { id, h = 88, w = null, onclick = null } = $props();
  let url = $state(null), yoq = $state(false);
  $effect(() => { url = null; yoq = false; faylUrl(id).then((u) => { if (u) url = u; else yoq = true; }); });
</script>

<button class="rs" style="height:{h}px;{w ? `width:${w}px` : 'width:100%'}" onclick={(e) => { e.stopPropagation(); if (url && onclick) onclick(url); }} aria-label="Расм">
  {#if url}<img src={url} alt="" draggable="false" />{:else if yoq}<span>⚠︎</span>{:else}<i></i>{/if}
</button>

<style>
  .rs { flex-shrink: 0; border: 0; padding: 0; border-radius: 12px; overflow: hidden; background: var(--soft); display: flex; align-items: center; justify-content: center; color: var(--muted); }
  img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
  i { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--off); border-top-color: var(--muted); animation: ay 0.8s linear infinite; }
  @keyframes ay { to { transform: rotate(360deg); } }
</style>
