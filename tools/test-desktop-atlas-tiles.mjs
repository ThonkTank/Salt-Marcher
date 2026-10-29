import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
const root = process.cwd(),
  output =
    process.env.QA_EVIDENCE_DIR ??
    path.resolve('.build/atlas-tile-native', `${Date.now()}-${process.pid}`);
const native = await createNativeSession({ root, output, name: 'atlas-tiles' });
const files = [
  'src/app/atlas/atlas-terrain-tile.ts',
  'src/app/atlas/atlas-tile-plan.ts',
  'src/app/atlas/atlas-tile-stream.ts',
  'src/app/storage/atlas-terrain-tiles.ts',
  'src/app/storage/atlas-tile-cache.ts',
  'desktop/atlas-region-worker.ts',
  'desktop/atlas-region.ts',
  'desktop/main.ts',
  'desktop/preload.ts',
  'tools/test-desktop-atlas-tiles.mjs',
  '.build/desktop/ui/atlas-deck-runtime.js',
];
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        createHash('sha256')
          .update(await readFile(file))
          .digest('hex'),
      ]),
    ),
  );
try {
  const fixture = await createAtlasCanonicalFixture({
      profilePath: native.profile,
      campaignName: 'Persistent tile qualification',
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
    const runtime = await import('campaign://app/atlas-deck-runtime.js');
    const view = unwrap(
      await window.campaign.atlasRegion(active.token, {
        ...fixture.query,
        width: 800,
        height: 600,
      }),
    );
    const stream = new runtime.AtlasTileStream(),
      frames = [],
      reads = [],
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
    const camera = {
      focus: { x: 32, y: 32 },
      focusHeightM: 65,
      metersPerPixel: 0.35,
      rotation: 25,
      tilt: 45,
      exaggeration: 1,
    };
    let surface, release;
    const hold = new Promise((resolve) => (release = resolve));
    window.__tiles = { release, stream, frames, reads, container, active, fixture, runtime, view };
    const model = (tiles) => {
      const models = tiles.map((t) =>
        runtime.buildAtlasDeckSceneModel({ view, terrain: t.projection.grid }),
      );
      const objects = models.flatMap((m, i) =>
        m.objects
          .filter((o) => o.target.kind === 'terrain')
          .map((o) => ({ ...o, id: 'terrain:' + JSON.stringify(tiles[i].tile) })),
      );
      return { ...models[0], objects, targets: new Map(objects.map((o) => [o.id, o.target])) };
    };
    // Publish is synchronous; serialize asynchronous GPU frame preparation in
    // the probe so captures refer to the exact delivered tile set.
    let draw = Promise.resolve();
    const initialBox = { x: 0, y: 0, width: 256, height: 64 };
    const ready = stream.load(
      { box: initialBox, metersPerPixel: 0.25, revision: view.revision, source: view.region.fence },
      async (request) => {
        if (request.tile.lod < 0) await hold;
        const start = performance.now(),
          value = unwrap(await window.campaign.atlasTerrainTile(active.token, request));
        reads.push({ tile: value.tile, cache: value.cache, ms: performance.now() - start });
        return value;
      },
      (frame) => {
        frames.push({
          tiles: frame.tiles.map((t) => t.tile),
          complete: frame.complete,
          generation: frame.generation,
        });
        if (!frame.tiles.length) return;
        draw = draw.then(async () => {
          if (!surface) {
            surface = await runtime.AtlasDeckSurface.create({
              container,
              camera,
              model: model(frame.tiles),
            });
            window.__tiles.surface = surface;
            window.__tiles.canvas = surface.canvas;
          } else {
            surface.setScene(model(frame.tiles));
            await surface.waitForFrame();
          }
          window.__tiles.visible = frame.tiles;
          window.__tiles.complete = frame.complete;
        });
      },
    );
    window.__tiles.ready = ready.then(() => draw);
    let releasePan;
    const panHold = new Promise((resolve) => (releasePan = resolve));
    window.__tiles.releasePan = releasePan;
    window.__tiles.startPan = () => {
      camera.focus = { x: 192, y: 32 };
      surface.setCamera(camera);
      const box = { x: 64, y: 0, width: 256, height: 64 };
      window.__tiles.panReady = stream
        .load(
          { box, metersPerPixel: 0.25, revision: view.revision, source: view.region.fence },
          async (request) => {
            if (request.tile.lod === 0 && request.tile.x === 1) {
              window.__tiles.panBlocked = true;
              await panHold;
            }
            const start = performance.now(),
              value = unwrap(await window.campaign.atlasTerrainTile(active.token, request));
            reads.push({ tile: value.tile, cache: value.cache, ms: performance.now() - start });
            return value;
          },
          (frame) => {
            frames.push({
              tiles: frame.tiles.map((t) => t.tile),
              complete: frame.complete,
              generation: frame.generation,
            });
            if (!frame.tiles.length) return;
            draw = draw.then(async () => {
              surface.setScene(model(frame.tiles));
              await surface.waitForFrame();
              window.__tiles.visible = frame.tiles;
              window.__tiles.complete = frame.complete;
            });
          },
        )
        .then(() => draw);
    };
    return { revision: view.revision, fence: view.region.fence };
  }, fixture);
  await page.waitForFunction(() => window.__tiles?.visible?.length > 0);
  const overview = await page.evaluate(() => ({
    frames: window.__tiles.frames,
    reads: window.__tiles.reads,
    canvases: window.__tiles.container.querySelectorAll('canvas').length,
  }));
  assert(overview.reads.every((r) => r.tile.lod === 0));
  assert.equal(overview.canvases, 1);
  await native.capture(page, 'overview.png');
  const detail = await page.evaluate(async () => {
    const f = window.__tiles;
    f.release();
    await f.ready;
    const p = { x: 24, y: 24 },
      t = f.visible.find((tile) => {
        const box = tile.projection.grid.view.box;
        return p.x >= box.x && p.x < box.x + box.width && p.y >= box.y && p.y < box.y + box.height;
      });
    if (!t) throw Error('visible detail tiles do not cover the fixture hill peak');
    const g = t.projection.grid,
      b = g.view.box;
    const x = Math.round(((p.x - b.x) / b.width) * (g.view.columns - 1)),
      y = Math.round(((p.y - b.y) / b.height) * (g.view.rows - 1));
    const expected = { ...p, heightM: g.heights[y * g.view.columns + x] },
      screen = f.surface.frame.project(expected),
      hit = f.surface.pick(screen.x, screen.y);
    return {
      frames: f.frames,
      reads: f.reads,
      complete: f.complete,
      expected,
      hit,
      revision: t.revision,
      pixels: t.projection.pixels.length,
      forest: t.projection.forest.length,
    };
  });
  assert.equal(detail.complete, true);
  assert.equal(detail.reads.at(-1).tile.lod, -2);
  assert.equal(detail.hit?.target.kind, 'terrain');
  assert.equal(detail.expected.heightM, 140);
  assert.equal(detail.hit.point.heightM, 140);
  assert(Math.abs(detail.hit.point.heightM - detail.expected.heightM) < 0.001);
  assert.equal(detail.pixels, 256 * 256 * 4);
  assert.equal(detail.forest, 256 * 256);
  await native.capture(page, 'detail.png');
  const prior = await page.evaluate(() => ({
    tiles: window.__tiles.visible.map((t) => t.tile),
    canvases: window.__tiles.container.querySelectorAll('canvas').length,
    sameCanvas: window.__tiles.surface.canvas === window.__tiles.canvas,
  }));
  const address = (tile) => `${tile.lod}/${tile.x}/${tile.y}`;
  assert.deepEqual(prior.tiles.map(address).sort(), ['-2/0/0', '-2/1/0', '-2/2/0', '-2/3/0']);
  await page.evaluate(() => window.__tiles.startPan());
  await page.waitForFunction(
    () =>
      window.__tiles?.panBlocked === true &&
      window.__tiles.visible?.map((t) => `${t.tile.lod}/${t.tile.x}/${t.tile.y}`).join(',') ===
        '-2/1/0,-2/2/0,-2/3/0',
  );
  const retained = await page.evaluate(() => {
    const f = window.__tiles,
      generation = f.frames.at(-1).generation,
      frames = f.frames.filter((frame) => frame.generation === generation);
    return {
      generation,
      frames,
      visible: f.visible.map((t) => t.tile),
      canvases: f.container.querySelectorAll('canvas').length,
      sameCanvas: f.surface.canvas === f.canvas,
    };
  });
  assert.deepEqual(retained.visible.map(address), ['-2/1/0', '-2/2/0', '-2/3/0']);
  assert.equal(prior.canvases, 1);
  assert.equal(retained.canvases, 1);
  assert.equal(retained.canvases, prior.canvases);
  assert.equal(prior.sameCanvas, true);
  assert.equal(retained.sameCanvas, true);
  assert.ok(
    retained.frames.length > 0,
    'the retained frame must remain published while the new overview fetch is blocked',
  );
  assert.ok(
    retained.frames.every(
      (frame) => frame.tiles.length > 0 && frame.tiles.every((tile) => tile.lod === -2),
    ),
    'no empty or partial overview frame may replace retained detail tiles',
  );
  await native.capture(page, 'pan-retained.png');
  await page.evaluate(() => window.__tiles.releasePan());
  await page.evaluate(() => window.__tiles.panReady);
  const pan = await page.evaluate(() => {
    const f = window.__tiles,
      generation = f.frames.at(-1).generation,
      frames = f.frames.filter((frame) => frame.generation === generation);
    return {
      frames,
      visible: f.visible.map((t) => t.tile),
      complete: f.complete,
      canvases: f.container.querySelectorAll('canvas').length,
      sameCanvas: f.surface.canvas === f.canvas,
    };
  });
  const overviewSwap = pan.frames.find(
    (frame) => frame.tiles.length === 2 && frame.tiles.every((tile) => tile.lod === 0),
  );
  assert.ok(overviewSwap, 'the complete new overview must appear as one atomic frame');
  assert.deepEqual(overviewSwap.tiles.map(address).sort(), ['0/0/0', '0/1/0']);
  const overviewIndex = pan.frames.indexOf(overviewSwap);
  assert.ok(overviewIndex > 0);
  assert.ok(
    pan.frames
      .slice(0, overviewIndex)
      .every((frame) => frame.tiles.length > 0 && frame.tiles.every((tile) => tile.lod === -2)),
  );
  assert.deepEqual(pan.visible.map(address).sort(), ['-2/1/0', '-2/2/0', '-2/3/0', '-2/4/0']);
  assert.equal(pan.complete, true);
  assert.equal(pan.canvases, 1);
  assert.equal(pan.canvases, prior.canvases);
  assert.equal(pan.sameCanvas, true);
  assert.equal(pan.frames.at(-1).complete, true);
  assert.deepEqual(pan.frames.at(-1).tiles.map(address).sort(), pan.visible.map(address).sort());
  await native.capture(page, 'pan-detail.png');
  await native.close();
  const fresh = await native.launch();
  const reopened = await fresh.evaluate(async (fixture) => {
    const unwrap = (r) => {
        if (!r.ok) throw Error(JSON.stringify(r));
        return r.value;
      },
      active = unwrap(await window.campaign.activate(fixture.campaignId));
    const { revision } = unwrap(await window.campaign.atlasTerrainSource(active.token)),
      rows = [];
    for (const lod of [0, -2]) {
      const start = performance.now(),
        value = unwrap(
          await window.campaign.atlasTerrainTile(active.token, {
            tile: { lod, x: 0, y: 0 },
            revision,
          }),
        );
      rows.push({
        tile: value.tile,
        cache: value.cache,
        ms: performance.now() - start,
        maxHeight: Math.max(...value.projection.grid.heights),
        revision: value.revision,
      });
    }
    return rows;
  }, fixture);
  assert(reopened.every((r) => r.cache === 'hit' && r.revision === cold.revision));
  assert.equal(reopened.at(-1).maxHeight, 140);
  await native.close();
  const after = await hashes();
  assert.deepEqual(after, before);
  assert.deepEqual(errors, []);
  await native.finish({
    complete: true,
    scope:
      'Isolated terrain tile overview/detail, same-source pan retention and atomic overview swap, and warm fresh-process reuse; not full M2 geometry or whole Atlas performance acceptance.',
    fixture,
    cold,
    overview,
    detail,
    retained,
    pan,
    reopened,
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
