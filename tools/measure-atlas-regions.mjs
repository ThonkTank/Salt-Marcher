import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
const require = createRequire(import.meta.url),
  child = process.argv.includes('--child');
if (!child)
  buildSync({
    stdin: {
      contents:
        "export {CampaignStore} from './src/app/storage/store';export {AtlasRegionReader} from './src/app/storage/atlas-region';",
      resolveDir: process.cwd(),
    },
    outfile: '.build/measure-atlas-regions.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const { CampaignStore, AtlasRegionReader } = require('../.build/measure-atlas-regions.cjs'),
  Database = require('better-sqlite3');
if (child) {
  const [, file, id, mode] = process.argv.slice(2),
    opening = performance.now(),
    store = new CampaignStore(file),
    storeOpened = performance.now(),
    shell = store.activateShell(id),
    shellOpened = performance.now(),
    sizes = [],
    latencies = [],
    phasesMs = { storeOpen: storeOpened - opening, shell: shellOpened - storeOpened };
  let result, db, reader, source;
  const first = performance.now();
  if (mode === 'full') result = store.atlasRenderView(shell.token);
  else {
    db = new Database(file, { readonly: true });
    reader = new AtlasRegionReader(db);
    const setup = performance.now();
    source = store.atlasRegionSource(shell.token);
    const fenced = performance.now();
    db.exec('BEGIN');
    await reader.sync(source);
    db.exec('COMMIT');
    const synced = performance.now(),
      geometry = reader.read(source, {
        box: { x: 0, y: 0, width: 30, height: 20 },
        width: 1024,
        height: 768,
        scopeId: 'local',
        floorId: 'ground',
        slice: null,
        roofs: true,
      }),
      read = performance.now();
    result = store.atlasRegionView(shell.token, geometry);
    const wrapped = performance.now();
    JSON.stringify(result);
    Object.assign(phasesMs, {
      readerSetup: setup - first,
      sourceFence: fenced - setup,
      checksumAndProjection: synced - fenced,
      regionReadAndRaster: read - synced,
      view: wrapped - read,
      transportEncoding: performance.now() - wrapped,
    });
  }
  const coldMs = performance.now() - first,
    initialBytes = Buffer.byteLength(JSON.stringify(result));
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    if (mode === 'full') result = store.atlasRenderView(shell.token);
    else {
      source = store.atlasRegionSource(shell.token, {
        epoch: source.epoch,
        sequence: source.sequence,
      });
      db.exec('BEGIN');
      await reader.sync(source);
      db.exec('COMMIT');
      result = store.atlasRegionView(
        shell.token,
        reader.read(source, {
          box: { x: i % 5, y: 0, width: 30, height: 20 },
          width: 1024,
          height: 768,
          scopeId: 'local',
          floorId: 'ground',
          slice: null,
          roofs: true,
        }),
      );
    }
    sizes.push(Buffer.byteLength(JSON.stringify(result)));
    latencies.push(performance.now() - start);
  }
  latencies.sort((a, b) => a - b);
  db?.close();
  store.close();
  console.log(
    JSON.stringify({
      mode,
      phasesMs,
      coldMs,
      initialBytes,
      maxReplyBytes: Math.max(...sizes),
      warmMedianMs: latencies[14],
      warmP95Ms: latencies[28],
      maxRssKiB: process.resourceUsage().maxRSS,
    }),
  );
} else {
  const dir = mkdtempSync(tmpdir() + '/atlas-region-measure-'),
    results = [];
  try {
    for (const count of [4000, 12000]) {
      const file = dir + '/' + count + '.sqlite',
        store = new CampaignStore(file),
        rooms = Array.from({ length: count }, (_, i) => ({
          id: 'r' + i,
          scopeId: 'local',
          floorId: 'ground',
          number: String(i),
          name: 'Raum ' + i,
          revision: 0,
          polygons: [
            {
              outer: [
                { x: i * 5, y: 0 },
                { x: i * 5 + 3, y: 0 },
                { x: i * 5 + 3, y: 3 },
                { x: i * 5, y: 3 },
              ],
              holes: [],
            },
          ],
          sections: [
            { id: randomUUID(), kind: 'markdown', markdown: 'PRIVATE\r\n' + 'x'.repeat(4096) },
          ],
        })),
        cam = store.create('Messkarte', rooms),
        w = store.activateShell(cam.id),
        city = store.executeAtlasCommit({
          commandId: randomUUID(),
          token: w.token,
          campaignId: cam.id,
          action: {
            kind: 'city-create',
            name: 'Stadt',
            x: 50000,
            y: 40000,
            width: 2000,
            height: 2000,
          },
        }).result.id;
      store.db.transaction(() => {
        for (let i = 0; i < 5000; i++) {
          const u = {
              id: 'b' + i,
              kind: 'building',
              name: 'Haus ' + i,
              protected: true,
              position: { x: (i % 100) * 12, y: Math.floor(i / 100) * 12 },
              angle: 0,
              outline: [
                { x: -3, y: -3 },
                { x: 3, y: -3 },
                { x: 3, y: 3 },
                { x: -3, y: 3 },
              ],
              notes: 'PRIVATE ' + 'x'.repeat(4096),
              residentIds: [],
              workerIds: [],
            },
            p = JSON.stringify(u);
          store.db
            .prepare('INSERT INTO city_unit VALUES(?,?,?,?,?,?)')
            .run(cam.id, city, u.id, u.kind, p, createHash('sha256').update(p).digest('hex'));
        }
      })();
      store.close();
      for (const mode of ['full', 'region']) {
        const run = spawnSync(
          process.execPath,
          [import.meta.filename, '--child', file, cam.id, mode],
          { encoding: 'utf8', maxBuffer: 1024 * 1024 },
        );
        if (run.status !== 0) throw new Error(run.stderr || 'Measurement child failed');
        results.push({ rooms: count, buildings: 5000, ...JSON.parse(run.stdout) });
      }
    }
    const report = {
      bundleSha256: createHash('sha256')
        .update(require('node:fs').readFileSync('.build/measure-atlas-regions.cjs'))
        .digest('hex'),
      source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      method:
        'Separate fresh Node processes. Thirty warm reads. Store opening and shell activation are reported separately. Checksum/projection and read/raster are combined stage timings, not isolated CPU costs. Cold read includes TEMP projection build in the same readonly transaction boundary as the worker. MaxRSS is Node + SQLite, excludes Electron, GPU, OS cache and physical 16-GiB qualification.',
      results,
    };
    if (process.env.QA_EVIDENCE_FILE)
      writeFileSync(process.env.QA_EVIDENCE_FILE, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
