import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// 🖥 Rahbarlar sayti → dist/sayt → serverda / (asli: base "/trello/")
export default defineConfig({
  root: "web/sayt",
  base: "/",
  publicDir: false,
  plugins: [svelte()],
  build: { outDir: "../../dist/sayt", emptyOutDir: true, target: "es2020" },
});
