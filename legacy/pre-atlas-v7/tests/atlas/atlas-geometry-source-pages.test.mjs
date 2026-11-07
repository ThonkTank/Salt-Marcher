import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';export * from './src/app/atlas/drawing-model';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-geometry-source-pages-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  AtlasRegionReader,
  newElement,
} = require('../../.build/atlas-geometry-source-pages-test.cjs');
const ring = (x, y, size = 4) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
];
const box = { x: -2, y: -2, width: 500, height: 30 };
const room = (id, x, polygons = [{ outer: ring(x, 0), holes: [] }]) => ({
  id,
  scopeId: 'local',
  floorId: 'ground',
  number: id,
  name: 'Room ' + id,
  revision: 0,
  polygons,
  sections: [{ id: 'private-text', kind: 'markdown', markdown: 'not part of geometry' }],
});

test('coarse geometry loads canonical rooms in bounded joined pages and preserves hidden, corrupt, and fresh results', async (t) => {
  const base = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(base + '/atlas-geometry-source-pages-');
  const holeRoom = room('room-00', 0, [{ outer: ring(0, 0, 12), holes: [ring(3, 3, 2)] }]),
    rooms = [
      holeRoom,
      ...Array.from({ length: 69 }, (_, i) =>
        room('room-' + String(i + 1).padStart(2, '0'), (i + 1) * 5),
      ),
    ];
  const store = new CampaignStore(dir + '/world.sqlite'),
    campaign = store.create('Bounded geometry source pages', rooms),
    token = store.activateShell(campaign.id).token;
  const draw = (action) =>
    store.atlasDrawingCommit({ commandId: randomUUID(), token, campaignId: campaign.id, action });
  draw({ kind: 'room-hide', roomId: 'room-01', hidden: true });
  const door = newElement('door', 'local', 'ground', 'room-00', [{ x: 1, y: 1 }]);
  draw({ kind: 'element', element: door, expectedRevision: null });
  store.db
    .prepare('UPDATE room SET payload=? WHERE campaign_id=? AND id=?')
    .run('{damaged', campaign.id, 'room-02');
  let source = store.atlasRegionSource(token),
    db = new Database(store.filename, { readonly: true }),
    reader = new AtlasRegionReader(db);
  t.after(() => {
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  db.exec('BEGIN');
  await reader.sync(source, true);
  db.exec('COMMIT');
  const pageSizes = [],
    joinedQueries = [],
    sqlTexts = [],
    sql = reader.sql.bind(reader);
  reader.sql = (text) => {
    sqlTexts.push(text);
    const statement = sql(text);
    if (text.includes('JOIN room c ON')) {
      joinedQueries.push(text);
      return {
        all: (...args) => {
          const rows = statement.all(...args);
          pageSizes.push(rows.length);
          return rows;
        },
      };
    }
    return statement;
  };
  const batches = reader.geometryTileSourceBatches(source, box, true, true),
    chunks = [];
  for (;;) {
    db.exec('BEGIN');
    const step = batches.next();
    db.exec('COMMIT');
    if (step.done) break;
    chunks.push(step.value);
  }
  const streamed = chunks.flatMap((chunk) => chunk.view.workspace.rooms);
  assert.equal(
    joinedQueries.length,
    3,
    '68 visible indexed rooms require three bounded pages, with no empty query after a short page',
  );
  assert.deepEqual(pageSizes, [32, 32, 4]);
  assert(
    joinedQueries.every(
      (query) =>
        query.includes('LIMIT 32') &&
        query.includes('canonicalPayload') &&
        query.includes('canonicalChecksum') &&
        query.includes('canonicalPolygons'),
    ),
  );
  assert(
    joinedQueries.every((query) => query.includes('NOT EXISTS(SELECT 1 FROM temp.region_hidden')),
    'hidden room and floor membership should be filtered inside the bounded page',
  );
  assert.equal(
    sqlTexts.filter((query) =>
      query.includes('SELECT rowid sourceOrder,* FROM room WHERE campaign_id=? AND id=?'),
    ).length,
    0,
    'streamed pages must not issue a separate canonical room read per room',
  );
  assert.equal(
    sqlTexts.filter((query) =>
      query.includes(
        "SELECT json_extract(payload,'$.polygons') p FROM room WHERE campaign_id=? AND id=?",
      ),
    ).length,
    0,
    'streamed pages must not issue a separate polygon read per room',
  );
  assert.equal(
    sqlTexts.filter((query) =>
      query.includes(
        "SELECT 1 FROM drawing_hidden WHERE campaign_id=? AND hidden=1 AND (kind='room'",
      ),
    ).length,
    0,
    'streamed pages must not issue a separate hidden-room read per room',
  );
  assert(!streamed.some((value) => value.id === 'room-01' || value.id === 'room-02'));
  assert.equal(streamed.length, 68);
  const preserved = streamed.find((value) => value.id === 'room-00');
  assert.deepEqual(Object.keys(preserved).sort(), [
    'floorId',
    'id',
    'name',
    'number',
    'polygons',
    'revision',
    'scopeId',
  ]);
  assert.deepEqual(preserved.polygons[0].holes, [ring(3, 3, 2)]);
  assert.equal(
    chunks.at(-1).view.region.coverage.unreadable,
    1,
    'checksum damage remains visible as a coverage fault',
  );
  assert(
    chunks.every((chunk) => chunk.view.geometry.drawing.elements.length === 0),
    'core pages must not decode drawing payloads',
  );

  const unstreamed = reader.geometryTileSource(source, box, true);
  assert.deepEqual(
    unstreamed.workspace.rooms,
    streamed,
    'the non-streaming fine source still filters hidden rooms',
  );

  const fullDb = new Database(store.filename, { readonly: true }),
    fullReader = new AtlasRegionReader(fullDb);
  t.after(() => fullDb.close());
  fullDb.exec('BEGIN');
  await fullReader.sync(source, true);
  fullDb.exec('COMMIT');
  fullDb.exec('BEGIN');
  const full = fullReader.geometryTileSource(source, box, false);
  fullDb.exec('COMMIT');
  assert.equal(
    full.geometry.drawing.elements.length,
    1,
    'the full fine source still includes canonical drawing elements',
  );
  assert.deepEqual(
    full.workspace.rooms,
    streamed,
    'stream pages and complete source retain canonical room ordering and payloads',
  );

  const freshDb = new Database(store.filename, { readonly: true }),
    freshReader = new AtlasRegionReader(freshDb);
  t.after(() => freshDb.close());
  freshDb.exec('BEGIN');
  await freshReader.sync(source, true);
  freshDb.exec('COMMIT');
  freshDb.exec('BEGIN');
  const fresh = freshReader.geometryTileSource(source, box, true);
  freshDb.exec('COMMIT');
  assert.deepEqual(
    fresh.workspace.rooms,
    streamed,
    'fresh projection reconstruction reproduces the compact room DTOs',
  );
});
