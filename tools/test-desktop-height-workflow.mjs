// Complete GM height visit. Only the initial empty campaign and native file choices are fixtures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady, atlasCanvasPoint } from './atlas-canvas-probe.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
const require = createRequire(import.meta.url),
  root = process.cwd(),
  zoom = Number(process.env.GM_QA_ZOOM ?? 1);
require('esbuild').buildSync({
  stdin: {
    contents: "export * from './src/app/storage/store';export * from './src/app/atlas/terrain-height';",
    resolveDir: root,
  },
  outfile: '.build/height-workflow-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, TerrainSampler } = require('../.build/height-workflow-store.cjs');
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/height-workflow-' + zoom),
  native = await createNativeSession({ root, output, name: 'gm-height-workflow' });
const store = new CampaignStore(native.profile + '/workbench.sqlite');
const original = store.create('Insel und Meerenge', [
  {
    id: 'coast',
    scopeId: 'local',
    floorId: 'ground',
    number: '1',
    name: 'Küstenanker',
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
  db = new Database(native.profile + '/workbench.sqlite', { readonly: true });
const records = (id) =>
  db
    .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=?')
    .all(id)
    .map((r) => JSON.parse(r.payload));
let campaign = original.id,
  page;
const sample = (x, y) => new TerrainSampler(records(campaign)).query({ x, y });
const heights = () =>
  records(campaign)
    .filter((r) => r.height)
    .map((r) => r.height)
    .sort((a, b) => a.pixel - b.pixel || a.x - b.x || a.y - b.y);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const workers = async () =>
  Object.fromEntries(
    await Promise.all(
      ['ui/atlas-brush-worker.js', 'atlas-region-worker.cjs'].map(async (p) => [
        p,
        hash(await readFile('.build/desktop/' + p)),
      ]),
    ),
  );
const workerHashes = await workers(),
  checks = [];
async function open(name, locate = true) {
  page = await native.launch(zoom);
  await page
    .locator('.campaign-card')
    .filter({ hasText: name })
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
  if (locate) {
    await page.locator('#atlas-search').fill('Küstenanker');
    await page.locator('#atlas-search-results button').filter({ hasText: 'Küstenanker' }).click();
    await atlasCanvasReady(page);
    await page.locator('#atlas-search').fill('');
  }
  await page.locator('#atlas-units').selectOption('metric');
  await page.locator('#atlas-section').selectOption('terrain');
  // Reopen the landscape at its useful regional scale; a room jump is a separate workflow.
  const width = () =>
    page.locator('#campaign-map').evaluate((n) => JSON.parse(n.dataset.atlasView).width);
  for (let i = 0; i < 30 && (await width()) < 8000; i++)
    await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
  for (let i = 0; i < 30 && (await width()) > 16000; i++)
    await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await atlasCanvasReady(page);
}
async function stroke(points) {
  const start = await atlasCanvasPoint(page, { x: points[0][0], y: points[0][1] });
  assert.equal(start.target, 'campaign-map');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const [x, y] of points.slice(1)) {
    const p = await atlasCanvasPoint(page, { x, y }, false);
    assert.equal(p.target, 'campaign-map');
    await page.mouse.move(p.x, p.y, { steps: 12 });
  }
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForFunction(
    () => document.querySelector('#land-status').textContent === 'Gespeichert',
    null,
    { timeout: 60000 },
  );
  await atlasCanvasReady(page);
}
async function hover(x, y) {
  const p = await atlasCanvasPoint(page, { x, y });
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(300);
}
async function shape(radius, target, direction = 'raise') {
  await page.locator('[data-tool-group="land"]').click();
  await page.locator('[data-atlas-tool="land-shape"]').click();
  await setHeightDirection(page, direction);
  await setBrushWorldRadius(page, 'land-radius', radius);
  await page.locator('#land-height-strength').fill('10000');
  await page.locator('#land-height-feather').fill('0');
  await page.locator('#land-height-target-enabled').check();
  await page.locator('#land-height-target').fill(String(target));
}
async function history(id) {
  await page.locator('#atlas-' + id).click();
  await atlasCanvasReady(page);
}
function assertResult() {
  assert.equal(sample(-800, 0).heightM, 300);
  assert.equal(sample(0, 0).heightM, -100);
  assert.equal(sample(0, 500).water, true);
  assert.equal(sample(-700, 300).water, true);
  assert.equal(sample(-300, 300).water, false);
  assert.equal(sample(-700, 300).heightM, 150);
}
try {
  await open(original.name);
  await shape(700, 150);
  await stroke([
    [-1200, 0],
    [1200, 0],
  ]);
  assert.equal(sample(-500, 0).heightM, 150);
  await shape(50, 300);
  await stroke([[-800, 0]]);
  await stroke([[0, 0]]);
  assert.equal(sample(0, 0).resolutionM, 1);
  await shape(120, -100, 'lower');
  await stroke([
    [0, -1000],
    [0, 1000],
  ]);
  assert.equal(sample(0, 500).heightM, -100);
  assert.equal(sample(0, 0).heightM, 300);
  assert.equal(sample(-800, 0).heightM, 300);
  await hover(0, 0);
  assert.match(await page.locator('#land-cursor-height').innerText(), /300 m.*Auflösung: 1 m/);
  assert.equal(await page.locator('#land-brush-resolution').innerText(), 'Pinselauflösung: 2 m');
  assert(await page.locator('#land-height-protection').isVisible());
  assert.match(
    await page.locator('#land-height-protection').innerText(),
    /1 m.*geschützt.*Radius verkleinern/,
  );
  assert.doesNotMatch(await page.locator('#land-height-protection').innerText(), /heranzoomen/);
  await native.capture(page, 'protected-bridge');
  await page.locator('#land-radius-fixed').uncheck();
  await hover(0, 0);
  assert.match(await page.locator('#land-height-protection').innerText(), /näher heranzoomen/);
  await setBrushWorldRadius(page, 'land-radius', 32);
  await hover(0, 0);
  assert(await page.locator('#land-height-protection').isHidden());
  assert.equal(await page.locator('#land-brush-resolution').innerText(), 'Pinselauflösung: 1 m');
  await stroke([
    [0, -100],
    [0, 100],
  ]);
  assert.equal(sample(0, 0).heightM, -100);
  assert.equal(sample(-800, 0).heightM, 300);
  await history('undo');
  assert.equal(sample(0, 0).heightM, 300);
  assert.equal(sample(0, 500).heightM, -100);
  await history('redo');
  assert.equal(sample(0, 0).heightM, -100);
  assert.equal(sample(-800, 0).heightM, 300);
  checks.push(
    'Island, fine peak and protected bridge; explicit resolution feedback leads to a fine cut without damaging the peak',
  );
  const originalHeights = heights();
  await page.locator('[data-tool-group="water"]').click();
  await page.locator('#land-sea-options summary').click();
  await page.locator('#land-sea-level').fill('175');
  await page.locator('#land-sea-apply').click();
  await atlasCanvasReady(page);
  assert.equal(sample(-500, 0).seaLevelM, 175);
  assert.equal(sample(-500, 0).water, true);
  assert.deepEqual(heights(), originalHeights);
  await native.capture(page, 'sea-level');
  await history('undo');
  assert.equal(sample(-500, 0).seaLevelM, 0);
  assert.equal(sample(-500, 0).water, false);
  await page.locator('[data-atlas-tool="water-add"]').click();
  await page.locator('#land-water-level').fill('160');
  await setBrushWorldRadius(page, 'land-radius', 250);
  await stroke([[-700, 300]]);
  assertResult();
  assert.deepEqual(heights(), originalHeights);
  await history('undo');
  assert.equal(sample(-700, 300).water, false);
  await history('redo');
  assertResult();
  await native.capture(page, 'bounded-lake');
  const saved = records(campaign);
  checks.push('Independent sea level, bounded lake, unchanged heights, Undo/Redo');
  await native.close();
  await open(original.name, false);
  assert.deepEqual(records(campaign), saved);
  assertResult();
  await native.capture(page, 'fresh-original');
  const archive = native.profile + '/island.kwcampaign';
  await native.app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, archive);
  await page.locator('#atlas-navigation').click();
  await page.locator('#campaign-manager').click();
  await page.locator('#campaign-export').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('#status')
        .textContent.includes('Kampagnenpaket mit Daten und Medien exportiert.'),
    null,
    { timeout: 60000 },
  );
  const archiveHash = hash(await readFile(archive));
  await page.locator('#campaign-import-package').click();
  await page.locator('#campaign-transfer-dialog').waitFor({ state: 'visible' });
  await page.locator('#campaign-transfer-name').fill('Insel aus Archiv');
  await page.locator('#campaign-transfer-accept').click();
  await page.locator('#campaign-transfer-dialog').waitFor({ state: 'hidden' });
  await atlasCanvasReady(page);
  const ids = db
    .prepare('SELECT DISTINCT campaign_id FROM atlas_landscape')
    .all()
    .map((r) => r.campaign_id);
  assert.equal(ids.length, 2);
  campaign = ids.find((id) => id !== original.id);
  assert(campaign);
  assert.deepEqual(records(original.id), saved);
  assert.deepEqual(heights(), originalHeights);
  assertResult();
  assert.equal(hash(await readFile(archive)), archiveHash);
  await native.capture(page, 'archive-copy');
  await native.close();
  await open('Insel aus Archiv', false);
  assertResult();
  assert.deepEqual(heights(), originalHeights);
  await shape(120, -100, 'lower');
  await hover(-800, 0);
  assert(await page.locator('#land-height-protection').isVisible());
  await native.capture(page, 'fresh-copy');
  await native.close();
  assert.deepEqual(await workers(), workerHashes);
  checks.push(
    'Normal restart, archive export and independent import, fresh copy retains fine peak, strait and bounded lake',
  );
  await native.finish({ complete: true, checks, workerHashes, archiveHash });
  console.log(JSON.stringify({ complete: true, output, checks }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  db.close();
  await native.dispose();
}
