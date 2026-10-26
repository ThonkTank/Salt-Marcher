// Mixed-scale consistency of the current canonical behavior; not a decision about fine-detail protection.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady, atlasCanvasPoint, atlasTerrainRendered } from './atlas-canvas-probe.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
const root = process.cwd(),
  require = createRequire(import.meta.url),
  zoom = Number(process.env.GM_QA_ZOOM ?? 1),
  mode = process.env.MIXED_MODE ?? 'lower';
assert(['lower', 'smooth'].includes(mode));
assert([1, 2].includes(zoom));
require('esbuild').buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas/terrain-height';",
    resolveDir: root,
  },
  outfile: '.build/terrain-scale-native.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, TerrainSampler } = require(root + '/.build/terrain-scale-native.cjs'),
  PNG = require('pngjs').PNG;
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? `.build/terrain-scale-${mode}-${zoom}`),
  native = await createNativeSession({ root, output, name: 'terrain-scale' });
const store = new CampaignStore(native.profile + '/workbench.sqlite');
const room = {
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
const cam = store.create('Maßstabsprobe', [room]),
  { token } = store.activate(cam.id),
  point = { x: -400, y: 0 },
  control = { x: 400, y: 0 };
const seed = (radius, targetM, p = point, strength = 10000, feather = 0) =>
  store.executeAtlasCommit({
    campaignId: cam.id,
    token,
    commandId: randomUUID(),
    action: {
      kind: 'landscape-height-stroke',
      stroke: {
        mode: 'raise',
        radius,
        strength,
        feather,
        ...(targetM === undefined ? {} : { targetM }),
        samples: [
          { ...p, t: 0 },
          { ...p, t: 1000 },
        ],
      },
    },
  });
seed(2048, 150, { x: 0, y: 0 });
if (mode === 'smooth') seed(512, undefined, point, 100, 1);
seed(128, 300);
seed(128, 300, control);
store.tutorial('skipped');
store.close();
const db = new (require('better-sqlite3'))(native.profile + '/workbench.sqlite', {
    readonly: true,
  }),
  records = () =>
    db
      .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id')
      .all(cam.id)
      .map((r) => JSON.parse(r.payload));
const hash = () =>
  createHash('sha256')
    .update(
      JSON.stringify(
        records()
          .filter((r) => r.height)
          .map((r) => [r.id, r.height.data]),
      ),
    )
    .digest('hex');
const heights = () => {
  const s = new TerrainSampler(records());
  return [s.query(point).heightM, s.query(control).heightM];
};
const revision = () =>
  db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(cam.id).revision;
let page;
async function open(reopen = false) {
  native.mark(reopen ? 'reopen' : 'open and prepare camera');
  page = await native.launch(zoom);
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Maßstabsprobe' })
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
  await page.waitForFunction(
    () => JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width < 200,
  );
  await atlasCanvasReady(page);
  await page.locator('#atlas-search').fill('');
  if (await page.locator('#atlas-secondary-close').isVisible())
    await page.locator('#atlas-secondary-close').click();
  await page.locator('#atlas-units').selectOption('metric');
  if (!(await page.locator('#atlas-section').isVisible())) {
    await page.locator('#atlas-view').click();
    await page.locator('#atlas-tools-toggle').click();
    await page.keyboard.press('Escape');
  }
  await page.locator('#atlas-section').selectOption('terrain');
  const width = () =>
    page.locator('#campaign-map').evaluate((n) => JSON.parse(n.dataset.atlasView).width);
  for (let i = 0; (await width()) < 2000; i++) {
    assert(i < 30);
    const w = await width();
    await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
    await page.waitForFunction(
      (w) => JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width > w,
      w,
    );
  }
  await page.locator('[data-tool-group="land"]').click();
  await page
    .locator(`[data-atlas-tool="${mode === 'smooth' ? 'land-smooth' : 'land-shape'}"]`)
    .click();
  await setBrushWorldRadius(page, 'land-radius', mode === 'smooth' ? 512 : 256);
  await page.locator('#land-height-strength').fill('10000');
  await page.locator('#land-height-feather').fill('0');
  if (mode === 'lower') {
    await setHeightDirection(page, 'lower');
    await page.locator('#land-height-target-enabled').check();
    await page.locator('#land-height-target').fill('-100');
  }
  if (zoom === 2) {
    await page.locator('#atlas-view').click();
    await page.locator('#atlas-tools-toggle').click();
    await page.keyboard.press('Escape');
  }
}
async function frame(name, preview = false) {
  if (!preview) native.mark('capture ' + name);
  const end = Date.now() + 90000;
  do {
    const stamp = preview ? null : await atlasTerrainRendered(page, revision());
    await native.capture(page, name);
    if (
      preview ||
      stamp === (await page.locator('#campaign-map').getAttribute('data-terrain-rendered'))
    )
      return PNG.sync.read(await readFile(output + '/' + name + '.png'));
  } while (Date.now() < end);
  throw Error('No stable rendered source for native capture');
}
let p, c, ratio, radius;
function difference(a, b, centre, inner = 0.2, outer = 0.6, reference) {
  let total = 0,
    changed = 0,
    sum = 0;
  for (let dy = -radius * outer; dy <= -radius * inner; dy++)
    for (let dx = -radius * outer; dx <= radius * outer; dx++) {
      const r = Math.hypot(dx, dy) / radius;
      if (r < inner || r > outer) continue;
      const x = Math.round(centre.x * ratio + dx),
        y = Math.round(centre.y * ratio + dy);
      assert(x >= 0 && y >= 0 && x < a.width && y < a.height);
      const i = (y * a.width + x) * 4,
        d = Math.max(
          ...[0, 1, 2].map((k) =>
            Math.abs(a.data[i + k] - (reference ? reference[k] : b.data[i + k])),
          ),
        );
      total++;
      changed += d >= 12;
      sum += d;
    }
  assert(total >= 20);
  return { total, changed, mean: sum / total, fraction: changed / total };
}
const result = { mode, zoom, checks: [], observations: {} };
try {
  await open();
  await atlasTerrainRendered(page, revision());
  p = await atlasCanvasPoint(page, point, false);
  c = await atlasCanvasPoint(page, control, false);
  assert.equal(p.target, 'campaign-map');
  await page.mouse.move(p.x, p.y);
  const before = await frame('before'),
    initial = heights(),
    initialHash = hash();
  ratio = before.width / (await page.evaluate(() => innerWidth));
  radius = (128 / p.unitsPerPixel) * ratio;
  native.mark('local mixed-scale preview');
  await page.mouse.down();
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainDraft === 'height',
  );
  let preview,
    previous,
    stable = 0;
  const end = Date.now() + 30000;
  do {
    preview = await frame('preview', true);
    stable = previous && difference(preview, previous, p).mean < 0.1 ? stable + 1 : 0;
    previous = preview;
  } while (stable < 3 && Date.now() < end);
  assert(stable >= 3, 'Bounded local preview reaches a stable target');
  assert.equal(hash(), initialHash, 'Visible draft precedes canonical storage');
  native.mark('canonical commit');
  await page.mouse.up();
  await page.waitForFunction(
    () => document.querySelector('#land-status').textContent === 'Gespeichert',
  );
  const committed = await frame('commit'),
    saved = heights(),
    savedHash = hash();
  assert.notEqual(savedHash, initialHash);
  assert.equal(saved[1], initial[1]);
  const previewDifference = difference(preview, committed, p),
    controlDifference = difference(before, preview, c),
    change = difference(before, committed, p);
  assert.equal(controlDifference.changed, 0);
  assert.equal(difference(before, committed, c).changed, 0);
  if (mode === 'lower') {
    assert(Math.abs(saved[0] - 50) < 0.01);
    // The broad fine plateau stays dry while the surrounding coarser annulus becomes water.

    // A sea reference outside the painted base is not necessarily onscreen; use the existing
    // outer annulus's committed water and require both phases to preserve the central land.
    const wx = Math.round(p.x * ratio),
      wy = Math.round(p.y * ratio - radius * 1.5),
      wi = (wy * committed.width + wx) * 4;
    assert(wy >= 0 && wy < committed.height);
    const water = [...committed.data.subarray(wi, wi + 3)];
    assert(
      difference(preview, committed, p, 0.2, 0.6, water).fraction > 0.95,
      'Preview retains the fine dry island',
    );
    assert(
      difference(committed, committed, p, 0.2, 0.6, water).fraction > 0.95,
      'Commit retains the fine dry island',
    );
    assert(
      difference(before, preview, p, 1.25, 1.65).fraction > 0.5,
      'Coarse annulus changes visibly before storage',
    );
    assert(
      difference(preview, committed, p, 1.25, 1.65).mean < 4,
      'Preview/commit water annulus agrees',
    );
  } else {
    assert(saved[0] < initial[0]);
    assert(
      difference(before, preview, p, 0.3, 1.8).mean > 0.1,
      'Smoothing changes visible terrain',
    );
  }
  assert(
    previewDifference.mean < 8,
    'Interior preview and commit agree within display interpolation',
  );
  result.observations = {
    initial,
    saved,
    previewDifference,
    controlDifference,
    committedChange: change,
  };
  for (const [action, expectedHash, reference] of [
    ['undo', initialHash, before],
    ['redo', savedHash, committed],
  ]) {
    const prior = revision();
    await page.locator('#atlas-' + action).click();
    await page.waitForFunction(
      (r) => Number(document.querySelector('#campaign-map').dataset.atlasRegionRevision) > r,
      prior,
    );
    assert.equal(hash(), expectedHash);
    await page.mouse.move(p.x, p.y);
    const restored = await frame(action),
      diff = difference(reference, restored, p);
    result.observations[action] = diff;
    assert(
      diff.mean < 4,
      'Rendered ' + action + ' restores terrain at the same revision and detail level',
    );
  }
  await native.close();
  await open(true);
  await page.mouse.move(p.x, p.y);
  const reopened = await frame('reopened');
  result.observations.reopened = difference(committed, reopened, p);
  assert(
    result.observations.reopened.mean < 4,
    'Fresh native process restores the same rendered terrain',
  );
  assert.deepEqual(heights(), saved);
  assert.equal(hash(), savedHash);
  await native.close();
  result.checks.push(
    'Mixed-scale local preview before write, canonical commit, untouched control, single undo/redo, fresh native process',
  );
  await native.finish({ complete: true, ...result });
  console.log(JSON.stringify(result));
} catch (e) {
  await native.fail(e);
  throw e;
} finally {
  db.close();
  await native.dispose();
}
