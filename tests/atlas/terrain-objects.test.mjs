import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/terrain-spatial-model';export * from './src/app/atlas/terrain-objects';export * from './src/app/atlas/atlas-object-geometry';export * from './src/app/atlas/terrain-profile';export * from './src/app/atlas/terrain-height';export * from './src/app/runtime/world-model';export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
  outfile: '.build/terrain-objects-test.cjs',
});
const {
  terrainObjectSources,
  resolveTerrainObjects,
  atlasObjectGeometry,
  AtlasObjectGeometry,
  terrainProfile,
  validateTerrainBuilding,
  heightRecord,
  CampaignStore,
  AtlasRegionReader,
  cellAt,
  weatherAt,
  weatherEffects,
  terrainGrid,
  TerrainSampler,
} = require('../../.build/terrain-objects-test.cjs');
const heights = (rise = 0) =>
  heightRecord(
    0,
    0,
    1,
    Float32Array.from(
      { length: 4096 },
      (_, i) => 100 + rise + (i % 64) * 0.5 + Math.floor(i / 64) * 0.25,
    ),
  );
const source = {
  kind: 'building',
  id: 'house',
  cityId: 'city',
  name: 'Haus',
  anchor: { x: 20, y: 20 },
  outline: [
    { x: 16, y: 16 },
    { x: 24, y: 16 },
    { x: 24, y: 24 },
    { x: 16, y: 24 },
  ],
  binding: { mode: 'ground', offsetM: 1 },
  wallM: 3,
  roofM: 2,
  floorElevations: [-3, 0, 4, 7],
  color: '#9c604c',
};
test('terrain anchored buildings translate as a whole and keep exact floors and footprint; fixed buildings stay fixed', () => {
  const a = resolveTerrainObjects([source], [heights()])[0],
    b = resolveTerrainObjects([source], [heights(15)])[0];
  assert.equal(b.baseM - a.baseM, 15);
  assert.equal(a.topM - a.baseM, 10);
  assert.deepEqual(
    a.floorsM.map((z) => z - a.baseM),
    [-3, 0, 4, 7],
  );
  assert.deepEqual(a.outline, b.outline);
  assert.deepEqual(
    b.floorsM.map((z, i) => z - a.floorsM[i]),
    [15, 15, 15, 15],
  );
  assert.equal(
    resolveTerrainObjects(
      [{ ...source, binding: { mode: 'fixed', offsetM: 45 } }],
      [heights(30)],
    )[0].baseM,
    45,
  );
  const meshes = atlasObjectGeometry(a, { x: 0, y: 0, z: 100 }, 3);
  assert.equal(meshes.length, 3);
  const walls = meshes[1].positions;
  assert.equal(Math.max(...[...walls].filter((_, i) => i % 3 === 2)), (a.topM - 100) * 3);
});
test('concave building roofs use footprint triangulation, not a fan extending outside the footprint', () => {
  const outline = [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 8 },
    { x: 0, y: 8 },
  ];
  const object = resolveTerrainObjects([{ ...source, outline }], [heights()])[0],
    meshes = atlasObjectGeometry(object, { x: 0, y: 0, z: 0 }, 1);
  const vertices = meshes[2].positions;
  let area = 0;
  for (let i = 0; i < vertices.length; i += 9)
    area +=
      Math.abs(
        (vertices[i + 3] - vertices[i]) * (vertices[i + 7] - vertices[i + 1]) -
          (vertices[i + 6] - vertices[i]) * (vertices[i + 4] - vertices[i + 1]),
      ) / 2;
  assert.equal(area, 28);
  const zs = [...vertices].filter((_, i) => i % 3 === 2);
  assert.equal(Math.min(...zs), object.topM);
  assert.equal(Math.max(...zs), object.topM + object.roofM);
});
test('marker-only terrain entries retain their height through mesh replacement without renderer errors', (t) => {
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args));
  const layer = new AtlasObjectGeometry();
  t.after(() => layer.dispose());
  const building = resolveTerrainObjects([source], [heights()])[0];
  const marker = {
    ...building,
    kind: 'entrance',
    outline: [],
    wallM: 0,
    roofM: 0,
    topM: building.baseM,
  };
  const origin = { x: 0, y: 0, z: 100 };
  for (const entry of [marker, marker, building, marker]) {
    layer.update([entry], origin, 1);
    assert.equal(layer.heights.get(entry.id), entry.kind === 'entrance' ? 116 : 128);
    assert.equal(layer.meshes.length, entry.kind === 'entrance' ? 0 : 3);
  }
  assert.deepEqual(errors, []);
});
test('profile samples known slopes, bends, ascent and descent without changing author data', () => {
  const records = [heights()],
    before = JSON.stringify(records),
    p = terrainProfile(records, [
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 10, y: 10 },
    ]);
  assert.equal(p.distanceM, 40);
  assert(Math.abs(p.ascentM - 10) < 1e-7);
  assert(Math.abs(p.descentM - 10) < 1e-7);
  assert(
    Math.abs(p.samples[10].slopeDegrees - (Math.atan(Math.hypot(0.5, 0.25)) * 180) / Math.PI) <
      1e-7,
  );
  assert(p.samples.length <= 384);
  assert.equal(JSON.stringify(records), before);
  assert.throws(
    () =>
      terrainProfile(records, [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]),
    /verschiedene/,
  );
  assert.throws(
    () =>
      terrainProfile(records, [
        { x: Infinity, y: 0 },
        { x: 0, y: 0 },
      ]),
    /gültige/,
  );
  for (const b of [
    { mode: 'fixed', offsetM: Infinity, wallM: 3, roofM: 2 },
    { mode: 'ground', offsetM: 0, wallM: -1, roofM: 2 },
  ])
    assert.throws(() => validateTerrainBuilding(b));
});
test('canonical house/entrance bindings survive history and reopen; region inputs and terrain query share height', async (t) => {
  const root = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(root + '/r6-');
  const room = {
    id: 'room',
    scopeId: 'local',
    floorId: 'ground',
    number: '1',
    name: 'Tor',
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        holes: [],
      },
    ],
    sections: [],
  };
  let store = new CampaignStore(dir + '/world.sqlite'),
    cam = store.create('Bergdorf', [room]),
    active = store.activate(cam.id);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const write = (action) =>
    store.executeAtlasCommit({
      commandId: action.command?.commandId ?? randomUUID(),
      campaignId: cam.id,
      token: active.token,
      action,
    });
  write({ kind: 'landscape-put', record: heights(), expectedRevision: null });
  const cityId = write({ kind: 'city-create', name: 'Dorf', x: 0, y: 0, width: 100, height: 100 })
    .result.id;
  const house = {
    id: 'house',
    kind: 'building',
    name: 'Wacht',
    protected: true,
    position: { x: 20, y: 20 },
    angle: 0,
    outline: [
      { x: -4, y: -4 },
      { x: 4, y: -4 },
      { x: 4, y: 4 },
      { x: -4, y: 4 },
    ],
    notes: '',
    terrain: { mode: 'ground', offsetM: 2, wallM: 4, roofM: 3 },
  };
  const city = () => store.city(active.token, cityId);
  const saveHouse = (h) =>
    write({
      kind: 'city',
      command: {
        commandId: randomUUID(),
        campaignId: cam.id,
        token: active.token,
        cityId,
        expectedRevision: city().header.revision,
        action: { kind: 'change', upsert: [h], remove: [], label: 'Haus' },
      },
    });
  saveHouse(house);
  const scopeId = city().units.find((u) => u.id === 'house').groupId;
  const roomId = store
    .campaignAtlas(active.token)
    .workspace.rooms.find((r) => r.scopeId === scopeId && r.floorId === 'ground').id;
  const floorId = randomUUID();
  write({
    kind: 'drawing',
    command: {
      commandId: randomUUID(),
      token: active.token,
      campaignId: cam.id,
      action: {
        kind: 'floor',
        scopeId,
        id: floorId,
        name: 'Obergeschoss',
        elevation: 4,
        cloneId: null,
        hidden: false,
      },
    },
  });
  const db = new (require('better-sqlite3'))(store.filename, { readonly: true }),
    reader = new AtlasRegionReader(db),
    regionSource = store.atlasRegionSource(active.token);
  await reader.sync(regionSource);
  const region = reader.read(regionSource, {
    box: { x: 0, y: 0, width: 64, height: 64 },
    width: 800,
    height: 800,
    scopeId: null,
    floorId: 'ground',
    slice: null,
    roofs: true,
  });
  assert.deepEqual(
    region.cities.find((c) => c.header.id === cityId).units.find((u) => u.id === 'house').terrain,
    house.terrain,
  );
  assert(
    region.cities
      .find((c) => c.header.id === cityId)
      .units.find((u) => u.id === 'house')
      .floorElevations.includes(4),
  );
  assert(
    region.bindings.some((b) => b.kind === 'dungeon' && b.ownerId === scopeId),
    'closed roofs still supply the frame for exterior entrances',
  );
  db.close();
  const entrance = {
    ...store.campaignAtlas(active.token).entrances.find((e) => e.scopeId === scopeId),
    terrain: { mode: 'ground', offsetM: 1 },
  };
  write({ kind: 'entrance', entrance });
  const records = () =>
    store.atlasMaskRegion(active.token, { x: 0, y: 0, width: 64, height: 64 }).records;
  const resolved = () =>
    resolveTerrainObjects(terrainObjectSources(store.campaignAtlas(active.token)), records());
  const original = resolved().find((o) => o.id === 'house');
  assert.equal(original.baseM, 117);
  assert.equal(original.topM, 125);
  const originalRooms = JSON.stringify(store.campaignAtlas(active.token).workspace.rooms),
    originalFloors = JSON.stringify(store.campaignAtlas(active.token).geometry.floors),
    entry = resolved().find((o) => o.kind === 'entrance');
  assert.deepEqual(entry.outline, [], 'An entrance is a point, not an authored house');
  assert.equal(
    entry.topM + entry.roofM,
    entry.baseM,
    'The existing marker stays at its actual anchor height',
  );
  assert.equal(
    atlasObjectGeometry(entry, { x: 0, y: 0, z: 0 }, 1).length,
    0,
    'No synthetic entrance volume',
  );
  const layer = new AtlasObjectGeometry();
  layer.update([entry], { x: 0, y: 0, z: 0 }, 1);
  assert.equal(layer.heights.get(entry.id), entry.baseM);
  assert.equal(layer.meshes.length, 0);
  layer.dispose();
  write({ kind: 'landscape-put', record: heights(20), expectedRevision: 1 });
  assert.equal(resolved().find((o) => o.id === 'house').baseM - original.baseM, 20);
  assert(
    Math.abs(resolved().find((o) => o.kind === 'entrance').baseM - entry.baseM - 20) < 1e-10,
    'fractional entrance height translates within floating-point precision',
  );
  assert.equal(JSON.stringify(store.campaignAtlas(active.token).workspace.rooms), originalRooms);
  assert.equal(JSON.stringify(store.campaignAtlas(active.token).geometry.floors), originalFloors);
  write({ kind: 'undo' });
  saveHouse({ ...house, terrain: { ...house.terrain, mode: 'fixed', offsetM: 80 } });
  assert.equal(resolved().find((o) => o.id === 'house').baseM, 80);
  write({ kind: 'undo' });
  assert.equal(resolved().find((o) => o.id === 'house').baseM, 117);
  write({ kind: 'redo' });
  assert.throws(
    () => saveHouse({ ...house, terrain: { ...house.terrain, roofM: -2 } }),
    /Dachhöhe/,
  );
  assert.equal(resolved().find((o) => o.id === 'house').baseM, 80);
  const profile = store.atlasTerrainProfile(active.token, [
    { x: 10, y: 10 },
    { x: 30, y: 10 },
  ]);
  assert.equal(profile.ascentM, 10);
  assert.equal(
    profile.samples[0].heightM,
    store.atlasHeight(active.token, { x: 10, y: 10 }).heightM,
  );
  const before = resolved();
  store.close();
  store = new CampaignStore(dir + '/world.sqlite');
  active = store.activate(cam.id);
  assert.deepEqual(resolved(), before);
  assert.equal(
    store.campaignAtlas(active.token).entrances.find((e) => e.id === entrance.id).terrain.offsetM,
    1,
  );
});
test('weather and the existing hex sight rule consume the same canonical terrain after a ridge edit', (t) => {
  const root = homedir() + '/.cache/saltmarcher/tests';
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(root + '/r6-world-'),
    store = new CampaignStore(dir + '/world.sqlite'),
    cam = store.create('Sichtprobe'),
    token = store.activate(cam.id).token;
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token, action });
  const character = store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Ada' } }),
  ).character;
  const scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 1 })).scene;
  store.executeLive(
    command({
      kind: 'membership',
      characterId: character.id,
      expectedRevision: 0,
      expectedRosterRevision: 1,
      active: true,
      targetSceneId: scene.id,
      expectedFocusRevision: 0,
    }),
  );
  const current = store.world(token).maps[0],
    map = { ...current, cells: [] };
  store.executeWorld(command({ kind: 'map', map, expectedRevision: current.revision }));
  const height = (rise) =>
    heightRecord(
      0,
      0,
      256,
      Float32Array.from(
        { length: 4096 },
        (_, i) => 100 + rise * (Math.abs((i % 64) * 256 - map.hexMeters) < 400 ? 1 : 0),
      ),
    );
  store.executeAtlasCommit(
    command({ kind: 'landscape-put', record: height(0), expectedRevision: null }),
  );
  store.executeWorld(
    command({
      kind: 'place-scene',
      sceneId: scene.id,
      position: { mapId: map.id, q: 0, r: 0, locationId: null, dungeon: null },
      expectedSceneRevision: 0,
      expectedPositionRevision: 0,
    }),
  );
  store.executeWorld(
    command({
      kind: 'weather-override',
      sceneId: scene.id,
      expectedClockRevision: 0,
      expectedOverrideRevision: null,
      weather: {
        label: 'Klar',
        kind: 'clear',
        intensity: 0,
        windKmh: 0,
        effects: weatherEffects('clear', 0, 10),
        source: 'GM-Override',
      },
    }),
  );
  const player = (action) => {
    const v = store.playerView(token);
    return store.executePlayer({
      ...command(action),
      expectedRevision: v.settings.revision,
      expectedFocusId: v.focusId,
      expectedFocusRevision: v.focusRevision,
      expectedFocusMembershipRevision: v.focusMembershipRevision,
      expectedFocusLocationId: v.focusLocationId,
    });
  };
  player({
    kind: 'settings',
    settings: {
      blank: false,
      mode: 'follow',
      imageId: null,
      title: '',
      labels: false,
      light: 'daylight',
      displayId: null,
      fullscreen: false,
    },
  });
  player({
    kind: 'observer',
    observer: {
      characterId: character.id,
      enabled: true,
      rangeMeters: 12000,
      darkvisionMeters: 10000,
      eyeHeightMeters: 1.7,
    },
  });
  const visible = () =>
    store.playerView(token).frame.map.cells.find((h) => h.q === 2 && h.r === 0)?.visible === true;
  assert.equal(visible(), true);
  store.executeAtlasCommit(
    command({ kind: 'landscape-put', record: height(30), expectedRevision: 1 }),
  );
  assert.equal(visible(), false);
  const world = store.world(token),
    m = world.maps[0],
    cell = cellAt(m, { q: 1, r: 0 });
  assert.equal(cell.elevationM, store.atlasHeight(token, { x: map.hexMeters, y: 0 }).heightM);
  const a = weatherAt(m, { q: 1, r: 0 }, '0', world.calendar, []),
    flat = { ...m, landscape: [height(0)] },
    b = weatherAt(flat, { q: 1, r: 0 }, '0', world.calendar, []);
  assert(Math.abs(b.effects.temperatureC - a.effects.temperatureC - 30 * 0.0065) < 0.11);
});

test('bounded lake and sea surfaces share canonical water levels in the tilted view', () => {
  const record = heights(),
    lake = {
      id: 'lake',
      revision: 1,
      kind: 'patch',
      name: 'See',
      points: [],
      polygons: [
        {
          outer: [
            { x: 8, y: 8 },
            { x: 24, y: 8 },
            { x: 24, y: 24 },
            { x: 8, y: 24 },
          ],
          holes: [],
        },
      ],
      width: 0,
      resolution: 1,
      values: {},
      surface: 'freshwater',
      waterLevelM: 113,
    };
  const records = [record, lake],
    sampler = new TerrainSampler(records),
    view = {
      box: { x: 8, y: 8, width: 32, height: 32 },
      frame: { x: 8, y: 8, width: 32, height: 32 },
      columns: 33,
      rows: 33,
      focusM: 110,
      tilt: 45,
      rotation: 0,
      exaggeration: 1,
    },
    grid = terrainGrid(records, view);
  assert.equal(sampler.waterLevel({ x: 10, y: 10 }), 113);
  assert.equal(grid.heights[2 * 33 + 2], 113);
  assert.equal(sampler.waterLevel({ x: 24, y: 24 }), undefined);
  assert.equal(grid.heights[16 * 33 + 16], 118);
  assert.equal(sampler.waterLevel({ x: 30, y: 10 }), undefined);
  assert.equal(grid.heights[2 * 33 + 22], 117.5);
  const sea = terrainGrid([], view);
  assert(sea.heights.every((h) => h === 0));
});
