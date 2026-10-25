import { seedAtlasCity, verifyAtlasCity } from './atlas-main-city-probe.mjs';
// One main Atlas: camera pose, normal room/object tools, canonical undo and restart.
// Run through tools/ui-session.py; all data and evidence belong to this isolated probe.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';

const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  stdin: {
    resolveDir: root,
    contents: `export * from './src/app/storage/store';export {newElement} from './src/app/atlas/drawing-model';export {atlasProject,atlasPlanePoint} from './src/app/atlas/atlas-camera';`,
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
  outfile: '.build/atlas-main-camera-store.cjs',
});
const { CampaignStore, newElement, atlasProject, atlasPlanePoint } = require(
  root + '/.build/atlas-main-camera-store.cjs',
);
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-main-camera'),
  profiles = path.join(homedir(), '.cache/saltmarcher/ui-profiles');
await mkdir(out, { recursive: true });
await mkdir(profiles, { recursive: true });
const profile = await mkdtemp(path.join(profiles, 'atlas-main-')),
  store = new CampaignStore(profile + '/workbench.sqlite');
const original = {
  id: 'room',
  scopeId: 'local',
  floorId: 'ground',
  number: '1',
  name: 'Kameraraum',
  revision: 0,
  polygons: [
    {
      outer: [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 80 },
        { x: 0, y: 80 },
      ],
      holes: [],
    },
  ],
  sections: [],
};
const campaign = store.create('Gemeinsame Atlaskamera', [original]);
store.tutorial('skipped');
const token = store.activateShell(campaign.id).token;
store.executeDrawing({
  commandId: randomUUID(),
  token,
  campaignId: campaign.id,
  action: {
    kind: 'element',
    expectedRevision: null,
    element: {
      ...newElement('object', 'local', 'ground', 'room', [{ x: 40, y: 40 }]),
      name: 'Tisch im Kameraraum',
      width: 30,
      height: 30,
    },
  },
});
const floorHeight = process.argv.includes('--raised-floor') ? 12 : 0;
if (floorHeight)
  store.executeDrawing({
    commandId: randomUUID(),
    token,
    campaignId: campaign.id,
    action: {
      kind: 'floor',
      scopeId: 'local',
      id: 'ground',
      name: 'Arbeitsgeschoss',
      elevation: floorHeight,
      cloneId: null,
      hidden: false,
    },
  });
if (floorHeight)
  store.executeDrawing({
    commandId: randomUUID(),
    token,
    campaignId: campaign.id,
    action: {
      kind: 'floor',
      scopeId: 'local',
      id: 'upper',
      name: 'Obergeschoss',
      elevation: 24,
      cloneId: null,
      hidden: false,
    },
  });
let activeFloorHeight = floorHeight;
if (!floorHeight) seedAtlasCity(store, token, campaign.id);
store.close();
const db = new (require('better-sqlite3'))(profile + '/workbench.sqlite', {
  readonly: true,
});
const readRoom = () =>
  JSON.parse(db.prepare('SELECT payload FROM room WHERE id=?').get('room').payload);
const result = {
  source: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  }).trim(),
  profile,
  floorHeight,
  errors: [],
  checks: [],
  exits: [],
  hashes: {},
};
for (const file of [
  'src/app/storage/drawing.ts',
  'src/app/atlas/drawing-ui.ts',
  'src/app/atlas/atlas-workplane.ts',

  'src/app/atlas/atlas-label-source.ts',
  'src/app/atlas/atlas-region-export.ts',
  'src/app/atlas/atlas-presentation.ts',
  'src/app/atlas/atlas-spatial-geometry.ts',
  'src/app/atlas/atlas-spatial-surface.ts',

  'src/app/atlas/atlas-spatial-color.ts',

  'src/app/atlas/city-model.ts',
  'src/app/storage/atlas-region.ts',

  'src/app/atlas/atlas-canvas.ts',

  'src/app/atlas/campaign-atlas-ui.ts',
  '.build/desktop/ui/renderer.js',
])
  result.hashes[file] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
let app, page;
const mark = (text) => {
  result.checks.push(text);
  console.log(text);
};
const capture = async (name) => writeFile(out + '/' + name + '.png', await page.screenshot());
const settle = async () => {
  await atlasCanvasReady(page);
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
  );
};
async function open() {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [root + '/.build/desktop/main.cjs', '--data-dir', profile, '--ozone-platform=x11'],
  });
  page = await app.firstWindow();
  page.on('pageerror', (e) => result.errors.push(e.stack));
  page.on('console', (m) => {
    if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) result.errors.push(m.text());
  });
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        'atlas-camera:' + id,
        JSON.stringify({ x: -20, y: -20, width: 120, height: 100 }),
      ),
    campaign.id,
  );
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Gemeinsame Atlaskamera' })
    .getByRole('button', { name: /^(Öffnen|Fortsetzen)$/ })
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
  await settle();
  await selectRoom();
  console.log('Main Atlas room ready');
}
async function selectRoom() {
  await page.locator('#atlas-search').fill('Kameraraum');
  await page.locator('#atlas-search-results button').filter({ hasText: 'Kameraraum' }).click();
  await page.locator('#atlas-search').fill('');
  await settle();
  await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
  await settle();
}
async function close() {
  const pid = app.process().pid;
  const exited = new Promise((resolve) =>
    app.process().once('exit', (code, signal) => resolve({ code, signal })),
  );
  await app.close();
  const exit = { ...(await exited), pid };
  result.exits.push(exit);
  assert.equal(exit.code, 0);
  assert.equal(exit.signal, null);
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  app = null;
}
async function screen(point) {
  await settle();
  const state = await page.locator('#campaign-map').evaluate((c) => ({
    pose: JSON.parse(c.dataset.terrainProjection),
    rect: c.getBoundingClientRect().toJSON(),
  }));
  const at = atlasProject(state.pose, point, activeFloorHeight);
  assert(
    at.depth > 0 && at.x > 0 && at.x < 1 && at.y > 0 && at.y < 1,
    JSON.stringify({ point, at }),
  );
  return {
    x: state.rect.x + at.x * state.rect.width,
    y: state.rect.y + at.y * state.rect.height,
  };
}
async function clickWorld(p) {
  const at = await screen(p);
  await page.mouse.click(at.x, at.y);
}
async function chooseTool(value) {
  if (value === 'select') await page.locator('#atlas-select').click();
  else await page.locator(`[data-tool-select="drawing-tool"][data-tool-value="${value}"]`).click();
  await settle();
}
async function pose() {
  return page.locator('#campaign-map').evaluate((c) => {
    const p = JSON.parse(c.dataset.terrainProjection);
    return { tilt: p.tilt, rotation: p.rotation };
  });
}
try {
  await open();
  if (!process.argv.includes('--city-only')) {
    assert.equal(await page.locator('#atlas-terrain-spatial').count(), 1);
    assert.deepEqual(await pose(), { tilt: 0, rotation: 0 });
    await page.evaluate(
      () => (window.__mainAtlasSurface = document.querySelector('#atlas-terrain-spatial')),
    );
    await page.locator('#atlas-view').click();
    for (const [id, value] of [
      ['tilt', 30],
      ['rotation', 25],
    ]) {
      const input = page.locator('#terrain-' + id);
      await input.press('Home');
      for (let i = 0; i < (id === 'rotation' ? 205 : value); i++) await input.press('ArrowRight');
    }
    await page.keyboard.press('Escape');
    await settle();
    const tilted = await pose();
    assert.deepEqual(tilted, { tilt: 30, rotation: 25 });
    await capture('01-main-room-camera');
    await chooseTool('select');
    await clickWorld({ x: 50, y: 50 });
    await page.locator('#atlas-hit-candidates').waitFor({ state: 'visible' });
    const candidates = await page.locator('#atlas-hit-candidates').innerText();
    assert.match(candidates, /Tisch im Kameraraum/);
    assert.match(candidates, /Kameraraum/);
    await page.keyboard.press('Escape');
    mark('Normal room and object selection work with the main camera tilted and rotated');
    await selectRoom();
    await chooseTool('room-polygon');
    for (const p of [
      { x: 10, y: 10 },
      { x: 60, y: 10 },
      { x: 60, y: 60 },
    ])
      await clickWorld(p);
    await page.waitForFunction(() =>
      document.querySelector('#drawing-path-status').textContent.includes('3 Punkte'),
    );
    assert.deepEqual(await pose(), tilted);
    await capture('02-main-room-draft');
    await page.locator('#drawing-cancel').click();
    await chooseTool('select');
    await selectRoom();
    await page.locator('#drawing-snap').uncheck();
    const from = await screen({ x: 80, y: 0 }),
      to = await screen({ x: 95, y: 0 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(
      () => document.querySelector('#atlas-save-status').textContent === 'Gespeichert',
    );
    await settle();
    const saved = readRoom();
    assert(Math.abs(saved.polygons[0].outer[1].x - 95) < 0.5, JSON.stringify(saved.polygons));
    assert.deepEqual(saved.polygons[0].outer[0], original.polygons[0].outer[0]);
    result.savedVertex = saved.polygons[0].outer[1];
    await capture('03-main-room-edited');
    for (const kind of ['undo', 'redo']) {
      await page.locator('#atlas-' + kind).click();
      await page.waitForFunction(
        () => document.querySelector('#atlas-save-status').textContent === 'Gespeichert',
      );
      await settle();
      assert.deepEqual(readRoom().polygons, kind === 'undo' ? original.polygons : saved.polygons);
    }
    assert.deepEqual(await pose(), tilted);
    assert(
      await page.evaluate(
        () => window.__mainAtlasSurface === document.querySelector('#atlas-terrain-spatial'),
      ),
    );
    mark('Room draft, vertex edit and one undo/redo retain the same camera and main surface');
    await page.locator('#atlas-view').click();
    await page.locator('#terrain-top').click();
    await page.keyboard.press('Escape');
    await settle();
    assert.deepEqual(await pose(), { tilt: 0, rotation: 0 });
    assert(
      await page.evaluate(
        () => window.__mainAtlasSurface === document.querySelector('#atlas-terrain-spatial'),
      ),
    );
    await close();
    await open();
    assert.deepEqual(readRoom().polygons, saved.polygons);
    await capture('04-reopened');
    if (floorHeight) {
      await page.locator('#atlas-view').click();
      await page.locator('#terrain-tilt').fill('45');
      await page.locator('#terrain-tilt').dispatchEvent('input');
      await page.locator('#terrain-rotation').fill('25');
      await page.locator('#terrain-rotation').dispatchEvent('input');
      await page.keyboard.press('Escape');
      await settle();
      await page.locator('#atlas-floor').selectOption('upper');
      activeFloorHeight = 24;
      await settle();
      await chooseTool('room-polygon');
      await page.locator('#drawing-snap').uncheck();
      await page.locator('#drawing-room-name').fill('Raum im Obergeschoss');
      const points = [
        { x: 10, y: 10 },
        { x: 60, y: 10 },
        { x: 60, y: 60 },
      ];
      await page.evaluate(() => {
        window.__freeRoomClicks = [];
        document.querySelector('#campaign-map').addEventListener(
          'click',
          (e) => {
            const canvas = e.currentTarget,
              rect = canvas.getBoundingClientRect();
            window.__freeRoomClicks.push({
              pose: JSON.parse(canvas.dataset.terrainProjection),
              screen: {
                x: (e.clientX - rect.x) / rect.width,
                y: (e.clientY - rect.y) / rect.height,
              },
            });
          },
          { capture: true },
        );
      });

      for (const p of points) await clickWorld(p);
      await capture('05-upper-floor-draft');
      await page.locator('#drawing-finish').click();
      let row;
      for (let i = 0; i < 100 && !row; i++) {
        row = db
          .prepare('SELECT id,floor_id floorId,payload FROM room WHERE name=?')
          .get('Raum im Obergeschoss');
        if (!row) await page.waitForTimeout(100);
      }
      assert(row);
      const added = { id: row.id, floorId: row.floorId, ...JSON.parse(row.payload) };
      await settle();
      assert.equal(added.floorId, 'upper');
      assert.equal(added.polygons.length, 1);
      assert.equal(added.polygons[0].outer.length, 3);
      const clicks = await page.evaluate(() => window.__freeRoomClicks);
      assert.equal(clicks.length, 3);
      const authored = clicks.map((c) => atlasPlanePoint(c.pose, c.screen, 24));
      for (const [i, p] of authored.entries()) {
        assert(
          Math.hypot(p.x - points[i].x, p.y - points[i].y) < 0.5,
          'native MouseEvent rounding stays within one screen pixel',
        );
        assert(
          added.polygons[0].outer.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-5),
          JSON.stringify({ authored, polygons: added.polygons }),
        );
      }
      result.upperClicks = clicks;
      result.upperAuthored = authored;
      assert.equal(
        db.prepare('SELECT count(*) n FROM dungeon_volume WHERE room_id=?').get(added.id).n,
        0,
      );
      result.upperRoom = added;
      await capture('06-upper-floor-saved');
      for (const kind of ['undo', 'redo']) {
        await page.locator('#atlas-' + kind).click();
        const expected = kind === 'undo' ? 0 : 1;
        let visible;
        for (let i = 0; i < 100; i++) {
          visible = db
            .prepare(
              "SELECT count(*) n FROM room r WHERE r.id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1)",
            )
            .get(added.id).n;
          if (visible === expected) break;
          await page.waitForTimeout(100);
        }
        assert.equal(visible, expected);
        await settle();
        if (kind === 'redo')
          assert.deepEqual(
            JSON.parse(db.prepare('SELECT payload FROM room WHERE id=?').get(added.id).payload)
              .polygons,
            added.polygons,
          );
      }

      await page.locator('#atlas-floor').selectOption('ground');
      activeFloorHeight = floorHeight;
      await settle();
      assert.deepEqual(readRoom().polygons, saved.polygons);
      mark(
        'Floor switch and committed polygon retain exactly three authored vertices at 24 metres under the tilted main camera',
      );
      await close();
      await open();
      assert.deepEqual(
        JSON.parse(db.prepare('SELECT payload FROM room WHERE id=?').get(added.id).payload)
          .polygons,
        added.polygons,
      );
      assert.equal(
        db.prepare('SELECT count(*) n FROM dungeon_volume WHERE room_id=?').get(added.id).n,
        0,
      );
      await page.locator('#atlas-floor').selectOption('upper');
      activeFloorHeight = 24;
      await settle();
      await capture('07-upper-floor-reopened');
      mark(
        'The free room creation has one undo/redo action and retains its exact polygon and no implicit volume after fresh reopening',
      );
    }
  }
  if (!process.argv.includes('--raised-floor'))
    result.city = await verifyAtlasCity(page, settle, capture, () =>
      db.prepare('SELECT id,payload,checksum FROM city_unit ORDER BY id').all(),
    );
  mark(
    floorHeight
      ? 'Raised floor edits retain their height after reopening'
      : 'City objects sit on landscape in the main camera; GPU context loss falls back once and explicit retry recovers',
  );
  await close();
  if (!process.argv.includes('--city-only'))
    mark('Top view keeps the renderer; a fresh native process retains canonical edits');
  assert.deepEqual(result.errors, []);
  result.ok = true;
} catch (error) {
  result.error = error.stack;
  if (page) {
    result.state = await page
      .evaluate(() => ({
        canvas: document.querySelector('#campaign-map')?.dataset,
        status: document.querySelector('#atlas-save-status')?.textContent,
      }))
      .catch(() => null);
    await capture('failure').catch(() => {});
  }
  throw error;
} finally {
  if (app) await close().catch((error) => (result.closeError = String(error)));
  db.close();
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
}
