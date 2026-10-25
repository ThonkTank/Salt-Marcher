// Dense landscape aggregates must remain visible on the ordinary tilted Atlas.
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-dense-landscape');
require('esbuild').buildSync({
  stdin: {
    resolveDir: root,
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-spatial-model';",
  },
  outfile: '.build/atlas-dense-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, heightRecord, projectTerrain } = require(
    root + '/.build/atlas-dense-store.cjs',
  ),
  native = await createNativeSession({ root, output: out, name: 'atlas-dense-landscape' });
const store = new CampaignStore(native.profile + '/workbench.sqlite'),
  campaign = store.create('Dichte Landschaft'),
  token = store.activate(campaign.id).token;
for (let y = -1; y <= 0; y++)
  for (let x = -1; x <= 0; x++)
    store.executeAtlasCommit({
      campaignId: campaign.id,
      token,
      commandId: randomUUID(),
      action: {
        kind: 'landscape-put',
        expectedRevision: null,
        record: heightRecord(x * 1024, y * 1024, 16, new Float32Array(4096).fill(100)),
      },
    });
const put = store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
store.db.transaction(() => {
  for (let i = 0; i < 601; i++) {
    const road = {
      id: 'road' + i,
      revision: 0,
      kind: 'road',
      name: 'Weg ' + i,
      points: [
        { x: -200, y: 0 },
        { x: 200, y: 0 },
      ],
      polygons: [],
      resolution: 1,
      width: 24,
      values: {},
    };
    put.run(campaign.id, road.id, 0, -212, 212, -12, 12, JSON.stringify(road));
  }
})();
store.tutorial('skipped');
store.close();
let page;
const samples = [];
const ready = async () => {
  await atlasCanvasReady(page);
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
  );
};
async function visibleRoad(label) {
  const map = page.locator('#campaign-map'),
    view = JSON.parse(await map.getAttribute('data-terrain-projection')),
    bounds = await map.boundingBox(),
    point = projectTerrain(view, { x: 80, y: 0 }, 100);
  const image = require('pngjs').PNG.sync.read(await page.screenshot()),
    cx = Math.round(bounds.x + point.x * bounds.width),
    cy = Math.round(bounds.y + point.y * bounds.height);
  let ink = 0;
  for (let y = cy - 6; y <= cy + 6; y++)
    for (let x = cx - 6; x <= cx + 6; x++) {
      const at = (y * image.width + x) * 4;
      if ([163, 126, 81].every((c, i) => Math.abs(image.data[at + i] - c) < 10)) ink++;
    }
  assert(ink > 30, `${label}: dense road pixels missing (${ink})`);
  samples.push({ label, cx, cy, ink });
}
try {
  page = await native.launch();
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        'atlas-camera:' + id,
        JSON.stringify({ x: -450, y: -300, width: 900, height: 600 }),
      ),
    campaign.id,
  );
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Dichte Landschaft' })
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
  await ready();
  assert.equal(
    await page.locator('#campaign-map').getAttribute('data-atlas-terrain-raster'),
    'false',
  );
  assert(
    Number(await page.locator('#campaign-map').getAttribute('data-atlas-landscape-tiles')) > 0,
  );
  await visibleRoad('top');
  await native.capture(page, '01-dense-top.png');
  await page.locator('#atlas-view').click();
  await page.locator('#terrain-tilt').fill('45');
  await page.locator('#terrain-tilt').dispatchEvent('input');
  await page.keyboard.press('Escape');
  await ready();
  await visibleRoad('tilted');
  await native.capture(page, '02-dense-tilted.png');
  await native.close();
  await native.finish({
    samples,
    checks: [
      'Dense road aggregate remains visible above separately projected ground in the ordinary top and tilted Atlas.',
    ],
  });
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
