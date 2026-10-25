import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const bundleDir = resolve(root, '.build/atlas-canonical-fixture');
await mkdir(bundleDir, { recursive: true });
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {heightRecord} from './src/app/atlas/terrain-height';export {terrainObjectSources,resolveTerrainObjects} from './src/app/atlas/terrain-objects';export {AtlasRegionReader} from './src/app/storage/atlas-region';",
    resolveDir: root,
  },
  outfile: join(bundleDir, 'store.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  heightRecord,
  terrainObjectSources,
  resolveTerrainObjects,
  AtlasRegionReader,
} = require(join(bundleDir, 'store.cjs'));
const Database = require('better-sqlite3');

/**
 * Create a disposable, durable canonical Atlas campaign for the direct metric native
 * scene check. The returned profile directory is ready to pass to Electron as
 * `--data-dir`; this function closes and reopens CampaignStore before returning.
 *
 * @param {{profilePath?:string,campaignName?:string}} options
 */
export async function createAtlasCanonicalFixture(options = {}) {
  const cache = join(homedir(), '.cache/saltmarcher');
  await mkdir(cache, { recursive: true });
  const profilePath = options.profilePath
    ? resolve(options.profilePath)
    : await mkdtemp(join(cache, 'atlas-canonical-'));
  await mkdir(profilePath, { recursive: true });
  const filename = join(profilePath, 'workbench.sqlite');
  try {
    await access(filename);
    throw new Error(`Fixture database already exists: ${filename}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const campaignName = options.campaignName ?? 'Metric Atlas canonical scene fixture';
  const commandId = () => randomUUID();
  const initialRoom = {
    id: 'atlas-entry-room',
    scopeId: 'local',
    floorId: 'ground',
    number: '1',
    name: 'Atlas-Eingang',
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
  let store = new CampaignStore(filename);
  let active;
  let readerDb;
  try {
    const campaign = store.create(campaignName, [initialRoom]);
    active = store.activate(campaign.id);
    const write = (action) =>
      store.executeAtlasCommit({
        commandId: commandId(),
        campaignId: campaign.id,
        token: active.token,
        action,
      });

    // A smooth, known hill centered below the authored building footprint.
    const peak = { x: 24, y: 24 },
      baseHeightM = 20,
      peakRiseM = 120;
    const hill = heightRecord(
      0,
      0,
      1,
      Float32Array.from({ length: 4096 }, (_, i) => {
        const x = i % 64,
          y = Math.floor(i / 64),
          distance2 = (x - peak.x) ** 2 + (y - peak.y) ** 2;
        return baseHeightM + peakRiseM * Math.exp(-distance2 / 100);
      }),
    );
    write({ kind: 'landscape-put', record: hill, expectedRevision: null });

    const cityId = write({
      kind: 'city-create',
      name: 'Hügelwacht',
      x: 0,
      y: 0,
      width: 64,
      height: 64,
    }).result.id;
    const buildingId = 'atlas-maplibre-watchtower';
    const building = {
      id: buildingId,
      kind: 'building',
      name: 'Hügelwacht',
      protected: true,
      position: peak,
      angle: 0,
      outline: [
        { x: -4, y: -4 },
        { x: 4, y: -4 },
        { x: 4, y: 4 },
        { x: -4, y: 4 },
      ],
      notes: '',
      residentIds: [],
      workerIds: [],
      terrain: { mode: 'ground', offsetM: 1, wallM: 5, roofM: 2 },
    };
    const city = () => store.city(active.token, cityId);
    const cityCommand = {
      commandId: commandId(),
      campaignId: campaign.id,
      token: active.token,
      cityId,
      expectedRevision: city().header.revision,
      action: { kind: 'change', upsert: [building], remove: [], label: 'Kanonisches Atlasgebäude' },
    };
    store.executeAtlasCommit({
      commandId: cityCommand.commandId,
      campaignId: campaign.id,
      token: active.token,
      action: { kind: 'city', command: cityCommand },
    });

    const savedBuilding = city().units.find((unit) => unit.id === buildingId);
    assert(savedBuilding?.groupId, 'City building must own a canonical interior scope');
    const interiorScopeId = savedBuilding.groupId;
    const groundRoom = store
      .campaignAtlas(active.token)
      .workspace.rooms.find(
        (room) => room.scopeId === interiorScopeId && room.floorId === 'ground',
      );
    assert(groundRoom, 'Building interior must have a canonical ground-floor room');

    const upperFloorId = 'atlas-maplibre-upper-floor';
    store.executeDrawing({
      commandId: commandId(),
      token: active.token,
      campaignId: campaign.id,
      action: {
        kind: 'floor',
        scopeId: interiorScopeId,
        id: upperFloorId,
        name: 'Obergeschoss',
        elevation: 4,
        cloneId: 'ground',
        copyKeys: false,
        hidden: false,
      },
    });
    const upperRoom = store
      .campaignAtlas(active.token)
      .workspace.rooms.find(
        (room) => room.scopeId === interiorScopeId && room.floorId === upperFloorId,
      );
    assert(upperRoom, 'Second floor must contain a canonical cloned room');

    const tutorial = store.tutorial('skipped');
    assert(tutorial, 'Disposable profile must skip first-run UI for the desktop harness');
    store.close();
    store = null;

    // Reopen the actual SQLite store and rebuild the checks from persisted data.
    store = new CampaignStore(filename);
    active = store.activate(campaign.id);
    const records = store.atlasMaskRegion(active.token, {
      x: 0,
      y: 0,
      width: 64,
      height: 64,
    }).records;
    const sources = terrainObjectSources(store.campaignAtlas(active.token));
    const resolved = resolveTerrainObjects(sources, records).find(
      (object) => object.id === buildingId,
    );
    assert(resolved, 'Reopened canonical Atlas view must resolve the saved building');
    const expected = {
      hillPeakM: 140,
      buildingBaseM: 141,
      floorHeightsM: [141, 145],
      wallTopM: 150,
      roofTopM: 152,
    };
    assert.equal(resolved.baseM, expected.buildingBaseM);
    assert.deepEqual(
      [...resolved.floorsM].sort((a, b) => a - b),
      expected.floorHeightsM,
    );
    assert.equal(resolved.topM, expected.wallTopM);
    assert.equal(resolved.topM + resolved.roofM, expected.roofTopM);
    assert.deepEqual(
      [...resolved.floorElevations].sort((a, b) => a - b),
      [0, 4],
    );

    const source = store.atlasRegionSource(active.token);
    readerDb = new Database(filename, { readonly: true });
    const reader = new AtlasRegionReader(readerDb);
    await reader.sync(source);
    const query = {
      box: { x: 0, y: 0, width: 64, height: 64 },
      width: 800,
      height: 800,
      scopeId: null,
      floorId: 'ground',
      terrainRaster: false,
      slice: null,
      roofs: true,
    };
    const region = reader.read(source, query);
    const upperRegion = reader.read(source, {
      ...query,
      scopeId: interiorScopeId,
      floorId: upperFloorId,
    });
    const regionBuilding = region.cities
      .find((entry) => entry.header.id === cityId)
      ?.units.find((unit) => unit.id === buildingId);
    assert(regionBuilding, 'Reopened region read must include canonical city building');
    assert(
      regionBuilding.floorElevations?.includes(4),
      'Region reader must expose the second interior floor elevation',
    );
    assert.equal(region.interiors[buildingId], interiorScopeId);
    assert(
      region.rooms.some((room) => room.scopeId === interiorScopeId && room.floorId === 'ground'),
    );
    assert(
      upperRegion.rooms.some(
        (room) => room.scopeId === interiorScopeId && room.floorId === upperFloorId,
      ),
    );
    const view = store.atlasRegionView(active.token, region);
    assert.equal(view.region.fence, source.fence);

    const terrain = store.atlasSpatialScene(active.token, query.box, 1);
    const ix = Math.round(((peak.x - query.box.x) / query.box.width) * (terrain.grid.columns - 1));
    const iy = Math.round(((peak.y - query.box.y) / query.box.height) * (terrain.grid.rows - 1));
    const peakIndex = iy * terrain.grid.columns + ix;
    assert.equal(terrain.grid.heights[peakIndex], expected.hillPeakM);
    readerDb.close();
    readerDb = null;
    store.close();
    store = null;
    return {
      profile: profilePath,
      profilePath,
      filename,
      campaignId: campaign.id,
      campaignName,
      cityId,
      buildingId,
      scopeId: interiorScopeId,
      interiorScopeId,
      groundRoomId: groundRoom.id,
      upperFloorId,
      upperRoomId: upperRoom.id,
      buildingAnchor: peak,
      viewBox: query.box,
      sourceFence: source.fence,
      sourceRevision: source.revision,
      query,
      expected,
      expectedMeters: expected,
      terrainGrid: { columns: terrain.grid.columns, rows: terrain.grid.rows, peakIndex },
    };
  } finally {
    readerDb?.close();
    store?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const fixture = await createAtlasCanonicalFixture();
  process.stdout.write(JSON.stringify(fixture, null, 2) + '\n');
}
