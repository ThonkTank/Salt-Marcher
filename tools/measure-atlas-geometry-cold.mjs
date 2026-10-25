// Instrumented cold-path attribution, not a UI latency benchmark. Always owns
// a fresh extracted copy of the retained M0 world and a new disposable cache.
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { buildSync } from 'esbuild';

const root = process.cwd(),
  output = resolve('.build/atlas-geometry-cold', `${Date.now()}-${process.pid}`);
await mkdir(output, { recursive: true });
const input = resolve('tests/fixtures/atlas/mixed-world.sqlite.gz'),
  filename = join(output, 'workbench.sqlite');
await pipeline(
  createReadStream(input),
  createGunzip(),
  createWriteStream(filename, { flags: 'wx' }),
);
const bundle = join(output, 'probe.cjs');
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {AtlasRegionReader} from './src/app/storage/atlas-region';export {AtlasGeometryTiles} from './src/app/storage/atlas-geometry-tiles';export {AtlasGeometryOverviewBuilder} from './src/app/atlas-geometry-overview';",
    resolveDir: root,
  },
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3'),
  { CampaignStore, AtlasRegionReader, AtlasGeometryTiles, AtlasGeometryOverviewBuilder } = require(
    bundle,
  );
const store = new CampaignStore(filename),
  db = new Database(filename, { readonly: true });
const timings = {},
  record = (name, ms) => {
    const t = (timings[name] ??= { calls: 0, ms: 0 });
    t.calls++;
    t.ms += ms;
  };
let phase = 'setup';
const sql = {},
  sqlDetails = new Map();
// Inclusive timings: nested materialization/SQL must not be summed blindly.
const prepare = db.prepare.bind(db);
db.prepare = (text) => {
  const statement = prepare(text);
  return new Proxy(statement, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (!['get', 'all', 'run'].includes(key))
        return typeof value === 'function' ? value.bind(target) : value;
      return (...args) => {
        const start = performance.now();
        try {
          return value.apply(target, args);
        } finally {
          const ms = performance.now() - start;
          record('sql:' + phase, ms);
          sql[phase] = (sql[phase] ?? 0) + 1;
          const id = phase + ':' + text;
          let detail = sqlDetails.get(id);
          if (!detail && sqlDetails.size < 200) {
            detail = { phase, sql: text, calls: 0, ms: 0 };
            sqlDetails.set(id, detail);
          }
          if (detail) {
            detail.calls++;
            detail.ms += ms;
          }
        }
      };
    },
  });
};
const wrap = (owner, key, name) => {
  const original = owner[key];
  owner[key] = function (...args) {
    const start = performance.now();
    try {
      return original.apply(this, args);
    } finally {
      record(typeof name === 'function' ? name(args) : name, performance.now() - start);
    }
  };
};
const reader = new AtlasRegionReader(db),
  tiles = new AtlasGeometryTiles(join(output, 'cache'));
wrap(reader, 'materialize', (args) => 'materialize:' + phase + ':' + args[0]);
wrap(reader, 'frame', 'frame');
wrap(reader, 'geometryHeight', 'height');
wrap(reader.landscape, 'sync', 'landscape-sync');
wrap(AtlasGeometryOverviewBuilder.prototype, 'append', 'overview-append');
wrap(AtlasGeometryOverviewBuilder.prototype, 'finish', 'overview-finish');
const batches = reader.geometryTileSourceBatches.bind(reader);
reader.geometryTileSourceBatches = function* (...args) {
  const steps = batches(...args);
  for (;;) {
    const start = performance.now(),
      step = steps.next();
    record('source-batch', performance.now() - start);
    if (step.done) return;
    yield step.value;
  }
};
try {
  const campaign = db.prepare('SELECT id FROM campaign').get(),
    token = store.activateShell(campaign.id).token,
    source = store.atlasRegionSource(token);
  phase = 'sync';
  db.exec('BEGIN');
  let start = performance.now();
  await reader.sync(source, 'core');
  const syncMs = performance.now() - start;
  console.log(JSON.stringify({ stage: 'sync', ms: syncMs, timings }));
  phase = 'tile';
  start = performance.now();
  const steps = tiles.read(
    source,
    { tile: { lod: 4, x: 0, y: 0 }, revision: source.revision },
    reader,
  );
  let value,
    yields = 0;
  for (;;) {
    const step = steps.next();
    if (step.done) {
      value = step.value;
      break;
    }
    yields++;
    db.exec('COMMIT');
    db.exec('BEGIN');
  }
  const tileMs = performance.now() - start;
  db.exec('COMMIT');
  const result = {
    scope:
      'Instrumented cold-path inclusive timings; not native, p95 or uninstrumented latency evidence.',
    inputHash: createHash('sha256')
      .update(await readFile(input))
      .digest('hex'),
    bundleHash: createHash('sha256')
      .update(await readFile(bundle))
      .digest('hex'),
    syncMs,
    tileMs,
    yields,
    sql,
    timings,
    sqlDetails: [...sqlDetails.values()].sort((a, b) => b.ms - a.ms).slice(0, 30),
    modeledObjects: value.model.overviews[0].modeledObjects,
  };
  await writeFile(join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, output }));
} finally {
  tiles.close();
  db.close();
  store.close();
}
