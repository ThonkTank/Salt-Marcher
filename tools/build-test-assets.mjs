import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {prepareCatalogBuildAsset} from './catalog-build-asset.mjs';
const [kind,directory]=process.argv.slice(2);
if(!['core','store'].includes(kind)||!directory)throw Error('Expected artifact kind and output directory.');
await mkdir(path.join(directory,'catalog'),{recursive:true});
await copyFile('src/features/catalog/data/srd-5.1.generated.json',path.join(directory,'catalog/srd-5.1.generated.json'));
if(kind==='store') {
 await build({entryPoints:['src/app/storage/store.ts'],outfile:path.join(directory,'bundle.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
} else {
 await copyFile('src/features/catalog/SRD-5.1-ATTRIBUTION.md',path.join(directory,'catalog/SRD-5.1-ATTRIBUTION.md'));
 const catalogAsset=await prepareCatalogBuildAsset();
await build({
  entryPoints: ["tests/shared/core.test.ts"],
  outfile: path.join(directory,'bundle.cjs'),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2022",
  external: ["obsidian", "electron", "better-sqlite3", "node:*", "util", "stream", "zlib", "assert", "buffer"],
  sourcemap: true,
  logLevel: "info",
  metafile: false,
  minify: false,
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
}
