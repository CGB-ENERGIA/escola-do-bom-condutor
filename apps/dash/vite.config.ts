import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Painel de relatórios: site separado (porta 5174) que consome a mesma API (3001). */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174, strictPort: true, proxy: { "/api": "http://localhost:3001" } },
});
