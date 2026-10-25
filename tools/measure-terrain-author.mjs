// Compare canonical writes in isolated synthetic worlds. No UI or real campaign is opened.
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Session } from 'node:inspector';
import path from 'node:path';
const require = createRequire(import.meta.url),
  root = process.cwd();
if (process.argv[2] === '--child') {
  const { CampaignStore, heightRecord, readTerrainGrid } = require(process.argv[3]),
    base = homedir() + '/.cache/saltmarcher/benchmarks';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/terrain-author-');
  const store = new CampaignStore(dir + '/world.sqlite'),
    cam = store.create('Author benchmark'),
    token = store.activateShell(cam.id).token,
    side = Number(process.env.TERRAIN_TILES_SIDE ?? 64);
  const put = store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
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
          JSON.stringify(r),
        );
      }
  })();
  const point = { x: side * 16384, y: side * 16384 },
    edge = side * 32768,
    box = { x: 0, y: 0, width: edge, height: edge },
    visibility = {
      box,
      frame: box,
      columns: 193,
      rows: 193,
      focusM: 100,
      tilt: 45,
      rotation: 0,
      exaggeration: 2,
    },
    runs = [];
  const hash = () => {
    const digest = createHash('sha256');
    for (const r of store.db
      .prepare(
        "SELECT id,json_extract(payload,'$.height') height FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.height') IS NOT NULL ORDER BY id",
      )
      .iterate(cam.id))
      digest.update(JSON.stringify(r));
    return digest.digest('hex');
  };
  const initial = hash();
  const profiler = new Session(),
    profileCall = (method) =>
      new Promise((resolve, reject) =>
        profiler.post(method, (e, r) => (e ? reject(e) : resolve(r))),
      );
  if (process.env.TERRAIN_CPU_PROFILE) {
    profiler.connect();
    await profileCall('Profiler.enable');
  }
  for (let i = 0; i < 3; i++) {
    // Both versions prepare the same canonical viewport before a gesture. Only
    // versions with the trusted seed API reuse this already computed grid.
    let preparationMs = 0;
    if (process.env.TERRAIN_AUTHOR_SEED === '1') {
      const started = performance.now(),
        source = store.atlasRegionSource(token),
        grid = readTerrainGrid(store.db, cam.id, visibility);
      store.rememberTerrainGrid?.(token, source.fence, grid);
      preparationMs = performance.now() - started;
    }
    if (process.env.TERRAIN_CPU_PROFILE) await profileCall('Profiler.start');
    globalThis.__saltTerrainTrace = { events: [], dropped: 0 };
    const started = performance.now();
    store.executeAtlasCommit({
      commandId: randomUUID(),
      campaignId: cam.id,
      token,
      action: {
        kind: 'landscape-height-stroke',
        stroke: {
          mode: 'raise',
          radius: 12000,
          strength: 1000,
          feather: 0.8,
          samples: [
            { ...point, t: 0 },
            { ...point, t: 100 },
          ],
          visibility,
        },
      },
    });
    const milliseconds = performance.now() - started;
    if (process.env.TERRAIN_CPU_PROFILE) {
      const { profile } = await profileCall('Profiler.stop');
      writeFileSync(
        process.env.TERRAIN_CPU_PROFILE + '.' + i + '.cpuprofile',
        JSON.stringify(profile),
      );
    }
    runs.push({
      milliseconds,
      preparationMs,
      events: globalThis.__saltTerrainTrace.events,
      hash: hash(),
      memory: process.memoryUsage(),
    });
    store.executeAtlasCommit({
      commandId: randomUUID(),
      campaignId: cam.id,
      token,
      action: { kind: 'undo' },
    });
    if (hash() !== initial) throw Error('Undo changed original height bytes');
  }
  if (process.env.TERRAIN_CPU_PROFILE) profiler.disconnect();
  store.close();
  console.log(
    JSON.stringify({
      side,
      tiles: side * side,
      seeded: process.env.TERRAIN_AUTHOR_SEED === '1',
      profile: dir,
      runs,
      peakRssKiB: process.resourceUsage().maxRSS,
    }),
  );
} else {
  const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/terrain-author-measurement');
  mkdirSync(output, { recursive: true });
  const sources = {
      ...(process.env.TERRAIN_BASELINE
        ? { baseline: path.resolve(process.env.TERRAIN_BASELINE) }
        : {}),
      current: root,
    },
    report = { runs: {}, sources: {} };
  for (const [name, source] of Object.entries(sources)) {
    const bundle = path.join(root, '.build', 'terrain-author-' + name + '.cjs');
    require('esbuild').buildSync({
      stdin: {
        contents: `export * from '${source}/src/app/storage/store';export * from '${source}/src/app/terrain-height';export * from '${source}/src/app/storage/terrain-grid';`,
        resolveDir: root,
      },
      nodePaths: [root + '/node_modules'],
      outfile: bundle,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    report.sources[name] = {
      path: source,
      bundleHash: createHash('sha256').update(readFileSync(bundle)).digest('hex'),
    };
    const child = spawnSync(process.execPath, [import.meta.filename, '--child', bundle], {
      encoding: 'utf8',
      timeout: 180000,
      env: {
        ...process.env,
        SALTMARCHER_TERRAIN_TRACE: '1',
        ...(process.env.TERRAIN_CPU_PROFILE ? { TERRAIN_CPU_PROFILE: output + '/' + name } : {}),
      },
    });
    if (child.status !== 0) throw Error(child.stderr || child.stdout || String(child.error));
    report.runs[name] = JSON.parse(child.stdout.trim().split('\n').at(-1));
  }
  if (report.runs.baseline)
    for (let i = 0; i < 3; i++)
      if (report.runs.baseline.runs[i].hash !== report.runs.current.runs[i].hash)
        throw Error('Baseline and current author writes differ');
  writeFileSync(output + '/result.json', JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(report.runs).map(([name, r]) => [
          name,
          { milliseconds: r.runs.map((r) => r.milliseconds), peakRssKiB: r.peakRssKiB },
        ]),
      ),
    ),
  );
}
