import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, cpus } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const outputDirectory = resolve(process.argv[2] ??
  join(homedir(), ".cache/dungeon-native-qa/native-floor-benchmark"));
mkdirSync(outputDirectory, { recursive: true });
const bundle = join(outputDirectory, "native-floor-benchmark.cjs");
await build({ entryPoints: ["src/features/material/native-floor-tiles.ts"],
  outfile: bundle, bundle: true, platform: "node", format: "cjs",
  target: "node22", logLevel: "silent" });
const { nativeFloorCells, nativeFloorVariants, floorPolygonTouchesCell } =
  createRequire(import.meta.url)(bundle);
const assetId = ["pack", "dungeondraft-builtin-1.2.0.1", "tileset",
  "res://textures/tilesets/smart/tileset_wood_vertical.png"]
  .map(encodeURIComponent).join(":");
const shape = (points, cx, cy, rx, ry) => [{ outer: Array.from({ length: points }, (_, i) => {
  const angle = i * 2 * Math.PI / points;
  return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
}), holes: [] }];
const building = (id, polygons) => ({ id, kind: "building", floorId: "floor-1",
  polygons, layer: 200, fill: 0xffffff, wall: 0xffffff, wallWidth: 0.2,
  material: { assetId, tileSize: 4, tint: 0xffffff, rotation: 0 } });
const sha = value => createHash("sha256").update(value).digest("hex");
const results = [];
for (const [width, height] of [[20, 12], [128, 128]])
  for (const points of [32, 512])
    for (const others of [0, 6]) {
      const cx = width / 2, cy = height / 2,
        rx = width * 0.28, ry = height * 0.28;
      const stored = building("edited", shape(points, cx, cy, rx, ry));
      const siblings = Array.from({ length: others }, (_, i) => building(
        `other-${i}`, shape(4, width * (0.16 + i * 0.1),
          height * (0.16 + (i % 3) * 0.23), width * 0.045, height * 0.045)));
      const buildings = [stored, ...siblings];
      const run = step => {
        const replacement = building("edited", shape(points,
          cx + (step % 5 - 2) * 0.04, cy + (step % 3 - 1) * 0.04, rx, ry));
        const variantStart = performance.now();
        const cells = nativeFloorCells(buildings, "floor-1", width, height,
          replacement);
        const variants = nativeFloorVariants(cells, width, height);
        const variantMs = performance.now() - variantStart;
        const coverageStart = performance.now(), coverage = new Uint8Array(width * height);
        const outer = replacement.polygons[0].outer;
        const minX = Math.max(0, Math.floor(Math.min(...outer.map(p => p.x))));
        const maxX = Math.min(width, Math.ceil(Math.max(...outer.map(p => p.x))));
        const minY = Math.max(0, Math.floor(Math.min(...outer.map(p => p.y))));
        const maxY = Math.min(height, Math.ceil(Math.max(...outer.map(p => p.y))));
        for (let y = minY; y < maxY; y++)
          for (let x = minX; x < maxX; x++)
            if (variants[y * width + x] !== 255 ||
                floorPolygonTouchesCell(outer, x, y))
              coverage[y * width + x] = 1;
        return { variants, coverage, variantMs,
          coverageMs: performance.now() - coverageStart };
      };
      run(0);
      const samplesMs = [], coverageSamplesMs = [], outputHashes = [],
        coverageHashes = [];
      for (let step = 0; step < 9; step++) {
        const { variants, coverage, variantMs, coverageMs } = run(step);
        samplesMs.push(variantMs);
        coverageSamplesMs.push(coverageMs);
        outputHashes.push(sha(variants));
        coverageHashes.push(sha(coverage));
      }
      const ordered = [...samplesMs].sort((a, b) => a - b),
        coverageOrdered = [...coverageSamplesMs].sort((a, b) => a - b);
      results.push({ width, height, points, otherBuildings: others,
        medianMs: ordered[4], samplesMs, outputHashes,
        coverageMedianMs: coverageOrdered[4], coverageSamplesMs, coverageHashes });
    }
const report = { scenario: "native Building replacement; one warm run, nine distinct target positions per case",
  buildSha256: sha(readFileSync("main.js")),
  sourceSha256: sha(readFileSync("src/features/material/native-floor-tiles.ts")),
  node: process.version, cpu: cpus()[0]?.model, results };
writeFileSync(join(outputDirectory, "native-floor-benchmark.json"),
  JSON.stringify(report, null, 2) + "\n");
for (const item of results)
  console.log(`${item.width}x${item.height}, ${item.points} points, ${item.otherBuildings} others: variants ${item.medianMs.toFixed(3)} ms, coverage ${item.coverageMedianMs.toFixed(3)} ms`);
