import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
const root = process.cwd(),
  output =
    process.env.QA_EVIDENCE_DIR ??
    path.resolve('.build/atlas-geometry-native', `${Date.now()}-${process.pid}`);
const native = await createNativeSession({ root, output, name: 'atlas-geometry-tiles' });
const files = [
  'src/app/atlas/atlas-geometry-tile.ts',
  'src/app/atlas/atlas-geometry-mesh.ts',
  'src/app/atlas/atlas-scene-geometry.ts',
  'src/app/atlas/atlas-deck-scene-model.ts',
  'src/app/storage/atlas-geometry-tiles.ts',
  'src/app/storage/atlas-tile-cache.ts',
  'src/app/storage/atlas-projection-index.ts',
  'src/app/storage/atlas-region.ts',
  'desktop/atlas-region-worker.ts',
  'desktop/atlas-region.ts',
  'desktop/main.ts',
  'desktop/preload.ts',
  'tools/test-desktop-atlas-geometry-tiles.mjs',
  '.build/desktop/ui/atlas-deck-runtime.js',
];
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(
      files.map(async (p) => [
        p,
        createHash('sha256')
          .update(await readFile(p))
          .digest('hex'),
      ]),
    ),
  );
try {
  const fixture = await createAtlasCanonicalFixture({
      profilePath: native.profile,
      campaignName: 'Geometry tile qualification',
    }),
    before = await hashes();
  const page = await native.launch(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cold = await page.evaluate(async (fixture) => {
    const unwrap = (r) => {
        if (!r.ok) throw Error(JSON.stringify(r));
        return r.value;
      },
      active = unwrap(await window.campaign.activate(fixture.campaignId));
    const runtime = await import('campaign://app/atlas-deck-runtime.js'),
      revision = unwrap(await window.campaign.atlasTerrainSource(active.token)).revision;
    const addresses = [
        { lod: -2, x: 0, y: 0 },
        ...[2, 3].flatMap((x) => [2, 3].map((y) => ({ lod: -5, x, y }))),
      ],
      tiles = [],
      reads = [];
    for (const tile of addresses) {
      const start = performance.now(),
        result = unwrap(await window.campaign.atlasGeometryTile(active.token, { tile, revision }));
      tiles.push(result);
      reads.push({
        tile,
        cache: result.cache,
        ms: performance.now() - start,
        objects: result.model.objects.length,
      });
    }
    // Terrain and geometry own separate worker cache handles but share this file
    // and namespace. A terrain entry at the same world address must coexist.
    const terrainTile = unwrap(
      await window.campaign.atlasTerrainTile(active.token, { tile: addresses[0], revision }),
    );
    const fine = tiles.slice(1),
      objects = fine.flatMap((t) => t.model.objects),
      container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      left: '20px',
      top: '60px',
      width: '800px',
      height: '600px',
      background: '#d8e0de',
      zIndex: '99999',
    });
    document.body.append(container);
    const makeModel = (objects) => ({
      ...runtime.atlasGeometryTileModel(tiles[0]),
      objects,
      targets: new Map(objects.map((o) => [o.id, o.target])),
    });
    const surface = await runtime.AtlasDeckSurface.create({
      container,
      camera: {
        focus: { x: 24, y: 24 },
        focusHeightM: 130,
        metersPerPixel: 0.1,
        rotation: 25,
        tilt: 50,
        exaggeration: 1,
      },
      model: makeModel(objects),
    });
    const point = { x: 26, y: 24.5, heightM: 151 },
      screen = surface.frame.project(point),
      hit = surface.pick(screen.x, screen.y);
    window.__geometry = { surface, objects, makeModel, tiles, fixture };
    return {
      revision,
      reads,
      terrain: { cache: terrainTile.cache, nodes: terrainTile.projection.grid.heights.length },
      hit,
      expected: point,
      buildingParts: objects
        .filter((o) => o.target.kind === 'building')
        .map((o) => ({ id: o.id, target: o.target })),
      floors: [
        ...new Set(objects.filter((o) => o.target.kind === 'room').map((o) => o.target.floorId)),
      ],
      coverage: tiles.map((t) => t.model.coverage),
    };
  }, fixture);
  assert.equal(cold.buildingParts.length, 4);
  assert(cold.buildingParts.every((o) => o.target.id === fixture.buildingId));
  assert.equal(cold.hit?.target.id, fixture.buildingId);
  assert(Math.abs(cold.hit.point.heightM - cold.expected.heightM) < 0.001);
  assert(cold.floors.includes('ground') && cold.floors.includes(fixture.upperFloorId));
  assert.equal(cold.terrain.cache, 'built');
  assert.equal(cold.terrain.nodes, 65 * 65);
  await native.capture(page, 'building-seams.png');
  const upper = await page.evaluate(async () => {
    const f = window.__geometry,
      objects = f.objects.filter(
        (o) => o.target.kind === 'room' && o.target.floorId === f.fixture.upperFloorId,
      );
    f.surface.setScene(f.makeModel(objects));
    await f.surface.waitForFrame();
    const part = objects.find((o) => o.target.id === f.fixture.upperRoomId);
    if (!part) throw Error('Expected canonical upper room missing.');
    const points = Array.from(part.indices.slice(0, 3), (i) => ({
      x: part.origin.x + part.positions[3 * i],
      y: part.origin.y + part.positions[3 * i + 1],
    }));
    const expected = {
        x: points.reduce((s, p) => s + p.x, 0) / 3,
        y: points.reduce((s, p) => s + p.y, 0) / 3,
        heightM: 145,
      },
      screen = f.surface.frame.project(expected),
      hit = f.surface.pick(screen.x, screen.y);
    return { expected, hit, parts: objects.length };
  });
  assert.equal(upper.hit?.target.id, fixture.upperRoomId);
  assert(Math.abs(upper.hit.point.heightM - upper.expected.heightM) < 0.001);
  await native.capture(page, 'upper-room-seams.png');
  await native.close();
  const fresh = await native.launch();
  const warm = await fresh.evaluate(async (fixture) => {
    const unwrap = (r) => {
        if (!r.ok) throw Error(JSON.stringify(r));
        return r.value;
      },
      active = unwrap(await window.campaign.activate(fixture.campaignId));
    const revision = unwrap(await window.campaign.atlasTerrainSource(active.token)).revision,
      rows = [];
    for (const tile of [
      { lod: -2, x: 0, y: 0 },
      ...[2, 3].flatMap((x) => [2, 3].map((y) => ({ lod: -5, x, y }))),
    ]) {
      const start = performance.now(),
        value = unwrap(await window.campaign.atlasGeometryTile(active.token, { tile, revision }));
      rows.push({
        tile,
        cache: value.cache,
        ms: performance.now() - start,
        revision: value.revision,
        ids: value.model.objects.map((o) => o.target.id),
        typed: value.model.objects.every(
          (o) => o.positions instanceof Float32Array && o.indices instanceof Uint32Array,
        ),
      });
    }
    return rows;
  }, fixture);
  assert(
    warm.every(
      (r) =>
        r.cache === 'hit' &&
        r.revision === cold.revision &&
        r.typed &&
        r.ids.includes(fixture.buildingId),
    ),
  );
  const warmTerrain = await fresh.evaluate(async (fixture) => {
    const unwrap = (r) => {
        if (!r.ok) throw Error(JSON.stringify(r));
        return r.value;
      },
      active = unwrap(await window.campaign.activate(fixture.campaignId));
    const revision = unwrap(await window.campaign.atlasTerrainSource(active.token)).revision;
    const value = unwrap(
      await window.campaign.atlasTerrainTile(active.token, {
        tile: { lod: -2, x: 0, y: 0 },
        revision,
      }),
    );
    return {
      cache: value.cache,
      revision: value.revision,
      nodes: value.projection.grid.heights.length,
    };
  }, fixture);
  assert.equal(warmTerrain.cache, 'hit');
  assert.equal(warmTerrain.revision, cold.revision);
  assert.equal(warmTerrain.nodes, 65 * 65);
  const hiddenFloor = await fresh.evaluate(
    async ({ fixture, commandId }) => {
      const unwrap = (r) => {
          if (!r.ok) throw Error(JSON.stringify(r));
          return r.value;
        },
        active = unwrap(await window.campaign.activate(fixture.campaignId)),
        tile = { lod: -2, x: 0, y: 0 };
      const get = async () => {
        const revision = unwrap(await window.campaign.atlasTerrainSource(active.token)).revision;
        return unwrap(await window.campaign.atlasGeometryTile(active.token, { tile, revision }));
      };
      const maxRoof = (value) =>
        Math.max(
          ...value.model.objects
            .filter((o) => o.target.kind === 'building' && o.target.id === fixture.buildingId)
            .flatMap((o) =>
              Array.from(o.positions)
                .filter((_, i) => i % 3 === 2)
                .map((z) => z + o.origin.heightM),
            ),
        );
      const before = await get();
      unwrap(
        await window.campaign.atlasDrawingCommit({
          commandId,
          token: active.token,
          campaignId: fixture.campaignId,
          action: {
            kind: 'floor',
            scopeId: fixture.interiorScopeId,
            id: fixture.upperFloorId,
            name: 'Obergeschoss',
            elevation: 4,
            cloneId: null,
            hidden: true,
          },
        }),
      );
      const after = await get();
      return {
        beforeRevision: before.revision,
        afterRevision: after.revision,
        beforeRoof: maxRoof(before),
        afterRoof: maxRoof(after),
        upperVisible: after.model.objects.some(
          (o) => o.target.kind === 'room' && o.target.floorId === fixture.upperFloorId,
        ),
        cache: after.cache,
      };
    },
    { fixture, commandId: randomUUID() },
  );
  assert.equal(hiddenFloor.beforeRoof, 152);
  assert.equal(hiddenFloor.afterRoof, 152);
  assert.equal(hiddenFloor.upperVisible, false);
  assert(hiddenFloor.afterRevision > hiddenFloor.beforeRevision);
  await native.close();
  const after = await hashes();
  assert.deepEqual(after, before);
  assert.deepEqual(errors, []);
  await native.finish({
    complete: true,
    scope:
      'Persistent building/room geometry, four clipped tiles, all-floor composition and shared terrain/geometry cache; not full Atlas M2 acceptance.',
    fixture,
    cold,
    upper,
    warm,
    warmTerrain,
    hiddenFloor,
    errors,
    hashes: { before, after },
  });
  console.log(JSON.stringify({ complete: true, output }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
