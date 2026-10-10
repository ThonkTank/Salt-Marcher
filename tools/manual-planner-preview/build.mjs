import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const out = resolve(root, ".build/manual-planner-preview");
await mkdir(out, { recursive: true });
await build({
  entryPoints: [resolve(root, "tools/manual-planner-preview/entry.ts")],
  outfile: resolve(out, "preview.js"),
  bundle: true, platform: "browser", format: "iife", target: "es2022",
  logLevel: "info",
});
await copyFile(new URL("index.html", import.meta.url), resolve(out, "index.html"));
console.log(`Flüchtiger Planer-GUI-Test: ${resolve(out, "index.html")}`);
