// Actual app entry and fresh-process reopening of a retained synthetic full world.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { waitForAtlasProjection } from './atlas-projection-probe.mjs';
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3'),
  input = process.env.ATLAS_MIXED_SOURCE;
assert(input, 'Set ATLAS_MIXED_SOURCE to a retained synthetic full world');
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-cache-reopen'),
  native = await createNativeSession({ output, name: 'atlas-cache-reopen' }),
  source = new Database(input, { readonly: true });
function canonical(db) {
  const hash = createHash('sha256');
  for (const table of ['atlas_landscape', 'room', 'drawing_element', 'atlas_territory'])
    for (const row of db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').iterate())
      hash.update(JSON.stringify(row));
  return {
    sha256: hash.digest('hex'),
    atlas: db.prepare('SELECT campaign_id,revision FROM campaign_atlas').get(),
  };
}
const canonicalBefore = canonical(source);
const id = source.prepare('SELECT id FROM campaign').get().id;
await source.backup(native.profile + '/workbench.sqlite');
source.close();
const runs = [];
try {
  for (const label of ['cold', 'reopened']) {
    const page = await native.launch();
    page.setDefaultTimeout(90000);
    await native.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1440, 900),
    );
    await page.evaluate(
      (id) =>
        localStorage.setItem(
          'atlas-camera:' + id,
          JSON.stringify({ x: -20000000, y: -12500000, width: 40000000, height: 25000000 }),
        ),
      id,
    );
    const start = performance.now();
    await page
      .locator('.campaign-card')
      .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
      .click();
    await page.waitForFunction(
      () =>
        document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
      null,
      { timeout: 90000 },
    );
    await page.waitForFunction(
      () => document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
      null,
      { timeout: 90000 },
    );
    const firstTerrainMs = performance.now() - start,
      state = await page.locator('#campaign-map').evaluate((n) => ({
        view: n.dataset.atlasView,
        revision: n.dataset.terrainRevision,
        quality: n.dataset.terrainQuality,
      }));
    const firstRegionState = await page
      .locator('#campaign-atlas')
      .getAttribute('data-region-state');
    await atlasCanvasReady(page);
    const regionReadyMs = performance.now() - start;
    let firstDetailMs, detailReadyMs, detailState;
    if (process.env.ATLAS_WAIT_DETAIL === '1') {
      // Observation after the object-region wait: an upper bound, not a GPU
      // first-pixel timestamp (a detail tile may already have arrived).
      await page.waitForFunction(
        () =>
          Number(
            (document.querySelector('#campaign-map').dataset.terrainTiles ?? '').split('/')[0],
          ) > 0,
        null,
        { timeout: 90000 },
      );
      firstDetailMs = performance.now() - start;
      await page.waitForFunction(
        () => {
          const m = document.querySelector('#campaign-map'),
            [done, total] = (m.dataset.terrainTiles ?? '').split('/').map(Number);
          return m.dataset.terrainQuality === 'detail' && done > 0 && done === total;
        },
        null,
        { timeout: 90000 },
      );
      detailReadyMs = performance.now() - start;
      detailState = await page
        .locator('#campaign-map')
        .evaluate((m) => ({ quality: m.dataset.terrainQuality, tiles: m.dataset.terrainTiles }));
    }
    await native.capture(page, label);
    const projection = await waitForAtlasProjection(native.profile + '/atlas-region-cache');
    await native.close();
    const run = {
      label,
      firstTerrainMs,
      regionReadyMs,
      firstRegionState,
      state,
      projection,
      ...(detailState ? { firstDetailMs, detailReadyMs, detailState } : {}),
    };
    runs.push(run);
    console.log(JSON.stringify(run));
  }
  assert.deepEqual(
    runs[1].projection,
    runs[0].projection,
    'unchanged restart must reuse the same published projection bytes and source stamps',
  );
  assert.deepEqual(runs[1].state, runs[0].state);
  const check = new Database(native.profile + '/workbench.sqlite', { readonly: true });
  let canonicalAfter;
  try {
    canonicalAfter = canonical(check);
  } finally {
    check.close();
  }
  assert.deepEqual(canonicalAfter, canonicalBefore);
  await native.finish({ runs, canonicalBefore, canonicalAfter });
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
