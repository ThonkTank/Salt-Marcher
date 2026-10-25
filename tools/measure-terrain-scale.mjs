// Reproduce the exact user radius against the saved pre-change source and the current source.
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const require = createRequire(import.meta.url),
  root = process.cwd(),
  radius = 2500 * 1609.344;
if (process.argv[2] === '--child') {
  const { CampaignStore, heightRecord } = require(process.argv[3]),
    base = homedir() + '/.cache/saltmarcher/benchmarks';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/scale-author-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    cam = store.create('Scale benchmark'),
    token = store.activateShell(cam.id).token,
    side = 64,
    put = store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  store.db.transaction(() => {
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        const r = heightRecord(x * 32768, y * 32768, 512, new Float32Array(4096).fill(100));
        put.run(
          cam.id,
          r.id,
          1,
          x * 32768 - 512,
          (x + 1) * 32768,
          y * 32768 - 512,
          (y + 1) * 32768,
          JSON.stringify({ ...r, revision: 1 }),
        );
      }
  })();
  const hash = () => {
    const h = createHash('sha256');
    for (const r of store.db
      .prepare("SELECT id,json_extract(payload,'$.height') height FROM atlas_landscape ORDER BY id")
      .iterate())
      h.update(JSON.stringify(r));
    return h.digest('hex');
  };
  const initial = hash(),
    samples = [];
  for (let i = 0; i < 4; i++) {
    const start = performance.now();
    let error;
    try {
      store.executeAtlasCommit({
        commandId: randomUUID(),
        campaignId: cam.id,
        token,
        action: {
          kind: 'landscape-height-stroke',
          stroke: {
            mode: 'raise',
            radius,
            strength: 1000,
            feather: 0,
            samples: [
              { x: 1048576, y: 1048576, t: 0 },
              { x: 1048576, y: 1048576, t: 100 },
            ],
          },
        },
      });
    } catch (e) {
      error = e.message;
    }
    const milliseconds = performance.now() - start,
      changed = hash() !== initial,
      tiles = store.db.prepare('SELECT count(*) n FROM atlas_landscape').get().n - side * side;
    if (!error) {
      if (!changed) throw Error('No actual change');
      store.executeAtlasCommit({
        commandId: randomUUID(),
        campaignId: cam.id,
        token,
        action: { kind: 'undo' },
      });
      if (hash() !== initial) throw Error('Undo changed original bytes');
    } else if (changed) throw Error('Failed command changed terrain');
    samples.push({ milliseconds, error, changed, newTiles: tiles, rss: process.memoryUsage().rss });
  }
  store.close();
  console.log(
    JSON.stringify({
      radiusM: radius,
      legacyTiles: 4096,
      samples,
      peakRssKiB: process.resourceUsage().maxRSS,
    }),
  );
} else {
  const out =
    process.env.QA_EVIDENCE_DIR ?? homedir() + '/.cache/saltmarcher/r74-multiscale-benchmark';
  mkdirSync(out, { recursive: true });
  const report = {};
  for (const [name, source] of Object.entries({
    baseline: homedir() + '/.cache/saltmarcher/r74-multiscale-before',
    current: root,
  })) {
    const bundle = root + '/.build/terrain-scale-benchmark-' + name + '.cjs';
    require('esbuild').buildSync({
      stdin: {
        contents: `export * from '${source}/src/app/storage/store';export * from '${source}/src/app/terrain-height';`,
        resolveDir: root,
      },
      nodePaths: [root + '/node_modules'],
      outfile: bundle,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const result = spawnSync(process.execPath, [import.meta.filename, '--child', bundle], {
      encoding: 'utf8',
      timeout: 180000,
    });
    if (result.status !== 0) throw Error(result.stderr || result.stdout);
    report[name] = {
      ...JSON.parse(result.stdout.trim().split('\n').at(-1)),
      bundleHash: createHash('sha256').update(readFileSync(bundle)).digest('hex'),
    };
  }
  writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
