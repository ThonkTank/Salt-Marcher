import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, cpus } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const mode = process.argv[2];
if (mode !== "full" && mode !== "local")
  throw new Error("Usage: node tools/bench-building-points.mjs full|local [output directory]");
const directory = resolve(process.argv[3] ??
  join(homedir(), ".cache/dungeon-native-qa/building-point-benchmark"));
mkdirSync(directory, { recursive: true });
const output = join(directory, "point-benchmark.cjs");
const wrapper = join(directory, "point-benchmark-entry.ts");
writeFileSync(wrapper, `export { previewBuildingVertexDrag } from ${JSON.stringify(resolve("src/features/bau/building-point-gestures.ts"))};\nexport { previewBuildingMutationWithPortals } from ${JSON.stringify(resolve("src/features/bau/building-edge-portal-preview.ts"))};\n`);
await build({ entryPoints: [wrapper], outfile: output, bundle: true,
  platform: "node", format: "cjs", target: "node22", logLevel: "silent" });
const { previewBuildingVertexDrag, previewBuildingMutationWithPortals } =
  createRequire(import.meta.url)(output);
const sourceFiles = ["src/features/bau/building-point-gestures.ts",
  "src/features/bau/building-edge-portal-preview.ts", "src/geometry.ts"];
const hashes = Object.fromEntries(sourceFiles.map(file => [file,
  createHash("sha256").update(readFileSync(file)).digest("hex")]));
const results = [];
for (const points of [32, 512]) for (const foreign of [0, 4000]) {
  const outer = Array.from({ length: points }, (_, index) => {
    const angle = 2 * Math.PI * index / points;
    return { x: 50 + 20 * Math.cos(angle), y: 50 + 20 * Math.sin(angle) };
  });
  const building = { id: "building", kind: "building", floorId: "floor-1",
    polygons: [{ outer, holes: [] }], layer: 200, fill: 0xbfb09a,
    wall: 0x403e39, wallWidth: 0.2 };
  const doors = [0.1, 0.6].map((at, index) => ({ id: "door-" + index,
    kind: "door", floorId: "floor-1", anchor: { boundaryId: building.id,
      contour: 0, at }, width: 0.7, variant: "door" }));
  const entities = new Map([[building.id, building],
    ...doors.map(door => [door.id, door]),
    ...Array.from({ length: foreign }, (_, index) => ["other-" + index,
      { id: "other-" + index, kind: "object", floorId: "floor-1" }])]);
  const dependents = new Set(doors.map(door => door.id));
  const grip = { buildingId: building.id, contour: 0, index: 0, point: outer[0] };
  const edit = { kind: "move", contour: 0, index: 0 };
  const run = (which) => {
    const after = previewBuildingVertexDrag(building, grip,
      { x: outer[0].x + 0.125, y: outer[0].y + 0.25 });
    if (!after) throw new Error("Missing point proposal");
    const candidates = which === "full" ? [...entities.values()]
      : [...dependents].map(id => entities.get(id))
        .filter(entity => entity?.kind === "door" &&
          entity.anchor?.boundaryId === building.id);
    return previewBuildingMutationWithPortals(candidates, building, after, edit);
  };
  const old = run("full"), current = run("local");
  if (JSON.stringify(old) !== JSON.stringify(current) || old.portals.length !== 2)
    throw new Error("Full and local portal preview differ");
  for (let index = 0; index < 20; index++) run(mode);
  const samplesMs = [];
  for (let repeat = 0; repeat < 9; repeat++) {
    const start = performance.now();
    for (let index = 0; index < 50; index++) run(mode);
    samplesMs.push((performance.now() - start) / 50);
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  results.push({ points, foreign, medianMsPerPreview: sorted[4], samplesMs });
}
const report = { mode, scenario: "One moved vertex, two attached portals, 50 proposals per repeat, 20 warmups, nine repeats; full copies all entities, local uses dependent ids", sourceHashes: hashes,
  node: process.version, cpu: cpus()[0]?.model, results };
writeFileSync(join(directory, mode + "-building-points.json"),
  JSON.stringify(report, null, 2) + "\n");
for (const result of results)
  console.log(`${result.points} points / ${result.foreign} foreign: ${result.medianMsPerPreview.toFixed(4)} ms`);
