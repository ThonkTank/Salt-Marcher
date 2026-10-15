import { build } from "esbuild";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  assertCatalogMainJsBudget,
  catalogMainJsGrowth,
  catalogPayloadMainJsBytes,
  prepareCatalogBuildAsset,
} from "./tools/catalog-build-asset.mjs";
const test = process.argv.includes("--test");
const catalogAsset = await prepareCatalogBuildAsset();
if(test){await mkdir('.build/catalog',{recursive:true});await Promise.all([copyFile('src/features/catalog/data/srd-5.1.generated.json','.build/catalog/srd-5.1.generated.json'),copyFile('src/features/catalog/SRD-5.1-ATTRIBUTION.md','.build/catalog/SRD-5.1-ATTRIBUTION.md')]);}
const productBuild = await build({
  entryPoints: [test ? "tests/core.test.ts" : "src/main.ts"],
  outfile: test ? ".build/tests.cjs" : "main.js",
  bundle: true,
  format: "cjs",
  platform: test ? "node" : "browser",
  target: "es2022",
  external: ["obsidian", "electron", "better-sqlite3", "node:*", "util", "stream", "zlib", "assert", "buffer"],
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
if (test) {
  // Keep entry-specific host fixtures isolated and builds sequential.
  const entries = [
    ["catalog-creature-view-dom"],
    ["catalog-creature-view-adapter", "obsidian-view-stub.ts"],
    ["room-key-search-panel", "obsidian-view-stub.ts", "room-key-search-test"],
    ["atlas-copy-modal", "obsidian-atlas-modal-stub.ts"],
    ["dungeon-view-lifecycle", "obsidian-dungeon-view-stub.ts", "dungeon-view-test"],
    ["campaign-entry-dom"],
    ["vault-campaign-runtime-source", "obsidian-campaign-stub.ts"],
    ["atlas-detail-entry"],
    ["world-notes-panel"],
    ["world-notes-view", "obsidian-view-stub.ts"],
    ["atlas-campaign-host", "obsidian-atlas-host-stub.ts"],
  ];
  for (const [name, fixture, workerNamespace] of entries) {
    await build({
      entryPoints: [`tests/${name}.entry.ts`],
      outfile: `.build/${name}.cjs`,
      bundle: true, format: "cjs", platform: "node", target: "es2022",
      sourcemap: true, logLevel: "info",
      plugins: fixture ? [{
        name: "test-host-stubs",
        setup(builder) {
          builder.onResolve({ filter: /^obsidian$/ }, () => ({
            path: new URL(`./tests/fixtures/${fixture}`, import.meta.url).pathname,
          }));
          if (workerNamespace) {
            builder.onResolve({ filter: /^dungeon-compute-worker$/ }, () => ({
              path: "compute-worker-stub", namespace: workerNamespace,
            }));
            builder.onLoad({ filter: /.*/, namespace: workerNamespace }, () => ({
              contents: "export default '';", loader: "js",
            }));
          }
        },
      }] : [],
    });
  }
}
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
