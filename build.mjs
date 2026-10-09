import { build } from "esbuild";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { catalogMainJsGrowth, prepareCatalogBuildAsset } from "./tools/catalog-build-asset.mjs";
const test = process.argv.includes("--test");
const catalogAsset = await prepareCatalogBuildAsset();
await build({
  entryPoints: [test ? "tests/core.test.ts" : "src/main.ts"],
  outfile: test ? ".build/tests.cjs" : "main.js",
  bundle: true,
  format: "cjs",
  platform: test ? "node" : "browser",
  target: "es2022",
  external: ["obsidian", "electron", "node:*", "util", "stream", "zlib", "assert", "buffer"],
  sourcemap: true,
  logLevel: "info",
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
if (!test) {
  const mainBytes = (await stat("main.js")).size;
  const mainJsGrowthBytes = catalogMainJsGrowth(mainBytes, catalogAsset.identity);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim().length > 0;
  const inventory = {
    ...catalogAsset.inventory,
    baselineCommit: catalogAsset.identity.baseline.commit,
    baselineMainBytes: catalogAsset.identity.baseline.mainBytes,
    mainBytes,
    mainJsGrowthBytes,
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
