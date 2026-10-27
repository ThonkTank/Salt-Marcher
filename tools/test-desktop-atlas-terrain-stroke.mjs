import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';

const root = process.cwd();
const output = path.resolve('.build/atlas-terrain-stroke', `${Date.now()}-${process.pid}`);
await mkdir(output, { recursive: true });
const native = await createNativeSession({ root, output, name: 'atlas-terrain-stroke' });
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const PNG = require('pngjs').PNG;
const evidence = {
  output,
  phases: [],
  checks: {},
  failures: [],
  consoleEvents: [],
  gestures: {},
  runtime: null,
  lifecycle: [],
};
let phase = 'fixture setup';
let fixture;
let page;

const sha = (data) => createHash('sha256').update(data).digest('hex');
const sourceFiles = [
  './src/app/workspace/renderer.ts',
  './src/app/workspace/workspace-editors.ts',
  './tools/test-desktop-atlas-terrain-stroke.mjs',
  './tools/atlas-canonical-fixture.mjs',
  './tools/native-session.mjs',
  './tools/atlas-brush-probe.mjs',
];
const persist = async () =>
  writeFile(path.join(output, 'evidence.partial.json'), JSON.stringify(evidence, null, 2));
function mark(name) {
  phase = name;
  evidence.phases.push({ name, at: new Date().toISOString(), launch: native.launches.length });
  native.mark(name);
}
function check(name, passed, details = {}) {
  const status = passed ? 'PASS' : 'FAIL';
  evidence.checks[name] = { ...details, status };
  if (!passed)
    evidence.failures.push({ phase, check: name, at: new Date().toISOString(), ...details });
}
function noteError(where, error) {
  evidence.failures.push({
    phase: where,
    at: new Date().toISOString(),
    error: error?.stack ?? String(error),
  });
}
const sourceHashes = async () =>
  Object.fromEntries(
    await Promise.all(sourceFiles.map(async (file) => [file, sha(await readFile(file))])),
  );
function queryRevision() {
  const db = new Database(path.join(native.profile, 'workbench.sqlite'), { readonly: true });
  try {
    return db
      .prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?')
      .get(fixture.campaignId).revision;
  } finally {
    db.close();
  }
}
function queryHeights() {
  const db = new Database(path.join(native.profile, 'workbench.sqlite'), { readonly: true });
  try {
    return db
      .prepare(
        "SELECT id,payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.height') IS NOT NULL ORDER BY id",
      )
      .all(fixture.campaignId)
      .map(({ id, payload }) => {
        const height = JSON.parse(payload).height;
        return {
          id,
          version: height.version,
          x: height.x,
          y: height.y,
          pixel: height.pixel,
          data: height.data,
        };
      });
  } finally {
    db.close();
  }
}
async function saveJson(name, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  await writeFile(path.join(output, name), bytes);
  return { file: name, sha256: sha(bytes), bytes: bytes.length };
}
async function savePatch(name, bytes) {
  const png = new PNG({ width: 128, height: 128 });
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const from = ((127 - y) * 128 + x) * 4;
      const to = (y * 128 + x) * 4;
      for (let c = 0; c < 4; c++) png.data[to + c] = bytes[from + c];
    }
  const encoded = PNG.sync.write(png);
  await writeFile(path.join(output, name), encoded);
  return { file: name, sha256: sha(encoded) };
}
function pixelDelta(a, b) {
  let count = 0;
  for (let i = 0; i < a.length; i += 4)
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12)
      count++;
  return count;
}
async function sample(page, x, y) {
  return page.evaluate(
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
      const pixels = new Uint8Array(size * size * 4);
      const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(left, bottom, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
      return {
        bytes: Array.from(pixels),
        sampledAt: performance.now(),
        patch: { left, bottom, size },
        drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      };
    },
    { x, y },
  );
}
async function openCampaign() {
  page = await native.launch();
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const item = {
        launch: native.launches.length,
        phase,
        at: new Date().toISOString(),
        text: message.text(),
      };
      evidence.consoleEvents.push(item);
      native.errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    evidence.failures.push({
      phase,
      pageError: error.stack ?? String(error),
      at: new Date().toISOString(),
    });
  });
  await native.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1920, 1080),
  );
  await page.evaluate((id) => {
    sessionStorage.setItem('atlas-raster-workbench', 'true');
    localStorage.setItem(
      'atlas-camera:' + id,
      JSON.stringify({ x: 0, y: 0, width: 64, height: 64 }),
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
    () =>
      document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
  );
  if (await page.locator('#campaign-atlas').isHidden()) {
    if (!(await page.locator('#atlas-tab').isVisible()))
      await page.locator('#workspace-nav-summary').click();
    await page.locator('#atlas-tab').click();
  }
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
    null,
    { timeout: 60000 },
  );
  const renderer = await page.locator('#campaign-map').getAttribute('data-renderer');
  check('renderer-is-deck', renderer === 'deck', { renderer });
  await page.locator('#atlas-section').selectOption('terrain');
  await page.locator('[data-tool-group="land"]').click();
  await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
  await page.locator('#atlas-units').selectOption('metric');
  await setBrushWorldRadius(page, 'land-radius', 8);
  await setHeightDirection(page, 'raise');
  await page.locator('#land-height-strength').fill('1');
  await page.locator('#land-height-strength').press('Tab');
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
    null,
    { timeout: 60000 },
  );
  evidence.runtime = await page.evaluate(() => {
    const canvas = document.querySelector('#atlas-terrain-spatial canvas');
    const gl = canvas?.getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      userAgent: navigator.userAgent,
      dpr: devicePixelRatio,
      contentSize: [innerWidth, innerHeight],
      canvasSize: canvas && [canvas.width, canvas.height],
      webglVendor: gl && gl.getParameter(gl.VENDOR),
      webglRenderer: gl && gl.getParameter(gl.RENDERER),
      unmaskedVendor: info && gl.getParameter(info.UNMASKED_VENDOR_WEBGL),
      unmaskedRenderer: info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
      contextAttributes: gl?.getContextAttributes(),
      mapDataset: { ...document.querySelector('#campaign-map').dataset },
    };
  });
  await page.evaluate(() => {
    if (window.__qaTerrainStrokeHandlers) return;
    window.__qaTerrainStrokeHandlers = true;
    window.__qaTerrainStrokeInputs = [];
    window.__qaTerrainStrokes = {};
    window.__qaTerrainCurrentStroke = null;
    window.addEventListener(
      'pointermove',
      (event) => {
        if (!event.target.closest?.('#campaign-map')) return;
        for (const state of Object.values(window.__qaTerrainStrokes))
          if (state.active) state.pointer = { x: event.clientX, y: event.clientY };
      },
      true,
    );
    for (const type of ['pointerdown', 'pointerup'])
      window.addEventListener(
        type,
        (event) => {
          if (!event.target.closest?.('#campaign-map')) return;
          const label = window.__qaTerrainCurrentStroke;
          window.__qaTerrainStrokeInputs.push({
            label,
            type,
            at: performance.now(),
            iso: new Date().toISOString(),
            x: event.clientX,
            y: event.clientY,
            button: event.button,
          });
          if (type === 'pointerdown' && label && window.__qaTerrainStrokes[label])
            window.__qaTerrainStrokes[label].pointer = { x: event.clientX, y: event.clientY };
          if (type === 'pointerup' && label) {
            const state = window.__qaTerrainStrokes[label];
            if (state) {
              state.active = false;
              if (state.frame) cancelAnimationFrame(state.frame);
            }
            window.__qaTerrainCurrentStroke = null;
          }
        },
        true,
      );
  });
  await persist();
}
async function beginPixelObserver(label, baseline, watch, safeDistancePx) {
  await page.evaluate(
    ({ label, baseline, watch, safeDistancePx }) => {
      const canvas = document.querySelector('#atlas-terrain-spatial canvas');
      const gl = canvas?.getContext('webgl2');
      if (!gl) throw Error('Cannot start terrain pixel observer without WebGL2');
      const state = {
        label,
        baseline: new Uint8Array(baseline),
        watch,
        safeDistancePx,
        active: false,
        pointer: null,
        first: null,
        maxChanged: 0,
        lastSample: 0,
        canvas,
        gl,
      };
      window.__qaTerrainStrokes[label] = state;
      window.__qaTerrainCurrentStroke = label;
      const tick = (now) => {
        if (!state.active) return;
        if (
          now - state.lastSample >= 100 &&
          state.pointer &&
          Math.hypot(state.pointer.x - watch.x, state.pointer.y - watch.y) >= safeDistancePx
        ) {
          state.lastSample = now;
          const rect = state.canvas.getBoundingClientRect(),
            size = 128;
          const cx = Math.round(((watch.x - rect.left) / rect.width) * state.gl.drawingBufferWidth);
          const cy = Math.round(
            (1 - (watch.y - rect.top) / rect.height) * state.gl.drawingBufferHeight,
          );
          const left = Math.max(0, Math.min(state.gl.drawingBufferWidth - size, cx - size / 2));
          const bottom = Math.max(0, Math.min(state.gl.drawingBufferHeight - size, cy - size / 2));
          const pixels = new Uint8Array(size * size * 4),
            previous = state.gl.getParameter(state.gl.READ_FRAMEBUFFER_BINDING);
          state.gl.bindFramebuffer(state.gl.READ_FRAMEBUFFER, null);
          state.gl.readPixels(
            left,
            bottom,
            size,
            size,
            state.gl.RGBA,
            state.gl.UNSIGNED_BYTE,
            pixels,
          );
          state.gl.bindFramebuffer(state.gl.READ_FRAMEBUFFER, previous);
          let changed = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (
              Math.abs(pixels[i] - state.baseline[i]) +
                Math.abs(pixels[i + 1] - state.baseline[i + 1]) +
                Math.abs(pixels[i + 2] - state.baseline[i + 2]) >
              12
            )
              changed++;
          state.maxChanged = Math.max(state.maxChanged, changed);
          if (changed > 10 && !state.first)
            state.first = {
              sampledAt: performance.now(),
              iso: new Date().toISOString(),
              changedPixels: changed,
              cursorDistancePx: Math.hypot(state.pointer.x - watch.x, state.pointer.y - watch.y),
              patch: { left, bottom, size },
              pixels: Array.from(pixels),
            };
        }
        state.frame = requestAnimationFrame(tick);
      };
      state.tick = tick;
    },
    { label, baseline, watch, safeDistancePx },
  );
}
async function runGesture(label, start, end, watch, box, baseline, durationMs) {
  const safeDistancePx = box.width * 0.19;
  await beginPixelObserver(label, baseline.bytes, watch, safeDistancePx);
  const eventBefore = await page.evaluate(() => window.__qaTerrainStrokeInputs.length);
  await page.mouse.move(start.x, start.y);
  await page.evaluate(() => {
    const state = window.__qaTerrainStrokes[window.__qaTerrainCurrentStroke];
    state.active = true;
    state.frame = requestAnimationFrame(state.tick);
  });
  const requestedAt = Date.now();
  let upAttempted = false;
  try {
    await page.mouse.down();
    while (Date.now() - requestedAt < durationMs) {
      const elapsed = Date.now() - requestedAt;
      const p = Math.min(1, elapsed / durationMs);
      await page.mouse.move(start.x + (end.x - start.x) * p, start.y + (end.y - start.y) * p);
      await page.waitForTimeout(125);
      if (Date.now() - requestedAt >= 4700) break;
    }
    await page.mouse.move(end.x, end.y);
  } catch (error) {
    noteError(`${label}: pointer movement`, error);
  } finally {
    phase = `${label}: pointerup`;
    upAttempted = true;
    await page.mouse.up().catch((error) => noteError(`${label}: pointerup`, error));
  }
  evidence.gestures[label] = {
    requestedAt: new Date(requestedAt).toISOString(),
    durationTargetMs: durationMs,
    inputEventStartIndex: eventBefore,
    upAttempted,
    pathScreen: [start, end],
    watchPoint: watch,
    baselinePatch: baseline.file,
    baselineSha256: baseline.sha256,
    safeCursorDistancePx: safeDistancePx,
  };
  await persist();
}
function valueAt(tile, index) {
  return tile ? Buffer.from(tile.data, 'base64').readFloatLE(index * 4) : Number.NaN;
}
function pointSegmentDistance(x, y, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2)) : 0;
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}
function heightDiff(before, after, view, paths, radiusM) {
  const beforeById = new Map(before.map((tile) => [tile.id, tile]));
  const afterById = new Map(after.map((tile) => [tile.id, tile]));
  const nodes = [];
  for (const tile of after) {
    const old = beforeById.get(tile.id);
    const oldBytes = old && Buffer.from(old.data, 'base64');
    const nextBytes = Buffer.from(tile.data, 'base64');
    for (let i = 0; i < 4096; i++) {
      const oldValue = oldBytes ? oldBytes.readFloatLE(i * 4) : Number.NaN;
      const newValue = nextBytes.readFloatLE(i * 4);
      const equal =
        (Number.isNaN(oldValue) && Number.isNaN(newValue)) ||
        (!Number.isNaN(oldValue) &&
          !Number.isNaN(newValue) &&
          Math.abs(oldValue - newValue) <= 1e-6);
      if (equal) continue;
      nodes.push({
        tile: tile.id,
        x: tile.x + (i % 64) * tile.pixel,
        y: tile.y + Math.floor(i / 64) * tile.pixel,
        before: Number.isNaN(oldValue) ? null : oldValue,
        after: Number.isNaN(newValue) ? null : newValue,
      });
    }
  }
  const regions = paths.map((path) => {
    const changed = nodes.filter(
      (node) => pointSegmentDistance(node.x, node.y, path.a, path.b) <= radiusM,
    );
    return {
      gesture: path.label,
      segment: [path.a, path.b],
      radiusM,
      changedNodeCount: changed.length,
      positiveRaiseCount: changed.filter(
        (node) => node.after !== null && (node.before === null || node.after > node.before),
      ).length,
    };
  });
  const removedTileIds = before.filter((tile) => !afterById.has(tile.id)).map((tile) => tile.id);
  return { nodeCount: nodes.length, regions, removedTileIds, nodes };
}

try {
  mark('fixture creation');
  fixture = await createAtlasCanonicalFixture({
    profilePath: native.profile,
    campaignName: 'Terrain Stroke',
    includeCity: false,
    peak: { x: 32, y: 32 },
    baseHeightM: 2,
    peakRiseM: 1.5,
    hillScale: 350,
  });
  evidence.fixture = fixture;
  evidence.profile = native.profile;
  evidence.source = native.source;
  evidence.artifacts = native.artifacts;
  evidence.sourceHashes = await sourceHashes();
  evidence.runtimeBinding = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    display: {
      sessionType: process.env.XDG_SESSION_TYPE ?? null,
      waylandDisplay: process.env.WAYLAND_DISPLAY ?? null,
      ozone: process.env.QA_OZONE_PLATFORM ?? null,
    },
  };
  const initialHeights = queryHeights();
  const initialRevision = queryRevision();
  evidence.beforeHeightsFile = await saveJson('height-before.json', initialHeights);
  await persist();

  mark('open initial campaign');
  await openCampaign();
  mark('capture baselines and quiet-start control');
  const mapBox = await page.locator('#campaign-map').boundingBox();
  const view =
    (await page
      .locator('#campaign-map')
      .getAttribute('data-atlas-view')
      .then((x) => (x ? JSON.parse(x) : null))
      .catch(() => null)) ??
    (await page.locator('#campaign-map').evaluate((el) => JSON.parse(el.dataset.atlasView)));
  if (!mapBox || !view) throw Error('Cannot determine visible atlasView and map bounds');
  evidence.visibleAtlasView = view;
  const screen = (u, v) => ({ x: mapBox.x + mapBox.width * u, y: mapBox.y + mapBox.height * v });
  const world = (u, v) => ({ x: view.x + view.width * u, y: view.y + view.height * v });
  const watchOne = screen(0.5, 0.22),
    watchTwo = screen(0.5, 0.78);
  await page.mouse.move(mapBox.x + mapBox.width * 0.03, mapBox.y + mapBox.height * 0.95);
  await page.waitForTimeout(300);
  const baselineOne = await sample(page, watchOne.x, watchOne.y);
  const baselineOneFile = await savePatch(
    'gesture1-baseline.png',
    Uint8Array.from(baselineOne.bytes),
  );
  await page.waitForTimeout(200);
  const quiet = await sample(page, watchOne.x, watchOne.y);
  const quietPixels = pixelDelta(baselineOne.bytes, quiet.bytes);
  check('quiet-start-patch', quietPixels <= 10, {
    delayMs: 200,
    changedPixels: quietPixels,
    method:
      'Brush cursor parked outside both watched patches; terrain canvas patch sampled twice before input.',
  });
  const baselineTwo = await sample(page, watchTwo.x, watchTwo.y);
  const baselineTwoFile = await savePatch(
    'gesture2-baseline.png',
    Uint8Array.from(baselineTwo.bytes),
  );
  evidence.baselines = {
    one: { ...baselineOneFile, patch: baselineOne.patch },
    two: { ...baselineTwoFile, patch: baselineTwo.patch },
  };
  await native.capture(page, '01-before.png');
  await persist();

  const pathOne = { label: 'one', a: world(0.1, 0.22), b: world(0.9, 0.22) };
  const pathTwo = { label: 'two', a: world(0.1, 0.78), b: world(0.9, 0.78) };
  evidence.gestures.worldSegments = [pathOne, pathTwo];
  const startOne = screen(0.1, 0.22),
    endOne = screen(0.9, 0.22);
  mark('gesture one: continuous height stroke');
  await runGesture(
    'one',
    startOne,
    endOne,
    watchOne,
    mapBox,
    { ...baselineOneFile, bytes: baselineOne.bytes },
    3600,
  );
  mark('gesture two: immediate follow-up without receipt wait');
  const startTwo = screen(0.1, 0.78),
    endTwo = screen(0.9, 0.78);
  await runGesture(
    'two',
    startTwo,
    endTwo,
    watchTwo,
    mapBox,
    { ...baselineTwoFile, bytes: baselineTwo.bytes },
    1800,
  );
  await native.capture(page, '02-after-two-strokes.png');

  mark('collect pre-up pixel observations and actual pointer events');
  const observations = await page.evaluate(() => {
    const strokes = window.__qaTerrainStrokes;
    for (const state of Object.values(strokes)) {
      state.active = false;
      if (state.frame) cancelAnimationFrame(state.frame);
    }
    const result = {};
    for (const [label, state] of Object.entries(strokes)) {
      const inputs = window.__qaTerrainStrokeInputs.filter((event) => event.label === label);
      result[label] = {
        inputs,
        first: state.first,
        maxChangedPixels: state.maxChanged,
        safeCursorDistancePx: state.safeDistancePx,
      };
    }
    return result;
  });
  for (const label of ['one', 'two']) {
    const obs = observations[label];
    const down = obs?.inputs.find((event) => event.type === 'pointerdown');
    const up = [...(obs?.inputs ?? [])].reverse().find((event) => event.type === 'pointerup');
    const first = obs?.first;
    if (first?.pixels) {
      const file = await savePatch(
        `gesture${label === 'one' ? '1' : '2'}-first-changed.png`,
        Uint8Array.from(first.pixels),
      );
      evidence.gestures[label].firstChanged = {
        ...file,
        sampleAt: first.iso,
        sampledPerformanceMs: first.sampledAt,
        changedPixels: first.changedPixels,
        cursorDistancePx: first.cursorDistancePx,
        patch: first.patch,
      };
    }
    if (down && up) {
      evidence.gestures[label].input = {
        downAt: down.iso,
        downPerformanceMs: down.at,
        downPoint: [down.x, down.y],
        upAt: up.iso,
        upPerformanceMs: up.at,
        upPoint: [up.x, up.y],
        actualHeldMs: up.at - down.at,
      };
    } else {
      check(`gesture-${label}-pointer-events`, false, { down: !!down, up: !!up });
    }
    check(
      `gesture-${label}-pre-up-terrain-pixels`,
      !!first &&
        !!down &&
        !!up &&
        first.sampledAt >= down.at &&
        first.sampledAt < up.at &&
        first.changedPixels > 10 &&
        first.cursorDistancePx >= obs.safeCursorDistancePx,
      {
        sampleObserved: !!first,
        sampleInsidePointerDown:
          !!first && !!down && !!up && first.sampledAt >= down.at && first.sampledAt < up.at,
        observedPixels: first?.changedPixels ?? 0,
        maxChangedPixels: obs?.maxChangedPixels ?? 0,
        sampleLatencyClaim: 'none; cursor-clear first observed sample only',
      },
    );
  }
  const oneMs = evidence.gestures.one.input?.actualHeldMs;
  check('gesture-one-duration-3-to-5s', Number.isFinite(oneMs) && oneMs >= 3000 && oneMs <= 5000, {
    actualHeldMs: oneMs ?? null,
    downAt: evidence.gestures.one.input?.downAt,
    upAt: evidence.gestures.one.input?.upAt,
  });
  if (evidence.gestures.one.input && evidence.gestures.two.input)
    evidence.gestures.transitionMs =
      Date.parse(evidence.gestures.two.input.downAt) - Date.parse(evidence.gestures.one.input.upAt);
  await persist();

  mark('wait for terrain save/readback');
  try {
    await page.waitForFunction(
      () => {
        const map = document.querySelector('#campaign-map');
        return (
          map.dataset.terrainReady === 'ready' &&
          map.dataset.terrainDraft === undefined &&
          !document.querySelector('#atlas-undo').disabled
        );
      },
      null,
      { timeout: 60000 },
    );
    check('terrain-save-state', true, {
      uiText: await page.locator('#atlas-save-status').textContent(),
    });
  } catch (error) {
    check('terrain-save-state', false, {
      error: error.message,
      uiText: await page
        .locator('#atlas-save-status')
        .textContent()
        .catch(() => null),
    });
  }
  let savedHeights = [];
  let savedRevision = null;
  try {
    savedHeights = queryHeights();
    savedRevision = queryRevision();
    evidence.afterHeightsFile = await saveJson('height-after.json', savedHeights);
    evidence.canonical = heightDiff(initialHeights, savedHeights, view, [pathOne, pathTwo], 8);
    evidence.canonical.initialRevision = initialRevision;
    evidence.canonical.savedRevision = savedRevision;
    evidence.canonical.tilesBefore = initialHeights.length;
    evidence.canonical.tilesAfter = savedHeights.length;
    evidence.canonical.diffFile = await saveJson('canonical-diff.json', evidence.canonical);
    for (const region of evidence.canonical.regions)
      check(`canonical-height-region-${region.gesture}`, region.changedNodeCount > 0, region);
    check('canonical-added-or-changed-height-data', evidence.canonical.nodeCount > 0, {
      nodeCount: evidence.canonical.nodeCount,
      removedTileIds: evidence.canonical.removedTileIds,
    });
  } catch (error) {
    noteError('canonical readback', error);
    check('canonical-height-readback', false, { error: error.message });
  }
  await persist();
  mark('close initial app');
  try {
    await native.close();
    evidence.lifecycle.push({
      phase,
      launch: native.launches.length,
      closedNormally: true,
      at: new Date().toISOString(),
    });
    page = null;
  } catch (error) {
    evidence.lifecycle.push({
      phase,
      launch: native.launches.length,
      closedNormally: false,
      error: error.message,
      at: new Date().toISOString(),
    });
    noteError(phase, error);
  }
  await persist();

  if (savedHeights.length && native.app === null) {
    mark('fresh campaign open');
    try {
      await openCampaign();
      mark('fresh canonical height-byte comparison');
      const reopened = queryHeights();
      const exact =
        JSON.stringify(reopened.map(({ id, data }) => [id, data])) ===
        JSON.stringify(savedHeights.map(({ id, data }) => [id, data]));
      const reopenedRevision = queryRevision();
      evidence.fresh = {
        status: exact && reopenedRevision === savedRevision ? 'PASS' : 'FAIL',
        byteIdentical: exact,
        savedRevision,
        reopenedRevision,
        tileCount: reopened.length,
      };
      check(
        'fresh-reopen-identical-height-bytes',
        evidence.fresh.byteIdentical && reopenedRevision === savedRevision,
        evidence.fresh,
      );
      await native.capture(page, '03-fresh-reopen.png');
    } catch (error) {
      noteError('fresh campaign open/compare', error);
      check('fresh-reopen-identical-height-bytes', false, { error: error.message });
    }
  } else {
    check('fresh-reopen-identical-height-bytes', false, {
      status: 'SKIPPED',
      reason: savedHeights.length
        ? 'initial app did not close'
        : 'canonical saved heights unavailable',
    });
    evidence.checks['fresh-reopen-identical-height-bytes'].status = 'SKIPPED';
  }
} catch (error) {
  noteError(phase, error);
  evidence.unexpectedError = { phase, message: error.message, stack: error.stack };
} finally {
  if (native.app) {
    mark('cleanup: normal close attempt');
    try {
      await native.close();
      evidence.lifecycle.push({
        phase,
        launch: native.launches.length,
        closedNormally: true,
        at: new Date().toISOString(),
      });
      page = null;
    } catch (error) {
      noteError(phase, error);
      evidence.lifecycle.push({
        phase,
        launch: native.launches.length,
        closedNormally: false,
        error: error.message,
        at: new Date().toISOString(),
      });
    }
  }
  mark('cleanup: dispose session');
  await native.dispose();
  await new Promise((resolve) => setTimeout(resolve, 250));
  for (const name of [
    'gesture-one-duration-3-to-5s',
    'gesture-one-pre-up-terrain-pixels',
    'gesture-two-pre-up-terrain-pixels',
    'terrain-save-state',
    'canonical-height-region-one',
    'canonical-height-region-two',
    'canonical-added-or-changed-height-data',
    'fresh-reopen-identical-height-bytes',
  ]) {
    if (!evidence.checks[name])
      evidence.checks[name] = {
        status: 'SKIPPED',
        reason: `Workflow stopped before ${name}; see unexpectedError.`,
      };
  }
  evidence.launches = await Promise.all(
    native.launches.map(async (launch) => ({
      ...launch,
      pidAbsent: launch.pid
        ? await access(`/proc/${launch.pid}`).then(
            () => false,
            () => true,
          )
        : null,
    })),
  );
  evidence.nativeErrors = [...native.errors];
  evidence.consoleEvents = [...evidence.consoleEvents];
  evidence.completedAt = new Date().toISOString();
  evidence.sourceHashesAtEnd = await sourceHashes();
  evidence.status =
    evidence.failures.length ||
    evidence.consoleEvents.length ||
    evidence.nativeErrors.length ||
    Object.values(evidence.checks).some((entry) => entry.status !== 'PASS')
      ? 'FAIL'
      : 'PASS';
  await saveJson('phase-errors.json', {
    consoleEvents: evidence.consoleEvents,
    nativeErrors: evidence.nativeErrors,
    failures: evidence.failures,
  });
  const report = { ...evidence };
  const reportPath = path.join(output, evidence.status === 'PASS' ? 'result.json' : 'failure.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, reportPath, status: evidence.status }));
}
