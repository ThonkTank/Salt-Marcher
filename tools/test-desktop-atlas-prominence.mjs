import { createNativeSession } from './native-session.mjs';
import { createCartographicFixture } from './atlas-cartographic-fixture.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-prominence-native');
const native = await createNativeSession({ root, output, name: 'atlas-prominence' }),
  Database = createRequire(import.meta.url)('better-sqlite3');
let db, page;
const checks = [];
try {
  const fixture = createCartographicFixture(native.profile, { bridge: true });
  db = new Database(native.profile + '/workbench.sqlite', { readonly: true });
  const records = () => db.prepare('SELECT id,payload FROM atlas_landscape ORDER BY id').all();
  const read = (id) => JSON.parse(records().find((r) => r.id === id).payload);
  const open = async () => {
    await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
    await page
      .locator('.campaign-card')
      .filter({ hasText: fixture.name })
      .getByRole('button', { name: /Öffnen|Fortsetzen/ })
      .click();
    await atlasCanvasReady(page);
    assert.equal(await page.locator('#campaign-map').getAttribute('data-renderer'), 'deck');
  };
  const focus = async (name) => {
    await page.locator('#atlas-search').fill(name);
    await page.locator('#atlas-search-results button').filter({ hasText: name }).first().click();
    await page.locator('#atlas-search').fill('');
    await atlasCanvasReady(page);
  };
  const settled = async (id, prominence) => {
    for (let i = 0; i < 300 && read(id).prominence !== prominence; i++)
      await page.waitForTimeout(100);
    assert.equal(read(id).prominence, prominence);
    await atlasCanvasReady(page);
    console.log('saved', id, prominence ?? 'automatic');
  };
  for (const zoom of [1, 2]) {
    page = await native.launch(zoom);
    await native.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1920, 1080),
    );
    await open();
    await focus('Passstraße');
    const before = read('Passstraße');
    await page.locator('#land-prominence').selectOption('5');
    await page
      .locator('#land-selection')
      .getByRole('button', { name: 'Auswahl speichern', exact: true })
      .click();
    await settled('Passstraße', 5);
    assert.equal(read('Passstraße').prominence, 5);
    assert.deepEqual(read('Passstraße').points, before.points);
    await page.locator('#atlas-undo').click();
    await settled('Passstraße', undefined);
    assert.equal(read('Passstraße').prominence, undefined);
    await page.locator('#atlas-redo').click();
    await settled('Passstraße', 5);
    assert.equal(read('Passstraße').prominence, 5);
    await focus('Dorfbrücke');
    const route = read('Dorfbrücke'),
      physical = records().filter((r) => r.id !== 'Dorfbrücke');
    await page.locator('#land-prominence').selectOption('4');
    await page.getByRole('button', { name: 'Kartenprominenz speichern', exact: true }).click();
    await settled('Dorfbrücke', 4);
    assert.equal(read('Dorfbrücke').prominence, 4);
    assert.deepEqual(read('Dorfbrücke').route, route.route);
    assert.deepEqual(
      records().filter((r) => r.id !== 'Dorfbrücke'),
      physical,
    );
    await page.getByRole('button', { name: 'Verlauf und Gelände bearbeiten', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('#terrain-route-editor')?.getAttribute('aria-busy') === 'false',
      null,
      { timeout: 120000 },
    );
    await page.locator('#route-prominence').selectOption('5');
    await page.locator('#terrain-route-editor [data-action="save"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#route-status')?.textContent ===
        'Verlauf und Geländeform gespeichert.',
      null,
      { timeout: 120000 },
    );
    assert.equal(read('Dorfbrücke').prominence, 5);
    assert.deepEqual(read('Dorfbrücke').route, route.route);
    assert.deepEqual(
      records().filter((r) => r.id !== 'Dorfbrücke'),
      physical,
    );
    if (!(await page.locator('#terrain-route-editor [data-action="close"]').isVisible()))
      await page.locator('#atlas-secondary-close').click();
    await native.capture(page, 'prominence-route-' + zoom);
    await page.locator('#terrain-route-editor [data-action="close"]').click();
    await native.close();
    page = await native.launch(zoom);
    await open();
    await focus('Dorfbrücke');
    assert.equal(await page.locator('#land-prominence').inputValue(), '5');
    await page.locator('#land-prominence').selectOption('');
    await page.getByRole('button', { name: 'Kartenprominenz speichern', exact: true }).click();
    await settled('Dorfbrücke', undefined);
    assert.equal(read('Dorfbrücke').prominence, undefined);
    await focus('Passstraße');
    await page.locator('#land-prominence').selectOption('');
    await page
      .locator('#land-selection')
      .getByRole('button', { name: 'Auswahl speichern', exact: true })
      .click();
    await settled('Passstraße', undefined);
    await native.capture(page, 'prominence-fresh-' + zoom);
    await native.close();
    checks.push({
      zoom,
      ordinary: true,
      plannedInspector: true,
      plannedEditor: true,
      undoRedo: true,
      fresh: true,
      automatic: true,
      physicalUnchanged: true,
    });
  }
  await native.finish({ fixture, checks });
} catch (error) {
  if (page)
    console.log(
      await page
        .evaluate(() => ({
          save: document.querySelector('#atlas-save-status')?.textContent,
          text: document.body.innerText.slice(-5000),
        }))
        .catch(() => null),
    );
  await native.fail(error);
  throw error;
} finally {
  db?.close();
  await native.dispose();
}
