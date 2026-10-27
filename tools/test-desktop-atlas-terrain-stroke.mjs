import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';

const root = process.cwd();
const recoveryProbe = process.argv.includes('--recovery');
const conflictProbe = process.argv.includes('--source-conflict');
const basicToolsProbe = process.argv.includes('--basic-tools');
const formsProbe = process.argv.includes('--forms');
if (conflictProbe && !recoveryProbe) throw Error('--source-conflict requires --recovery.');
const scale = Number(process.argv.find((a) => a.startsWith('--scale='))?.split('=')[1] ?? 1);
if (![1, 2].includes(scale)) throw Error('Supported UI scales: 1 or 2.');
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
  './desktop/host-ipc.ts',
  './desktop/store-worker.ts',
  './src/app/shared/contracts.ts',
  './src/app/storage/store.ts',
  './src/app/storage/atlas-commit-projection.ts',
  './src/app/atlas/campaign-atlas-author.ts',
  './src/app/atlas/terrain-stroke-queue.ts',
  './src/app/atlas/campaign-atlas-ui.ts',
  './src/app/atlas/landscape-brush-session.ts',
  './src/app/atlas/terrain-live-stroke.ts',
  './src/app/atlas/landscape-tool-settings.ts',
  './src/app/atlas/terrain-brush.ts',
  './src/app/atlas/terrain-form-brush.ts',
  './src/app/atlas/terrain-brush-draft.ts',
  './src/app/atlas/atlas-surface-draft.ts',
  './src/app/atlas/atlas-landscape-ui.ts',
  './src/app/atlas/atlas-workspace-layout.ts',
  './src/app/atlas/atlas-workspace.css',
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
function recoveryState() {
  const db = new Database(path.join(native.profile, 'workbench.sqlite'), { readonly: true });
  try {
    return {
      ...db
        .prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?')
        .get(fixture.campaignId),
      commands: db
        .prepare('SELECT count(*) n FROM atlas_command WHERE campaign_id=?')
        .get(fixture.campaignId).n,
      receipts: db
        .prepare('SELECT count(*) n FROM atlas_receipt WHERE campaign_id=?')
        .get(fixture.campaignId).n,
      heights: sha(JSON.stringify(queryHeights())),
    };
  } finally {
    db.close();
  }
}
async function dismissStatus() {
  // Native popover state is authoritative; its queued accessibility toggle may lag.
  if (await page.locator('#atlas-status-popup').evaluate((el) => el.matches(':popover-open')))
    await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => !document.querySelector('#atlas-status-popup').matches(':popover-open'),
  );
}
async function exerciseRecovery(failSourceRead = false) {
  mark('recovery: hold a committed reply while a dependent gesture closes');
  const before = recoveryState();
  await native.app.evaluate(({ ipcMain }) => {
    const state = (globalThis.__qaRecovery = {
      calls: [],
      resolutions: [],
      resolutionResults: [],
      held: false,
      release: null,
    });
    const original = ipcMain._invokeHandlers.get('atlas:commit');
    state.originalCommit = original;
    ipcMain.removeHandler('atlas:commit');
    ipcMain.handle('atlas:commit', async (...args) => {
      state.event = args[0];
      state.calls.push(structuredClone(args[1]));
      const result = await original(...args);
      if (state.calls.length !== 1 || !result.ok) return result;
      state.held = true;
      await new Promise((resolve) => {
        state.release = resolve;
      });
      // Native UI fault only: lose the successful reply after the real commit.
      // The real worker→HostIpc→preload marker is proved by the boundary tests.
      return {
        ok: false,
        error: 'Controlled lost postcommit reply; Speicherstand klären.',
        errorKind: 'store-outcome-unknown',
      };
    });
    const reconcile = ipcMain._invokeHandlers.get('atlas:reconcile-commit');
    ipcMain.removeHandler('atlas:reconcile-commit');
    ipcMain.handle('atlas:reconcile-commit', async (...args) => {
      state.resolutions.push(structuredClone(args[1]));
      const result = await reconcile(...args);
      state.resolutionResults.push({ result, dispatches: state.calls.length });
      return result;
    });
  });
  const stroke = async (fraction) => {
    const box = await page.locator('#campaign-map').boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * fraction);
    await page.mouse.down();
    await page.waitForTimeout(400);
    await page.mouse.up();
  };
  await stroke(0.4);
  await native.app.evaluate(async () => {
    const end = Date.now() + 15000;
    while (!globalThis.__qaRecovery.held && Date.now() < end)
      await new Promise((r) => setTimeout(r, 10));
    if (!globalThis.__qaRecovery.held)
      throw Error('Committed reply did not reach the controlled hold');
  });
  const committed = recoveryState();
  await page.evaluate(() => {
    const original = crypto.randomUUID.bind(crypto);
    window.__qaRetainedIds = [];
    window.__qaRestoreUUID = () => {
      crypto.randomUUID = original;
    };
    crypto.randomUUID = () => {
      const id = original();
      window.__qaRetainedIds.push(id);
      return id;
    };
  });
  await stroke(0.65);
  const dependentIds = await page.evaluate(() => {
    window.__qaRestoreUUID();
    return window.__qaRetainedIds;
  });
  check('closed-dependent-has-original-identity', dependentIds.length === 1, { dependentIds });
  await native.app.evaluate(() => globalThis.__qaRecovery.release());
  await page.waitForFunction(() => !document.querySelector('#atlas-recover').hidden);
  await page.locator('#atlas-status').click();
  await page.locator('#atlas-recover').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('#atlas-recover').disabled);
  await page.locator('#atlas-region-retry').click();
  const blocked = recoveryState();
  const held = await native.app.evaluate(() => ({
    calls: globalThis.__qaRecovery.calls,
    resolutions: globalThis.__qaRecovery.resolutions,
  }));
  check(
    'unknown-keeps-original-and-blocks-dependent-reset',
    held.calls.length === 1 &&
      held.resolutions.length === 0 &&
      committed.revision === before.revision + 1 &&
      committed.cursor === before.cursor + 1 &&
      JSON.stringify(blocked) === JSON.stringify(committed) &&
      (await page.locator('#atlas-recover').isVisible()),
    {
      before,
      committed,
      blocked,
      commandId: held.calls[0]?.commandId,
      dispatches: held.calls.length,
    },
  );
  await native.capture(page, '04-recovery-blocked.png');
  mark('recovery: resolve the original receipt without replay');
  if (failSourceRead) {
    await native.app.evaluate(
      ({ ipcMain }, foreignId) => {
        const original = ipcMain._invokeHandlers.get('atlas:terrain-source');
        ipcMain.removeHandler('atlas:terrain-source');
        ipcMain.handle('atlas:terrain-source', async (...args) => {
          const state = globalThis.__qaRecovery;
          if (!state.failedSource) {
            state.failedSource = true;
            return { ok: false, error: 'Controlled source reload failure' };
          }
          if (foreignId && !state.foreign) {
            const source = await original(...args);
            if (!source.ok) throw Error(source.error);
            const first = state.calls[0];
            const result = await state.originalCommit(state.event, {
              commandId: foreignId,
              token: first.token,
              campaignId: first.campaignId,
              sourceFence: source.value.fence,
              action: { kind: 'landscape-sea-level', seaLevelM: 0.1 },
            });
            if (!result.ok) throw Error(result.error);
            state.foreign = result.value;
          }
          return original(...args);
        });
      },
      conflictProbe ? randomUUID() : null,
    );
  }
  check('unknown-has-no-discard-action', await page.locator('#atlas-strokes-discard').isHidden());
  await page.locator('#atlas-recover').click();
  if (failSourceRead) {
    await page.waitForFunction(
      () =>
        document.querySelector('#atlas-save-status').textContent.includes('Quelle') ||
        document.querySelector('#atlas-status').textContent.includes('Quelle') ||
        document.querySelector('#atlas-save-status').textContent.includes('quelle'),
    );
    const heldAfterRead = await native.app.evaluate(() => ({
      calls: globalThis.__qaRecovery.calls.length,
      resolutions: globalThis.__qaRecovery.resolutions.length,
      failed: globalThis.__qaRecovery.failedSource,
    }));
    check(
      'source-read-failure-keeps-closed-successor',
      heldAfterRead.failed &&
        heldAfterRead.calls === 1 &&
        heldAfterRead.resolutions === 1 &&
        JSON.stringify(recoveryState()) === JSON.stringify(committed),
      { heldAfterRead, committed, actual: recoveryState() },
    );
    await page.locator('#atlas-region-retry').click();
    if (conflictProbe) {
      await page.waitForFunction(() => !document.querySelector('#atlas-strokes-retry').hidden);
      const conflict = recoveryState();
      const calls = await native.app.evaluate(() => globalThis.__qaRecovery.calls.length);
      check(
        'changed-source-retains-successor-for-explicit-choice',
        calls === 1 &&
          conflict.cursor === committed.cursor + 1 &&
          conflict.heights === committed.heights &&
          (await page.locator('#atlas-strokes-discard').isVisible()),
        { calls, committed, conflict },
      );
      evidence.foreignSourceState = conflict;
      await page.locator('#atlas-strokes-retry').click();
    }
  }
  await page.waitForFunction(
    () =>
      document.querySelector('#atlas-recover').hidden &&
      document.querySelector('#campaign-map').dataset.terrainReady === 'ready' &&
      !document.querySelector('#land-tool').disabled,
    null,
    { timeout: 60000 },
  );
  const resolved = recoveryState();
  const resolution = await native.app.evaluate(() => ({
    calls: globalThis.__qaRecovery.calls,
    resolutions: globalThis.__qaRecovery.resolutions,
    results: globalThis.__qaRecovery.resolutionResults,
  }));
  check(
    'unknown-resolution-never-duplicates-original',
    resolution.resolutions.length === 1 &&
      resolution.results[0]?.dispatches === 1 &&
      resolution.results[0]?.result.value?.outcome === 'applied' &&
      resolution.calls.filter((c) => c.commandId === held.calls[0]?.commandId).length === 1 &&
      JSON.stringify(resolution.resolutions[0]) === JSON.stringify(held.calls[0]),
    {
      originalCommandId: held.calls[0]?.commandId,
      resolvedCommandId: resolution.resolutions[0]?.commandId,
      dispatchesAtResolution: resolution.results[0]?.dispatches,
    },
  );
  check(
    'closed-dependent-resumed-once-without-new-input',
    resolution.calls.length === 2 &&
      resolution.calls[1]?.commandId === dependentIds[0] &&
      resolution.calls[1]?.terrainStroke.id === dependentIds[0] &&
      resolved.revision === committed.revision + (conflictProbe ? 2 : 1) &&
      resolved.cursor === committed.cursor + (conflictProbe ? 2 : 1) &&
      resolved.commands === committed.commands + (conflictProbe ? 2 : 1) &&
      resolved.heights !== committed.heights,
    {
      committed,
      resolved,
      dependentId: dependentIds[0],
      writtenId: resolution.calls[1]?.commandId,
      sourceRevision: resolution.calls[1]?.terrainStroke.expectedRevision,
      sourceFence: resolution.calls[1]?.sourceFence,
    },
  );
  await dismissStatus();
  mark('recovery: Undo and Redo each retained gesture independently');
  const history = [];
  for (const [kind, expectedHash, expectedCursor] of [
    ...(conflictProbe
      ? [['undo', evidence.foreignSourceState.heights, evidence.foreignSourceState.cursor]]
      : []),
    ['undo', committed.heights, committed.cursor],
    ['undo', before.heights, before.cursor],
    ['redo', committed.heights, committed.cursor],
    ...(conflictProbe
      ? [['redo', evidence.foreignSourceState.heights, evidence.foreignSourceState.cursor]]
      : []),
    ['redo', resolved.heights, resolved.cursor],
  ]) {
    const previous = queryRevision();
    await page.locator('#atlas-' + kind).click();
    await page.waitForFunction(
      (revision) =>
        document.querySelector('#campaign-map').dataset.terrainReady === 'ready' &&
        Number(document.querySelector('#campaign-map').dataset.terrainRevision) > revision,
      previous,
      { timeout: 60000 },
    );
    const state = recoveryState();
    history.push({ kind, expectedHash, expectedCursor, state });
    check(
      'retained-' + kind + '-' + history.length,
      state.heights === expectedHash && state.cursor === expectedCursor,
      { expectedHash, expectedCursor, state },
    );
  }
  evidence.recovery = {
    before,
    committed,
    blocked,
    resolved,
    history,
    dependentId: dependentIds[0],
    originalCommandId: held.calls[0]?.commandId,
    injection:
      'One real successful Main reply held and replaced by the typed unknown marker. The already closed successor must resume without new input; actual worker classification remains covered separately.',
  };
  await native.capture(page, '05-recovery-resumed.png');
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
  page = await native.launch(scale);
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

/** Functional qualification of the complete basic-tool path; deliberately no latency claim. */
async function exerciseBasicTools() {
  const bundle = await build({
    stdin: {
      contents: "export {TerrainSampler} from './src/app/atlas/terrain-height';",
      resolveDir: root,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  });
  const { TerrainSampler } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
  );
  const terrain = () =>
    new TerrainSampler(queryHeights().map((height) => ({ height, revision: 0 })));
  const seaLevel = () => {
    const db = new Database(path.join(native.profile, 'workbench.sqlite'), { readonly: true });
    try {
      const row = db
        .prepare(
          "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL",
        )
        .get(fixture.campaignId);
      return row ? JSON.parse(row.payload).terrainSettings.seaLevelM : 0;
    } finally {
      db.close();
    }
  };
  const ready = async () =>
    page.waitForFunction(
      () => {
        const map = document.querySelector('#campaign-map');
        return (
          map.dataset.terrainReady === 'ready' &&
          !map.dataset.terrainDraft &&
          !document.querySelector('#land-tool').disabled
        );
      },
      null,
      { timeout: 60000 },
    );
  const state = () => ({ ...recoveryState(), seaLevelM: seaLevel() });
  const choose = async (mode) => {
    const tool = mode === 'smooth' ? 'smooth' : 'height';
    await page.locator(`[data-tool-select="land-tool"][data-tool-value="${tool}"]`).first().click();
    if (tool === 'height') await setHeightDirection(page, mode);
    await setBrushWorldRadius(page, 'land-radius', 8);
    await page
      .locator('#land-height-strength')
      .fill(mode === 'roughen' || mode === 'smooth' ? '5' : '2');
    await page.locator('#land-height-strength').press('Tab');
    await page.locator('#land-height-feather').press('Home');
    for (let i = 0; i < 16; i++) await page.locator('#land-height-feather').press('ArrowRight');
    if (mode === 'raise' || mode === 'lower') {
      await page.locator('#land-coast-roughness').press('Home');
      for (let i = 0; i < 5; i++) await page.locator('#land-coast-roughness').press('ArrowRight');
    }
  };
  const points = async () => {
    const box = await page.locator('#campaign-map').boundingBox();
    const view = await page
      .locator('#campaign-map')
      .evaluate((el) => JSON.parse(el.dataset.atlasView));
    const screen = (u, v) => ({ x: box.x + box.width * u, y: box.y + box.height * v });
    return { box, view, start: screen(0.22, 0.5), end: screen(0.78, 0.5), watch: screen(0.5, 0.5) };
  };
  const values = (sampler, view) => {
    const result = [];
    for (let y = -3; y <= 3; y += 0.5)
      for (let x = view.x + view.width * 0.3; x <= view.x + view.width * 0.7; x += 0.5) {
        const p = { x, y: view.y + view.height * 0.5 + y };
        result.push({ ...p, height: sampler.sample(p).heightM });
      }
    return result;
  };
  const unevenness = (sampler, samples) =>
    samples.reduce(
      (sum, p) =>
        sum +
        Math.abs(
          4 * sampler.sample(p).heightM -
            sampler.sample({ x: p.x - 0.5, y: p.y }).heightM -
            sampler.sample({ x: p.x + 0.5, y: p.y }).heightM -
            sampler.sample({ x: p.x, y: p.y - 0.5 }).heightM -
            sampler.sample({ x: p.x, y: p.y + 0.5 }).heightM,
        ),
      0,
    ) / samples.length;
  const history = async (kind, expected, label) => {
    const previous = queryRevision();
    await page.locator('#atlas-' + kind).click();
    await page.waitForFunction(
      (revision) =>
        document.querySelector('#campaign-map').dataset.terrainReady === 'ready' &&
        Number(document.querySelector('#campaign-map').dataset.terrainRevision) > revision,
      previous,
      { timeout: 60000 },
    );
    const actual = state();
    check(
      label,
      actual.heights === expected.heights &&
        actual.cursor === expected.cursor &&
        actual.seaLevelM === expected.seaLevelM,
      { expected, actual },
    );
  };
  const plainGesture = async (ending = 'up') => {
    const p = await points();
    await page.mouse.move(p.start.x, p.start.y);
    await page.mouse.down();
    await page.waitForTimeout(400);
    await page.mouse.move(p.end.x, p.end.y, { steps: 5 });
    await page.waitForTimeout(300);
    if (ending === 'escape') await page.keyboard.press('Escape');
    await page.mouse.up();
  };
  evidence.basic = { scale, sampleLatencyClaim: 'none', tools: [], inputEvents: [] };
  await page.evaluate(() => {
    window.__qaBasicEvents = [];
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture', 'blur'])
      window.addEventListener(
        type,
        (e) =>
          window.__qaBasicEvents.push({
            type,
            trusted: e.isTrusted,
            pointerId: e.pointerId,
            at: performance.now(),
          }),
        true,
      );
  });
  await native.app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get('atlas:commit');
    globalThis.__qaBasicCommands = [];
    ipcMain.removeHandler('atlas:commit');
    ipcMain.handle('atlas:commit', (...args) => {
      globalThis.__qaBasicCommands.push(structuredClone(args[1]));
      return original(...args);
    });
  });
  await ready();
  await native.capture(page, 'basic-00-before.png');
  for (const mode of ['raise', 'lower', 'roughen', 'smooth']) {
    mark('basic tools: ' + mode);
    await choose(mode);
    const p = await points(),
      before = state(),
      original = terrain();
    const beforeValues = values(original, p.view),
      beforeUnevenness = unevenness(original, beforeValues);
    await page.mouse.move(p.box.x + 10, p.box.y + 10);
    const baseline = await sample(page, p.watch.x, p.watch.y);
    await runGesture(
      'basic-' + mode,
      p.start,
      p.end,
      p.watch,
      p.box,
      {
        ...(await savePatch('basic-' + mode + '-before.png', baseline.bytes)),
        bytes: baseline.bytes,
      },
      1800,
    );
    const observed = await page.evaluate((name) => {
      const s = window.__qaTerrainStrokes[name];
      return {
        first: s.first,
        max: s.maxChanged,
        input: window.__qaTerrainStrokeInputs.filter((e) => e.label === name),
      };
    }, 'basic-' + mode);
    const up = observed.input.find((e) => e.type === 'pointerup');
    check(
      'basic-' + mode + '-visible-before-up',
      !!observed.first && observed.first.sampledAt < up?.at && observed.first.changedPixels > 10,
      {
        sampledAt: observed.first?.sampledAt,
        upAt: up?.at,
        changedPixels: observed.first?.changedPixels ?? 0,
      },
    );
    if (observed.first) await savePatch('basic-' + mode + '-during.png', observed.first.pixels);
    await ready();
    const after = state(),
      next = terrain(),
      afterValues = values(next, p.view);
    const dispatched = await native.app.evaluate(() => globalThis.__qaBasicCommands.at(-1));
    check(
      'basic-' + mode + '-visible-parameters-reach-author',
      dispatched.action.stroke.mode === mode &&
        dispatched.action.stroke.radius === 8 &&
        dispatched.action.stroke.strength === (mode === 'roughen' || mode === 'smooth' ? 5 : 2) &&
        Math.abs(dispatched.action.stroke.feather - 0.8) < 1e-6 &&
        (!['raise', 'lower'].includes(mode) ||
          Math.abs(dispatched.action.stroke.roughness - 0.5) < 1e-6),
      { stroke: dispatched.action.stroke },
    );
    const deltas = afterValues.map((v, i) => v.height - beforeValues[i].height);
    const positive = deltas.filter((v) => v > 1e-5).length,
      negative = deltas.filter((v) => v < -1e-5).length;
    const afterUnevenness = unevenness(next, beforeValues);
    check(
      'basic-' + mode + '-one-history-step',
      after.cursor === before.cursor + 1 &&
        after.commands === before.commands + 1 &&
        after.revision === before.revision + 1,
      { before, after },
    );
    const effect =
      mode === 'raise'
        ? positive > 0 && negative === 0
        : mode === 'lower'
          ? negative > 0 && positive === 0
          : mode === 'roughen'
            ? positive > 0 && negative > 0
            : afterUnevenness < beforeUnevenness;
    check('basic-' + mode + '-canonical-effect', effect, {
      positive,
      negative,
      beforeUnevenness,
      afterUnevenness,
      deltaRange: [Math.min(...deltas), Math.max(...deltas)],
    });
    evidence.basic.tools.push({
      mode,
      before,
      after,
      positive,
      negative,
      beforeUnevenness,
      afterUnevenness,
      sourceSamples: await saveJson('basic-' + mode + '-samples.json', {
        before: beforeValues,
        after: afterValues,
      }),
    });
    await native.capture(page, 'basic-' + mode + '-saved.png');
    await history('undo', before, 'basic-' + mode + '-undo');
    await history('redo', after, 'basic-' + mode + '-redo');
  }
  mark('basic input: Escape discards only the active gesture');
  await choose('raise');
  let before = state();
  await plainGesture('escape');
  await ready();
  check('basic-escape-no-write', JSON.stringify(state()) === JSON.stringify(before), {
    before,
    after: state(),
  });

  mark('basic input: real pointer cancellation completes once');
  before = state();
  const cancelPoints = await points();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: cancelPoints.start.x, y: cancelPoints.start.y, id: 1 }],
  });
  await page.waitForTimeout(400);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: cancelPoints.end.x, y: cancelPoints.end.y, id: 1 }],
  });
  await page.waitForTimeout(300);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await ready();
  check(
    'basic-pointercancel-one-history-step',
    state().cursor === before.cursor + 1 && state().commands === before.commands + 1,
    { before, after: state() },
  );
  await cdp.detach();

  mark('basic input: native window focus loss completes once');
  before = state();
  const blurPoints = await points();
  await page.mouse.move(blurPoints.start.x, blurPoints.start.y);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await native.app.evaluate(async ({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().endsWith('/index.html'),
    );
    const other = new BrowserWindow({
      width: 200,
      height: 100,
      show: false,
      webPreferences: { sandbox: true },
    });
    await other.loadURL('about:blank');
    globalThis.__qaFocusWindow = other;
    other.show();
    other.focus();
    await new Promise((resolve, reject) => {
      const end = Date.now() + 5000;
      const tick = () =>
        !main.isFocused() && other.isFocused()
          ? resolve()
          : Date.now() > end
            ? reject(Error('Native focus did not transfer'))
            : setTimeout(tick, 25);
      tick();
    });
  });
  await page.mouse.up();
  await native.app.evaluate(({ BrowserWindow }) => {
    globalThis.__qaFocusWindow.close();
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith('/index.html'))
      .focus();
  });
  await ready();
  check(
    'basic-native-blur-one-history-step',
    state().cursor === before.cursor + 1 && state().commands === before.commands + 1,
    { before, after: state() },
  );

  mark('basic input: released write survives Escape of its active successor');
  await native.app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get('atlas:commit');
    const hold = (globalThis.__qaBasicHold = { calls: [], held: false, original });
    ipcMain.removeHandler('atlas:commit');
    ipcMain.handle('atlas:commit', async (...args) => {
      hold.calls.push(structuredClone(args[1]));
      const result = await original(...args);
      if (hold.calls.length === 1 && result.ok) {
        hold.held = true;
        await new Promise((resolve) => (hold.release = resolve));
      }
      return result;
    });
  });
  before = state();
  await plainGesture();
  await native.app.evaluate(async () => {
    const end = Date.now() + 15000;
    while (!globalThis.__qaBasicHold.held && Date.now() < end)
      await new Promise((r) => setTimeout(r, 20));
    if (!globalThis.__qaBasicHold.held) throw Error('Write did not reach controlled reply hold');
  });
  const accepted = state();
  await plainGesture('escape');
  check(
    'basic-held-first-escape-successor',
    accepted.cursor === before.cursor + 1 && JSON.stringify(state()) === JSON.stringify(accepted),
    { before, accepted, afterEscape: state() },
  );
  await native.app.evaluate(() => globalThis.__qaBasicHold.release());
  await ready();
  const heldCalls = await native.app.evaluate(({ ipcMain }) => {
    const hold = globalThis.__qaBasicHold;
    ipcMain.removeHandler('atlas:commit');
    ipcMain.handle('atlas:commit', hold.original);
    return hold.calls;
  });
  check(
    'basic-held-first-dispatched-once',
    heldCalls.length === 1 && state().heights === accepted.heights,
    { calls: heldCalls.map((c) => c.commandId), before, after: state() },
  );

  for (const action of ['retry', 'discard']) {
    mark('basic recovery: rejected gesture explicit ' + action);
    await native.app.evaluate(({ ipcMain }) => {
      const original = ipcMain._invokeHandlers.get('atlas:commit');
      const reject = (globalThis.__qaBasicReject = { original, calls: [] });
      ipcMain.removeHandler('atlas:commit');
      ipcMain.handle('atlas:commit', async (...args) => {
        reject.calls.push(structuredClone(args[1]));
        if (reject.calls.length === 1)
          return { ok: false, error: 'Controlled safe precommit rejection' };
        return original(...args);
      });
    });
    before = state();
    await plainGesture();
    await page.waitForFunction(() => !document.querySelector('#atlas-strokes-retry').hidden);
    if ((await page.locator('#atlas-status').getAttribute('aria-expanded')) !== 'true')
      await page.locator('#atlas-status').click();
    await page.locator('#atlas-strokes-' + action).click();
    await ready();
    const calls = await native.app.evaluate(({ ipcMain }) => {
      const reject = globalThis.__qaBasicReject;
      ipcMain.removeHandler('atlas:commit');
      ipcMain.handle('atlas:commit', reject.original);
      return reject.calls;
    });
    check(
      'basic-rejected-' + action,
      action === 'retry'
        ? calls.length === 2 &&
            calls[0].commandId === calls[1].commandId &&
            state().cursor === before.cursor + 1
        : calls.length === 1 && JSON.stringify(state()) === JSON.stringify(before),
      { before, after: state(), ids: calls.map((c) => c.commandId) },
    );
    await dismissStatus();
  }
  mark('basic recovery: unknown with retained successor and failed source reload');
  await choose('raise');
  await exerciseRecovery(true);
  mark('basic sea: change coastline without editing ground');
  await page.locator('[data-tool-group="water"]').click();
  before = state();
  const p = await points(),
    sampler = terrain(),
    coastalSamples = values(sampler, p.view);
  const wetBefore = coastalSamples.filter((s) => s.height <= seaLevel()).length;
  const coast = coastalSamples
    .filter((s) => s.height > seaLevel() && s.height < 3)
    .sort((a, b) => a.height - b.height)[0];
  if (!coast) throw Error('Sea probe needs a genuinely crossing dry terrain point');
  const coastScreen = {
    x: p.box.x + ((coast.x - p.view.x) / p.view.width) * p.box.width,
    y: p.box.y + ((coast.y - p.view.y) / p.view.height) * p.box.height,
  };
  const baseline = await sample(page, coastScreen.x, coastScreen.y);
  await savePatch('basic-sea-before.png', baseline.bytes);
  if (!(await page.locator('#land-sea-options').evaluate((el) => el.open)))
    await page.locator('#land-sea-options summary').click();
  await page.locator('#land-sea-level').fill('3');
  await page.locator('#land-sea-apply').click();
  await ready();
  const afterSea = state();
  const wetAfter = coastalSamples.filter((s) => s.height <= seaLevel()).length;
  await page.waitForFunction(
    (revision) =>
      Number(document.querySelector('#campaign-map').dataset.terrainRevision) >= revision,
    afterSea.revision,
    { timeout: 60000 },
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const imageAfter = await sample(page, coastScreen.x, coastScreen.y);
  await savePatch('basic-sea-after.png', imageAfter.bytes);
  check(
    'basic-sea-ground-unchanged',
    afterSea.heights === before.heights &&
      afterSea.seaLevelM === 3 &&
      afterSea.cursor === before.cursor + 1,
    { before, after: afterSea },
  );
  check(
    'basic-sea-coast-changed',
    wetAfter > wetBefore && pixelDelta(baseline.bytes, imageAfter.bytes) > 10,
    {
      wetBefore,
      wetAfter,
      coast,
      coastScreen,
      changedPixels: pixelDelta(baseline.bytes, imageAfter.bytes),
    },
  );
  await native.capture(page, 'basic-sea-saved.png');
  await history('undo', before, 'basic-sea-undo');
  await history('redo', afterSea, 'basic-sea-redo');
  evidence.basic.inputEvents = await page.evaluate(() => window.__qaBasicEvents);
  check(
    'basic-native-cancel-and-blur-events',
    evidence.basic.inputEvents.some((e) => e.type === 'pointercancel' && e.trusted) &&
      evidence.basic.inputEvents.some((e) => e.type === 'blur' && e.trusted),
    { events: evidence.basic.inputEvents },
  );
  const saved = state();
  await saveJson('basic-height-saved.json', queryHeights());
  mark('basic fresh: regular close and restart');
  await native.close();
  page = null;
  await openCampaign();
  await ready();
  const reopened = state();
  check('basic-fresh-height-sea-history', JSON.stringify(reopened) === JSON.stringify(saved), {
    saved,
    reopened,
  });
  await native.capture(page, 'basic-fresh.png');
  evidence.basic.saved = saved;
  evidence.basic.reopened = reopened;
  await persist();
}

/** Direct form task on the existing native terrain fixture and lifecycle. */
async function exerciseFormTools() {
  const bundle = await build({
    stdin: {
      contents:
        "export {TerrainSampler} from './src/app/atlas/terrain-height';export {applyTerrainBrush} from './src/app/atlas/terrain-brush';",
      resolveDir: root,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  });
  const { TerrainSampler, applyTerrainBrush } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
  );
  const records = () => queryHeights().map((height) => ({ height, id: height.id, revision: 0 }));
  const terrain = () => new TerrainSampler(records());
  const ready = async () =>
    page.waitForFunction(
      () => {
        const m = document.querySelector('#campaign-map');
        return (
          m.dataset.terrainReady === 'ready' &&
          !m.dataset.terrainDraft &&
          !document.querySelector('#land-tool').disabled
        );
      },
      null,
      { timeout: 60000 },
    );
  const geometry = async () => {
    const box = await page.locator('#campaign-map').boundingBox(),
      view = await page.locator('#campaign-map').evaluate((n) => JSON.parse(n.dataset.atlasView));
    return {
      box,
      view,
      screen: ([x, y]) => ({ x: box.x + x * box.width, y: box.y + y * box.height }),
      world: ([x, y]) => ({ x: view.x + x * view.width, y: view.y + y * view.height }),
    };
  };
  const choose = async (form, radius = 8, strength = 4) => {
    await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
    await page.locator(`[data-form="${form}"]`).click();
    const defaultRadius = Number(await page.locator('#land-radius').inputValue()),
      defaultStrength = Number(await page.locator('#land-height-strength').inputValue()),
      rate = { hills: 0.5, mountains: 0.85, canyon: 0.75 }[form];
    check(
      'form-' + form + '-scale-default',
      Math.abs(defaultStrength - defaultRadius * rate) <
        Math.max(0.001, defaultRadius * rate * 0.005),
      { defaultRadius, defaultStrength, rate },
    );
    await setBrushWorldRadius(page, 'land-radius', radius);
    await page.locator('#land-height-strength').fill(String(strength));
    await page.locator('#land-height-strength').press('Tab');
    check(
      'form-' + form + '-controls-active',
      (await page.locator('#land-height-form').inputValue()) === form &&
        (await page.locator('#land-shape-options').isHidden()),
    );
  };
  const history = async (kind, expected, label) => {
    const revision = queryRevision();
    await page.locator('#atlas-' + kind).click();
    await page.waitForFunction(
      (r) =>
        document.querySelector('#campaign-map').dataset.terrainReady === 'ready' &&
        Number(document.querySelector('#campaign-map').dataset.terrainRevision) > r,
      revision,
      { timeout: 60000 },
    );
    await ready();
    const actual = recoveryState();
    check(label, actual.heights === expected.heights && actual.cursor === expected.cursor, {
      expected,
      actual,
    });
  };
  evidence.forms = { scale, tools: [], sampleLatencyClaim: 'none; functional pre-up observation' };
  await native.app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get('atlas:commit');
    globalThis.__qaFormCommands = [];
    ipcMain.removeHandler('atlas:commit');
    ipcMain.handle('atlas:commit', (...args) => {
      globalThis.__qaFormCommands.push(structuredClone(args[1]));
      return original(...args);
    });
  });
  const draw = async (
    label,
    path,
    { form, radius = 8, strength = 4, duration = 2400, escape = false, followup = false } = {},
  ) => {
    await ready();
    if (form && !followup) await choose(form, radius, strength);
    const g = await geometry(),
      points = path.map(g.screen),
      watch = points[1],
      before = recoveryState(),
      original = records();
    await page.mouse.move(g.box.x + 4, g.box.y + 4);
    await page.waitForTimeout(150);
    const baseline = await sample(page, watch.x, watch.y);
    await savePatch(label + '-before.png', baseline.bytes);
    await beginPixelObserver(
      label,
      baseline.bytes,
      watch,
      Math.max(30, ((g.box.width * radius) / g.view.width) * 1.4),
    );
    await page.evaluate(() => {
      const s = window.__qaTerrainStrokes[window.__qaTerrainCurrentStroke];
      s.active = true;
      s.frame = requestAnimationFrame(s.tick);
    });
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down();
    for (let segment = 1; segment < points.length; segment++) {
      const a = points[segment - 1],
        b = points[segment],
        started = Date.now(),
        ms = duration / (points.length - 1);
      while (Date.now() - started < ms) {
        const f = Math.min(1, (Date.now() - started) / ms);
        await page.mouse.move(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
        await page.waitForTimeout(55);
      }
      await page.mouse.move(b.x, b.y);
    }
    await page.waitForTimeout(180);
    const preup = await sample(page, watch.x, watch.y),
      held = recoveryState();
    await savePatch(label + '-preup.png', preup.bytes);
    await native.capture(page, label + '-live.png');
    check(
      label + '-not-written-before-up',
      held.heights === before.heights && held.cursor === before.cursor,
      { before, held },
    );
    if (escape) await page.keyboard.press('Escape');
    await page.mouse.up();
    await ready();
    const after = recoveryState();
    if (escape) {
      check(
        label + '-escape-discards-form',
        after.heights === before.heights && after.cursor === before.cursor,
        { before, after },
      );
      return;
    }
    const observed = await page.evaluate((label) => {
        const s = window.__qaTerrainStrokes[label];
        return {
          first: s.first,
          input: window.__qaTerrainStrokeInputs.filter((e) => e.label === label),
        };
      }, label),
      up = observed.input.find((e) => e.type === 'pointerup');
    check(
      label + '-visible-before-up',
      !!observed.first && observed.first.sampledAt < up?.at && observed.first.changedPixels > 10,
      {
        sampledAt: observed.first?.sampledAt,
        upAt: up?.at,
        changedPixels: observed.first?.changedPixels ?? 0,
      },
    );
    const command = await native.app.evaluate(() => globalThis.__qaFormCommands.at(-1));
    check(
      label + '-immutable-form-command',
      command.action.stroke.form === form &&
        command.action.stroke.seed === 0x51a7c3 &&
        command.action.stroke.radius === radius,
      { stroke: command.action.stroke },
    );
    check(
      label + '-one-history-step',
      after.cursor === before.cursor + 1 && after.commands === before.commands + 1,
      { before, after },
    );
    const computed = applyTerrainBrush(original, command.action.stroke),
      ids = new Set(computed.map((r) => r.id)),
      expected = new TerrainSampler([...original.filter((r) => !ids.has(r.id)), ...computed]),
      actual = terrain();
    const samples = [];
    let maxError = 0,
      positive = 0,
      negative = 0;
    for (const point of command.action.stroke.samples.filter(
      (_, i) => i % Math.max(1, Math.floor(command.action.stroke.samples.length / 20)) === 0,
    )) {
      const z = actual.sample(point).heightM,
        want = expected.sample(point).heightM,
        prior = new TerrainSampler(original).sample(point).heightM;
      maxError = Math.max(maxError, Math.abs(z - want));
      positive += z > prior + 1e-5;
      negative += z < prior - 1e-5;
      samples.push({ ...point, prior, z, want });
    }
    check(
      label + '-canonical-corridor',
      maxError < 0.0001 &&
        (form === 'canyon' ? negative > 0 && positive === 0 : positive > 0 && negative === 0),
      { maxError, positive, negative, samples },
    );
    const savedPatch = await sample(page, watch.x, watch.y);
    await savePatch(label + '-saved.png', savedPatch.bytes);
    await native.capture(page, label + '-committed.png');
    evidence.forms.tools.push({
      label,
      form,
      before,
      after,
      command,
      samples,
      preupChanged: pixelDelta(baseline.bytes, preup.bytes),
      liveCommitChanged: pixelDelta(preup.bytes, savedPatch.bytes),
    });
    await history('undo', before, label + '-undo');
    await history('redo', after, label + '-redo');
    await persist();
  };
  await ready();
  await native.capture(page, 'forms-00-before.png');
  mark('forms: broad hills and overlapping continuation');
  await draw(
    'forms-hills',
    [
      [0.15, 0.3],
      [0.35, 0.3],
      [0.6, 0.27],
      [0.83, 0.32],
    ],
    { form: 'hills' },
  );
  await draw(
    'forms-hills-overlap',
    [
      [0.2, 0.35],
      [0.42, 0.34],
      [0.66, 0.35],
      [0.84, 0.3],
    ],
    { form: 'hills', followup: true },
  );
  mark('forms: curved mountain range and connected continuation');
  await draw(
    'forms-mountains',
    [
      [0.15, 0.72],
      [0.32, 0.61],
      [0.48, 0.74],
      [0.63, 0.66],
    ],
    { form: 'mountains', strength: 5 },
  );
  await draw(
    'forms-mountains-join',
    [
      [0.55, 0.7],
      [0.67, 0.66],
      [0.78, 0.72],
      [0.88, 0.64],
    ],
    { form: 'mountains', strength: 5, duration: 1600, followup: true },
  );
  mark('forms: continuous canyon cut into the mountain hillside');
  await draw(
    'forms-canyon',
    [
      [0.16, 0.72],
      [0.32, 0.61],
      [0.48, 0.74],
      [0.64, 0.66],
      [0.82, 0.7],
    ],
    { form: 'canyon', radius: 3, strength: 5 },
  );
  mark('forms: Escape and immediate successor retain selected form');
  await draw(
    'forms-escape',
    [
      [0.15, 0.45],
      [0.35, 0.45],
      [0.65, 0.45],
    ],
    { form: 'canyon', radius: 3, strength: 5, escape: true, followup: true },
  );
  await draw(
    'forms-canyon-followup',
    [
      [0.62, 0.66],
      [0.71, 0.69],
      [0.8, 0.7],
      [0.87, 0.65],
    ],
    { form: 'canyon', radius: 3, strength: 5, duration: 1200, followup: true },
  );
  mark('forms: local corrections through raise, lower and smooth');
  for (const mode of ['raise', 'lower', 'smooth']) {
    const tool = mode === 'smooth' ? 'smooth' : 'height';
    await page.locator(`[data-tool-select="land-tool"][data-tool-value="${tool}"]`).first().click();
    if (tool === 'height') await setHeightDirection(page, mode);
    await setBrushWorldRadius(page, 'land-radius', 8);
    await page.locator('#land-height-strength').fill('3');
    await page.locator('#land-height-strength').press('Tab');
    const g = await geometry(),
      p = g.screen([0.48, 0.74]),
      before = recoveryState(),
      old = terrain(),
      world = g.world([0.48, 0.74]);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    await ready();
    const command = await native.app.evaluate(() => globalThis.__qaFormCommands.at(-1)),
      next = terrain(),
      after = recoveryState();
    check(
      'forms-correction-' + mode,
      command.action.stroke.mode === mode &&
        command.action.stroke.form === undefined &&
        before.heights !== after.heights &&
        Math.abs(next.sample(world).heightM - old.sample(world).heightM) > 1e-5,
      { command, deltaM: next.sample(world).heightM - old.sample(world).heightM },
    );
  }
  const saved = recoveryState();
  await saveJson('forms-height-saved.json', queryHeights());
  mark('forms: top view and tilted near/far inspection');
  for (const [tilt, rotation, zoom] of [
    [0, 0, 0],
    [45, 20, 0],
    [45, 20, -240],
    [45, 20, 480],
  ]) {
    await page.locator('#atlas-view').click();
    for (const [id, value] of [
      ['terrain-tilt', tilt],
      ['terrain-rotation', rotation],
    ])
      await page.locator('#' + id).evaluate((n, v) => {
        n.value = String(v);
        n.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
    await page.keyboard.press('Escape');
    const g = await geometry(),
      p = g.screen([0.5, 0.5]);
    await page.mouse.move(p.x, p.y);
    if (zoom) await page.mouse.wheel(0, zoom);
    await page.waitForTimeout(350);
    await ready();
    await native.capture(page, `forms-inspect-${tilt}-${zoom}.png`);
    const pose = await page
      .locator('#campaign-map')
      .evaluate((n) => JSON.parse(n.dataset.terrainProjection));
    check(`forms-inspect-${tilt}-${zoom}-same-data`, recoveryState().heights === saved.heights, {
      pose,
    });
  }
  mark('forms: regular close and fresh reopen');
  await native.close();
  page = null;
  await openCampaign();
  await ready();
  const reopened = recoveryState();
  check(
    'forms-fresh-identical',
    saved.heights === reopened.heights && saved.cursor === reopened.cursor,
    { saved, reopened },
  );
  await native.capture(page, 'forms-fresh.png');
  evidence.forms.saved = saved;
  evidence.forms.reopened = reopened;
  await persist();
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
  if (formsProbe) {
    await exerciseFormTools();
  } else if (basicToolsProbe) {
    await exerciseBasicTools();
  } else {
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
    check(
      'gesture-one-duration-3-to-5s',
      Number.isFinite(oneMs) && oneMs >= 3000 && oneMs <= 5000,
      {
        actualHeldMs: oneMs ?? null,
        downAt: evidence.gestures.one.input?.downAt,
        upAt: evidence.gestures.one.input?.upAt,
      },
    );
    if (evidence.gestures.one.input && evidence.gestures.two.input)
      evidence.gestures.transitionMs =
        Date.parse(evidence.gestures.two.input.downAt) -
        Date.parse(evidence.gestures.one.input.upAt);
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
    if (recoveryProbe) {
      await exerciseRecovery(conflictProbe);
      savedHeights = queryHeights();
      savedRevision = queryRevision();
      evidence.recoveryHeightFile = await saveJson('height-after-recovery.json', savedHeights);
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
  for (const name of basicToolsProbe || formsProbe
    ? []
    : [
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
