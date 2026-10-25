// Paired bounded field-kernel experiment; no database or author mutations.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  interpolationStreamPlugin,
  INTERPOLATION_BASELINE,
  LATTICE_BASELINE,
} from './terrain-interpolation-build.mjs';
import { installInterpolation, monotone } from './terrain-interpolation-probe.mjs';
const out = process.env.QA_EVIDENCE_DIR ?? '.build/terrain-interpolation/kernel';
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url),
  contents =
    "export * from './src/app/atlas/terrain-field-stream';export * from './src/app/atlas/terrain-height';";
for (const name of ['baseline', 'monotone', 'lattice', 'monotone-lattice'])
  await build({
    stdin: { resolveDir: process.cwd(), contents },
    outfile: '.build/terrain-interpolation-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    plugins: name === 'monotone-lattice' ? [] : [interpolationStreamPlugin(name)],
  });
const base = require('../.build/terrain-interpolation-baseline.cjs'),
  candidate = require('../.build/terrain-interpolation-monotone.cjs'),
  latticeModule = require('../.build/terrain-interpolation-lattice.cjs'),
  sharedMonotone = require('../.build/terrain-interpolation-monotone-lattice.cjs');
installInterpolation(candidate.TerrainSampler, monotone);
const { heightRecord } = base,
  fixtures = [
    {
      name: 'hill',
      rows: [16].flatMap((p) =>
        [-1, 0].flatMap((y) =>
          [-1, 0].map((x) =>
            heightRecord(
              x * 64 * p,
              y * 64 * p,
              p,
              Float32Array.from(
                { length: 4096 },
                (_, i) =>
                  20 +
                  90 *
                    Math.exp(
                      -(
                        (x * 64 * p + (i % 64) * p) ** 2 +
                        (y * 64 * p + Math.floor(i / 64) * p) ** 2
                      ) / 40000,
                    ),
              ),
            ),
          ),
        ),
      ),
    },
    {
      name: 'sparse-bands',
      rows: [8, 2, 0.5].flatMap((p) =>
        [1, 2].flatMap((v) =>
          [-1, 0].flatMap((y) =>
            [-1, 0].map((x) =>
              heightRecord(
                x * 64 * p,
                y * 64 * p,
                p,
                Float32Array.from({ length: 4096 }, (_, i) =>
                  i % 7 === 0 ? NaN : (v === 1 ? 40 : 0) + Math.sin(i) * 17,
                ),
                v,
              ),
            ),
          ),
        ),
      ),
    },
  ];
const result = {
  baseline: INTERPOLATION_BASELINE,
  bilinearLattice: LATTICE_BASELINE,
  candidate: 'current production bounded cubic',
  productSource: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  checks: [],
  measurements: [],
};
result.dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
result.sourceHashes = {};
for (const file of [
  'src/app/atlas/terrain-height.ts',
  'src/app/atlas/terrain-height-lattice.ts',
  'src/app/atlas/terrain-interpolation.ts',
  'src/app/atlas/terrain-field-stream.ts',
  'tools/measure-terrain-interpolation.mjs',
  'tools/terrain-interpolation-build.mjs',
  'tools/terrain-interpolation-probe.mjs',
])
  result.sourceHashes[file] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
const point = { x: 0.5, y: 7.125 },
  rows = [-1, 0].flatMap((y) =>
    [-1, 0].map((x) =>
      heightRecord(
        x * 64,
        y * 64,
        1,
        Float32Array.from(
          { length: 4096 },
          (_, i) => 40 + 2 * (x * 64 + (i % 64)) + 0.25 * (y * 64 + Math.floor(i / 64)),
        ),
      ),
    ),
  ),
  inside = (r, halo) => {
    const t = r.height;
    return (
      point.x >= t.x - halo * t.pixel &&
      point.x <= t.x + (63 + halo) * t.pixel &&
      point.y >= t.y - halo * t.pixel &&
      point.y <= t.y + (63 + halo) * t.pixel
    );
  };
const height = (rows) => new candidate.TerrainSampler(rows, false).sample(point).heightM;
result.neighbourRead = {
  point,
  all: height(rows),
  oldBounds: height(rows.filter((r) => inside(r, 1))),
  expandedBounds: height(rows.filter((r) => inside(r, 2))),
};
assert(
  Math.abs(result.neighbourRead.all - result.neighbourRead.oldBounds) > 0.001,
  'cubic reconstruction requires the extra neighbour at source tile boundaries',
);
assert.equal(result.neighbourRead.all, result.neighbourRead.expandedBounds);
result.checks.push(
  'Cubic reconstruction requires expanded reader and invalidation support; old one-cell footprints demonstrably under-read neighbouring heights.',
);
for (const f of fixtures) {
  f.rows.sort((a, b) => b.resolution - a.resolution);
  const read = (kind) => (kind === 'height' ? f.rows : []),
    sampler = new candidate.TerrainSampler(f.rows, false);
  for (const offset of [-64.25, -0.125, 63.875]) {
    const lattice = { x: offset, y: offset + 0.125, dx: 0.375, dy: 0.5, columns: 97, rows: 65 },
      field = candidate.streamTerrainField(lattice, 0, read);
    for (let y = 0; y < lattice.rows; y++)
      for (let x = 0; x < lattice.columns; x++)
        assert.equal(
          field.heights[y * lattice.columns + x],
          Math.fround(
            sampler.sample({ x: lattice.x + x * lattice.dx, y: lattice.y + y * lattice.dy })
              .heightM,
          ),
        );
    assert.deepEqual(
      latticeModule.streamTerrainField(lattice, 0, read),
      base.streamTerrainField(lattice, 0, read),
    );
    assert.deepEqual(sharedMonotone.streamTerrainField(lattice, 0, read), field);
    const a = candidate.streamTerrainFieldBlock(
      lattice,
      { x: 11, y: 13, width: 31, height: 17 },
      0,
      read,
    );
    for (let y = 0; y < 17; y++)
      for (let x = 0; x < 31; x++)
        assert.equal(a.heights[y * 31 + x], field.heights[(y + 13) * 97 + x + 11]);
  }
  result.checks.push(
    f.name +
      ': bounded stream, canonical experiment and partial blocks agree at fractional origins and negative tile seams',
  );
  const lattice = {
    x: -80.125,
    y: -80.375,
    dx: 160 / 1024,
    dy: 160 / 1024,
    columns: 1024,
    rows: 1024,
  };
  for (const name of [
    'baseline',
    'lattice',
    'monotone',
    'monotone-lattice',
    'monotone-lattice',
    'monotone',
    'lattice',
    'baseline',
  ]) {
    const start = performance.now(),
      field = (
        name === 'baseline'
          ? base
          : name === 'lattice'
            ? latticeModule
            : name === 'monotone-lattice'
              ? sharedMonotone
              : candidate
      ).streamTerrainField(lattice, 0, read, false),
      elapsed = performance.now() - start;
    result.measurements.push({ fixture: f.name, name, samples: field.heights.length, ms: elapsed });
    console.log(f.name + ' ' + name + ' ' + Math.round(elapsed) + ' ms');
  }
}
await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
console.log(result.checks);
