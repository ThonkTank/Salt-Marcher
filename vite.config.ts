import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Scan live entrypoints, never archived HTML reports or frozen source trees.
  optimizeDeps: { entries: ["index.html", "tests/support/*.html"] },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/docs/**", "**/src-tauri/target/**"] },
  },
  clearScreen: false,
});
