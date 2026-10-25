// Offline source-selection measurement against the frozen M0 world. Does not
// render, benchmark GPU input, or change the retained canonical fixture.
import assert from 'node:assert/strict';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { buildSync } from 'esbuild';

const root = process.cwd(),
  output = resolve('.build/atlas-geometry-world', `${Date.now()}-${process.pid}`);
await mkdir(output, { recursive: true });
const input = resolve('tests/fixtures/atlas/mixed-world.sqlite.gz');
const inputHash = createHash('sha256')
  .update(await readFile(input))
  .digest('hex');
const filename = join(output, 'workbench.sqlite');
await pipeline(
  createReadStream(input),
  createGunzip(),
  createWriteStream(filename, { flags: 'wx' }),
);
const implementation = process.env.ATLAS_GEOMETRY_MEASURE_BUNDLE
  ? resolve(process.env.ATLAS_GEOMETRY_MEASURE_BUNDLE)
  : join(output, 'measure.cjs');
if (!process.env.ATLAS_GEOMETRY_MEASURE_BUNDLE)
  buildSync({
    stdin: {
      contents:
        "export {CampaignStore} from './src/app/storage/store';export {AtlasRegionReader} from './src/app/storage/atlas-region';export {AtlasGeometryTiles} from './src/app/storage/atlas-geometry-tiles';",
      resolveDir: root,
    },
    outfile: implementation,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
const { CampaignStore, AtlasRegionReader, AtlasGeometryTiles } = require(implementation);
const store = new CampaignStore(filename);
let db;
try {
  const inspection = new Database(filename, { readonly: true });
  const campaign = inspection.prepare('SELECT id,name FROM campaign').get();
  const inventory = Object.fromEntries(
    ['room_group', 'room', 'atlas_binding', 'atlas_landscape'].map((table) => [
      table,
      inspection.prepare(`SELECT count(*) n FROM ${table} WHERE campaign_id=?`).get(campaign.id).n,
    ]),
  );
  inspection.close();
  assert.equal(inventory.room_group, 5000);
  const token = store.activateShell(campaign.id).token,
    source = store.atlasRegionSource(token);
  let statements = 0;
  db = new Database(filename, { readonly: true, verbose: () => statements++ });
  const reader = new AtlasRegionReader(db),
    start = performance.now();
  db.exec('BEGIN');
  await reader.sync(source);
  const syncMs = performance.now() - start;
  console.log(JSON.stringify({ stage: 'index-ready', syncMs, inventory }));
  const runs = [];
  for (const [name, box] of [
    ['local', { x: 0, y: 0, width: 256, height: 256 }],
    ['empty', { x: 500000, y: 500000, width: 256, height: 256 }],
    ['city-overview', { x: 0, y: 0, width: 4096, height: 4096 }],
  ]) {
    const at = performance.now(),
      before = statements;
    let result;
    try {
      const value = reader.geometryTileSource(source, box);
      result = {
        rooms: value.workspace.rooms.length,
        buildings: value.cities.reduce((n, c) => n + c.units.length, 0),
        bindings: value.bindings.length,
        coverage: value.region.coverage,
        geometryDigest: createHash('sha256')
          .update(
            JSON.stringify([
              value.cities,
              value.bindings,
              value.workspace,
              value.geometry,
              value.region.frames,
              value.region.interiors,
            ]),
          )
          .digest('hex'),
      };
    } catch (error) {
      result = { error: String(error.message) };
    }
    const row = {
      name,
      box,
      ms: performance.now() - at,
      statements: statements - before,
      ...result,
    };
    runs.push(row);
    console.log(JSON.stringify(row));
  }
  const overviewRuns = [];
  if (AtlasGeometryTiles) {
    for (const name of ['cold-overview', 'reopened-tile-cache']) {
      const tiles = new AtlasGeometryTiles(join(output, 'tile-cache')),
        at = performance.now(),
        before = statements;
      let yields = 0;
      try {
        const steps = tiles.read(
          source,
          { tile: { lod: 4, x: 0, y: 0 }, revision: source.revision },
          reader,
        );
        for (;;) {
          const step = steps.next();
          if (step.done) {
            const value = step.value,
              overview = value.model.overviews[0];
            const row = {
              name,
              ms: performance.now() - at,
              statements: statements - before,
              yields,
              cache: value.cache,
              modeledObjects: overview.modeledObjects,
              meshes: overview.meshes.length,
              bytes: overview.meshes.reduce(
                (n, m) => n + m.positions.byteLength + m.indices.byteLength,
                0,
              ),
              triangles: overview.meshes.reduce((n, m) => n + m.indices.length / 3, 0),
              coverage: value.model.coverage,
              digest: createHash('sha256')
                .update(
                  Buffer.concat(
                    overview.meshes.flatMap((m) => [
                      Buffer.from(
                        m.positions.buffer,
                        m.positions.byteOffset,
                        m.positions.byteLength,
                      ),
                      Buffer.from(m.indices.buffer, m.indices.byteOffset, m.indices.byteLength),
                    ]),
                  ),
                )
                .digest('hex'),
            };
            assert(row.modeledObjects > 0);
            assert(row.meshes <= 2);
            assert(row.bytes <= 5898240);
            overviewRuns.push(row);
            console.log(JSON.stringify(row));
            break;
          }
          yields++;
          db.exec('COMMIT');
          db.exec('BEGIN');
        }
      } finally {
        tiles.close();
      }
    }
    assert.equal(overviewRuns[1].cache, 'hit');
    assert.equal(overviewRuns[0].digest, overviewRuns[1].digest);
  }
  db.exec('COMMIT');
  assert(runs[0].rooms > 0);
  assert.equal(runs[1].rooms, 0);
  const files = [
    'src/app/storage/atlas-region.ts',
    'src/app/storage/atlas-geometry-tiles.ts',
    'src/app/atlas/atlas-geometry-overview.ts',
    'tools/measure-atlas-geometry-world.mjs',
  ];
  const hashes = Object.fromEntries(
    await Promise.all(
      files.map(async (f) => [
        f,
        createHash('sha256')
          .update(await readFile(f))
          .digest('hex'),
      ]),
    ),
  );
  const implementationHash = createHash('sha256')
    .update(await readFile(implementation))
    .digest('hex');
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        scope:
          'Offline geometry source and coarse tile generation/cache. Excludes worker IPC and GPU; warm tile cache reopening reuses the same reader/index.',
        inputHash,
        implementation,
        implementationHash,
        campaign,
        inventory,
        syncMs,
        runs,
        overviewRuns,
        hashes,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ complete: true, output }));
} finally {
  db?.close();
  store.close();
}
