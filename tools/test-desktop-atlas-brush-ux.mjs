import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const require = createRequire(import.meta.url);
require('esbuild').buildSync({
  stdin: {
    contents: "export {CampaignStore} from './src/app/storage/store';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/brush-ux-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require('../.build/brush-ux-store.cjs');
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-brush-ux-native');
const session = await createNativeSession({ name: 'atlas-brush-ux', output });
const store = new CampaignStore(session.profile + '/workbench.sqlite');
const campaign = store.create('Pinselbedienung', [
  {
    id: 'brush-room',
    scopeId: 'local',
    floorId: 'ground',
    number: '1',
    name: 'Pinselreferenz',
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 16, y: 0 },
          { x: 16, y: 12 },
          { x: 0, y: 12 },
        ],
        holes: [],
      },
    ],
    sections: [],
  },
]);
store.tutorial('skipped');
store.close();
let page;
const checks = [];
async function open(zoom = 1) {
  page = await session.launch(zoom);
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Pinselbedienung' })
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
  await page.locator('#atlas-search').fill('Pinselreferenz');
  await page.locator('#atlas-search-results button').filter({ hasText: 'Pinselreferenz' }).click();
  await atlasCanvasReady(page);
  await page.locator('#atlas-search').fill('');
  // At enlarged browser zoom the room inspector occupies the tool drawer.
  if (await page.locator('#atlas-secondary-close').isVisible())
    await page.locator('#atlas-secondary-close').click();
  await page.locator('#atlas-section').selectOption('terrain');
  await page.locator('[data-tool-group="land"]').click();
  await page.locator('[data-atlas-tool="land-shape"]').click();
  await atlasCanvasReady(page);
}
async function size(id = 'land-radius') {
  return page.evaluate((id) => {
    const canvas = document.querySelector('#campaign-map'),
      v = JSON.parse(canvas.dataset.atlasView),
      r = canvas.getBoundingClientRect();
    const n = document.getElementById(id),
      mpp = Math.max(v.width / r.width, v.height / r.height);
    return {
      world: Number(n.value),
      pixels: Number(document.getElementById(id + '-value').value),
      mpp,
      width: v.width,
    };
  }, id);
}
async function zoom() {
  const r = await page.locator('#campaign-map').boundingBox();
  await page.mouse.move(r.x + r.width * 0.55, r.y + r.height * 0.5);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(350);
  await atlasCanvasReady(page);
}
async function shiftRadius(id = 'land-radius') {
  const r = await page.locator('#campaign-map').boundingBox();
  await page.mouse.move(r.x + r.width * 0.55, r.y + r.height * 0.5);
  const before = await size(id);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, -80);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(200);
  await atlasCanvasReady(page);
  const after = await size(id);
  assert.equal(after.width, before.width, 'Shift wheel must not zoom the map');
  assert(
    Math.abs(after.world / before.world - Math.exp(0.16)) < 0.001,
    id + ' grows with Shift wheel',
  );
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 80);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(200);
  await atlasCanvasReady(page);
  assert(
    Math.abs((await size(id)).world / before.world - 1) < 0.001,
    id + ' returns to the starting size',
  );
}
async function draw() {
  const r = await page.locator('#campaign-map').boundingBox(),
    x = r.x + r.width * 0.5,
    y = r.y + r.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(160);
  const before = await size();
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(180);
  assert.equal((await size()).width, before.width);
  assert(await page.locator('#land-radius-value').isDisabled());
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, -80);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(180);
  assert.equal((await size()).world, before.world);
  assert.equal((await size()).width, before.width);
  await page.mouse.move(x + 15, y + 5, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      !document.querySelector('#land-tool').disabled &&
      document.querySelector('#land-status').textContent.includes('Gespeichert'),
    null,
    { timeout: 60000 },
  );
  await atlasCanvasReady(page);
}
try {
  await open();
  await page.locator('#atlas-units').selectOption('metric');
  assert.equal(
    await page.locator('#land-height-direction [aria-pressed=true]').textContent(),
    'Erhöhen',
  );
  assert(await page.locator('#land-sea-options').isHidden());
  assert(await page.locator('#land-relief-style').isHidden());
  for (const [name, radius] of [
    ['Hügel', 65],
    ['Berge', 65],
    ['Schlucht', 45],
  ]) {
    await page
      .locator('#land-height-forms button')
      .filter({ hasText: new RegExp('^' + name + '$') })
      .click();
    assert.equal((await size()).pixels, radius);
    assert.equal(await page.locator('#land-height-target-enabled').isChecked(), false);
  }
  await page.locator('#land-height-forms button').filter({ hasText: 'Hügel' }).click();
  await session.capture(page, 'land-controls');
  for (const [width, height, zoomFactor] of [
    [640, 480, 1],
    [1280, 852, 2],
    [1920, 1080, 1],
    [1280, 852, 1],
  ]) {
    await session.app.evaluate(
      ({ BrowserWindow }, s) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.setMinimumSize(320, 240);
        w.setContentSize(s.width, s.height);
        w.webContents.setZoomFactor(s.zoomFactor);
      },
      { width, height, zoomFactor },
    );
    await atlasCanvasReady(page);
    const layout = await page.evaluate(() => {
      const header = document.querySelector('.atlas-command-bar').getBoundingClientRect();
      return {
        scroll: document.documentElement.scrollWidth > innerWidth,
        buttons: [...document.querySelectorAll('.atlas-command-bar button')]
          .filter((n) => n.checkVisibility())
          .every((n) => {
            const b = n.getBoundingClientRect();
            return b.left >= 0 && b.right <= innerWidth && b.bottom <= header.bottom;
          }),
        fields: [
          ...document.querySelectorAll('#atlas-group-tools,.atlas-dock-body,#atlas-tool-groups'),
        ].every((n) => n.scrollWidth <= n.clientWidth),
      };
    });
    assert.deepEqual(layout, { scroll: false, buttons: true, fields: true });
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#campaign-map'),
        v = JSON.parse(canvas.dataset.atlasView),
        r = canvas.getBoundingClientRect();
      return (
        Math.abs(
          Number(document.querySelector('#land-radius').value) /
            Math.max(v.width / r.width, v.height / r.height) -
            Number(document.querySelector('#land-radius-value').value),
        ) < 0.1
      );
    });
    const scaled = await size();
    assert(Math.abs(scaled.world / scaled.mpp - scaled.pixels) < 0.1);
    if (width === 640 || zoomFactor === 2)
      await session.capture(page, 'layout-' + width + '-' + zoomFactor);
  }
  checks.push(
    'Kompakte Oberfläche bei 640 px Fensterbreite und bis 200 % Skalierung ohne horizontales Überlaufen',
  );
  await page.locator('#land-radius-slider').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal((await size()).pixels, 41);
  await page.keyboard.press('ArrowLeft');
  assert.equal((await size()).pixels, 40);
  await shiftRadius();
  assert.equal(await page.locator('#land-height-form').inputValue(), 'hills');
  const before = await size();
  await zoom();
  const after = await size();
  assert(after.width < before.width);
  assert(Math.abs(after.world / after.mpp - 40) < 0.1);
  await page.locator('#land-radius-fixed').check();
  await shiftRadius();
  const fixed = await size();
  await zoom();
  assert.equal((await size()).world, fixed.world);
  await page.locator('#land-radius-fixed').uncheck();
  checks.push('Richtung, fünf Vorlagen, Bildschirmradius und sprungfreier Weltmaßmodus');
  await draw();
  await page.locator('#atlas-undo').click();
  await atlasCanvasReady(page);
  await page.locator('#atlas-redo').click();
  await atlasCanvasReady(page);
  checks.push('Höhenzug, gesperrte Kamera/Größe während des Zugs, Undo/Redo');
  for (const [group, tool] of [
    ['land', 'land-smooth'],
    ['land', 'land-color'],
    ['water', 'water-add'],
    ['water', 'water-erase'],
    ['water', 'water-color'],
    ['properties', 'property'],
    ['properties', 'reset'],
    ['vegetation', 'vegetation'],
    ['vegetation', 'vegetation-erase'],
    ['vegetation', 'vegetation-thin'],
    ['vegetation', 'vegetation-dense'],
  ]) {
    await page.locator(`[data-tool-group="${group}"]`).click();
    await page.locator(`[data-atlas-tool="${tool}"]`).click();
    await atlasCanvasReady(page);
    await shiftRadius();
    const s = await size();
    assert(Math.abs(s.world / s.mpp - s.pixels) < 0.1, tool);
    assert.equal(await page.locator('#land-sea-options').isVisible(), group === 'water');
  }
  checks.push('Land-, Farb-, Wasser-, Daten- und Bewuchspinsel sowie Wasseroptionen');
  await page.locator('[data-tool-group="regions"]').click();
  await page.locator('[data-atlas-tool="territory"]').click();
  await atlasCanvasReady(page);
  await shiftRadius('territory-radius');
  let region = await size('territory-radius');
  assert(Math.abs(region.world / region.mpp - region.pixels) < 0.1);
  await zoom();
  region = await size('territory-radius');
  assert(Math.abs(region.world / region.mpp - region.pixels) < 0.1);
  await page.locator('#atlas-search').fill('Pinselreferenz');
  await page.locator('#atlas-search-results button').filter({ hasText: 'Pinselreferenz' }).click();
  await atlasCanvasReady(page);
  await page.locator('#atlas-search').fill('');
  await page.locator('#atlas-section').selectOption('interior');
  for (const [group, tool] of [
    ['rooms', 'room-cave'],
    ['rooms', 'room-erase'],
    ['objects', 'scatter'],
  ]) {
    await page.locator(`[data-tool-group="${group}"]`).click();
    await page.locator(`[data-atlas-tool="${tool}"]`).click();
    await atlasCanvasReady(page);
    await shiftRadius('drawing-brush');
    let d = await size('drawing-brush');
    assert(Math.abs(d.world / d.mpp - d.pixels) < 0.1, tool);
    await zoom();
    d = await size('drawing-brush');
    assert(Math.abs(d.world / d.mpp - d.pixels) < 0.1, tool);
  }
  checks.push('Regions-, Höhlen-, Radier- und Streupinsel skalieren mit dem Atlaszoom');
  await page.locator('#atlas-section').selectOption('terrain');

  await page.locator('#atlas-display').click();
  await page.locator('#land-relief-style summary').click();
  await page.locator('#land-relief-mode').selectOption('height');
  await page.locator('#land-relief-apply').click();
  await atlasCanvasReady(page);
  await session.capture(page, 'global-display');
  await page.keyboard.press('Escape');
  await page.locator('[data-tool-group="land"]').click();
  await page.locator('[data-atlas-tool="land-shape"]').click();
  await page.locator('#atlas-view').click();
  await page.locator('#atlas-terrain-tilt').click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
    null,
    { timeout: 60000 },
  );
  await shiftRadius();
  checks.push(
    'Shift + Mausrad ändert Radius statt Kamera bei allen Pinselfamilien, im Weltmaß und gekippten Atlas; laufender Zug bleibt gesperrt',
  );
  const tilted = await size();
  await zoom();
  assert((await size()).width < tilted.width);
  assert(Math.abs((await size()).world / (await size()).mpp - (await size()).pixels) < 0.1);
  await session.capture(page, 'tilted-brush');
  checks.push('Globaler Reliefstil und bildschirmfester Radius im gekippten Atlas');
  await page.locator('#atlas-view').click();
  await page.locator('#terrain-top').click();
  await page.keyboard.press('Escape');
  await session.app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, output + '/region.png');
  await page.locator('#atlas-output-open').click();
  await page.locator('#atlas-output summary').filter({ hasText: 'Bildoptionen' }).click();
  await page.locator('#atlas-export-size').fill('512');
  await page.locator('#atlas-export-grid').uncheck();
  await page.locator('#atlas-export-png').click();
  await page.waitForFunction(
    () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
    null,
    { timeout: 60000 },
  );
  const png = require('pngjs').PNG.sync.read(await readFile(output + '/region.png'));
  assert.equal(Math.max(png.width, png.height), 512);
  await page.locator('#atlas-output-back').click();
  checks.push('PNG-Ausgabe mit globalem Reliefstil');
  await page.locator('#land-radius-value').fill('57');
  await page.locator('#land-radius-value').press('Tab');
  await session.close();
  await open(1.25);
  await page.locator('#atlas-units').selectOption('metric');
  assert.equal((await size()).pixels, 57);
  assert(Math.abs((await size()).world / (await size()).mpp - 57) < 0.1);
  await page.locator('#atlas-display').click();
  await page.locator('#land-relief-style summary').click();
  assert.equal(await page.locator('#land-relief-mode').inputValue(), 'height');
  await page.keyboard.press('Escape');
  checks.push('Wiederöffnen mit erhaltenem Radius und Reliefstil bei anderem Browserzoom');
  await session.capture(page, 'reopened');
  await session.close();
  await session.finish({ checks, campaign: campaign.id });
} catch (error) {
  await session.fail(error);
  throw error;
} finally {
  await session.dispose();
}
