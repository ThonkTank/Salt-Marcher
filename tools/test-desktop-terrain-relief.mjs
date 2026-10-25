import {
  setBrushWorldRadius,
  setHeightDirection,
  setTerrainContours,
  openTerrainDisplay,
} from './atlas-brush-probe.mjs';
// Actual Electron window and an isolated synthetic campaign. Never opens the user's profile.
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createNativeSession } from './native-session.mjs';
import { RELIEF_STROKES } from './terrain-relief-scene.mjs';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { atlasCanvasReady, atlasCanvasPoint } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json');
require('esbuild').buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas-landscape';export * from './src/app/terrain-height';export {newLocation} from './src/features/location/location-schema';",
    resolveDir: root,
  },
  outfile: '.build/relief-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/relief-native-store.cjs');
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/terrain-relief-native');
await mkdir(output, { recursive: true });
await rm(path.join(output, 'result.json'), { force: true });
for (const zoom of [1, 2]) {
  const out = path.join(output, String(zoom)),
    native = await createNativeSession({ root, output: out, name: 'terrain-relief' }),
    dir = native.profile;
  const result = { checks: [] };
  try {
    const store = new CampaignStore(
        dir + '/workbench.sqlite',
        JSON.parse(await readFile(root + '/package.json', 'utf8')).version,
      ),
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
    const cam = store.create('Reliefprobe R4', [room]),
      active = store.activate(cam.id);
    store.tutorial('skipped');
    const seedWrite = (action) =>
      store.executeAtlasCommit({
        commandId: randomUUID(),
        campaignId: cam.id,
        token: active.token,
        action,
      });
    for (const stroke of RELIEF_STROKES) seedWrite({ kind: 'landscape-height-stroke', stroke });
    for (const [kind, points, width] of [
      [
        'river',
        [
          { x: -2600, y: 1000 },
          { x: -1000, y: 1400 },
          { x: 500, y: 700 },
          { x: 2300, y: 400 },
        ],
        38,
      ],
      [
        'road',
        [
          { x: -800, y: -1500 },
          { x: -700, y: -700 },
          { x: -500, y: 100 },
          { x: -100, y: 900 },
        ],
        24,
      ],
    ])
      seedWrite({
        kind: 'landscape-put',
        expectedRevision: null,
        record: {
          id: randomUUID(),
          revision: 0,
          kind,
          name: kind === 'road' ? 'Passstraße' : 'Talfluss',
          points,
          polygons: [],
          width,
          resolution: 1,
          values: {},
        },
      });
    const { newLocation } = require(root + '/.build/relief-native-store.cjs');
    const village = newLocation(randomUUID(), 'Bergdorf', 'poi', [randomUUID(), randomUUID()]);
    seedWrite({
      kind: 'landscape-place',
      expectedRevision: null,
      expectedLocationRevision: null,
      document: village,
      record: {
        id: randomUUID(),
        revision: 0,
        kind: 'place',
        name: village.name,
        locationId: village.id,
        points: [{ x: -100, y: 900 }],
        polygons: [],
        width: 0,
        resolution: 1,
        values: {},
      },
    });

    store.close();
    const Database = require('better-sqlite3'),
      db = new Database(dir + '/workbench.sqlite', { readonly: true }),
      records = () =>
        db
          .prepare('SELECT payload FROM atlas_landscape')
          .all()
          .map((r) => JSON.parse(r.payload));
    const mark = (text) => {
      result.checks.push(text);
      console.log(text);
    };
    let page;
    async function start() {
      page = await native.launch(zoom);
      await native.app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('/index.html'))
          .setSize(1600, 1000),
      );
      assert.equal(
        await native.app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.getZoomFactor(),
        ),
        zoom,
      );
      await page.evaluate(
        (id) =>
          localStorage.setItem(
            'atlas-camera:' + id,
            JSON.stringify({ x: -6000, y: -5000, width: 12000, height: 10000 }),
          ),
        cam.id,
      );
      await page
        .locator('.campaign-card')
        .filter({ hasText: 'Reliefprobe R4' })
        .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
        .click();
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
      if (await page.locator('#campaign-atlas').isHidden()) {
        if (!(await page.locator('#atlas-tab').isVisible())) {
          if (await page.locator('#atlas-navigation').isVisible())
            await page.locator('#atlas-navigation').click();
          if (!(await page.locator('#atlas-tab').isVisible()))
            await page.locator('#workspace-nav-summary').click();
        }
        await page.locator('#atlas-tab').click();
      }
      await atlasCanvasReady(page);
      await page.locator('#atlas-units').selectOption('metric');
      await page.locator('#atlas-section').selectOption('terrain');
      await atlasCanvasReady(page);
    }
    const tool = async (value) => {
      await page.waitForFunction(() => !document.querySelector('#land-tool').disabled);
      await page
        .locator(`[data-tool-select="land-tool"][data-tool-value="${value}"]`)
        .first()
        .click();
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
    const at = (x, y) => atlasCanvasPoint(page, { x, y });
    const capture = (name) => native.capture(page, name);

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
    try {
      await start();
      await tool('height');
      assert.equal(await page.locator('[data-atlas-tool]').count(), 3);
      await atlasCanvasReady(page);
      console.log('Region ready');
      await page.locator('#atlas-view').click();
      await page.locator('#land-grid').uncheck();
      await page.locator('#atlas-view').click();
      if (await page.locator('#atlas-secondary-close').isVisible())
        await page.locator('#atlas-secondary-close').click();
      await atlasCanvasReady(page);
      const originals = JSON.stringify(records().filter((r) => !r.height && !r.terrainSettings));
      const baseline = maskBytes(),
        mode = () =>
          records().find((r) => r.terrainSettings)?.terrainSettings.style?.mode ?? 'drawn';
      await openTerrainDisplay(page);
      const apply = async (value) => {
        await openTerrainDisplay(page);
        console.log('Style', value);
        await page.locator('#land-relief-mode').selectOption(value);
        await page.locator('#land-relief-apply').click();
        await settled();
        assert.equal(mode(), value);
        assert.equal(maskBytes(), baseline);
      };
      await capture('01-region-drawn');
      await apply('shaded');
      await capture('02-region-shaded');
      await page.keyboard.press('Escape');
      await page.locator('#atlas-undo').click();
      await atlasCanvasReady(page);
      assert.equal(mode(), 'drawn');
      await page.locator('#atlas-redo').click();
      await atlasCanvasReady(page);
      assert.equal(mode(), 'shaded');
      await apply('height');
      await capture('03-region-analysis');
      await apply('drawn');
      await page.locator('#land-relief-light').fill('290');
      await page.locator('#land-relief-strength').fill('0.7');
      const beforeStyleRead = JSON.stringify(records());
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
      await atlasCanvasReady(page);
      await openTerrainDisplay(page);
      assert.equal(
        JSON.stringify(records()),
        beforeStyleRead,
        'Inspecting a style must not author terrain',
      );
      assert.equal(
        await page.locator('#land-relief-light').inputValue(),
        '290',
        'Camera read must retain the unsubmitted lighting choice',
      );
      assert.equal(
        await page.locator('#land-relief-strength').inputValue(),
        '0.7',
        'Camera read must retain the complete style form',
      );
      await page.locator('#land-relief-apply').click();
      await settled();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
      await atlasCanvasReady(page);

      assert.equal(
        records().find((r) => r.terrainSettings).terrainSettings.style.lightDegrees,
        290,
      );
      assert.equal(maskBytes(), baseline);
      mark(
        'Three land tools; shared style, analysis, lighting and undo preserve terrain and places',
      );
      await page.keyboard.press('Escape');
      for (let i = 0; i < 3; i++)
        await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
      await atlasCanvasReady(page);
      await capture('04-continent');
      for (let i = 0; i < 6; i++)
        await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
      await atlasCanvasReady(page);
      await capture('05-place');
      const placeCamera = await camera();
      const center = {
        x: placeCamera.view.x + placeCamera.view.width * 0.5,
        y: placeCamera.view.y + placeCamera.view.height * 0.5,
      };
      await setHeightDirection(page, 'raise');
      await setBrushWorldRadius(page, 'land-radius', '250');
      await page.locator('#land-height-strength').fill('350');
      await page.locator('#land-coast-roughness').fill('0.7');
      await page.waitForFunction(
        () => document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
      );
      const revision = Number(
        await page.locator('#campaign-map').getAttribute('data-terrain-revision'),
      );
      const p = await at(center.x, center.y);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.waitForFunction(
        (r) => Number(document.querySelector('#campaign-map').dataset.terrainRevision) > r,
        revision,
        { timeout: 60000 },
      );
      assert.notEqual(maskBytes(), baseline, 'height writes must be visible before release');
      await capture('06-live-brush');
      await page.mouse.up();
      await settled();
      const corrected = maskBytes();
      assert.notEqual(corrected, baseline);
      await page.locator('#atlas-undo').click();
      await atlasCanvasReady(page);
      assert.equal(maskBytes(), baseline);
      await page.locator('#atlas-redo').click();
      await atlasCanvasReady(page);
      assert.equal(maskBytes(), corrected);
      mark('Continent, region and local views; live saved brush and atomic undo/redo');
      for (let i = 0; i < 3; i++)
        await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
      await atlasCanvasReady(page);
      await setTerrainContours(page, '100');
      await atlasCanvasReady(page);
      await capture('07-contours');
      await native.app.evaluate(({ dialog }, file) => {
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
      assert(
        new Set(
          Array.from({ length: png.width * png.height }, (_, i) => png.data.readUInt32BE(i * 4)),
        ).size > 32,
        'Export must contain actual relief detail',
      );
      assert.equal(maskBytes(), corrected);
      assert.equal(
        JSON.stringify(records().filter((r) => !r.height && !r.terrainSettings)),
        originals,
      );
      mark('Relief, coast, labels, river and road survive native PNG export without height writes');
      const persisted = JSON.stringify(records());
      await native.close();
      await start();
      assert.equal(JSON.stringify(records()), persisted);
      assert.equal(await page.locator('#land-relief-light').inputValue(), '290');
      assert.equal(await page.locator('#land-relief-mode').inputValue(), 'drawn');
      await capture('08-reopened');
      mark('Fresh process retains authored landscape, place positions and shared relief profile');
      await native.close();
      await native.finish(result);
    } finally {
      db.close();
    }
  } catch (error) {
    await native.fail(error);
    throw error;
  } finally {
    await native.dispose();
  }
}
const runs = await Promise.all(
  [1, 2].map(async (zoom) =>
    JSON.parse(await readFile(path.join(output, String(zoom), 'result.json'), 'utf8')),
  ),
);
await writeFile(path.join(output, 'result.json'), JSON.stringify({ runs }, null, 2));
