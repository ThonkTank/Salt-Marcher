// A busy real region worker receives a new camera destination on a retained
// synthetic world. Never use a live author database as the input fixture.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3'),
  { build } = require('esbuild');
const ref = process.env.ATLAS_REGION_BASELINE,
  filename = process.env.ATLAS_MIXED_SOURCE;
assert(
  ref && filename,
  'Set ATLAS_REGION_BASELINE and ATLAS_MIXED_SOURCE (retained synthetic world)',
);
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/region-cancellation');
mkdirSync(output, { recursive: true });
const files = [
  'desktop/atlas-region.ts',
  'desktop/atlas-region-worker.ts',
  'src/app/storage/atlas-region.ts',
  'src/app/storage/atlas-landscape-region.ts',
];
const old = new Map(
  files.map((f) => [
    path.resolve(f),
    execFileSync('git', ['show', ref + ':' + f], { encoding: 'utf8' }),
  ]),
);
const runs = [];
for (const label of ['before', 'after']) {
  const directory = path.join(output, label);
  mkdirSync(directory, { recursive: true });
  for (const [name, file] of [
    ['service', files[0]],
    ['worker', files[1]],
  ])
    await build({
      entryPoints: [file],
      outfile: path.join(directory, name + '.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
      plugins:
        label === 'before'
          ? [
              {
                name: 'baseline',
                setup(b) {
                  b.onLoad({ filter: /\.ts$/ }, (args) =>
                    old.has(args.path)
                      ? {
                          contents: old.get(args.path),
                          loader: 'ts',
                          resolveDir: path.dirname(args.path),
                        }
                      : undefined,
                  );
                },
              },
            ]
          : [],
    });
  const db = new Database(filename, { readonly: true });
  let source, building;
  try {
    const root = db.prepare('SELECT * FROM campaign_atlas').get();
    source = {
      filename,
      campaignId: root.campaign_id,
      token: 'diagnostic',
      fence: 'diagnostic',
      revision: root.revision,
      epoch: 'diagnostic',
      sequence: 0,
      reset: true,
      changes: [],
    };
    building = db
      .prepare(
        "SELECT * FROM atlas_binding WHERE campaign_id=? AND kind='dungeon' AND parent='world' ORDER BY rowid LIMIT 1",
      )
      .get(root.campaign_id);
    assert(building);
  } finally {
    db.close();
  }
  const { AtlasRegionService } = require(path.join(directory, 'service.cjs')),
    service = new AtlasRegionService(path.join(directory, 'worker.cjs'), 0);
  try {
    const query = {
      box: { x: building.x - 20, y: building.y - 20, width: 40, height: 40 },
      width: 1440,
      height: 900,
      scopeId: building.owner_id,
      floorId: 'ground',
      slice: null,
      roofs: true,
      terrainRaster: false,
    };
    await service.read(source, query);
    source = { ...source, reset: false };
    const packets = [];
    service.worker.on('message', (reply) =>
      packets.push({
        time: performance.now(),
        cancelled: reply.value?.regionReadCancelled === true,
        error: reply.error,
        trace: reply.terrainTrace,
      }),
    );
    const world = {
        ...query,
        scopeId: null,
        box: { x: -20000000, y: -12500000, width: 40000000, height: 25000000 },
      },
      target = { ...world, box: { x: -15000000, y: -9000000, width: 30000000, height: 18000000 } },
      start = performance.now();
    // Attach the rejection handler before allowing a camera successor to cancel it.
    const stale = service.read(source, world).then(
      (value) => ({
        state: 'fulfilled',
        time: performance.now(),
        bytes: JSON.stringify(value).length,
      }),
      (error) => ({ state: 'rejected', time: performance.now(), error: error.message }),
    );
    await new Promise((resolve) => setTimeout(resolve, 40));
    const replaced = performance.now(),
      current = await service.read(source, target),
      latest = performance.now(),
      previous = await stale,
      json = JSON.stringify(current);
    const report = {
      label,
      replaceAfterMs: replaced - start,
      obsoleteAfterReplacementMs: previous.time - replaced,
      latestAfterReplacementMs: latest - replaced,
      previous,
      packets,
      diagnostics: service.diagnostics,
      sha256: createHash('sha256').update(json).digest('hex'),
      bytes: Buffer.byteLength(json),
      bundles: Object.fromEntries(
        ['service', 'worker'].map((name) => [
          name,
          createHash('sha256')
            .update(readFileSync(path.join(directory, name + '.cjs')))
            .digest('hex'),
        ]),
      ),
    };
    runs.push(report);
    console.log(JSON.stringify(report));
    if (label === 'after') {
      assert.equal(previous.state, 'rejected');
      assert.match(previous.error, /neuere Anfrage/);
      assert(
        packets.some((p) => p.cancelled),
        'real worker must confirm cancellation, not just suppress the completed reply',
      );
      assert.equal(service.diagnostics.workerStarts, 1);
    }
  } finally {
    await service.close();
  }
}
const result = {
  baseline: ref,
  files,
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  equal: runs[0].sha256 === runs[1].sha256,
  runs,
};
writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
assert(result.equal, 'Latest view differs after cancellation');
