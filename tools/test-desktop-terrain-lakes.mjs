import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { runNativeProbe } from './native-session.mjs';
import { observeRiverSurface } from './atlas-river-probe.mjs';
import { setBrushWorldRadius } from './atlas-brush-probe.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';

const root = process.cwd(),
  require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
const scale = process.argv.includes('--scale=2') ? 2 : 1;
const liftOnly = process.argv.includes('--lift');
const output = path.resolve(
  process.env.QA_EVIDENCE_DIR ?? `.build/cycle2-point4/native/${Date.now()}-${scale}`,
);
await mkdir(output, { recursive: true });
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/terrain-spatial-model';export * from './src/app/atlas/terrain-lake-brush';export * from './src/app/atlas/terrain-brush';export * from './src/app/atlas/terrain-lake-coupling';",
    resolveDir: root,
  },
  outfile: '.build/cycle2-point4/native-api.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const api = require(root + '/.build/cycle2-point4/native-api.cjs');
const clean = (rs) =>
  rs.map(({ revision, order, ...r }) => r).sort((a, b) => a.id.localeCompare(b.id));
const sha = (v) =>
  createHash('sha256')
    .update(typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v))
    .digest('hex');
await runNativeProbe({ root, output, name: 'terrain-lakes' }, async (native) => {
  const profile = native.profile,
    store = new api.CampaignStore(profile + '/workbench.sqlite');
  const cam = store.create('Seebeckenprobe'),
    active = store.activate(cam.id);
  const far = { x: Math.floor(18000000 / 512) * 512, y: Math.floor(-9000000 / 512) * 512 };
  for (const offset of [{ x: 0, y: 0 }, far])
    for (let y = -1; y <= 0; y++)
      for (let x = -1; x <= 0; x++) {
        const record = api.heightRecord(
          offset.x + x * 512,
          offset.y + y * 512,
          8,
          Float32Array.from({ length: 4096 }, (_, i) => {
            const xx = x * 512 + (i % 64) * 8,
              yy = y * 512 + Math.floor(i / 64) * 8;
            return Math.hypot(xx, yy) > 480 ? -20 : xx > 240 ? 20 + 0.08 * (xx - 320) : 20;
          }),
        );
        store.executeAtlasCommit({
          commandId: randomUUID(),
          campaignId: cam.id,
          token: active.token,
          action: { kind: 'landscape-put', record, expectedRevision: null },
        });
      }
  store.tutorial('skipped');
  store.close();
  const db = new Database(profile + '/workbench.sqlite', { readonly: true });
  const records = () =>
    db
      .prepare('SELECT payload FROM atlas_landscape ORDER BY id')
      .all()
      .map((r) => JSON.parse(r.payload));
  const cursor = () =>
    db.prepare('SELECT cursor FROM campaign_atlas WHERE campaign_id=?').get(cam.id).cursor;
  const revision = () =>
    db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(cam.id).revision;
  const initial = clean(records()),
    checks = [],
    snapshots = {},
    gestures = [];
  let page;
  const mark = (name, detail = {}) => {
    checks.push({ name, ...detail });
    console.log(name);
  };
  async function viewReady() {
    await atlasCanvasReady(page);
    await page.waitForFunction(
      (r) =>
        Number(document.querySelector('#campaign-map').dataset.terrainRevision) >= r &&
        document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
      revision(),
      { timeout: 60000 },
    );
    await page.waitForFunction(() => !!window.__qaRiverRaster?.surface?.frameUsable);
    await page.evaluate(() => window.__qaRiverRaster.surface.waitForFrame());
  }
  async function start(box) {
    page = await native.launch(scale);
    await native.app.evaluate(
      ({ BrowserWindow }, scale) =>
        BrowserWindow.getAllWindows()[0].setContentSize(1920 * scale, 1080 * scale),
      scale,
    );
    if (box) {
      await page.evaluate(
        ({ id, box }) => localStorage.setItem('atlas-camera:' + id, JSON.stringify(box)),
        { id: cam.id, box },
      );
      await page.reload();
    }
    await observeRiverSurface(page, root);
    await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
    await page
      .locator('.campaign-card')
      .filter({ hasText: 'Seebeckenprobe' })
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
    await viewReady();
    await page.locator('#atlas-section').selectOption('terrain');
    await page.locator('[data-tool-group="water"]').click();
    await page
      .locator('[data-tool-select="land-tool"][data-tool-value="freshwater"]')
      .first()
      .click();
    await page.locator('#atlas-units').selectOption('metric');
    await setBrushWorldRadius(page, 'land-radius', 48);
    await page.locator('#land-height-strength').fill('2');
    await page.locator('#land-height-strength').press('Tab');
    await native.app.evaluate(({ ipcMain }) => {
      const commit = ipcMain._invokeHandlers.get('atlas:commit'),
        reconcile = ipcMain._invokeHandlers.get('atlas:reconcile-commit');
      const state = (globalThis.__qaLake = { calls: [], resolutions: [], loseNext: false });
      ipcMain.removeHandler('atlas:commit');
      ipcMain.handle('atlas:commit', async (...args) => {
        if (['landscape-lake-stroke', 'landscape-height-stroke'].includes(args[1]?.action?.kind))
          state.calls.push(structuredClone(args[1]));
        const result = await commit(...args);
        if (state.loseNext && args[1]?.action?.kind === 'landscape-lake-stroke' && result.ok) {
          state.loseNext = false;
          return {
            ok: false,
            error: 'Controlled lost lake commit reply; Speicherstand klären.',
            errorKind: 'store-outcome-unknown',
          };
        }
        return result;
      });
      ipcMain.removeHandler('atlas:reconcile-commit');
      ipcMain.handle('atlas:reconcile-commit', async (...args) => {
        state.resolutions.push(structuredClone(args[1]));
        return reconcile(...args);
      });
    });
    await installDraftObserver();
    await page.evaluate(() => {
      window.__qaLakeInputs = [];
      for (const type of ['pointerdown', 'pointerup'])
        window.addEventListener(
          type,
          (e) => {
            if (e.target.closest?.('#campaign-map')) {
              window.__qaLakeInputs.push({ type, t: e.timeStamp, x: e.clientX, y: e.clientY });
              if (type === 'pointerdown' && window.__qaObserveLake) {
                const point = window.__qaObserveLake;
                setTimeout(
                  () =>
                    requestAnimationFrame(() => {
                      window.__qaLakeAtOne = window.__qaReadLake(point);
                    }),
                  1000,
                );
              }
            }
          },
          true,
        );
    });
  }
  async function pose(tilted) {
    await page.locator('#atlas-view').click();
    await page.locator(tilted ? '#atlas-terrain-tilt' : '#terrain-top').click();
    await page.locator('#atlas-search').click();
    await viewReady();
  }
  async function picture(label) {
    await viewReady();
    await native.capture(page, label);
    const source = await page.evaluate(() => {
      const r = window.__qaRiverRaster;
      return {
        revision: r.revision,
        fence: r.fence,
        frameUsable: r.surface.frameUsable,
        view: document.querySelector('#campaign-map').dataset.atlasView,
        projection: document.querySelector('#campaign-map').dataset.terrainProjection,
        tiles: r.tiles.map((t) => ({ id: t.tile, revision: t.revision, fence: t.fence })),
      };
    });
    snapshots[label] = { ...source, historyCursor: cursor() };
    assert.equal(source.revision, revision());
  }
  async function waitCursor(expected) {
    const end = Date.now() + 60000;
    while (cursor() !== expected && Date.now() < end) await page.waitForTimeout(100);
    assert.equal(cursor(), expected);
    await viewReady();
  }
  async function screen(p) {
    const camera = JSON.parse(
        await page.locator('#campaign-map').getAttribute('data-terrain-projection'),
      ),
      rect = await page.locator('#campaign-map').boundingBox(),
      sampler = new api.TerrainSampler(records()),
      h = sampler.sample(p).heightM,
      pt = api.projectTerrain(camera, p, Math.max(h, sampler.waterLevel(p, h) ?? -Infinity));
    return { x: rect.x + pt.x * rect.width, y: rect.y + pt.y * rect.height };
  }
  async function installDraftObserver() {
    await page.evaluate(() => {
      window.__qaReadLake = (p) => {
        const r = window.__qaRiverRaster,
          d = r.draft;
        const tiles = d?.tiles ?? r.tiles;
        const tile = tiles.find((t) => {
          const b = t.terrain.projection.grid.view.box;
          return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
        });
        const g = tile?.terrain.projection.grid;
        if (!g) return null;
        const b = g.view.box,
          ix = Math.round(((p.x - b.x) / b.width) * (g.view.columns - 1)),
          iy = Math.round(((p.y - b.y) / b.height) * (g.view.rows - 1)),
          i = iy * g.view.columns + ix;
        return {
          ground: g.editing.ground[i],
          water: g.editing.water[i],
          surface: g.heights[i],
          pointer: r.gesturing,
          now: performance.now(),
          down: window.__qaLakeInputs.filter((e) => e.type === 'pointerdown').at(-1)?.t,
          draft: !!d,
          lastSample: r.pendingStroke?.samples.at(-1),
          wetPixels: tiles.reduce(
            (n, t) => n + t.material.channels.water.reduce((s, v) => s + (v > 0), 0),
            0,
          ),
        };
      };
      window.__qaLakePixels = (point) => {
        const canvas = document.querySelector('#atlas-terrain-spatial canvas'),
          gl = canvas.getContext('webgl2'),
          rect = canvas.getBoundingClientRect(),
          size = 128;
        const cx = Math.round(((point.x - rect.left) / rect.width) * gl.drawingBufferWidth),
          cy = Math.round((1 - (point.y - rect.top) / rect.height) * gl.drawingBufferHeight),
          left = Math.max(0, Math.min(gl.drawingBufferWidth - size, cx - size / 2)),
          bottom = Math.max(0, Math.min(gl.drawingBufferHeight - size, cy - size / 2)),
          bytes = new Uint8Array(size * size * 4),
          previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.readPixels(left, bottom, size, size, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
        return { bytes: Array.from(bytes), sampledAt: performance.now(), size, left, bottom };
      };
      // Observe at the actual completed Deck draw. A timer between draws can
      // always see the next pending draft revision and miss usable frames.
      const raster = window.__qaRiverRaster,
        deck = raster.surface.deckValue,
        afterRender = deck.props.onAfterRender;
      deck.setProps({
        onAfterRender: (...args) => {
          afterRender?.(...args);
          if (
            !window.__qaObserveLift ||
            window.__qaLiftHolding ||
            !raster.gesturing ||
            !raster.surface.frameUsable
          )
            return;
          const one = window.__qaReadLake(window.__qaObserveLift.point);
          if (!one?.draft || one.water < 20.15) return;
          const pixels = window.__qaLakePixels(window.__qaObserveLift.shore),
            pre = window.__qaLiftBefore;
          let changedPixels = 0;
          for (let i = 0; i < pixels.bytes.length; i += 4)
            if (
              Math.abs(pixels.bytes[i] - pre.bytes[i]) +
                Math.abs(pixels.bytes[i + 1] - pre.bytes[i + 1]) +
                Math.abs(pixels.bytes[i + 2] - pre.bytes[i + 2]) >
              12
            )
              changedPixels++;
          window.__qaLiftObservations.push({
            now: one.now,
            sampleT: one.lastSample?.t,
            water: one.water,
            changedPixels,
          });
          if (changedPixels > 100) window.__qaLiftHolding = { one, pixels };
        },
      });
    });
  }
  async function draftState(p) {
    return page.evaluate((p) => window.__qaReadLake(p), p);
  }
  // Same preserved WebGL read/PNG row flip as the terrain-stroke probe. Read a
  // small scene patch before pointerup; encode only after input has ended.
  async function pixelPatch(point) {
    return page.evaluate((point) => window.__qaLakePixels(point), point);
  }
  async function savePatch(name, patch) {
    const { PNG } = require('pngjs'),
      png = new PNG({ width: patch.size, height: patch.size });
    for (let y = 0; y < patch.size; y++)
      for (let x = 0; x < patch.size; x++)
        for (let c = 0; c < 4; c++)
          png.data[(y * patch.size + x) * 4 + c] =
            patch.bytes[((patch.size - y - 1) * patch.size + x) * 4 + c];
    const bytes = PNG.sync.write(png);
    await writeFile(path.join(output, name), bytes);
    return {
      file: name,
      sha256: sha(bytes),
      sampledAt: patch.sampledAt,
      size: patch.size,
      left: patch.left,
      bottom: patch.bottom,
    };
  }
  async function stroke(
    p,
    duration,
    { mode = 'add', radius = 48, holdCheck = false, unknown = false, label = 'gesture' } = {},
  ) {
    await page.locator('[data-tool-group="water"]').click();
    await page
      .locator(`[data-atlas-tool="${mode === 'add' ? 'water-add' : 'water-erase'}"]`)
      .click();
    await setBrushWorldRadius(page, 'land-radius', radius);
    const pt = await screen(p);
    await page.mouse.move(pt.x, pt.y);
    await page.waitForFunction(
      () => document.querySelector('#campaign-map').dataset.terrainEditingState === 'ready',
      null,
      { timeout: 60000 },
    );
    const before = cursor(),
      beforeRaw = records(),
      beforeRecords = clean(beforeRaw);
    const beforeDraft = await draftState(p);
    const beforePixels = holdCheck ? await pixelPatch(pt) : null;
    let heldEvidence = null;
    if (unknown) await native.app.evaluate(() => (globalThis.__qaLake.loseNext = true));
    await page.evaluate(
      (p) => {
        window.__qaObserveLake = p;
        window.__qaLakeAtOne = null;
      },
      holdCheck ? p : null,
    );
    await page.mouse.down();
    const nodeDownAt = performance.now();
    let live = null;
    if (holdCheck) {
      await page.waitForFunction(() => !!window.__qaLakeAtOne);
      const one = await page.evaluate(() => window.__qaLakeAtOne);
      live = one;
      await page.evaluate(() => window.__qaRiverRaster.surface.waitForFrame());
      assert(one.pointer && one.draft);
      console.log('held probe', JSON.stringify(one));
      assert(one.lastSample.t >= 800 && one.lastSample.t <= 1400, JSON.stringify(one));
      assert(
        Math.abs(one.ground - (20 - (2 * one.lastSample.t) / 1000)) < 0.1,
        JSON.stringify(one),
      );
      assert.equal(one.water, 20);
      assert(
        one.wetPixels > beforeDraft.wetPixels,
        'A new water material patch must appear before pointerup',
      );
      const pixels = await pixelPatch(pt);
      let changedPixels = 0;
      for (let i = 0; i < pixels.bytes.length; i += 4)
        if (
          Math.abs(pixels.bytes[i] - beforePixels.bytes[i]) +
            Math.abs(pixels.bytes[i + 1] - beforePixels.bytes[i + 1]) +
            Math.abs(pixels.bytes[i + 2] - beforePixels.bytes[i + 2]) >
          12
        )
          changedPixels++;
      assert(changedPixels > 100, 'Actual GPU terrain pixels must change before pointerup');
      heldEvidence = { one, pixels, changedPixels };
    }
    await page.waitForTimeout(Math.max(1, duration - (performance.now() - nodeDownAt)));
    await page.mouse.up();
    if (heldEvidence)
      gestures.push({
        label,
        one: heldEvidence.one,
        beforeDraft,
        gpu: {
          before: await savePatch(label + '-before-gpu.png', beforePixels),
          holding: await savePatch(label + '-holding-gpu.png', heldEvidence.pixels),
          changedPixels: heldEvidence.changedPixels,
        },
      });
    if (unknown) {
      const end = Date.now() + 60000;
      while (cursor() !== before + 1 && Date.now() < end) await page.waitForTimeout(100);
      assert.equal(cursor(), before + 1);
      await page.waitForFunction(() => !document.querySelector('#atlas-recover').hidden);
      await page.locator('#atlas-status').click();
      await page.locator('#atlas-recover').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#atlas-recover').hidden &&
          !document.querySelector('#land-tool').disabled,
        null,
        { timeout: 60000 },
      );
      const resolved = await native.app.evaluate(() => globalThis.__qaLake);
      assert.equal(resolved.calls.length, 1);
      assert.equal(resolved.resolutions.length, 1);
      assert.equal(resolved.resolutions[0].commandId, resolved.calls[0].commandId);
      assert.equal(cursor(), before + 1);
      if (await page.locator('#atlas-status-popup').evaluate((n) => n.matches(':popover-open')))
        await page.keyboard.press('Escape');
      mark('lost postcommit lake reply reconciled with original id and no duplicate application');
    }
    await waitCursor(before + 1);
    const rs = records(),
      sampler = new api.TerrainSampler(rs);
    const command = await native.app.evaluate(() => globalThis.__qaLake.calls.at(-1));
    assert(command && command.action.kind === 'landscape-lake-stroke');
    const expected = api.mergeLakeBrush(
      beforeRaw,
      api.applyLakeBrush(beforeRaw, command.action.stroke),
    );
    assert.deepEqual(
      clean(rs),
      clean(expected),
      'Canonical source must equal the same complete pure gesture operator',
    );
    if (mode === 'add') {
      const lake = rs.find((r) => r.id === command.action.stroke.id);
      assert.equal(
        command.action.stroke.waterLevelM,
        api.lakeBrushLevel(beforeRaw, command.action.stroke.samples[0]),
      );
      assert(sampler.water(p));
      assert.equal(lake.waterLevelM, command.action.stroke.waterLevelM);
      assert(lake.lakeBed.length > 0);
    }
    assert.notEqual(sha(clean(rs)), sha(beforeRecords));
    const input = await page.evaluate(() => window.__qaLakeInputs.slice(-2));
    assert.equal(input[0].type, 'pointerdown');
    assert.equal(input[1].type, 'pointerup');
    assert.equal(input[0].x, input[1].x);
    assert.equal(input[0].y, input[1].y);
    if (holdCheck) {
      assert(Math.abs(input[1].t - input[0].t - duration) < 250, JSON.stringify(input));
      assert(
        heldEvidence.pixels.sampledAt < input[1].t,
        'Holding GPU patch must precede actual pointerup',
      );
    }
    gestures.push({
      label,
      p,
      live,
      command,
      input,
      ground: sampler.sample(p).heightM,
      water: sampler.waterLevel(p),
      cursor: cursor(),
    });
    mark(label + ' commits one history step', { ground: sampler.sample(p).heightM });
    return rs;
  }
  async function liftScenario() {
    const p = { x: 64, y: 0 };
    await start({ x: -350, y: -300, width: 900, height: 600 });
    await pose(false);
    mark(
      'native GPU and real UI scale recorded',
      await page.evaluate(() => {
        const canvas = document.querySelector('#atlas-terrain-spatial canvas'),
          gl = canvas.getContext('webgl2'),
          info = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          dpr: devicePixelRatio,
          content: [innerWidth, innerHeight],
          canvas: [canvas.width, canvas.height],
          vendor: info && gl.getParameter(info.UNMASKED_VENDOR_WEBGL),
          renderer: info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
        };
      }),
    );
    await stroke(p, 3000, { label: 'lift-01-basin' });
    const before = records(),
      beforeCursor = cursor(),
      beforeSampler = new api.TerrainSampler(before);
    assert(before.some((r) => r.height?.version === 2 && r.height.x === 0));
    assert(before.some((r) => r.height?.version === 2 && r.height.x === 64));
    assert(Math.abs(beforeSampler.sample(p).heightM - 14) < 0.3);
    await picture('lift-02-before-top');
    await pose(true);
    await picture('lift-03-before-tilted');
    await page.locator('[data-tool-group="land"]').click();
    await page.locator('[data-atlas-tool="land-shape"]').click();
    await setBrushWorldRadius(page, 'land-radius', 128);
    await page.locator('#land-height-direction [data-direction="raise"]').click();
    await page.locator('#land-height-strength').fill('2');
    await page.locator('#land-height-strength').press('Tab');
    await page.locator('#land-height-feather').fill('0.5');
    await page.locator('#land-coast-roughness').fill('0');
    await page.locator('#land-height-target-enabled').uncheck();
    await page.locator('#land-preserve-details').check();
    const pt = await screen(p),
      shorePt = await screen({ x: 109, y: 0 });
    await page.mouse.move(pt.x, pt.y);
    await page.waitForFunction(
      () => document.querySelector('#campaign-map').dataset.terrainEditingState === 'ready',
      null,
      { timeout: 60000 },
    );
    await page.evaluate(
      ({ point, shore }) => {
        window.__qaObserveLake = null;
        window.__qaObserveLift = { point, shore };
        window.__qaLiftHolding = null;
        window.__qaLiftObservations = [];
      },
      { point: p, shore: shorePt },
    );
    const pre = await pixelPatch(shorePt),
      preDraft = await draftState(p);
    await page.evaluate((pre) => {
      window.__qaLiftBefore = pre;
    }, pre);
    await page.mouse.down();
    // Release is independent of renderer observation and serialization. The
    // browser stores the ready GPU patch itself; inspect it after pointerup.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.mouse.up();
    const observation = await page.evaluate(() => window.__qaLiftHolding);
    const frameObservations = await page.evaluate(() => window.__qaLiftObservations);
    await writeFile(
      path.join(output, 'lift-frame-observations.json'),
      JSON.stringify(frameObservations, null, 2),
    );
    assert(
      observation,
      'A consistent changed water frame must exist during the fixed two-second hold',
    );
    const { one: live, pixels: held } = observation;
    assert(live.pointer && live.draft);
    assert(live.lastSample.t >= 75 && live.lastSample.t < 2000, JSON.stringify(live));
    const liveLift = (2 * live.lastSample.t) / 1000;
    assert(Math.abs(live.ground - preDraft.ground - liveLift) < 0.03, JSON.stringify(live));
    assert(Math.abs(live.water - 20 - liveLift) < 0.03, JSON.stringify(live));
    assert(Math.abs(live.water - live.ground - (preDraft.water - preDraft.ground)) < 0.01);
    let changedPixels = 0;
    for (let i = 0; i < held.bytes.length; i += 4)
      if (
        Math.abs(held.bytes[i] - pre.bytes[i]) +
          Math.abs(held.bytes[i + 1] - pre.bytes[i + 1]) +
          Math.abs(held.bytes[i + 2] - pre.bytes[i + 2]) >
        12
      )
        changedPixels++;
    assert(
      changedPixels > 100,
      'Lifted water/shore terrain must change in actual GPU pixels before pointerup',
    );
    await page.evaluate(() => {
      window.__qaObserveLift = null;
    });
    await waitCursor(beforeCursor + 1);
    const inputs = await page.evaluate(() => window.__qaLakeInputs.slice(-2)),
      duration = inputs[1].t - inputs[0].t;
    assert(Math.abs(duration - 2000) < 250, JSON.stringify(inputs));
    assert(held.sampledAt < inputs[1].t);
    const command = await native.app.evaluate(() => globalThis.__qaLake.calls.at(-1));
    assert.equal(command.action.kind, 'landscape-height-stroke');
    const expected = api.mergeLakeBrush(before, {
      records: api.applyCoupledTerrainBrush(before, command.action.stroke),
      remove: [],
    });
    const lifted = records(),
      sampler = new api.TerrainSampler(lifted),
      delta = (command.action.stroke.samples.at(-1).t * 2) / 1000;
    assert.deepEqual(clean(lifted), clean(expected));
    assert(Math.abs(sampler.sample(p).heightM - beforeSampler.sample(p).heightM - delta) < 0.0001);
    assert(Math.abs(sampler.waterLevel(p) - 20 - delta) < 0.0001);
    assert(Math.abs(sampler.sample({ x: 120, y: 0 }).heightM - 20 - delta) < 0.0001);
    for (const lake of before.filter((r) => r.lakeBed))
      assert.deepEqual(lifted.find((r) => r.id === lake.id).lakeBed, lake.lakeBed);
    gestures.push({
      label: 'lift-04-held-height',
      live,
      frameObservations,
      preDraft,
      inputs,
      duration,
      command,
      ground: sampler.sample(p).heightM,
      water: sampler.waterLevel(p),
      gpu: {
        before: await savePatch('lift-before-gpu.png', pre),
        holding: await savePatch('lift-holding-gpu.png', held),
        changedPixels,
      },
    });
    mark(
      'whole lake and shore lift live before pointerup; actual dose and unchanged excavation verified',
      { delta, ground: sampler.sample(p).heightM, water: sampler.waterLevel(p), duration },
    );
    await picture('lift-05-after-tilted');
    await pose(false);
    await picture('lift-06-after-top');
    await page.locator('#atlas-undo').click();
    await waitCursor(beforeCursor);
    assert.deepEqual(clean(records()), clean(before));
    await picture('lift-07-undo');
    await page.locator('#atlas-redo').click();
    await waitCursor(beforeCursor + 1);
    assert.deepEqual(clean(records()), clean(lifted));
    await picture('lift-08-redo');
    await native.close();
    await start();
    assert.deepEqual(clean(records()), clean(lifted));
    assert.equal(cursor(), beforeCursor + 1);
    await pose(false);
    await picture('lift-09-fresh');
    await stroke(p, 80, { mode: 'erase', radius: 64, label: 'lift-10-erase' });
    assert(Math.abs(new api.TerrainSampler(records()).sample(p).heightM - 20 - delta) < 0.0001);
    assert(!records().some((r) => r.lakeBed));
    await picture('lift-11-restored-elevated');
    mark('lift undo/redo/fresh and subsequent erasure preserve the raised land');
    await native.close();
    await start({ x: far.x - 350, y: far.y - 300, width: 900, height: 600 });
    await pose(false);
    await stroke({ x: far.x + 64, y: far.y }, 1000, { label: 'lift-12-distant-basin' });
    // The same normal UI lift at large world coordinates, without a world/room claim.
    await page.locator('[data-tool-group="land"]').click();
    await page.locator('[data-atlas-tool="land-shape"]').click();
    await setBrushWorldRadius(page, 'land-radius', 128);
    await page.locator('#land-height-strength').fill('2');
    await page.locator('#land-height-strength').press('Tab');
    await page.locator('#land-height-feather').fill('0.5');
    await page.locator('#land-coast-roughness').fill('0');
    const distantPoint = { x: far.x + 64, y: far.y },
      distantBefore = records(),
      dc = cursor(),
      dp = await screen(distantPoint);
    await page.mouse.move(dp.x, dp.y);
    await page.waitForFunction(
      () => document.querySelector('#campaign-map').dataset.terrainEditingState === 'ready',
    );
    await page.mouse.down();
    await page.waitForTimeout(2000);
    await page.mouse.up();
    await waitCursor(dc + 1);
    const distantCommand = await native.app.evaluate(() => globalThis.__qaLake.calls.at(-1));
    assert.deepEqual(
      clean(records()),
      clean(
        api.mergeLakeBrush(distantBefore, {
          records: api.applyCoupledTerrainBrush(distantBefore, distantCommand.action.stroke),
          remove: [],
        }),
      ),
    );
    assert(new api.TerrainSampler(records()).waterLevel(distantPoint) > 23.9);
    const saved = clean(records());
    await picture('lift-13-distant-top');
    await native.close();
    await start();
    assert.deepEqual(clean(records()), saved);
    await picture('lift-14-distant-fresh');
    await native.close();
    mark('same joint lift persists at large world coordinates');
  }
  try {
    if (liftOnly) await liftScenario();
    else {
      await start({ x: -150, y: -150, width: 450, height: 300 });
      await pose(false);
      await picture('00-plateau');
      const gpu = await page.evaluate(() => {
        const canvas = document.querySelector('#atlas-terrain-spatial canvas'),
          gl = canvas.getContext('webgl2'),
          info = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          dpr: devicePixelRatio,
          content: [innerWidth, innerHeight],
          canvas: [canvas.width, canvas.height],
          vendor: info && gl.getParameter(info.UNMASKED_VENDOR_WEBGL),
          renderer: info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
        };
      });
      mark('native GPU and real UI scale recorded', gpu);
      const p = { x: 64, y: 0 },
        control = { x: 130, y: 0 },
        controlHeight = new api.TerrainSampler(records()).sample(control).heightM;
      await stroke(p, 3000, { holdCheck: true, label: '01-still-three-seconds' });
      assert(
        Math.abs(new api.TerrainSampler(records()).sample(control).heightM - controlHeight) < 1e-5,
      );
      const first = clean(records());
      assert(first.some((r) => r.height?.version === 2 && r.height.x === 0));
      assert(first.some((r) => r.height?.version === 2 && r.height.x === 64));
      await picture('02-wet-plateau-top');
      await pose(true);
      await picture('03-wet-plateau-tilted');
      await pose(false);
      await stroke(p, 1000, { label: '04-deepen' });
      const deep = clean(records());
      assert(
        new api.TerrainSampler(records()).sample(p).heightM <
          new api.TerrainSampler(first).sample(p).heightM - 1.5,
      );
      await stroke(p, 80, { mode: 'erase', radius: 12, label: '05-partial-erase' });
      const partial = clean(records());
      let sampler = new api.TerrainSampler(records());
      assert(Math.abs(sampler.sample(p).heightM - 20) < 0.01);
      assert(!sampler.water(p));
      assert(sampler.water({ x: 90, y: 0 }));
      await picture('06-partial-top');
      const partialCursor = cursor();
      await page.locator('#atlas-undo').click();
      await waitCursor(partialCursor - 1);
      assert.deepEqual(clean(records()), deep);
      await picture('07-undo');
      await page.locator('#atlas-redo').click();
      await waitCursor(partialCursor);
      assert.deepEqual(clean(records()), partial);
      await picture('08-redo');
      await stroke(p, 80, { mode: 'erase', radius: 64, label: '09-full-erase' });
      assert(!records().some((r) => r.lakeBed));
      assert(Math.abs(new api.TerrainSampler(records()).sample(p).heightM - 20) < 0.01);
      await picture('10-restored');
      // A slope is the second author fixture. Its higher ground remains dry.
      await native.close();
      await start({ x: 180, y: -160, width: 320, height: 240 });
      await pose(false);
      await stroke({ x: 320, y: 0 }, 1000, { label: '11-slope' });
      sampler = new api.TerrainSampler(records());
      assert(!sampler.water({ x: 355, y: 0 }));
      assert(!sampler.water({ x: 320, y: 55 }));
      await picture('12-slope-top');
      await pose(true);
      await picture('13-slope-tilted');
      await pose(false);
      const saved = clean(records()),
        savedCursor = cursor();
      await native.close();
      await start({ x: -20000000, y: -10000000, width: 40000000, height: 20000000 });
      await picture('14-world-fresh');
      assert(JSON.parse(snapshots['14-world-fresh'].view).width >= 30000000);
      assert.deepEqual(clean(records()), saved);
      assert.equal(cursor(), savedCursor);
      mark('same locally edited fixture survives fresh at 40000 km world width');
      await native.close();
      await start({ x: far.x - 150, y: far.y - 150, width: 450, height: 300 });
      await pose(false);
      await pose(true);
      await stroke({ x: far.x + 64, y: far.y }, 1000, { unknown: true, label: '15-distant-local' });
      const distant = clean(records()),
        distantCursor = cursor();
      await picture('16-distant-local-top');
      await native.close();
      await start();
      assert.deepEqual(clean(records()), distant);
      assert.equal(cursor(), distantCursor);
      await picture('17-distant-fresh');
      await native.close();
    }
    const hashes = {};
    for (const file of [
      'src/app/atlas/terrain-lake-brush.ts',
      'src/app/atlas/terrain-lake-coupling.ts',
      'src/app/atlas/terrain-brush.ts',
      'src/app/atlas/atlas-landscape.ts',
      'src/app/atlas/atlas-surface-draft.ts',
      'src/app/atlas/terrain-brush-draft.ts',
      'src/app/atlas/landscape-brush-session.ts',
      'src/app/atlas/landscape-tool-settings.ts',
      'src/app/atlas/atlas-landscape-ui.ts',
      'src/app/storage/terrain-scale.ts',
      'src/app/storage/atlas-landscape.ts',
      'src/app/storage/campaign-atlas.ts',
      'src/app/storage/store.ts',
      'src/app/storage/terrain-editing-source.ts',
      'src/app/storage/terrain-editing-dependencies.ts',
      'desktop/atlas-host.ts',
      'desktop/atlas-region-worker.ts',
      'tools/test-desktop-terrain-lakes.mjs',
    ])
      hashes[file] = sha(await readFile(file));
    await writeFile(
      path.join(output, 'details.json'),
      JSON.stringify(
        {
          checks,
          snapshots,
          gestures,
          hashes,
          initialHash: sha(initial),
          finalHash: sha(clean(records())),
          far,
          scale,
        },
        null,
        2,
      ),
    );
    return {
      checks,
      snapshots,
      gestures,
      hashes,
      scale,
      limits: ['No p95, beauty, package, owner acceptance or full Earth/room LOD qualification.'],
    };
  } finally {
    db.close();
  }
});
