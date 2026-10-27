// Real worker commits with deliberately held acknowledgements and terrain tiles.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
const require = createRequire(import.meta.url);
require('esbuild').buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/atlas-camera';export {TerrainSampler} from './src/app/atlas/terrain-height';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/navigation-pending-math.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { atlasProject, TerrainSampler } = require('../.build/navigation-pending-math.cjs');
const Database = require('better-sqlite3');
const scale = Number(process.argv.find((s) => s.startsWith('--scale='))?.split('=')[1] ?? 1);
assert([1, 2].includes(scale));
const output = path.resolve(
  process.env.QA_EVIDENCE_DIR ?? '.build/navigation-pending',
  `${Date.now()}-${process.pid}`,
);
const session = await createNativeSession({ name: 'navigation-pending', output });
const fixture = await createAtlasCanonicalFixture({
  profilePath: session.profile,
  campaignName: 'Navigation beim Speichern',
  includeCity: false,
  peak: { x: 32, y: 32 },
  baseHeightM: 2,
  peakRiseM: 1.5,
  hillScale: 350,
});
const checks = [];
let page;
const pose = () =>
  page.locator('#campaign-map').evaluate((n) => JSON.parse(n.dataset.terrainProjection));
const writes = () => session.app.evaluate(() => globalThis.qaNavigationWrites);
function canonical() {
  const db = new Database(fixture.filename, { readonly: true });
  try {
    return {
      ...db
        .prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?')
        .get(fixture.campaignId),
      heights: db
        .prepare(
          "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.height') IS NOT NULL ORDER BY id",
        )
        .all(fixture.campaignId)
        .map((r) => JSON.parse(r.payload)),
      commands: db
        .prepare('SELECT count(*) n FROM atlas_command WHERE campaign_id=?')
        .get(fixture.campaignId).n,
    };
  } finally {
    db.close();
  }
}
async function open(fresh = false) {
  page = await session.launch(scale);
  await session.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1920, 1080),
  );
  if (!fresh) {
    await page.evaluate(
      (id) =>
        localStorage.setItem(
          'atlas-camera:' + id,
          JSON.stringify({ x: 0, y: 0, width: 64, height: 64 }),
        ),
      fixture.campaignId,
    );
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  }
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Navigation beim Speichern' })
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
}
async function drag(button, dx, dy) {
  const b = await page.locator('#campaign-map').boundingBox(),
    x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down({ button });
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up({ button });
}
async function changed(name, action, expected = true) {
  const before = await pose();
  await action();
  await page.waitForTimeout(250);
  const after = await pose();
  checks.push({ name, before, after });
  assert.equal(JSON.stringify(before) !== JSON.stringify(after), expected, name);
}
async function waitMain(key) {
  for (
    let i = 0;
    i < 1200 && !(await session.app.evaluate((_, key) => !!globalThis[key], key));
    i++
  )
    await page.waitForTimeout(50);
  assert(await session.app.evaluate((_, key) => !!globalThis[key], key), key + ' must be reached');
}
try {
  session.mark('open terrain fixture and install real acknowledgement/tile hold');
  await open();
  await page.locator('#atlas-section').selectOption('terrain');
  await page.locator('[data-tool-group="land"]').click();
  await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
  await page.locator('#atlas-units').selectOption('metric');
  await setBrushWorldRadius(page, 'land-radius', 4);
  await setHeightDirection(page, 'raise');
  await page.locator('#land-height-strength').fill('1');
  await page.locator('#land-height-strength').press('Tab');
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
    null,
    { timeout: 60000 },
  );
  const initial = canonical();
  await session.app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get('atlas:commit');
    const tile = ipcMain._invokeHandlers.get('atlas:terrain-tile');
    if (!original || !tile) throw Error('Real Atlas handlers are required');
    globalThis.qaNavigationWrites = [];
    let hold = true,
      holdTile = true;
    ipcMain.removeHandler('atlas:commit');
    ipcMain.handle('atlas:commit', async (event, command) => {
      const entry = {
        id: command.commandId,
        kind: command.action.kind,
        command: structuredClone(command),
      };
      globalThis.qaNavigationWrites.push(entry);
      const result = await original(event, command);
      entry.ok = result.ok;
      entry.revision = result.value?.revision;
      if (entry.ok && globalThis.qaNavigationWrites.length === 2)
        globalThis.qaNavigationSecondConfirmed = true;
      if (hold && command.action.kind === 'landscape-height-stroke') {
        hold = false;
        globalThis.qaNavigationHeld = true;
        globalThis.qaNavigationReply = result;
        await new Promise((resolve) => {
          globalThis.qaNavigationRelease = resolve;
        });
      }
      return result;
    });
    ipcMain.removeHandler('atlas:terrain-tile');
    ipcMain.handle('atlas:terrain-tile', async (...args) => {
      const result = await tile(...args);
      if (
        holdTile &&
        globalThis.qaNavigationReply?.ok &&
        result.ok &&
        args[2].revision >= globalThis.qaNavigationReply.value.revision
      ) {
        holdTile = false;
        globalThis.qaNavigationFrameHeld = true;
        await new Promise((resolve) => {
          globalThis.qaNavigationFrameRelease = resolve;
        });
      }
      return result;
    });
  });
  session.mark('active brush owns all camera input');
  const b = await page.locator('#campaign-map').boundingBox(),
    x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(180);
  const heldPose = await pose();
  await changed('wheel during held brush', () => page.mouse.wheel(0, -120), false);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x + 12, y + 12, { steps: 3 });
  await page.mouse.up({ button: 'right' });
  assert.deepEqual(await pose(), heldPose, 'right button must not orbit during active brush');
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(x + 18, y + 15, { steps: 3 });
  await page.mouse.up({ button: 'middle' });
  assert.deepEqual(await pose(), heldPose, 'middle button must not pan during active brush');
  await page.keyboard.down('w');
  await page.waitForTimeout(100);
  await page.keyboard.up('w');
  assert.deepEqual(await pose(), heldPose, 'WASD must not move active brush');
  await page.locator('#terrain-tilt').evaluate((n) => {
    n.value = '35';
    n.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.deepEqual(await pose(), heldPose, 'pose controls must not move active brush');
  assert.equal((await writes()).length, 0, 'camera input must not close/commit the active brush');
  await page.mouse.up();
  await waitMain('qaNavigationHeld');
  const firstWrites = await writes();
  assert.equal(firstWrites.length, 1);
  assert.equal(firstWrites[0].ok, true);
  assert.equal(canonical().revision, initial.revision + 1);
  session.mark('camera remains free while the real successful response is withheld');
  await changed('wheel pending acknowledgement', () => page.mouse.wheel(0, -120));
  await changed('middle pan pending acknowledgement', () => drag('middle', 25, 10));
  await changed('right orbit pending acknowledgement', () => drag('right', 40, 45));
  await changed('WASD pending acknowledgement', async () => {
    await page.locator('#campaign-map').focus();
    await page.keyboard.down('a');
    await page.waitForTimeout(100);
    await page.keyboard.up('a');
  });
  await page.locator('#atlas-pan').click();
  await changed('hand pan pending acknowledgement', () => drag('left', -25, -10));
  await page.locator('#atlas-view').click();
  await changed('pose control pending acknowledgement', () =>
    page.locator('#terrain-tilt').evaluate((n) => {
      n.value = '35';
      n.dispatchEvent(new Event('input', { bubbles: true }));
    }),
  );
  await page.locator('#atlas-view').click();
  assert.equal((await writes()).length, 1, 'navigation must never create author writes');
  await session.capture(page, 'pending-navigation');
  await session.app.evaluate(() => globalThis.qaNavigationRelease());
  await waitMain('qaNavigationFrameHeld');
  session.mark('camera remains free while a real terrain tile is withheld');
  const pendingBox = await page.locator('#campaign-map').boundingBox();
  await page.mouse.move(pendingBox.x + pendingBox.width / 2, pendingBox.y + pendingBox.height / 2);
  await changed('wheel pending terrain tile', () => page.mouse.wheel(0, 120));
  await session.app.evaluate(() => globalThis.qaNavigationFrameRelease());
  await page.waitForFunction(
    (revision) =>
      document.querySelector('#campaign-map').dataset.terrainAuthorRevision === String(revision) &&
      !document.querySelector('#campaign-map').dataset.terrainDraft,
    firstWrites[0].revision,
    { timeout: 60000 },
  );
  await atlasCanvasReady(page);
  assert.equal((await writes()).length, 1, 'the closed stroke must confirm exactly once');
  session.mark('paint at the moved visible terrain position and reopen');
  await page.locator('[data-tool-group="land"]').click();
  await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
  await atlasCanvasReady(page);
  const beforeSecond = canonical(),
    secondPose = await pose();
  const map = await page.locator('#campaign-map').boundingBox();
  const pixel = { x: map.x + map.width * 0.55, y: map.y + map.height * 0.65 };
  await page.mouse.move(pixel.x, pixel.y);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  await waitMain('qaNavigationSecondConfirmed');
  await page.waitForFunction(
    (revision) =>
      document.querySelector('#campaign-map').dataset.terrainAuthorRevision === String(revision),
    beforeSecond.revision + 1,
    { timeout: 60000 },
  );
  await atlasCanvasReady(page);
  const receipts = await writes(),
    afterSecond = canonical();
  assert.equal(receipts.length, 2);
  assert.equal(receipts[1].ok, true);
  assert.equal(afterSecond.revision, beforeSecond.revision + 1);
  const sample = receipts[1].command.action.stroke.samples[0];
  const height = new TerrainSampler(beforeSecond.heights).sample(sample).heightM;
  const projected = atlasProject(secondPose, sample, height);
  const paintDriftCssPx = Math.hypot(
    map.x + projected.x * map.width - pixel.x,
    map.y + projected.y * map.height - pixel.y,
  );
  assert(paintDriftCssPx < 2, 'new stroke must hit the visible terrain after navigation');
  assert.notDeepEqual(
    afterSecond.heights,
    beforeSecond.heights,
    'second stroke must change canonical heights',
  );
  checks.push({ name: 'new visible terrain stroke', sample, height, paintDriftCssPx, secondPose });
  await session.capture(page, 'new-location-painted');
  await session.close();
  await open(true);
  assert.deepEqual(canonical(), afterSecond, 'fresh open retains both exact canonical strokes');
  await session.capture(page, 'fresh-open');
  await session.close();
  const hashes = Object.fromEntries(
    await Promise.all(
      [
        'src/app/atlas/atlas-canvas.ts',
        'src/app/atlas/atlas-raster-presentation.ts',
        'src/app/atlas/atlas-camera.ts',
        'tools/test-desktop-atlas-navigation-pending.mjs',
      ].map(async (f) => [
        f,
        createHash('sha256')
          .update(await readFile(f))
          .digest('hex'),
      ]),
    ),
  );
  await session.finish({ scale, fixture, hashes, checks, initial, afterSecond, receipts });
  console.log(output);
} catch (error) {
  await writeFile(
    path.join(output, 'checks.partial.json'),
    JSON.stringify({ checks, writes: session.app ? await writes().catch(() => []) : [] }, null, 2),
  );
  await session.fail(error);
  throw error;
} finally {
  await session.dispose();
}
