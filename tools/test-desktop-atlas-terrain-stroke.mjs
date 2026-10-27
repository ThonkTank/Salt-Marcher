import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';

const root = process.cwd();
const output = path.resolve('.build/atlas-terrain-stroke', `${Date.now()}-${process.pid}`);
const native = await createNativeSession({ root, output, name: 'atlas-terrain-stroke' });
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
let page;
let fixture;
let phase = 'fixture setup';
const consoleEvents = [];
const sourceHashes = async () =>
  Object.fromEntries(
    await Promise.all(
      ['./tools/test-desktop-atlas-terrain-stroke.mjs', './tools/atlas-canonical-fixture.mjs', './tools/native-session.mjs', './tools/atlas-brush-probe.mjs'].map(
        async (file) => [
          file,
          createHash('sha256').update(await readFile(path.resolve(file))).digest('hex'),
        ],
      ),
    ),
  );
const revision = () => {
  const db = new Database(path.join(native.profile, 'workbench.sqlite'), { readonly: true });
  try {
    return db
      .prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?')
      .get(fixture.campaignId).revision;
  } finally {
    db.close();
  }
};
const heights = () => {
  const db = new Database(path.join(native.profile, 'workbench.sqlite'), { readonly: true });
  try {
    return db
      .prepare(
        "SELECT id,payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.height') IS NOT NULL ORDER BY id",
      )
      .all(fixture.campaignId)
      .map(({ id, payload }) => {
        const height = JSON.parse(payload).height;
        return { id, version: height.version, x: height.x, y: height.y, pixel: height.pixel, data: height.data };
      });
  } finally {
    db.close();
  }
};
const imageSample = async (page, x, y) =>
  page.evaluate(
    ({ x, y }) => {
      const canvas = document.querySelector('#atlas-terrain-spatial canvas');
      const gl = canvas?.getContext('webgl2');
      if (!gl) throw Error('Terrain WebGL2 canvas is unavailable');
      const rect = canvas.getBoundingClientRect();
      const size = 128;
      const cx = Math.round(((x - rect.left) / rect.width) * gl.drawingBufferWidth);
      const cy = Math.round((1 - (y - rect.top) / rect.height) * gl.drawingBufferHeight);
      const left = Math.max(0, Math.min(gl.drawingBufferWidth - size, cx - size / 2));
      const bottom = Math.max(0, Math.min(gl.drawingBufferHeight - size, cy - size / 2));
      const bytes = new Uint8Array(size * size * 4);
      const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(left, bottom, size, size, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
      return {
        bytes: Array.from(bytes),
        meta: {
          renderer: gl.getParameter(gl.RENDERER),
          vendor: gl.getParameter(gl.VENDOR),
          unmaskedRenderer: gl.getExtension('WEBGL_debug_renderer_info')
            ? gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL)
            : null,
          drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
          contextAttributes: gl.getContextAttributes(),
          sample: [left, bottom, size],
        },
      };
    },
    { x, y },
  );
const changedPixels = (a, b) => {
  let count = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12)
      count++;
  }
  return count;
};
const waitFrame = (page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function open() {
  page = await native.launch();
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const event = { launch: native.launches.length, phase, at: new Date().toISOString(), text: message.text() };
      consoleEvents.push(event);
      native.errors.push(message.text());
      console.log('renderer-console-error', JSON.stringify(event));
    }
  });
  await native.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1920, 1080),
  );
  await page.evaluate((id) => {
    sessionStorage.setItem('atlas-raster-workbench', 'true');
    localStorage.setItem(
      'atlas-camera:' + id,
      JSON.stringify({ x: -96, y: -64, width: 256, height: 192 }),
    );
  }, fixture.campaignId);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Terrain Stroke' })
    .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
    .click();
  await page.waitForFunction(
    () => document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
  );
  if (await page.locator('#campaign-atlas').isHidden()) {
    if (!(await page.locator('#atlas-tab').isVisible())) await page.locator('#workspace-nav-summary').click();
    await page.locator('#atlas-tab').click();
  }
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
    null,
    { timeout: 60000 },
  );
  assert.equal(await page.locator('#campaign-map').getAttribute('data-renderer'), 'deck');
  await page.locator('#atlas-section').selectOption('terrain');
  await page.locator('[data-tool-group="land"]').click();
  await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
  await page.locator('#atlas-units').selectOption('metric');
  await setBrushWorldRadius(page, 'land-radius', 8);
  await setHeightDirection(page, 'raise');
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
    null,
    { timeout: 60000 },
  );
}

try {
  fixture = await createAtlasCanonicalFixture({
    profilePath: native.profile,
    campaignName: 'Terrain Stroke',
  });
  const initialHeights = heights();
  const initial = revision();
  await open();
  const box = await page.locator('#campaign-map').boundingBox();
  assert(box);
  const x = box.x + box.width * 0.52;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await waitFrame(page);
  const baseline = await imageSample(page, x, y);
  await native.capture(page, '01-before.png');

  const gesture = async (offsetX, offsetY, durationMs) => {
    await page.mouse.move(x + offsetX, y + offsetY);
    await page.mouse.down();
    const start = performance.now();
    let visibleAtMs = null;
    let changed = 0;
    while (performance.now() - start < durationMs) {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / durationMs);
      await page.mouse.move(
        x + offsetX + 54 * progress,
        y + offsetY + 18 * Math.sin(progress * Math.PI),
      );
      await page.waitForTimeout(130);
      const current = await imageSample(page, x, y);
      changed = changedPixels(baseline.bytes, current.bytes);
      if (elapsed >= 2300 && changed > 10 && visibleAtMs === null) visibleAtMs = elapsed;
    }
    await page.mouse.up();
    return { heldMs: performance.now() - start, visibleAtMs, changedPixels: changed };
  };

  const first = await gesture(0, 0, 3600);
  console.log('first-stroke-observation', JSON.stringify(first));
  await native.capture(page, '02-first-stroke.png');
  // The second gesture intentionally begins before observing a receipt/revision for the first.
  const second = await gesture(18, 10, 900);
  console.log('follow-up-stroke-observation', JSON.stringify(second));
  await native.capture(page, '03-follow-up-stroke.png');
  await page.waitForFunction(
    () =>
      document.querySelector('#campaign-map').dataset.terrainReady === 'ready' &&
      document.querySelector('#campaign-map').dataset.terrainDraft === undefined &&
      !document.querySelector('#atlas-undo').disabled,
    null,
    { timeout: 60000 },
  );
  const savedHeights = heights();
  const savedRevision = revision();
  assert(savedRevision >= initial + 2, `Two confirmed gestures missing: ${initial} -> ${savedRevision}`);
  assert(initialHeights.length > 0, 'Fixture must contain canonical terrain heights');
  const beforeById = new Map(initialHeights.map((tile) => [tile.id, tile]));
  const changedTiles = savedHeights.filter((tile) => beforeById.get(tile.id)?.data !== tile.data);
  assert(changedTiles.length > 0, 'Canonical terrain height tiles did not change');
  assert(first.heldMs >= 3000 && first.heldMs <= 5000, `First stroke duration outside target: ${first.heldMs}`);
  assert(first.visibleAtMs !== null, 'No changed terrain pixels were observed before pointerup');

  const runtime = await page.evaluate(() => {
    const canvas = document.querySelector('#atlas-terrain-spatial canvas');
    const gl = canvas?.getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      userAgent: navigator.userAgent,
      devicePixelRatio,
      contentSize: [innerWidth, innerHeight],
      canvasSize: canvas && [canvas.width, canvas.height],
      glVendor: info ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : null,
      glRenderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null,
      draft: { ...document.querySelector('#campaign-map').dataset },
    };
  });
  const heightEvidence = changedTiles.map((tile) => ({
    id: tile.id,
    before: beforeById.has(tile.id)
      ? createHash('sha256').update(beforeById.get(tile.id).data).digest('hex')
      : null,
    after: createHash('sha256').update(tile.data).digest('hex'),
  }));
  phase = 'close initial app';
  await native.close();
  phase = 'after initial close';
  await page.waitForTimeout(200);
  phase = 'reopen campaign';
  await open();
  phase = 'fresh campaign open';
  const reopenedHeights = heights();
  assert.deepEqual(
    reopenedHeights.map(({ id, data }) => [id, data]),
    savedHeights.map(({ id, data }) => [id, data]),
    'Freshly reopened campaign did not retain canonical heights',
  );
  assert.equal(revision(), savedRevision);
  await native.capture(page, '04-reopened.png');
  phase = 'close reopened app';
  await native.close();
  phase = 'after reopened close';
  await writeFile(path.join(output, 'phase-errors.json'), JSON.stringify(consoleEvents, null, 2));
  await native.finish({
    initialRevision: initial,
    savedRevision,
    first,
    second,
    pixelObservation: {
      comparedCanvas: 'atlas terrain WebGL2 drawing buffer, fixed 128x128 world patch',
      thresholdPixels: 10,
      firstSample: baseline.meta,
      changedHeightTiles: heightEvidence,
    },
    runtime,
    sourceHashes: await sourceHashes(),
    consoleEvents,
    display: {
      requestedContentSize: [1920, 1080],
      sessionType: process.env.XDG_SESSION_TYPE ?? null,
      waylandDisplay: process.env.WAYLAND_DISPLAY ?? null,
      ozonePlatform: process.env.QA_OZONE_PLATFORM ?? 'default',
    },
    scope: 'Two continuous canonical height-paint strokes, immediate follow-up, fresh reopen.',
  });
  console.log(output);
} catch (error) {
  await writeFile(path.join(output, 'phase-errors.json'), JSON.stringify(consoleEvents, null, 2));
  if (page)
    console.log(
      await page
        .evaluate(() => ({
          status: document.querySelector('#land-status')?.textContent,
          save: document.querySelector('#atlas-save-status')?.textContent,
          canvas: document.querySelector('#campaign-map')?.dataset,
          error: document.querySelector('#status')?.textContent,
        }))
        .catch(() => null),
    );
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
