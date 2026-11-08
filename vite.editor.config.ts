import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./src/editor", import.meta.url)),
  base: "./",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./dist-editor", import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
  },
  worker: { format: "es" },
});
