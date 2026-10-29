import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';

const root = process.cwd(),
  require = createRequire(import.meta.url);
export const worldBounds = { x: -20000000, y: -12500000, width: 40000000, height: 25000000 };
export const near = { x: -120, y: -100 };
export const far = { x: 18000128, y: -8999936 };
export const worldHash = (v) =>
  createHash('sha256')
    .update(typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v))
    .digest('hex');
export async function worldApi() {
  await mkdir('.build/cycle3-point3', { recursive: true });
  buildSync({
    stdin: {
      resolveDir: root,
      contents:
        "export { prepareHeightBrush, heightBrushResolution } from './src/app/atlas/terrain-brush';export { readTerrainGrid } from './src/app/storage/terrain-grid';export { terrainVisibility } from './src/app/atlas/terrain-spatial-model';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/vegetation';export * from './src/app/atlas/vegetation-geometry';export * from './src/app/atlas/vegetation-lod';export * from './src/app/atlas/landscape-line';export * from './src/app/atlas/terrain-route';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/atlas-camera';export * from './src/app/atlas/atlas-tile-plan';export * from './src/app/atlas/terrain-coverage';",
    },
    outfile: '.build/cycle3-point3/world-api.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
  });
  return require(root + '/.build/cycle3-point3/world-api.cjs');
}
export function worldRecords(filename, campaignId) {
  const db = new (require('better-sqlite3'))(filename, { readonly: true });
  try {
    return {
      ...db
        .prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?')
        .get(campaignId),
      records: db
        .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id')
        .all(campaignId)
        .map((r) => JSON.parse(r.payload)),
    };
  } finally {
    db.close();
  }
}
/** SQLite backup includes committed WAL pages even when readonly observers keep
 * the sidecar alive after the app closes. A plain file copy can lose the edit. */
export async function snapshotWorld(filename, target) {
  const db = new (require('better-sqlite3'))(filename, { readonly: true });
  try {
    await db.backup(target);
  } finally {
    db.close();
  }
}
export const cleanWorldRecords = (records) =>
  records.map(({ revision, order, ...r }) => r).sort((a, b) => a.id.localeCompare(b.id));

// Three independent continental masses plus the eastern island; the first
// continent's eastern coast contains the continuously refined river corridor.
export function continentalHeight(x, y) {
  const continents = [
    [-5000000, 0, 5000400, 4200000],
    [6500000, -4000000, 4500000, 3500000],
    [10500000, 4500000, 4300000, 4100000],
    [18000000, -9000000, 1300000, 1800000],
  ];
  let height = -1400;
  for (const [cx, cy, rx, ry] of continents) {
    const u = (x - cx) / rx,
      v = (y - cy) / ry,
      r = Math.hypot(u, v),
      coast = 1 - r + 0.035 * Math.sin(u * 13) * Math.sin(v * 11),
      ridge =
        1400 *
        Math.exp(-(((u + 0.28 + 0.08 * Math.sin(v * 8)) / 0.11) ** 2)) *
        Math.exp(-((v / 0.8) ** 4));
    height = Math.max(height, Math.max(-1400, coast * 1800) + (coast > 0 ? ridge : 0));
  }
  return height;
}

/** Additional deterministic navigation/author bounds, frozen before native launch. */
export function worldContinuityWaypoints(manifest, records) {
  const biomes = manifest.biomeTargets.map((target) => {
    const source = records.find((r) => r.id === 'continent-' + target.id);
    assert(source?.vegetation, 'Continental biome source must already exist');
    const ring = source.polygons[0].outer,
      x = ring.map((p) => p.x),
      y = ring.map((p) => p.y);
    return {
      ...target,
      sourceId: source.id,
      x: (Math.min(...x) + Math.max(...x)) / 2,
      y: (Math.min(...y) + Math.max(...y)) / 2,
    };
  });
  const editFootprints = {};
  for (const [id, point, radius] of [
    ['coarse', { x: -80000, y: -80000 }, 25000],
    ['local', manifest.near, 0.7],
    ['high', manifest.far, 0.7],
  ]) {
    const pad = radius * 1.35;
    editFootprints[id] = {
      point,
      radius,
      brushBox: { x: point.x - pad, y: point.y - radius, width: pad * 2, height: radius * 2 },
    };
  }
  return {
    version: 2,
    campaignId: manifest.campaignId,
    canonicalSha256: manifest.canonicalSha256,
    biomes,
    editFootprints,
    note: 'Frozen before the corrected complete journey. Continental interiors use the same four sources as the world samples. Original campaign, canonical source records, seeds and anchors unchanged.',
  };
}

/** One complete immutable starting campaign, all sources authored before launch. */
export async function createWorldContinuityFixture(profilePath, output) {
  const api = await worldApi();
  const fixture = await createAtlasCanonicalFixture({
    profilePath,
    campaignName: 'Eine Erdwelt bis zehn Meter',
    includeCity: false,
    includeRoom: false,
    flatTileSizeM: 33554432,
    baseHeightM: 30,
  });
  const { CampaignStore } = require(root + '/.build/atlas-canonical-fixture/store.cjs');
  const store = new CampaignStore(fixture.filename),
    token = store.activate(fixture.campaignId).token;
  const write = (action) =>
    store.executeAtlasCommit({
      commandId: randomUUID(),
      campaignId: fixture.campaignId,
      token,
      action,
    });
  const records = () =>
    store.db
      .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id')
      .all(fixture.campaignId)
      .map((r) => JSON.parse(r.payload));
  const put = (record) => {
    const old = records().find((r) => r.id === record.id);
    return write({ kind: 'landscape-put', record, expectedRevision: old?.revision ?? null });
  };
  const heights = [];
  try {
    for (const y of [-33554432, 0])
      for (const x of [-33554432, 0])
        put(
          api.heightRecord(
            x,
            y,
            524288,
            Float32Array.from({ length: 4096 }, (_, i) =>
              continentalHeight(x + (i % 64) * 524288, y + Math.floor(i / 64) * 524288),
            ),
          ),
        );
    // Full-world finer contour source, rather than a tiny demonstration patch.
    for (let ty = -2; ty < 2; ty++)
      for (let tx = -3; tx < 3; tx++) {
        const pixel = 131072,
          x = tx * pixel * 64,
          y = ty * pixel * 64;
        put(
          api.heightRecord(
            x,
            y,
            pixel,
            Float32Array.from({ length: 4096 }, (_, i) =>
              continentalHeight(x + (i % 64) * pixel, y + Math.floor(i / 64) * pixel),
            ),
          ),
        );
      }
    // Additive nested sources connect continental, regional, coastal and room
    // detail. Every refinement is in the same persistent campaign.
    for (const center of [{ x: 0, y: 0 }, far])
      for (const pixel of [8192, 512, 32, 2, 0.125]) {
        const before = new api.TerrainSampler(records(), false),
          span = pixel * 64,
          refinementCenter = pixel === 0.125 && center.x === 0 ? near : center;
        for (const dy of [-1, 0])
          for (const dx of [-1, 0]) {
            const x = (Math.floor(refinementCenter.x / span) + dx) * span,
              y = (Math.floor(refinementCenter.y / span) + dy) * span;
            const values = Float32Array.from({ length: 4096 }, (_, i) => {
              const xx = x + (i % 64) * pixel,
                yy = y + Math.floor(i / 64) * pixel,
                localX = xx - center.x,
                localY = yy - center.y;
              let desired = continentalHeight(xx, yy);
              if (pixel <= 512) {
                const w = Math.exp(-((Math.hypot(localX, localY) / 2500) ** 4));
                desired =
                  desired * (1 - w) +
                  (20 -
                    0.05 * localX +
                    3 * Math.exp(-((localX + 160) ** 2 + (localY - 100) ** 2) / 15000)) *
                    w;
              }
              if (pixel <= 2)
                desired +=
                  0.8 *
                  Math.sin(localX / 14) *
                  Math.sin(localY / 19) *
                  Math.exp(-Math.hypot(localX, localY) / 500);
              return desired - before.sample({ x: xx, y: yy }).heightM;
            });
            const record = api.heightRecord(x, y, pixel, values, 2);
            put(record);
            heights.push(record.id);
          }
      }
    const biomeSeeds = { deciduous: 201, marsh: 202, desert: 203, farmland: 204 };
    const rectangles = [
      ['deciduous', -9000000, -2000000, 3000000, 2000000],
      ['marsh', -5000000, 1000000, 2500000, 1800000],
      ['desert', 4500000, -5000000, 3000000, 2000000],
      ['farmland', 9500000, 3000000, 2400000, 2200000],
    ];
    const rectangle = (x, y, width, height) => [
      {
        outer: [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
        ],
        holes: [],
      },
    ];
    const biomeTargets = [];
    for (const [id, x, y, width, height] of rectangles) {
      const vegetation = api.vegetationSpec(id, biomeSeeds[id]);
      put({
        ...api.emptyRecord('vegetation'),
        id: 'continent-' + id,
        name: 'Kontinentales ' + id,
        resolution: 16384,
        values: { terrain: vegetation.preset.terrain },
        polygons: rectangle(x, y, width, height),
        vegetation,
      });
    }
    for (const [n, id] of Object.keys(biomeSeeds).entries()) {
      const x = -300 + n * 170,
        y = n % 2 ? -100 : 100,
        vegetation = api.vegetationSpec(id, biomeSeeds[id]);
      put({
        ...api.emptyRecord('vegetation'),
        id: 'coastal-' + id,
        name: 'Küstenbiom ' + id,
        resolution: 1,
        values: { terrain: vegetation.preset.terrain },
        polygons: rectangle(x - 55, y - 55, 110, 110),
        vegetation,
      });
      biomeTargets.push({
        id,
        x,
        y,
        seed: biomeSeeds[id],
        assets:
          id === 'deciduous'
            ? ['oak']
            : id === 'marsh'
              ? ['reed']
              : id === 'desert'
                ? ['rock', 'shrub']
                : ['crop'],
      });
    }
    // Existing canonical author actions own all lake excavation and river beds.
    write({
      kind: 'landscape-lake-stroke',
      stroke: {
        id: 'coastal-lake',
        mode: 'dig',
        radius: 32,
        strength: 3,
        feather: 0.8,
        waterLevelM: 15,
        samples: [
          { x: 90, y: 180, t: 0 },
          { x: 90, y: 180, t: 1400 },
        ],
      },
    });
    write({
      kind: 'landscape-lake-stroke',
      stroke: {
        id: 'coastal-scatter',
        mode: 'scatter',
        waterLevelM: null,
        radius: 85,
        strength: 2,
        feather: 0.8,
        noise: 0.65,
        seed: 503,
        samples: [
          { x: -250, y: 220, t: 0 },
          { x: -100, y: 220, t: 1800 },
        ],
      },
    });
    const points = [
        { x: -160, y: 0 },
        { x: 0, y: 0 },
        { x: 420, y: 0 },
      ],
      river = {
        ...api.emptyRecord('river'),
        id: 'coastal-river',
        name: 'Fluss zur Küste',
        width: 8,
        resolution: 2,
        points,
        line: api.newLine('river'),
        route: api.routeSpec('river', points),
      };
    write({
      kind: 'landscape-route',
      record: river,
      expectedRevision: null,
      sourceRevision: store.atlasIdentity(token).revision,
    });
    const saved = records(),
      sampler = new api.TerrainSampler(saved),
      anchors = [
        { name: 'near', ...near },
        { name: 'coast', x: 420, y: 0 },
        { name: 'mountain', x: -6400000, y: 0 },
        { name: 'high-coordinate', ...far },
        ...biomeTargets.map((p) => ({ name: p.id, x: p.x, y: p.y })),
      ].map((p) => ({ ...p, heightM: sampler.sample(p).heightM }));
    assert(saved.filter((r) => r.height).length >= 68);
    assert(saved.some((r) => r.route?.nodes.length));
    assert(saved.filter((r) => r.surface === 'freshwater').length > 1);
    const assetMeasures = Object.fromEntries(
      ['oak', 'reed', 'rock', 'shrub', 'crop'].map((asset) => {
        const g = api.vegetationGeometry(asset, 'crown');
        g.computeBoundingBox();
        const b = g.boundingBox;
        const result = { min: b.min.toArray(), max: b.max.toArray() };
        g.dispose();
        return [asset, result];
      }),
    );
    const generatorSourceHashes = Object.fromEntries(
      await Promise.all(
        [
          'tools/atlas-world-continuity-fixture.mjs',
          'tools/atlas-canonical-fixture.mjs',
          'src/app/atlas/terrain-height.ts',
          'src/app/atlas/vegetation.ts',
          'src/app/atlas/vegetation-geometry.ts',
        ].map(async (f) => [f, worldHash(await readFile(f))]),
      ),
    );
    const source = store.atlasRegionSource(token);
    const manifest = {
      version: 1,
      generatorSourceHashes,
      ...fixture,
      sourceRevision: source.revision,
      sourceFence: source.fence,
      bounds: worldBounds,
      near,
      far,
      biomeSeeds,
      scatterSeed: 503,
      biomeTargets,
      anchors,
      assetMeasures,
      heightSourceIds: saved.filter((r) => r.height).map((r) => r.id),
      refinementHeightSourceIds: heights,
      sourceRecords: saved.map((r) => ({
        id: r.id,
        revision: r.revision,
        sha256: worldHash(r),
        kind: r.height
          ? 'height'
          : r.vegetation
            ? 'biome'
            : r.route
              ? 'river'
              : r.surface
                ? 'water'
                : r.kind,
      })),
      canonicalSha256: worldHash(cleanWorldRecords(saved)),
      checkpointsM: [40000000, 1000000, 100000, 10000, 1000, 100, 10],
      editRegions: {
        coarse: { x: -113750, y: -105000, width: 67500, height: 50000 },
        local: { x: near.x - 1, y: near.y - 1, width: 2, height: 2 },
        highCoordinate: { x: far.x - 1, y: far.y - 1, width: 2, height: 2 },
      },
    };
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await writeFile(
      path.join(output, 'waypoints.json'),
      JSON.stringify(worldContinuityWaypoints(manifest, saved), null, 2) + '\n',
    );
    store.close();
    // Close/reopen is part of fixture integrity, before any native campaign.
    assert.equal(
      worldHash(cleanWorldRecords(worldRecords(fixture.filename, fixture.campaignId).records)),
      manifest.canonicalSha256,
    );
    await writeFile(path.join(output, 'original-world.sqlite'), await readFile(fixture.filename));
    await writeFile(
      path.join(output, 'fixture-integrity.json'),
      JSON.stringify(
        {
          canonicalSha256: manifest.canonicalSha256,
          databaseSha256: worldHash(await readFile(fixture.filename)),
          recordCount: saved.length,
          anchors,
          checkedUtc: new Date().toISOString(),
        },
        null,
        2,
      ) + '\n',
    );
    return manifest;
  } finally {
    if (store.db?.open) store.close();
  }
}
