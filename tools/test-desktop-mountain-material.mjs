// Material style in the ordinary Atlas: paired views, history, export and restart.
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { openTerrainDisplay, setTerrainContours } from './atlas-brush-probe.mjs';
import { RELIEF_STROKES } from './terrain-relief-scene.mjs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-mountain-material');
require('esbuild').buildSync({
  stdin: { resolveDir: root, contents: "export * from './src/app/storage/store';" },
  outfile: '.build/mountain-native.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/mountain-native.cjs');
const native = await createNativeSession({ root, output: out, name: 'atlas-mountain-material' }),
  store = new CampaignStore(native.profile + '/workbench.sqlite');
const campaign = store.create('Gebirge im Atlas'),
  token = store.activate(campaign.id).token;
for (const stroke of RELIEF_STROKES)
  store.executeAtlasCommit({
    token,
    campaignId: campaign.id,
    commandId: randomUUID(),
    action: { kind: 'landscape-height-stroke', stroke },
  });
store.tutorial('skipped');
store.close();
const db = new (require('better-sqlite3'))(native.profile + '/workbench.sqlite', {
  readonly: true,
});
const records = () =>
  db
    .prepare('SELECT payload FROM atlas_landscape ORDER BY id')
    .all()
    .map((r) => JSON.parse(r.payload));
const geometry = () => JSON.stringify(records().filter((r) => !r.terrainSettings));
const stages = [];
const baseline = geometry(),
  style = () => records().find((r) => r.terrainSettings)?.terrainSettings.style;
let page;
const ready = async () => {
  await atlasCanvasReady(page);
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
  );
};
async function capture(name) {
  const start = performance.now();
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
    null,
    { timeout: 60000 },
  );
  stages.push({
    name,
    detailWaitMs: performance.now() - start,
    quality: await page.locator('#campaign-map').getAttribute('data-terrain-quality'),
  });
  await native.capture(page, name);
}
async function open() {
  page = await native.launch();
  await native.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1440, 900),
  );
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        'atlas-camera:' + id,
        JSON.stringify({ x: -6000, y: -4500, width: 12000, height: 9000 }),
      ),
    campaign.id,
  );
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Gebirge im Atlas' })
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
  await ready();
  await page.locator('#atlas-units').selectOption('metric');
}
async function apply(enabled, snowline) {
  await openTerrainDisplay(page);
  await page.locator('#land-relief-mountains').setChecked(enabled);
  await page.locator('#land-relief-snowline').fill(String(snowline));
  await page.locator('#land-relief-apply').click();
  await page.waitForFunction(
    () => document.querySelector('#land-status').textContent === 'Gespeichert',
  );
  const deadline = Date.now() + 15000;
  while (
    (style()?.mountains !== enabled || style()?.snowlineM !== snowline) &&
    Date.now() < deadline
  )
    await new Promise((resolve) => setTimeout(resolve, 25));
  await ready();
  assert.equal(style().mountains, enabled);
  assert.equal(style().snowlineM, snowline);
  assert.equal(geometry(), baseline);
  await page.keyboard.press('Escape');
}
try {
  await open();
  await setTerrainContours(page, '0');
  await page.locator('#atlas-view').click();
  await page.locator('#land-grid').uncheck();
  await page.keyboard.press('Escape');
  await apply(false, 900);
  await capture('01-disabled');
  await apply(true, 900);
  await capture('02-rock-snow');
  await page.locator('#atlas-undo').click();
  await ready();
  assert.equal(style().mountains, false);
  await page.locator('#atlas-redo').click();
  await ready();
  assert.equal(style().mountains, true);
  assert.equal(geometry(), baseline);
  await apply(true, 1600);
  await capture('03-high-snowline');
  await page.locator('#atlas-undo').click();
  await ready();
  assert.equal(style().snowlineM, 900);
  await page.locator('#atlas-view').click();
  await page.locator('#terrain-tilt').fill('45');
  await page.locator('#terrain-tilt').dispatchEvent('input');
  await page.keyboard.press('Escape');
  await ready();
  await capture('04-tilted');
  await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await ready();
  await capture('05-zoom');
  assert.equal(geometry(), baseline);
  assert.equal(style().snowlineM, 900);
  await native.app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, out + '/export.png');
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
  const png = require('pngjs').PNG.sync.read(await readFile(out + '/export.png'));
  assert.equal(Math.max(png.width, png.height), 1024);
  assert.equal(geometry(), baseline);
  const persisted = JSON.stringify(records());
  await native.close();
  await open();
  assert.equal(JSON.stringify(records()), persisted);
  await openTerrainDisplay(page);
  assert.equal(await page.locator('#land-relief-snowline').inputValue(), '900');
  assert.equal(await page.locator('#land-relief-mountains').isChecked(), true);
  await page.keyboard.press('Escape');
  await capture('06-reopened');
  await native.close();
  await native.finish({
    stages,
    checks: [
      'Ordinary Atlas: material toggle and physical snowline.',
      'Undo/redo restores material settings without changing height or geometry.',
      'Top-down, tilted and zoomed views plus native PNG export.',
      'Fresh process retains style and complete terrain records.',
    ],
  });
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  db.close();
  await native.dispose();
}
