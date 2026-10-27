// Focused native camera qualification on the durable terrain fixture.
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/atlas-camera';export {TerrainSampler} from './src/app/atlas/terrain-height';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/navigation-terrain-math.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  atlasProject,
  atlasAnchorCamera,
  atlasCameraWorldEye,
  TerrainSampler,
} = require('../.build/navigation-terrain-math.cjs');
const Database = require('better-sqlite3');
const scale = Number(process.argv.find((s) => s.startsWith('--scale='))?.split('=')[1] ?? 1);
assert([1, 2].includes(scale));
const output = path.resolve('.build/navigation-terrain', `${Date.now()}-${process.pid}`);
const native = await createNativeSession({ name: 'navigation-terrain', output });
const fixture = await createAtlasCanonicalFixture({
  profilePath: native.profile,
  campaignName: 'Terrain Camera',
  includeCity: false,
  peak: { x: 24, y: 24 },
  baseHeightM: 20,
  peakRiseM: 25,
  hillScale: 80,
});
const checks = [];
const files = [
  'src/app/atlas/atlas-camera.ts',
  'src/app/atlas/atlas-canvas.ts',
  'src/app/atlas/atlas-raster-presentation.ts',
  'src/app/atlas/campaign-atlas-ui.ts',
  'tools/test-desktop-atlas-navigation-terrain.mjs',
];
const hashes = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [
      f,
      createHash('sha256')
        .update(await readFile(f))
        .digest('hex'),
    ]),
  ),
);
let page;
function records() {
  const db = new Database(fixture.filename, { readonly: true });
  try {
    return db
      .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=?')
      .all(fixture.campaignId)
      .map((r) => JSON.parse(r.payload));
  } finally {
    db.close();
  }
}
const initialRecords = JSON.stringify(records());
const sampler = new TerrainSampler(records());
const pose = () =>
  page.locator('#campaign-map').evaluate((n) => JSON.parse(n.dataset.terrainProjection));
const view = () => page.locator('#campaign-map').getAttribute('data-atlas-view');
async function open() {
  page = await native.launch(scale);
  await native.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1920, 1080),
  );
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
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Terrain Camera' })
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
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
    null,
    { timeout: 60000 },
  );
}
async function point(p) {
  const v = await pose(),
    box = await page.locator('#campaign-map').boundingBox();
  const projected = atlasProject(v, p, p.heightM);
  return { x: box.x + projected.x * box.width, y: box.y + projected.y * box.height };
}
async function drag(from, dx, dy, button) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 12 });
  await page.mouse.up({ button });
  await page.waitForTimeout(250);
}
async function anchored(name, p, action, delta = { x: 0, y: 0 }) {
  const before = await point(p),
    oldPose = await pose();
  await action(before);
  const after = await point(p),
    next = await pose();
  const driftCssPx = Math.hypot(after.x - before.x - delta.x, after.y - before.y - delta.y);
  checks.push({ name, driftCssPx, oldPose, next, before, after });
  assert(driftCssPx < 1.1, `${name}: terrain anchor drift ${driftCssPx} CSS px`);
  assert.notDeepEqual(next, oldPose, name + ' must move');
}
async function setPose(tilt, rotation) {
  if (!(await page.locator('#atlas-view-popup').evaluate((n) => n.matches(':popover-open'))))
    await page.locator('#atlas-view').click();
  for (const [id, value] of [
    ['terrain-tilt', tilt],
    ['terrain-rotation', rotation],
  ])
    await page.locator('#' + id).evaluate((n, value) => {
      n.value = String(value);
      n.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => !document.querySelector('#atlas-view-popup').matches(':popover-open'),
  );
  await page.waitForTimeout(200);
}
try {
  native.mark('open height landscape');
  await open();
  const runtime = await page.evaluate(() => {
    const canvas = document.querySelector('#atlas-terrain-spatial canvas'),
      gl = canvas.getContext('webgl2'),
      info = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      dpr: devicePixelRatio,
      contentSize: [innerWidth, innerHeight],
      canvas: [canvas.width, canvas.height],
      renderer: gl.getParameter(gl.RENDERER),
      gpu: info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
      dataset: { ...document.querySelector('#campaign-map').dataset },
    };
  });
  assert.equal(runtime.dataset.renderer, 'deck');
  const elevated = { x: 24, y: 24, heightM: 45 };
  await native.capture(page, 'initial-terrain');
  native.mark('right orbit, terrain cursor zoom, middle and hand pan');
  await anchored('right orbit elevated anchor', elevated, (p) => drag(p, 70, 80, 'right'));
  const orbit = await pose();
  assert(Math.abs(orbit.tilt - 20) < 0.001);
  assert(Math.abs(orbit.rotation - 21) < 0.001);
  await anchored('wheel elevated anchor', elevated, async (p) => {
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(350);
  });
  await anchored('middle pan elevated anchor', elevated, (p) => drag(p, 45, 20, 'middle'), {
    x: 45,
    y: 20,
  });
  await page.locator('#atlas-pan').click();
  await anchored('hand pan elevated anchor', elevated, (p) => drag(p, -35, -15, 'left'), {
    x: -35,
    y: -15,
  });
  await native.capture(page, 'orbit-zoom-pan');
  native.mark('rotated WASD, text focus and movement stop');
  await setPose(40, 90);
  await page.locator('#campaign-map').focus();
  const beforeKey = await pose();
  await page.keyboard.down('w');
  await page.waitForTimeout(180);
  await page.keyboard.up('w');
  const afterKey = await pose();
  const keyEyeBefore = atlasCameraWorldEye(beforeKey),
    keyEyeAfter = atlasCameraWorldEye(afterKey);
  assert(keyEyeAfter.x < keyEyeBefore.x);
  assert(Math.abs(keyEyeAfter.y - keyEyeBefore.y) < 0.001);
  checks.push({ name: 'rotated WASD', beforeKey, afterKey });
  await page.locator('#atlas-search').focus();
  const textBefore = await view();
  await page.keyboard.type('wasd');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#atlas-search').inputValue(), 'wasd');
  assert.equal(await view(), textBefore);
  await page.locator('#atlas-search').fill('');
  await page.locator('#campaign-map').focus();
  await page.keyboard.down('d');
  await page.waitForTimeout(100);
  await page.locator('#atlas-search').focus();
  await page.waitForTimeout(60);
  const blurView = await view();
  await page.waitForTimeout(200);
  assert.equal(await view(), blurView);
  await page.keyboard.up('d');
  checks.push({ name: 'text WASD and focus loss stop', unchanged: true });
  native.mark('keyboard modifiers, dialogs and pointer lifecycle');
  await page.locator('#campaign-map').focus();
  await page.keyboard.down('w');
  await page.waitForTimeout(70);
  await page.keyboard.down('Control');
  await page.waitForTimeout(60);
  const modifierView = await view();
  await page.waitForTimeout(150);
  assert.equal(await view(), modifierView);
  await page.keyboard.up('w');
  await page.keyboard.up('Control');
  await page.locator('#campaign-map').focus();
  await page.evaluate(() => {
    const dialog = document.createElement('dialog');
    dialog.id = 'qa-camera-dialog';
    document.body.append(dialog);
    dialog.showModal();
  });
  const dialogView = await view();
  await page.keyboard.type('wasd');
  await page.waitForTimeout(100);
  assert.equal(await view(), dialogView);
  await page.evaluate(() => {
    document.querySelector('#qa-camera-dialog').close();
    document.querySelector('#qa-camera-dialog').remove();
  });
  const middle = await page.locator('#campaign-map').boundingBox();
  await page.evaluate(() =>
    window.addEventListener(
      'pointerdown',
      (event) => {
        if (event.target.id === 'campaign-map') window.qaCameraPointer = event.pointerId;
      },
      true,
    ),
  );
  for (const end of ['pointercancel', 'lostpointercapture', 'blur']) {
    const x = middle.x + middle.width / 2,
      y = middle.y + middle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(x + 12, y + 12, { steps: 3 });
    await page.evaluate((end) => {
      const map = document.querySelector('#campaign-map');
      if (end === 'lostpointercapture') map.releasePointerCapture(window.qaCameraPointer);
      else if (end === 'blur') window.dispatchEvent(new Event('blur'));
      else
        map.dispatchEvent(
          new PointerEvent('pointercancel', { pointerId: window.qaCameraPointer, bubbles: true }),
        );
    }, end);
    await page.waitForTimeout(50);
    const stopped = await pose();
    await page.mouse.move(x + 35, y + 35, { steps: 3 });
    await page.mouse.up({ button: 'right' });
    assert.deepEqual(await pose(), stopped, end + ' must end the orbit');
    checks.push({ name: end + ' ends orbit', stopped });
  }
  checks.push({ name: 'modifier and dialog focus guards', unchanged: true });
  await native.close();
  await open();
  native.mark('75 degree steep terrain collision');
  await setPose(75, 0);
  assert(Math.abs((await pose()).tilt - 75) < 0.001);
  await page.evaluate(() => {
    window.qaCameraPoses = [];
    window.qaCameraSampling = true;
    function sample() {
      if (!window.qaCameraSampling) return;
      const n = document.querySelector('#campaign-map');
      window.qaCameraPoses.push(JSON.parse(n.dataset.terrainProjection));
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  const collisionBox = await page.locator('#campaign-map').boundingBox();
  const collisionBefore = await pose();
  await page.mouse.move(
    collisionBox.x + collisionBox.width / 2,
    collisionBox.y + collisionBox.height / 2,
  );
  const approachWidths = [];
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, -5000);
    await page.waitForTimeout(220);
    approachWidths.push((await pose()).frame.width);
  }
  const collision = await pose();
  assert(
    Math.abs(approachWidths.at(-1) - approachWidths.at(-2)) < 0.001,
    'repeated inward zoom must stop at safe ground clearance',
  );
  assert(
    collision.frame.width < collisionBefore.frame.width,
    'steep zoom must actually move the camera',
  );
  const orbitBox = await page.locator('#campaign-map').boundingBox();
  const orbitStart = await pose();
  await page.mouse.move(orbitBox.x + orbitBox.width / 2, orbitBox.y + orbitBox.height / 2);
  await page.mouse.down({ button: 'right' });
  const orbitAnchor = await page
    .locator('#campaign-map')
    .evaluate((n) => JSON.parse(n.dataset.navigationAnchor));
  const requestedOrbit = atlasAnchorCamera({ ...orbitStart, rotation: 180 }, orbitAnchor);
  const requestedEye = atlasCameraWorldEye(requestedOrbit);
  const requestedGround = sampler.sample(requestedEye).heightM;
  assert(
    requestedEye.heightM < requestedGround,
    'requested orbit must actually enter the canonical steep hill',
  );
  await page.mouse.move(orbitBox.x + orbitBox.width / 2 + 600, orbitBox.y + orbitBox.height / 2, {
    steps: 24,
  });
  await page.mouse.up({ button: 'right' });
  const blockedOrbit = await pose();
  assert(
    Math.abs(blockedOrbit.rotation) < 175,
    'terrain must stop the requested 180 degree eye orbit',
  );
  checks.push({
    name: 'steep hill orbit collision',
    requestedOrbit,
    requestedEye,
    requestedGround,
    blockedOrbit,
  });
  const sampled = await page.evaluate(() => {
    window.qaCameraSampling = false;
    return window.qaCameraPoses;
  });
  const clearances = sampled.map((v) => {
    const eye = atlasCameraWorldEye(v);
    return {
      eye,
      ground: sampler.sample(eye).heightM,
      gapM: eye.heightM - sampler.sample(eye).heightM,
    };
  });
  for (const c of clearances)
    assert(c.gapM > 0, `eye under canonical terrain: ${JSON.stringify(c)}`);
  checks.push({ name: 'aggressive steep zoom', collision, approachWidths, clearances });
  await native.capture(page, 'steep-zoom-collision');
  native.mark('navigation across several scales');
  await setPose(0, 0);
  const scaleBox = await page.locator('#campaign-map').boundingBox();
  await page.mouse.move(scaleBox.x + scaleBox.width / 2, scaleBox.y + scaleBox.height / 2);
  const widths = [(await pose()).frame.width];
  for (let i = 0; i < 12 && widths.at(-1) / widths[0] <= 100; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(300);
    widths.push((await pose()).frame.width);
  }
  checks.push({ name: 'several zoom orders', widths });
  assert(widths.at(-1) / widths[0] > 100);
  for (let i = 0; i < widths.length - 1; i++) {
    await page.mouse.wheel(0, -900);
    await page.waitForTimeout(200);
  }
  native.mark('focus-plane fallback while new terrain coverage is withheld');
  await setPose(0, 0);
  const fallbackOverviewBox = await page.locator('#campaign-map').boundingBox();
  await page.mouse.move(
    fallbackOverviewBox.x + fallbackOverviewBox.width / 2,
    fallbackOverviewBox.y + fallbackOverviewBox.height / 2,
  );
  for (let i = 0; i < 12 && (await pose()).frame.width < 64; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(220);
  }
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
    null,
    { timeout: 60000 },
  );
  await native.app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get('atlas:terrain-tile');
    const state = (globalThis.qaCameraTileHold = { holding: true, releases: [], calls: 0 });
    ipcMain.removeHandler('atlas:terrain-tile');
    ipcMain.handle('atlas:terrain-tile', async (...args) => {
      const result = await original(...args);
      if (state.holding && result.ok) {
        state.calls++;
        await new Promise((resolve) => state.releases.push(resolve));
      }
      return result;
    });
  });
  const fallbackBox = await page.locator('#campaign-map').boundingBox();
  await drag(
    { x: fallbackBox.x + fallbackBox.width / 2, y: fallbackBox.y + fallbackBox.height / 2 },
    -fallbackBox.width * 12,
    0,
    'middle',
  );
  const fallbackPose = await pose();
  const fallbackPoint = {
    x: fallbackPose.frame.x + fallbackPose.frame.width / 2,
    y: fallbackPose.frame.y + fallbackPose.frame.height / 2,
    heightM: fallbackPose.focusM,
  };
  await anchored('focus-plane fallback cursor zoom', fallbackPoint, async (p) => {
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(300);
  });
  const fallbackAnchor = await page
    .locator('#campaign-map')
    .evaluate((n) => JSON.parse(n.dataset.navigationAnchor));
  assert.equal(
    fallbackAnchor.source,
    'focus-plane',
    'probe must actually exercise missing-terrain fallback',
  );
  const beforeCoverageEye = atlasCameraWorldEye(await pose());
  const heldCoverage = await native.app.evaluate(() => {
    const state = globalThis.qaCameraTileHold;
    state.holding = false;
    for (const resolve of state.releases) resolve();
    return state.calls;
  });
  assert(heldCoverage > 0, 'real new terrain coverage must have been withheld');
  checks.push({ name: 'missing-terrain fallback source', fallbackAnchor, heldCoverage });
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
    null,
    { timeout: 60000 },
  );
  await atlasCanvasReady(page);
  const afterCoverageEye = atlasCameraWorldEye(await pose());
  assert(
    Math.hypot(
      afterCoverageEye.x - beforeCoverageEye.x,
      afterCoverageEye.y - beforeCoverageEye.y,
      afterCoverageEye.heightM - beforeCoverageEye.heightM,
    ) < 1e-5,
    'coverage adoption must retain the physical camera',
  );
  await native.capture(page, 'fallback-and-reloaded-terrain');
  await native.close();
  native.mark('fresh open after normal close');
  await open();
  assert.equal(
    JSON.stringify(records()),
    initialRecords,
    'camera input must preserve canonical authored terrain',
  );
  await native.capture(page, 'fresh-open');
  await native.close();
  await native.finish({ scale, fixture, hashes, runtime, checks });
  console.log(output);
} catch (error) {
  await writeFile(
    path.join(output, 'checks.partial.json'),
    JSON.stringify({ scale, checks }, null, 2),
  );
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
