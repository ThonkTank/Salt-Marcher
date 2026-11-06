import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/region-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/atlas/atlas-landscape.ts'],
  outfile: '.build/region-model.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { CampaignStore } = require('../../.build/region-store.cjs'),
  { earthView, effectiveLandscape } = require('../../.build/region-model.cjs');
function fixture(t) {
  const dir = mkdtempSync(tmpdir() + '/atlas-region-');
  let store = new CampaignStore(dir + '/campaign.sqlite');
  const cam = store.create('Nebelmark');
  let w = store.activate(cam.id);
  const result = {
    get store() {
      return store;
    },
    get w() {
      return w;
    },
    cam,
    dir,
    write: (action) =>
      store.executeAtlas({ commandId: randomUUID(), token: w.token, campaignId: cam.id, action }),
    records: () =>
      store.landscapeRegion(w.token, { x: -1e5, y: -1e5, width: 2e5, height: 2e5 }).records,
    fresh() {
      store.close();
      store = new CampaignStore(dir + '/campaign.sqlite');
      w = store.activate(cam.id);
    },
  };
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return result;
}
const polygon = (radius) => ({
  outer: [
    { x: -radius, y: -radius * 0.7 },
    { x: radius * 0.8, y: -radius },
    { x: radius, y: radius * 0.6 },
    { x: -radius * 0.4, y: radius },
  ],
  holes: [],
});
const patch = (values, level = 0) => ({
  id: randomUUID(),
  revision: 0,
  kind: 'patch',
  name: 'Gelände',
  points: [],
  polygons: [polygon(level ? 7000 : 2400)],
  resolution: level ? 7000 : 2400,
  width: 0,
  values,
});
test('Earth-size overview preserves every window aspect without terrain cell sizes', () => {
  for (const aspect of [0.6, 1, 2.2]) {
    const b = earthView(aspect);
    assert(b.width >= 4e7 && b.height >= 2e7);
    assert.equal(b.width / b.height, aspect);
  }
});
test('property inheritance, partial reset, shared undo/redo and Fresh preserve fine work', (t) => {
  const f = fixture(t),
    coarse = patch({ terrain: 'hills', elevationM: 800 }, 1),
    fine = patch({ terrain: 'forest' });
  f.write({ kind: 'landscape-put', record: coarse, expectedRevision: null });
  f.write({ kind: 'landscape-put', record: fine, expectedRevision: null });
  f.write({
    kind: 'landscape-put',
    record: { ...coarse, values: { terrain: 'water', elevationM: 900 } },
    expectedRevision: 1,
  });
  let value = effectiveLandscape(f.records(), { x: 0, y: 0 });
  assert.equal(value.terrain, 'forest');
  assert.equal(value.elevationM, 900);
  f.write({ kind: 'landscape-put', record: { ...fine, id: randomUUID() }, expectedRevision: null });
  f.write({
    kind: 'landscape-reset',
    polygons: [polygon(100)],
    resolution: 2400,
    field: 'terrain',
  });
  assert.equal(effectiveLandscape(f.records(), { x: 0, y: 0 }).terrain, 'water');
  assert.equal(effectiveLandscape(f.records(), { x: 1000, y: 0 }).terrain, 'forest');
  f.write({ kind: 'undo' });
  assert.equal(effectiveLandscape(f.records(), { x: 0, y: 0 }).terrain, 'forest');
  f.write({ kind: 'redo' });
  f.fresh();
  assert.equal(effectiveLandscape(f.records(), { x: 0, y: 0 }).terrain, 'water');
  assert.equal(
    f.store.landscapeRegion(f.w.token, { x: 1e9, y: 1e9, width: 10, height: 10 }).records.length,
    0,
  );
});
test('continuous rivers, road intersections and point edits persist as one atomic command', (t) => {
  const f = fixture(t),
    river = {
      ...patch({}),
      kind: 'river',
      polygons: [],
      points: [
        { x: -100, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      width: 20,
    },
    road = {
      ...river,
      id: randomUUID(),
      kind: 'road',
      width: 5,
      points: [
        { x: 0, y: -100 },
        { x: 0, y: 100 },
      ],
    };
  f.write({
    kind: 'landscape-batch',
    records: [
      { record: river, expectedRevision: null },
      { record: road, expectedRevision: null },
    ],
  });
  const v = effectiveLandscape(f.records(), { x: 0, y: 0 }, { terrain: 'plains', road: false });
  assert.equal(v.terrain, 'water');
  assert.equal(v.road, false);
  f.write({ kind: 'undo' });
  assert.equal(f.records().length, 0);
  f.write({ kind: 'redo' });
  f.fresh();
  assert.equal(f.records().length, 2);
});
test('ordered place keys, calibrated assets and an independent campaign copy remain connected', async (t) => {
  const f = fixture(t),
    id = randomUUID(),
    sections = [
      { id: randomUUID(), title: 'Ankunft', markdown: 'Geheimer Text\nUnverändert.' },
      { id: randomUUID(), title: 'Gerüchte', markdown: 'Ein Gerücht.' },
    ],
    r = {
      ...patch({}),
      kind: 'place',
      polygons: [],
      points: [{ x: 135, y: 87 }],
      name: 'Eichenfurt',
      locationId: id,
    };
  f.write({
    kind: 'landscape-place',
    record: r,
    document: {
      kind: 'location',
      version: 1,
      id,
      name: r.name,
      type: 'poi',
      sections,
      detailMaps: [],
      keyLinks: [],
    },
    expectedRevision: null,
    expectedLocationRevision: null,
  });
  sections[1].markdown =
    '[Ankunft](dungeon-ref:location/' + id + '#section=' + sections[0].id + ')';
  f.write({
    kind: 'landscape-place',
    record: { ...r, revision: 1 },
    document: {
      kind: 'location',
      version: 1,
      id,
      name: r.name,
      type: 'poi',
      sections,
      detailMaps: [],
      keyLinks: [],
    },
    expectedRevision: 1,
    expectedLocationRevision: 1,
  });
  const bytes = Buffer.from('owned reference bytes'),
    assetId = f.store.registerReference(f.w.token, 'image/png', bytes);
  f.write({
    kind: 'landscape-put',
    record: {
      ...patch({}),
      kind: 'reference',
      assetId,
      imageWidth: 200,
      imageHeight: 100,
      angle: 0.2,
      opacity: 0.45,
      visible: true,
      locked: true,
      points: [{ x: 10, y: 20 }],
      polygons: [],
      width: 1000,
    },
    expectedRevision: null,
  });
  assert.deepEqual(
    f.store.preparation(f.w.token, '').locations.find((l) => l.document.id === id).document
      .sections,
    sections,
  );
  const snapshot = f.dir + '/snapshot.sqlite';
  await f.store.campaignSnapshot(f.w.token, snapshot);
  const copied = f.store.acceptCampaignSnapshot(snapshot, 'Unabhängige Welt', {}),
    w = f.store.activate(copied.id),
    records = f.store.landscapeRegion(w.token, {
      x: -1e4,
      y: -1e4,
      width: 2e4,
      height: 2e4,
    }).records,
    ref = records.find((r) => r.kind === 'reference'),
    place = records.find((r) => r.kind === 'place');
  assert(ref && place);
  assert.deepEqual(f.store.referenceAssetSource(w.token, ref.assetId), {
    mime: 'image/png',
    bytes,
  });
  assert.notEqual(place.locationId, id);
  assert.equal(
    f.store.preparation(w.token, '').locations.find((l) => l.document.id === place.locationId)
      .document.sections[0].markdown,
    sections[0].markdown,
  );
  const copiedSections = f.store
    .preparation(w.token, '')
    .locations.find((l) => l.document.id === place.locationId).document.sections;
  assert(copiedSections[1].markdown.includes('#section=' + copiedSections[0].id));
});
