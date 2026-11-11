// 📋 Xodimlar mini ilovasi (Telegram Mini App) — faqat «Trello» bo'limi.
// Cloudflare'da bu bo'lim umumiy ilovaning (bogliq-frontend/App.svelte) ichidagi tab edi;
// bu yerda — o'sha «faqatIsh» ko'rinishining alohida sahifasi (Shell.svelte).
import { mount } from "svelte";
import "./app.css";
import Shell from "./Shell.svelte";

mount(Shell, { target: document.getElementById("app") });
