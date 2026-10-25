// Integrated metric/mile workflow only; the unmerged DnD unit switch is outside this probe.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { atlasCanvasReady, atlasCanvasPoint } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const scale = Number(process.env.QA_SCALE ?? 1);
assert([1, 2].includes(scale));
const out = process.env.QA_EVIDENCE_DIR ?? (await mkdtemp(root + '/.build/atlas-distance-'));
await mkdir(out, { recursive: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/atlas-distance-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/atlas-distance-store.cjs'),
  profile = await mkdtemp('/tmp/atlas-distance-');
const store = new CampaignStore(profile + '/workbench.sqlite');
store.create('Entfernungen im Atlas', [
  {
    id: 'room',
    scopeId: 'local',
    floorId: 'ground',
    number: '1',
    name: 'Messraum',
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
  },
]);
store.tutorial('skipped');
store.close();
const Database = require('better-sqlite3'),
  db = new Database(profile + '/workbench.sqlite', { readonly: true });
const canonical = () =>
  JSON.stringify(
    ['room', 'atlas_landscape', 'history', 'receipt'].map((t) =>
      db.prepare('SELECT * FROM ' + t + ' ORDER BY rowid').all(),
    ),
  );
const result = {
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  profile,
  scale,
  hashes: {},
  launches: [],
  measurements: [],
  errors: [],
};
for (const f of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/app.css', 'ui/index.html'])
  result.hashes[f] = createHash('sha256')
    .update(await readFile(root + '/.build/desktop/' + f))
    .digest('hex');
let app, page;
async function launch() {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [
      root + '/.build/desktop/main.cjs',
      '--ozone-platform=x11',
      '--force-device-scale-factor=' + scale,
      '--data-dir',
      profile,
    ],
  });
  result.launches.push({ pid: app.process().pid });
  page = await app.firstWindow();
  page.on('pageerror', (e) => result.errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page.getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ }).click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
  );
  await atlasCanvasReady(page);
  await page.locator('#atlas-search').fill('Messraum');
  await page.locator('#atlas-search-results button').filter({ hasText: 'Messraum' }).click();
  await page.locator('#atlas-search').fill('');
  await atlasCanvasReady(page);
  await mapOnly();
}
async function close() {
  const ended = new Promise((resolve) =>
    app.process().once('exit', (code, signal) => resolve({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith('/index.html'))
      .close(),
  );
  let timer;
  try {
    const exit = await Promise.race([
      ended,
      new Promise(
        (_, reject) => (timer = setTimeout(() => reject(Error('Normal close timed out')), 10000)),
      ),
    ]);
    assert.deepEqual(exit, { code: 0, signal: null });
    result.launches.at(-1).exit = exit;
    result.launches.at(-1).pidAbsent = !(await stat('/proc/' + app.process().pid)
      .then(() => true)
      .catch(() => false));
    assert(result.launches.at(-1).pidAbsent);
    app = null;
  } finally {
    clearTimeout(timer);
  }
}
async function mapOnly() {
  if (await page.locator('#atlas-secondary').isVisible())
    await page.locator('#atlas-secondary-close').click();
  await atlasCanvasReady(page);
}
async function shot(name) {
  await page.screenshot({ path: out + '/' + name + '.png' });
}
async function points() {
  const b = await page.locator('#campaign-map').boundingBox(),
    v = JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view'));
  return {
    a: { x: Math.round(b.x + b.width * 0.4), y: Math.round(b.y + b.height * 0.5) },
    b: { x: Math.round(b.x + b.width * 0.6), y: Math.round(b.y + b.height * 0.5) },
    mpp: v.width / b.width,
  };
}
async function measure(name) {
  await page.locator('#atlas-measure').click();
  await mapOnly();
  const p = await points();
  await page.mouse.click(p.a.x, p.a.y);
  await page.mouse.click(p.b.x, p.b.y);
  await page.locator('#campaign-map').press('Enter');
  await atlasCanvasReady(page);
  const meters = (p.b.x - p.a.x) * p.mpp,
    n = (x) => x.toLocaleString('de-DE', { maximumSignificantDigits: 3 }),
    expected =
      (meters < 1000 ? n(meters) + ' m' : n(meters / 1000) + ' km') +
      ' · ' +
      n(meters / 1609.344) +
      ' Meilen';
  const actual = await page.locator('#land-status').textContent();
  result.measurements.push({ name, meters, actual, expected });
  await shot(name);
}
try {
  await launch();
  await page.locator('#atlas-section').selectOption('terrain');
  await atlasCanvasReady(page);
  await page.locator('[data-tool-group="routes"]').click();
  await page.locator('[data-atlas-tool="road"]').click();
  await atlasCanvasReady(page);
  await page.locator('#atlas-new-name').fill('Messweg');
  const p = await points();
  await page.mouse.click(p.a.x, p.a.y);
  await page.mouse.click(p.b.x, p.b.y);
  await page.locator('#campaign-map').press('Enter');
  await page.waitForFunction(
    () => document.querySelector('#land-status').textContent === 'Gespeichert',
  );
  await atlasCanvasReady(page);
  const road = JSON.parse(
    db
      .prepare("SELECT payload FROM atlas_landscape WHERE json_extract(payload,'$.name')='Messweg'")
      .get().payload,
  );
  await page.locator('#atlas-select').click();
  await mapOnly();
  const center = await atlasCanvasPoint(page, {
    x: (road.points[0].x + road.points[1].x) / 2,
    y: (road.points[0].y + road.points[1].y) / 2,
  });
  assert.equal(center.target, 'campaign-map', 'Road selection must target the visible map');
  await page.mouse.click(center.x, center.y);
  await page
    .locator('#land-record-width:visible, #atlas-hit-candidates[open]')
    .waitFor({ state: 'visible' });
  if (await page.locator('#atlas-hit-candidates').isVisible())
    await page
      .locator('#atlas-hit-candidates')
      .getByRole('button', { name: 'Landschaft: Messweg', exact: true })
      .click();
  await page.locator('#land-record-width').waitFor({ state: 'visible' });
  await page.locator('#land-record-width').fill('2');
  await page.getByRole('button', { name: 'Auswahl speichern', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('#land-status').textContent === 'Gespeichert',
  );
  await atlasCanvasReady(page);
  assert.equal(
    JSON.parse(db.prepare('SELECT payload FROM atlas_landscape WHERE id=?').get(road.id).payload)
      .width,
    2,
  );
  const before = canonical();
  await measure('measured');
  await page.locator('#atlas-output-open').click();
  await page.locator('#atlas-output summary').filter({ hasText: 'Bildoptionen' }).click();
  await page.locator('#atlas-export-size').fill('800');
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, out + '/map.png');
  await page.locator('#atlas-export-png').click();
  await page.waitForFunction(
    () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
  );
  const png = require('pngjs').PNG.sync.read(await readFile(out + '/map.png'));
  assert.equal(Math.max(png.width, png.height), 800);
  result.export = { width: png.width, height: png.height };
  await page.locator('#atlas-output-back').click();
  await close();
  await launch();
  assert.equal(canonical(), before);
  await measure('fresh');
  assert.equal(canonical(), before);
  await close();
  assert.deepEqual(result.errors, []);
  for (const m of result.measurements) assert.equal(m.actual, m.expected);
  result.ok = true;
} catch (error) {
  result.error = error.stack;
  if (page && app) await shot('failure').catch(() => {});
  throw error;
} finally {
  if (app) await close().catch((error) => console.error('Cleanup: ' + error.message));
  db.close();
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
}
