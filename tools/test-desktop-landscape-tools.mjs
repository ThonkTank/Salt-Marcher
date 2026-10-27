import { runNativeProbe } from './native-session.mjs';
import { setBrushWorldRadius } from './atlas-brush-probe.mjs';
// Actual Electron window and an isolated synthetic campaign. Never opens the user's profile.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/landscape-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/landscape-native-store.cjs');
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/landscape-native');
await runNativeProbe({ output: out, name: 'landscape-tools' }, async (native) => {
  const dir = native.profile;
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
  const cam = store.create('Pinselvergleich', [room]),
    active = store.activate(cam.id);
  const rect = (id, terrain, x, y, width, height) => ({
    id,
    revision: 0,
    kind: 'patch',
    name: id,
    points: [],
    polygons: [
      {
        outer: [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
        ],
        holes: [],
      },
    ],
    resolution: 4828.032,
    width: 0,
    values: { terrain },
  });
  store.executeAtlasCommit({
    commandId: randomUUID(),
    token: active.token,
    campaignId: cam.id,
    action: {
      kind: 'landscape-batch',
      records: [
        rect('sea', 'water', -500, -500, 1000, 1000),
        {
          ...rect('island', 'plains', -60, -50, 120, 100),
          polygons: [
            {
              outer: [
                { x: -60, y: -50 },
                { x: 40, y: -50 },
                { x: 40, y: -20 },
                { x: 20, y: -18 },
                { x: 20, y: -9 },
                { x: 50, y: -9 },
                { x: 50, y: -5 },
                { x: 25, y: -5 },
                { x: 25, y: 50 },
                { x: -60, y: 50 },
              ],
              holes: [],
            },
          ],
        },
      ].map((record) => ({ record, expectedRevision: null })),
    },
  });
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
    source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      encoding: 'utf8',
    }).trim(),
    profile: dir,
    errors: [],
    checks: [],
  };
  let app, page;
  async function start() {
    const executable = process.env.ATLAS_PACKAGE
      ? path.join(process.env.ATLAS_PACKAGE, 'electron')
      : root + '/node_modules/electron/dist/electron';
    app = await native.launchConfigured({
      runtime: process.env.ATLAS_PACKAGE
        ? { kind: 'package', directory: process.env.ATLAS_PACKAGE }
        : undefined,
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
      .filter({ hasText: 'Pinselvergleich' })
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
    await page.locator('button[data-family="terrain"]').click();
    await atlasCanvasReady(page);
  }
  const tool = async (value) => {
    await page.waitForFunction(() => !document.querySelector('#land-tool').disabled);
    await page.locator(`[data-tool-select="land-tool"][data-tool-value="${value}"]`).click();
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
  async function clickWorld(x, y, button = 'left') {
    const p = await at(x, y);
    await page.mouse.click(p.x, p.y, { button });
  }
  async function waitRecord(predicate) {
    for (let i = 0; i < 100; i++) {
      if (records().some(predicate)) {
        await atlasCanvasReady(page);
        return;
      }
      await page.waitForTimeout(100);
    }
    throw Error('Expected persisted record not found: ' + JSON.stringify(records()));
  }
  async function capture(name) {
    await page.screenshot({ path: out + '/' + name + '.png' });
  }
  async function stroke(points) {
    const p = await at(...points[0]);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    for (const point of points.slice(1)) {
      const q = await at(...point);
      await page.mouse.move(q.x, q.y, { steps: 12 });
    }
    await page.mouse.up();
  }
  try {
    await start();
    // A fixed, ordinary view selected through the real toolbar. Derive authored points from that camera.
    for (let i = 0; i < 3; i++)
      await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
    await atlasCanvasReady(page);
    const c = await camera(),
      x = c.view.x + c.view.width * 0.3,
      y = c.view.y + c.view.height * 0.35,
      dx = c.view.width * 0.18,
      dy = c.view.height * 0.2;
    await tool('road');
    await page.locator('#land-width').fill('1');
    await page.locator('#land-new-style').selectOption('double');
    await page.locator('#atlas-new-name').fill('Küstenstraße');
    await clickWorld(x, y);
    await clickWorld(x + dx, y + dy);
    await clickWorld(x + dx * 2, y);
    await clickWorld(x + dx * 2, y, 'right');
    await waitRecord((r) => r.name === 'Küstenstraße');
    assert.equal(records().find((r) => r.name === 'Küstenstraße').line.style, 'double');
    await capture('01-road');
    result.checks.push('native road points/right-click/style/receipt');
    await tool('river');
    await page.locator('#land-width').fill('1.5');
    await page.locator('#atlas-new-name').fill('Mäanderfluss');
    await clickWorld(x, y + dy * 1.5);
    await clickWorld(x + dx, y + dy * 0.5);
    await clickWorld(x + dx * 2, y + dy * 1.5);
    await page.locator('#campaign-map').focus();
    await page.keyboard.press('Enter');
    await waitRecord((r) => r.name === 'Mäanderfluss');
    assert.equal(records().find((r) => r.name === 'Mäanderfluss').line.fadeIn, true);
    await capture('02-river');
    result.checks.push('native river options/Enter/receipt');
    const beforeCancel = records().length;
    await clickWorld(x, y);
    await page.keyboard.press('Escape');
    assert.equal(records().length, beforeCancel);
    result.checks.push('Escape leaves no river');
    await tool('freshwater');
    await setBrushWorldRadius(page, 'land-radius', '3');
    await stroke([
      [x + dx * 2, y + dy * 1.5],
      [x + dx * 2 + 3, y + dy * 1.5 + 2],
    ]);
    await waitRecord((r) => r.surface === 'freshwater');
    result.checks.push('freshwater stroke commits on release');
    await tool('color');
    await setBrushWorldRadius(page, 'land-radius', '3');
    await page.locator('#land-tip').selectOption('soft');
    await page.locator('#land-paint-color').fill('#dba64b');
    await stroke([
      [x, y],
      [x + dx * 0.6, y + dy * 0.6],
    ]);
    await waitRecord((r) => r.paint?.color === '#dba64b');
    await capture('03-paint');
    result.checks.push('soft pigment stored separately from terrain');
    await page.locator('#land-paint-color').fill('#668b69');
    await page.locator('#land-paint-opacity').fill('0.5');
    await stroke([
      [x + dx * 0.3, y - dy * 0.2],
      [x + dx * 0.7, y + dy * 0.6],
    ]);
    await waitRecord((r) => r.paint?.color === '#668b69');
    await tool('river');
    await page.locator('#land-width').fill('0.7');
    await page.locator('#atlas-new-name').fill('Nebenarm');
    await clickWorld(x + dx * 1.5, y - dy * 0.3);
    await clickWorld(x + dx * 1.3, y + dy * 0.15);
    await clickWorld(x + dx, y + dy * 0.5);
    await clickWorld(x + dx, y + dy * 0.5, 'right');
    await waitRecord((r) => r.name === 'Nebenarm');
    result.checks.push('tributary snapped to main river and overlapping pigments');
    const persisted = records();
    await native.close();
    app = null;
    await start();
    assert.deepEqual(records(), persisted);
    await capture('04-fresh');
    result.checks.push('fresh Electron process retains exact canonical landscape');
    await tool('select');
    await page
      .locator('#land-object')
      .selectOption(persisted.find((r) => r.name === 'Küstenstraße').id);
    await page.locator('#land-edit-style').waitFor({ state: 'visible' });
    await page.locator('#land-edit-style').selectOption('dashed');
    await page.getByRole('button', { name: 'Auswahl speichern', exact: true }).click();
    await waitRecord((r) => r.name === 'Küstenstraße' && r.line.style === 'dashed');
    result.checks.push('existing line style edit');
    await capture('05-edit');
    await page.locator('#campaign-map').press('Escape');
    await page.locator('#atlas-undo').click();
    await waitRecord((r) => r.name === 'Küstenstraße' && r.line.style === 'double');
    await page.locator('#atlas-redo').click();
    await waitRecord((r) => r.name === 'Küstenstraße' && r.line.style === 'dashed');
    result.checks.push('native undo/redo of completed style edit');
    // Return to the comparison extent and create a second road through actual controls.
    for (let i = 0; i < 3; i++)
      await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
    await atlasCanvasReady(page);
    await tool('road');
    await page.locator('#atlas-new-name').fill('Uferweg');
    await page.locator('#land-width').fill('1');
    await page.locator('#land-new-style').selectOption('arrows');
    await clickWorld(x, y - dy * 0.4);
    await clickWorld(x + dx, y - dy * 0.6);
    await clickWorld(x + dx * 2, y - dy * 0.4);
    await clickWorld(x + dx * 2, y - dy * 0.4, 'right');
    await waitRecord((r) => r.name === 'Uferweg');
    const roads = records().filter((r) => r.kind === 'road');
    await tool('select');
    await page
      .locator('#land-object')
      .selectOption(roads.find((r) => r.name === 'Küstenstraße').id);
    await page
      .locator(
        '#land-selection[data-selection-id="' +
          roads.find((r) => r.name === 'Küstenstraße').id +
          '"]',
      )
      .waitFor({ state: 'visible' });
    await page.keyboard.down('Shift');
    await clickWorld(x, y - dy * 0.4);
    await page.keyboard.up('Shift');
    await page
      .getByRole('button', { name: 'Breite und Stil auf Auswahl anwenden', exact: true })
      .waitFor({ state: 'visible' });
    await page.locator('#land-record-width').fill('2');
    await page.locator('#land-edit-style').selectOption('dash-dot-dot');
    await page
      .getByRole('button', { name: 'Breite und Stil auf Auswahl anwenden', exact: true })
      .click();
    await page.getByRole('button', { name: 'Auswahl speichern', exact: true }).click();
    await waitRecord((r) => r.name === 'Uferweg' && r.width === 2);
    assert(
      records()
        .filter((r) => r.kind === 'road')
        .every((r) => r.line.style === 'dash-dot-dot' && r.width === 2),
    );
    result.checks.push('Shift multi-selection edits width/style in one commit');
    await page.locator('#campaign-map').press('Escape');
    await page.locator('#atlas-undo').click();
    await waitRecord((r) => r.name === 'Uferweg' && r.line.style === 'arrows');
    assert(
      records()
        .filter((r) => r.kind === 'road')
        .every((r) => r.width === 1),
    );
    await page.locator('#atlas-redo').click();
    await waitRecord((r) => r.name === 'Uferweg' && r.width === 2);
    await page
      .locator('#land-object')
      .selectOption(roads.find((r) => r.name === 'Küstenstraße').id);
    await page
      .locator(
        '#land-selection[data-selection-id="' +
          roads.find((r) => r.name === 'Küstenstraße').id +
          '"]',
      )
      .waitFor({ state: 'visible' });
    await clickWorld(x + dx, y + dy);
    await page.getByRole('button', { name: 'Am markierten Punkt teilen', exact: true }).click();
    for (let i = 0; i < 100 && records().filter((r) => r.kind === 'road').length < 3; i++)
      await page.waitForTimeout(100);
    assert.equal(records().filter((r) => r.kind === 'road').length, 3);
    result.checks.push('native control-point split');
    await atlasCanvasReady(page);
    await page.locator('#campaign-map').press('Escape');
    await tool('paint');
    await page.locator('#land-operation').selectOption('add');
    await page.locator('#land-coast-roughness').fill('0');
    await setBrushWorldRadius(page, 'land-radius', '2');
    await stroke([
      [x + dx * 2, y - dy],
      [x + dx * 2 + 3, y - dy],
    ]);
    await page.waitForFunction(
      () => document.querySelector('#land-status').textContent === 'Gespeichert',
    );
    await atlasCanvasReady(page);
    const landMask = JSON.stringify(
      records()
        .filter((r) => r.mask)
        .map((r) => [r.id, r.mask.data]),
    );
    result.checks.push('native land brush commits a local surface');
    await page.locator('#land-operation').selectOption('erase');
    await stroke([
      [x + dx * 2, y - dy],
      [x + dx * 2 + 1, y - dy],
    ]);
    await page.waitForFunction(
      () => document.querySelector('#land-status').textContent === 'Gespeichert',
    );
    await atlasCanvasReady(page);
    assert.notEqual(
      JSON.stringify(
        records()
          .filter((r) => r.mask)
          .map((r) => [r.id, r.mask.data]),
      ),
      landMask,
    );
    await page.locator('#atlas-undo').click();
    await page.waitForFunction(
      () =>
        !document.querySelector('#atlas-redo').disabled &&
        document.querySelector('#campaign-atlas').dataset.regionState === 'ready',
    );
    assert.equal(
      JSON.stringify(
        records()
          .filter((r) => r.mask)
          .map((r) => [r.id, r.mask.data]),
      ),
      landMask,
    );
    result.checks.push('native land eraser and undo');
    // A real database rejection must leave the same draft available for retry.
    const faultDb = new Database(dir + '/workbench.sqlite');
    await tool('road');
    await page.locator('#atlas-new-name').fill('Retrystraße');
    await page.locator('#land-new-style').selectOption('solid');
    await page.locator('#land-width').fill('0.4');
    await clickWorld(x, y - dy);
    await clickWorld(x + dx, y - dy);
    faultDb.exec('BEGIN IMMEDIATE');
    await clickWorld(x + dx, y - dy, 'right');
    await page.waitForFunction(
      () => /database is locked|SQLITE_BUSY/.test(document.body.textContent),
      null,
      { timeout: 30000 },
    );
    assert(!records().some((r) => r.name === 'Retrystraße'));
    faultDb.exec('ROLLBACK');
    faultDb.close();
    await page.locator('#land-finish').click();
    await waitRecord((r) => r.name === 'Retrystraße');
    assert.equal(records().find((r) => r.name === 'Retrystraße').points.length, 2);
    result.checks.push('real storage failure retains draft for one successful retry');
    await page.locator('#campaign-map').press('Escape');
    await page.locator('#atlas-output-open').click();
    await page.locator('#atlas-output summary').filter({ hasText: 'Bildoptionen' }).click();
    await page.locator('#atlas-export-size').fill('1600');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, out + '/comparison.png');
    await page.locator('#atlas-export-png').click();
    await page.waitForFunction(
      () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
      null,
      { timeout: 60000 },
    );
    const png = require('pngjs').PNG.sync.read(await readFile(out + '/comparison.png'));
    assert.equal(Math.max(png.width, png.height), 1600);
    assert(png.height > 100);
    result.checks.push('native PNG export of comparison map');
    await capture('06-export');
    assert.deepEqual(result.errors, []);
    result.ok = true;
  } catch (error) {
    result.error = error.stack ?? String(error);
    if (page) await capture('failure').catch(() => {});
    throw error;
  } finally {
    if (app) {
      await page?.keyboard.press('Escape').catch(() => {});
      if (result.ok) {
        await native.close();
        result.normalExit = true;
      } else await native.dispose().catch(() => {});
    }
    db.close();
    await native.recordResult(result);
  }
});
