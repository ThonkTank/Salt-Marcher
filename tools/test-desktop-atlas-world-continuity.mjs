// One populated canonical world; native pointer input owns every transition.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { runNativeProbe } from './native-session.mjs';
import { observeRiverSurface } from './atlas-river-probe.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
import {
  worldApi,
  worldRecords,
  cleanWorldRecords,
  worldHash,
  snapshotWorld,
} from './atlas-world-continuity-fixture.mjs';
const root = process.cwd(),
  scale = process.argv.includes('--scale=2') ? 2 : 1,
  reuseProbe = process.env.QA_REUSE_PROBE === '1',
  resume = process.env.QA_RESUME_100 === '1',
  previousOutput = path.resolve('.build/cycle3-point3/selective-reuse/native-full-100'),
  previous = resume
    ? JSON.parse(await readFile(path.join(previousOutput, 'observations.json'), 'utf8'))
    : null,
  tilts = (process.env.QA_TILTS ?? '0,45,75').split(',').map(Number),
  frozen = path.resolve(process.env.QA_WORLD_SOURCE ?? '.build/cycle3-point3/frozen'),
  output = path.resolve(
    process.env.QA_EVIDENCE_DIR ?? `.build/cycle3-point3/native-${scale * 100}-${Date.now()}`,
  ),
  manifest = JSON.parse(await readFile(path.join(frozen, 'manifest.json'), 'utf8')),
  api = await worldApi();
await mkdir(output, { recursive: true });
const sources = [
  'tools/atlas-world-continuity-fixture.mjs',
  'tools/test-desktop-atlas-world-continuity.mjs',
  'tools/atlas-river-probe.mjs',
  'src/app/atlas/atlas-camera.ts',
  'src/app/atlas/atlas-canvas.ts',
  'src/app/atlas/terrain-route.ts',
  'src/app/atlas/atlas-metric-camera.ts',
  'src/app/atlas/atlas-raster-presentation.ts',
  'src/app/atlas/atlas-raster-tile-stream.ts',
  'src/app/atlas/atlas-surface-tile-stream.ts',
  'src/app/atlas/terrain-change-history.ts',
  'src/app/atlas/terrain-source.ts',
  'src/app/storage/atlas-landscape-region.ts',
  'desktop/atlas-region-worker.ts',
  'desktop/atlas-region.ts',
  'desktop/atlas-host.ts',
  'desktop/preload.ts',
  'src/app/atlas/atlas-tile-plan.ts',
  'src/app/atlas/atlas-deck-vegetation.ts',
  'src/app/atlas/vegetation-lod.ts',
  'src/app/storage/atlas-material-tiles.ts',
  'src/app/atlas/terrain-field-stream.ts',
  'src/app/atlas/terrain-height-lattice.ts',
  'src/app/atlas/terrain-interpolation.ts',
  'src/app/atlas/atlas-raster-kernel.ts',
  'src/app/storage/terrain-material.ts',
  'src/app/storage/atlas-tile-cache.ts',
];
const result = {
  startedUtc: new Date().toISOString(),
  scale,
  tilts,
  fixtureSha256: manifest.canonicalSha256,
  sourceHashes: Object.fromEntries(
    await Promise.all(sources.map(async (f) => [f, worldHash(await readFile(f))])),
  ),
  limits: {
    checkpointTimeoutMs: 300000,
    editTimeoutMs: 120000,
    noProgressTimeoutMs: 60000,
    policy:
      'Navigation/Fresh300s, loaded Edit/Undo/Redo120s, required-product progress60s; functional only',
    gestureTimeoutMs: 30000,
    maximumWheelSteps: 40,
    anchorCssPx: 1.1,
    scope: 'functional continuity only; no p95, package, release or owner acceptance',
  },
  inputs: [],
  checkpoints: [],
  edits: [],
  biomes: [],
  checks: [],
  fresh: [],
  frameWaits: [],
};
const save = () =>
  writeFile(path.join(output, 'observations.json'), JSON.stringify(result, null, 2) + '\n');
await runNativeProbe({ root, output, name: 'atlas-world-continuity' }, async (native) => {
  const filename = path.join(native.profile, 'workbench.sqlite');
  await copyFile(
    resume
      ? path.join(previousOutput, 'failed-world.sqlite')
      : path.join(frozen, 'original-world.sqlite'),
    filename,
  );
  const copiedDatabaseSha256 = worldHash(await readFile(filename));
  assert.equal(
    copiedDatabaseSha256,
    worldHash(
      await readFile(
        resume
          ? path.join(previousOutput, 'failed-world.sqlite')
          : path.join(frozen, 'original-world.sqlite'),
      ),
    ),
    'Entry database is an exact byte copy including canonical source/history state',
  );
  const query = () => worldRecords(filename, manifest.campaignId),
    canonical = () => cleanWorldRecords(query().records);
  assert.equal(
    worldHash(canonical()),
    resume
      ? worldHash(
          cleanWorldRecords(
            worldRecords(path.join(previousOutput, 'failed-world.sqlite'), manifest.campaignId)
              .records,
          ),
        )
      : manifest.canonicalSha256,
    'Every scaling starts from the exact frozen canonical sources',
  );
  const waypoints = JSON.parse(await readFile(path.join(frozen, 'waypoints.json'), 'utf8'));
  assert.equal(waypoints.canonicalSha256, manifest.canonicalSha256);
  result.frozenWaypoints = waypoints;
  const resumeControl = resume
    ? previous.checkpoints.find((c) => c.label === 'tilt-45-in-100')
    : null;
  if (resume) {
    assert.equal(scale, 1);
    assert.equal(query().revision, 92);
    assert.equal(query().cursor, 86);
    result.continuation = {
      previousOutput,
      previousSource: '8f18faf7995700bdb2f4320c2555118babc16c0d',
      copiedDatabaseSha256,
      entry: resumeControl,
      canonicalSha256: worldHash(canonical()),
      exactPayloadsSha256: worldHash(query().records),
      revision: query().revision,
      cursor: query().cursor,
      originalEdits: previous.edits,
      note: 'Restored45degree100m entry; prefix is previous bound partial evidence, not an uninterrupted new journey',
    };
  }
  const reuseCamera = resume
    ? resumeControl.pose
    : reuseProbe
      ? JSON.parse(
          await readFile(
            path.resolve('.build/cycle3-point3/qualified-100-room-budget/observations.json'),
            'utf8',
          ),
        ).firstBreak.state.pose
      : undefined;
  result.selectiveReuseProbe = reuseProbe;
  await writeFile(
    path.join(output, 'frozen-waypoints.json'),
    JSON.stringify(waypoints, null, 2) + '\n',
  );
  let page,
    opened = false,
    currentTilt = resume ? 45 : reuseProbe ? 75 : 0,
    qualificationTargetWidthM = resume ? 100 : reuseProbe ? 10 : 40000000,
    operationStarted = null;
  const mark = (name, detail = {}) => {
    native.mark(name);
    result.checks.push({ name, ...detail });
    console.log(name);
  };
  const state = () =>
    page.evaluate(() => {
      const r = window.__qaRiverRaster,
        m = document.querySelector('#campaign-map');
      return {
        dataset: { ...m?.dataset },
        pose: r?.cameraPose(),
        navigating: r?.navigating,
        usable: r?.surface?.frameUsable,
        revision: r?.revision,
        fence: r?.fence,
        stream: r?.stream
          ? {
              generation: r.stream.generation,
              statistics: r.stream.statistics,
              visible: [...r.stream.visible.keys()],
              staged: [...r.stream.staged.keys()],
              cached: [...r.stream.cache.values()].map((e) => ({
                tile: e.tile.tile,
                bytes: e.bytes,
              })),
              identity: r.stream.identity,
            }
          : null,
        tiles: r?.tiles.map((t) => ({
          tile: t.tile,
          revision: t.revision,
          fence: t.fence,
          terrainRevision: t.terrain.revision,
          terrainFence: t.terrain.fence,
          materialRevision: t.material.revision,
          materialFence: t.material.fence,
          box: t.terrain.projection.grid.view.box,
        })),
        recentTileReads: window.__worldTileReads,
      };
    });
  const qualificationDeadlineMs = (kind = 'navigation') =>
    kind === 'edit' ? result.limits.editTimeoutMs : result.limits.checkpointTimeoutMs;
  async function ready(label, requireDetail = true, kind = 'navigation') {
    const started = operationStarted ?? Date.now(),
      deadlineMs = qualificationDeadlineMs(kind),
      revision = query().revision;
    const canonicalSource = await page.evaluate(async () => {
      const reply = await window.campaign.atlasTerrainSource(window.__qaRiverRaster.token);
      if (!reply.ok) throw Error(reply.error);
      return reply.value;
    });
    assert.equal(
      canonicalSource.revision,
      revision,
      'Independent canonical source revision matches SQLite',
    );
    result.lastCanonicalSource = canonicalSource;
    try {
      await atlasCanvasReady(page);
      const progress = {
        label,
        kind,
        startedUtc: new Date(started).toISOString(),
        deadlineMs,
        revision,
        fence: canonicalSource.fence,
        samples: [],
      };
      result.progress ??= [];
      result.progress.push(progress);
      let lastProgress = Date.now(),
        seen = new Set(),
        frame;
      while (true) {
        const sample = await page.evaluate(
          ({ revision, fence, requireDetail, coverageLevel }) => {
            const r = window.__qaRiverRaster,
              m = document.querySelector('#campaign-map');
            if (!r?.tiles.length) return false;
            const f = r.cameraPose().frame,
              span = Math.max(f.width, f.height) * coverageLevel,
              box = coverageLevel
                ? {
                    x: f.x + f.width / 2 - span / 2,
                    y: f.y + f.height / 2 - span / 2,
                    width: span,
                    height: span,
                  }
                : f,
              area = r.tiles.reduce((sum, t) => {
                const b = t.terrain.projection.grid.view.box;
                return (
                  sum +
                  Math.max(0, Math.min(b.x + b.width, box.x + box.width) - Math.max(b.x, box.x)) *
                    Math.max(0, Math.min(b.y + b.height, box.y + box.height) - Math.max(b.y, box.y))
                );
              }, 0),
              coverageRatio = area / (box.width * box.height);
            const usable =
              m?.dataset.terrainReady === 'ready' &&
              (!requireDetail || m.dataset.terrainQuality === 'detail') &&
              Number(m.dataset.terrainRevision) === revision &&
              r?.revision === revision &&
              r.fence === fence &&
              r.surface.frameUsable &&
              r.tiles.length > 0 &&
              !r.navigating &&
              Math.abs(coverageRatio - 1) < 1e-9 &&
              r.tiles.every(
                (t) =>
                  t.revision === revision &&
                  t.fence === r.fence &&
                  t.terrain.revision === revision &&
                  t.terrain.fence === r.fence &&
                  t.material.revision === revision &&
                  t.material.fence === r.fence,
              );
            const input = {
              box,
              mpp: r.surface.frame.camera.metersPerPixel,
              focus: f,
              tilted: !!r.tilt,
            };
            const loaded = [
              ...r.stream.visible.values(),
              ...r.stream.staged.values(),
              ...r.stream.cache.values(),
            ]
              .filter(
                (e) =>
                  e.tile.revision === revision &&
                  e.tile.fence === fence &&
                  e.tile.terrain.revision === revision &&
                  e.tile.material.revision === revision,
              )
              .map((e) => [e.tile.tile.lod, e.tile.tile.x, e.tile.tile.y].join('/'));
            return {
              input,
              loaded: [...new Set(loaded)],
              statistics: r.stream.statistics,
              reads: window.__worldTileReads ?? [],
              qualified: usable
                ? {
                    quality: m.dataset.terrainQuality,
                    revision,
                    fence,
                    coverageBox: box,
                    coverageRatio,
                    tileCount: r.tiles.length,
                    usable: true,
                  }
                : false,
            };
          },
          {
            ...canonicalSource,
            requireDetail,
            coverageLevel: currentTilt ? api.terrainCoverageLevel(currentTilt) : 0,
          },
        );
        const plan = api.atlasTilePlan(sample.input.box, sample.input.mpp, {
          maxTiles: sample.input.tilted ? 192 : 32,
          focus: sample.input.tilted ? sample.input.focus : undefined,
        });
        const key = (t) => [t.lod, t.x, t.y].join('/'),
          required = new Set([...plan.overview, ...plan.detail].map(key));
        const completed = sample.loaded.filter((k) => required.has(k));
        const added = completed.filter((k) => !seen.has(k));
        const group = (await readFile('/proc/self/cgroup', 'utf8')).trim().split('::')[1];
        const memoryEvents = await readFile('/sys/fs/cgroup' + group + '/memory.events', 'utf8');
        const memoryCurrent = Number(
          await readFile('/sys/fs/cgroup' + group + '/memory.current', 'utf8'),
        );
        if (added.length || !progress.samples.length || sample.qualified) {
          progress.samples.push({
            elapsedMs: Date.now() - started,
            required: [...required],
            completed,
            added,
            statistics: sample.statistics,
            backendReads: sample.reads.filter((r) => r.backendRead).length,
            ramReads: sample.reads.filter((r) => !r.backendRead).length,
            memoryCurrent,
            memoryEvents,
          });
          await save();
        }
        if (added.length) lastProgress = Date.now();
        seen = new Set(completed);
        assert(!/^(oom|oom_kill|oom_group_kill) [1-9]/m.test(memoryEvents), label + ' OOM event');
        assert(
          Date.now() - started <= deadlineMs,
          label + ' operation deadline ' + deadlineMs + 'ms',
        );
        if (sample.qualified) {
          frame = sample.qualified;
          break;
        }
        assert(
          Date.now() - lastProgress < result.limits.noProgressTimeoutMs,
          label + ' no required product completed for60s',
        );
        await page.waitForTimeout(2000);
      }
      await page.evaluate(() =>
        Promise.race([
          window.__qaRiverRaster.surface.waitForFrame(),
          new Promise((_, reject) =>
            setTimeout(() => reject(Error('Complete GPU frame deadline')), 30000),
          ),
        ]),
      );
      const ms = Date.now() - started;
      result.frameWaits.push({
        label,
        requireDetail,
        deadlineMs,
        ms,
        ...frame,
      });
      assert(ms <= deadlineMs, label + ' complete GPU frame operation deadline');
      if (requireDetail) operationStarted = null;
      return ms;
    } catch (error) {
      result.firstBreak = {
        label,
        requireDetail,
        deadlineMs,
        qualificationTargetWidthM,
        waitMs: Date.now() - started,
        state: await state().catch(() => null),
        canonicalRevision: revision,
      };
      await save();
      await native.capture(page, 'first-break').catch(() => {});
      throw error;
    }
  }
  async function open(initial = false) {
    page = await native.launch(scale);
    await native.app.evaluate(
      ({ BrowserWindow }, scale) =>
        BrowserWindow.getAllWindows()[0].setContentSize(1920 * scale, 1080 * scale),
      scale,
    );
    await observeRiverSurface(page, root);
    await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
    if (initial)
      await page.evaluate(
        ({ id, b }) => localStorage.setItem('atlas-camera:' + id, JSON.stringify(b)),
        {
          id: manifest.campaignId,
          b: reuseCamera ? { ...reuseCamera.frame, pose: reuseCamera } : manifest.bounds,
        },
      );
    await page
      .locator('.campaign-card')
      .filter({ hasText: manifest.campaignName })
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
    operationStarted = Date.now();
    await page.locator('#atlas-section').selectOption('terrain');
    await page.locator('#atlas-units').selectOption('metric');
    await page.evaluate(() => {
      window.__worldInputs = [];
      for (const type of ['wheel', 'pointerdown', 'pointerup'])
        window.addEventListener(
          type,
          (e) => {
            if (e.target?.id === 'campaign-map')
              window.__worldInputs.push({
                type,
                time: e.timeStamp,
                clientX: e.clientX,
                clientY: e.clientY,
                button: e.button,
                buttons: e.buttons,
                deltaY: e.deltaY,
              });
          },
          true,
        );
    });
    await page.evaluate(() => {
      window.__worldTileReads = [];
      const stream = window.__qaRiverRaster.stream,
        read = stream.getTile.bind(stream);
      stream.getTile = async (...args) => {
        const started = performance.now(),
          fetch = args[2];
        let backendRead = false;
        args[2] = (...a) => {
          backendRead = true;
          return fetch(...a);
        };
        const value = await read(...args);
        window.__worldTileReads.push({
          tile: args[0].tile,
          generation: args[3],
          ms: performance.now() - started,
          backendRead,
          returned: !!value,
        });
        if (window.__worldTileReads.length > 400) window.__worldTileReads.shift();
        return value;
      };
    });
    await ready('open');
    result.runtime = await page.evaluate(() => {
      const c = document.querySelector('#atlas-terrain-spatial canvas'),
        gl = c.getContext('webgl2'),
        info = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        dpr: devicePixelRatio,
        content: [innerWidth, innerHeight],
        canvas: [c.width, c.height],
        renderer: info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
        vendor: info && gl.getParameter(info.UNMASKED_VENDOR_WEBGL),
      };
    });
    opened = true;
  }
  async function project(p) {
    return page.evaluate((p) => {
      const r = window.__qaRiverRaster,
        a = r.surface.frame.project(p),
        b = document.querySelector('#campaign-map').getBoundingClientRect();
      return { x: b.x + a.x, y: b.y + a.y, visible: a.visible };
    }, p);
  }
  const terrainPoint = (p) => ({
    ...p,
    heightM: new api.TerrainSampler(query().records).sample(p).heightM,
  });
  async function anchorAt(at) {
    return page.evaluate((at) => {
      const r = window.__qaRiverRaster,
        a = r.navigationAnchor({ clientX: at.x, clientY: at.y });
      return a
        ? {
            ...a,
            source: JSON.parse(document.querySelector('#campaign-map').dataset.navigationAnchor)
              .source,
          }
        : null;
    }, at);
  }
  async function boundedGesture(label, at, action, delta = { x: 0, y: 0 }) {
    at = { x: Math.round(at.x), y: Math.round(at.y) };
    const eventStart = await page.evaluate(() => window.__worldInputs.length);
    const before = await state(),
      anchor = await anchorAt(at);
    assert(anchor, label + ' has a terrain/fallback anchor');
    const p = await project(anchor.point);
    if (currentTilt === 75)
      await page.evaluate(() => {
        window.__worldCameraPoses = [];
        window.__worldSampling = true;
        const tick = () => {
          if (!window.__worldSampling) return;
          window.__worldCameraPoses.push(window.__qaRiverRaster.cameraPose());
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    await action();
    operationStarted = Date.now();
    await page.waitForFunction(() => !window.__qaRiverRaster.navigating, null, { timeout: 30000 });
    const after = await project(anchor.point),
      next = await state(),
      driftCssPx = Math.hypot(after.x - p.x - delta.x, after.y - p.y - delta.y),
      entry = {
        label,
        at,
        anchor,
        before: before.pose,
        after: next.pose,
        driftCssPx,
        beforeProjected: p,
        afterProjected: after,
        delta,
        events: await page.evaluate((n) => window.__worldInputs.slice(n), eventStart),
      };
    if (currentTilt === 75) {
      const poses = await page.evaluate(() => {
        window.__worldSampling = false;
        return window.__worldCameraPoses;
      });
      const sampler = new api.TerrainSampler(query().records);
      entry.eyePath = poses.map((pose) => {
        const eye = api.atlasCameraWorldEye(pose),
          groundM = Math.max(sampler.seaLevelM, sampler.sample(eye).heightM);
        assert(
          eye.heightM > groundM,
          'Every sampled75-degree navigation pose stays above terrain/water',
        );
        return { pose, eye, groundM };
      });
      assert(entry.eyePath.length > 0, 'Moving75-degree camera path was sampled');
    }
    result.inputs.push(entry);
    await save();
    assert(driftCssPx < 1.1, `${label}: actual terrain anchor drift ${driftCssPx} CSS px`);
    return entry;
  }
  async function settleNavigation(entry, label) {
    entry.usableFrameWaitMs = await ready(label, false);
    entry.navigationFrame = result.frameWaits.at(-1);
    const after = await project(entry.anchor.point);
    entry.afterFrameProjected = after;
    entry.afterFrameDriftCssPx = Math.hypot(
      after.x - entry.beforeProjected.x - entry.delta.x,
      after.y - entry.beforeProjected.y - entry.delta.y,
    );
    await save();
    assert(entry.afterFrameDriftCssPx < 1.1, label + ' terrain anchor also survives the GPU frame');
  }
  async function drag(at, dx, dy, button) {
    at = { x: Math.round(at.x), y: Math.round(at.y) };
    await page.mouse.move(at.x, at.y);
    await page.mouse.down({ button });
    await page.mouse.move(at.x + dx, at.y + dy, { steps: 8 });
    await page.mouse.up({ button });
    await page.waitForTimeout(230);
  }
  async function panTo(point) {
    for (let i = 0; i < 12; i++) {
      const b = await page.locator('#campaign-map').boundingBox(),
        at = await project(terrainPoint(point)),
        center = { x: b.x + b.width / 2, y: b.y + b.height / 2 },
        dx = center.x - at.x,
        dy = center.y - at.y;
      if (Math.hypot(dx, dy) < 0.5) return;
      assert(at.visible, 'Target remains inside the continuous mouse navigation view');
      const k = Math.min(1, Math.max(100, b.width * 0.25) / Math.hypot(dx, dy)),
        delta = { x: dx * k, y: dy * k };
      const entry = await boundedGesture(
        'middle-pan',
        at,
        () => drag(at, delta.x, delta.y, 'middle'),
        delta,
      );
      await settleNavigation(entry, 'pan');
    }
    throw Error('Mouse pan did not centre target');
  }
  async function width() {
    return page.evaluate(() => {
      const r = window.__qaRiverRaster;
      return r.surface.frame.camera.metersPerPixel * r.surface.frame.width;
    });
  }
  async function zoomTo(target, focus = manifest.near) {
    for (let i = 0; i < 40; i++) {
      const beforeWidth = await width(),
        ratio = Math.log(target / beforeWidth);
      if (Math.abs(ratio) < 1e-5) return;
      const projected = await project(terrainPoint(focus));
      const at = { ...projected, x: Math.round(projected.x), y: Math.round(projected.y) };
      assert(at.visible, 'Native zoom target visible');
      const step = Math.max(-0.6, Math.min(0.6, ratio)),
        requestedDelta = (step / 0.002) * scale;
      await page.evaluate(() => {
        window.__worldWheel = null;
        window.addEventListener(
          'wheel',
          (e) => {
            window.__worldWheel = { deltaY: e.deltaY, deltaMode: e.deltaMode, time: e.timeStamp };
          },
          { once: true, capture: true },
        );
      });
      const entry = await boundedGesture('wheel', at, async () => {
        await page.mouse.move(at.x, at.y);
        await page.mouse.wheel(0, requestedDelta);
        await page.waitForFunction(() => !!window.__worldWheel);
        await page.waitForTimeout(240);
      });
      entry.requestedDelta = requestedDelta;
      entry.received = await page.evaluate(() => window.__worldWheel);
      entry.fromWidthM = beforeWidth;
      entry.toWidthM = await width();
      assert.equal(entry.received.deltaMode, 0);
      entry.unconstrainedExpectedWidthM =
        beforeWidth * Math.exp(Math.max(-1.2, Math.min(1.2, entry.received.deltaY * 0.002)));
      // Refocusing after an edit preserves the eye but rebases this metric
      // frame. Its width need not be monotonic until the new focus is established.
      entry.beforeEye = api.atlasCameraWorldEye(entry.before);
      entry.afterEye = api.atlasCameraWorldEye(entry.after);
      await save();
      await settleNavigation(entry, 'wheel ' + beforeWidth + ' -> ' + target);
      entry.canonicalSource = result.lastCanonicalSource;
      await save();
    }
    throw Error('Continuous native wheel did not reach ' + target);
  }
  async function checkpoint(label, target, points = []) {
    const readyMs = await ready(label),
      actualWidthM = await width();
    assert(Math.abs(actualWidthM / target - 1) < 1e-4, label + ' metric focus width');
    const detail = await page.evaluate((points) => {
      const r = window.__qaRiverRaster,
        checksum = (v) => {
          if (!v) return null;
          const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
          let h = 2166136261;
          for (const b of bytes) h = Math.imul(h ^ b, 16777619);
          return (h >>> 0).toString(16);
        };
      const tiles = r.tiles.map((t) => ({
        tile: t.tile,
        box: t.terrain.projection.grid.view.box,
        revision: t.revision,
        fence: t.fence,
        terrainRevision: t.terrain.revision,
        terrainFence: t.terrain.fence,
        materialRevision: t.material.revision,
        materialFence: t.material.fence,
        heightHash: checksum(t.terrain.projection.grid.heights),
        materialHashes: Object.fromEntries(
          Object.entries(t.material.channels).map(([k, v]) => [k, checksum(v)]),
        ),
        heightRange: [
          Math.min(...t.terrain.projection.grid.heights),
          Math.max(...t.terrain.projection.grid.heights),
        ],
      }));
      const materialSamples = points.map((p) => {
        const t = r.tiles
          .filter((t) => {
            const b = t.terrain.projection.grid.view.box;
            return p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height;
          })
          .sort(
            (a, b) =>
              a.terrain.projection.grid.view.box.width - b.terrain.projection.grid.view.box.width,
          )[0];
        if (!t) return { point: p, missing: true };
        const b = t.terrain.projection.grid.view.box,
          n =
            Math.min(255, Math.floor(((p.y - b.y) / b.height) * 256)) * 256 +
            Math.min(255, Math.floor(((p.x - b.x) / b.width) * 256));
        return {
          point: p,
          projected: r.surface.frame.project(p),
          heightM: r.height(p),
          material: Object.fromEntries(
            Object.entries(t.material.channels).map(([k, v]) => {
              const stride = v.length / 65536;
              return [k, Array.from(v.slice(n * stride, (n + 1) * stride))];
            }),
          ),
        };
      });
      return {
        pose: r.cameraPose(),
        metricCamera: r.surface.frame.camera,
        origin: r.surface.frame.origin,
        usable: r.surface.frameUsable,
        revision: r.revision,
        fence: r.fence,
        tiles,
        materialSamples,
        layers: r.vegetation.batches.map((b) => ({
          asset: b.asset,
          part: b.part,
          count: b.data.length,
          minSize: Math.min(...b.data.map((i) => i.size)),
          maxSize: Math.max(...b.data.map((i) => i.size)),
        })),
        models: r.surface.terrain.map((t) => ({
          id: t.object.id,
          position: checksum(t.mesh.attributes.POSITION.value),
        })),
      };
    }, points.map(terrainPoint));
    detail.canonicalSource = { ...result.lastCanonicalSource };
    const flatPlan = api.atlasTilePlan(detail.pose.frame, detail.metricCamera.metersPerPixel, {
        maxTiles: 32,
      }),
      flatLod = Math.max(...flatPlan.detail.map((t) => t.lod)),
      focusTiles = detail.tiles.filter((t) => {
        const b = t.box,
          f = detail.pose.frame;
        return (
          b.x < f.x + f.width && b.x + b.width > f.x && b.y < f.y + f.height && b.y + b.height > f.y
        );
      });
    detail.focusSampling = { flatLod, actualLods: [...new Set(focusTiles.map((t) => t.tile.lod))] };
    assert(
      focusTiles.length && focusTiles.every((t) => t.tile.lod <= flatLod),
      label + ' horizon preserves at least ordinary focus sampling',
    );
    const landmarks =
      target === 40000000
        ? [manifest.anchors.find((p) => p.name === 'mountain')]
        : target <= 100 && points.length
          ? [points[0]]
          : [];
    detail.landmarks = await page.evaluate(
      (points) =>
        points.map((point) => ({ point, renderedHeightM: window.__qaRiverRaster.height(point) })),
      landmarks,
    );
    for (const landmark of detail.landmarks) {
      landmark.canonicalHeightM = terrainPoint(landmark.point).heightM;
      landmark.toleranceM = target === 40000000 ? 350 : 0.05;
      assert(
        Number.isFinite(landmark.renderedHeightM) &&
          Math.abs(landmark.renderedHeightM - landmark.canonicalHeightM) <= landmark.toleranceM,
        label + ' retains the canonical mountain or stored local correction',
      );
    }
    const focus = detail.metricCamera.focus,
      d = target / 8;
    detail.projectedMeasures = [];
    for (const axis of ['x', 'y']) {
      const a = terrainPoint({ ...focus, [axis]: focus[axis] - d }),
        b = terrainPoint({ ...focus, [axis]: focus[axis] + d }),
        pa = await project(a),
        pb = await project(b);
      detail.projectedMeasures.push({
        axis,
        from: a,
        to: b,
        horizontalMetres: 2 * d,
        terrainMetres: Math.hypot(2 * d, b.heightM - a.heightM),
        cssPixels: Math.hypot(pb.x - pa.x, pb.y - pa.y),
        fromVisible: pa.visible,
        toVisible: pb.visible,
      });
    }
    for (let i = 0; i < detail.tiles.length; i++)
      for (let j = i + 1; j < detail.tiles.length; j++) {
        const a = detail.tiles[i].box,
          b = detail.tiles[j].box;
        assert(
          !(
            Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) + 1e-6 &&
            Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y) + 1e-6
          ),
          'Complete frame has no mixed overlapping parent/child surfaces',
        );
      }
    assert(
      detail.usable && detail.models.length === detail.tiles.length,
      'Every current terrain/material tile has a GPU model',
    );
    if (points.length === 4) {
      const m = detail.materialSamples.map((s) => s.material);
      assert(m.every(Boolean), 'All four distant biome areas have current material');
      assert(
        new Set(m.map((v) => v.baseColor.join(','))).size === 4,
        'Four spatially correct distinct distant biome surfaces',
      );
      assert(
        m[0].deciduous[0] > 100 &&
          m[1].reed[0] > 100 &&
          m[2].debris[0] > 0 &&
          m[3].furrows[0] > 100,
        'Canonical distant biome channels match their saved areas',
      );
      assert(
        detail.layers.every((b) => b.count === 0),
        'Local plant models never become world-size symbols',
      );
    }
    if (currentTilt === 75) {
      const eye = api.atlasCameraWorldEye(detail.pose),
        sample = new api.TerrainSampler(query().records).sample(eye);
      assert(eye.heightM > sample.heightM, '75 degree camera remains above actual terrain');
      detail.eye = { ...eye, terrainHeightM: sample.heightM };
      detail.occlusion = await page.evaluate(() => {
        const r = window.__qaRiverRaster,
          b = document.querySelector('#campaign-map').getBoundingClientRect(),
          at = { x: b.x + b.width / 2, y: b.y + b.height * 0.75 },
          hit = r.terrainHit(at.x, at.y);
        if (!hit) return null;
        const local = { x: at.x - b.x, y: at.y - b.y },
          ray = r.surface.frame.ray(local),
          p = hit.point,
          t = hit.segmentFraction + Math.min(0.001, (1 - hit.segmentFraction) * 0.1),
          behind = {
            x: ray[0][0] + t * (ray[1][0] - ray[0][0]),
            y: ray[0][1] + t * (ray[1][1] - ray[0][1]),
            heightM: ray[0][2] + t * (ray[1][2] - ray[0][2]),
          },
          frontProjection = r.surface.frame.project(p),
          behindProjection = r.surface.frame.project(behind);
        return {
          at: local,
          front: p,
          behind,
          frontProjection,
          behindProjection,
          behindAuthorHit: r.planePoint(at.x, at.y, behind.heightM, true),
        };
      });
      assert(detail.occlusion, '75 degree foreground has a real terrain intersection');
      assert.equal(
        detail.occlusion.behindAuthorHit,
        null,
        'Near terrain occludes the farther point on the same real ray',
      );
      assert(
        detail.occlusion.behindProjection.depthM > detail.occlusion.frontProjection.depthM,
        'Front/back depth ordering',
      );
    }
    await native.capture(page, label);
    result.checkpoints.push({ label, targetWidthM: target, actualWidthM, readyMs, ...detail });
    await save();
    console.log(label, Math.round(actualWidthM) + 'm', detail.tiles.length + ' complete tiles');
    return detail;
  }
  async function history(kind, cursor) {
    await page.locator('#atlas-' + kind).click();
    operationStarted = Date.now();
    const deadline = operationStarted + qualificationDeadlineMs('edit');
    while (query().cursor !== cursor && Date.now() < deadline) await page.waitForTimeout(100);
    assert.equal(query().cursor, cursor);
    await ready(kind, true, 'edit');
  }
  async function edit(label, point, radius, strength) {
    const expected =
      waypoints.editFootprints[
        label.startsWith('coarse') ? 'coarse' : label.startsWith('high') ? 'high' : 'local'
      ];
    assert.deepEqual(point, expected.point, 'Author point follows the frozen native protocol');
    assert.equal(radius, expected.radius, 'Author footprint follows the frozen native protocol');
    const before = query(),
      beforeCanonical = cleanWorldRecords(before.records),
      beforeHash = worldHash(beforeCanonical),
      beforeSampler = new api.TerrainSampler(before.records);
    await page.locator('[data-atlas-tool="land-shape"]').click();
    await setHeightDirection(page, 'raise');
    await setBrushWorldRadius(page, 'land-radius', radius);
    await page.locator('#land-height-strength').fill(String(strength));
    await page.locator('#land-height-strength').press('Tab');
    await page.locator('#land-height-feather').fill('0.7');
    await page.locator('#land-height-feather').press('Tab');
    const targetRiseM = label.startsWith('coarse') ? 300 : strength;
    const targetHeightM = beforeSampler.sample(point).heightM + targetRiseM;
    await page.locator('#land-height-target-enabled').check();
    await page.locator('#land-height-target').fill(String(targetHeightM));
    await page.locator('#land-height-target').press('Tab');
    const a = terrainPoint({ x: point.x - radius * 0.35, y: point.y }),
      b = terrainPoint({ x: point.x + radius * 0.35, y: point.y }),
      start = await project(a),
      end = await project(b);
    assert(start.visible && end.visible, label + ' visible editable path');
    await page.mouse.move(start.x, start.y);
    await page.waitForFunction(
      () => document.querySelector('#campaign-map').dataset.terrainEditingState === 'ready',
      null,
      { timeout: qualificationDeadlineMs('edit') },
    );
    const inputStart = await page.evaluate(() => window.__worldInputs.length);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.waitForTimeout(350);
    await page.mouse.up();
    operationStarted = Date.now();
    const deadline = operationStarted + qualificationDeadlineMs('edit');
    while (query().cursor === before.cursor && Date.now() < deadline)
      await page.waitForTimeout(100);
    const after = query();
    assert.equal(after.cursor, before.cursor + 1, label + ' exactly one canonical history step');
    await ready(label, true, 'edit');
    const changed = cleanWorldRecords(after.records),
      afterHash = worldHash(changed),
      sampler = new api.TerrainSampler(after.records),
      beforeM = beforeSampler.sample(point).heightM,
      afterM = sampler.sample(point).heightM;
    assert(afterM > beforeM, label + ' canonical height increased');
    const changedIds = changed
        .filter(
          (r) => worldHash(r) !== worldHash(beforeCanonical.find((v) => v.id === r.id) ?? null),
        )
        .map((r) => r.id),
      changedSet = new Set(changedIds);
    assert.deepEqual(
      changed.filter((r) => !changedSet.has(r.id)),
      beforeCanonical.filter((r) => !changedSet.has(r.id)),
      'Unrelated canonical terrain, water and biomes preserved',
    );
    await native.capture(page, label + '-changed');
    await history('undo', before.cursor);
    assert.equal(worldHash(canonical()), beforeHash, label + ' exact canonical Undo');
    await history('redo', after.cursor);
    assert.equal(worldHash(canonical()), afterHash, label + ' exact canonical Redo');
    result.edits.push({
      label,
      tilt: currentTilt,
      point,
      radius,
      strength,
      targetHeightM,
      beforeM,
      afterM,
      cursor: after.cursor,
      beforeHash,
      afterHash,
      changedIds,
      actualInputEvents: await page.evaluate((n) => window.__worldInputs.slice(n), inputStart),
    });
    await save();
  }
  async function setTilt(tilt) {
    if (tilt === currentTilt) return;
    const b = await page.locator('#campaign-map').boundingBox(),
      at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    // Real right drag: dy maps to 0.25 degrees per CSS pixel, bounded by 75.
    await boundedGesture('right-orbit-tilt-' + tilt, at, () =>
      drag(at, 0, (tilt - currentTilt) / 0.25, 'right'),
    );
    currentTilt = await page.evaluate(() => window.__qaRiverRaster.cameraPose().tilt);
    assert(Math.abs(currentTilt - tilt) < 0.01, 'Native right drag reaches tilt');
    await ready('tilt ' + tilt);
  }
  async function fresh(label) {
    const saved = query(),
      hash = worldHash(cleanWorldRecords(saved.records));
    await native.close();
    await open();
    assert.equal(worldHash(canonical()), hash, 'Fresh preserves all campaign source records');
    assert.equal(query().cursor, saved.cursor, 'Fresh preserves shared history');
    const sampler = new api.TerrainSampler(query().records);
    for (const e of [...(previous?.edits ?? []), ...result.edits])
      assert(sampler.sample(e.point).heightM >= e.afterM - 1e-3, 'Fresh retains ' + e.label);
    result.fresh.push({
      label,
      canonicalSha256: hash,
      revision: query().revision,
      cursor: query().cursor,
    });
    await native.capture(page, label);
    await save();
  }
  try {
    if (reuseProbe) {
      qualificationTargetWidthM = 10;
      await open(true);
      const baseline = await checkpoint('selective-reuse-baseline', 10, [manifest.near]);
      assert.equal(baseline.pose.tilt, 75, 'The saved failure pose is restored by the product');
      assert.equal(
        baseline.tiles.length,
        112,
        'The saved failure camera selects the same 112-tile plan',
      );
      await edit('local-height-' + scale + '-75', manifest.near, 0.7, 0.3);
      const edited = await state();
      result.selectiveReuseFrame = edited;
      assert(edited.stream.statistics.reused > 0, 'Authoritative disjoint products were reused');
      await fresh('selective-reuse-fresh');
      const reopened = await checkpoint('selective-reuse-fresh-tilted', 10, [manifest.near]);
      assert.equal(reopened.pose.tilt, 75, 'Fresh restores the actual tilted camera');
      assert.equal(reopened.tiles.length, 112);
    } else {
      await open(true);
      if (!resume) {
        await zoomTo(40000000);
        await panTo(manifest.near);
      } else {
        const entry = await checkpoint('continued-45-in-100', 100, [manifest.near]);
        assert.equal(entry.canonicalSource.revision, resumeControl.canonicalSource.revision);
        result.continuation.fenceRebinding = {
          previous: resumeControl.canonicalSource.fence,
          current: entry.canonicalSource.fence,
          reason:
            'Canonical fence includes database filename; copied profile rebinds source identity. Exact database bytes, payloads, revision and cursor establish continuation; all new frames retain strict current-session fence checks.',
        };
        await save();
        assert(Math.abs(entry.pose.tilt - resumeControl.pose.tilt) < 0.01);
      }
      for (const tilt of tilts) {
        await setTilt(tilt);
        mark(
          resume
            ? 'continued100% from45degree100m ->10m ->world'
            : 'continuous ' + scale * 100 + '% ' + tilt + ' degrees world -> 10m -> world',
        );
        for (const target of resume ? [10] : manifest.checkpointsM) {
          qualificationTargetWidthM = target;
          await zoomTo(target);
          await checkpoint(
            'tilt-' + tilt + '-in-' + target,
            target,
            target === 40000000
              ? [
                  { x: -7500000, y: -1000000 },
                  { x: -3800000, y: 1800000 },
                  { x: 6000000, y: -4000000 },
                  { x: 10500000, y: 4000000 },
                ]
              : [manifest.near],
          );
          if (target === 1000000 && tilt === 0)
            await edit('coarse-height-' + scale, { x: -80000, y: -80000 }, 25000, 300);
          if (target === 10)
            await edit(
              'local-height-' + scale + '-' + tilt,
              manifest.near,
              0.7,
              tilt === 0 ? 1 : 0.3,
            );
        }
        for (const target of [...manifest.checkpointsM].reverse().slice(1)) {
          qualificationTargetWidthM = target;
          await zoomTo(target);
          await checkpoint('tilt-' + tilt + '-out-' + target, target, [manifest.near]);
        }
        await fresh('fresh-after-tilt-' + tilt);
        mark(
          (resume
            ? 'continued journey remainder and fresh complete '
            : 'full journey and fresh complete ') + tilt,
        );
        if (tilt === 0) {
          result.earlyCompletedUtc = new Date().toISOString();
          await save();
        }
      }
      if (process.env.QA_SKIP_BIOMES !== '1') {
        await setTilt(0);
        for (const target of waypoints.biomes) {
          await zoomTo(40000000);
          await panTo(target);
          await zoomTo(100, target);
          await checkpoint('local-biome-' + target.id, 100, [target]);
          const scene = await page.evaluate(
            async (box) => {
              const r = window.__qaRiverRaster,
                a = await window.campaign.atlasVegetationScene(r.token, box, 0.1);
              if (!a.ok) throw Error(a.error);
              return a.value;
            },
            { x: target.x - 45, y: target.y - 45, width: 90, height: 90 },
          );
          const instances = scene.instances.filter((i) => i.areaId === target.sourceId);
          assert(instances.length > 0, 'Local biome has canonical physical assets ' + target.id);
          assert(
            target.assets.some((a) => instances.some((i) => i.asset === a)),
            'Expected asset type ' + target.id,
          );
          for (const i of instances)
            assert(i.size > 0 && i.size < 100, 'Vegetation model physical metre size');
          const modelMeasures = await page.evaluate((sourceId) => {
            const r = window.__qaRiverRaster;
            return r.vegetation.batches
              .filter((b) => b.part === 'crown')
              .flatMap((b) => {
                const i = b.data.find((i) => i.areaId === sourceId);
                if (!i) return [];
                const m = r.vegetation.transform(i, b.part, r.surface.frame).elements,
                  z = [];
                for (let n = 2; n < b.positions.length; n += 3) z.push(b.positions[n]);
                return [
                  {
                    asset: b.asset,
                    id: i.id,
                    sizeM: i.size,
                    axisMetres: [0, 4, 8].map((n) => Math.hypot(m[n], m[n + 1], m[n + 2])),
                    unitHeightM: Math.max(...z) - Math.min(...z),
                  },
                ];
              });
          }, target.sourceId);
          assert(modelMeasures.length > 0, 'Current GPU batches contain the visited biome');
          for (const m of modelMeasures) {
            const expected = manifest.assetMeasures[m.asset];
            assert(expected, 'Physical model dimensions were frozen before launch');
            assert(
              m.axisMetres.every((n) => Math.abs(n - m.sizeM) < 1e-5),
              'Near GPU instance axes retain real metre size',
            );
            assert(
              Math.abs(m.unitHeightM - (expected.max[2] - expected.min[2])) < 1e-6,
              'Runtime model geometry matches frozen asset dimensions',
            );
            const i = instances.find((i) => i.id === m.id);
            if (i)
              assert.equal(i.size, m.sizeM, 'GPU instance size equals the canonical bounded scene');
          }
          result.biomes.push({
            modelMeasures,
            id: target.id,
            revision: scene.revision,
            instancesHash: worldHash(instances),
            count: instances.length,
            assets: [...new Set(instances.map((i) => i.asset))],
            minSizeM: Math.min(...instances.map((i) => i.size)),
            maxSizeM: Math.max(...instances.map((i) => i.size)),
          });
          for (const mpp of [1.99, 2.01, 7.99, 8.01]) {
            const w = await page.evaluate(() => window.__qaRiverRaster.surface.frame.width);
            await zoomTo(mpp * w, target);
            await checkpoint('biome-' + target.id + '-mpp-' + mpp, mpp * w, [target]);
          }
          await zoomTo(40000000, target);
          await panTo(manifest.near);
        }
        await zoomTo(40000000);
        await panTo(manifest.far);
        await zoomTo(10, manifest.far);
        await edit('high-coordinate-' + scale, manifest.far, 0.7, 0.5);
        await checkpoint('high-coordinate-detail', 10, [manifest.far]);
        await zoomTo(40000000, manifest.far);
        await panTo(manifest.near);
        await checkpoint('world-after-high-coordinate', 40000000, [manifest.near]);
        await fresh('fresh-high-coordinate');
      }
    }
    result.completedUtc = new Date().toISOString();
    await native.close();
    await snapshotWorld(filename, path.join(output, 'changed-world.sqlite'));
    result.finalCanonicalSha256 = worldHash(canonical());
    await save();
    return result;
  } catch (error) {
    result.failure = {
      error: error.stack,
      utc: new Date().toISOString(),
      state: opened ? await state().catch(() => null) : null,
    };
    await save();
    if (page) await native.capture(page, 'failure').catch(() => {});
    await native.close().catch(() => {});
    await snapshotWorld(filename, path.join(output, 'failed-world.sqlite')).catch(() => {});
    throw error;
  }
});
