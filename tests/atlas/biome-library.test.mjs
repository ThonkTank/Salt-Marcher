import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export * from './src/app/atlas/vegetation';export * from './src/app/atlas/landscape-raster';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-field-stream';export * from './src/app/atlas/atlas-landscape';export {contains} from './src/app/atlas/landscape-geometry';export {CampaignStore} from './src/app/storage/store';`,
  },
  outfile: '.build/biome-library-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  vegetationSpec,
  validateVegetation,
  generateVegetation,
  vegetationEnvironment,
  vegetationFurrowShade,
  heightRecord,
  emptyRecord,
  contains,
  LandscapeRasterizer,
  streamTerrainField,
  CampaignStore,
} = createRequire(import.meta.url)('../../.build/biome-library-test.cjs');
const rect = (x, y, width, height) => ({
  outer: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ],
  holes: [],
});
const box = { x: 0, y: 0, width: 300, height: 180 };
const ground = () => [heightRecord(0, 0, 8, new Float32Array(4096).fill(30))];
const area = (id) => {
  const vegetation = vegetationSpec(id, 123);
  vegetation.preset.edge = 0;
  return {
    ...emptyRecord('vegetation'),
    id,
    resolution: 1,
    polygons: [rect(0, 0, 300, 180)],
    values: { terrain: vegetation.preset.terrain },
    vegetation,
  };
};
const lake = (id, x, level) => ({
  ...emptyRecord('patch'),
  id,
  polygons: [rect(x, 0, 100, 180)],
  surface: 'freshwater',
  waterLevelM: level,
});
const raster = (records, streamed) => {
  const image = new LandscapeRasterizer(box, 100, 60, 0, 3, true, {
    samples: 4,
    areaCoverage: true,
    worldFeather: true,
    cover: true,
  });
  if (streamed)
    image.setTerrainField(
      streamTerrainField(
        image.sampleLattice(),
        0,
        (kind) =>
          records.filter((r) =>
            kind === 'height' ? r.height : kind === 'lake' ? r.surface === 'freshwater' : r.route,
          ),
        false,
      ),
    );
  for (const r of records) image.paint(r);
  const work = image.materialChannelsSteps(function* () {});
  for (;;) {
    const next = work.next();
    if (next.done) return next.value;
  }
};

test('marsh uses ground-rooted reeds on dry and shallow water; deep water stays free without changing water', () => {
  const r = area('marsh'),
    records = [...ground(), lake('shallow', 100, 30.25), lake('deep', 200, 32), r];
  const instances = generateVegetation(r, vegetationEnvironment(records), box, 1).instances;
  for (const [min, max] of [
    [0, 100],
    [100, 200],
  ])
    assert(instances.some((i) => i.asset === 'reed' && i.x >= min && i.x < max));
  assert(instances.some((i) => i.asset === 'shrub' && i.x < 100));
  assert(instances.every((i) => i.z === 30 && i.x < 200 && (i.x < 100 || i.asset === 'reed')));
  const bare = raster(
      records.filter((r) => !r.vegetation),
      true,
    ),
    direct = raster(records, false),
    streamed = raster(records, true);
  for (const channel of Object.keys(streamed)) {
    const i = streamed[channel].findIndex((v, i) => v !== direct[channel][i]);
    assert.equal(
      i,
      -1,
      channel +
        ' direct/streamed first mismatch ' +
        i +
        (i < 0 ? '' : ': ' + streamed[channel][i] + '/' + direct[channel][i]),
    );
  }
  assert.deepEqual(streamed.water, bare.water);
  const at = (x, c) => streamed[c][30 * 100 + x];
  assert(at(15, 'reed') > 0 && at(50, 'reed') > 0);
  assert.equal(at(50, 'shrub'), 0);
  assert.equal(at(83, 'reed'), 0);
  assert.notDeepEqual(
    streamed.baseColor.slice((30 * 100 + 50) * 4, (30 * 100 + 50) * 4 + 3),
    bare.baseColor.slice((30 * 100 + 50) * 4, (30 * 100 + 50) * 4 + 3),
  );
  assert.deepEqual(
    streamed.baseColor.slice((30 * 100 + 83) * 4, (30 * 100 + 83) * 4 + 3),
    bare.baseColor.slice((30 * 100 + 83) * 4, (30 * 100 + 83) * 4 + 3),
  );
  r.vegetation.overrides = [
    { id: 'author-shrub', asset: 'shrub', x: 250, y: 80, size: 2, angle: 0 },
    { id: 'author-reed', asset: 'reed', x: 150, y: 80, size: 2, angle: 0 },
  ];
  const protectedInstances = generateVegetation(
    r,
    vegetationEnvironment(records),
    box,
    1,
  ).instances.filter((i) => i.protected);
  assert.equal(protectedInstances.length, 2);
  assert.equal(protectedInstances.find((i) => i.id === 'author-shrub').conflict, true);
  assert.equal(protectedInstances.find((i) => i.id === 'author-reed').conflict, false);
});

test('farm crops occupy world-addressed rows throughout a polygon, preserve holes and survive split reads', () => {
  const r = area('farmland');
  r.polygons[0].holes = [rect(100, 60, 40, 40).outer];
  const env = vegetationEnvironment([...ground(), r]),
    all = generateVegetation(r, env, box, 1).instances;
  assert(all.length > 200);
  assert(all.every((i) => i.asset === 'crop' && contains(i, r.polygons)));
  assert(new Set(all.map((i) => i.y)).size > 10 && new Set(all.map((i) => i.x)).size > 20);
  assert(all.every((i) => i.x % 12 === 6 && i.y % 12 === 6 && i.angle === 0));
  const split = [
    ...generateVegetation(r, env, { ...box, width: 150 }, 1).instances,
    ...generateVegetation(r, env, { ...box, x: 150, width: 150 }, 1).instances,
  ];
  assert.deepEqual(
    [...new Map(split.map((i) => [i.id, i])).values()].sort((a, b) => a.id.localeCompare(b.id)),
    all.sort((a, b) => a.id.localeCompare(b.id)),
  );
  for (const mpp of [1.99, 2.01, 7.99, 8.01, 100, 1000]) {
    const view = generateVegetation(r, env, box, mpp);
    if (mpp > 2) assert.equal(view.instances.length, 0);
  }
  assert(raster([...ground(), r], true).furrows.some((v) => v > 0));
});

test('structural definitions accept a fifth authored biome and reject unsafe asset, material, terrain and numeric values', () => {
  const r = area('meadow');
  r.id = 'heath';
  r.vegetation.preset = {
    ...r.vegetation.preset,
    id: 'heath',
    name: 'Heide',
    ground: '#927e9c',
    undergrowthAsset: 'shrub',
  };
  assert.doesNotThrow(() => validateVegetation(r));
  assert(
    generateVegetation(r, vegetationEnvironment([...ground(), r]), box, 1).instances.some(
      (i) => i.asset === 'shrub',
    ),
  );
  assert(raster([...ground(), r], true).shrub.some((v) => v > 0));
  for (const mutate of [
    (p) => (p.undergrowthAsset = 'script'),
    (p) => (p.distribution = 'code'),
    (p) => (p.groundPattern = 'image'),
    (p) => (p.terrain = 'farm'),
    (p) => (p.waterDepth.undergrowth = Infinity),
    (p) => (p.waterDepth.rocks = -1),
    (p) => (p.size = NaN),
  ]) {
    const invalid = structuredClone(r);
    mutate(invalid.vegetation.preset);
    assert.throws(() => validateVegetation(invalid));
  }
});

test('all four biomes and an independent fifth snapshot retain seeds and a single history step across undo, redo and fresh storage', (t) => {
  const dir = mkdtempSync(tmpdir() + '/biome-library-');
  let store = new CampaignStore(dir + '/workbench.sqlite');
  const cam = store.create('Biome library');
  let token = store.activate(cam.id).token;
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const write = (action) =>
    store.executeAtlasCommit({ commandId: randomUUID(), campaignId: cam.id, token, action });
  for (const record of ground()) write({ kind: 'landscape-put', record, expectedRevision: null });
  for (const id of ['deciduous', 'marsh', 'desert', 'farmland', 'heath']) {
    const r = area(id === 'heath' ? 'meadow' : id);
    r.id = id;
    if (id === 'heath') {
      r.vegetation.preset.id = id;
      r.vegetation.preset.name = 'Heide';
      r.vegetation.preset.undergrowthAsset = 'shrub';
    }
    write({ kind: 'landscape-put', record: r, expectedRevision: null });
    const saved = store.atlasLandscapeObject(token, id),
      payload = JSON.stringify(saved.vegetation);
    write({ kind: 'undo' });
    assert.throws(() => store.atlasLandscapeObject(token, id));
    write({ kind: 'redo' });
    assert.equal(JSON.stringify(store.atlasLandscapeObject(token, id).vegetation), payload);
    store.close();
    store = new CampaignStore(dir + '/workbench.sqlite');
    token = store.activate(cam.id).token;
    assert.equal(JSON.stringify(store.atlasLandscapeObject(token, id).vegetation), payload);
    const instances = store
      .atlasVegetationScene(token, box, 1)
      .instances.filter((i) => i.areaId === id);
    assert(instances.length > 0, id + ' has local objects');
    if (id === 'desert') assert(instances.every((i) => i.asset === 'rock' || i.asset === 'shrub'));
    write({ kind: 'undo' });
  }
});

test('physical ground furrows share authored row spacing and phase across distant tiles', () => {
  for (const spacing of [12, 24, 47])
    for (const origin of [-1e9, -65536, 0, 65536, 1e9]) {
      const row = Math.floor(origin / spacing) * spacing + spacing / 2;
      assert(vegetationFurrowShade(row, spacing, 0.1, 0.1) < 0.85);
      assert.equal(vegetationFurrowShade(row + spacing / 2, spacing, 0.1, 0.1), 1);
      for (const offset of [0, 0.1, 2, spacing / 2])
        assert(
          Math.abs(
            vegetationFurrowShade(row + offset, spacing, 0.1, 0.1) -
              vegetationFurrowShade(row + offset + spacing, spacing, 0.1, 0.1),
          ) < 1e-5,
        );
      assert.equal(vegetationFurrowShade(row, spacing, 2, 0.1), 1, 'coarse material takes over');
    }
});

test('zero density excludes forbidden assets even when a valid seeded lottery returns exactly zero', () => {
  const seedFor = (salt) =>
    (Math.imul(5, 374761393) ^ Math.imul(5, 668265263) ^ Math.imul(salt, 2246822519)) >>> 0;
  for (const id of ['desert', 'farmland'])
    for (const salt of id === 'farmland' ? [5, 10] : [5]) {
      const r = area(id);
      r.vegetation.seed = seedFor(salt);
      const all = generateVegetation(r, vegetationEnvironment([...ground(), r]), box, 1).instances;
      assert(
        !all.some((i) => i.asset === 'oak' || i.asset === 'pine'),
        id + ' has no zero-density trees',
      );
      if (id === 'farmland')
        assert(
          all.every((i) => i.asset === 'crop'),
          'a zero rock fraction stays empty',
        );
    }
});
