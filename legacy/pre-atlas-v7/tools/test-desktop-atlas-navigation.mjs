import { runNativeProbe } from './native-session.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const output = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/atlas-navigation-native');
await runNativeProbe(
  { output: output, name: 'atlas-navigation', resultName: 'result.json' },
  async (native) => {
    await mkdir(output, { recursive: true });
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/navigation-native-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/navigation-native-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite';
    const seed = new CampaignStore(file),
      campaign = seed.create('Atlasnavigation prüfen'),
      w = seed.activate(campaign.id);
    const original = {
      id: randomUUID(),
      revision: 0,
      kind: 'patch',
      name: 'Geschützter alter Wald',
      points: [],
      polygons: [
        {
          outer: [
            { x: 1000, y: 1000 },
            { x: 6000, y: 1000 },
            { x: 6000, y: 6000 },
            { x: 1000, y: 6000 },
          ],
          holes: [],
        },
      ],
      resolution: 14484.096,
      width: 0,
      values: { terrain: 'forest' },
    };
    seed.executeAtlas({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action: { kind: 'landscape-put', record: original, expectedRevision: null },
    });
    seed.tutorial('skipped');
    const before = seed.db.prepare('SELECT id,payload FROM atlas_landscape ORDER BY id').all();
    seed.close();
    const executable = process.env.ATLAS_PACKAGE
      ? path.join(process.env.ATLAS_PACKAGE, 'electron')
      : path.join(root, 'node_modules/electron/dist/electron');
    const prefix = process.env.ATLAS_PACKAGE ? [] : [path.join(root, '.build/desktop/main.cjs')];
    const errors = [],
      results = { profile, executable };
    let app,
      closed = true;
    async function launch() {
      app = await native.launchConfigured({
        executablePath: executable,
        args: [...prefix, '--data-dir', profile],
        timeout: 30000,
      });
      closed = false;
      const page = await app.firstWindow();
      if (process.env.ATLAS_PACKAGE)
        assert.equal(
          await app.evaluate(({ app }) => app.getVersion()),
          require(root + '/package.json').version,
        );
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: 'Fortsetzen', exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
      if (await page.locator('#campaign-atlas').isHidden())
        await page
          .getByRole('button', { name: 'Atlas', exact: true })
          .filter({ visible: true })
          .click();
      await ready(page);
      return page;
    }
    async function ready(page) {
      await page.waitForFunction(
        () =>
          document.querySelector('#campaign-atlas').dataset.regionState === 'ready' &&
          ['loaded', 'empty'].includes(document.querySelector('#campaign-map').dataset.canvasState),
        null,
        { timeout: 30000 },
      );
    }
    async function view(page) {
      return page.locator('#campaign-map').evaluate((n) => JSON.parse(n.dataset.atlasView));
    }
    async function close() {
      const exit = new Promise((resolve) =>
        app.process().once('exit', (code, signal) => resolve({ code, signal })),
      );
      await native.close();
      assert.deepEqual(await exit, { code: 0, signal: null });
      closed = true;
    }
    async function openComparison(page) {
      await page.locator('#atlas-view').click();
      await page.locator('#atlas-reference-open').click();
    }
    async function reference(page, name) {
      await openComparison(page);
      await page.locator('#atlas-reference-search').fill(name);
      await page
        .locator('#atlas-reference-results button')
        .filter({ hasText: new RegExp('^' + name + ' ·') })
        .first()
        .click();
    }
    try {
      let page = await launch();
      const canvas = page.locator('#campaign-map'),
        bounds = await canvas.boundingBox(),
        v0 = await view(page);
      await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.3);
      await page.mouse.wheel(0, -160);
      await ready(page);
      const v1 = await view(page);
      assert(v1.width < v0.width);
      assert.equal(await page.locator('#atlas-scale').count(), 0);
      const ax = v0.x + v0.width * 0.3,
        ay = v0.y + v0.height * 0.3;
      assert(Math.abs((ax - v1.x) / v1.width - 0.3) < 0.01);
      assert(Math.abs((ay - v1.y) / v1.height - 0.3) < 0.01);
      await page.getByRole('button', { name: 'Vorige Ansicht', exact: true }).click();
      await ready(page);
      assert(Math.abs((await view(page)).width - v0.width) < 1e-6);
      results.zoomAnchorAndHistory = true;
      // Real renderer frame timing, including scroll and Chromium's Ctrl+wheel pinch.
      for (const ctrlKey of [false, true]) {
        const widths = await canvas.evaluate(async (n, ctrlKey) => {
          const r = n.getBoundingClientRect(),
            widths = [JSON.parse(n.dataset.atlasView).width];
          for (let i = 0; i < 36; i++) {
            n.dispatchEvent(
              new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                deltaY: i < 24 ? 32 : 2,
                deltaMode: 0,
                ctrlKey,
                clientX: r.x + r.width * 0.3,
                clientY: r.y + r.height * 0.3,
              }),
            );
            await new Promise((resolve) => requestAnimationFrame(resolve));
            widths.push(JSON.parse(n.dataset.atlasView).width);
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
          widths.push(JSON.parse(n.dataset.atlasView).width);
          return widths;
        }, ctrlKey);
        assert(widths.at(-1) > widths[0] * 2);
        assert(
          widths.every((w, i) => i === 0 || w >= widths[i - 1] - 1e-7),
          'touchpad gesture reversed unexpectedly',
        );
        await ready(page);
        results[ctrlKey ? 'pinchMonotonic' : 'scrollMonotonic'] = true;
        await page.getByRole('button', { name: 'Vorige Ansicht', exact: true }).click();
        await ready(page);
        assert(
          Math.abs((await view(page)).width - v0.width) < 1e-6,
          'whole touchpad gesture has one history entry',
        );
      }
      assert.equal(
        await canvas.evaluate((n) => getComputedStyle(n).backgroundColor),
        'rgb(184, 200, 150)',
        'the unloaded margin matches the map base',
      );

      await reference(page, 'Deutschland');
      await page.screenshot({ path: output + '/germany-before-focus.png' });
      await page.locator('#atlas-reference-show').click();
      await ready(page);
      const b = await canvas.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 + 45, b.y + b.height / 2 + 20, { steps: 5 });
      await page.mouse.up();
      await page.locator('#atlas-reference-focus').click();
      await ready(page);
      assert(await page.locator('#atlas-reference-panel').isHidden());
      const germany = await view(page);
      assert(germany.width >= 639000 && germany.height >= 867000);
      await page.screenshot({ path: output + '/germany-focused.png' });
      for (const name of ['Europa', 'Berlin', 'Rügen']) {
        await reference(page, name);
        await page.locator('#atlas-reference-focus').click();
        await ready(page);
        results[name] = await view(page);
      }
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.getTitle() === 'SaltMarcher')
          .setSize(800, 1100),
      );
      await reference(page, 'Deutschland');
      await page.locator('#atlas-reference-focus').click();
      await ready(page);
      const portrait = await view(page);
      assert(portrait.width >= 639000 && portrait.height >= 867000);
      await page.screenshot({ path: output + '/portrait.png' });
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.getTitle() === 'SaltMarcher')
          .setSize(1440, 900),
      );
      await ready(page);
      await reference(page, 'Deutschland');
      await page.locator('#atlas-reference-search').press('Escape');
      assert(await page.locator('#atlas-reference-panel').isHidden());
      await page.locator('#atlas-section').selectOption('terrain');
      await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
      await page.locator('button[data-tool-select=land-tool][data-tool-value=property]').click();
      await page.locator('#land-field').selectOption('terrain');
      await page.locator('#atlas-terrain').selectOption('forest');
      await page.locator('#land-radius').fill('500');
      const cb = await canvas.boundingBox();
      await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
      await page.mouse.down();
      await page.mouse.move(cb.x + cb.width / 2 + 20, cb.y + cb.height / 2 + 10, { steps: 3 });
      await page.mouse.up();
      await page.waitForFunction(
        () => document.querySelector('#land-status').textContent === 'Gespeichert',
      );
      await ready(page);
      await page.locator('[data-tool-group=water]').click();
      await page.locator('[data-atlas-tool=river]').click();
      await page.mouse.click(cb.x + cb.width * 0.4, cb.y + cb.height * 0.4);
      await openComparison(page);
      assert(
        await page.locator('#atlas-reference-panel').isHidden(),
        'pending drawing blocks comparison',
      );
      await canvas.press('Escape');
      await page.locator('[data-tool-group=land]').click();
      await page.locator('[data-atlas-tool=property]').click();
      await ready(page);
      await page.screenshot({ path: output + '/continuous-terrain-grid.png' });
      await page.locator('#atlas-output-open').click();
      await page.locator('#atlas-output summary').filter({ hasText: 'Bildoptionen' }).click();
      await page.locator('#atlas-export-grid').check();
      await page.locator('#atlas-export-size').fill('1024');
      await app.evaluate(({ dialog }, file) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      }, output + '/continuous-terrain-grid-export.png');
      await page.locator('#atlas-export-png').click();
      await page.waitForFunction(
        () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
        null,
        { timeout: 30000 },
      );
      const png = require('pngjs').PNG.sync.read(
        await readFile(output + '/continuous-terrain-grid-export.png'),
      );
      assert.equal(Math.max(png.width, png.height), 1024);
      assert(Math.min(png.width, png.height) > 100);
      results.referenceGridExport = true;
      await close();
      const fresh = new CampaignStore(file),
        after = fresh.db.prepare('SELECT id,payload FROM atlas_landscape ORDER BY id').all(),
        existing = new Set(before.map((r) => r.id));
      assert.deepEqual(
        after.filter((r) => existing.has(r.id)),
        before,
      );
      const rows = after.filter((r) => !existing.has(r.id)).map((r) => JSON.parse(r.payload));
      assert.equal(rows.length, 1);
      assert.equal(rows[0].propertyOnly, true);
      assert.deepEqual(rows[0].values, { terrain: 'forest' });
      assert.equal(rows[0].sourceCell, undefined);
      assert(
        rows[0].polygons[0].outer.length > 6,
        'Continuous brush retains its free-form footprint',
      );
      fresh.close();
      results.existingWorkPreservedAndContinuousStrokeSaved = true;
      page = await launch();
      await page.screenshot({ path: output + '/restart.png' });
      await close();
      assert.deepEqual(errors, []);
      results.restart = true;
      await native.recordResult({ complete: true, results, errors });
      console.log(JSON.stringify({ complete: true, output, results }));
    } catch (error) {
      if (app && !closed) {
        await (await app.firstWindow())
          .screenshot({ path: output + '/failure.png' })
          .catch(() => {});
      }
      throw error;
    } finally {
    }
  },
);
