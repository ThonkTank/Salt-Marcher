// Hold the real region read while navigating the ordinary Atlas terrain canvas.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3'),
  input = process.env.ATLAS_MIXED_SOURCE;
assert(input, 'Set ATLAS_MIXED_SOURCE to a retained synthetic full world');
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-early-terrain'),
  native = await createNativeSession({ output, name: 'atlas-early-terrain' }),
  source = new Database(input, { readonly: true });
const id = source.prepare('SELECT id FROM campaign').get().id;
await source.backup(native.profile + '/workbench.sqlite');
source.close();
try {
  const page = await native.launch();
  page.setDefaultTimeout(60000);
  await native.app.evaluate(({ BrowserWindow, ipcMain }) => {
    BrowserWindow.getAllWindows()[0].setContentSize(1440, 900);
    globalThis.qaEarly = { hold: true, pending: [], reads: 0, writes: 0 };
    const region = ipcMain._invokeHandlers.get('atlas:geometry-region');
    ipcMain.removeHandler('atlas:geometry-region');
    ipcMain.handle('atlas:geometry-region', async (...args) => {
      globalThis.qaEarly.reads++;
      if (globalThis.qaEarly.hold)
        await new Promise((resolve) => globalThis.qaEarly.pending.push(resolve));
      return region(...args);
    });
    const commit = ipcMain._invokeHandlers.get('atlas:commit');
    ipcMain.removeHandler('atlas:commit');
    ipcMain.handle('atlas:commit', (...args) => {
      globalThis.qaEarly.writes++;
      return commit(...args);
    });
  });
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        'atlas-camera:' + id,
        JSON.stringify({ x: -20000000, y: -12500000, width: 40000000, height: 25000000 }),
      ),
    id,
  );
  const start = performance.now();
  await page
    .locator('.campaign-card')
    .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('#campaign-map')?.dataset.terrainReady === 'ready' &&
      !document.querySelector('main').inert,
  );
  const firstTerrainMs = performance.now() - start;
  assert.equal(await page.locator('#campaign-atlas').getAttribute('data-region-state'), 'loading');
  const state = () =>
    page.locator('#campaign-map').evaluate((n) => ({
      view: JSON.parse(n.dataset.atlasView),
      projection: JSON.parse(n.dataset.terrainProjection),
      canvas: n.dataset.canvasState,
    }));
  const initial = await state(),
    before = await page.locator('#atlas-terrain-spatial').screenshot();
  await native.capture(page, 'before-geometry');
  const b = await page.locator('#campaign-map').boundingBox(),
    x = b.x + b.width * 0.5,
    y = b.y + b.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -120);
  await page.waitForFunction(
    (w) => JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width < w,
    initial.view.width,
  );
  await page.waitForTimeout(200);
  const zoomed = await state();
  assert(zoomed.view.width < initial.view.width);
  assert.deepEqual(zoomed.projection.frame, zoomed.view);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(x + 100, y + 60, { steps: 6 });
  await page.mouse.up({ button: 'middle' });
  const panned = await state();
  assert.notEqual(panned.view.x, zoomed.view.x);
  assert.deepEqual(panned.projection.frame, panned.view);
  assert.equal(await page.locator('#campaign-atlas').getAttribute('data-region-state'), 'loading');
  const after = await page.locator('#atlas-terrain-spatial').screenshot();
  assert(!before.equals(after), 'The terrain image itself must change, not only camera metadata');
  await native.capture(page, 'navigated-before-geometry');
  // A visible terrain surface alone does not authorize an author stroke.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 20, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert.equal(
    await native.app.evaluate(() => globalThis.qaEarly.writes),
    0,
    'authoring waits for a confirmed object region',
  );
  const heldReads = await native.app.evaluate(() => {
    const q = globalThis.qaEarly;
    q.hold = false;
    for (const release of q.pending) release();
    q.pending = [];
    return q.reads;
  });
  assert(heldReads > 0);
  await atlasCanvasReady(page);
  const settled = await state();
  assert.deepEqual(settled.view, panned.view, 'late geometry retains the navigated camera');
  await native.capture(page, 'geometry-loaded');
  await native.close();
  await native.finish({
    firstTerrainMs,
    heldReads,
    initial,
    zoomed,
    panned,
    settled,
    terrainImageChanged: true,
  });
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
