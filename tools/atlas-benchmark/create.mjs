// node tools/atlas-benchmark/create.mjs /absolute/new-directory
// A new directory is mandatory: never replace an existing campaign/profile.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const destination = process.argv[2];
if (!destination || process.argv.length !== 3)
  throw Error("Usage: node tools/atlas-benchmark/create.mjs <new-directory>");
const dir = resolve(destination);
buildSync({
  stdin: {
    contents:
      "export {seedBenchmark} from './tools/atlas-benchmark/seed';export {CampaignStore} from './src/app/storage/store';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/atlas-benchmark-seed.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["better-sqlite3"],
});
const { seedBenchmark, CampaignStore } = createRequire(import.meta.url)(
  "../../.build/atlas-benchmark-seed.cjs",
);
mkdirSync(dir); // EEXIST is deliberately fatal; a partial failed fixture is retained.
const store = new CampaignStore(dir + "/workbench.sqlite");
try {
  const started = Date.now(),
    manifest = seedBenchmark(store, (stage) =>
      process.stderr.write(stage + "\n"),
    );
  manifest.sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  manifest.sourceStatus = execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  });
  manifest.setupMs = Date.now() - started;
  writeFileSync(
    dir + "/manifest.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(JSON.stringify({ directory: dir, ...manifest }, null, 2));
} finally {
  store.close();
}
