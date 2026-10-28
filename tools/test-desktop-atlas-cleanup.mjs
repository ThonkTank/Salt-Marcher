// Controller integration: output returns to the same usable Atlas at 100%.
// This does not replace the separate region-export label/seam qualification.
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url),
  root = process.cwd();
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/atlas-cleanup-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require('../.build/atlas-cleanup-store.cjs');
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-cleanup-native');
for (const zoom of [1]) {
  const native = await createNativeSession({
    root,
    output: path.join(output, String(zoom)),
    name: 'atlas-cleanup',
  });
  const store = new CampaignStore(native.profile + '/workbench.sqlite');
  store.create('Atlas aufräumen', [
    {
      id: 'room',
      scopeId: 'local',
      floorId: 'ground',
      number: '1',
      name: 'Wachstube',
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
  const enter = async (page) => {
    await page
      .locator('.campaign-card')
      .filter({ hasText: 'Atlas aufräumen' })
      .getByRole('button', { name: /^(Öffnen|Fortsetzen)$/ })
      .click();
    await page.waitForFunction(
      () =>
        document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
    );
    await atlasCanvasReady(page);
    await page.locator('#atlas-search').fill('Wachstube');
    await page.locator('#atlas-search-results button').filter({ hasText: 'Wachstube' }).click();
    await page.locator('#atlas-search').fill('');
    await atlasCanvasReady(page);
    assert.equal(await page.locator('#room-name').inputValue(), 'Wachstube');
  };
  try {
    let page = await native.launch(zoom);
    await enter(page);
    await native.capture(page, '01-selected.png');
    if (await page.locator('#atlas-secondary').isVisible())
      await page.locator('#atlas-secondary-close').click();
    await page.locator('#atlas-output-open').click();
    await page.locator('#atlas-output details summary').click();
    await page.locator('#atlas-export-size').fill('512');
    const file = path.join(native.profile, 'atlas.png');
    await native.app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, file);
    await page.locator('#atlas-export-png').click();
    await page.waitForFunction(
      () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
      null,
      { timeout: 120000 },
    );
    const png = require('pngjs').PNG.sync.read(await readFile(file));
    assert.equal(Math.max(png.width, png.height), 512);
    const colors = new Set();
    for (let i = 0; i < png.data.length; i += 4) colors.add(png.data.readUInt32BE(i));
    assert(colors.size > 8, 'Output must contain rendered content');
    await page.locator('#atlas-output-back').click();
    await page.locator('#atlas-navigation').click();
    if (!(await page.locator('#catalog-tab').isVisible()))
      await page.locator('#workspace-nav-summary').click();
    await page.locator('#catalog-tab').click();
    await page.waitForFunction(() => document.querySelector('#campaign-atlas').hidden);
    if (!(await page.locator('#atlas-tab').isVisible()))
      await page.locator('#workspace-nav-summary').click();
    await page.locator('#atlas-tab').click();
    await atlasCanvasReady(page);
    await page.locator('#atlas-search').fill('Wachstube');
    await page.locator('#atlas-search-results button').filter({ hasText: 'Wachstube' }).click();
    await page.locator('#atlas-search').fill('');
    await atlasCanvasReady(page);
    assert.equal(await page.locator('#room-name').inputValue(), 'Wachstube');
    await native.capture(page, '02-after-output.png');
    await native.close();
    page = await native.launch(zoom);
    await enter(page);
    await native.capture(page, '03-reopened.png');
    await native.close();
    await native.finish({
      zoom,
      output: { width: png.width, height: png.height, colors: colors.size },
      checks: [
        'select room',
        'save PNG',
        'use Atlas menu after export',
        'return from catalog',
        'select room again',
        'normal close and fresh reopen',
      ],
    });
    console.log('Atlas output/navigation/reopen passed at ' + zoom * 100 + '%');
  } catch (error) {
    await native.fail(error);
    throw error;
  } finally {
    await native.dispose();
  }
}
