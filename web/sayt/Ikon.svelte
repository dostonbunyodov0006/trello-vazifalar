<script>
  // Монохром иконкалар (Trello'да ҳам эмодзи эмас, чизиқли иконкалар ишлатилади).
  // Ранг — currentColor, ўлчам — k (пиксель). Ҳаммаси 24×24 координатада чизилган.
  let { nom, k = 16, class: klass = "" } = $props();
  const YO = {
    soat: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
    tavsif: "M4 6h16M4 11h16M4 16h10",
    izoh: "M4 5h16v11H9l-5 4V5z",
    ilova: "M16 7l-6.5 6.5a2.5 2.5 0 003.5 3.5L20 10a4.5 4.5 0 10-6.4-6.4L6 11.2",
    checklist: "M4 5h16v14H4zM8 12l2.5 2.5L16 9",
    pul: "M3 7h18v10H3zM12 10a2 2 0 100 4 2 2 0 000-4M6 12h.01M18 12h.01",
    doska: "M4 5h6v14H4zM14 5h6v9h-6z",
    arxiv: "M3 6h18v4H3zM5 10v9h14v-9M10 14h4",
    almash: "M7 8h13l-3-3M17 16H4l3 3",
    qongiroq: "M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 20h4",
    quyosh: "M12 5V3M12 21v-2M5 12H3M21 12h-2M6.3 6.3L4.9 4.9M19.1 19.1l-1.4-1.4M17.7 6.3l1.4-1.4M4.9 19.1l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z",
    oy: "M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z",
    ekran: "M3 5h18v11H3zM9 20h6M12 16v4",
    mavzu: "M12 3a9 9 0 000 18V3z",
    chiqish: "M15 12H4M8 8l-4 4 4 4M11 5h8v14h-8",
    odam: "M12 4a4 4 0 100 8 4 4 0 000-8zM4 21c0-4 3.6-6 8-6s8 2 8 6",
    belgi: "M4 6.5A2.5 2.5 0 016.5 4H12l8 8-7.5 7.5L4 11.5v-5zM8 8.5h.01",
    filtr: "M4 6h16M7 12h10M10 18h4",
    nuqta: "M6 12h.01M12 12h.01M18 12h.01",
    yulduz: "M12 4l2.5 5.2 5.5.8-4 4 1 5.6-5-2.7-5 2.7 1-5.6-4-4 5.5-.8z",
    yigish: "M10 6L4 12l6 6V6zM14 6l6 6-6 6V6z",
    ochish: "M4 6l6 6-6 6V6zM20 6l-6 6 6 6V6z",
    qosh: "M12 5v14M5 12h14",
    yop: "M6 6l12 12M18 6L6 18",
    qidir: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
    yulduzcha: "M12 3l1.8 4.2 4.2 1.8-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z",
    kochir: "M5 12h13M13 7l5 5-5 5",
    ochir: "M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13",
    qaytar: "M9 7L5 11l4 4M5 11h9a5 5 0 010 10",
    sana: "M4 7h16v13H4zM8 4v5M16 4v5M4 12h16",
    tasdiq: "M5 12.5l4.5 4.5L19 7",
  };
  const tola = ["yulduz", "yulduzcha", "yigish", "ochish"].includes(nom);
</script>

<svg class="ik {klass}" width={k} height={k} viewBox="0 0 24 24" fill={tola ? "currentColor" : "none"} stroke="currentColor"
  stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={YO[nom] || ""} />
</svg>

<style>
  .ik { flex-shrink: 0; display: block; }
</style>
