import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, cpus } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const outputDirectory = resolve(
  process.argv[2] ?? join(homedir(), ".cache/dungeon-native-qa/building-benchmark"),
);
mkdirSync(outputDirectory, { recursive: true });
const bundle = join(outputDirectory, "compute-benchmark.cjs");
await build({
  entryPoints: ["src/compute.ts"],
  outfile: bundle,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  logLevel: "silent",
});
const { composeBuilding } = createRequire(import.meta.url)(bundle);
const results = [];
for (const points of [2048, 4096]) {
  const outer = Array.from({ length: points }, (_, index) => {
    const angle = (index * 2 * Math.PI) / points;
    return { x: 50 + 40 * Math.cos(angle), y: 50 + 40 * Math.sin(angle) };
  });
  const request = {
    kind: "compose-building",
    sources: [],
    shape: [{ outer, holes: [] }],
    nativeBuilding: true,
    erase: false,
  };
  const run = () => {
    const result = composeBuilding(request);
    if (result.mode !== "draw" || result.polygons.length !== 1 ||
        result.polygons[0].outer.length !== points)
      throw new Error(`Unexpected ${points}-point Building result`);
  };
  run();
  const samplesMs = [];
  for (let repeat = 0; repeat < 7; repeat++) {
    const start = performance.now();
    run();
    samplesMs.push(performance.now() - start);
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  results.push({ points, medianMs: sorted[3], samplesMs });
}
const report = {
  scenario: "one noncrossing regular Building ring, zero existing sources, nativeBuilding true, one warm run and seven repetitions",
  sourceSha256: createHash("sha256").update(readFileSync("src/compute.ts")).digest("hex"),
  node: process.version,
  cpu: cpus()[0]?.model,
  results,
};
writeFileSync(join(outputDirectory, "building-benchmark.json"), JSON.stringify(report, null, 2) + "\n");
for (const result of results)
  console.log(`${result.points} points: ${result.medianMs.toFixed(3)} ms median`);
