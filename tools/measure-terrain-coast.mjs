// Paired raster completion with precomputed canonical water/heights. No database writes.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url),
  baseline = '32c7f49184d59b30e9dabc9756f159543fcf3f56',
  out = process.env.QA_EVIDENCE_DIR ?? '.build/coast-cost';
await mkdir(out, { recursive: true });
for (const mode of ['baseline', 'current'])
  await build({
    stdin: {
      resolveDir: process.cwd(),
      contents:
        "export * from './src/app/landscape-raster';export * from './src/app/terrain-height';",
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: '.build/coast-cost-' + mode + '.cjs',
    plugins:
      mode === 'baseline'
        ? [
            {
              name: 'old-coast',
              setup(b) {
                b.onLoad({ filter: /landscape-raster\.ts$/ }, () => ({
                  contents: execFileSync(
                    'git',
                    ['show', baseline + ':src/app/landscape-raster.ts'],
                    { encoding: 'utf8' },
                  ),
                  loader: 'ts',
                }));
              },
            },
          ]
        : [],
  });
const modules = {
    baseline: require('../.build/coast-cost-baseline.cjs'),
    current: require('../.build/coast-cost-current.cjs'),
  },
  box = { x: -450, y: -300, width: 900, height: 600 },
  lattice = new modules.current.LandscapeRasterizer(box, 1024, 768).sampleLattice(),
  n = lattice.columns * lattice.rows;
const hash = (data) =>
  createHash('sha256')
    .update(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
    .digest('hex');
const result = {
  baseline,
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  sourceHashes: {},
  measurements: [],
};
for (const file of [
  'src/app/landscape-raster.ts',
  'src/app/terrain-coast.ts',
  'tools/measure-terrain-coast.mjs',
])
  result.sourceHashes[file] = hash(Buffer.from(await readFile(file)));
for (const fixture of ['coast', 'land']) {
  const heights = Float32Array.from({ length: n }, (_, i) =>
    fixture === 'land'
      ? 40
      : 80 * Math.sin((lattice.x + (i % lattice.columns) * lattice.dx) / 150) +
        30 * Math.cos((lattice.y + Math.floor(i / lattice.columns) * lattice.dy) / 75),
  );
  const water = Uint8Array.from(heights, (z) => (z <= 0 ? 1 : 0)),
    before = [hash(heights), hash(water)],
    digests = new Map();
  for (const mode of ['baseline', 'current', 'current', 'baseline']) {
    const { LandscapeRasterizer, settingsRecord } = modules[mode],
      settings = settingsRecord(0);
    settings.terrainSettings.style = {
      version: 1,
      mode: 'shaded',
      land: '#eee5cf',
      ink: '#685639',
      strength: 0.65,
      lightDegrees: 315,
    };
    const image = new LandscapeRasterizer(box, 1024, 768, 0),
      start = performance.now();
    image.paint(settings);
    image.setTerrainField({ heights, water });
    const pixels = image.finish(),
      ms = performance.now() - start,
      digest = hash(pixels);
    assert.deepEqual([hash(heights), hash(water)], before);
    if (digests.has(mode)) assert.equal(digest, digests.get(mode));
    digests.set(mode, digest);
    result.measurements.push({ fixture, mode, ms, pixels: 1024 * 768, digest });
    console.log(fixture + ' ' + mode + ' ' + Math.round(ms) + ' ms');
  }
  if (fixture === 'coast')
    assert.notEqual(
      digests.get('baseline'),
      digests.get('current'),
      'intentional coast ink change',
    );
  else
    assert.equal(digests.get('baseline'), digests.get('current'), 'inland pixels remain identical');
}
await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
