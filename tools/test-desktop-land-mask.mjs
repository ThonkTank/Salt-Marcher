import { setBrushWorldRadius } from './atlas-brush-probe.mjs';
// Actual Electron window and an isolated synthetic campaign. Never opens the user's profile.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas/atlas-landscape';",
    resolveDir: root,
  },
  outfile: '.build/landscape-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/landscape-native-store.cjs');
const dir = await mkdtemp('/tmp/saltmarcher-landscape-'),
  out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/land-mask-native');
await mkdir(out, { recursive: true });
const store = new CampaignStore(dir + '/workbench.sqlite'),
  room = {
    id: 'watch',
    scopeId: 'local',
    floorId: 'ground',
    number: '1',
    name: 'Referenzhaus',
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 12, y: 0 },
          { x: 12, y: 8 },
          { x: 0, y: 8 },
        ],
        holes: [],
      },
    ],
    sections: [],
  };
const cam = store.create('Pinselvergleich', [room]),
  active = store.activate(cam.id);
store.tutorial('skipped');
store.close();
const Database = require('better-sqlite3'),
  db = new Database(dir + '/workbench.sqlite', { readonly: true }),
  records = () =>
    db
      .prepare('SELECT payload FROM atlas_landscape')
      .all()
      .map((r) => JSON.parse(r.payload));
const result = {
  source: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    encoding: 'utf8',
  }).trim(),
  profile: dir,
  errors: [],
  checks: [],
};
let app, page;
async function start() {
  const executable = process.env.ATLAS_PACKAGE
    ? path.join(process.env.ATLAS_PACKAGE, 'electron')
    : root + '/node_modules/electron/dist/electron';
  app = await _electron.launch({
    executablePath: executable,
    args: [
      ...(process.env.ATLAS_PACKAGE ? [] : [root + '/.build/desktop/main.cjs']),
      '--data-dir',
      dir,
      '--ozone-platform=x11',
    ],
    timeout: 60000,
  });
  if (process.env.ATLAS_PACKAGE)
    assert.equal(
      await app.evaluate(({ app }) => app.getVersion()),
      JSON.parse(await readFile(root + '/package.json', 'utf8')).version,
    );
  page = await app.firstWindow();
  page.on('pageerror', (e) => result.errors.push(e.stack ?? e.message));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Pinselvergleich' })
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
  await page.locator('#atlas-search').fill('Referenzhaus');
  await page.locator('#atlas-search-results button').filter({ hasText: 'Referenzhaus' }).click();
  await atlasCanvasReady(page);
  await page.locator('#atlas-search').fill('');
  await page.locator('button[data-family="terrain"]').click();
  await atlasCanvasReady(page);
}
const tool = async (value) => {
  await page.waitForFunction(() => !document.querySelector('#land-tool').disabled);
  await page.locator(`[data-tool-select="land-tool"][data-tool-value="${value}"]`).click();
  await page.waitForFunction(
    (value) => document.querySelector('#land-tool').value === value,
    value,
  );
  await atlasCanvasReady(page);
};
const camera = () =>
  page.locator('#campaign-map').evaluate((n) => ({
    view: JSON.parse(n.dataset.atlasView),
    left: n.getBoundingClientRect().left,
    top: n.getBoundingClientRect().top,
    width: n.getBoundingClientRect().width,
    height: n.getBoundingClientRect().height,
  }));
async function at(x, y) {
  const c = await camera();
  return {
    x: c.left + ((x - c.view.x) / c.view.width) * c.width,
    y: c.top + ((y - c.view.y) / c.view.height) * c.height,
  };
}
async function capture(name) {
  await page.screenshot({ path: out + '/' + name + '.png' });
}
async function stroke(points) {
  const screen = await Promise.all(points.map((p) => at(...p))),
    native = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getContentBounds(),
    );
  const mouse = (p) => [
    'mousemove',
    '--sync',
    String(Math.round(native.x + p.x)),
    String(Math.round(native.y + p.y)),
  ];
  const args = [...mouse(screen[0]), 'mousedown', '1'];
  for (let i = 1; i < screen.length; i++)
    args.push('sleep', String(0.7 / (screen.length - 1)), ...mouse(screen[i]));
  args.push('mouseup', '1');
  await new Promise((resolve, reject) =>
    execFile('xdotool', args, { env: process.env }, (error) => (error ? reject(error) : resolve())),
  );
}

const maskBytes = () =>
  require('node:crypto')
    .createHash('sha256')
    .update(
      JSON.stringify(
        records()
          .filter((r) => r.mask)
          .map((r) => [r.id, r.mask.data])
          .sort(),
      ),
    )
    .digest('hex');
async function settled() {
  await page.waitForFunction(
    () =>
      !document.querySelector('#land-tool').disabled &&
      document.querySelector('#land-status').textContent === 'Gespeichert',
    null,
    { timeout: 30000 },
  );
  await atlasCanvasReady(page);
}
async function mode(value, radius) {
  await page
    .locator('#land-operation')
    .selectOption(['land-erase', 'lower'].includes(value) ? 'erase' : 'add');
  await page.locator('#land-coast-roughness').fill(['raise', 'lower'].includes(value) ? '2' : '0');
  await setBrushWorldRadius(page, 'land-radius', String(radius));
}
async function hold(x, y, ms) {
  const p = await at(x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await settled();
}
try {
  await start();
  const worker = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const w = new Worker(new URL('atlas-brush-worker.js', document.baseURI));
        const timer = setTimeout(() => {
          w.terminate();
          resolve('timeout');
        }, 5000);
        w.onerror = () => {
          clearTimeout(timer);
          w.terminate();
          resolve('error');
        };
        w.onmessage = (e) => {
          clearTimeout(timer);
          w.terminate();
          resolve(e.data.error ?? e.data.pixels.length);
        };
        w.postMessage({
          generation: 1,
          records: [],
          box: { x: 0, y: 0, width: 10, height: 10 },
          width: 10,
          height: 10,
        });
      }),
  );
  assert.equal(worker, 400, 'Packaged brush worker must load through the restricted app protocol');
  await tool('paint');
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
  await atlasCanvasReady(page);
  const c = await camera(),
    x = c.view.x + c.view.width * 0.35,
    y = c.view.y + c.view.height * 0.65,
    r = Math.max(3, c.view.width * 0.05);
  const core = require(root + '/.build/landscape-native-store.cjs'),
    atTerrain = (x, y) => core.effectiveLandscape(records(), { x, y }).terrain;
  assert.equal(atTerrain(x, y), 'water');
  await capture('01-water-default');
  result.checks.push('blank atlas is water');
  await mode('land', r);
  await stroke([
    [x - r * 2, y],
    [x + r * 2, y],
  ]);
  await settled();
  assert.equal(atTerrain(x, y), 'plains');
  await capture('02-land');
  const landShot = require('pngjs').PNG.sync.read(await page.screenshot()),
    center = await at(x, y),
    shore = await at(x, y - r);
  const rgb = (p) => {
    const at = (Math.round(p.y) * landShot.width + Math.round(p.x)) * 4;
    return [...landShot.data.slice(at, at + 3)];
  };
  assert.deepEqual(
    rgb(center),
    [238, 229, 207],
    'Unpainted land must be neutral in the actual window',
  );
  let ink = 0;
  for (let dy = -5; dy <= 5; dy++) {
    const [red, green, blue] = rgb({ x: shore.x, y: shore.y + dy });
    if (red < 170 && green < 150 && blue < 115) ink++;
  }
  assert(ink >= 1 && ink <= 6, 'The actual coast must have a narrow visible outline');
  result.checks.push('neutral unpainted land and crisp coast in actual window pixels');
  const landBeforeColor = maskBytes();
  await tool('color');
  assert(await page.locator('#land-color-options').isVisible());
  assert(await page.locator('#land-shape-options').isHidden());
  await setBrushWorldRadius(page, 'land-radius', String(r * 0.7));
  await page.locator('#land-tip').selectOption('round');
  await page.locator('#land-paint-color').fill('#22aa33');
  await stroke([
    [x - r, y],
    [x + r, y],
  ]);
  await settled();
  const windowRgb = async (px, py) => {
    const shot = require('pngjs').PNG.sync.read(await page.screenshot()),
      p = await at(px, py),
      i = (Math.round(p.y) * shot.width + Math.round(p.x)) * 4;
    return [...shot.data.slice(i, i + 3)];
  };
  assert.deepEqual(await windowRgb(x, y), [34, 170, 51]);
  assert.equal(maskBytes(), landBeforeColor);
  await capture('02a-color-paint');
  await page.locator('#land-color-operation').selectOption('erase');
  await page.locator('#land-paint-opacity').fill('0.5');
  await hold(x, y, 100);
  const partial = await windowRgb(x, y);
  assert(partial[0] > 34 && partial[0] < 238);
  assert.equal(maskBytes(), landBeforeColor);
  await page.locator('#atlas-undo').click();
  await atlasCanvasReady(page);
  assert.deepEqual(await windowRgb(x, y), [34, 170, 51]);
  await page.locator('#atlas-redo').click();
  await atlasCanvasReady(page);
  assert.deepEqual(await windowRgb(x, y), partial);
  await page.locator('#land-paint-opacity').fill('1');
  await hold(x, y, 100);
  assert.deepEqual(await windowRgb(x, y), [238, 229, 207]);
  assert.equal(maskBytes(), landBeforeColor);
  await capture('02b-color-erase');
  result.checks.push(
    'separate color tool with paint/erase switch, partial pigment erasure, unchanged land and exact undo/redo',
  );
  await page.locator('#land-color-operation').selectOption('paint');
  await page.locator('#land-tip').selectOption('soft');
  const beforeCancel = JSON.stringify(records()),
    cp = await at(x, y);
  await page.mouse.move(cp.x, cp.y);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  assert.equal(JSON.stringify(records()), beforeCancel);
  result.checks.push('Escape discards color preview');
  await setBrushWorldRadius(page, 'land-radius', String(r * 0.35));
  const curve = Array.from({ length: 49 }, (_, i) => [
    x - r + (2 * r * i) / 48,
    y + Math.sin((i / 48) * Math.PI * 2) * r * 0.5,
  ]);
  await stroke(curve);
  await settled();
  const curveRecord = records()
    .filter((v) => v.paint)
    .sort((a, b) => b.order - a.order)[0];
  const ys = curveRecord.paint.strokes.flat().map((p) => p.y);
  assert(
    Math.max(...ys) > y + r * 0.35 && Math.min(...ys) < y - r * 0.35,
    'Fast color curve retains both bends from coalesced input',
  );
  assert.equal(maskBytes(), landBeforeColor);
  await capture('02c-fast-color-curve');
  result.checks.push('fast native color curve retains both bends without changing land');

  await tool('paint');
  assert.equal(Number(await page.locator('#land-radius').inputValue()), r);
  assert(await page.locator('#land-color-options').isHidden());
  await mode('land-erase', r * 0.35);
  await hold(x, y, 80);
  assert.equal(atTerrain(x, y), 'water');
  const erased = maskBytes();
  await page.locator('#atlas-undo').click();
  await atlasCanvasReady(page);
  assert.equal(atTerrain(x, y), 'plains');
  await page.locator('#atlas-redo').click();
  await atlasCanvasReady(page);
  assert.equal(maskBytes(), erased);
  result.checks.push('land, eraser, undo/redo through actual controls');
  const island = {
    x: c.view.x + c.view.width * 0.77,
    y: c.view.y + c.view.height * 0.28,
  };
  await mode('raise', r);
  await page.locator('#land-coast-roughness').fill('2');
  await hold(island.x, island.y, 2100);
  assert.equal(atTerrain(island.x, island.y), 'plains');
  await capture('03-fractal-island');
  result.checks.push('stationary fractal raise creates an island');
  await mode('lower', r * 0.45);
  await hold(island.x, island.y, 2100);
  assert.equal(atTerrain(island.x, island.y), 'water');
  await capture('04-fractal-hole');
  result.checks.push('stationary fractal lower creates interior water');
  await mode('raise', r);
  const before = maskBytes(),
    p = await at(x, y + r * 2);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(250);
  assert(maskBytes() === before, 'Escape must not commit the draft');
  result.checks.push('Escape discards mask preview');
  const lock = new Database(dir + '/workbench.sqlite');
  await mode('land', r);
  const retryPoint = {
      x: c.view.x + c.view.width * 0.75,
      y: c.view.y + c.view.height * 0.78,
    },
    rp = await at(retryPoint.x, retryPoint.y),
    beforeRetry = maskBytes();
  await page.mouse.move(rp.x, rp.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  lock.exec('BEGIN IMMEDIATE');
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      /database is locked|SQLITE_BUSY/.test(
        document.querySelector('#atlas-save-status').textContent,
      ),
    null,
    { timeout: 30000 },
  );
  assert.equal(maskBytes(), beforeRetry);
  lock.exec('ROLLBACK');
  lock.close();
  await page.locator('#land-finish').click();
  await settled();
  assert.equal(atTerrain(retryPoint.x, retryPoint.y), 'plains');
  result.checks.push('actual SQLite write failure retains mask stroke for retry');
  const persisted = maskBytes();
  await app.close();
  app = null;
  await start();
  assert(maskBytes() === persisted, 'Reopen must retain mask bytes');
  await capture('05-reopened');
  result.checks.push('fresh installed process retains exact mask');
  await page.locator('#atlas-output-open').click();
  await page.locator('#atlas-output summary').filter({ hasText: 'Bildoptionen' }).click();
  await page.locator('#atlas-export-size').fill('1600');
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, out + '/comparison.png');
  await page.locator('#atlas-export-png').click();
  await page.waitForFunction(
    () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
    null,
    { timeout: 60000 },
  );
  const png = require('pngjs').PNG.sync.read(await readFile(out + '/comparison.png'));
  assert.equal(Math.max(png.width, png.height), 1600);
  result.checks.push('native PNG export');
  assert.deepEqual(result.errors, []);
  result.ok = true;
} catch (error) {
  result.error = error.stack ?? String(error);
  if (page) {
    result.status = await page.locator('#atlas-save-status').textContent();
    await capture('failure').catch(() => {});
  }
  throw error;
} finally {
  if (app) {
    if (result.ok) {
      await app.close();
      result.normalExit = true;
    } else await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  }
  db.close();
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
}
