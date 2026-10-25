// Compare the region reader against an explicit Git baseline on a retained synthetic mixed world.
// Explicit baseline files come from Git; all other dependencies stay current.
// This is not a whole-release comparison.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3'),
  { build } = require('esbuild');
const file = 'src/app/storage/atlas-region.ts',
  ref = process.env.ATLAS_REGION_BASELINE,
  filename = process.env.ATLAS_MIXED_SOURCE;
const visibility = process.env.ATLAS_REGION_SMALL_GEOMETRY === '1',
  transparent = process.env.ATLAS_REGION_TRANSPARENT_OBJECT_TILES === '1';
assert(!(visibility && transparent), 'Choose one explicit rendering comparison');
const withoutTransparentObjects = (result) => {
  const copy = structuredClone(result);
  let removed = 0;
  if (copy.landscape)
    copy.landscape.tiles = copy.landscape.tiles.filter((tile) => {
      if (tile.content !== 'objects') return true;
      const image = require('pngjs').PNG.sync.read(Buffer.from(tile.data.split(',')[1], 'base64'));
      for (let i = 3; i < image.data.length; i += 4) if (image.data[i]) return true;
      removed++;
      return false;
    });
  return { sha256: createHash('sha256').update(JSON.stringify(copy)).digest('hex'), removed };
};
assert(
  ref && filename,
  'Set ATLAS_REGION_BASELINE and ATLAS_MIXED_SOURCE (a retained synthetic world, never a live user database)',
);
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-region-opening');
mkdirSync(output, { recursive: true });
const files = (process.env.ATLAS_REGION_BASELINE_FILES ?? file).split(',');
assert(files.includes(file));
const old = new Map(
  files.map((f) => [
    path.resolve(f),
    execFileSync('git', ['show', ref + ':' + f], { encoding: 'utf8' }),
  ]),
);
await build({
  entryPoints: [file],
  outfile: path.join(output, 'region-before.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
  plugins: [
    {
      name: 'baseline',
      setup(b) {
        b.onLoad({ filter: /\.ts$/ }, (args) =>
          old.has(args.path)
            ? { contents: old.get(args.path), loader: 'ts', resolveDir: path.dirname(args.path) }
            : undefined,
        );
      },
    },
  ],
});
await build({
  entryPoints: [file],
  outfile: path.join(output, 'region-after.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const runs = [];
for (const label of ['before', 'after']) {
  const db = new Database(filename, { readonly: true });
  try {
    db.exec('BEGIN'); // Match the worker: pin one canonical snapshot through index maintenance and reads.
    const root = db.prepare('SELECT * FROM campaign_atlas').get(),
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
    const building = db
      .prepare(
        "SELECT b.* FROM atlas_binding b JOIN room_group g ON g.campaign_id=b.campaign_id AND g.id=b.owner_id WHERE b.campaign_id=? AND b.parent='world' ORDER BY b.rowid LIMIT 1",
      )
      .get(root.campaign_id);
    const dungeon = db
      .prepare(
        "SELECT b.* FROM atlas_binding b WHERE b.campaign_id=? AND b.kind='dungeon' AND (SELECT count(*) FROM room r WHERE r.campaign_id=b.campaign_id AND r.scope_id=b.owner_id)>4000 LIMIT 1",
      )
      .get(root.campaign_id);
    assert(
      building && dungeon,
      'Mixed-world fixture requires an independent building and a dungeon with over 4000 rooms',
    );
    const { AtlasRegionReader } = require(path.join(output, 'region-' + label + '.cjs')),
      reader = new AtlasRegionReader(db),
      start = performance.now();
    await reader.sync(source);
    const syncMs = performance.now() - start;
    const queries = [
      ['world', { x: -20000000, y: -12500000, width: 40000000, height: 25000000 }, null],
      ['region', { x: -1000000, y: -600000, width: 2000000, height: 1200000 }, null],
      [
        'building',
        { x: building.x - 20, y: building.y - 20, width: 40, height: 40 },
        building.owner_id,
      ],
      [
        'dungeon',
        { x: dungeon.x - 20, y: dungeon.y - 20, width: 100, height: 60 },
        dungeon.owner_id,
      ],
    ];
    // Intermediate zoom exposes thousands of independent buildings at once.
    if (process.env.ATLAS_REGION_NEIGHBORHOOD === '1')
      queries.push([
        'neighborhood',
        {
          x: -6023.884200424714,
          y: -4455.1643565641125,
          width: 12047.768400849429,
          height: 8910.328713128225,
        },
        null,
      ]);
    const views = [];
    for (const [name, box, scopeId] of queries) {
      const q = {
          box,
          width: name === 'neighborhood' ? 2304 : 1440,
          height: name === 'neighborhood' ? 1704 : 900,
          scopeId,
          floorId: 'ground',
          slice: null,
          roofs: true,
          terrainRaster: false,
        },
        start = performance.now(),
        result = reader.read(source, q),
        json = JSON.stringify(result),
        ms = performance.now() - start;
      views.push({
        name,
        ms,
        ...(transparent ? { transparentObjects: withoutTransparentObjects(result) } : {}),
        sha256: createHash('sha256').update(json).digest('hex'),
        bytes: Buffer.byteLength(json),
        coverage: result.coverage,
        rooms: result.rooms.length,
        elements: result.drawing.elements.length,
        bindings: result.bindings.length,
        scopeLabels: result.labels?.filter((l) => l.id.startsWith('scope:')).length ?? 0,
        raster: !!result.raster,
        landscapeSha256: createHash('sha256')
          .update(JSON.stringify(result.landscape))
          .digest('hex'),
      });
    }
    const report = {
      label,
      bundleSha256: createHash('sha256')
        .update(readFileSync(path.join(output, 'region-' + label + '.cjs')))
        .digest('hex'),
      syncMs,
      tempBytes:
        db.pragma('temp.page_count', { simple: true }) *
        db.pragma('temp.page_size', { simple: true }),
      shapeCacheBytes: reader.shapePayloads?.bytes ?? null,
      views,
    };
    runs.push(report);
    console.log(JSON.stringify(report));
  } finally {
    db.close();
  }
}
const equal = runs[0].views.every((view, i) => runs[1].views[i].sha256 === view.sha256);
writeFileSync(
  path.join(output, 'result.json'),
  JSON.stringify(
    {
      baseline: ref,
      files,
      comparison: visibility
        ? 'small-geometry-visibility'
        : transparent
          ? 'transparent-object-tiles'
          : 'equality',
      source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      equal,
      ...(transparent
        ? {
            equalWithoutTransparentObjects: runs[0].views.every(
              (view, i) =>
                view.transparentObjects.sha256 === runs[1].views[i].transparentObjects.sha256,
            ),
          }
        : {}),
      runs,
    },
    null,
    2,
  ),
);
if (visibility) {
  // This explicit mode qualifies the intended world-scale visibility change;
  // it does not weaken the default byte-equality check used for optimizations.
  for (let i = 0; i < runs[0].views.length; i++) {
    const before = runs[0].views[i],
      after = runs[1].views[i];
    assert.equal(
      after.landscapeSha256,
      before.landscapeSha256,
      'Landscape rendering must remain exact',
    );
    if (i < 2) {
      assert(before.coverage.objects > 0);
      assert.equal(after.coverage.objects, 0);
      assert.equal(after.scopeLabels, 0);
      assert.equal(after.bindings, 0);
      assert.equal(after.raster, false);
    } else
      assert.equal(
        after.sha256,
        before.sha256,
        'Nearby geometry, labels and raster must remain exact',
      );
  }
} else if (transparent) {
  let removed = 0;
  for (let i = 0; i < runs[0].views.length; i++) {
    const before = runs[0].views[i].transparentObjects,
      after = runs[1].views[i].transparentObjects;
    assert.equal(
      after.sha256,
      before.sha256,
      'Only completely transparent object tiles may differ',
    );
    assert(after.removed <= before.removed);
    removed += before.removed - after.removed;
  }
  assert(removed > 0, 'The fixture must exercise omitted transparent object tiles');
} else assert(equal, 'Region rendering differs from the baseline; inspect the retained results');
