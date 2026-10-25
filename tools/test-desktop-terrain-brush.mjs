import {
  setBrushWorldRadius,
  setHeightDirection,
  setTerrainContours,
} from './atlas-brush-probe.mjs';
// Actual Electron window and an isolated synthetic campaign. Never opens the user's profile.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { homedir } from 'node:os';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/terrain-height';",
    resolveDir: root,
  },
  outfile: '.build/brush-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/brush-native-store.cjs');
const profileRoot = path.join(homedir(), '.cache/saltmarcher/ui-profiles');
await mkdir(profileRoot, { recursive: true });
const dir = await mkdtemp(path.join(profileRoot, 'landscape-')),
  out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/terrain-brush-native');
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
const cam = store.create('Höhenprobe R2', [room]),
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
result.sourceHashes = {};
for (const file of [
  'src/app/atlas/terrain-height.ts',
  'src/app/atlas/terrain-brush.ts',
  'src/app/atlas/atlas-tool-catalog.ts',
  'src/app/atlas/atlas-workspace-layout.ts',
  'src/app/atlas/atlas-units.ts',
  'tests/atlas/desktop-atlas-tool-hierarchy.test.mjs',
  'src/app/atlas/campaign-atlas-ui.ts',
  'tests/atlas/terrain-brush.test.mjs',
  'src/app/atlas/landscape-color-surface.ts',
  'src/app/atlas/landscape-tool-settings.ts',
  'src/app/storage/campaign-atlas.ts',
  'src/app/atlas/campaign-atlas-contracts.ts',
  'src/app/atlas/atlas-region-contracts.ts',
  'src/app/atlas/atlas-landscape-view.ts',
  'tests/atlas/terrain-height.test.mjs',
  'src/app/atlas/atlas-landscape.ts',
  'src/app/atlas/atlas-brush-worker.ts',
  'src/app/atlas/landscape-raster.ts',
  'src/app/storage/atlas-landscape.ts',
  'src/app/storage/landscape-brush-edit.ts',
  'src/app/storage/atlas-landscape-region.ts',
  'src/app/storage/store.ts',
  'src/app/atlas/atlas-landscape-ui.ts',
  'desktop/main.ts',
  'desktop/preload.ts',
  '.build/desktop/main.cjs',
  '.build/desktop/ui/atlas-brush-worker.js',
  '.build/desktop/ui/renderer.js',
  '.build/desktop/atlas-region-worker.cjs',
  'tools/test-desktop-terrain-brush.mjs',
])
  result.sourceHashes[file] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
const mark = (text) => {
  result.checks.push(text);
  console.log(text);
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
  console.log('Native window opened');
  page.on('pageerror', (e) => result.errors.push(e.stack ?? e.message));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Höhenprobe R2' })
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
  console.log('Atlas ready; finding the reference room');
  await page.locator('#atlas-search').fill('Referenzhaus');
  await page.locator('#atlas-search-results button').filter({ hasText: 'Referenzhaus' }).click();
  await atlasCanvasReady(page);
  await page.locator('#atlas-search').fill('');
  await page.locator('#atlas-units').selectOption('metric');
  await page.locator('#atlas-section').selectOption('terrain');
  await atlasCanvasReady(page);
}
const tool = async (value) => {
  await page.waitForFunction(() => !document.querySelector('#land-tool').disabled);
  await page.locator(`[data-tool-select="land-tool"][data-tool-value="${value}"]`).first().click();
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
async function visibleColor(x, y) {
  const p = await at(x, y),
    png = require('pngjs').PNG.sync.read(await page.screenshot()),
    i = (Math.round(p.y) * png.width + Math.round(p.x)) * 4;
  return [...png.data.subarray(i, i + 3)];
}
async function stroke(points) {
  const screen = await Promise.all(points.map((p) => at(...p)));
  await page.mouse.move(screen[0].x, screen[0].y);
  await page.mouse.down();
  for (let i = 1; i < screen.length; i++) {
    await page.mouse.move(screen[i].x, screen[i].y, { steps: 12 });
    await page.waitForTimeout(80);
  }
  await page.mouse.up();
}

const maskBytes = () =>
  require('node:crypto')
    .createHash('sha256')
    .update(
      JSON.stringify(
        records()
          .filter((r) => r.height)
          .map((r) => [r.id, r.height.data])
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
    { timeout: 60000 },
  );
  await atlasCanvasReady(page);
}
async function hold(x, y, ms) {
  const p = await at(x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  const started = Date.now();
  await settled();
  result.commitWaitMs ??= [];
  result.commitWaitMs.push(Date.now() - started);
}
try {
  await start();
  await tool('height');
  assert.equal(await page.locator('[data-atlas-tool]').count(), 3);
  assert.equal(await page.locator('[data-tool-group=height]').count(), 0);
  for (let i = 0; i < 13; i++)
    await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
  await atlasCanvasReady(page);
  const c = await camera(),
    x = c.view.x + c.view.width * 0.5,
    y = c.view.y + c.view.height * 0.5,
    r = Math.round(c.view.width * 0.12);
  const core = require(root + '/.build/brush-native-store.cjs'),
    sample = (x, y) => new core.TerrainSampler(records()).query({ x, y });
  async function heightMode(mode, radius, strength = 300, feather = 0.8, target) {
    await page
      .locator('[data-atlas-tool="' + (mode === 'smooth' ? 'land-smooth' : 'land-shape') + '"]')
      .click();
    await setBrushWorldRadius(page, 'land-radius', String(radius));
    await page.locator('#land-height-strength').fill(String(strength));
    await page.locator('#land-height-feather').fill(String(feather));
    if (mode !== 'smooth') {
      await setHeightDirection(page, mode);
      await page.locator('#land-height-target-enabled').setChecked(target !== undefined);
      if (target !== undefined) await page.locator('#land-height-target').fill(String(target));
    }
  }
  await heightMode('raise', r * 1.6, 10000, 0, 100);
  await stroke([
    [x - r * 1.3, y],
    [x + r * 1.3, y],
  ]);
  await settled();
  assert.equal(sample(x, y).heightM, 100);
  assert.equal(sample(x, y).water, false);
  mark('Exactly three land tools; create an island from ocean with the directional target');
  await heightMode('raise', r, 300, 1);
  await page.locator('#land-coast-roughness').fill('1.2');
  const hill = await at(x - r, y);
  await page.mouse.move(hill.x, hill.y);
  await page.mouse.down();
  await page.waitForFunction(
    () => document.querySelector('#land-cursor-height').textContent.includes('Vorschau'),
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(400);
  await capture('01-preview');
  await page.mouse.up();
  await settled();
  await page.waitForFunction(
    () => !document.querySelector('#land-cursor-height').textContent.includes('Vorschau'),
  );
  const high = sample(x - r, y).heightM;
  assert(high > 150);
  mark('Raise hill with a soft edge; native worker preview shows height before commit');
  await heightMode('raise', r, 1000, 0.5, 300);
  await hold(x + r, y, 650);
  assert(Math.abs(sample(x + r, y).heightM - 300) < 0.1);
  assert(Math.abs(sample(x + r + r * 0.2, y).heightM - 300) < 0.1);
  mark('Create a plateau at the exact target height');
  const plateau = maskBytes();
  await heightMode('lower', r * 0.35, 600, 0.8);
  const valley = await Promise.all(
    [
      [x, y - r * 2],
      [x, y],
      [x, y + r * 2],
    ].map((p) => at(...p)),
  );
  await page.mouse.move(valley[0].x, valley[0].y);
  await page.mouse.down();
  await page.mouse.move(valley[1].x, valley[1].y, { steps: 16 });
  await page.waitForTimeout(500);
  await page.mouse.move(valley[2].x, valley[2].y, { steps: 16 });
  await page.mouse.up();
  await settled();
  assert(sample(x, y).water);
  const lowered = maskBytes();
  assert.notEqual(lowered, plateau);
  await page.locator('#atlas-undo').click();
  await atlasCanvasReady(page);
  assert.equal(maskBytes(), plateau);
  await page.locator('#atlas-redo').click();
  await atlasCanvasReady(page);
  assert.equal(maskBytes(), lowered);
  mark('Lower valley/coast and undo or redo the entire gesture in one step');
  await heightMode('smooth', r, 800, 1);
  const beforeSmooth = sample(x - r, y).heightM;
  await hold(x - r, y, 500);
  assert(sample(x - r, y).heightM < beforeSmooth);
  mark('Smooth the hill through the real toolbar and pointer gesture');
  const colorHeights = maskBytes();
  await page.locator('[data-atlas-tool="land-color"]').click();
  assert.equal(await page.locator('#land-color-operation').isVisible(), true);
  await setBrushWorldRadius(page, 'land-radius', String(r * 0.4));
  await page.locator('#land-tip').selectOption('round');
  await page.locator('#land-paint-color').fill('#d644aa');
  const beforeColor = await visibleColor(x + r, y);
  await stroke([
    [x + r * 0.9, y],
    [x + r * 1.1, y],
  ]);
  await settled();
  const paintedColor = await visibleColor(x + r, y);
  assert.notDeepEqual(paintedColor, beforeColor);
  assert.equal(maskBytes(), colorHeights);
  await page.locator('#land-color-operation').selectOption('erase');
  await stroke([
    [x + r * 0.9, y],
    [x + r * 1.1, y],
  ]);
  await settled();
  assert.deepEqual(await visibleColor(x + r, y), beforeColor);
  assert.equal(maskBytes(), colorHeights);
  await page.locator('#atlas-undo').click();
  await atlasCanvasReady(page);
  assert.deepEqual(await visibleColor(x + r, y), paintedColor);
  await page.locator('#atlas-redo').click();
  await atlasCanvasReady(page);
  assert.deepEqual(await visibleColor(x + r, y), beforeColor);
  await page.locator('#atlas-undo').click();
  await atlasCanvasReady(page);
  await capture('02a-painted');
  mark(
    'Paint and erase land color with one brush, undo/redo, unchanged heights and visible pixels',
  );
  const baseline = maskBytes();
  await heightMode('lower', r, 300);
  const p = await at(x + r, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  assert.equal(maskBytes(), baseline);
  mark('Escape discards the gesture without a storage change');
  // Simulated storage error only in this disposable native-test campaign.
  async function refreshCamera() {
    for (const name of ['Verkleinern', 'Vergrößern']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(400);
      await atlasCanvasReady(page);
    }
  }
  const faultDb = new Database(dir + '/workbench.sqlite');
  faultDb.exec(
    "CREATE TRIGGER r2_fail BEFORE INSERT ON atlas_landscape WHEN json_extract(new.payload,'$.height') IS NOT NULL BEGIN SELECT RAISE(ABORT,'R2 simulated write failure'); END",
  );
  await refreshCamera();
  await page.mouse.move(hill.x, hill.y);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      !document.querySelector('#land-tool').disabled &&
      document.body.textContent.includes('R2 simulated write failure'),
  );
  assert.equal(maskBytes(), baseline);
  faultDb.exec('DROP TRIGGER r2_fail');
  faultDb.close();
  await refreshCamera();
  await page.locator('#land-finish').click();
  await settled();
  assert.notEqual(maskBytes(), baseline);
  assert.equal(await page.locator('#status').getAttribute('data-error'), 'false');
  assert.equal(await page.locator('#atlas-save-status').getAttribute('data-error'), 'false');
  await page.locator('#atlas-undo').click();
  await atlasCanvasReady(page);
  assert.equal(maskBytes(), baseline);
  mark(
    'A rejected native write retains the draft; retry commits it and one undo restores the original',
  );
  await setTerrainContours(page, '50');
  await atlasCanvasReady(page);
  await page.mouse.move(hill.x, hill.y);
  await page.waitForFunction(() =>
    /Höhe:.*(?:m|km)/.test(document.querySelector('#land-cursor-height').textContent),
  );
  await capture('02-relief-contours');
  assert.equal(maskBytes(), baseline);
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, out + '/region.png');
  await page.locator('#atlas-output-open').click();
  await page.locator('#atlas-output summary').filter({ hasText: 'Bildoptionen' }).click();
  await page.locator('#atlas-export-size').fill('1024');
  await page.locator('#atlas-export-grid').uncheck();
  await page.locator('#atlas-export-png').click();
  await page.waitForFunction(
    () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
    null,
    { timeout: 60000 },
  );
  const png = require('pngjs').PNG.sync.read(await readFile(out + '/region.png'));
  assert.equal(Math.max(png.width, png.height), 1024);
  assert.equal(maskBytes(), baseline);
  const colors = new Set();
  for (let i = 0; i < png.data.length; i += 4) colors.add([...png.data.slice(i, i + 3)].join(','));
  assert(colors.size > 30);
  mark('Contour display and PNG export preserve canonical heights');
  await page.locator('#atlas-output-back').click();
  const persisted = JSON.stringify(records());
  await app.close();
  app = null;
  await start();
  assert.equal(JSON.stringify(records()), persisted);
  await capture('03-reopened');
  mark('Fresh native process reads the authored hills, plateau and valley');
  assert.deepEqual(result.errors, []);
  result.ok = true;
} catch (error) {
  result.error = error.stack ?? String(error);
  if (page) {
    // A crashed/closed renderer must not replace the original failure with a diagnostic timeout.
    result.landState = await page
      .evaluate(() => ({
        disabled: document.querySelector('#land-tool')?.disabled,
        status: document.querySelector('#land-status')?.textContent,
        saveStatus: document.querySelector('#atlas-save-status')?.textContent,
        region: document.querySelector('#campaign-atlas')?.dataset.regionState,
      }))
      .catch((error) => ({ diagnosticError: String(error) }));
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
