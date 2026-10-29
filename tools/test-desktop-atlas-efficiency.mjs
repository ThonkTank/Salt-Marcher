import { runEfficiencyTranche } from './atlas-efficiency-tranche.mjs';
// Bounded continuation probe: requires the frozen Point2/3 databases and Point4
// camera/protocol in .build; never generates an easier replacement fixture.
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { observeStrokeDiagnostic } from './atlas-stroke-diagnostic.mjs';
import { bounded } from './native-process.mjs';
import { runNativeProbe } from './native-session.mjs';
import { observeRiverSurface } from './atlas-river-probe.mjs';
import {
  snapshotWorld,
  worldRecords,
  worldHash,
  cleanWorldRecords,
  worldApi,
} from './atlas-world-continuity-fixture.mjs';
import { observeAtlasEfficiency, timingQuantiles } from './atlas-efficiency-probe.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
const root = process.cwd(),
  scale = process.argv.includes('--scale=2') ? 2 : 1,
  out = path.resolve(process.env.QA_EVIDENCE_DIR),
  api = await worldApi();
const repair = process.env.QA_PERF_MODE === 'repair';
const tranche = process.env.QA_EFFICIENCY_TRANCHE === '1';
const visibilityContract = process.env.QA_VISIBILITY_CONTRACT === '1';
const screenEarly = process.env.QA_SCREEN_EARLY === '1';
const screenProbe = screenEarly || process.env.QA_SCREEN_STROKE === '1';
const screenOutside = process.env.QA_SCREEN_OUTSIDE === '1';
const screenControls = process.env.QA_SCREEN_CONTROLS === '1';
const measure = tranche || !repair || process.env.QA_PERF_REPAIR_OBSERVER === 'original';
const localPose = screenControls
  ? JSON.parse(
      await readFile('.build/cycle3-point4/screen-final-native-100/stroke-failure.json', 'utf8'),
    ).pose
  : repair
    ? JSON.parse(
        await readFile('.build/cycle3-point4/baseline-world-100-v3/observations.json', 'utf8'),
      ).failureState.pose
    : JSON.parse(await readFile('.build/cycle3-point4/local-pose.json', 'utf8'));
const atomicJson = async (file, data) => {
  await writeFile(file + '.tmp', JSON.stringify(data, null, 2) + '\n');
  await rename(file + '.tmp', file);
};
const manifest = JSON.parse(await readFile('.build/cycle3-point3/frozen/manifest.json', 'utf8'));
const mode = process.env.QA_PERF_MODE ?? 'world',
  count = Number(process.env.QA_PERF_SAMPLES ?? 30);
const result = {
  startedUtc: new Date().toISOString(),
  scale,
  mode,
  count,
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  measurement:
    'Renderer DOM event.timeStamp -> onAfterRender (performance.now with same timeOrigin); capture handler time recorded separately;  of changed terrain grid / changed camera, loaded Deck layers; 32x32 RGB readback supplemental. No compositor scanout. Canonical receipt adoption is later than actual SQLite commit; no cross-clock subtraction.',
  cold: [],
  groups: [],
  retention: [],
};
await mkdir(out, { recursive: true });
const save = () =>
  writeFile(path.join(out, 'observations.json'), JSON.stringify(result, null, 2) + '\n');
await runNativeProbe({ root, output: out, name: 'atlas-efficiency' }, async (native) => {
  const filename = path.join(native.profile, 'workbench.sqlite');
  await snapshotWorld(
    screenControls
      ? '.build/cycle3-point4/screen-final-native-100/screen-edge-before.sqlite'
      : repair
        ? '.build/cycle3-point4/baseline-world-100-v3/failed-world.sqlite'
        : mode === 'dense'
          ? '.build/cycle3-point2/dense-world.sqlite'
          : '.build/cycle3-point3/frozen/original-world.sqlite',
    filename,
  );
  const require = createRequire(import.meta.url),
    db = new (require('better-sqlite3'))(filename, { readonly: true });
  const campaignId =
    mode === 'dense'
      ? db.prepare('SELECT campaign_id FROM campaign_atlas').get().campaign_id
      : manifest.campaignId;
  const campaignName = db.prepare('SELECT name FROM campaign WHERE id=?').get(campaignId).name;
  db.close();
  const query = () => worldRecords(filename, campaignId);
  result.initial = {
    revision: query().revision,
    cursor: query().cursor,
    canonicalSha256: worldHash(cleanWorldRecords(query().records)),
  };
  let page, readiness, rendererFailure;
  async function state() {
    return page.evaluate(() => {
      const r = window.__qaRiverRaster,
        d = r.input.dataset;
      return {
        at: performance.now(),
        ready: d.terrainReady,
        quality: d.terrainQuality,
        displayRevision: Number(d.terrainRevision),
        revision: r.revision,
        usable: r.surface?.frameUsable,
        navigating: r.navigating,
        stats: r.stream.statistics,
        tiles: r.tiles.length,
        loaded: [...r.stream.visible.keys(), ...r.stream.staged.keys(), ...r.stream.cache.keys()],
        pose: r.cameraPose(),
        editing: d.terrainEditingState,
      };
    });
  }
  async function ready(label, kind = 'navigation') {
    const start = Date.now(),
      limit = kind === 'edit' ? 120000 : 300000;
    let changed = Date.now(),
      last = '',
      s;
    while (true) {
      assert(!rendererFailure, rendererFailure);
      s = await state();
      const next = s.loaded.join('|');
      if (next !== last) {
        changed = Date.now();
        last = next;
      }
      if (
        s.ready === 'ready' &&
        s.quality === 'detail' &&
        s.displayRevision === s.revision &&
        s.usable &&
        !s.navigating
      )
        break;
      assert(Date.now() - start < limit, label + ' operation budget');
      assert(Date.now() - changed < 60000, label + ' no required product progress60s');
      await page.waitForTimeout(100);
    }
    readiness = s;
    console.log('performance ready', label, Date.now() - start, s.stats);
    return { label, ms: Date.now() - start, state: s };
  }
  async function launch(pose) {
    const start = Date.now();
    const snapshot =
      process.env.QA_PERF_RUNTIME_SNAPSHOT && path.resolve(process.env.QA_PERF_RUNTIME_SNAPSHOT);
    page = await native.launch(
      scale,
      snapshot
        ? {
            args: [
              path.join(snapshot, 'main.cjs'),
              ...(process.env.QA_OZONE_PLATFORM
                ? ['--ozone-platform=' + process.env.QA_OZONE_PLATFORM]
                : []),
              '--data-dir',
              native.profile,
            ],
            runtime: { kind: 'snapshot', directory: snapshot },
          }
        : {},
    );
    if (tranche && process.env.SALTMARCHER_TERRAIN_TRACE === '1') {
      await native.app.evaluate(() => {
        const { Worker } = process.getBuiltinModule('node:worker_threads');
        const emit = Worker.prototype.emit;
        globalThis.__efficiencyWorkerTraces = [];
        globalThis.__efficiencyWorkerTraceActive = false;
        Worker.prototype.emit = function (event, ...args) {
          if (
            event === 'message' &&
            args[0]?.terrainTrace &&
            globalThis.__efficiencyWorkerTraceActive
          )
            globalThis.__efficiencyWorkerTraces.push({
              threadId: this.threadId,
              trace: args[0].terrainTrace,
            });
          return emit.call(this, event, ...args);
        };
      });
    }

    page.on('pageerror', (error) => {
      rendererFailure = error.stack ?? String(error);
    });
    console.log('performance cold launch', mode, scale);
    if (process.env.QA_PERF_FAIL_AFTER_START === '1')
      throw Error('Intentional helper finalizer probe');
    await native.app.evaluate(
      ({ BrowserWindow }, scale) =>
        BrowserWindow.getAllWindows()[0].setContentSize(1920 * scale, 1080 * scale),
      scale,
    );
    await observeRiverSurface(page, root, snapshot);
    await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
    if (pose)
      await page.evaluate(
        ({ id, pose }) =>
          localStorage.setItem('atlas-camera:' + id, JSON.stringify({ ...pose.frame, pose })),
        { id: campaignId, pose },
      );
    await page
      .locator('.campaign-card')
      .filter({ hasText: campaignName })
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
    await page.waitForFunction(() => !!window.__qaRiverRaster);
    await native.app.evaluate(({ ipcMain }) => {
      globalThis.__efficiencyActions = [];
      const original = ipcMain._invokeHandlers.get('atlas:commit');
      ipcMain.removeHandler('atlas:commit');
      ipcMain.handle('atlas:commit', async (...args) => {
        globalThis.__efficiencyActions.push(structuredClone(args[1]));
        return original(...args);
      });
    });
    result.cold.push({
      appstartToSourceObservedMs: Date.now() - start,
      ...(await ready('cold ' + result.cold.length)),
    });
    await page.locator('#atlas-section').selectOption('terrain');
    await page.locator('#atlas-units').selectOption('metric');
    if (measure)
      await observeAtlasEfficiency(page, {
        trace: process.env.QA_PERF_TRACE !== '0',
        readback: process.env.QA_PERF_READBACK !== '0',
      });
    if (visibilityContract)
      await page.evaluate(() => {
        globalThis.__qaVisibilityContract = true;
      });
    if (repair && !tranche)
      await observeStrokeDiagnostic(page, (data) =>
        atomicJson(path.join(out, 'stroke-failure.json'), data),
      );
    result.runtime = await page.evaluate(() => {
      const gl = window.__qaRiverRaster.surface.canvas.getContext('webgl2'),
        i = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        dpr: devicePixelRatio,
        width: innerWidth,
        height: innerHeight,
        drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        canvas: [
          window.__qaRiverRaster.surface.canvas.width,
          window.__qaRiverRaster.surface.canvas.height,
        ],
        renderer: gl.getParameter(i.UNMASKED_RENDERER_WEBGL),
      };
    });
    await save();
  }
  async function project(point) {
    point = { ...point, heightM: new api.TerrainSampler(query().records).sample(point).heightM };
    return page.evaluate((p) => {
      const r = window.__qaRiverRaster,
        a = r.surface.frame.project(p),
        b = r.input.getBoundingClientRect();
      const x = b.x + a.x,
        y = b.y + a.y,
        picked = r.authorPoint(x, y);
      return {
        x,
        y,
        visible: a.visible,
        target: p,
        picked,
        worldErrorM: picked ? Math.hypot(picked.x - p.x, picked.y - p.y) : null,
      };
    }, point);
  }
  async function navigate(label, n = count) {
    await page.locator('#atlas-select').click();
    const group = { label, kind: 'navigation', samples: [] };
    result.groups.push(group);
    for (let i = 0; i < n; i++) {
      const b = await page.locator('#campaign-map').boundingBox(),
        p = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
      await page.mouse.move(p.x, p.y);
      await page.evaluate(() => window.__atlasEfficiency.begin('navigation'));
      if (i % 2 === 0) {
        await page.mouse.down({ button: 'middle' });
        await page.mouse.move(p.x + (i % 4 === 0 ? 8 : -8), p.y);
        await page.mouse.up({ button: 'middle' });
      } else await page.mouse.wheel(0, i % 4 === 1 ? 1 : -1);
      await page.waitForTimeout(240);
      await ready(label + ' ' + i);
      const v = await page.evaluate(() => window.__atlasEfficiency.end());
      group.samples.push(v);
      await save();
    }
    group.firstFrame = timingQuantiles(group.samples.map((s) => s.firstNavigationFrameMs));
    await save();
  }
  async function terrain(label, point, radius, strength, n = count, scatter = false) {
    if (scatter) {
      await page.locator('[data-tool-group="water"]').click();
      await page
        .locator('[data-tool-select="land-tool"][data-tool-value="freshwater"]')
        .first()
        .click();
      await page.locator('#land-freshwater-operation').selectOption('scatter');
      await page.locator('#land-lake-noise').fill('1');
    } else {
      await page.locator('[data-tool-group="land"]').click();
      await page.locator('[data-atlas-tool="land-shape"]').click();
      await setHeightDirection(page, 'raise');
    }
    await setBrushWorldRadius(page, 'land-radius', radius);
    for (const [id, value] of [
      ['land-height-strength', strength],
      ['land-height-feather', 0.7],
    ]) {
      await page.locator('#' + id).fill(String(value));
      await page.locator('#' + id).press('Tab');
    }
    await page.locator('#land-height-target-enabled').uncheck();
    const group = { label, kind: 'terrain', point, radius, strength, samples: [] };
    result.groups.push(group);
    for (let i = 0; i < n; i++) {
      let p = await project(point),
        end = await project({ ...point, x: point.x + radius * 0.4 }),
        paintPoint = point;
      if (screenProbe) {
        const event = JSON.parse(
          await readFile('.build/cycle3-point4/screen-kernel-product-proof.json', 'utf8'),
        ).results[0].events;
        const screens = await page.evaluate(
          ([start, end]) => {
            const r = window.__qaRiverRaster,
              b = r.input.getBoundingClientRect();
            return [start, end].map((p) => {
              const x = b.x + p.u * b.width,
                y = b.y + p.v * b.height,
                picked = r.authorPoint(x, y);
              return { x, y, picked, visible: !!picked, target: picked, worldErrorM: 0 };
            });
          },
          [event[0], event.at(-1)],
        );
        [p, end] = screens;
        paintPoint = p.picked;
      }
      assert(p.visible && end.visible, 'Native authored point visible');
      await page.mouse.move(p.x, p.y);
      await page.waitForFunction(
        () => document.querySelector('#campaign-map').dataset.terrainEditingState === 'ready',
        null,
        { timeout: 120000 },
      );
      const before = query(),
        beforeFile = path.join(out, `visibility-before-${result.groups.length}-${i}.sqlite`),
        pickStart = visibilityContract
          ? await page.evaluate(() => window.__strokeDiagnostic.picks.length)
          : 0,
        h = new api.TerrainSampler(before.records).sample(paintPoint).heightM;
      if (visibilityContract) await snapshotWorld(filename, beforeFile);
      if (measure) await page.evaluate(() => window.__atlasEfficiency.begin('terrain'));
      const inputBox = screenProbe ? await page.locator('#campaign-map').boundingBox() : null;
      const hostCommands = [];
      const input = async (name, f) => {
        const start = Date.now();
        try {
          return await f();
        } finally {
          hostCommands.push({ name, start, end: Date.now() });
          await atomicJson(path.join(out, 'host-input.json'), hostCommands);
        }
      };
      await input('down', () => page.mouse.down());
      await input('move', () => page.mouse.move(end.x, end.y, { steps: 2 }));
      if (screenProbe && screenOutside && i === 1) {
        await input('outside-screen', () => page.mouse.move(inputBox.x - 20, end.y, { steps: 2 }));
        await input('outside-hold', () => page.waitForTimeout(300));
        await input('return-screen', () => page.mouse.move(end.x, end.y, { steps: 2 }));
      }
      await input('hold', () =>
        page.waitForTimeout(scatter ? 2000 : !repair && i === n - 1 ? 1200 : 150),
      );
      await input('up', () => page.mouse.up());
      if (repair)
        await atomicJson(
          path.join(out, 'stroke-diagnostic.json'),
          await page.evaluate(() => window.__strokeDiagnostic.snapshot()),
        );
      const commitStart = Date.now();
      while (query().cursor === before.cursor) {
        assert(!rendererFailure, rendererFailure);
        assert(Date.now() - commitStart < 60000, 'No canonical commit progress60s');
        await page.waitForTimeout(50);
      }
      const wait = await ready(label + ' ' + i, 'edit');
      await page.waitForTimeout(50);
      const v = measure
          ? await page.evaluate(() => window.__atlasEfficiency.end())
          : {
              traces: [],
              hostCommands,
              diagnostic: await page.evaluate(() => window.__strokeDiagnostic.snapshot()),
            },
        after = query(),
        height = new api.TerrainSampler(after.records).sample(paintPoint).heightM;
      Object.assign(v, {
        plannedScreen: { start: p, end },
        beforeHeight: h,
        afterHeight: height,
        beforeCanonicalSha256: worldHash(cleanWorldRecords(before.records)),
        afterCanonicalSha256: worldHash(cleanWorldRecords(after.records)),
        beforeCursor: before.cursor,
        afterCursor: after.cursor,
        fullFrameWait: wait.ms,
        nextEditableObservedAt: null,
      });
      // Retain the attempted sample before assertions: missing/incorrect
      // effects belong to the raw series, including a failing final sample.
      group.samples.push(v);
      await save();
      if (visibilityContract) {
        const diagnostic = v.diagnostic;
        assert(
          diagnostic?.stroke?.visibility?.surface,
          'native stroke binds its displayed surface layout',
        );
        const sourceDb = new (require('better-sqlite3'))(beforeFile, { readonly: true });
        let grid;
        try {
          grid = api.readTerrainGrid(sourceDb, campaignId, diagnostic.stroke.visibility);
        } finally {
          sourceDb.close();
        }
        const visible = api.terrainVisibility(grid),
          prepared = api.prepareHeightBrush(diagnostic.stroke, grid),
          dose = prepared.dose,
          old = new api.TerrainSampler(before.records),
          current = new api.TerrainSampler(after.records);
        const points = [
          ...new Map(
            diagnostic.picks
              .slice(pickStart)
              .filter((p) => p.source === 'terrain' && p.point)
              .map((p) => [JSON.stringify(p.point), p.point]),
          ).values(),
        ].filter((p) => dose(p) > 0);
        assert(points.length > 0, 'actual visible picks with positive dose captured');
        v.visibilityChecks = {
          screenInputVersion: diagnostic.stroke.screenInput?.version,
          centrelines: prepared.centrelines.length,
          authorTiles: prepared.tiles.length,
          tilePairs: prepared.tilePairs,
          dabs: prepared.dabs.length,
          paintSeconds: prepared.dabs.reduce((sum, d) => sum + d.seconds, 0),
          gestureSeconds: diagnostic.stroke.samples.at(-1).t / 1000,
          points: points.map((p) => ({
            ...p,
            dose: dose(p),
            visible: visible(p),
            before: old.sample(p).heightM,
            after: current.sample(p).heightM,
          })),
          previewSamples: diagnostic.previewSamples,
          strokeSamples: diagnostic.stroke.samples.length,
        };
        await save();
        assert.equal(
          diagnostic.stroke.screenInput?.version,
          1,
          'New native gestures always bind screen input',
        );
        if (screenProbe) {
          v.visibilityChecks.firstHitJumps = prepared.sections
            .slice(1)
            .flatMap((section, index) => {
              const a = prepared.sections[index].point(1),
                b = section.point(0),
                distanceM = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
              return distanceM > diagnostic.stroke.radius
                ? [{ atMs: section.startMs, distanceM, from: a, to: b }]
                : [];
            });
          if (i === 0 && label === 'repair-next-local75-height')
            assert(
              v.visibilityChecks.firstHitJumps.length > 0,
              'First native critical line crosses an actual silhouette',
            );
          if (screenOutside && i === 1)
            assert(
              v.visibilityChecks.paintSeconds < v.visibilityChecks.gestureSeconds - 0.2,
              'Outside hold time is not redistributed',
            );
          const cert = JSON.parse(
            await readFile('.build/cycle3-point4/stroke-screen-support-certificate.json', 'utf8'),
          );
          v.visibilityChecks.excluded = cert.gestures.map((g) => ({
            point: g.chosen.point,
            dose: dose(g.chosen.point),
            before: old.sample(g.chosen.point).heightM,
            after: current.sample(g.chosen.point).heightM,
          }));
          for (const excluded of v.visibilityChecks.excluded) {
            assert.equal(excluded.dose, 0, 'Certified excluded node gets no direct screen dose');
            assert.equal(
              excluded.after,
              excluded.before,
              'Certified excluded node remains unchanged',
            );
          }
        }
        for (const p of v.visibilityChecks.points) {
          assert(p.visible, 'actual terrain pick agrees with canonical surface');
          assert(p.after > p.before, 'actual visible pick with positive dose receives height');
        }
        assert.equal(
          diagnostic.previewSamples,
          diagnostic.stroke.samples.length,
          'last native preview includes the complete closed stroke',
        );
        assert(diagnostic.previewAuthorHeights?.length > 0, 'native preview author bytes captured');
        const canonicalHeights = new Map(
          after.records.filter((r) => r.height).map((r) => [r.id, r.height]),
        );
        for (const r of diagnostic.previewAuthorHeights)
          assert.deepEqual(
            r.height,
            canonicalHeights.get(r.id),
            'native preview matches canonical author bytes ' + r.id,
          );
        v.visibilityChecks.previewWriterEqual = true;
        if (label.includes('local75')) {
          const pixel = api.heightBrushResolution(radius);
          let hidden;
          for (const p of points) {
            for (const dx of [-0.3, 0, 0.3])
              for (const dy of [-0.3, -0.1, 0.1, 0.3]) {
                const q = {
                  x: Math.round((p.x + radius * dx) / pixel) * pixel,
                  y: Math.round((p.y + radius * dy) / pixel) * pixel,
                };
                if (dose(q) > 0 && !visible(q)) {
                  hidden = {
                    ...q,
                    dose: dose(q),
                    before: old.sample(q).heightM,
                    after: current.sample(q).heightM,
                  };
                  break;
                }
              }
            if (hidden) break;
          }
          v.visibilityChecks.hidden = hidden;
          await save();
          assert(hidden, 'positively dosed author node behind the same silhouette exists');
          assert.equal(
            hidden.after,
            hidden.before,
            'native positively dosed occluded author node is protected',
          );
        }
        await save();
        await native.capture(page, 'visibility-' + label + '-' + i);
      }
      assert.equal(after.cursor, before.cursor + 1, 'One canonical step per input');
      assert(
        scatter ? after.records.length > before.records.length : height > h,
        scatter ? 'Scatter authors real basins' : 'Terrain raised by normal input',
      );
      await page.mouse.move(p.x, p.y);
      await page.waitForFunction(
        () => document.querySelector('#campaign-map').dataset.terrainEditingState === 'ready',
        null,
        { timeout: 120000 },
      );
      v.nextEditableObservedAt = await page.evaluate(() => performance.now());
      await save();
      console.log(
        label,
        i,
        'first',
        v.firstTerrainFrameMs,
        'full',
        v.pointerupToFullFrameMs,
        'trace',
        v.traces.filter((t) => t.stage === 'draft.height').map((t) => t.duration),
      );
    }
    group.firstFrame = timingQuantiles(group.samples.map((s) => s.firstTerrainFrameMs));
    group.fullFrame = timingQuantiles(group.samples.map((s) => s.pointerupToFullFrameMs));
    await save();
  }
  async function screenEdgeStroke() {
    const box = await page.locator('#campaign-map').boundingBox(),
      edge = { x: box.x + 8, y: box.y + box.height / 2 };
    await page.mouse.move(edge.x, edge.y);
    await page.waitForFunction(
      () => document.querySelector('#campaign-map').dataset.terrainEditingState === 'ready',
      null,
      { timeout: 120000 },
    );
    const before = query(),
      beforeFile = path.join(out, 'screen-edge-before.sqlite');
    await snapshotWorld(filename, beforeFile);
    const picked = await page.evaluate((p) => window.__qaRiverRaster.authorPoint(p.x, p.y), edge);
    assert(picked, 'short edge gesture begins on visible terrain');
    await page.mouse.down();
    await page.mouse.move(box.x - 8, edge.y);
    await new Promise((resolve) => setTimeout(resolve, 350));
    // A real second outside observation fixes the whole intervening hold as
    // outside. Subsequent movement cannot rewrite it into an inferred return.
    await page.mouse.move(box.x - 9, edge.y);
    await page.mouse.move(edge.x, edge.y);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await page.mouse.up();
    const began = Date.now();
    while (query().cursor === before.cursor) {
      assert(!rendererFailure, rendererFailure);
      assert(Date.now() - began < 60000, 'edge gesture no canonical progress60s');
      await page.waitForTimeout(50);
    }
    await ready('short outside-screen hold', 'edit');
    const diagnostic = await page.evaluate(() => window.__strokeDiagnostic.snapshot()),
      stroke = diagnostic.stroke,
      down = diagnostic.inputs.filter((p) => p.type === 'pointerdown').at(-1),
      inputs = diagnostic.inputs.filter((p) => p.eventTimestamp >= down.eventTimestamp),
      outside = inputs.filter((p) => p.type === 'pointermove' && p.x < box.x);
    assert.equal(stroke.screenInput.version, 1);
    assert(outside.length >= 2);
    const outsideMs = outside.at(-1).eventTimestamp - outside[0].eventTimestamp;
    assert(outsideMs >= 300, 'actual authoritative outside hold captured');
    const sourceDb = new (require('better-sqlite3'))(beforeFile, { readonly: true });
    let grid;
    try {
      grid = api.readTerrainGrid(sourceDb, campaignId, stroke.visibility);
    } finally {
      sourceDb.close();
    }
    const plan = api.prepareHeightBrush(stroke, grid),
      paintSeconds = plan.dabs.reduce((sum, d) => sum + d.seconds, 0),
      totalMs = stroke.screenInput.events.at(-1).t;
    assert(paintSeconds > 0);
    assert(
      paintSeconds <= totalMs / 1000 - outsideMs / 1000 + 1e-9,
      'outside time cannot be redistributed onto visible endpoints',
    );
    const after = query();
    assert.equal(after.cursor, before.cursor + 1);
    assert.equal(diagnostic.previewSamples, stroke.samples.length, 'closed edge preview');
    const heights = new Map(after.records.filter((r) => r.height).map((r) => [r.id, r.height]));
    for (const r of diagnostic.previewAuthorHeights ?? [])
      assert.deepEqual(r.height, heights.get(r.id));
    const oldHeight = new api.TerrainSampler(before.records).sample(picked).heightM,
      newHeight = new api.TerrainSampler(after.records).sample(picked).heightM;
    assert(newHeight > oldHeight, 'visible portion still changes terrain');
    result.screenEdge = {
      inputs,
      events: stroke.screenInput.events,
      totalMs,
      outsideMs,
      paintSeconds,
      oldHeight,
      newHeight,
      oneCommit: true,
      previewWriterEqual: true,
    };
    await native.capture(page, 'short-outside-screen-hold');
    await save();
  }
  async function screenCameraControls() {
    if (visibilityContract)
      for (const tilt of [0, 45]) {
        await page.locator('#atlas-view').click();
        await page.locator('#terrain-tilt').evaluate((n, v) => {
          n.value = String(v);
          n.dispatchEvent(new Event('input', { bubbles: true }));
        }, tilt);
        await page.keyboard.press('Escape');
        await ready('visibility control ' + tilt);
        assert.equal((await state()).pose.tilt, tilt, 'Native control reaches its actual tilt');
        await terrain('visibility-control-' + tilt, manifest.near, 0.7, 0.3, 1);
        await native.capture(page, 'visibility-control-' + tilt);
        if (screenProbe && tilt === 0) await screenEdgeStroke();
      }
  }
  try {
    await launch(
      mode === 'dense'
        ? {
            frame: { x: -350, y: -300, width: 900, height: 600 },
            focusM: 14,
            tilt: 0,
            rotation: 0,
            exaggeration: 1,
            projection: 'perspective',
          }
        : localPose,
    );
    if (tranche) {
      await runEfficiencyTranche({
        page,
        native,
        result,
        query,
        ready,
        save,
        out,
        navigate,
        hash: worldHash,
        clean: cleanWorldRecords,
      });
      if (process.env.QA_PERF_FUNCTION_GUARD === '1') {
        const cancelBefore = query();
        await page.locator('[data-tool-group="land"]').click();
        await page
          .locator('[data-tool-select="land-tool"][data-tool-value="height"]')
          .first()
          .click();
        const box = await page.locator('#campaign-map').boundingBox();
        await page.mouse.move(
          box.x + box.width * 0.5041978125474027,
          box.y + box.height * 0.20100896672774798,
        );
        await page.waitForFunction(
          () => document.querySelector('#campaign-map').dataset.terrainEditingState === 'ready',
          null,
          { timeout: 120000 },
        );
        await page.mouse.down();
        await page.waitForTimeout(150);
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await ready('efficiency canceled owner', 'edit');
        assert.equal(query().cursor, cancelBefore.cursor, 'canceled gesture writes no history');
        assert.equal(
          worldHash(cleanWorldRecords(query().records)),
          worldHash(cleanWorldRecords(cancelBefore.records)),
        );
        assert.equal(
          await page.evaluate(() => !!window.__qaRiverRaster.screenGeometry),
          false,
          'cancel releases geometry',
        );
        await terrain('efficiency-function-follow', manifest.near, 0.7, 0.3, 3);
        const last = result.groups.at(-1).samples.at(-1);
        for (const [kind, cursor, hash] of [
          ['undo', last.beforeCursor, last.beforeCanonicalSha256],
          ['redo', last.afterCursor, last.afterCanonicalSha256],
        ]) {
          await page.locator('#atlas-' + kind).click();
          const began = Date.now();
          while (query().cursor !== cursor) {
            assert(Date.now() - began < 60000, kind + ' function guard progress60s');
            await page.waitForTimeout(50);
          }
          await ready('efficiency ' + kind, 'edit');
          assert.equal(worldHash(cleanWorldRecords(query().records)), hash, 'exact history data');
        }
        const beforeFresh = worldHash(cleanWorldRecords(query().records));
        await native.close();
        await launch();
        assert.equal(
          worldHash(cleanWorldRecords(query().records)),
          beforeFresh,
          'Fresh exact author data',
        );
        assert.equal(await page.evaluate(() => !!window.__qaRiverRaster.screenGeometry), false);
        await terrain('efficiency-fresh-follow', manifest.near, 0.7, 0.3, 1);
        result.functionGuard = {
          cancelReleased: true,
          followingGestures: 3,
          undoRedoExact: true,
          freshExact: true,
          freshFollow: true,
        };
        await save();
      }
    } else if (screenControls) {
      await screenCameraControls();
      result.repairChecks = { controlsOnlyFromSavedRevision: result.initial.revision };
    } else if (repair) {
      const n = Number(process.env.QA_REPAIR_GESTURES ?? 3);
      await terrain('repair-next-local75-height', manifest.near, 0.7, 0.3, n);
      const last = result.groups.at(-1).samples.at(-1);
      await native.capture(page, 'repair-three-following');
      if (!screenEarly) {
        for (const [kind, cursor, hash] of [
          ['undo', last.beforeCursor, last.beforeCanonicalSha256],
          ['redo', last.afterCursor, last.afterCanonicalSha256],
        ]) {
          await page.locator('#atlas-' + kind).click();
          const began = Date.now();
          while (query().cursor !== cursor) {
            assert(!rendererFailure, rendererFailure);
            assert(Date.now() - began < 60000, kind + ' history progress60s');
            await page.waitForTimeout(100);
          }
          await ready(kind, 'edit');
          assert.equal(
            worldHash(cleanWorldRecords(query().records)),
            hash,
            'Exact canonical ' + kind,
          );
          await native.capture(page, 'repair-' + kind);
        }
        const saved = query(),
          hash = worldHash(cleanWorldRecords(saved.records));
        await native.close();
        await launch();
        assert.equal(query().cursor, saved.cursor, 'Fresh history');
        assert.equal(worldHash(cleanWorldRecords(query().records)), hash, 'Fresh canonical bytes');
        await native.capture(page, 'repair-fresh');
        await terrain('repair-fresh-follow', manifest.near, 0.7, 0.3, 1);
        if (screenProbe) {
          await page.locator('#atlas-select').click();
          const b = await page.locator('#campaign-map').boundingBox(),
            x = b.x + b.width / 2,
            y = b.y + b.height / 2;
          await page.mouse.move(x, y);
          await page.mouse.down({ button: 'middle' });
          await page.mouse.move(x + 600, y, { steps: 4 });
          await page.mouse.up({ button: 'middle' });
          await ready('clearance pan before camera controls');
        }
        await screenCameraControls();
      }
      result.repairChecks = {
        followingGestures: n,
        undo: !screenEarly,
        redo: !screenEarly,
        fresh: !screenEarly,
        freshFollow: !screenEarly,
      };
    } else if (mode === 'world') {
      await navigate('local75-loaded');
      await terrain('local75-height', manifest.near, 0.7, 0.3);
      // Normal continuous wheel input changes the view for the continental case.
      await page.locator('#atlas-select').click();
      for (let i = 0; i < 20; i++) {
        const s = await state();
        if (s.pose.frame.width >= 1000000) break;
        const b = await page.locator('#campaign-map').boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.mouse.wheel(
          0,
          Math.min(300, Math.log(1000000 / s.pose.frame.width) / 0.002) * scale,
        );
        await page.waitForTimeout(240);
        await ready('continent navigation ' + i);
      }
      const s = await state(),
        b = await page.locator('#campaign-map').boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - s.pose.tilt / 0.25, {
        steps: 8,
      });
      await page.mouse.up({ button: 'right' });
      await ready('continent0');
      await navigate('continent0-loaded');
      const p = (await state()).pose.frame;
      await terrain(
        'continent0-height',
        { x: p.x + p.width / 2, y: p.y + p.height / 2 },
        25000,
        300,
      );
    } else
      for (let i = 0; i < 5; i++) {
        await terrain('dense-scatter-' + i, { x: 32, y: 18 }, 128, 2, 1, true);
        await terrain('dense-follow-height-' + i, { x: 32, y: 18 }, 128, 2, 1);
      }
    await snapshotWorld(filename, path.join(out, 'changed-world.sqlite'));
    result.actions = await native.app.evaluate(() => globalThis.__efficiencyActions);
    result.appMetrics = await native.app.evaluate(({ app }) => app.getAppMetrics());
    await native.close();
    result.completedUtc = new Date().toISOString();
    await save();
    return result;
  } catch (error) {
    result.failure = error.stack;
    result.rendererFailure = rendererFailure;
    try {
      result.failureState = await bounded(state(), 3000, 'failure state timeout').catch(() => null);
      result.failureObservation = await bounded(
        page?.evaluate(
          () =>
            window.__strokeDiagnostic?.snapshot() ??
            (window.__atlasEfficiency?.active ? window.__atlasEfficiency.end() : null),
        ),
        3000,
        'failure export timeout',
      ).catch(() => null);
      result.actions = await bounded(
        native.app?.evaluate(() => globalThis.__efficiencyActions),
        3000,
        'action export timeout',
      ).catch(() => null);
      await bounded(
        snapshotWorld(filename, path.join(out, 'failed-world.sqlite')),
        5000,
        'failure backup timeout',
      ).catch(() => {});
      await bounded(
        process.env.QA_PERF_FAIL_EXPORT === '1'
          ? Promise.reject(Error('Intentional failure export probe'))
          : save(),
        3000,
        'failure save timeout',
      ).catch((error) => {
        result.failureExportError = error.stack;
      });
    } finally {
      // End existing input ownership without resending or committing the failed gesture.
      await bounded(page?.keyboard.press('Escape'), 3000, 'failure cancel timeout').catch(() => {});
      await native.close().catch((e) => {
        result.normalCloseFailure = e.stack;
      });
      await bounded(save(), 3000, 'final failure save timeout').catch(() => {});
    }
    throw error;
  }
});
