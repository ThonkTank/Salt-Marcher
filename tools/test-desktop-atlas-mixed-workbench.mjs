import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import {
  assertReferenceContents,
  assertReferenceInventory,
  referenceContents,
  assertReferenceMapImage,
} from './atlas-reference-fixture.mjs';
const root = process.cwd(),
  require = createRequire(import.meta.url),
  Database = require('better-sqlite3'),
  { PNG } = require('pngjs');
const imageManifest = JSON.parse(
  await readFile(root + '/tests/fixtures/atlas/reference-images/manifest.json', 'utf8'),
);
const manifest = JSON.parse(
  await readFile(root + '/tests/fixtures/atlas/mixed-world-manifest.json', 'utf8'),
);
const refresh = process.argv.includes('--refresh-reference');
const referenceDirectory = root + '/tests/fixtures/atlas/reference-images';
if (!refresh) {
  assert.equal(imageManifest.model, manifest.model);
  assert.equal(imageManifest.fixtureSha256, manifest.fixtureSha256);
}
const requestedZoom = process.env.GM_QA_ZOOM ? Number(process.env.GM_QA_ZOOM) : null;
assert(requestedZoom === null || [1, 2].includes(requestedZoom), 'GM_QA_ZOOM must be1 or2');
for (const zoom of refresh ? [1] : requestedZoom === null ? [2, 1] : [requestedZoom]) {
  const output =
    (process.env.QA_EVIDENCE_DIR ?? root + '/.build/atlas-mixed-workbench') + '/' + zoom;
  const native = await createNativeSession({ root, output, name: 'atlas-mixed-workbench' }),
    results = [],
    errors = [];
  let db;
  try {
    await writeFile(
      native.profile + '/workbench.sqlite',
      gunzipSync(await readFile(root + '/tests/fixtures/atlas/mixed-world.sqlite.gz')),
      { flag: 'wx' },
    );
    db = new Database(native.profile + '/workbench.sqlite', { readonly: true });
    assertReferenceContents(db, manifest);
    const campaign = db.prepare('SELECT id,name FROM campaign LIMIT 1').get();
    const initialSettings = db.prepare('SELECT * FROM settings ORDER BY key').all();
    const initialUsage = db.prepare('SELECT * FROM campaign_usage').get();
    const revision = () =>
        db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(campaign.id)
          .revision,
      before = revision();
    const open = async () => {
      const page = await native.launch(zoom);
      page.on('pageerror', (e) => errors.push(String(e)));
      const sizeWindow = () =>
        native.app.evaluate(
          ({ BrowserWindow }, { zoom }) => {
            const window = BrowserWindow.getAllWindows()[0],
              outer = window.getSize(),
              content = window.getContentSize();
            window.setFullScreen(false);
            window.unmaximize();
            window.setMinimumSize(
              1280 * zoom + outer[0] - content[0],
              852 * zoom + outer[1] - content[1],
            );
            window.setMaximumSize(
              1280 * zoom + outer[0] - content[0],
              852 * zoom + outer[1] - content[1],
            );
            window.setContentSize(1280 * zoom, 852 * zoom);
          },
          { zoom },
        );
      await sizeWindow();
      assert.deepEqual(
        await native.app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].getContentSize(),
        ),
        [1280 * zoom, 852 * zoom],
        'Actual native content dimensions',
      );
      await page.waitForFunction(() => innerWidth === 1280 && innerHeight === 852);
      await page.evaluate(
        (id) =>
          localStorage.setItem(
            'atlas-camera:' + id,
            JSON.stringify({ x: 30 - 16384, y: 30 - 16384, width: 32768, height: 32768 }),
          ),
        campaign.id,
      );
      await page
        .locator('.campaign-card')
        .filter({ hasText: campaign.name })
        .getByRole('button', { name: /Öffnen|Fortsetzen/ })
        .click();
      await atlasCanvasReady(page);
      await sizeWindow();
      console.log(
        'Native window sizing',
        await native.app.evaluate(({ BrowserWindow }) => {
          const window = BrowserWindow.getAllWindows()[0];
          return {
            bounds: window.getBounds(),
            content: window.getContentSize(),
            minimum: window.getMinimumSize(),
            maximum: window.getMaximumSize(),
            zoom: window.webContents.getZoomFactor(),
            maximized: window.isMaximized(),
          };
        }),
      );
      await page.waitForFunction(() => innerWidth === 1280 && innerHeight === 852);
      console.log('Actual native image viewport', {
        zoom,
        ...(await page.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
          ratio: devicePixelRatio,
          canvas: document.querySelector('#campaign-map').getBoundingClientRect().toJSON(),
        }))),
      });
      return page;
    };
    let page = await open();
    async function checkImage(target, name) {
      const expected =
        refresh && name === 'reopened'
          ? PNG.sync.read(await readFile(output + '/width-' + target + '.png'))
          : PNG.sync.read(await readFile(referenceDirectory + `/width-${target}.png`));
      const view = imageManifest.views.find((v) => v.target === target).view;
      // Ort 2550 is at (0,0). At room-scale views it is offscreen; similar
      // brown roof pixels are not evidence of a missing place marker.
      const markerVisible =
        view.x <= 0 && view.x + view.width >= 0 && view.y <= 0 && view.y + view.height >= 0;
      let comparison, lastError;
      for (let attempt = 0; attempt < 20; attempt++) {
        await native.capture(page, name);
        try {
          const actual = PNG.sync.read(await readFile(output + '/' + name + '.png'));
          comparison = assertReferenceMapImage(
            actual,
            refresh && name !== 'reopened' ? actual : expected,
            { markerVisible },
          );
          if (refresh && target === 32768) {
            for (const [key, minimum] of Object.entries({
              land: 1000,
              forest: 100,
              forestTexture: 100,
              road: 100,
              marker: 4,
            }))
              assert(
                comparison.populations[key].actual >= minimum,
                `Continuous baseline lacks visible ${key}`,
              );
          }
          break;
        } catch (error) {
          lastError = error;
          await page.waitForTimeout(100);
        }
      }
      assert(comparison, lastError?.message);
      return comparison;
    }
    for (const { target, view: expectedView } of imageManifest.views) {
      for (let n = 0; n < 70; n++) {
        const view = JSON.parse(
          await page.locator('#campaign-map').getAttribute('data-atlas-view'),
        );
        if (view.width <= expectedView.width * (1 + 1e-7)) break;
        const nextWidth = view.width / 1.4;
        await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
        await page.waitForFunction(
          (width) =>
            Math.abs(
              JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width - width,
            ) <
            width * 1e-7,
          nextWidth,
        );
        native.mark('zoom publication ' + nextWidth);
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        await atlasCanvasReady(page);
        await page.waitForFunction(
          () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
          null,
          { timeout: 120000 },
        );
      }
      await atlasCanvasReady(page);
      await page.waitForFunction(
        () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
        null,
        { timeout: 120000 },
      );
      const view = JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view'));
      for (const key of ['x', 'y', 'width', 'height'])
        assert(
          Math.abs(view[key] - expectedView[key]) < expectedView.width * 1e-6,
          `Baseline camera mismatch: ${key}`,
        );
      assert.equal(await page.locator('#campaign-map').getAttribute('data-renderer'), 'deck');
      const visual = await checkImage(target, 'width-' + target);
      assert.equal(revision(), before);
      results.push({ target, view, visual });
      console.log('Mixed Workbench scale', target, 'zoom', zoom, visual);
    }
    await native.close();
    page = await open();
    await page.waitForFunction(
      () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
      null,
      { timeout: 120000 },
    );
    const reopened = await checkImage(32768, 'reopened');
    // Export the same overview and reject a water-only output independently of UI.
    await page.locator('#atlas-output-open').click();
    await page.locator('#atlas-output details summary').click();
    await page.locator('#atlas-export-size').fill('512');
    const file = native.profile + '/overview.png';
    await native.app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, file);
    await page.locator('#atlas-export-png').click();
    await page.waitForFunction(
      () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
      null,
      { timeout: 120000 },
    );
    const png = PNG.sync.read(await readFile(file));
    let land = 0;
    for (let i = 0; i < png.data.length; i += 4) if (png.data[i] > png.data[i + 2] + 15) land++;
    assert(land > png.width * png.height * 0.2, 'Export lost its land surface');
    await writeFile(output + '/overview-export.png', await readFile(file));
    await page.locator('#atlas-output-back').click();
    await atlasCanvasReady(page);
    assert.equal(revision(), before);
    assertReferenceInventory(db);
    // Opening a campaign records normal catalog receipts, last-open time and the
    // current app's tutorial setting. Every other stored table remains identical.
    const actual = referenceContents(db);
    for (const [table, expected] of Object.entries(manifest.tables))
      if (!['campaign_catalog_receipt', 'campaign_usage', 'settings'].includes(table))
        assert.deepEqual(actual[table], expected, table);
    const usage = db.prepare('SELECT * FROM campaign_usage').all();
    assert.equal(usage.length, 1);
    assert.equal(usage[0].campaign_id, initialUsage.campaign_id);
    assert.equal(usage[0].created_at, initialUsage.created_at);
    assert(Number.isFinite(Date.parse(usage[0].last_opened_at)));
    const receipts = db.prepare('SELECT payload FROM campaign_catalog_receipt').all();
    assert.equal(receipts.length, 2);
    for (const row of receipts) {
      const receipt = JSON.parse(row.payload);
      assert.equal(receipt.kind, 'open');
      assert.equal(receipt.campaignId, campaign.id);
    }
    const settings = db.prepare('SELECT * FROM settings ORDER BY key').all();
    for (const original of initialSettings)
      assert.deepEqual(
        settings.find((s) => s.key === original.key),
        original,
      );
    const { version } = JSON.parse(await readFile(root + '/package.json', 'utf8'));
    for (const added of settings.filter((s) => !initialSettings.some((old) => old.key === s.key)))
      assert.equal(added.key, 'tutorial:app:' + version);
    assert.deepEqual(errors, []);
    await native.close();
    await native.finish({
      referenceRefresh: refresh,
      zoom,
      results,
      reopened,
      export: { width: png.width, height: png.height, landPixels: land },
      canonicalRevision: before,
    });
    if (refresh) {
      const evidence = JSON.parse(await readFile(output + '/result.json', 'utf8'));
      for (const item of imageManifest.views) {
        const name = '/width-' + item.target + '.png';
        await copyFile(output + name, referenceDirectory + name);
        item.imageSha256 = createHash('sha256')
          .update(await readFile(output + name))
          .digest('hex');
      }
      await writeFile(
        referenceDirectory + '/manifest.json',
        JSON.stringify(
          {
            ...imageManifest,
            sourceCommit: manifest.sourceCommit,
            model: manifest.model,
            fixtureSha256: manifest.fixtureSha256,
            rendererSource: evidence.source,
            rendererDirty: evidence.dirty,
            artifacts: evidence.artifacts,
            refreshedAt: new Date().toISOString(),
          },
          null,
          2,
        ) + '\n',
      );
    }
  } catch (e) {
    await native.fail(e);
    throw e;
  } finally {
    db?.close();
    await native.dispose();
  }
}
