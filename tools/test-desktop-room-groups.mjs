import { runNativeProbe } from './native-session.mjs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const require = createRequire(import.meta.url),
  { _electron } = require('playwright-core'),
  Database = require('better-sqlite3'),
  root = process.cwd();
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/room-groups-native.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/room-groups-native.cjs');
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/room-groups-native');
await runNativeProbe({ output: out, name: 'room-groups' }, async (native) => {
  const profile = native.profile;
  await mkdir(out, { recursive: true });
  const store = new CampaignStore(profile + '/workbench.sqlite'),
    cam = store.create('Raumgruppenprobe'),
    w = store.activate(cam.id);
  store.tutorial('skipped');
  store.close();
  const evidence = {
    source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    profile,
    errors: [],
    checks: [],
    launches: [],
  };
  let app;
  async function launch() {
    app = await native.launchConfigured({
      executablePath: root + '/node_modules/electron/dist/electron',
      args: [root + '/.build/desktop/main.cjs', '--data-dir', profile, '--ozone-platform=x11'],
      timeout: 60000,
    });
    const process = app.process(),
      launch = { pid: process.pid };
    evidence.launches.push(launch);
    process.once('exit', (code, signal) => Object.assign(launch, { code, signal }));
    const page = await app.firstWindow();
    page.on('pageerror', (e) => evidence.errors.push(e.stack));
    await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
    await page.evaluate((id) => {
      if (!localStorage.getItem('atlas-camera:' + id))
        localStorage.setItem(
          'atlas-camera:' + id,
          JSON.stringify({ x: -250, y: -200, width: 500, height: 400 }),
        );
    }, cam.id);
    await page
      .locator('.campaign-card')
      .filter({ hasText: 'Raumgruppenprobe' })
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
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'SaltMarcher');
      w.setContentSize(1280, 800);
    });
    await atlasCanvasReady(page);
    return page;
  }
  async function capture(page, name) {
    await page.screenshot({ path: out + '/' + name + '.png' });
  }
  function inventory() {
    const db = new Database(profile + '/workbench.sqlite', { readonly: true });
    try {
      return {
        groups: db.prepare('SELECT * FROM room_group').all(),
        rooms: db.prepare('SELECT * FROM room').all(),
        elements: db.prepare('SELECT * FROM drawing_element').all(),
        houses: db.prepare("SELECT * FROM city_unit WHERE kind='building'").all(),
        bindings: db.prepare("SELECT * FROM atlas_binding WHERE kind='dungeon'").all(),
      };
    } finally {
      db.close();
    }
  }
  try {
    let page = await launch();
    await page.locator('#atlas-units').selectOption('metric');
    await page.locator('#atlas-section').selectOption('city');
    await atlasCanvasReady(page);
    await page.locator('[data-tool-group=buildings]').click();
    await page.locator('[data-atlas-tool=building]').click();
    await atlasCanvasReady(page);
    let box = await page.locator('#campaign-map').boundingBox();
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.5);
    const dialog = page.getByRole('dialog', { name: 'Raumgruppe erzeugen' });
    await dialog.waitFor();
    await dialog.locator('[name=profile]').selectOption('Taverne');
    await dialog.locator('[name=width]').fill('16');
    await dialog.locator('[name=depth]').fill('18');
    await dialog.locator('[name=seed]').fill('silberner-ast');
    await dialog.locator('[name=previewFloor]').selectOption('floor-1');
    await capture(page, 'tavern-preview');
    await dialog.getByRole('button', { name: 'Übernehmen', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await atlasCanvasReady(page);
    await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
    let state = inventory();
    assert.equal(state.houses.length, 0);
    assert(state.rooms.length > 5);
    const binding = state.bindings.find((b) => b.owner_id === state.groups[0].id);
    assert(binding);
    assert.equal(binding.parent, 'world');
    evidence.checks.push('house is an independent furnished room group without city context');
    await page.waitForFunction(() => !document.querySelector('#atlas-undo').disabled);
    await page.locator('#atlas-section').selectOption('interior');
    await page.waitForFunction(
      () => document.querySelector('#campaign-atlas').dataset.family === 'interior',
    );
    await atlasCanvasReady(page);
    await page.locator('#atlas-create-dungeon').click();
    box = await page.locator('#campaign-map').boundingBox();
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4);
    await dialog.waitFor();
    await dialog.locator('[name=profile]').selectOption('Krypta');
    await dialog.locator('[name=seed]').fill('krypta');
    await capture(page, 'crypt-preview');
    await dialog.getByRole('button', { name: 'Übernehmen', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await atlasCanvasReady(page);
    await capture(page, 'crypt-created');
    state = inventory();
    assert.equal(state.groups.length, 2);
    evidence.checks.push('crypt generated through same dialog');
    await page.locator('#atlas-search').fill('Schankraum');
    await page
      .locator('#atlas-search-results button')
      .filter({ hasText: 'Schankraum' })
      .first()
      .click();
    await atlasCanvasReady(page);
    await page.locator('#atlas-search').fill('');
    await page.locator('#room-name').fill('Silberner Schankraum');
    await page.locator('#room-name').press('Tab');
    await page.waitForTimeout(1200);
    await atlasCanvasReady(page);
    await capture(page, 'shared-room-editor');
    await page.locator('#atlas-placement > summary').click();
    const beforeScale = inventory(),
      sourceRoom = beforeScale.rooms.find((r) => r.name === 'Silberner Schankraum');
    await page.locator('#atlas-group-factor').fill('1.25');
    await page.locator('#atlas-group-scale').click();
    await page.waitForTimeout(700);
    await atlasCanvasReady(page);
    const scaled = inventory().rooms.find((r) => r.id === sourceRoom.id);
    assert.equal(
      JSON.parse(scaled.payload).polygons[0].outer[0].x,
      JSON.parse(sourceRoom.payload).polygons[0].outer[0].x * 1.25,
    );
    await page.locator('#atlas-undo').click();
    await page.waitForTimeout(500);
    await atlasCanvasReady(page);
    assert.deepEqual(
      JSON.parse(inventory().rooms.find((r) => r.id === sourceRoom.id).payload).polygons,
      JSON.parse(sourceRoom.payload).polygons,
    );
    await page.locator('#atlas-redo').click();
    await page.waitForTimeout(500);
    await atlasCanvasReady(page);
    await page.locator('#atlas-room-split').click();
    await page.waitForTimeout(700);
    await atlasCanvasReady(page);
    assert.equal(inventory().rooms.length, beforeScale.rooms.length + 1);
    await capture(page, 'split-room');
    await page.locator('#atlas-undo').click();
    await page.waitForTimeout(500);
    await atlasCanvasReady(page);
    assert.equal(inventory().rooms.length, beforeScale.rooms.length);
    evidence.checks.push(
      'whole house scaled, undo/redo, selected room split and undone in common inspector',
    );
    await native.close();
    app = null;
    state = inventory();
    assert(state.rooms.some((r) => r.name === 'Silberner Schankraum'));
    const roomIds = state.rooms.map((r) => r.id).sort();
    page = await launch();
    await page.locator('#atlas-search').fill('Silberner Schankraum');
    await page
      .locator('#atlas-search-results button')
      .filter({ hasText: 'Silberner Schankraum' })
      .click();
    await atlasCanvasReady(page);
    await capture(page, 'fresh-reopen');
    assert.deepEqual(
      inventory()
        .rooms.map((r) => r.id)
        .sort(),
      roomIds,
    );
    evidence.checks.push('room renamed, normal exit, new process, same identities');
    assert.deepEqual(evidence.errors, []);
  } catch (e) {
    if (app) await capture(await app.firstWindow(), 'failure');
    evidence.error = e.stack;
    throw e;
  } finally {
    if (app) await native.close();
    await native.recordResult(evidence);
    console.log(JSON.stringify(evidence));
  }
});
