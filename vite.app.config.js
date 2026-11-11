import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// 📱 Xodimlar mini ilovasi (Telegram Mini App, faqat Trello) → dist/app → serverda /app/
export default defineConfig({
  root: "web/app",
  base: "/app/",
  publicDir: "public",
  plugins: [svelte()],
  build: { outDir: "../../dist/app", emptyOutDir: true, target: "es2020" },
});
