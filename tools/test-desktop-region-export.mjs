import { createNativeSession } from './native-session.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
import { atlasCanvasReady, atlasCanvasPoint } from './atlas-canvas-probe.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  Database = require('better-sqlite3'),
  { PNG } = require('pngjs');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/region-export-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/region-export-native-store.cjs');
const output =
  process.env.QA_EVIDENCE_DIR ?? (await mkdtemp(root + '/.build/region-export-native-'));
await mkdir(output, { recursive: true });
await rm(output + '/result.json', { force: true });
const results = [],
  launches = [];
let app, db, page, native;
async function until(check) {
  const end = Date.now() + 20000;
  while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 30));
  assert(check(), 'Expected confirmed source state');
}
async function close() {
  await native.close();
  app = null;
}
try {
  for (const scale of [1, 2]) {
    native = await createNativeSession({
      root,
      output: output + '/' + scale,
      name: 'region-export',
    });
    const profile = native.profile,
      store = new CampaignStore(profile + '/workbench.sqlite'),
      campaign = store.create('Drei Orte am Nebelfluss');
    store.tutorial('skipped');
    store.close();
    async function launch() {
      page = await native.launch(scale);
      app = native.app;
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.unmaximize();
        w.setContentSize(1400, 1000);
      });
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: /Öffnen|Fortsetzen/ })
        .click();
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
      if (await page.locator('#campaign-atlas').isHidden()) {
        if (!(await page.locator('#atlas-tab').isVisible()))
          await page.locator('#workspace-nav-summary').click();
        await page.locator('#atlas-tab').click();
      }
      await page.locator('#atlas-section').waitFor({ state: 'visible', timeout: 60000 });
      if ((await page.locator('#atlas-section').inputValue()) !== 'terrain')
        await page.locator('#atlas-section').selectOption('terrain');
      await page.locator('#atlas-units').selectOption('metric');
      await atlasCanvasReady(page);
    }
    await launch();
    db = new Database(profile + '/workbench.sqlite', { readonly: true });
    const records = () =>
        db
          .prepare('SELECT payload FROM atlas_landscape ORDER BY id')
          .all()
          .map((r) => JSON.parse(r.payload)),
      record = (name) => records().find((r) => r.name === name),
      facts = () =>
        JSON.stringify({
          land: db.prepare('SELECT * FROM atlas_landscape ORDER BY id').all(),
          places: db.prepare('SELECT * FROM location ORDER BY id').all(),
          scenes: db.prepare('SELECT * FROM live_scene ORDER BY id').all(),
        });
    const tool = async (value) => {
      if (value === 'select' || value === 'measure') {
        await page.locator(value === 'select' ? '#atlas-select' : '#atlas-measure').click();
        return;
      }
      const group = {
        height: 'land',
        property: 'properties',
        reset: 'properties',
        place: 'objects',
        river: 'water',
        road: 'routes',
      }[value];
      const target =
        value === 'height'
          ? page.locator('[data-atlas-tool="land-shape"]')
          : page.locator('[data-tool-select="land-tool"][data-tool-value="' + value + '"]');
      if (!(await target.isVisible()))
        await page.locator('[data-tool-group="' + group + '"]').click();
      await target.click();
      await page.waitForFunction((v) => document.querySelector('#land-tool').value === v, value);
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      await atlasCanvasReady(page);
    };
    const choose = async (name) => {
      if (await page.locator('#atlas-secondary').isVisible())
        await page.locator('#atlas-secondary-close').click();
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      await atlasCanvasReady(page);
      const item = record(name),
        list = page.locator('#land-object');
      if (
        (await list.isVisible()) &&
        (await list.locator('option[value="' + item.id + '"]').count())
      )
        await list.selectOption(item.id);
      else {
        const point = item.points[Math.floor(item.points.length / 2)],
          at = await atlasCanvasPoint(page, point, false);
        assert.equal(at.target, 'campaign-map');
        await page.mouse.click(at.x, at.y);
        await page.waitForFunction(
          (n) =>
            document.querySelector('#atlas-hit-candidates')?.open ||
            (!document.querySelector('#atlas-secondary').hidden &&
              document.querySelector('#land-name')?.value === n &&
              document.querySelector('#land-tool')?.value === 'select'),
          name,
        );
        const hit = page.getByRole('button', { name: 'Landschaft: ' + name, exact: true });
        if (await hit.isVisible()) await hit.click();
      }
      await page.waitForFunction(
        (n) =>
          document.querySelector('#land-name')?.value === n &&
          document.querySelector('#land-tool')?.value === 'select',
        name,
      );
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      await atlasCanvasReady(page);
    };
    const click = async (x, y) => {
      const b = await page.locator('#campaign-map').boundingBox();
      await page.mouse.click(b.x + b.width * x, b.y + b.height * y);
    };
    const outputView = async () => {
      if (await page.locator('#atlas-secondary').isVisible())
        await page.locator('#atlas-secondary-close').click();
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      await atlasCanvasReady(page);
      await page.locator('#atlas-undo:enabled').waitFor();
      await page.locator('#atlas-output-open').click();
      await page.locator('#atlas-output-back').waitFor();
      await atlasCanvasReady(page);
    };
    const finish = async (name) => {
      await page.locator('#land-finish').click();
      await until(() => !!record(name));
      await page.waitForFunction(() => !document.querySelector('#land-finish').disabled);
    };
    // Author a real land body before placing destinations or drawing inland water.
    await tool('height');
    const landView = JSON.parse(
      await page.locator('#campaign-map').getAttribute('data-atlas-view'),
    );
    const landRadius = Math.max(landView.width, landView.height);
    await setBrushWorldRadius(page, 'land-radius', String(landRadius));
    await setHeightDirection(page, 'raise');
    await page.locator('#land-height-strength').fill('100000');
    await page.locator('#land-height-feather').fill('0');
    await page.locator('#land-height-target-enabled').check();
    await page.locator('#land-height-target').fill('100');
    const landBox = await page.locator('#campaign-map').boundingBox();
    await page.mouse.move(landBox.x + landBox.width * 0.5, landBox.y + landBox.height * 0.5);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.mouse.up();
    await until(() => records().some((r) => r.height));
    await page.waitForFunction(
      () => document.querySelector('#land-status').textContent === 'Gespeichert',
      null,
      { timeout: 60000 },
    );
    await atlasCanvasReady(page);
    await native.capture(page, '01-land');
    console.log('Land ready', scale);
    // Paint travel elevation without modifying land form, pigment or campaign time.
    const beforeProperties = facts(),
      propertyBox = await page.locator('#campaign-map').boundingBox();
    await tool('property');
    await page.locator('#land-field').selectOption('elevationM');
    await page.locator('#land-value').fill('321');
    await setBrushWorldRadius(page, 'land-radius', String(landView.width * 0.035));
    await page.mouse.move(
      propertyBox.x + propertyBox.width * 0.25,
      propertyBox.y + propertyBox.height * 0.6,
    );
    await page.mouse.down();
    await page.mouse.move(
      propertyBox.x + propertyBox.width * 0.4,
      propertyBox.y + propertyBox.height * 0.6,
      { steps: 4 },
    );
    await page.mouse.up();
    await until(() => records().some((r) => r.propertyOnly && r.values.elevationM === 321));
    await page.waitForFunction(
      () => document.querySelector('#land-status').textContent === 'Gespeichert',
      null,
      { timeout: 60000 },
    );
    await atlasCanvasReady(page);
    const elevation = records().find((r) => r.propertyOnly && r.values.elevationM === 321);
    assert(elevation.polygons.length);
    assert(!elevation.mask && !elevation.paint);
    await page.locator('#atlas-undo').click();
    await until(() => facts() === beforeProperties);
    await page.locator('#atlas-redo').click();
    await until(() => records().some((r) => r.id === elevation.id));
    await atlasCanvasReady(page);
    for (const [name, x, y] of [
      ['Falkenbrück', 0.2, 0.4],
      ['Nebelkloster', 0.5, 0.2],
      ['Moorwacht', 0.8, 0.7],
    ]) {
      await tool('place');
      await page.locator('#atlas-new-name').fill(name);
      await click(x, y);
      await finish(name);
      await page.waitForFunction((n) => document.querySelector('#land-name')?.value === n, name);
    }
    for (const [selectTool, name, points] of [
      [
        'river',
        'Nebelfluss',
        [
          [0.38, 0.12],
          [0.42, 0.48],
          [0.5, 0.84],
        ],
      ],
      [
        'road',
        'Klosterweg',
        [
          [0.2, 0.4],
          [0.37, 0.32],
          [0.5, 0.2],
          [0.8, 0.7],
        ],
      ],
    ]) {
      await tool(selectTool);
      await page.locator('#atlas-new-name').fill(name);
      for (const [x, y] of points) await click(x, y);
      await finish(name);
    }
    console.log('Three places, river and road ready', scale);
    const originalRoad = record('Klosterweg'),
      beforeMeasure = facts();
    await tool('measure');
    for (const [x, y] of [
      [0.2, 0.4],
      [0.37, 0.32],
      [0.5, 0.2],
      [0.8, 0.7],
    ])
      await click(x, y);
    await page.waitForFunction(() => /km/.test(document.querySelector('#land-status').textContent));
    const measured = await page.locator('#land-status').innerText();
    const meters = originalRoad.points
      .slice(1)
      .reduce(
        (sum, p, i) =>
          sum + Math.hypot(p.x - originalRoad.points[i].x, p.y - originalRoad.points[i].y),
        0,
      );
    assert.equal(
      measured,
      (meters / 1000).toLocaleString('de-DE', { maximumSignificantDigits: 3 }) + ' km',
    );
    await page.locator('#atlas-units').selectOption('dnd');
    assert.equal(
      await page.locator('#land-status').innerText(),
      (meters / 1609.344).toLocaleString('de-DE', { maximumSignificantDigits: 3 }) + ' Meilen',
    );
    await page.locator('#atlas-units').selectOption('metric');
    assert.equal(
      facts(),
      beforeMeasure,
      'measurement does not write authors, locations or world time',
    );
    await tool('select');
    await choose('Klosterweg');
    if (await page.locator('#atlas-secondary').isVisible())
      await page.locator('#atlas-secondary-close').click();
    await atlasCanvasReady(page);
    await page.waitForFunction(() => document.querySelector('#land-name')?.value === 'Klosterweg');
    const view = JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view')),
      b = await page.locator('#campaign-map').boundingBox(),
      p = originalRoad.points[1],
      x = b.x + ((p.x - view.x) / view.width) * b.width,
      y = b.y + ((p.y - view.y) / view.height) * b.height;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 24, y + 28, { steps: 5 });
    await page.mouse.up();
    await until(() => record('Klosterweg').revision > originalRoad.revision);
    const corrected = record('Klosterweg');
    assert.deepEqual(corrected.points[0], originalRoad.points[0]);
    assert.deepEqual(corrected.points.slice(2), originalRoad.points.slice(2));
    assert.notDeepEqual(corrected.points[1], originalRoad.points[1]);
    await page.locator('#atlas-undo').click();
    await until(
      () => JSON.stringify(record('Klosterweg').points) === JSON.stringify(originalRoad.points),
    );
    await page.locator('#atlas-redo').click();
    await until(
      () => JSON.stringify(record('Klosterweg').points) === JSON.stringify(corrected.points),
    );
    await page.locator('#atlas-undo:enabled').waitFor();
    await page.waitForFunction(() => !document.querySelector('#land-finish').disabled);
    await native.capture(page, '02-connected-region');
    console.log('Measurement and path correction passed', scale);
    // Put names across both a vertical and horizontal internal output boundary.
    await outputView();
    const box = JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view')),
      size = 2048,
      width = Math.round(size * Math.min(1, box.width / box.height)),
      height = Math.round(size * Math.min(1, box.height / box.width));
    assert(width > 850 && height > 600);
    await page.locator('#atlas-output-back').click();
    for (const [name, px, py] of [
      ['Falkenbrück', 502, 250],
      ['Nebelkloster', 800, 520],
      ['Moorwacht', width * 0.75, height * 0.72],
    ]) {
      await choose(name);
      const old = record(name).revision;
      const position = page.locator('details').filter({ has: page.locator('#land-x') });
      if (!(await position.evaluate((n) => n.open))) await position.locator('summary').click();
      await page.locator('#land-x').fill(String(box.x + (box.width * px) / width));
      await page.locator('#land-y').fill(String(box.y + (box.height * py) / height));
      await page.getByRole('button', { name: 'Auswahl speichern', exact: true }).click();
      await until(() => record(name).revision > old);
      await page.waitForFunction(() => !document.querySelector('#land-finish').disabled);
    }
    // Keep the travel task coherent while placing the seam counterexamples:
    // reconnect all three destinations and keep the corrected bend between the first two.
    for (const [index, name] of [
      [0, 'Falkenbrück'],
      [1, null],
      [2, 'Nebelkloster'],
      [3, 'Moorwacht'],
    ]) {
      await choose('Klosterweg');
      if (await page.locator('#atlas-secondary').isVisible())
        await page.locator('#atlas-secondary-close').click();
      await atlasCanvasReady(page);
      const road = record('Klosterweg'),
        target = name
          ? record(name).points[0]
          : {
              x:
                (record('Falkenbrück').points[0].x + record('Nebelkloster').points[0].x) / 2 +
                corrected.points[1].x -
                originalRoad.points[1].x,
              y:
                (record('Falkenbrück').points[0].y + record('Nebelkloster').points[0].y) / 2 +
                corrected.points[1].y -
                originalRoad.points[1].y,
            },
        v = JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view')),
        b = await page.locator('#campaign-map').boundingBox(),
        screen = (p) => ({
          x: b.x + ((p.x - v.x) / v.width) * b.width,
          y: b.y + ((p.y - v.y) / v.height) * b.height,
        }),
        from = screen(road.points[index]),
        to = screen(target);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await page.mouse.up();
      await until(() => record('Klosterweg').revision > road.revision);
      const end = record('Klosterweg').points[index];
      assert(
        Math.hypot(end.x - target.x, end.y - target.y) < (v.width / b.width) * 2,
        'road endpoint stays at its named destination',
      );
    }
    await outputView();
    const finalBox = JSON.parse(
      await page.locator('#campaign-map').getAttribute('data-atlas-view'),
    );
    assert.deepEqual(finalBox, box);
    await page.locator('#atlas-output details summary').click();
    await page.locator('#atlas-export-size').fill(String(size));
    await page.locator('#atlas-export-grid').uncheck();
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, profile + '/region.png');
    const beforeExport = facts();
    await page.locator('#atlas-export-png').click();
    await page.waitForFunction(
      () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
      null,
      { timeout: 120000 },
    );
    const bytes = await readFile(profile + '/region.png');
    await writeFile(output + '/region-' + scale + '.png', bytes);
    const png = PNG.sync.read(bytes),
      dark = (x1, y1, x2, y2) => {
        let count = 0;
        for (let y = y1; y < y2; y++)
          for (let x = x1; x < x2; x++) {
            const i = (y * png.width + x) * 4;
            if (
              png.data[i] < 110 &&
              png.data[i + 1] < 110 &&
              png.data[i + 2] < 110 &&
              png.data[i + 3]
            )
              count++;
          }
        return count;
      };
    assert.equal(png.width, width);
    assert.equal(png.height, height);
    const riverPoint = record('Nebelfluss').points[1],
      rx = Math.round(((riverPoint.x - box.x) / box.width) * width),
      ry = Math.round(((riverPoint.y - box.y) / box.height) * height);
    let landPixels = 0,
      riverPixels = 0,
      riverBankPixels = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4,
          land = png.data[i] === 238 && png.data[i + 1] === 229 && png.data[i + 2] === 207,
          near = Math.abs(x - rx) < 48 && Math.abs(y - ry) < 48;
        if (land) landPixels++;
        if (near && land) riverBankPixels++;
        const alpha = (238 - png.data[i]) / 111;
        if (
          near &&
          alpha > 0.15 &&
          alpha <= 1 &&
          Math.abs(png.data[i + 1] - (229 - alpha * 61)) < 3 &&
          Math.abs(png.data[i + 2] - (207 - alpha * 18)) < 3
        )
          riverPixels++;
      }
    assert(landPixels > width * height * 0.1, 'a travel region needs a visible authored land body');
    assert(
      riverBankPixels > 500 && riverPixels > 30,
      'the river must be visible between land banks, not hidden in ocean',
    );
    // Include antialiased river edges above; the empty drawing must not add any text at the otherwise blank center.
    const emptyDrawingPixels = dark(
      Math.floor(width / 2) - 60,
      Math.floor(height / 2) - 20,
      Math.floor(width / 2) + 60,
      Math.floor(height / 2) + 10,
    );
    assert.equal(emptyDrawingPixels, 0, 'an empty initial drawing must not label the travel map');
    const acrossX = dark(513, 225, 570, 244),
      acrossY = dark(740, 494, 860, 512);
    assert(acrossX > 20, 'Falkenbrück must continue right of the 512-pixel seam');
    assert(acrossY > 20, 'Nebelkloster anchored below the seam must print above it');
    assert.equal(facts(), beforeExport);
    await writeFile(output + '/region-' + scale + '.png', bytes);
    const saved = records(),
      savedFacts = facts();
    db.close();
    db = null;
    await close();
    await launch();
    await page.locator('#atlas-search').fill('Klosterweg');
    await page.getByRole('button', { name: 'Klosterweg', exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('#land-name')?.value === 'Klosterweg' &&
        document.querySelector('#land-tool')?.value === 'select',
    );
    db = new Database(profile + '/workbench.sqlite', { readonly: true });
    assert.deepEqual(records(), saved);
    assert.equal(facts(), savedFacts);
    db.close();
    db = null;
    await close();
    results.push({
      scale,
      profile,
      measurement: measured,
      measurementReadonly: true,
      propertyUndoRedo: true,
      dragUndoRedo: true,
      exportReadonly: true,
      width,
      height,
      landPixels,
      riverPixels,
      riverBankPixels,
      threeConnectedPlaces: true,
      acrossX,
      acrossY,
      emptyDrawingPixels,
      reopened: true,
    });
    await native.finish(results.at(-1));
    launches.push(...native.launches);
    await native.dispose();
    native = null;
  }
  for (const { pid } of launches) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  await writeFile(output + '/result.json', JSON.stringify({ launches, results }, null, 2));
  console.log(JSON.stringify({ launches, results }));
} catch (error) {
  await native?.fail(error);
  throw error;
} finally {
  db?.close();
  await native?.dispose();
}
