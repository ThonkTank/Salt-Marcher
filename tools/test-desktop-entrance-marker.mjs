// Compare the ordinary entrance marker before/after removing its synthetic house.
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-entrance-marker');
require('esbuild').buildSync({
  stdin: {
    resolveDir: root,
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-spatial-model';export * from './src/app/atlas/terrain-objects';",
  },
  outfile: '.build/entrance-marker-native.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  heightRecord,
  projectTerrain,
  terrainObjectSources,
  resolveTerrainObjects,
} = require(root + '/.build/entrance-marker-native.cjs');
const native = await createNativeSession({ root, output: out, name: 'atlas-entrance-marker' }),
  store = new CampaignStore(native.profile + '/workbench.sqlite');
const campaign = store.create('Gemeinsamer Atlas'),
  token = store.activate(campaign.id).token,
  context = { token, campaignId: campaign.id };
const write = (action) =>
  store.executeAtlasCommit({
    ...context,
    commandId: action.command?.commandId ?? randomUUID(),
    action,
  });
for (let y = -1; y < 1; y++)
  for (let x = -1; x < 1; x++)
    write({
      kind: 'landscape-put',
      expectedRevision: null,
      record: heightRecord(x * 1024, y * 1024, 16, new Float32Array(4096).fill(50)),
    });
const cityId = write({
  kind: 'city-create',
  name: 'Alte Koordinatenbindung',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
}).result.id;
const house = {
  id: 'watch-house',
  kind: 'building',
  name: 'Passwacht',
  protected: true,
  position: { x: 0, y: 0 },
  angle: 0,
  outline: [
    { x: -12, y: -10 },
    { x: 12, y: -10 },
    { x: 12, y: 10 },
    { x: -12, y: 10 },
  ],
  notes: '',
  use: 'Wohnhaus',
  groupRecipe: { version: 1, profile: 'Wohnhaus', width: 24, depth: 20, seed: 'main-camera-house' },
  terrain: { mode: 'ground', offsetM: 2, wallM: 4, roofM: 3 },
};
write({
  kind: 'city',
  command: {
    ...context,
    commandId: randomUUID(),
    cityId,
    expectedRevision: store.city(token, cityId).header.revision,
    action: { kind: 'change', upsert: [house], remove: [], label: 'Haus' },
  },
});
store.tutorial('skipped');
const group = store.city(token, cityId).units.find((u) => u.id === house.id).groupId;
const data = store.campaignAtlas(token),
  entry = data.entrances.find((e) => e.scopeId === group);
assert(entry);
const object = resolveTerrainObjects(
  terrainObjectSources(data),
  store.atlasMaskRegion(token, { x: -1024, y: -1024, width: 2048, height: 2048 }).records,
).find((o) => o.id === entry.id);
assert(object);
store.close();
const db = new (require('better-sqlite3'))(native.profile + '/workbench.sqlite', {
  readonly: true,
});
const entrance = () =>
  JSON.parse(db.prepare('SELECT payload FROM atlas_entrance WHERE id=?').get(entry.id).payload);
const rooms = () =>
  JSON.stringify(db.prepare('SELECT * FROM room WHERE scope_id=? ORDER BY id').all(group));
const initialRooms = rooms(),
  baseline = process.argv.includes('--baseline'),
  markerOffset = baseline ? 3 : 0;
let page;
const ready = async () => {
  await atlasCanvasReady(page);
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
  );
};
async function open() {
  page = await native.launch();
  await native.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1440, 900),
  );
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        'atlas-camera:' + id,
        JSON.stringify({ x: -40, y: -30, width: 80, height: 60 }),
      ),
    campaign.id,
  );
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Gemeinsamer Atlas' })
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
async function choose(height) {
  const bounds = await page.locator('#campaign-map').boundingBox(),
    view = JSON.parse(await page.locator('#campaign-map').getAttribute('data-terrain-projection'));
  const point = projectTerrain(view, object.anchor, height + markerOffset);
  assert(point.x > 0 && point.x < 1 && point.y > 0 && point.y < 1, 'Entrance must be visible');
  await page.mouse.click(bounds.x + point.x * bounds.width, bounds.y + point.y * bounds.height);
  await page.locator('#terrain-entrance-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#terrain-entrance-choice').inputValue(), entry.id);
}
async function saved(mode, offset) {
  for (
    let i = 0;
    i < 100 && (entrance().terrain?.mode !== mode || entrance().terrain?.offsetM !== offset);
    i++
  )
    await page.waitForTimeout(100);
  assert.deepEqual(entrance().terrain, { mode, offsetM: offset });
  assert.equal(rooms(), initialRooms);
  await ready();
}
try {
  if (!baseline) {
    assert.deepEqual(object.outline, []);
    assert.equal(object.topM + object.roofM, object.baseM);
  }
  await open();
  await native.capture(page, '01-top');
  await choose(50);
  await page.locator('#terrain-entrance-offset').fill('4');
  await page.locator('#terrain-entrance-save').click();
  await saved('ground', 4);
  await page.locator('#atlas-view').click();
  await page.locator('#terrain-tilt').fill('45');
  await page.locator('#terrain-tilt').dispatchEvent('input');
  await page.keyboard.press('Escape');
  await ready();
  await native.capture(page, '02-tilted');
  await choose(54);
  assert.equal(await page.locator('#terrain-entrance-offset').inputValue(), '4');
  await page.locator('#terrain-entrance-mode').selectOption('fixed');
  await page.locator('#terrain-entrance-offset').fill('55');
  await page.locator('#terrain-entrance-save').click();
  await saved('fixed', 55);
  await native.capture(page, '03-fixed');
  await choose(55);
  await page.locator('#terrain-entrance-room').click();
  await page.locator('#room-name').waitFor({ state: 'visible' });
  await ready();
  await native.capture(page, '04-room');
  const persisted = JSON.stringify(entrance());
  await native.close();
  await open();
  assert.equal(JSON.stringify(entrance()), persisted);
  assert.equal(rooms(), initialRooms);
  await native.close();
  await native.finish({
    baseline,
    anchor: object.anchor,
    expectedMarkerHeight: object.baseM + markerOffset,
    checks: [
      'Top-down and tilted marker selects the existing entrance.',
      'Ground offset and fixed height persist without changing rooms.',
      'Room opens through the same entrance dialog.',
      'Fresh process retains entrance height and room geometry.',
    ],
  });
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  db.close();
  await native.dispose();
}
