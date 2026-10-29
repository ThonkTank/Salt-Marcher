// Focused continuation of the native navigation probe: five orders of magnitude,
// dense fine authors, one local edit and Fresh. No camera assignments after opening.
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { setBrushWorldRadius } from './atlas-brush-probe.mjs';
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/atlas-camera';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-brush';export {gridHeight} from './src/app/atlas/terrain-spatial-model';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/point5/native-math.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  heightRecord,
  TerrainSampler,
  atlasProject,
  atlasPlanePoint,
  atlasCameraWorldEye,
  applyTerrainBrush,
  gridHeight,
} = require('../.build/point5/native-math.cjs');
const scale = Number(process.argv.find((a) => a.startsWith('--scale='))?.split('=')[1] ?? 1);
const output =
  process.env.QA_EVIDENCE_DIR ??
  path.resolve('.build/point5/native', `${Date.now()}-${process.pid}`);
const sourcePaths = [
  'src/app/atlas/atlas-raster-presentation.ts',
  'src/app/atlas/atlas-canvas.ts',
  'src/app/atlas/atlas-terrain-editing-source.ts',
  'src/app/atlas/atlas-raster-tile-stream.ts',
  'src/app/atlas/atlas-surface-draft.ts',
  'src/app/atlas/campaign-atlas-ui.ts',
  'src/app/atlas/atlas-landscape-ui.ts',
  'src/app/atlas/landscape-workbench-types.ts',
  'src/app/atlas/terrain-projection.ts',
  'src/app/atlas/terrain-spatial-model.ts',
  'src/app/storage/terrain-editing-source.ts',
  'src/app/storage/terrain-scale.ts',
  'src/app/storage/atlas-landscape-region.ts',
  'tools/atlas-world-room-probe.mjs',
  'tools/test-desktop-atlas-navigation-terrain.mjs',
];
const hashSources = async () =>
  Object.fromEntries(
    await Promise.all(
      sourcePaths.map(async (f) => [
        f,
        createHash('sha256')
          .update(await readFile(f))
          .digest('hex'),
      ]),
    ),
  );
const sourceHashes = await hashSources();
const native = await createNativeSession({ name: 'world-room', output });
const fixture = await createAtlasCanonicalFixture({
  profilePath: native.profile,
  campaignName: 'Welt bis Raum',
  includeCity: false,
});
const centre = { x: 1048576, y: 0 },
  checks = [],
  snapshots = [],
  widths = [1000000, 100000, 10000, 1000, 100, 10];
let page, anchor, pointer, viewport, runtime;
const db = new Database(fixture.filename);
db.prepare('DELETE FROM atlas_landscape WHERE campaign_id=?').run(fixture.campaignId);
const put = db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
let denseBytes = 0;
const insert = (r) => {
  const h = r.height,
    p = JSON.stringify(r);
  put.run(
    fixture.campaignId,
    r.id,
    0,
    h.x - h.pixel,
    h.x + h.pixel * 64,
    h.y - h.pixel,
    h.y + h.pixel * 64,
    p,
  );
  return p.length * 2;
};
db.transaction(() => {
  // Coarse world land with an exact plateau at the shared anchor.
  for (let y = -1; y <= 0; y++)
    for (let x = 0; x <= 1; x++)
      insert(
        heightRecord(
          x * 1048576,
          y * 1048576,
          16384,
          Float32Array.from(
            { length: 4096 },
            (_, i) =>
              125 +
              Math.max(0, Math.hypot(x * 64 + (i % 64) - 64, y * 64 + Math.floor(i / 64)) - 20) * 3,
          ),
        ),
      );
  // Middle-scale relief encircles a quiet local area.
  for (let y = -1; y <= 0; y++)
    for (let x = -1; x <= 0; x++)
      insert(
        heightRecord(
          centre.x + x * 4096,
          y * 4096,
          64,
          Float32Array.from({ length: 4096 }, (_, i) => {
            const dx = x * 4096 + (i % 64) * 64,
              dy = y * 4096 + Math.floor(i / 64) * 64,
              d = Math.hypot(dx, dy);
            return d > 200 && d < 3000 ? 80 * Math.sin((Math.PI * (d - 200)) / 2800) ** 2 : 0;
          }),
          2,
        ),
      );
  // 900 physical author blocks exceed the old overview author's 32 MiB bound.
  for (let y = -15; y < 15; y++)
    for (let x = -15; x < 15; x++)
      denseBytes += insert(
        heightRecord(
          centre.x + x * 8,
          y * 8,
          0.125,
          Float32Array.from({ length: 4096 }, (_, i) => {
            const px = x * 8 + (i % 64) * 0.125,
              py = y * 8 + Math.floor(i / 64) * 0.125;
            return Math.abs(px - 2) < 1 && Math.abs(py - 1) < 1
              ? 0.35 * (1 - Math.abs(px - 2)) * (1 - Math.abs(py - 1))
              : 0;
          }),
          2,
        ),
      );
})();
db.close();
assert(denseBytes > 32 * 1024 * 1024);
function records() {
  const d = new Database(fixture.filename, { readonly: true });
  try {
    return d
      .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id')
      .all(fixture.campaignId)
      .map((r) => JSON.parse(r.payload));
  } finally {
    d.close();
  }
}
const initialRecords = records(),
  initialHash = createHash('sha256').update(JSON.stringify(initialRecords)).digest('hex');
const sampler = new TerrainSampler(initialRecords);
const pose = () =>
  page.locator('#campaign-map').evaluate((n) => JSON.parse(n.dataset.terrainProjection));
async function ready() {
  await page.waitForFunction(
    () => {
      const n = document.querySelector('#campaign-map');
      return (
        n?.dataset.terrainReady === 'ready' &&
        n.dataset.terrainQuality === 'detail' &&
        !n.dataset.terrainDraft
      );
    },
    null,
    { timeout: 90000 },
  );
  await page.waitForTimeout(180);
}
async function observer() {
  const code = await readFile('.build/desktop/ui/renderer.js', 'utf8'),
    offset = code.indexOf(
      'this.surface.setTerrain(',
      code.indexOf('var AtlasRasterPresentation = class'),
    );
  assert(offset >= 0);
  const session = await page.context().newCDPSession(page);
  await session.send('Debugger.enable');
  const breakpoint = await session.send('Debugger.setBreakpointByUrl', {
    urlRegex: 'renderer\\.js$',
    lineNumber: code.slice(0, offset).split('\n').length - 1,
  });
  session.once('Debugger.paused', async (e) => {
    try {
      await session.send('Debugger.evaluateOnCallFrame', {
        callFrameId: e.callFrames[0].callFrameId,
        expression: 'globalThis.__qaRaster=this',
      });
      await session.send('Debugger.removeBreakpoint', { breakpointId: breakpoint.breakpointId });
    } finally {
      await session.send('Debugger.resume');
      await session.send('Debugger.disable');
    }
  });
}
async function open(first = false) {
  page = await native.launch(scale);
  await native.app.evaluate(
    ({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].setContentSize(1920 * s, 1080 * s),
    scale,
  );
  if (first) {
    await page.evaluate(
      (id) =>
        localStorage.setItem(
          'atlas-camera:' + id,
          JSON.stringify({
            x: 1048576.25 - (1000000 * 996) / 1632,
            y: -300000.25,
            width: 1000000,
            height: 600000,
          }),
        ),
      fixture.campaignId,
    );
    await page.reload();
  }
  await observer();
  await native.app.evaluate(({ ipcMain }) => {
    globalThis.__worldRoom = { requests: [], commands: [] };
    for (const channel of ['atlas:terrain-tile', 'atlas:terrain-projection', 'atlas:commit']) {
      const handler = ipcMain._invokeHandlers.get(channel);
      if (!handler) continue;
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, (event, ...args) => {
        const row = { channel, args, at: Date.now() };
        if (channel === 'atlas:commit') globalThis.__worldRoom.commands.push(row);
        else globalThis.__worldRoom.requests.push({ channel, query: args[1] });
        return handler(event, ...args);
      });
    }
  });
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Welt bis Raum' })
    .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
  );
  if (await page.locator('#campaign-atlas').isHidden()) {
    if (!(await page.locator('#atlas-tab').isVisible()))
      await page.locator('#workspace-nav-summary').click();
    await page.locator('#atlas-tab').click();
  }
  await atlasCanvasReady(page);
  await ready();
  await page.waitForFunction(() => !!window.__qaRaster);
}
function visibleWidth(v) {
  const y = (pointer.y - viewport.y) / viewport.height;
  const left = atlasPlanePoint(v, { x: 0, y }, anchor.heightM),
    right = atlasPlanePoint(v, { x: 1, y }, anchor.heightM);
  assert(left && right);
  return Math.hypot(right.x - left.x, right.y - left.y);
}
async function sample(label, target) {
  await ready();
  const v = await pose(),
    b = await page.locator('#campaign-map').boundingBox();
  const p = atlasProject(v, anchor, anchor.heightM),
    drift = Math.hypot(p.x * b.width - (pointer.x - b.x), p.y * b.height - (pointer.y - b.y));
  const details = await page.evaluate(() => {
    const r = window.__qaRaster,
      b = document.querySelector('#campaign-map').getBoundingClientRect();
    return {
      tiles: r.tiles.map((t) => ({ tile: t.tile, revision: t.revision, fence: t.fence })),
      cache: r.stream.statistics,
      editing: { ...document.querySelector('#campaign-map').dataset },
      coverage: [0.1, 0.5, 0.9].flatMap((y) =>
        [0.1, 0.5, 0.9].map((x) => !!r.terrainHit(b.left + x * b.width, b.top + y * b.height)),
      ),
      heightAtAnchor: r.loadedHeight(window.__worldRoomAnchor),
    };
  });
  const eye = atlasCameraWorldEye(v),
    ground = sampler.sample(eye).heightM;
  await writeFile(
    path.join(output, 'last-sample.json'),
    JSON.stringify({ label, target, v, b, p, pointer, anchor, drift, details }, null, 2),
  );
  assert(Math.abs(visibleWidth(v) / target - 1) < 0.005, `width ${visibleWidth(v)} / ${target}`);
  assert(drift <= 1, `${label}: fixed anchor drift ${drift}`);
  assert(details.coverage.every(Boolean), `${label}: terrain hole`);
  assert(eye.heightM > ground);
  assert.equal(new Set(details.tiles.map((t) => t.fence)).size, 1);
  assert.equal(new Set(details.tiles.map((t) => t.revision)).size, 1);
  const row = {
    label,
    target,
    actualWidthM: visibleWidth(v),
    focusPlaneWidthM: v.frame.width,
    pose: v,
    anchor,
    anchorDriftCssPx: drift,
    eye,
    ground,
    ...details,
  };
  snapshots.push(row);
  await writeFile(
    path.join(output, 'progress.json'),
    JSON.stringify({ denseBytes, checks, snapshots }, null, 2),
  );
  console.log(label, 'width', v.frame.width, 'anchor drift', drift);
  return row;
}
async function zoom(target, label) {
  for (let i = 0; i < 60; i++) {
    const v = await pose(),
      ratio = target / visibleWidth(v);
    if (Math.abs(Math.log(ratio)) < 0.002) break;
    await page.mouse.move(pointer.x, pointer.y);
    await page.mouse.wheel(0, Math.max(-350, Math.min(350, Math.log(ratio) / 0.002)) * scale);
    await page.waitForTimeout(240);
    if (i === 59) throw Error('Scale did not settle ' + target);
  }
  return sample(label, target);
}
try {
  native.mark('world overview with dense fine region');
  await open(true);
  await page.locator('#atlas-units').selectOption('metric');
  runtime = await page.evaluate(() => {
    const c = document.querySelector('#atlas-terrain-spatial canvas'),
      g = c.getContext('webgl2'),
      i = g.getExtension('WEBGL_debug_renderer_info');
    return {
      dpr: devicePixelRatio,
      logicalSize: [innerWidth, innerHeight],
      renderSize: [c.width, c.height],
      renderer: g.getParameter(i.UNMASKED_RENDERER_WEBGL),
    };
  });
  assert.deepEqual(runtime.logicalSize, [1920, 1080]);
  assert.equal(runtime.dpr, scale);
  viewport = await page.locator('#campaign-map').boundingBox();
  const v = await pose();
  const selected = { x: centre.x + 0.25, y: -0.25, heightM: 125 };
  const projected = atlasProject(v, selected, selected.heightM);
  pointer = {
    x: Math.round(viewport.x + projected.x * viewport.width),
    y: Math.round(viewport.y + projected.y * viewport.height),
  };
  await page.mouse.move(pointer.x, pointer.y);
  anchor = await page.evaluate(
    (p) => window.__qaRaster.navigationAnchor({ clientX: p.x, clientY: p.y }).point,
    pointer,
  );
  await page.evaluate(
    ({ a, p }) => {
      window.__worldRoomAnchor = a;
      window.__worldRoomFrames = [];
      window.__worldRoomMonitor = setInterval(() => {
        const r = window.__qaRaster,
          n = document.querySelector('#campaign-map'),
          b = n.getBoundingClientRect();
        if (!r?.surface || !r.ready) return;
        const projected = r.surface.frame.project(a);
        const height = r.loadedHeight(a);
        const refined = r.surface.frame.project({ ...a, heightM: height ?? a.heightM });
        const coverage = [0.1, 0.5, 0.9].flatMap((y) =>
          [0.1, 0.5, 0.9].map((x) => !!r.terrainHit(b.x + x * b.width, b.y + y * b.height)),
        );
        window.__worldRoomFrames.push({
          at: performance.now(),
          width: r.frame.width,
          quality: n.dataset.terrainQuality,
          projected: { x: projected.x, y: projected.y },
          drift: Math.hypot(projected.x - (p.x - b.x), projected.y - (p.y - b.y)),
          coverage,
          identities: [...new Set(r.tiles.map((t) => t.revision + ':' + t.fence))],
          height,
          refinementDrift: Math.hypot(refined.x - projected.x, refined.y - projected.y),
          lods: [...new Set(r.tiles.map((t) => t.tile.lod))],
        });
      }, 100);
    },
    { a: anchor, p: pointer },
  );
  checks.push({ name: 'dense overview', denseBytes, anchor });
  // Select the normal height brush before the entire traversal.
  await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
  await zoom(widths[0], 'world inward');
  await native.capture(page, 'world');
  for (const w of widths.slice(1)) {
    if (w === 1000) {
      // Real right-button orbit around the same off-centre terrain point.
      await page.mouse.move(pointer.x, pointer.y);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(pointer.x + 25, pointer.y + 40, { steps: 10 });
      await page.mouse.up({ button: 'right' });
      await page.mouse.move(pointer.x, pointer.y);
      await ready();
      // Orbit retains its start anchor at the start screen position.
    }
    await zoom(w, `inward ${w}`);
    if (w === 10000 || w === 10) await native.capture(page, w === 10 ? 'room' : 'landscape');
  }
  native.mark('direction reversal and world return');
  await page.mouse.wheel(0, 250 * scale);
  await page.waitForTimeout(35);
  await page.mouse.wheel(0, -150 * scale);
  await page.waitForTimeout(300);
  checks.push({ name: 'in-flight reversal', pose: await pose() });
  await zoom(10, 'room after reversal');
  for (const w of widths.slice(0, -1).toReversed()) await zoom(w, `outward ${w}`);
  native.mark('return to local room editing');
  for (const w of widths.slice(1)) await zoom(w, `edit return ${w}`);
  const frames = await page.evaluate(() => {
    clearInterval(window.__worldRoomMonitor);
    return window.__worldRoomFrames;
  });
  await writeFile(path.join(output, 'transition-frames.json'), JSON.stringify(frames, null, 2));
  assert(frames.length > 30);
  assert(
    frames.every((f) => f.coverage.every(Boolean)),
    'transient terrain hole',
  );
  assert(
    frames.every((f) => f.identities.length === 1),
    'mixed source frame',
  );
  assert(Math.max(...frames.map((f) => f.drift)) <= 1, 'transient anchor drift');
  checks.push({
    name: 'continuous transition coverage',
    samples: frames.length,
    maximumDriftCssPx: Math.max(...frames.map((f) => f.drift)),
    maximumRefinementDriftCssPx: Math.max(...frames.map((f) => f.refinementDrift)),
    heightRange: [
      Math.min(...frames.map((f) => f.height)),
      Math.max(...frames.map((f) => f.height)),
    ],
  });
  await setBrushWorldRadius(page, 'land-radius', 0.5);
  await page.locator('#land-height-strength').fill('0.3');
  await page.locator('#land-height-strength').press('Tab');
  await page.mouse.move(pointer.x, pointer.y);
  await page.waitForFunction(
    () => {
      const n = document.querySelector('#campaign-map'),
        s = JSON.parse(n.dataset.terrainEditingSource ?? 'null');
      return n.dataset.terrainEditingState === 'ready' && s?.radius === 0.5 && s.complete === true;
    },
    null,
    { timeout: 90000 },
  );
  const localSource = await page
    .locator('#campaign-map')
    .evaluate((n) => JSON.parse(n.dataset.terrainEditingSource));
  assert(localSource.records < 30, 'local edit must not inherit the world author region');
  checks.push({ name: 'complete local editing source', ...localSource });
  const beforeEdit = records();
  await page.evaluate(() => {
    const r = window.__qaRaster,
      original = r.previewHeight.bind(r);
    r.previewHeight = (s) => {
      original(s);
      window.__worldRoomLive = {
        stroke: structuredClone(s),
        tiles: r.tiles.map((t) => ({
          view: t.terrain.projection.grid.view,
          heights: Array.from(t.terrain.projection.grid.heights),
          ground: Array.from(t.terrain.projection.grid.editing.ground),
        })),
      };
    };
  });
  await page.mouse.down();
  await page.waitForTimeout(350);
  await page.mouse.move(pointer.x + 12, pointer.y, { steps: 5 });
  await page.waitForTimeout(150);
  let live = await page.evaluate(() => window.__worldRoomLive);
  assert(live?.stroke.samples.length > 1, 'local source must accept a complete stroke');
  await native.capture(page, 'local-live');
  await page.mouse.up();
  await ready();
  live = await page.evaluate(() => window.__worldRoomLive);
  const afterEdit = records();
  assert.notEqual(JSON.stringify(afterEdit), JSON.stringify(beforeEdit));
  const expected = applyTerrainBrush(beforeEdit, live.stroke);
  const actualSampler = new TerrainSampler(afterEdit);
  const expectedSampler = new TerrainSampler([
    ...new Map([...beforeEdit, ...expected].map((r) => [r.id, r])).values(),
  ]);
  let error = 0;
  for (const tile of live.tiles) {
    const view = tile.view;
    for (let y = 0; y < view.rows; y++)
      for (let x = 0; x < view.columns; x++) {
        const p = {
          x: view.box.x + (x * view.box.width) / (view.columns - 1),
          y: view.box.y + (y * view.box.height) / (view.rows - 1),
        };
        if (Math.hypot(p.x - anchor.x, p.y - anchor.y) < 1)
          error = Math.max(
            error,
            Math.abs(
              tile.ground[y * view.columns + x] - Math.fround(expectedSampler.sample(p).heightM),
            ),
          );
      }
  }
  assert.equal(error, 0, `live author Float32 error ${error}`);
  const commands = await native.app.evaluate(() => globalThis.__worldRoom.commands);
  assert.equal(commands.length, 1);
  for (let dx = -0.5; dx <= 0.5; dx += 0.125)
    for (let dy = -0.5; dy <= 0.5; dy += 0.125) {
      const p = { x: anchor.x + dx, y: anchor.y + dy };
      assert.equal(actualSampler.sample(p).heightM, expectedSampler.sample(p).heightM);
    }

  const saved = {
    pose: await pose(),
    heightHash: createHash('sha256').update(JSON.stringify(afterEdit)).digest('hex'),
  };
  checks.push({ name: 'local protected edit', errorM: error, commands: commands.length, saved });
  const requests = await native.app.evaluate(() => globalThis.__worldRoom.requests);
  await writeFile(path.join(output, 'requests.json'), JSON.stringify(requests, null, 2));
  assert(requests.some((r) => r.channel === 'atlas:terrain-tile'));
  assert(
    requests
      .filter((r) => r.channel === 'atlas:terrain-tile')
      .every((r) => r.query?.editingRadius === undefined),
  );
  await native.capture(page, 'room-saved');
  await native.close();
  native.mark('fresh reopening of saved room');
  await open();
  const fresh = {
    pose: await pose(),
    heightHash: createHash('sha256').update(JSON.stringify(records())).digest('hex'),
  };
  assert.equal(fresh.heightHash, saved.heightHash);
  for (const k of ['focusM', 'tilt', 'rotation', 'exaggeration'])
    assert(Math.abs(fresh.pose[k] - saved.pose[k]) < 1e-6, k);
  for (const k of ['x', 'y', 'width', 'height'])
    assert(Math.abs(fresh.pose.frame[k] - saved.pose.frame[k]) < 1e-6, k);
  await native.capture(page, 'fresh');
  await native.close();
  assert.deepEqual(
    await hashSources(),
    sourceHashes,
    'Point5 sources changed during native qualification',
  );
  await native.finish({
    scale,
    runtime,
    fixture,
    denseBytes,
    initialHash,
    checks,
    snapshots,
    fresh,
    sourceHashes,
  });
  console.log(output);
} catch (error) {
  await writeFile(
    path.join(output, 'partial.json'),
    JSON.stringify({ checks, snapshots, error: String(error) }, null, 2),
  );
  await native.fail(error);
  if (native.app) await native.close().catch(() => {});
  throw error;
} finally {
  await native.dispose();
}
