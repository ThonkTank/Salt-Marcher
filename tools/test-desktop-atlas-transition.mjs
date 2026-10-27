import { runNativeProbe } from './native-session.mjs';
import { setBrushWorldRadius } from './atlas-brush-probe.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const source = process.cwd(),
  require = createRequire(source + '/package.json'),
  { _electron } = require('playwright-core');
const output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/atlas-transition-native');
await runNativeProbe(
  { output: output, name: 'atlas-transition', resultName: 'native.json' },
  async (native) => {
    await mkdir(output, { recursive: true });
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/transition-native-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/transition-native-store.cjs'),
      { PNG } = require('pngjs'),
      profile = native.profile,
      file = profile + '/workbench.sqlite';
    const seed = new CampaignStore(file),
      campaign = seed.create('Waldwelt'),
      w = seed.activate(campaign.id),
      put = seed.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
    seed.db.transaction(() => {
      for (let i = 0; i < 100000; i++) {
        const x = (i % 316) * 5000,
          y = Math.floor(i / 316) * 5000,
          r = {
            id: randomUUID(),
            revision: 1,
            kind: 'patch',
            name: 'Wald',
            points: [],
            polygons: [
              {
                outer: [
                  { x, y },
                  { x: x + 5000, y },
                  { x: x + 5000, y: y + 5000 },
                  { x, y: y + 5000 },
                ],
                holes: [],
              },
            ],
            resolution: 4828.032,
            width: 0,
            values: { terrain: 'forest' },
          };
        put.run(campaign.id, r.id, 1, x, x + 5000, y, y + 5000, JSON.stringify(r));
      }
    })();
    seed.db.transaction(() => {
      for (let i = 0; i < 251; i++) {
        const x = -5e6 + i * 1000,
          y = -5e6,
          r = {
            id:
              'road-' +
              String(i).padStart(4, '0') +
              ([39, 250].includes(i) ? 'x'.repeat(1500) : ''),
            revision: 1,
            kind: 'road',
            name: 'Äußere Straße ' + i,
            points: [
              { x, y },
              { x: x + 100, y },
            ],
            polygons: [],
            resolution: 4828.032,
            width: 5,
            values: {},
          };
        put.run(campaign.id, r.id, 1, x - 2.5, x + 102.5, y - 2.5, y + 2.5, JSON.stringify(r));
      }
    })();
    seed.tutorial('skipped');
    seed.close();
    // Keep the large world database on the evidence filesystem, and the Unix socket path short.

    let app,
      closed = true;
    const errors = [],
      launches = [],
      results = {
        profile,
        sourceRevision:
          (process.env.SOURCE_REVISION ??
            execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()) +
          (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
            encoding: 'utf8',
          }).trim()
            ? '+dirty'
            : ''),
      };
    async function launch() {
      app = await native.launchConfigured({
        executablePath: source + '/node_modules/electron/dist/electron',
        args: [source + '/.build/desktop/main.cjs', '--data-dir', profile, '--ozone-platform=x11'],
        timeout: 60000,
      });
      closed = false;
      launches.push(app.process().pid);
      const page = await app.firstWindow();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true', null, {
        timeout: 30000,
      });
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: 'Fortsetzen', exact: true })
        .click();
      await page.locator('#atlas-tab').click();
      await page.locator('#atlas-overview').click();
      await atlasCanvasReady(page);
      return page;
    }
    async function canvasPNG(page) {
      await atlasCanvasReady(page);
      return Buffer.from(
        (await page.locator('#campaign-map').evaluate((canvas) => canvas.toDataURL())).split(
          ',',
        )[1],
        'base64',
      );
    }
    // At world scale a small patch may be entirely edge pixels after Canvas resampling.
    // This fixture has only paper/forest/water: require the water-directed color change, then its removal on Undo.
    const waterPixel = (r, g, b) => r < 176 && g < 196 && b > 158;
    async function pixels(page) {
      const png = PNG.sync.read(await canvasPNG(page));
      let forest = 0,
        water = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        if (
          png.data[i] === 102 &&
          png.data[i + 1] === 139 &&
          png.data[i + 2] === 105 &&
          png.data[i + 3]
        )
          forest++;
        if (waterPixel(png.data[i], png.data[i + 1], png.data[i + 2]) && png.data[i + 3]) water++;
      }
      return { forest, water, width: png.width, height: png.height };
    }
    async function visiblePixels(page) {
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      const png = PNG.sync.read(await page.locator('#campaign-map').screenshot());
      let forest = 0,
        water = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const [r, g, b] = png.data.subarray(i, i + 3);
        if (Math.abs(r - 102) < 3 && Math.abs(g - 139) < 3 && Math.abs(b - 105) < 3) forest++;
        if (waterPixel(r, g, b)) water++;
      }
      return { forest, water };
    }
    async function close() {
      const exit = new Promise((resolve) =>
        app.process().once('exit', (code, signal) => resolve({ code, signal })),
      );
      await native.close();
      assert.deepEqual(await exit, { code: 0, signal: null });
      closed = true;
    }
    try {
      let page = await launch();
      results.before = await pixels(page);
      assert(results.before.forest > 100);
      assert.equal(results.before.water, 0);
      results.visibleBefore = await visiblePixels(page);
      assert(results.visibleBefore.forest > 100, 'Forest must be visible in the actual map');
      await writeFile(path.join(output, 'raster-before.png'), await canvasPNG(page));
      await page.screenshot({ path: path.join(output, 'world-before.png') });
      await app.evaluate(({ dialog }, file) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      }, profile + '/atlas-world.png');
      await page.locator('#atlas-output-open').click();
      await page.locator('#atlas-output details summary').click();
      await page.locator('#atlas-export-size').fill('2048');
      await page.locator('#atlas-export-png').click();
      await page.waitForFunction(
        () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
        null,
        { timeout: 60000 },
      );
      const exportBytes = await readFile(profile + '/atlas-world.png'),
        exportPng = PNG.sync.read(exportBytes);
      let exportedForest = 0;
      for (let i = 0; i < exportPng.data.length; i += 4)
        if (
          exportPng.data[i] === 102 &&
          exportPng.data[i + 1] === 139 &&
          exportPng.data[i + 2] === 105
        )
          exportedForest++;
      results.exportedForest = exportedForest;
      let scaleTextPixels = 0;
      for (let y = exportPng.height - 112; y < exportPng.height - 80; y++)
        for (let x = 24; x < 480; x++) {
          const i = (y * exportPng.width + x) * 4;
          if (exportPng.data[i] < 80 && exportPng.data[i + 1] < 100 && exportPng.data[i + 2] < 90)
            scaleTextPixels++;
        }
      assert(
        scaleTextPixels > 20,
        'World export must include visible distance text above the scale bar',
      );
      results.scaleTextPixels = scaleTextPixels;
      await writeFile(path.join(output, 'export-world.png'), exportBytes);
      assert(exportedForest > 100, 'World export must preserve the visible small forest patches');
      await page.locator('#atlas-export-size').fill('4096');
      await page.locator('#atlas-export-png').click();
      await page.locator('#atlas-export-cancel').click();
      await page.waitForFunction(
        () => document.querySelector('#atlas-save-status').textContent === 'Ausgabe abgebrochen',
      );
      assert.deepEqual(await readFile(profile + '/atlas-world.png'), exportBytes);
      results.exportCancel = true;
      await page.locator('#atlas-output-back').click();
      await page.locator('#atlas-search').fill('ÄUẞERE');
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('#atlas-search-results button')].filter((b) =>
            b.textContent.startsWith('Äußere Straße '),
          ).length === 40,
      );
      const more = page.getByRole('button', { name: 'Weitere Landschaftsobjekte', exact: true });
      while (await more.isVisible()) {
        const count = await page.locator('#atlas-search-results button').count();
        await more.click();
        await page.waitForFunction(
          (count) => document.querySelectorAll('#atlas-search-results button').length !== count,
          count,
        );
      }
      assert.equal(await page.locator('#atlas-search-results button').count(), 251);
      await page.getByRole('button', { name: 'Äußere Straße 250', exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector('#land-name')?.value === 'Äußere Straße 250',
      );
      results.completeLandscapeSearch = true;
      await page.locator('#atlas-overview').click();
      for (let i = 0; i < 100; i++) {
        if ((await pixels(page)).forest > 100) break;
        await page.waitForTimeout(100);
      }
      assert((await pixels(page)).forest > 100);
      const sceneBeforePan = await page.locator('#campaign-map').getAttribute('data-scene-version'),
        viewBeforePan = await page.locator('#campaign-map').getAttribute('data-atlas-view'),
        pan = await page.locator('#campaign-map').boundingBox();
      await page.mouse.move(pan.x + pan.width / 2, pan.y + pan.height / 2);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(pan.x + pan.width / 2 + 15, pan.y + pan.height / 2 + 8, { steps: 5 });
      await page.mouse.up({ button: 'middle' });
      await page.waitForFunction(
        (before) => document.querySelector('#campaign-map').dataset.atlasView !== before,
        viewBeforePan,
      );
      await atlasCanvasReady(page);
      assert.equal(
        await page.locator('#campaign-map').getAttribute('data-scene-version'),
        sceneBeforePan,
        'Small camera move reuses the compiled scene and buffered rasters',
      );
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(pan.x + pan.width / 2, pan.y + pan.height / 2, { steps: 5 });
      await page.mouse.up({ button: 'middle' });
      results.bufferedPan = true;
      await app.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('atlas:execute');
        ipcMain.handle('atlas:execute', () => {
          throw new Error('Full atlas endpoint must not be used for terrain commit.');
        });
      });
      await page.locator('button[data-family="terrain"]').click();
      await page.locator('#land-tool').selectOption('paint');
      await setBrushWorldRadius(page, 'land-radius', '200000');
      await page.locator('#atlas-terrain').selectOption('water');
      const box = await page.locator('#campaign-map').boundingBox();
      await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.52);
      await page.locator('#land-finish').click();
      await page.waitForFunction(
        () => document.querySelector('#land-status').textContent === 'Gespeichert',
        null,
        { timeout: 30000 },
      );
      for (let i = 0; i < 200; i++) {
        if ((await pixels(page)).water > 0) break;
        await page.waitForTimeout(100);
      }
      results.after = await pixels(page);
      assert(results.after.water > 0);
      results.visibleAfter = await visiblePixels(page);
      assert(results.visibleAfter.water > 0, 'Water must be visible in the actual map');
      await page.screenshot({ path: path.join(output, 'world-after.png') });
      results.nativeMetrics = await app.evaluate(({ app }) =>
        app.getAppMetrics().map((m) => ({ type: m.type, memory: m.memory })),
      );
      await close();
      const checkpoint = new CampaignStore(file),
        next = checkpoint.activate(campaign.id);
      assert.equal(checkpoint.atlasOverview(next.token).counts.landscape, 100252);
      assert.equal(checkpoint.db.prepare('SELECT count(*) n FROM atlas_receipt').get().n, 1);
      checkpoint.close();
      page = await launch();
      assert((await pixels(page)).water > 0);
      await page.locator('#atlas-undo').click();
      await page.waitForFunction(
        () => document.querySelector('#atlas-save-status').textContent === 'Gespeichert',
      );
      for (let i = 0; i < 100; i++) {
        if ((await pixels(page)).water === 0) break;
        await page.waitForTimeout(100);
      }
      results.undo = await pixels(page);
      assert.equal(results.undo.water, 0);
      assert(results.undo.forest > 100);
      results.visibleUndo = await visiblePixels(page);
      assert(results.visibleUndo.forest > 100);
      assert.equal(results.visibleUndo.water, 0);
      await page.screenshot({ path: path.join(output, 'world-undo.png') });
      await close();
      assert.deepEqual(errors, []);
      await native.recordResult({ results, launches, errors, normalExit: true });
      console.log(
        JSON.stringify({
          before: results.before,
          after: results.after,
          undo: results.undo,
          normalExit: true,
        }),
      );
    } catch (e) {
      if (app && !closed) {
        try {
          await (await app.firstWindow()).screenshot({ path: path.join(output, 'failure.png') });
        } catch {}
      }
      await writeFile(
        path.join(output, 'failure.json'),
        JSON.stringify({ error: e.stack, results, launches, errors }, null, 2),
      );
      throw e;
    } finally {
    }
  },
);
