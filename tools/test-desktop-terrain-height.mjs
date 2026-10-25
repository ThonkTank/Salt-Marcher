import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
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
      "export * from './src/app/storage/store';export * from './src/app/atlas-landscape';export * from './src/app/terrain-height';",
    resolveDir: root,
  },
  outfile: '.build/height-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/height-native-store.cjs');
const profileRoot = path.join(homedir(), '.cache/saltmarcher/ui-profiles');
await mkdir(profileRoot, { recursive: true });
const dir = await mkdtemp(path.join(profileRoot, 'landscape-')),
  out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/terrain-height-native');
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
const cam = store.create('Höhenprobe R1', [room]),
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
  'src/app/terrain-height.ts',
  'src/app/landscape-color-surface.ts',
  'src/app/landscape-tool-settings.ts',
  'src/app/storage/campaign-atlas.ts',
  'src/app/campaign-atlas-contracts.ts',
  'src/app/atlas-region-contracts.ts',
  'src/app/atlas-landscape-view.ts',
  'tests/terrain-height.test.mjs',
  'src/app/atlas-landscape.ts',
  'src/app/atlas-brush-worker.ts',
  'src/app/landscape-raster.ts',
  'src/app/storage/atlas-landscape.ts',
  'src/app/storage/landscape-brush-edit.ts',
  'src/app/storage/atlas-landscape-region.ts',
  'src/app/storage/store.ts',
  'src/app/atlas-landscape-ui.ts',
  'desktop/main.ts',
  'desktop/preload.ts',
  '.build/desktop/main.cjs',
  '.build/desktop/ui/atlas-brush-worker.js',
  '.build/desktop/ui/renderer.js',
  '.build/desktop/atlas-region-worker.cjs',
  'tools/test-desktop-terrain-height.mjs',
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
  page.on('pageerror', (e) => result.errors.push(e.stack ?? e.message));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Höhenprobe R1' })
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
    { timeout: 30000 },
  );
  await atlasCanvasReady(page);
}
async function mode(value, radius) {
  await page.locator('[data-atlas-tool="land-shape"]').click();
  const lower = ['land-erase', 'lower'].includes(value);
  await setHeightDirection(page, lower ? 'lower' : 'raise');
  await page.locator('#land-height-strength').fill('100000');
  await page.locator('#land-height-feather').fill('0');
  await page.locator('#land-height-target-enabled').check();
  await page.locator('#land-height-target').fill(lower ? '-100' : '100');
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
  await tool('height');
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
  await atlasCanvasReady(page);
  const c = await camera(),
    x = c.view.x + c.view.width * 0.4,
    y = c.view.y + c.view.height * 0.6,
    r = Math.max(3, c.view.width * 0.05);
  const core = require(root + '/.build/height-native-store.cjs'),
    sample = (x, y) => new core.TerrainSampler(records()).query({ x, y });
  assert.equal(sample(x, y).heightM, -100);
  await mode('land', r);
  await stroke([
    [x - r * 2, y],
    [x + r * 2, y],
  ]);
  await settled();
  assert.equal(sample(x, y).heightM, 100);
  assert(!records().some((r) => r.mask));
  assert.deepEqual(await visibleColor(x, y), [238, 229, 207]);
  await capture('01-island');
  mark('Native land stroke stores metres without a second mask');
  await mode('land-erase', r * 0.3);
  await stroke([
    [x, y - r * 1.5],
    [x, y + r * 1.5],
  ]);
  await settled();
  assert.equal(sample(x, y).heightM, -100);
  assert.deepEqual(await visibleColor(x, y), [127, 168, 189]);
  await capture('02-strait');
  const strait = maskBytes();
  await page.locator('#atlas-undo').click();
  await atlasCanvasReady(page);
  assert.equal(sample(x, y).heightM, 100);
  await page.locator('#atlas-redo').click();
  await atlasCanvasReady(page);
  assert.equal(maskBytes(), strait);
  mark('Lower a strait, undo and redo restore exact heights');
  const baseline = maskBytes(),
    p = await at(x + r, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  assert.equal(maskBytes(), baseline);
  mark('Escape discards height preview');
  await page.locator('[data-tool-group="water"]').click();
  await page.locator('#land-sea-level').locator('..').locator('..').locator('summary').click();
  await page.locator('#land-sea-level').fill('150');
  await page.locator('#land-sea-apply').click();
  await settled();
  assert(sample(x + r, y).water);
  assert.equal(maskBytes(), baseline);
  assert.deepEqual(await visibleColor(x + r, y), [127, 168, 189]);
  await capture('03-sea-level');
  await page.locator('#atlas-undo').click();
  await atlasCanvasReady(page);
  assert(!sample(x + r, y).water);
  mark('Campaign sea level changes coast without rewriting heights and is undoable');
  const persisted = JSON.stringify(records());
  await app.close();
  app = null;
  await start();
  assert.equal(JSON.stringify(records()), persisted);
  assert.equal(sample(x, y).heightM, -100);
  await capture('04-reopened');
  mark('Fresh native process reads the exact authored height field');
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
