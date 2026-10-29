import { formCorridorMetrics } from './atlas-form-corridor-probe.mjs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { access, mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';

const root = process.cwd();
const recoveryOnly = process.argv.includes('--recovery-only');
const recoveryProbe = recoveryOnly || process.argv.includes('--recovery');
const dropFollowup = process.argv.includes('--drop-followup');
const conflictProbe = process.argv.includes('--source-conflict');
const basicInputsOnly = process.argv.includes('--basic-inputs');
const basicToolsProbe = basicInputsOnly || process.argv.includes('--basic-tools');
const formsFollowup = process.argv
  .find((a) => a.startsWith('--forms-followup='))
  ?.slice('--forms-followup='.length);
const formsProbe = !!formsFollowup || process.argv.includes('--forms');
const multiscaleFresh = process.argv
  .find((a) => a.startsWith('--multiscale-fresh='))
  ?.slice('--multiscale-fresh='.length);
const multiscaleProbe = !!multiscaleFresh || process.argv.includes('--multiscale');
if (conflictProbe && !recoveryProbe) throw Error('--source-conflict requires --recovery.');
const scale = 1;
if (![1].includes(scale)) throw Error('Native UI probes use 100% only.');
const output =
  process.env.QA_EVIDENCE_DIR ??
  path.resolve('.build/atlas-terrain-stroke', `${Date.now()}-${process.pid}`);
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
let explicitFreshPose;

const sha = (data) => createHash('sha256').update(data).digest('hex');
const sourceFiles = [
  './desktop/host-ipc.ts',
  './desktop/store-worker.ts',
  './src/app/shared/contracts.ts',
  './src/app/storage/store.ts',
  './src/app/storage/atlas-commit-projection.ts',
  './src/app/atlas/campaign-atlas-author.ts',
  './src/app/atlas/terrain-stroke-queue.ts',
  './src/app/atlas/terrain-queue-recovery.ts',
  './src/app/atlas/atlas-terrain-edits.ts',
  './src/app/atlas/atlas-author.ts',
  './src/app/atlas/atlas-regions.ts',
  './src/app/atlas/atlas-journey.ts',
  './src/app/atlas/atlas-drawing.ts',
  './src/app/atlas/atlas-output.ts',
  './src/app/atlas/campaign-atlas-ui.ts',
  './src/app/atlas/landscape-brush-session.ts',
  './src/app/atlas/terrain-live-stroke.ts',
  './src/app/atlas/landscape-tool-settings.ts',
  './src/app/atlas/terrain-brush.ts',
  './src/app/atlas/atlas-screen-triangle.ts',
  './src/app/atlas/atlas-screen-segment.ts',
  './src/app/atlas/terrain-screen-input.ts',
  './src/app/atlas/terrain-stroke-support.ts',
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
  './src/app/atlas/atlas-presentation-host.ts',
  './src/app/atlas/atlas-raster-presentation.ts',
  './src/app/atlas/atlas-raster-tile-stream.ts',
  './src/app/atlas/atlas-surface-reuse.ts',
  './src/app/atlas/atlas-surface-tile-stream.ts',
  './src/app/atlas/atlas-terrain-tile-model.ts',
  './src/app/atlas/atlas-terrain-tile.ts',
  './src/app/atlas/landscape-workbench-types.ts',
  './src/app/atlas/terrain-frame.ts',
  './src/app/atlas/terrain-projection.ts',
  './src/app/atlas/terrain-spatial-model.ts',
  './src/app/storage/atlas-landscape-region.ts',
  './src/app/storage/atlas-terrain-tiles.ts',
  './src/app/storage/terrain-scale.ts',
  './src/app/storage/terrain-editing-source.ts',
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
async function canonicalBrushGrid(readTerrainGrid) {
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
    null,
    { timeout: 60000 },
  );
  const view = await page.evaluate(() => window.__qaRaster.visibility()),
    db = new Database(path.join(native.profile, 'workbench.sqlite'), { readonly: true });
  try {
    return readTerrainGrid(db, fixture.campaignId, view);
  } finally {
    db.close();
  }
}
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
  await native.app.evaluate(({ ipcMain }, drop) => {
    const state = (globalThis.__qaRecovery = {
      calls: [],
      resolutions: [],
      resolutionResults: [],
      writes: [],
      held: false,
      allowResolution: false,
      drop,
      release: null,
    });
    const original = ipcMain._invokeHandlers.get('atlas:commit');
    state.originalCommit = original;
    ipcMain.removeHandler('atlas:commit');
    ipcMain.handle('atlas:commit', async (...args) => {
      state.event = args[0];
      state.calls.push(structuredClone(args[1]));
      if (state.drop && state.calls.length === 2)
        return {
          ok: true,
          value: {
            ...state.firstAck,
            commandId: args[1].commandId,
            revision: state.firstAck.revision + 1,
          },
        };
      const result = await original(...args);
      state.writes.push(result);
      if (state.calls.length !== 1 || !result.ok) return result;
      state.firstAck = result.value;
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
      const result = !state.allowResolution
        ? { ok: true, value: { outcome: 'unknown' } }
        : await reconcile(...args);
      state.resolutionResults.push({ result, dispatches: state.calls.length });
      return result;
    });
  }, dropFollowup);
  const stroke = async (fraction) => {
    const box = await page.locator('#campaign-map').boundingBox();
    await moveBrushTo(
      { x: box.x + box.width * 0.5, y: box.y + box.height * fraction },
      'recovery-' + fraction,
    );
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
      throw Error(
        'Committed reply did not reach the controlled hold: ' +
          JSON.stringify({
            calls: globalThis.__qaRecovery.calls,
            writes: globalThis.__qaRecovery.writes,
          }),
      );
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
  await native.app.evaluate(async () => {
    const end = Date.now() + 15000;
    while (!globalThis.__qaRecovery.resolutions.length && Date.now() < end)
      await new Promise((r) => setTimeout(r, 20));
    if (!globalThis.__qaRecovery.resolutions.length) throw Error('No automatic receipt read');
  });
  const blocked = recoveryState();
  const held = await native.app.evaluate(() => ({
    calls: globalThis.__qaRecovery.calls,
    resolutions: globalThis.__qaRecovery.resolutions,
  }));
  check(
    'unknown-keeps-original-and-automatically-reads-without-dialog',
    held.calls.length === 1 &&
      held.resolutions.length > 0 &&
      committed.revision === before.revision + 1 &&
      JSON.stringify(blocked) === JSON.stringify(committed) &&
      (await page.locator('dialog[open]').count()) === 0,
    {
      before,
      committed,
      blocked,
      dispatches: held.calls.length,
      automaticReads: held.resolutions.length,
    },
  );
  evidence.automaticPendingNotice = await page.locator('#atlas-save-status').textContent();
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
            state.callsAtFailedSource = state.calls.length;
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
  await native.app.evaluate(() => {
    globalThis.__qaRecovery.allowResolution = true;
  });
  if (conflictProbe) {
    await page.waitForFunction(() => !document.querySelector('#atlas-strokes-retry').hidden);
    const conflict = recoveryState();
    const calls = await native.app.evaluate(() => globalThis.__qaRecovery.calls.length);
    check(
      'changed-source-retains-successor-with-optional-actions',
      calls === 1 &&
        conflict.cursor === committed.cursor + 1 &&
        conflict.heights === committed.heights &&
        (await page.locator('dialog[open]').count()) === 0 &&
        (await page.locator('#atlas-save-status').textContent()) ===
          'Letzter Pinselzug nicht übernommen',
      { calls, committed, conflict },
    );
    evidence.foreignSourceState = conflict;
    await page.locator('#atlas-status').click();
    await page.locator('#atlas-strokes-retry').click();
  }
  await page.waitForFunction(
    () =>
      document.querySelector('#atlas-recover').hidden &&
      document.querySelector('#campaign-map').dataset.terrainReady === 'ready' &&
      !document.querySelector('#land-tool').disabled,
    null,
    { timeout: 60000 },
  );
  if (failSourceRead) {
    const failed = await native.app.evaluate(() => ({
      failed: globalThis.__qaRecovery.failedSource,
      calls: globalThis.__qaRecovery.callsAtFailedSource,
    }));
    check(
      'source-read-failure-keeps-closed-successor',
      failed.failed && failed.calls === 1,
      failed,
    );
  }
  const resolved = recoveryState();
  const resolution = await native.app.evaluate(() => ({
    calls: globalThis.__qaRecovery.calls,
    resolutions: globalThis.__qaRecovery.resolutions,
    results: globalThis.__qaRecovery.resolutionResults,
  }));
  check(
    'unknown-resolution-never-duplicates-original',
    resolution.resolutions.length >= 1 &&
      resolution.results.filter((r) => r.result.value?.outcome === 'applied').length === 1 &&
      resolution.results.every((r) => r.dispatches === 1) &&
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
async function openCampaign(resetView = true) {
  page = await native.launch(scale);
  if (multiscaleProbe || formsProbe || basicToolsProbe) {
    // Read-only debugger binding to the actual presentation instance. It does
    // not replace modules, alter builds, or add a production test bridge.
    const code = await readFile(path.join(root, '.build/desktop/ui/renderer.js'), 'utf8');
    const offset = code.indexOf(
      'this.surface.setTerrain(',
      code.indexOf('var AtlasRasterPresentation = class'),
    );
    if (offset < 0) throw Error('Native height observer binding missing');
    const session = await page.context().newCDPSession(page);
    await session.send('Debugger.enable');
    const breakpoint = await session.send('Debugger.setBreakpointByUrl', {
      urlRegex: 'renderer\\.js$',
      lineNumber: code.slice(0, offset).split('\n').length - 1,
    });
    session.once('Debugger.paused', async (event) => {
      try {
        await session.send('Debugger.evaluateOnCallFrame', {
          callFrameId: event.callFrames[0].callFrameId,
          expression: 'globalThis.__qaRaster = this',
        });
        await session.send('Debugger.removeBreakpoint', { breakpointId: breakpoint.breakpointId });
      } finally {
        await session.send('Debugger.resume');
        await session.send('Debugger.disable');
      }
    });
  }
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
  await native.app.evaluate(
    ({ BrowserWindow }, factor) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1920 * factor, 1080 * factor),
    multiscaleProbe ? scale : 1,
  );
  await page.evaluate(
    ({ id, resetView, explicitFreshPose }) => {
      sessionStorage.setItem('atlas-raster-workbench', 'true');
      if (explicitFreshPose)
        localStorage.setItem(
          'atlas-camera:' + id,
          JSON.stringify({ ...explicitFreshPose.frame, pose: explicitFreshPose }),
        );
      if (resetView)
        localStorage.setItem(
          'atlas-camera:' + id,
          JSON.stringify({ x: 0, y: 0, width: 64, height: 64 }),
        );
    },
    { id: fixture.campaignId, resetView, explicitFreshPose },
  );
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
async function moveBrushTo(point, label) {
  await page.mouse.move(point.x, point.y);
  const snapshot = () =>
    page.locator('#campaign-map').evaluate((el) => {
      const r = window.__qaRaster,
        editing = r?.editing,
        source = editing?.source;
      return {
        state: el.dataset.terrainEditingState,
        radius: el.dataset.terrainEditingRadius,
        requestedRadius: document.querySelector('#land-radius').value,
        summary: el.dataset.terrainEditingSource,
        error: el.dataset.terrainEditingError,
        view: r?.visibility(),
        revision: r?.revision,
        fence: r?.fence,
        source: source
          ? {
              revision: source.revision,
              fence: source.fence,
              radius: source.radius,
              box: source.box,
              supports: source.supports,
              view: source.visibility?.view,
            }
          : null,
        pending: editing?.pending
          ? {
              identity: editing.pending.identity,
              box: editing.pending.box,
              supports: editing.pending.supports,
            }
          : null,
        read: r?.editingRead,
      };
    });
  const gate = { label, point, before: await snapshot() },
    started = Date.now();
  (evidence.editingGates ??= []).push(gate);
  await persist();
  try {
    await page.waitForFunction(
      () => {
        const map = document.querySelector('#campaign-map');
        return (
          map.dataset.terrainEditingState === 'ready' &&
          Number(map.dataset.terrainEditingRadius) ===
            Number(document.querySelector('#land-radius').value)
        );
      },
      null,
      { timeout: 60000 },
    );
  } finally {
    gate.after = await snapshot();
    gate.ms = Date.now() - started;
    await persist();
  }
}
async function runGesture(label, start, end, watch, box, baseline, durationMs) {
  const safeDistancePx = box.width * 0.19;
  await beginPixelObserver(label, baseline.bytes, watch, safeDistancePx);
  const eventBefore = await page.evaluate(() => window.__qaTerrainStrokeInputs.length);
  await moveBrushTo(start, label);
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
    // Keep the endpoint held through a normal presentation turn, as the plain
    // and form gestures already do, before measuring the final live frame.
    await page.waitForTimeout(300);
    evidence.gestures[label + '-preup'] = await page.evaluate(() => ({
      consumed: window.__qaRaster?.draft?.consumed,
      input: window.__qaRaster?.pendingStroke?.samples.length,
      sourcePending: !!window.__qaRaster?.editing.pending,
      quality: document.querySelector('#campaign-map').dataset.terrainQuality,
    }));
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
    await moveBrushTo(p.start, 'basic-plain-' + ending);
    await page.mouse.down();
    await page.waitForTimeout(400);
    await page.mouse.move(p.end.x, p.end.y, { steps: 5 });
    await page.waitForTimeout(300);
    if (ending === 'escape') await page.keyboard.press('Escape');
    await page.mouse.up();
  };
  evidence.basic = {
    scale,
    inputLifecycleOnly: basicInputsOnly,
    sampleLatencyClaim: 'none',
    tools: [],
    inputEvents: [],
  };
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
  for (const mode of basicInputsOnly ? [] : ['raise', 'lower', 'roughen', 'smooth']) {
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
  await moveBrushTo(cancelPoints.start, 'basic-pointercancel');
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
  await moveBrushTo(blurPoints.start, 'basic-native-blur');
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
  if (!basicInputsOnly) {
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
  }
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
        "export {TerrainSampler} from './src/app/atlas/terrain-height';export {applyTerrainBrush,prepareHeightBrush} from './src/app/atlas/terrain-brush';export {readTerrainGrid} from './src/app/storage/terrain-grid';",
      resolveDir: root,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const reference = path.join(output, 'form-reference.cjs');
  await writeFile(reference, bundle.outputFiles[0].contents);
  const { TerrainSampler, applyTerrainBrush, prepareHeightBrush, readTerrainGrid } = require(
    reference,
  );
  const records = () => queryHeights().map((height) => ({ height, id: height.id, revision: 0 }));
  const terrain = () => new TerrainSampler(records());
  const ready = async (revision = queryRevision()) => {
    await page.waitForFunction(
      (revision) => {
        const m = document.querySelector('#campaign-map');
        return (
          m.dataset.terrainReady === 'ready' &&
          m.dataset.terrainQuality === 'detail' &&
          Number(m.dataset.terrainRevision) >= revision &&
          !m.dataset.terrainDraft &&
          !document.querySelector('#land-tool').disabled
        );
      },
      revision,
      { timeout: 60000 },
    );
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  };
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
    knots,
    { form, radius = 8, strength = 4, duration = 2400, escape = false, followup = false } = {},
  ) => {
    await ready();
    if (form && !followup) await choose(form, radius, strength);
    const g = await geometry(),
      points = knots.map(g.screen),
      watch = points[1],
      before = recoveryState(),
      original = records();
    const boundGrid = await canonicalBrushGrid(readTerrainGrid);
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
    await moveBrushTo(points[0], label);
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
    const liveFrame = await page.evaluate(() => {
      const canvas = document.querySelector('#atlas-terrain-spatial canvas'),
        gl = canvas.getContext('webgl2'),
        width = gl.drawingBufferWidth,
        height = gl.drawingBufferHeight,
        pixels = new Uint8Array(width * height * 4),
        previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
      window.__qaFormLiveFrame = { width, height, pixels };
      return { width, height, sampledAt: performance.now() };
    });
    check(
      label + '-not-written-before-up',
      held.heights === before.heights && held.cursor === before.cursor,
      { before, held },
    );
    if (escape) await page.keyboard.press('Escape');
    await page.mouse.up();
    const livePng = await page.evaluate(() => {
      const { width, height, pixels } = window.__qaFormLiveFrame,
        canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d'),
        image = context.createImageData(width, height);
      for (let y = 0; y < height; y++)
        image.data.set(
          pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4),
          y * width * 4,
        );
      context.putImageData(image, 0, 0);
      delete window.__qaFormLiveFrame;
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await writeFile(path.join(output, label + '-live.png'), Buffer.from(livePng, 'base64'));
    try {
      await ready(escape ? before.revision : before.revision + 1);
    } catch (error) {
      await saveJson(label + '-failure-state.json', {
        before,
        actual: recoveryState(),
        commands: await native.app.evaluate(() => globalThis.__qaFormCommands),
        renderer: await page.evaluate(() => ({
          status: document.querySelector('#atlas-status').textContent,
          saveStatus: document.querySelector('#atlas-save-status')?.textContent,
          editingError: document.querySelector('#campaign-map').dataset.terrainEditingError,
          stroke: structuredClone(window.__qaRaster.pendingStroke),
        })),
      });
      throw error;
    }
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
      !!observed.first &&
        observed.first.sampledAt < up?.at &&
        liveFrame.sampledAt < up?.at &&
        observed.first.changedPixels > 10,
      {
        sampledAt: observed.first?.sampledAt,
        upAt: up?.at,
        liveFrame,
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
    const computed = applyTerrainBrush(original, command.action.stroke, undefined, boundGrid),
      ids = new Set(computed.map((r) => r.id)),
      expected = new TerrainSampler([...original.filter((r) => !ids.has(r.id)), ...computed]),
      actual = terrain();
    const plan = prepareHeightBrush(command.action.stroke, boundGrid);
    const samples = [];
    let maxError = 0,
      positive = 0,
      negative = 0;
    for (const point of plan.sections
      .map((s) => s.point(0.5))
      .filter((_, i) => i % Math.max(1, Math.floor(plan.sections.length / 20)) === 0)) {
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
    if (form === 'canyon') {
      const metrics = formCorridorMetrics(plan, radius, new TerrainSampler(original), actual);
      check(
        label + '-continuous-floor-amplitude',
        metrics.sampleCount > 2 && metrics.minDropM > metrics.maxDropM * 0.7,
        {
          minDropM: metrics.minDropM,
          maxDropM: metrics.maxDropM,
          sampleCount: metrics.sampleCount,
        },
      );
      check(
        label + '-floor-between-banks',
        metrics.profile.length > 2 && metrics.incised / metrics.profile.length > 0.7,
        { profile: metrics.profile, incised: metrics.incised },
      );
    }
    const displayed = await page.locator('#campaign-map').evaluate((n) => ({
      revision: Number(n.dataset.terrainRevision),
      quality: n.dataset.terrainQuality,
      ready: n.dataset.terrainReady,
      cache: JSON.parse(n.dataset.terrainCache),
    }));
    check(
      label + '-canonical-display-adopted',
      displayed.revision === after.revision && displayed.quality === 'detail',
      { displayed, canonicalRevision: after.revision },
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
      liveFrame,
      displayed,
    });
    await history('undo', before, label + '-undo');
    await history('redo', after, label + '-redo');
    await persist();
  };
  await ready();
  await native.capture(page, 'forms-00-before.png');
  if (!formsFollowup) {
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
        [0.16, 0.66],
        [0.32, 0.55],
        [0.48, 0.68],
        [0.64, 0.6],
        [0.82, 0.64],
      ],
      { form: 'canyon', radius: 3, strength: 7.5 },
    );
    mark('forms: Escape and immediate successor retain selected form');
    await draw(
      'forms-escape',
      [
        [0.15, 0.45],
        [0.35, 0.45],
        [0.65, 0.45],
      ],
      { form: 'canyon', radius: 3, strength: 7.5, escape: true, followup: true },
    );
    await draw(
      'forms-canyon-followup',
      [
        [0.62, 0.6],
        [0.71, 0.63],
        [0.8, 0.64],
        [0.87, 0.59],
      ],
      { form: 'canyon', radius: 3, strength: 7.5, duration: 1200, followup: true },
    );
  }
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
      world = await page.evaluate((p) => window.__qaRaster.authorPoint(p.x, p.y), p);
    if (!world) throw Error('Native form correction requires a visible first hit');
    await moveBrushTo(p, 'forms-correction-' + mode);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    await ready(before.revision + 1);
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

/** The same small multiscale task on the real native renderer and writer. */
async function exerciseMultiscaleTools() {
  await page.waitForFunction(() => !!window.__qaRaster);
  check(
    'multi-same-logical-viewport',
    evidence.runtime.contentSize[0] === 1920 &&
      evidence.runtime.contentSize[1] === 1080 &&
      evidence.runtime.dpr === scale,
    { contentSize: evidence.runtime.contentSize, dpr: evidence.runtime.dpr },
  );
  const bundle = await build({
    stdin: {
      contents:
        "export {TerrainSampler} from './src/app/atlas/terrain-height';export {applyTerrainBrush,prepareHeightBrush} from './src/app/atlas/terrain-brush';export {readTerrainGrid} from './src/app/storage/terrain-grid';export {gridHeight} from './src/app/atlas/terrain-spatial-model';export {atlasCameraWorldEye} from './src/app/atlas/atlas-camera';",
      resolveDir: root,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const reference = path.join(output, 'multiscale-reference.cjs');
  await writeFile(reference, bundle.outputFiles[0].contents);
  const {
    TerrainSampler,
    applyTerrainBrush,
    gridHeight,
    atlasCameraWorldEye,
    readTerrainGrid,
  } = require(reference);
  const records = () => queryHeights().map((h) => ({ id: h.id, height: h, revision: 0 }));
  const samplePoints = [
    { x: 16.13, y: 24.27 },
    { x: 24.17, y: 30.31 },
    { x: 32.11, y: 32.29 },
    { x: 39.73, y: 31.83 },
    { x: 48.27, y: 40.13 },
    { x: 2, y: 2 },
  ];
  const ready = async (radius = 0, revision = queryRevision()) => {
    await page.waitForFunction(
      ({ radius, revision }) => {
        const m = document.querySelector('#campaign-map'),
          r = window.__qaRaster;
        return (
          m.dataset.terrainQuality === 'detail' &&
          !m.dataset.terrainDraft &&
          Number(m.dataset.terrainRevision) >= revision &&
          (radius === 0 || Number(m.dataset.terrainEditingRadius) >= radius) &&
          r?.tiles.every((t) => t.revision >= revision) &&
          !document.querySelector('#land-tool').disabled
        );
      },
      { radius, revision },
      { timeout: 90000 },
    );
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  };
  await page.evaluate(() => {
    const r = window.__qaRaster;
    window.__qaHeightSnapshot = () => ({
      camera: r.cameraPose(),
      meshMaximumErrorM: Math.max(
        0,
        ...r.tiles.map((t) => {
          const address = t.tile,
            model = r.surface.terrain.find(
              (m) => m.object.id === `terrain-tile:${address.lod}/${address.x}/${address.y}`,
            ),
            heights = t.terrain.projection.grid.heights;
          if (!model) return Infinity;
          let error = 0;
          for (let i = 0; i < heights.length; i++)
            error = Math.max(
              error,
              Math.abs(
                model.object.origin.heightM +
                  model.mesh.attributes.POSITION.value[i * 3 + 2] -
                  heights[i],
              ),
            );
          return error;
        }),
      ),
      tiles: r.tiles.map((t) => ({
        tile: t.tile,
        revision: t.revision,
        fence: t.fence,
        view: t.terrain.projection.grid.view,
        heights: Array.from(t.terrain.projection.grid.heights),
        ground: Array.from(t.terrain.projection.grid.editing.ground),
      })),
    });
    const preview = r.previewHeight.bind(r);
    r.previewHeight = (s) => {
      preview(s);
      window.__qaLastHeightLive = {
        ...window.__qaHeightSnapshot(),
        stroke: structuredClone(s),
        at: performance.now(),
      };
    };
    const gesture = r.gesture.bind(r);
    r.gesture = (active) => {
      if (!active && window.__qaLastHeightLive) {
        const snapshot = window.__qaLastHeightLive;
        window.__qaHeightRelease = new Promise((resolve) =>
          requestAnimationFrame(() => {
            const c = document.querySelector('#atlas-terrain-spatial canvas'),
              gl = c.getContext('webgl2');
            const width = gl.drawingBufferWidth,
              height = gl.drawingBufferHeight,
              pixels = new Uint8Array(width * height * 4),
              old = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
            gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, old);
            window.__qaHeightImage = { width, height, pixels };
            resolve(snapshot);
          }),
        );
      }
      return gesture(active);
    };
  });
  await native.app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get('atlas:commit');
    globalThis.__qaMultiscaleCommands = [];
    ipcMain.removeHandler('atlas:commit');
    ipcMain.handle('atlas:commit', (...args) => {
      globalThis.__qaMultiscaleCommands.push(structuredClone(args[1]));
      return original(...args);
    });
  });
  evidence.multiscale = {
    scale,
    gestures: [],
    samplePoints,
    scope: 'Functional author/display equality; no p95 or raster-aesthetics claim',
  };
  const choose = async ({
    mode = 'raise',
    form,
    radius = 16,
    strength = 3,
    preserveDetails = true,
  }) => {
    await page
      .locator(
        `[data-tool-select="land-tool"][data-tool-value="${mode === 'smooth' ? 'smooth' : 'height'}"]`,
      )
      .first()
      .click();
    if (form) await page.locator(`[data-form="${form}"]`).click();
    else if (mode !== 'smooth') await setHeightDirection(page, mode);
    await setBrushWorldRadius(page, 'land-radius', radius);
    await page.locator('#land-height-strength').fill(String(strength));
    await page.locator('#land-height-strength').press('Tab');
    await page.locator('#land-preserve-details').setChecked(preserveDetails);
    // The selected radius is loaded at the actual hover in moveBrushTo,
    // after the display itself is complete.
    await ready();
  };
  const snapshot = () => page.evaluate(() => window.__qaHeightSnapshot());
  const saveLiveImage = async (label) => {
    const encoded = await page.evaluate(() => {
      const { width, height, pixels } = window.__qaHeightImage,
        c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d'),
        im = ctx.createImageData(width, height);
      for (let y = 0; y < height; y++)
        im.data.set(
          pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4),
          y * width * 4,
        );
      ctx.putImageData(im, 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    });
    await writeFile(path.join(output, label + '-live.png'), Buffer.from(encoded, 'base64'));
  };
  const draw = async (
    label,
    options,
    pathPoints = [
      [0.28, 0.48],
      [0.5, 0.5],
      [0.72, 0.52],
    ],
  ) => {
    mark('multiscale ' + label);
    await choose(options);
    const before = recoveryState(),
      original = records(),
      box = await page.locator('#campaign-map').boundingBox();
    const boundGrid = await canonicalBrushGrid(readTerrainGrid);
    await native.capture(page, label + '-before.png');
    const points = pathPoints.map(([u, v]) => ({
      x: box.x + u * box.width,
      y: box.y + v * box.height,
    }));
    await moveBrushTo(points[0], label);
    await page.evaluate(() => {
      window.__qaHeightRelease = null;
      window.__qaHeightImage = null;
    });
    await page.mouse.down();
    const started = Date.now(),
      duration = 1800;
    while (Date.now() - started < duration) {
      const progress = Math.min(0.9999, (Date.now() - started) / duration) * (points.length - 1),
        i = Math.floor(progress),
        t = progress - i;
      await page.mouse.move(
        points[i].x * (1 - t) + points[i + 1].x * t,
        points[i].y * (1 - t) + points[i + 1].y * t,
      );
      await page.waitForTimeout(50);
    }
    await page.mouse.move(points.at(-1).x, points.at(-1).y);
    // Release first: all images and numerical exports happen without adding hold time.
    await page.mouse.up();
    await page.waitForFunction(() => !!window.__qaHeightRelease, null, { timeout: 60000 });
    const live = await page.evaluate(() => window.__qaHeightRelease);
    await saveLiveImage(label);
    await ready(options.radius, before.revision + 1);
    const canonical = await snapshot(),
      after = recoveryState(),
      command = await native.app.evaluate(() => globalThis.__qaMultiscaleCommands.at(-1));
    check(
      label + '-one-command',
      after.cursor === before.cursor + 1 &&
        after.commands === before.cursor + 1 &&
        after.receipts === before.receipts + 1 &&
        command.action.stroke.preserveDetails === (options.preserveDetails !== false),
      { before, after, stroke: command.action.stroke },
    );
    check(
      label + '-last-live-is-final-input',
      JSON.stringify(command.action.stroke) === JSON.stringify(live.stroke),
    );
    const expected = applyTerrainBrush(original, command.action.stroke, undefined, boundGrid),
      actual = new Map(records().map((r) => [r.id, r.height.data]));
    check(
      label + '-canonical-author-bytes',
      expected.every((r) => actual.get(r.id) === r.height.data),
      { changedTiles: expected.length },
    );
    let maximum = 0,
      maximumHeight = 0,
      pointsCompared = 0;
    const tiles = new Map(canonical.tiles.map((t) => [JSON.stringify(t.tile), t]));
    for (const t of live.tiles) {
      const c = tiles.get(JSON.stringify(t.tile));
      if (!c) continue;
      for (let i = 0; i < t.ground.length; i++) {
        maximum = Math.max(maximum, Math.abs(t.ground[i] - c.ground[i]));
        maximumHeight = Math.max(maximumHeight, Math.abs(t.ground[i]), Math.abs(c.ground[i]));
        pointsCompared++;
      }
    }
    // Two Float32 roundings, followed by the same interpolation; cap the
    // acceptance at 1 mm rather than expanding it for a failing observation.
    const toleranceM = Math.min(
      0.001,
      2 * Math.max(2 ** -149, 2 ** (Math.floor(Math.log2(maximumHeight || 1)) - 23)),
    );
    check(
      label + '-displayed-mesh-heights',
      live.meshMaximumErrorM <= toleranceM && canonical.meshMaximumErrorM <= toleranceM,
      {
        liveMaximumErrorM: live.meshMaximumErrorM,
        canonicalMaximumErrorM: canonical.meshMaximumErrorM,
      },
    );
    check(label + '-live-canonical-heights', pointsCompared > 0 && maximum <= toleranceM, {
      maximumErrorM: maximum,
      toleranceM,
      pointsCompared,
    });
    check(
      label + '-actual-displayed-revision',
      canonical.tiles.every((t) => t.revision === after.revision),
      { target: after.revision, actual: canonical.tiles.map((t) => t.revision) },
    );
    const at = (state, p) => {
      const t = state.tiles.find(
        (t) =>
          p.x >= t.view.box.x &&
          p.y >= t.view.box.y &&
          p.x <= t.view.box.x + t.view.box.width &&
          p.y <= t.view.box.y + t.view.box.height,
      );
      return t ? gridHeight({ view: t.view, heights: t.heights }, p) : null;
    };
    const measurements = samplePoints.map((p) => ({
      ...p,
      live: at(live, p),
      canonical: at(canonical, p),
    }));
    check(
      label + '-fixed-world-samples',
      measurements.every(
        (p) =>
          p.live !== null && p.canonical !== null && Math.abs(p.live - p.canonical) <= toleranceM,
      ),
      { measurements },
    );
    const fine = original.filter(
      (r) => r.height.pixel < 2 ** Math.floor(Math.log2(options.radius / 32)),
    );
    check(
      label + '-detail-policy',
      options.preserveDetails === false
        ? fine.some((r) => actual.get(r.id) !== r.height.data)
        : fine.every((r) => actual.get(r.id) === r.height.data),
      { fineTiles: fine.length, preserveDetails: options.preserveDetails !== false },
    );
    const sampleBefore = new TerrainSampler(original),
      sampleAfter = new TerrainSampler(records());
    check(
      label + '-outside-preserved',
      sampleBefore.sample({ x: 2, y: 2 }).heightM === sampleAfter.sample({ x: 2, y: 2 }).heightM,
    );
    await native.capture(page, label + '-canonical.png');
    const liveEye = atlasCameraWorldEye(live.camera),
      canonicalEye = atlasCameraWorldEye(canonical.camera);
    check(
      label + '-same-world-camera',
      ['x', 'y', 'heightM'].every((key) => Math.abs(liveEye[key] - canonicalEye[key]) < 1e-9),
      { liveEye, canonicalEye },
    );
    const item = {
      label,
      before,
      after,
      maximumErrorM: maximum,
      pointsCompared,
      measurements,
      liveCamera: live.camera,
      canonicalCamera: canonical.camera,
      liveEye: atlasCameraWorldEye(live.camera),
      canonicalEye: atlasCameraWorldEye(canonical.camera),
      stroke: command.action.stroke,
    };
    evidence.multiscale.gestures.push(item);
    await saveJson(label + '-heights.json', { live, canonical });
    await persist();
    return { before, after };
  };
  const history = async (kind, expected, label) => {
    const prior = queryRevision();
    await page.locator('#atlas-' + kind).click();
    await ready(0, prior + 1);
    const actual = recoveryState();
    check(label, actual.heights === expected.heights && actual.cursor === expected.cursor, {
      actual,
      expected,
    });
  };
  await draw('multi-hills', { form: 'hills', radius: 8, strength: 3 });
  await draw('multi-mountains', { form: 'mountains', radius: 6, strength: 3 }, [
    [0.4, 0.3],
    [0.5, 0.5],
    [0.6, 0.7],
  ]);
  await draw('multi-canyon', { form: 'canyon', radius: 3, strength: 2 }, [
    [0.3, 0.4],
    [0.5, 0.5],
    [0.7, 0.6],
  ]);
  await draw('multi-smooth-protected', { mode: 'smooth', radius: 16, strength: 4 });
  await draw('multi-smooth-unprotected', {
    mode: 'smooth',
    radius: 8,
    strength: 3,
    preserveDetails: false,
  });
  for (const mode of ['raise', 'lower']) {
    const protectedRun = await draw('multi-' + mode + '-protected', {
      mode,
      radius: 16,
      strength: 3,
    });
    await history('undo', protectedRun.before, 'multi-' + mode + '-protected-undo');
    const unprotectedRun = await draw('multi-' + mode + '-unprotected', {
      mode,
      radius: 16,
      strength: 3,
      preserveDetails: false,
    });
    await history('undo', unprotectedRun.before, 'multi-' + mode + '-unprotected-undo');
    await history('redo', unprotectedRun.after, 'multi-' + mode + '-unprotected-redo');
  }
  const saved = recoveryState(),
    savedCamera = await page.evaluate(() => window.__qaRaster.cameraPose()),
    savedSamples = new TerrainSampler(records());
  const samples = samplePoints.map((p) => ({ ...p, height: savedSamples.sample(p).heightM }));
  await native.capture(page, 'multi-saved.png');
  await native.close();
  await openCampaign(false);
  await ready();
  const freshCamera = await page.evaluate(() => window.__qaRaster.cameraPose()),
    savedEye = atlasCameraWorldEye(savedCamera),
    freshEye = atlasCameraWorldEye(freshCamera);
  check(
    'multi-fresh-same-world-camera',
    ['x', 'y', 'heightM'].every((key) => Math.abs(savedEye[key] - freshEye[key]) < 1e-9),
    { savedCamera, freshCamera, savedEye, freshEye },
  );
  const fresh = recoveryState(),
    freshSampler = new TerrainSampler(records());
  check(
    'multi-fresh-identical',
    fresh.heights === saved.heights &&
      fresh.cursor === saved.cursor &&
      fresh.commands === saved.commands &&
      samples.every((p) => freshSampler.sample(p).heightM === p.height),
    { saved, fresh, samples },
  );
  await native.capture(page, 'multi-fresh.png');
  evidence.multiscale.saved = saved;
  evidence.multiscale.fresh = fresh;
  evidence.multiscale.savedCamera = savedCamera;
  evidence.multiscale.freshCamera = freshCamera;
  await persist();
}

try {
  mark('fixture creation');
  if (formsFollowup || multiscaleFresh) {
    const previous = JSON.parse(await readFile(formsFollowup ?? multiscaleFresh, 'utf8'));
    const last = previous.forms?.tools.at(-1);
    if (formsFollowup && last?.label !== 'forms-canyon-followup')
      throw Error('Form followup requires secured complete canyon source');
    const from = new Database(path.join(previous.profile, 'workbench.sqlite'), { readonly: true });
    try {
      await from.backup(path.join(native.profile, 'workbench.sqlite'));
    } finally {
      from.close();
    }
    await cp(
      path.join(previous.profile, 'Local Storage'),
      path.join(native.profile, 'Local Storage'),
      { recursive: true },
    );
    fixture = {
      ...previous.fixture,
      profile: native.profile,
      profilePath: native.profile,
      filename: path.join(native.profile, 'workbench.sqlite'),
    };
    const restored = recoveryState();
    const expected = multiscaleFresh ? previous.multiscale.saved : last.after;
    if (
      restored.heights !== expected.heights ||
      restored.cursor !== expected.cursor ||
      restored.commands !== expected.commands
    )
      throw Error('Secured form source differs from the last completed native author state');
    evidence.resumedSource = { report: formsFollowup ?? multiscaleFresh, expected, restored };
    if (multiscaleFresh) explicitFreshPose = previous.multiscale.savedCamera;
  } else {
    fixture = await createAtlasCanonicalFixture({
      profilePath: native.profile,
      campaignName: 'Terrain Stroke',
      includeCity: false,
      peak: { x: 32, y: 32 },
      baseHeightM: 2,
      peakRiseM: 1.5,
      hillScale: 350,
    });
  }
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
  await openCampaign(!formsFollowup && !multiscaleFresh);
  if (multiscaleFresh) {
    const expected = explicitFreshPose;
    const before = recoveryState();
    const restored = await page.evaluate(() => window.__qaRaster.cameraPose());
    check('explicit-pose-restored', JSON.stringify(restored) === JSON.stringify(expected), {
      expected,
      restored,
    });
    await native.capture(page, 'explicit-pose-restored.png');
    explicitFreshPose = undefined;
    await native.close();
    await openCampaign(false);
    const fresh = await page.evaluate(() => window.__qaRaster.cameraPose());
    check('explicit-pose-fresh', JSON.stringify(fresh) === JSON.stringify(expected), {
      expected,
      fresh,
    });
    const after = recoveryState();
    check(
      'explicit-pose-data-identical',
      before.heights === after.heights &&
        before.cursor === after.cursor &&
        before.commands === after.commands,
      { before, after },
    );
    await native.capture(page, 'explicit-pose-fresh.png');
  } else if (recoveryOnly) {
    await exerciseRecovery(conflictProbe);
    const saved = recoveryState();
    await native.close();
    await openCampaign();
    const reopened = recoveryState();
    check(
      'recovery-fresh-canonical-bytes-and-history',
      JSON.stringify(saved) === JSON.stringify(reopened),
      { saved, reopened },
    );
    await native.capture(page, '06-recovery-fresh.png');
  } else if (multiscaleProbe) {
    await exerciseMultiscaleTools();
  } else if (formsProbe) {
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
  for (const name of recoveryOnly
    ? [
        'unknown-keeps-original-and-automatically-reads-without-dialog',
        'unknown-resolution-never-duplicates-original',
        'closed-dependent-resumed-once-without-new-input',
        'recovery-fresh-canonical-bytes-and-history',
      ]
    : basicToolsProbe || formsProbe || multiscaleProbe
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
  if (evidence.status === 'PASS') {
    try {
      await native.finish(report);
    } catch (error) {
      await native.fail(error);
      throw error;
    }
  } else {
    const firstFailure = evidence.failures[0];
    await native.fail(
      new Error(
        'Native scenario assertions failed: ' +
          JSON.stringify(firstFailure ?? evidence.unexpectedError ?? evidence.checks),
      ),
    );
    const completion = JSON.parse(await readFile(reportPath, 'utf8'));
    await writeFile(reportPath, JSON.stringify({ ...report, ...completion }, null, 2) + '\n');
  }
  console.log(JSON.stringify({ output, reportPath, status: evidence.status }));
  if (evidence.status !== 'PASS') process.exitCode = 1;
}
