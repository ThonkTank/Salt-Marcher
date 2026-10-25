import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
// Product inputs and a fresh profile; SQLite reads are assertions, never UI shortcuts.
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createNativeSession } from './native-session.mjs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(import.meta.url),
  { buildSync } = require('esbuild'),
  Database = require('better-sqlite3');
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/terrain-routes-native');
await mkdir(out, { recursive: true });
const native = await createNativeSession({ root, output: out, name: 'terrain-routes' }),
  profile = native.profile;
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/landscape-line';export * from './src/app/atlas/terrain-spatial-model';",
    resolveDir: root,
  },
  outfile: root + '/.build/route-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  heightRecord,
  emptyRecord,
  newLine,
  TerrainSampler,
  projectTerrain,
} = require(root + '/.build/route-store.cjs');
const reopenFrom = process.argv.includes('--reopen-from')
  ? process.argv[process.argv.indexOf('--reopen-from') + 1]
  : undefined;
if (reopenFrom) {
  const prior = JSON.parse(await readFile(reopenFrom, 'utf8')),
    snapshot = new Database(path.join(prior.profile, 'workbench.sqlite'), { readonly: true });
  try {
    await snapshot.backup(path.join(profile, 'workbench.sqlite'));
  } finally {
    snapshot.close();
  }
} else {
  const store = new CampaignStore(profile + '/workbench.sqlite'),
    cam = store.create('Straßen und Flüsse'),
    active = store.activate(cam.id);
  const write = (action) =>
    store.executeAtlasCommit({
      commandId: randomUUID(),
      campaignId: cam.id,
      token: active.token,
      action,
    });
  for (let y = -1; y <= 0; y++)
    for (let x = -1; x <= 0; x++)
      write({
        kind: 'landscape-put',
        expectedRevision: null,
        record: heightRecord(
          x * 512,
          y * 512,
          8,
          Float32Array.from({ length: 4096 }, (_, i) => {
            const xx = x * 512 + (i % 64) * 8,
              yy = y * 512 + Math.floor(i / 64) * 8;
            return 65 - xx * 0.03 + 45 * Math.exp(-((xx - 20) ** 2 + (yy - 140) ** 2) / 4500);
          }),
        ),
      });
  const reference = {
    ...emptyRecord('road'),
    name: 'Referenzstraße',
    width: 8,
    line: newLine('road'),
    points: [
      { x: -180, y: 0 },
      { x: 0, y: 40 },
      { x: 180, y: 0 },
    ],
  };
  write({ kind: 'landscape-put', record: reference, expectedRevision: null });
  store.tutorial('skipped');
  store.close();
}
const db = new Database(profile + '/workbench.sqlite', { readonly: true }),
  records = () =>
    db
      .prepare('SELECT payload FROM atlas_landscape ORDER BY id')
      .all()
      .map((r) => JSON.parse(r.payload));
const result = { checks: [] };
let app, page;
const capture = (name) => native.capture(page, name);
const mark = (name) => {
  result.checks.push(name);
  console.log(name);
};
async function start() {
  page = await native.launch();
  app = native.app;
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Straßen und Flüsse' })
    .getByRole('button', { name: /^(Öffnen|Fortsetzen)$/ })
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
  assert.equal(
    await page.locator('#campaign-map').getAttribute('data-renderer'),
    'webgl',
    'The ordinary Atlas must use the integrated camera, not its fallback',
  );
  assert.equal(await page.locator('#atlas-terrain-spatial').count(), 1);
}
async function close() {
  await native.close();
  app = null;
}
async function focus(name) {
  await page.locator('#atlas-search').fill(name);
  await page.locator('#atlas-search-results button').filter({ hasText: name }).first().click();
  await atlasCanvasReady(page);
  await page.locator('#atlas-search').fill('');
}
const editor = () => page.locator('#terrain-route-editor');
async function tilt() {
  await page.locator('#atlas-view').click();
  await page.locator('#atlas-terrain-tilt').click();
  await page.locator('#atlas-search').click();
  await atlasCanvasReady(page);
}
const action = (name) => editor().locator(`[data-action="${name}"]`);
async function ready() {
  await page.waitForFunction(
    () =>
      document.querySelector('#terrain-route-editor')?.getAttribute('aria-busy') === 'false' &&
      !document.querySelector('#terrain-route-editor [data-action="save"]').disabled,
    null,
    { timeout: 60000 },
  );
}
async function change(id, value) {
  await page.locator('#route-' + id).fill(String(value));
  await page.locator('#route-' + id).press('Tab');
}
async function save() {
  await action('save').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#route-status')?.textContent ===
      'Verlauf und Geländeform gespeichert.',
    null,
    { timeout: 60000 },
  );
}
try {
  if (reopenFrom) {
    const before = records();
    await start();
    await focus('Passstraße');
    await page.getByRole('button', { name: 'Verlauf und Gelände bearbeiten', exact: true }).click();
    await ready();
    await action('fit').click();
    await atlasCanvasReady(page);
    await tilt();
    await capture('reopened-main-route');
    assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.equal(await page.locator('#route-canvas').count(), 0);
    assert.deepEqual(records(), before);
    await action('close').click();
    await close();
    mark(
      'Gesicherte Trasse in frischem Profil öffnen und mit derselben Hauptkamera weiter prüfen; keine Schreibänderung',
    );
  } else {
    await start();
    await focus('Referenzstraße');
    await capture('00-existing-top');
    const mainSurface = await page.locator('#atlas-terrain-spatial').elementHandle();
    await page
      .locator('#land-selection')
      .getByRole('button', { name: 'Geländegerecht planen', exact: true })
      .click();
    await ready();
    assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.equal(await page.locator('#route-canvas').count(), 0);
    assert(
      await mainSurface.evaluate((n) => n === document.querySelector('#atlas-terrain-spatial')),
    );
    await action('fit').click();
    await atlasCanvasReady(page);
    await change('name', 'Passstraße');
    await change('width', 40);
    await ready();
    await capture('01-road-top');
    assert.match(await page.locator('#route-width').locator('..').innerText(), /ft/);
    const beforeSwitch = records();
    const pointX = await page.locator('#route-point-x-0').inputValue();
    for (let i = 0; i < 3; i++) {
      await page.locator('#route-units').selectOption('metric');
      assert.equal(await page.locator('#route-width').inputValue(), '12.192');
      assert.match(await page.locator('#route-profile').getAttribute('aria-label'), / m/);
      await page.locator('#route-units').selectOption('dnd');
      assert.equal(await page.locator('#route-width').inputValue(), '40');
      assert.equal(await page.locator('#route-point-x-0').inputValue(), pointX);
    }
    assert.deepEqual(records(), beforeSwitch, 'Units must not persist previews');
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'SaltMarcher');
      w.setSize(1440, 1000);
      w.webContents.setZoomFactor(2);
    });
    await page.waitForFunction(() => innerWidth <= 720);
    await page.locator('#route-units').selectOption('metric');
    await capture('01b-route-metric-200');
    const profileSize = await page
      .locator('#route-profile')
      .evaluate((el) => ({ pixels: el.width, css: el.clientWidth, dpr: devicePixelRatio }));
    assert.equal(profileSize.pixels, Math.round(profileSize.css * profileSize.dpr));
    const box = await editor().evaluate((el) => ({
      left: el.getBoundingClientRect().left,
      right: el.getBoundingClientRect().right,
      width: innerWidth,
      overflow: el.scrollWidth - el.clientWidth,
    }));
    assert(box.left >= 0 && box.right <= box.width && box.overflow <= 1, JSON.stringify(box));
    await page.locator('#route-units').selectOption('dnd');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'SaltMarcher')
        .webContents.setZoomFactor(1),
    );
    await page.waitForFunction(() => innerWidth > 1000);
    await tilt();
    await capture('02-road-tilted');
    assert(!records().some((r) => r.route), 'preview must remain readonly');
    await save();
    let road = records().find((r) => r.name === 'Passstraße');
    assert.equal(road.width, 12.192);
    assert(road.route.nodes.length > 2);
    assert(road.route.protected);
    await page.locator('#atlas-undo').click();
    await page.waitForFunction(
      () => document.querySelector('#route-status')?.textContent === 'Entwurf verworfen.',
    );
    assert(!records().find((r) => r.id === road.id).route);
    await page.locator('#atlas-redo').click();
    await page.waitForTimeout(100);
    await atlasCanvasReady(page);
    assert.deepEqual(records().find((r) => r.id === road.id).route, road.route);
    assert(
      await mainSurface.evaluate((n) => n === document.querySelector('#atlas-terrain-spatial')),
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'SaltMarcher')
        .webContents.setZoomFactor(1),
    );
    await page.waitForFunction(() => innerWidth > 1000);
    await page.locator('#route-units').selectOption('metric');
    mark('Straße aus bestehender Linie planen, Neigen derselben Hauptkamera und atomare Übernahme');
    const previous = JSON.stringify(road.route.anchors);
    await editor().getByText('Planungsgrenzen', { exact: true }).click();
    await change('cut', 1);
    await action('cancel').click();
    assert.equal(JSON.stringify(records().find((r) => r.id === road.id).route.anchors), previous);
    await action('close').click();
    await atlasCanvasReady(page);
    await page.locator('#atlas-section').selectOption('terrain');
    await page.locator('[data-tool-group="water"]').click();
    await page.locator('[data-atlas-tool="river"]').click();
    await page.locator('#land-route-plan').click();
    await page.waitForFunction(
      () => document.querySelector('#terrain-route-editor')?.getAttribute('aria-busy') === 'false',
    );
    const canvas = await page.locator('#campaign-map').boundingBox();
    await page.mouse.click(canvas.x + canvas.width * 0.35, canvas.y + canvas.height * 0.5);
    await page.mouse.click(canvas.x + canvas.width * 0.6, canvas.y + canvas.height * 0.5);
    const positions = [
      [-150, -70],
      [150, -70],
    ];
    for (let i = 0; i < 2; i++)
      for (const [j, axis] of ['X', 'Y'].entries()) {
        const field = editor().getByRole('spinbutton', {
          name: axis + ' Punkt ' + (i + 1) + ' (m)',
          exact: true,
        });
        await field.fill(String(positions[i][j]));
        await field.press('Tab');
      }
    await change('name', 'Talfluss');
    await action('fit').click();
    await ready();
    await tilt();
    await capture('03-river-preview');
    await save();
    const river = records().find((r) => r.name === 'Talfluss');
    assert(river.route.nodes.every((p, i, a) => !i || p.z < a[i - 1].z));
    mark(
      'Fluss mit echten Punktklicks und Koordinatenkorrektur, abfließendes Profil und verbundenes Bett',
    );
    await page.locator('#route-protected').uncheck();
    await ready();
    await save();
    assert.equal(records().find((r) => r.id === river.id).route.protected, false);
    await page.locator('#route-protected').check();
    await ready();
    await save();
    assert.equal(records().find((r) => r.id === river.id).route.protected, true);
    mark('Schutz ist pro Verlauf schaltbar und gespeichert');
    await action('delete').click();
    await editor().waitFor({ state: 'detached' });
    await atlasCanvasReady(page);
    assert(!records().some((r) => r.id === river.id));
    await page.locator('#atlas-undo').click();
    await atlasCanvasReady(page);
    assert(records().some((r) => r.id === river.id));
    mark('Löschen und Atlas-Undo stellen Verlauf samt Geländeform wieder her');
    await focus('Passstraße');
    await page.locator('#atlas-view').click();
    await page.locator('#atlas-terrain-tilt').click();
    await page.mouse.click(20, 20);
    await page.waitForFunction(
      () => document.querySelector('#campaign-map')?.dataset.terrainReady === 'ready',
      null,
      { timeout: 60000 },
    );
    await capture('04-shared-tilted-atlas');
    mark('Gemeinsamer gekippter Atlas zeigt dieselben gespeicherten Verläufe');
    if (!process.argv.includes('--planning-only')) {
      await page.locator('#atlas-section').selectOption('terrain');
      await page.locator('[data-tool-group="land"]').click();
      await page.locator('[data-atlas-tool="land-shape"]').click();
      await setBrushWorldRadius(page, 'land-radius', '35');
      await page.locator('#land-height-strength').fill('100');
      await setHeightDirection(page, 'raise');
      await page.locator('#land-height-target-enabled').uncheck();
      await page.waitForFunction(
        () => document.querySelector('#campaign-map')?.dataset.terrainReady === 'ready',
        null,
        { timeout: 60000 },
      );
      const normal = (rs) => rs.map(({ revision, ...r }) => r),
        beforeBrush = normal(records()),
        point = { x: -100, y: -70 };
      const projection = await page
          .locator('#campaign-map')
          .evaluate((n) => JSON.parse(n.dataset.terrainProjection)),
        rect = await page.locator('#campaign-map').boundingBox();
      const sampler = new TerrainSampler(records()),
        screen = projectTerrain(
          projection,
          point,
          sampler.waterLevel(point) ?? sampler.sample(point).heightM,
        );
      await page.mouse.move(rect.x + screen.x * rect.width, rect.y + screen.y * rect.height);
      await page.mouse.down();
      await page.waitForTimeout(450);
      await page.mouse.up();
      await atlasCanvasReady(page);
      await page.waitForFunction(
        () => document.querySelector('#campaign-map')?.dataset.terrainReady === 'ready',
        null,
        { timeout: 60000 },
      );
      assert.notDeepEqual(normal(records()), beforeBrush);
      assert(
        records()
          .filter((r) => r.route?.protected)
          .every((r) => !r.route.conflict),
      );
      await capture('04b-protected-brush');
      await page.locator('#atlas-undo').click();
      await atlasCanvasReady(page);
      assert.deepEqual(normal(records()), beforeBrush);
      mark(
        'Echter Geländepinselzug erhält geschützte Verläufe; ein Undo nimmt Gelände und Profile zurück',
      );
    }
    const expected = records()
      .filter((r) => r.route)
      .map(({ revision, ...r }) => r);
    await close();
    await start();
    assert.deepEqual(
      records()
        .filter((r) => r.route)
        .map(({ revision, ...r }) => r),
      expected,
    );
    await focus('Passstraße');
    await capture('05-fresh-process');
    assert.equal(await page.locator('#atlas-units').inputValue(), 'metric');
    await page.getByRole('button', { name: 'Verlauf und Gelände bearbeiten', exact: true }).click();
    await ready();
    assert.equal(await page.locator('#route-width').inputValue(), '12.192');
    await page.locator('#route-units').selectOption('dnd');
    assert.equal(await page.locator('#route-width').inputValue(), '40');
    await action('close').click();
    assert.equal(await page.locator('#atlas-units').inputValue(), 'dnd');
    await close();
    mark('Frischer Prozess erhält Straßen, Flüsse, Profile und Schutz');
  }
  await native.finish({ complete: true, ...result });
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  db.close();
  await native.dispose();
}
