import { build } from "esbuild";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  assertCatalogMainJsBudget,
  catalogMainJsGrowth,
  catalogPayloadMainJsBytes,
  prepareCatalogBuildAsset,
} from "./tools/catalog-build-asset.mjs";
const test = process.argv.includes("--test");
const catalogAsset = await prepareCatalogBuildAsset();
const productBuild = await build({
  entryPoints: [test ? "tests/core.test.ts" : "src/main.ts"],
  outfile: test ? ".build/tests.cjs" : "main.js",
  bundle: true,
  format: "cjs",
  platform: test ? "node" : "browser",
  target: "es2022",
  external: ["obsidian", "electron", "node:*", "util", "stream", "zlib", "assert", "buffer"],
  sourcemap: true,
  logLevel: "info",
  metafile: !test,
  minify: !test,
  plugins: [
    {
      name: "catalog-srd-5.1-gzip",
      setup(builder) {
        builder.onResolve({ filter: /^catalog:srd-5\.1-gzip$/ }, () => ({
          path: "srd-5.1-gzip",
          namespace: "catalog-asset",
        }));
        builder.onLoad({ filter: /.*/, namespace: "catalog-asset" }, () => ({
          contents: `export default ${JSON.stringify(catalogAsset.payload)};`,
          loader: "js",
        }));
      },
    },
    {
      name: "compute-worker",
      setup(builder) {
        builder.onResolve({ filter: /^dungeon-compute-worker$/ }, () => ({
          path: "compute-worker",
          namespace: "worker",
        }));
        builder.onLoad({ filter: /.*/, namespace: "worker" }, async () => {
          const worker = await build({
            entryPoints: ["src/compute-worker.ts"],
            bundle: true,
            write: false,
            format: "iife",
            platform: "browser",
            target: "es2022",
            minify: true,
          });
          return {
            contents:
              "export default " + JSON.stringify(worker.outputFiles[0].text),
            loader: "js",
          };
        });
      },
    },
  ],
});
if (test) await build({
  entryPoints: ["tests/catalog-creature-view-dom.entry.ts"],
  outfile: ".build/catalog-creature-view-dom.cjs",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
});
if (test) await build({
  entryPoints: ["tests/catalog-creature-view-adapter.entry.ts"],
  outfile: ".build/catalog-creature-view-adapter.cjs",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
  plugins: [{
    name: "obsidian-view-test-stub",
    setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({
        path: new URL("./tests/fixtures/obsidian-view-stub.ts", import.meta.url).pathname,
      }));
    },
  }],
});
if (test) await build({
  entryPoints: ["tests/room-key-search-panel.entry.ts"],
  outfile: ".build/room-key-search-panel.cjs",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
  plugins: [{
    name: "obsidian-key-panel-test-stub",
    setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({
        path: new URL("./tests/fixtures/obsidian-view-stub.ts", import.meta.url).pathname,
      }));
      builder.onResolve({ filter: /^dungeon-compute-worker$/ }, () => ({
        path: "compute-worker-stub",
        namespace: "room-key-search-test",
      }));
      builder.onLoad({ filter: /.*/, namespace: "room-key-search-test" }, () => ({
        contents: "export default '';",
        loader: "js",
      }));
    },
  }],
});
if (test) await build({
  entryPoints: ["tests/atlas-copy-modal.entry.ts"],
  outfile: ".build/atlas-copy-modal.cjs",
  bundle: true, format: "cjs", platform: "node", target: "es2022",
  sourcemap: true, logLevel: "info",
  plugins: [{
    name: "obsidian-atlas-modal-test-stub",
    setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({
        path: new URL("./tests/fixtures/obsidian-atlas-modal-stub.ts", import.meta.url).pathname,
      }));
    },
  }],
});
if (test) await build({
  entryPoints: ["tests/dungeon-view-lifecycle.entry.ts"],
  outfile: ".build/dungeon-view-lifecycle.cjs",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
  plugins: [{
    name: "obsidian-dungeon-view-test-stub",
    setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({
        path: new URL("./tests/fixtures/obsidian-dungeon-view-stub.ts", import.meta.url).pathname,
      }));
      builder.onResolve({ filter: /^dungeon-compute-worker$/ }, () => ({
        path: "compute-worker-stub",
        namespace: "dungeon-view-test",
      }));
      builder.onLoad({ filter: /.*/, namespace: "dungeon-view-test" }, () => ({
        contents: "export default '';",
        loader: "js",
      }));
    },
  }],
});
if (test) await build({
  entryPoints: ["tests/campaign-entry-dom.entry.ts"],
  outfile: ".build/campaign-entry-dom.cjs",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
});
if (test) await build({
  entryPoints: ["tests/vault-campaign-runtime-source.entry.ts"],
  outfile: ".build/vault-campaign-runtime-source.cjs",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
  plugins: [{
    name: "obsidian-campaign-test-stub",
    setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({
        path: new URL("./tests/fixtures/obsidian-campaign-stub.ts", import.meta.url).pathname,
      }));
    },
  }],
});
if (test) await build({
  entryPoints: ["tests/atlas-detail-entry.entry.ts"], outfile: ".build/atlas-detail-entry.cjs",
  bundle: true, format: "cjs", platform: "node", target: "es2022", sourcemap: true, logLevel: "info",
});
if (test) await build({
  entryPoints: ["tests/world-notes-panel.entry.ts"], outfile: ".build/world-notes-panel.cjs",
  bundle: true, format: "cjs", platform: "node", target: "es2022", sourcemap: true, logLevel: "info",
});
if (test) await build({
  entryPoints: ["tests/world-notes-view.entry.ts"], outfile: ".build/world-notes-view.cjs",
  bundle: true, format: "cjs", platform: "node", target: "es2022", sourcemap: true, logLevel: "info",
  plugins: [{ name: "obsidian-world-notes-view-test-stub", setup(builder) {
    builder.onResolve({ filter: /^obsidian$/ }, () => ({
      path: new URL("./tests/fixtures/obsidian-view-stub.ts", import.meta.url).pathname,
    }));
  } }],
});
if (test) await build({
  entryPoints: ["tests/atlas-campaign-host.entry.ts"], outfile: ".build/atlas-campaign-host.cjs",
  bundle: true, format: "cjs", platform: "node", target: "es2022", sourcemap: true, logLevel: "info",
  plugins: [{ name: "obsidian-atlas-host-test-stub", setup(builder) {
    builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: new URL("./tests/fixtures/obsidian-atlas-host-stub.ts", import.meta.url).pathname }));
  } }],
});
if (!test) {
  const mainBytes = (await stat("main.js")).size;
  const mainJsGrowthBytes = catalogMainJsGrowth(mainBytes, catalogAsset.identity);
  const catalogPayloadBytes = assertCatalogMainJsBudget(
    catalogPayloadMainJsBytes(productBuild.metafile),
    catalogAsset.identity,
  );
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim().length > 0;
  const inventory = {
    ...catalogAsset.inventory,
    baselineCommit: catalogAsset.identity.baseline.commit,
    baselineMainBytes: catalogAsset.identity.baseline.mainBytes,
    mainBytes,
    mainJsGrowthBytes,
    catalogPayloadBytes,
    catalogPayloadLimitBytes: catalogAsset.identity.limits.mainJsGrowthBytes,
    node: process.version,
    commit,
    dirty,
    sourceRevision: dirty ? `${commit}+dirty` : commit,
    command: "npm run build",
  };
  await mkdir(".build", { recursive: true });
  await writeFile(".build/catalog-build-inventory.json", JSON.stringify(inventory, null, 2) + "\n");
  console.log("catalog inventory", inventory);
}

if (test) await build({ entryPoints: ["tests/manual-planner-panel.entry.ts"], outfile: ".build/manual-planner-panel.cjs", bundle: true, format: "cjs", platform: "node", target: "es2022", logLevel: "info" });
