// Paired cold region reads, with and without terrain already owned by the main GPU camera.
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd(),
  out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-ground-measure'),
  require = createRequire(root + '/package.json');
mkdirSync(out, { recursive: true });
for (const [name, file] of [
  ['service', 'desktop/atlas-region.ts'],
  ['worker', 'desktop/atlas-region-worker.ts'],
])
  buildSync({
    entryPoints: [file],
    outfile: out + '/' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
buildSync({
  stdin: {
    resolveDir: root,
    contents: "export * from './src/app/storage/store';export * from './src/app/atlas/terrain-height';",
  },
  outfile: out + '/fixture.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, heightRecord } = require(out + '/fixture.cjs'),
  { AtlasRegionService } = require(out + '/service.cjs'),
  base = homedir() + '/.cache/saltmarcher/tests';
mkdirSync(base, { recursive: true });
const profile = mkdtempSync(base + '/ground-measure-');
const store = new CampaignStore(profile + '/world.sqlite'),
  campaign = store.create('Ground work'),
  token = store.activate(campaign.id).token;
for (let y = -1; y <= 0; y++)
  for (let x = -1; x <= 0; x++)
    store.executeAtlasCommit({
      campaignId: campaign.id,
      token,
      commandId: randomUUID(),
      action: {
        kind: 'landscape-put',
        expectedRevision: null,
        record: heightRecord(
          x * 1024,
          y * 1024,
          16,
          Float32Array.from({ length: 4096 }, (_, i) => {
            const px = x * 1024 + (i % 64) * 16,
              py = y * 1024 + Math.floor(i / 64) * 16;
            return 20 + 90 * Math.exp(-(px * px + py * py) / 40000);
          }),
        ),
      },
    });
const query = {
    box: { x: -900, y: -600, width: 1800, height: 1200 },
    width: 2000,
    height: 1334,
    scopeId: null,
    floorId: 'ground',
    slice: null,
    roofs: true,
    contours: 0,
  },
  runs = [];
let canonical;
try {
  for (const terrainRaster of [true, false, false, true]) {
    const service = new AtlasRegionService(out + '/worker.cjs');
    try {
      // Warm index and IPC, without populating the measured ground tiles.
      await service.read(store.atlasRegionSource(token), {
        ...query,
        box: { x: 1e7, y: 1e7, width: 1, height: 1 },
        width: 1,
        height: 1,
      });
      const start = performance.now(),
        value = await service.read(store.atlasRegionSource(token, service.cursor), {
          ...query,
          terrainRaster,
        }),
        ms = performance.now() - start;
      assert.equal(value.landscape.state, 'ready');
      const tiles = value.landscape.tiles.length,
        bytes = Buffer.byteLength(JSON.stringify(value));
      const geometry = { ...value, landscape: { ...value.landscape, tiles: [] } };
      if (canonical) assert.deepEqual(geometry, canonical);
      else canonical = geometry;
      assert.equal(tiles > 0, terrainRaster);
      assert.equal(service.diagnostics.workerStarts, 1);
      const row = {
        terrainRaster,
        ms,
        tiles,
        bytes,
        workerStarts: service.diagnostics.workerStarts,
      };
      runs.push(row);
      console.log(JSON.stringify(row));
    } finally {
      await service.close();
    }
  }
} finally {
  store.close();
  writeFileSync(
    out + '/result.json',
    JSON.stringify(
      {
        source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        profile,
        query,
        runs,
      },
      null,
      2,
    ),
  );
}
