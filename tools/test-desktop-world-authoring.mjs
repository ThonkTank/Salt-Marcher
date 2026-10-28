// Author an actual world through the ordinary Atlas tools; only the empty campaign is seeded.
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(import.meta.url),
  out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/world-authoring');
require('esbuild').buildSync({
  stdin: {
    resolveDir: root,
    contents: "export {CampaignStore} from './src/app/storage/store';",
  },
  outfile: '.build/world-authoring-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/world-authoring-store.cjs'),
  native = await createNativeSession({
    root,
    output: out,
    name: 'world-authoring',
  });
const store = new CampaignStore(native.profile + '/workbench.sqlite'),
  campaign = store.create('Asterfall – Autorenwelt'),
  token = store.activate(campaign.id).token;
store.executeAtlasCommit({
  token,
  campaignId: campaign.id,
  commandId: randomUUID(),
  action: { kind: 'landscape-sea-level', seaLevelM: 0 },
});
store.tutorial('skipped');
store.close();
const Database = require('better-sqlite3'),
  wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  result = {
    campaignId: campaign.id,
    stages: [],
    scope:
      'continents, continental relief, independent kingdom area, streets, buildings and a room; functional author journey, not visual or performance acceptance',
  };
let page;
function inventory() {
  const db = new Database(native.profile + '/workbench.sqlite', {
    readonly: true,
  });
  try {
    return {
      groups: db.prepare('SELECT count(*) n FROM room_group WHERE campaign_id=?').get(campaign.id)
        .n,
      rooms: db
        .prepare('SELECT id,name FROM room WHERE campaign_id=? ORDER BY id')
        .all(campaign.id),
      cityDocuments: db
        .prepare('SELECT count(*) n FROM city_document WHERE campaign_id=?')
        .get(campaign.id).n,
      roads: db
        .prepare(
          "SELECT count(*) n FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind')='road'",
        )
        .get(campaign.id).n,
      revision: db
        .prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?')
        .get(campaign.id).revision,
      heights: db
        .prepare(
          "SELECT count(*) n FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.height') IS NOT NULL",
        )
        .get(campaign.id).n,
      vegetation: db
        .prepare(
          "SELECT count(*) n FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.vegetation') IS NOT NULL",
        )
        .get(campaign.id).n,
      regions: db
        .prepare('SELECT payload FROM atlas_territory WHERE campaign_id=?')
        .all(campaign.id)
        .map((r) => JSON.parse(r.payload)),
    };
  } finally {
    db.close();
  }
}
async function open(first = false) {
  page = await native.launch();
  await native.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1440, 900),
  );
  if (first)
    await page.evaluate(
      (id) =>
        localStorage.setItem(
          'atlas-camera:' + id,
          JSON.stringify({
            x: -20000000,
            y: -12500000,
            width: 40000000,
            height: 25000000,
          }),
        ),
      campaign.id,
    );
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Asterfall – Autorenwelt' })
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
  await page.locator('#atlas-units').selectOption('metric');
}
async function ready() {
  await atlasCanvasReady(page);
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
    null,
    { timeout: 60000 },
  );
}
async function record(name) {
  await ready();
  await wait(1500);
  await native.capture(page, name);
  result.stages.push({
    name,
    inventory: inventory(),
    view: await page.locator('#campaign-map').evaluate((n) => ({ ...n.dataset })),
  });
  await writeFile(
    out + '/progress.json',
    JSON.stringify({ ...result, profile: native.profile }, null, 2),
  );
  console.log(name);
}
async function stroke(points, hold = 400) {
  await ready();
  const before = inventory().revision,
    b = await page.locator('#campaign-map').boundingBox();
  await page.mouse.move(b.x + b.width * points[0][0], b.y + b.height * points[0][1]);
  // Display readiness does not imply that the exact author's height basis is
  // loaded. Hover starts that read; the production gate deliberately rejects a
  // pointerdown while it is loading, so wait for this radius and source identity.
  if (['height', 'smooth', 'freshwater'].includes(await page.locator('#land-tool').inputValue())) {
    const radius = Number(await page.locator('#land-radius-value').inputValue());
    await page.waitForFunction(
      (radius) => {
        const canvas = document.querySelector('#campaign-map'),
          state = canvas.dataset;
        const source = JSON.parse(state.terrainEditingSource ?? 'null');
        return (
          state.terrainEditingState === 'ready' &&
          Number(state.terrainEditingRadius) === radius &&
          source?.complete === true &&
          source.radius === radius &&
          source.revision === Number(state.terrainRevision)
        );
      },
      radius,
      { timeout: 60000 },
    );
  }
  await page.mouse.down();
  await wait(hold);
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1],
      [bx, by] = points[i],
      steps = Math.ceil(hold / 30);
    for (let j = 1; j <= steps; j++) {
      await page.mouse.move(
        b.x + b.width * (ax + ((bx - ax) * j) / steps),
        b.y + b.height * (ay + ((by - ay) * j) / steps),
      );
      await wait(hold / steps);
    }
  }
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector('#land-tool').disabled, null, {
    timeout: 60000,
  });
  // The next local gesture may begin before its predecessor is acknowledged.
  // Qualification must await the canonical write, not an enabled tool control.
  const deadline = Date.now() + 120000;
  while (inventory().revision <= before && Date.now() < deadline) await wait(50);
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainDraft === undefined,
    null,
    { timeout: 60000 },
  );
  await ready();
  assert(inventory().revision > before, 'gesture must commit canonical records');
}
async function finishPath() {
  const before = inventory().revision;
  await page.locator('#land-finish').click();
  const deadline = Date.now() + 120000;
  while (inventory().revision <= before && Date.now() < deadline) await wait(50);
  assert(inventory().revision > before, 'each road must commit before the next author input');
  // Region readiness can still describe the previous frame during a save. The
  // writer releases these controls only after its acknowledgement and refresh.
  await page.waitForFunction(() => !document.querySelector('#land-finish').disabled, null, {
    timeout: 60000,
  });
  await ready();
}
async function land(radius, strength = 500, direction = 'raise') {
  await page.locator('#atlas-section').selectOption('terrain');
  await page.locator('[data-tool-group="land"]').click();
  await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
  await setBrushWorldRadius(page, 'land-radius', radius);
  await setHeightDirection(page, direction);
  await page.locator('#land-height-target-enabled').uncheck();
  await page.locator('#land-height-strength').fill(String(strength));
}
async function zoom(width, point = [0.5, 0.5]) {
  // Wheel zoom keeps its anchor under the pointer. Centre the chosen landscape
  // first so subsequent composition is actually inside that continent/kingdom.
  if (point[0] !== 0.5 || point[1] !== 0.5) {
    await page.locator('#atlas-pan').click();
    const b = await page.locator('#campaign-map').boundingBox();
    await page.mouse.move(b.x + b.width * point[0], b.y + b.height * point[1]);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5, {
      steps: 12,
    });
    await page.mouse.up();
    await ready();
    point = [0.5, 0.5];
  }
  for (let n = 0; n < 40; n++) {
    const old = await page
        .locator('#campaign-map')
        .evaluate((n) => JSON.parse(n.dataset.atlasView).width),
      ratio = width / old;
    if (Math.abs(Math.log(ratio)) < 0.02) {
      await ready();
      return;
    }
    const b = await page.locator('#campaign-map').boundingBox();
    await page.mouse.move(b.x + b.width * point[0], b.y + b.height * point[1]);
    await page.mouse.wheel(0, Math.log(ratio) / 0.002);
    await page.waitForFunction(
      (w) =>
        Math.abs(
          JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width / w - 1,
        ) > 0.005,
      old,
    );
    await ready();
  }
  throw Error('Zoom did not reach requested scale');
}
try {
  await open(true);
  await land(2200000);
  await stroke(
    [
      [0.23, 0.3],
      [0.27, 0.4],
      [0.24, 0.52],
      [0.31, 0.61],
      [0.37, 0.64],
    ],
    550,
  );
  // A broad inland body and an eastern cape, then a cut into the west coast.
  // These are authored gestures, not injected landscape records.
  await land(1800000, 700);
  await stroke(
    [
      [0.27, 0.4],
      [0.33, 0.44],
      [0.31, 0.52],
    ],
    450,
  );
  await land(950000, 700);
  await stroke(
    [
      [0.29, 0.35],
      [0.36, 0.31],
    ],
    450,
  );
  await land(650000, 1600, 'lower');
  await stroke(
    [
      [0.2, 0.42],
      [0.255, 0.43],
    ],
    500,
  );
  await land(1000000, 550, 'roughen');
  await stroke(
    [
      [0.25, 0.3],
      [0.31, 0.37],
      [0.34, 0.48],
      [0.31, 0.6],
    ],
    400,
  );
  await record('01-western-continent');
  await land(1600000);
  await stroke(
    [
      [0.64, 0.29],
      [0.71, 0.33],
      [0.72, 0.43],
      [0.68, 0.53],
    ],
    550,
  );
  await land(850000);
  await stroke(
    [
      [0.49, 0.69],
      [0.52, 0.73],
      [0.55, 0.76],
    ],
    400,
  );
  await record('02-continents');
  await zoom(9000000, [0.29, 0.46]);
  await land(420000, 1500);
  await stroke(
    [
      [0.44, 0.3],
      [0.49, 0.4],
      [0.46, 0.5],
      [0.52, 0.6],
    ],
    600,
  );
  await record('03-continental-relief');
  await page.locator('[data-tool-group="vegetation"]').click();
  await page
    .locator('[data-tool-select="land-tool"][data-tool-value="vegetation"]')
    .first()
    .click();
  await setBrushWorldRadius(page, 'land-radius', 650000);
  await stroke(
    [
      [0.55, 0.42],
      [0.59, 0.48],
      [0.57, 0.56],
    ],
    500,
  );
  assert(inventory().vegetation > 0);
  await record('04-continental-forest');
  await page.locator('[data-tool-group="regions"]').click();
  await page.locator('[data-atlas-tool="territory"]').click();
  await page.locator('#territory-layer').selectOption('politics');
  await page.getByText('Region und Beschriftung', { exact: true }).click();
  await page.locator('#territory-name').fill('Königreich Aster');
  await page.locator('#territory-new').click();
  await ready();
  await setBrushWorldRadius(page, 'territory-radius', 800000);
  await stroke(
    [
      [0.48, 0.46],
      [0.56, 0.48],
      [0.53, 0.55],
    ],
    300,
  );
  const region = inventory().regions.find((r) => r.name === 'Königreich Aster');
  assert(region?.polygons.length);
  await record('05-kingdom');
  await zoom(400, [0.53, 0.53]);
  // The settlement is a clearing painted into independent vegetation, not a
  // city boundary that silently owns or deletes the landscape beneath it.
  await page.locator('[data-tool-group="vegetation"]').click();
  await page
    .locator('[data-tool-select="land-tool"][data-tool-value="vegetation-erase"]')
    .first()
    .click();
  await setBrushWorldRadius(page, 'land-radius', 55);
  await stroke(
    [
      [0.37, 0.43],
      [0.49, 0.4],
      [0.65, 0.43],
      [0.64, 0.6],
      [0.5, 0.6],
    ],
    350,
  );
  await page.locator('[data-tool-group=routes]').click();
  await page.locator('[data-tool-select="land-tool"][data-tool-value="road"]').first().click();
  await page.locator('#land-width').fill('6');
  let area = await page.locator('#campaign-map').boundingBox();
  for (const [x, y] of [
    [0.25, 0.5],
    [0.5, 0.53],
    [0.75, 0.48],
  ])
    await page.mouse.click(area.x + area.width * x, area.y + area.height * y);
  await finishPath();
  await page.locator('#land-width').fill('3');
  for (const points of [
    [
      [0.43, 0.52],
      [0.43, 0.37],
    ],
    [
      [0.61, 0.51],
      [0.61, 0.66],
    ],
  ]) {
    area = await page.locator('#campaign-map').boundingBox();
    for (const [x, y] of points)
      await page.mouse.click(area.x + area.width * x, area.y + area.height * y);
    await finishPath();
  }
  assert.equal(inventory().roads, 3, 'all three ordinary authored roads must be canonical');
  await page.locator('#atlas-section').selectOption('city');
  await page.locator('[data-tool-group=buildings]').click();
  await page.locator('[data-atlas-tool=building]').click();
  await ready();
  for (const [i, profile, x, y, width, depth] of [
    [0, 'Taverne', 0.38, 0.43, 18, 22],
    [1, 'Wohnhaus', 0.49, 0.42, 9, 12],
    [2, 'Werkstatt', 0.65, 0.6, 14, 12],
    [3, 'Wohnhaus', 0.66, 0.43, 10, 10],
    [4, 'Wohnhaus', 0.55, 0.6, 8, 12],
    [5, 'Wohnhaus', 0.48, 0.33, 11, 9],
  ]) {
    area = await page.locator('#campaign-map').boundingBox();
    await page.evaluate(() => {
      window.__buildingPress = [];
      for (const name of ['pointerdown', 'click'])
        document.addEventListener(
          name,
          (e) =>
            window.__buildingPress.push({
              name,
              target: e.target.id,
              time: performance.now(),
              region: document.querySelector('#campaign-atlas').dataset.regionState,
              canvas: { ...document.querySelector('#campaign-map').dataset },
              undoDisabled: document.querySelector('#atlas-undo').disabled,
              cityTool: document.querySelector('#city-tool')?.value,
              section: document.querySelector('#atlas-section')?.value,
              status: document.querySelector('#atlas-save-status').textContent,
            }),
          { once: true, capture: true },
        );
    });
    await page.mouse.click(area.x + area.width * x, area.y + area.height * y);
    (result.buildingAttempts ??= []).push({
      i,
      profile,
      groups: inventory().groups,
      press: await page.evaluate(() => window.__buildingPress),
    });
    await writeFile(
      out + '/progress.json',
      JSON.stringify({ ...result, profile: native.profile }, null, 2),
    );
    const dialog = page.getByRole('dialog', { name: 'Raumgruppe erzeugen' });
    await dialog.waitFor();
    await dialog.locator('[name=profile]').selectOption(profile);
    await dialog.locator('[name=width]').fill(String(width));
    await dialog.locator('[name=depth]').fill(String(depth));
    await dialog.locator('[name=seed]').fill('asterfall-' + i);
    await dialog.getByRole('button', { name: 'Übernehmen', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const deadline = Date.now() + 15000;
    while (inventory().groups < i + 1 && Date.now() < deadline) await wait(50);
    assert.equal(inventory().groups, i + 1);
    await ready();
    await page.waitForFunction(() => !document.querySelector('#atlas-undo').disabled);
  }
  assert(inventory().rooms.length > 3);
  assert.equal(inventory().cityDocuments, 0, 'houses must not create a city container');
  await record('06-settlement');
  await page.locator('#atlas-search').fill('Schankraum');
  await page
    .locator('#atlas-search-results button')
    .filter({ hasText: 'Schankraum' })
    .first()
    .click();
  await ready();
  await page.locator('#atlas-search').fill('');
  await page.locator('#room-name').fill('Zum Silbernen Stern');
  await page.locator('#room-name').press('Tab');
  await wait(1000);
  await ready();
  assert(inventory().rooms.some((r) => r.name === 'Zum Silbernen Stern'));
  await record('07-building-room');
  const saved = inventory();
  await native.close();
  await open();
  assert.deepEqual(inventory(), saved, 'fresh process must retain the authored world');
  await record('08-reopened');
  await native.close();
  await native.finish(result);
} catch (error) {
  // Keep the actual UI rejection; a revision assertion alone hides intermittent
  // commit failures after a long author journey.
  if (page)
    await writeFile(
      out + '/failure-status.json',
      JSON.stringify(
        await page.evaluate(() =>
          Array.from(document.querySelectorAll('#atlas-save-status,#land-status,[data-error]')).map(
            (n) => ({ id: n.id, text: n.textContent, title: n.title }),
          ),
        ),
        null,
        2,
      ),
    ).catch(() => {});
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
