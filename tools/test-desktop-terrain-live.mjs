// Direct strokes on the ordinary Atlas surface; isolated profile and bounded native lifecycle.
import { createNativeSession } from './native-session.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { buildSync } = require('esbuild');
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas/terrain-height';export {bounds} from './src/app/atlas/atlas-landscape';",
    resolveDir: root,
  },
  outfile: '.build/terrain-live-interactions-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const worldProbe = process.env.TERRAIN_WORLD_PROBE === '1',
  worldEdge = 2 ** 21,
  coveredProbe = process.env.TERRAIN_COVERED_PROBE === '1';
const { CampaignStore, heightRecord, bounds } = require(
  root + '/.build/terrain-live-interactions-store.cjs',
);
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/terrain-live-interactions');
const native = await createNativeSession({ root, output: out, name: 'atlas-live' }),
  dir = native.profile;
const store = new CampaignStore(dir + '/workbench.sqlite'),
  campaign = store.create('R7 Ausgabe'),
  token = store.activate(campaign.id).token;
store.tutorial('skipped');
if (worldProbe) {
  const templates = Array.from({ length: 7 }, (_, i) =>
      heightRecord(0, 0, 512, new Float32Array(4096).fill(100 + i * 5)),
    ),
    put = store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
  store.db.transaction(() => {
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const px = x * 32768,
          py = y * 32768,
          template = templates[x % 7],
          record = {
            ...template,
            id: `height:9:${x}:${y}`,
            height: { ...template.height, x: px, y: py },
            polygons: [
              {
                outer: [
                  { x: px - 512, y: py - 512 },
                  { x: px + 32768, y: py - 512 },
                  { x: px + 32768, y: py + 32768 },
                  { x: px - 512, y: py + 32768 },
                ],
                holes: [],
              },
            ],
          };
        const b = bounds(record);
        put.run(
          campaign.id,
          record.id,
          1,
          b.x,
          b.x + b.width,
          b.y,
          b.y + b.height,
          JSON.stringify(record),
        );
      }
  })();
} else
  for (let y = coveredProbe ? -2 : -1; y <= (coveredProbe ? 1 : 0); y++)
    for (let x = coveredProbe ? -2 : -1; x <= (coveredProbe ? 1 : 0); x++)
      store.executeAtlasCommit({
        campaignId: campaign.id,
        token,
        commandId: randomUUID(),
        action: {
          kind: 'landscape-put',
          expectedRevision: null,
          record: heightRecord(
            x * 1024,
            y * 1024,
            16,
            Float32Array.from({ length: 4096 }, (_, i) => {
              const px = x * 1024 + (i % 64) * 16,
                py = y * 1024 + Math.floor(i / 64) * 16;
              return (
                20 +
                120 * Math.exp(-((px - 150) ** 2 + py ** 2) / 40000) +
                100 * Math.exp(-((px + 150) ** 2 + (py + 100) ** 2) / 25000)
              );
            }),
          ),
        },
      });
store.close();
const result = {
  worldProbe,
  coveredProbe,
  profile: dir,
  totalMemoryGiB: totalmem() / 2 ** 30,
  checks: [],
  errors: [],
  sourceHashes: {},
};
const files = [
  'src/app/atlas/landscape-tool-settings.ts',
  'src/app/atlas/terrain-grid-layout.ts',
  'src/app/atlas/terrain-contour-style.ts',
  'src/app/storage/terrain-scale.ts',
  'src/app/storage/terrain-invalidation.ts',
  'src/app/atlas/terrain-brush.ts',
  'src/app/atlas/terrain-color-visibility.ts',
  'src/app/atlas/landscape-brush.ts',
  'src/app/atlas/terrain-analysis-ui.ts',
  'src/app/atlas/terrain-profile.ts',
  'src/app/atlas/terrain-spatial-model.ts',
  'src/app/storage/terrain-author-cache.ts',
  'src/app/storage/terrain-route.ts',
  'src/app/atlas/terrain-frame.ts',
  'src/app/atlas/terrain-detail.ts',
  'src/app/atlas/terrain-cache.ts',
  'src/app/atlas/terrain-projection-cache.ts',
  'src/app/atlas/terrain-presentation.ts',
  'src/app/storage/atlas-landscape-region.ts',
  'src/app/storage/atlas-region.ts',
  'desktop/main.ts',
  'src/app/atlas/terrain-timing.ts',
  'desktop/atlas-region-worker.ts',
  'src/app/atlas/terrain-live-stroke.ts',
  'src/app/atlas/atlas-landscape-ui.ts',
  'src/app/atlas/campaign-atlas-contracts.ts',
  'src/app/storage/store.ts',
  'src/app/storage/campaign-atlas.ts',
  'src/app/atlas/terrain-projection.ts',
  'src/app/storage/terrain-projection.ts',
  'src/app/storage/terrain-grid.ts',
  'src/app/storage/landscape-brush-edit.ts',
  'src/app/storage/atlas-landscape.ts',
  'desktop/atlas-region.ts',
  'desktop/preload.ts',
  'src/app/atlas/terrain-field-stream.ts',
  'src/app/atlas/terrain-height.ts',
  'src/app/atlas/terrain-route.ts',
  'src/app/atlas/landscape-raster.ts',
  'src/app/storage/atlas-landscape-region.ts',
  '.build/desktop/atlas-region-worker.cjs',
  'src/app/atlas/campaign-atlas-ui.ts',
  'src/app/atlas/campaign-atlas-export.ts',
  'src/app/storage/atlas-knowledge.ts',
  'src/app/storage/player.ts',
  'src/app/runtime/player-contracts.ts',
  '.build/desktop/main.cjs',
  '.build/desktop/ui/renderer.js',
  'tools/test-desktop-terrain-live.mjs',
];
for (const file of files)
  result.sourceHashes[file] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
const mark = (text) => {
  result.checks.push(text);
  console.log(text);
};
let app, page;

const db = new (require('better-sqlite3'))(dir + '/workbench.sqlite', { readonly: true });
const rows = () =>
  db
    .prepare('SELECT payload FROM atlas_landscape ORDER BY id')
    .all()
    .map((r) => JSON.parse(r.payload));
const heights = () =>
  createHash('sha256')
    .update(
      JSON.stringify(
        rows()
          .filter((r) => r.height)
          .map((r) => [r.id, r.height]),
      ),
    )
    .digest('hex');
const state = () =>
  db.prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?').get(campaign.id);
const wait = async (f) => {
  const end = Date.now() + 45000;
  while (!f()) {
    if (Date.now() > end) throw Error('Direct gesture did not advance');
    await new Promise((r) => setTimeout(r, 50));
  }
};
async function settled() {
  await page.waitForFunction(() => !document.querySelector('#land-tool').disabled, null, {
    timeout: 60000,
  });
  await atlasCanvasReady(page);
}
async function tool(name) {
  await settled();
  await page
    .locator('[data-tool-select="land-tool"][data-tool-value="' + name + '"]')
    .first()
    .click();
  await setBrushWorldRadius(page, 'land-radius', 48);
  assert.equal(
    await page.locator('#campaign-map').getAttribute('data-terrain-ready'),
    'ready',
    'tool switch must retain the ready surface',
  );
}
async function down() {
  assert.equal(
    await page.locator('#campaign-map').getAttribute('data-terrain-ready'),
    'ready',
    'pointerdown must not need a terrain reload',
  );
  const b = await page.locator('#campaign-map').boundingBox();
  const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  return p;
}
async function measureProfile() {
  const revision = state().revision;
  await page.locator('#atlas-view').click();
  await page.locator('#atlas-height-profile').click();
  const b = await page.locator('#campaign-map').boundingBox();
  await page.mouse.click(b.x + b.width * 0.4, b.y + b.height * 0.5);
  await page.mouse.click(b.x + b.width * 0.6, b.y + b.height * 0.5);
  await page.locator('#terrain-profile-dialog').waitFor({ state: 'visible' });
  assert.match(
    await page.locator('#terrain-profile-summary').textContent(),
    /m Strecke.*m Aufstieg/,
  );
  assert.equal(state().revision, revision, 'measuring terrain must not create brush commands');
  await page
    .locator('#terrain-profile-dialog')
    .getByRole('button', { name: 'Schließen', exact: true })
    .click();
}
async function undo(expected) {
  const previous = state().revision;
  await page.locator('#atlas-undo').click();
  await wait(() => state().revision > previous);
  await settled();
  assert.equal(heights(), expected);
}
try {
  page = await native.launch();
  app = native.app;
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1920, 1080),
  );
  await app.evaluate(() => {
    const { Worker } = process.getBuiltinModule('node:worker_threads');
    global.__terrainJobs = [];
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (job, ...args) {
      if (job?.kind) global.__terrainJobs.push({ kind: job.kind, revision: job.source?.revision });
      return post.call(this, job, ...args);
    };
  });
  page = await app.firstWindow();
  page.on('pageerror', (e) => result.errors.push(e.stack ?? e.message));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page.evaluate(
    ({ id, box }) => localStorage.setItem('atlas-camera:' + id, JSON.stringify(box)),
    {
      id: campaign.id,
      box: worldProbe
        ? { x: 0, y: worldEdge / 4, width: worldEdge, height: worldEdge / 2 }
        : { x: -400, y: -300, width: 800, height: 600 },
    },
  );
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'R7 Ausgabe' })
    .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
    null,
    { timeout: worldProbe ? 90000 : 30000 },
  );
  if (await page.locator('#campaign-atlas').isHidden()) {
    if (!(await page.locator('#atlas-tab').isVisible()))
      await page.locator('#workspace-nav-summary').click();
    await page.locator('#atlas-tab').click();
  }
  await atlasCanvasReady(page);
  assert.equal(await page.locator('#campaign-map').getAttribute('data-renderer'), 'webgl');
  const surface = await page.locator('#atlas-terrain-spatial').elementHandle();
  await page.locator('#atlas-section').selectOption('terrain');
  await atlasCanvasReady(page);

  await page.locator('#atlas-units').selectOption('metric');
  await page.locator('[data-tool-group="land"]').click();
  const initial = heights();
  await tool('height');
  await page.locator('#land-height-strength').fill('120');
  await page.locator('#land-height-target-enabled').check();
  await page.locator('#land-height-target').fill('200');
  const jobs = () =>
    app.evaluate(() => global.__terrainJobs.filter((j) => j.kind === 'region').length);
  const fullBefore = await jobs(),
    displayBefore = await page.locator('#campaign-map').getAttribute('data-terrain-revision');
  let start = state();
  await down();
  await wait(() => state().revision >= start.revision + 2);
  assert.notEqual(heights(), initial);
  assert.equal(state().cursor, start.cursor + 1);
  assert.equal(await page.locator('#land-finish').isVisible(), false);
  // The direct draft retains its loaded ground until release; confirmed writes
  // advance independently and must not relabel that frozen presentation.
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainDraft === 'height',
  );
  assert.equal(
    await page.locator('#campaign-map').getAttribute('data-terrain-revision'),
    displayBefore,
  );
  assert.equal(await jobs(), fullBefore, 'held sculpt must not request the complete Atlas');
  assert.equal(
    await page.locator('#campaign-map').getAttribute('data-atlas-region-revision'),
    String(start.revision),
    'old Atlas region retains its own revision',
  );
  await page.screenshot({ path: out + '/01-direct-top.png' });
  await page.mouse.up();
  await settled();
  assert.equal(
    await page.locator('#campaign-map').getAttribute('data-terrain-draft'),
    null,
    'release restores confirmed terrain',
  );
  assert.equal(
    Number(await page.locator('#campaign-map').getAttribute('data-terrain-revision')),
    state().revision,
    'released terrain shows the final committed revision',
  );
  assert.equal(await jobs(), fullBefore + 1, 'release synchronizes the Atlas once');
  await undo(initial);
  mark(
    'Top-down sculpt persists before release, has no confirmation controls and undoes in one step',
  );
  await measureProfile();
  mark('Main Atlas profile intercepts the active brush and measures without writing');
  // Finish pre-existing refinement before counting reads caused only by settings.
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
    null,
    { timeout: 60000 },
  );
  const projectionReads = () =>
    app.evaluate(() => global.__terrainJobs.filter((j) => j.kind === 'terrain').length);
  const readsBefore = await projectionReads();
  await page.evaluate(() => {
    const map = document.querySelector('#campaign-map');
    globalThis.__brushReadyChanges = [];
    globalThis.__brushReadyObserver = new MutationObserver((records) =>
      globalThis.__brushReadyChanges.push(
        ...records.map((r) => ({ from: r.oldValue, to: map.dataset.terrainReady })),
      ),
    );
    globalThis.__brushReadyObserver.observe(map, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['data-terrain-ready'],
    });
  });
  await tool('smooth');
  await setBrushWorldRadius(page, 'land-radius', 96);
  assert.equal(
    await page.locator('#campaign-map').getAttribute('data-terrain-ready'),
    'ready',
    'Smooth radius change must retain the ready surface',
  );
  await page.locator('#land-height-strength').fill('40');
  const readyChanges = await page.evaluate(() => {
    const observer = globalThis.__brushReadyObserver;
    const map = document.querySelector('#campaign-map');
    globalThis.__brushReadyChanges.push(
      ...observer.takeRecords().map((r) => ({ from: r.oldValue, to: map.dataset.terrainReady })),
    );
    observer.disconnect();
    return globalThis.__brushReadyChanges;
  });
  const readsAfter = await projectionReads();
  result.smoothSettings = { readsBefore, readsAfter, readyChanges };
  assert.equal(
    readsAfter,
    readsBefore,
    'Smooth settings must not issue another terrain projection',
  );
  assert(
    readyChanges.every((c) => c.from === 'ready' && c.to === 'ready'),
    'Smooth settings must never suspend input',
  );
  start = state();
  await down();
  await wait(() => state().revision >= start.revision + 2);
  await page.mouse.up();
  await settled();
  assert.notEqual(heights(), initial);
  assert.equal(state().cursor, start.cursor + 1);
  await undo(initial);
  mark('Smoothing updates directly and one Undo restores the prior terrain');
  await tool('color');
  await page.locator('#land-paint-opacity').evaluate((el) => {
    el.value = '0.5';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  start = state();
  const p = await down();
  await wait(() => state().revision > start.revision);
  await page.mouse.move(p.x + 90, p.y, { steps: 5 });
  await wait(() => state().revision >= start.revision + 2);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await settled();
  const color = rows().filter((r) => r.paint);
  assert.equal(color.length, 1);
  assert.equal(color[0].paint.opacity, 0.5);
  assert(color[0].points.length >= 2);
  assert.equal(heights(), initial);
  assert.equal(state().cursor, start.cursor + 1);
  await page.screenshot({ path: out + '/02-color-stopped.png' });
  await undo(initial);
  assert.equal(rows().filter((r) => r.paint).length, 0);
  mark(
    'Cumulative color keeps one half-opacity layer; Escape stops input and Undo removes the committed gesture',
  );
  await tool('height');
  await page.locator('#land-height-target-enabled').uncheck();
  start = state();
  await down();
  await wait(() => state().revision > start.revision);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  await settled();
  assert.notEqual(heights(), initial);
  assert.equal(state().cursor, start.cursor + 1);
  await undo(initial);
  mark('Blur finishes the saved prefix without leaving an uncommitted terrain draft');
  if (coveredProbe) {
    await tool('height');
    await setBrushWorldRadius(page, 'land-radius', 1024);
    await page.locator('#land-height-strength').fill('100');
    start = state();
    const beforeLarge = heights(),
      legacy = rows().filter((r) => r.height?.version === 1);
    await down();
    await wait(() => state().revision >= start.revision + 2);
    await page.mouse.up();
    await settled();
    assert.notEqual(heights(), beforeLarge);
    assert.deepEqual(
      rows().filter((r) => r.height?.version === 1),
      legacy,
    );
    assert.equal(state().cursor, start.cursor + 1);
    await page.screenshot({ path: out + '/03-coarse-brush.png' });
    await undo(beforeLarge);
    mark('Coarse sculpt moves fine terrain with unchanged legacy tiles and one Undo');
  }
  await settled();
  await page.locator('#atlas-view').click();
  await page.locator('#atlas-terrain-tilt').click();
  await page.locator('#atlas-search').click();
  await atlasCanvasReady(page);
  assert(await surface.evaluate((n) => n === document.querySelector('#atlas-terrain-spatial')));
  assert.equal(await page.locator('#vegetation-spatial').count(), 0);
  await tool('height');
  await setHeightDirection(page, 'roughen');
  await page.locator('#land-height-strength').fill('80');
  assert.equal(await page.locator('#land-height-target-enabled').isVisible(), false);
  start = state();
  await down();
  await wait(() => state().revision >= start.revision + 2);
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainDraft === 'height',
  );
  await native.capture(page, '04-tilted-live');
  await page.mouse.up();
  await settled();
  const saved = heights();
  assert.notEqual(saved, initial);
  let minimum = 0,
    maximum = 0,
    count = 0;
  for (const r of rows().filter((r) => r.height?.version === 2)) {
    const b = Buffer.from(r.height.data, 'base64');
    for (let i = 0; i < b.length; i += 4) {
      const value = b.readFloatLE(i);
      if (Number.isFinite(value)) {
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
        count++;
      }
    }
  }
  result.roughen = { minimumDeltaM: minimum, maximumDeltaM: maximum, nodes: count };
  assert(minimum < -1 && maximum > 1, 'Roughen must author both peaks and hollows');
  assert.equal(state().cursor, start.cursor + 1);
  await undo(initial);
  const undoRevision = state().revision;
  await page.locator('#atlas-redo').click();
  await wait(() => state().revision > undoRevision);
  await settled();
  assert.equal(heights(), saved);
  mark(
    'Aufrauen creates peaks and hollows through the main tilted camera, with one-step Undo/Redo',
  );
  await measureProfile();
  await native.close();
  page = await native.launch();
  app = native.app;
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'R7 Ausgabe' })
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
  assert.equal(await page.locator('#campaign-map').getAttribute('data-renderer'), 'webgl');
  assert.equal(heights(), saved);
  await undo(initial);
  mark(
    'Main-camera tilted roughen persists across a fresh process and one Undo restores the pre-gesture terrain',
  );
  assert.deepEqual(result.errors, []);
  await native.close();
  result.ok = true;
  await native.finish(result);
} catch (error) {
  if (page)
    result.state = await page
      .evaluate(() => ({
        status: document.querySelector('#atlas-save-status')?.textContent,
        land: document.querySelector('#land-status')?.textContent,
        canvas: document.querySelector('#campaign-map')?.dataset,
      }))
      .catch(() => null);
  await writeFile(out + '/state.json', JSON.stringify(result, null, 2));
  await native.fail(error);
  throw error;
} finally {
  db.close();
  await native.dispose();
}
