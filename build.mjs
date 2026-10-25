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
  entryPoints: [test ? "tests/shared/core.test.ts" : "src/legacy/obsidian/main.ts"],
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
  // Every store fixture uses this exact bundle; individual test processes keep
  // their own store instances and databases.
  await mkdir('.build/test-shared/catalog', {recursive:true});
  await copyFile('src/features/catalog/data/srd-5.1.generated.json', '.build/test-shared/catalog/srd-5.1.generated.json');
  await build({
    entryPoints: ['src/app/storage/store.ts'], outfile: '.build/test-shared/store.cjs',
    bundle: true, platform: 'node', format: 'cjs', external: ['better-sqlite3'],
  });
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
