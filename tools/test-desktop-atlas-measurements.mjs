// Native measurement workflow, isolated synthetic campaign. Run after build:desktop.
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { createNativeSession } from './native-session.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { atlasCanvasReady, atlasCanvasPoint } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json');
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-measurements-native');
await mkdir(out, { recursive: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/measurement-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/measurement-store.cjs');
const native = await createNativeSession({ root, output: out, name: 'atlas-measurements' }),
  profile = native.profile,
  store = new CampaignStore(profile + '/workbench.sqlite');
const room = {
  id: 'measurement-room',
  scopeId: 'local',
  floorId: 'ground',
  number: '1',
  name: 'Messraum',
  revision: 0,
  polygons: [
    {
      outer: [
        { x: 0, y: 0 },
        { x: 15.24, y: 0 },
        { x: 15.24, y: 9.144 },
        { x: 0, y: 9.144 },
      ],
      holes: [],
    },
  ],
  sections: [],
};
const campaign = store.create('Atlasmaße', [room]);
store.tutorial('skipped');
store.close();
const result = { cases: [] };
let app, page;
async function open() {
  page = await native.launch();
  app = native.app;
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype,
      clear = proto.clearRect,
      fill = proto.fillText;
    proto.clearRect = function (...args) {
      if (this.canvas.id === 'campaign-map') window.__measurementText = [];
      return clear.apply(this, args);
    };
    proto.fillText = function (text, ...args) {
      if (this.canvas.id === 'campaign-map') (window.__measurementText ??= []).push(String(text));
      return fill.call(this, text, ...args);
    };
  });
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Atlasmaße' })
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
}
async function close() {
  await native.close();
  app = null;
}
async function text(pattern) {
  await page.waitForFunction(
    (pattern) => (window.__measurementText ?? []).some((s) => new RegExp(pattern).test(s)),
    pattern,
  );
  return page.evaluate(() => window.__measurementText);
}
async function frame(name) {
  await native.capture(page, name);
  result.cases.push({
    name,
    zoom: await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'SaltMarcher')
        .webContents.getZoomFactor(),
    ),
    viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
    text: await page.evaluate(() => window.__measurementText),
  });
}
async function choose(section, group, tool) {
  await page.locator('#atlas-section').selectOption(section);
  await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
  await page.locator('[data-tool-group="' + group + '"]').click();
  await page.locator('[data-atlas-tool="' + tool + '"]').click();
  await atlasCanvasReady(page);
  if (await page.locator('#atlas-secondary').isVisible())
    await page.locator('#atlas-secondary-close').click();
}
async function fraction(x, y, click = false) {
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await atlasCanvasReady(page);
  const box = await page.locator('#campaign-map').boundingBox();
  await page.mouse[click ? 'click' : 'move'](box.x + box.width * x, box.y + box.height * y);
}
async function search(name) {
  await page.locator('#atlas-search').fill(name);
  await page.locator('#atlas-search-results button').filter({ hasText: name }).first().click();
  await page.locator('#atlas-search').fill('');
  await atlasCanvasReady(page);
}
function geometry() {
  const fresh = new CampaignStore(profile + '/workbench.sqlite');
  try {
    const active = fresh.activate(campaign.id),
      atlas = fresh.campaignAtlas(active.token);
    const building = atlas.cities.flatMap((c) => c.units).find((b) => b.groupId);
    assert(building, 'Generated building must be persisted');
    assert.equal(building.groupRecipe.width, 12.192);
    assert.equal(building.groupRecipe.depth, 7.62);
    const points = building.footprint.flatMap((p) => p.outer);
    assert(
      Math.abs(Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)) - 12.192) <
        1e-6,
    );
    assert(
      Math.abs(Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)) - 7.62) <
        1e-6,
    );
    return {
      rooms: atlas.geometry.rooms,
      elements: atlas.geometry.elements,
      bindings: atlas.bindings,
      cities: atlas.cities,
    };
  } finally {
    fresh.close();
  }
}
try {
  await open();
  assert.equal(await page.locator('#atlas-units').inputValue(), 'dnd');
  await text('Kante zu Kante');
  await frame('hex-dnd');
  await choose('terrain', 'routes', 'road');
  await page.locator('#land-width').fill('10');
  await fraction(0.4, 0.4, true);
  await fraction(0.65, 0.55);
  await text('Länge:');
  await frame('road-dnd');
  await page.locator('#atlas-units').selectOption('metric');
  assert.equal(await page.locator('#land-width').inputValue(), '3.048');
  await text('Breite: 3,05 m');
  assert.doesNotMatch(await page.locator('#land-cursor-height').innerText(), /ft/);
  await frame('road-metric');
  await page.locator('#atlas-units').selectOption('dnd');
  assert.equal(await page.locator('#land-width').inputValue(), '10');
  await page.locator('#campaign-map').press('Escape');
  await search('Messraum');
  await text('Fläche: 1.500 ft²');
  await frame('room-selected');
  await choose('interior', 'rooms', 'room-rectangle');
  await page.locator('#drawing-room-name').fill('Neuer Messraum');
  const a = await atlasCanvasPoint(page, { x: 2, y: 2 }),
    b = await atlasCanvasPoint(page, { x: 8, y: 7 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await text('Fläche:');
  await frame('room-drag');
  await page.mouse.up();
  await atlasCanvasReady(page);
  await page.waitForFunction(() => !document.querySelector('#atlas-undo').disabled);
  await page.locator('#atlas-undo').click();
  await atlasCanvasReady(page);
  await page.locator('#atlas-redo').click();
  await atlasCanvasReady(page);
  await page.locator('#atlas-section').selectOption('city');
  await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
  if (await page.locator('#atlas-secondary').isVisible())
    await page.locator('#atlas-secondary-close').click();
  await page.locator('#atlas-create-city').click();
  await page.locator('#atlas-new-name').fill('Messstadt');
  await fraction(0.65, 0.6, true);
  await page.waitForFunction(
    () => document.querySelector('#atlas-selection-title').textContent === 'Messstadt',
  );
  await atlasCanvasReady(page);
  await page.locator('#atlas-placement summary').click();
  const position = await page.locator('#atlas-binding-x').inputValue(),
    edited = String(Number(position) + 10);
  await page.locator('#atlas-binding-x').fill(edited);
  await page.locator('#atlas-units').selectOption('metric');
  await page.locator('#atlas-units').selectOption('dnd');
  assert(
    Math.abs(Number(await page.locator('#atlas-binding-x').inputValue()) - Number(edited)) < 1e-7,
    'unit switch retains unsubmitted placement',
  );
  await page.locator('#atlas-binding-x').fill(position);
  await page.locator('#atlas-draft-cancel').click();
  await choose('city', 'areas', 'district');
  await fraction(0.3, 0.3, true);
  await page.waitForFunction(() =>
    document.getElementById('city-path-hint').textContent.startsWith('1 Punkte'),
  );
  await fraction(0.7, 0.3, true);
  await page.waitForFunction(() =>
    document.getElementById('city-path-hint').textContent.startsWith('2 Punkte'),
  );
  await fraction(0.7, 0.65);
  await text('Fläche:');
  await frame('district-draft');
  await fraction(0.7, 0.65, true);
  await page.locator('#campaign-map').press('Enter');
  await atlasCanvasReady(page);
  await choose('city', 'buildings', 'building');
  await fraction(0.5, 0.5);
  await text('Fläche:');
  await frame('building-preview');
  await fraction(0.5, 0.5, true);
  const recipe = page.getByRole('dialog', { name: 'Raumgruppe erzeugen' });
  await recipe.waitFor();
  assert.match(await recipe.locator('[name=width]').locator('..').innerText(), /ft/);
  await recipe.locator('[name=width]').fill('40');
  await recipe.locator('[name=depth]').fill('25');
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'SaltMarcher');
    w.setSize(1440, 1000);
    w.webContents.setZoomFactor(2);
  });
  await page.waitForFunction(() => innerWidth <= 720);
  await frame('building-recipe-200');
  const overflow = await recipe.evaluate((el) => ({
    width: el.scrollWidth,
    client: el.clientWidth,
    box: el.getBoundingClientRect().toJSON(),
    viewport: innerWidth,
  }));
  assert(
    overflow.box.left >= 0 &&
      overflow.box.right <= overflow.viewport &&
      overflow.width <= overflow.client + 1,
    'Building recipe must fit the 200% viewport: ' + JSON.stringify(overflow),
  );
  await recipe.getByRole('button', { name: 'Übernehmen', exact: true }).click();
  await recipe.waitFor({ state: 'hidden' });
  await atlasCanvasReady(page);
  const beforeUnits = geometry();
  await page.locator('#atlas-units').selectOption('metric');
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'SaltMarcher');
    w.setSize(1440, 1000);
    w.webContents.setZoomFactor(2);
  });
  await page.waitForFunction(() => innerWidth <= 720);
  await atlasCanvasReady(page);
  await frame('metric-200-percent');
  assert.deepEqual(geometry(), beforeUnits, 'Changing display units must not save geometry');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('#atlas-output-open').click();
  await page.locator('#atlas-output summary').filter({ hasText: 'Bildoptionen' }).click();
  await page.locator('#atlas-export-grid').check();
  await page.locator('#atlas-export-size').fill('1024');
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, out + '/export.png');
  await page.locator('#atlas-export-png').click();
  await page.waitForFunction(
    () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
    null,
    { timeout: 60000 },
  );
  const exported = require('pngjs').PNG.sync.read(await readFile(out + '/export.png'));
  assert.equal(Math.max(exported.width, exported.height), 1024);
  await close();
  const saved = geometry();
  await open();
  assert.equal(await page.locator('#atlas-units').inputValue(), 'metric');
  await search('Messraum');
  await text('Fläche:');
  await frame('restart-metric');
  await close();
  assert.deepEqual(geometry(), saved);
  result.geometryPreservedOnRestart = true;
  await native.finish({ complete: true, ...result });
  console.log(JSON.stringify({ complete: true, out, cases: result.cases.map((c) => c.name) }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
