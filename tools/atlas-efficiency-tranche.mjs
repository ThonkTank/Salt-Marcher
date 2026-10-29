import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
import { timingQuantiles } from './atlas-efficiency-probe.mjs';

/** Fixed input intent, unchanged original world, exact undo reset. Missing live
 * frames remain samples. Timers schedule input independently of CDP replies. */
export async function runEfficiencyTranche(c) {
  const { page, native, result, query, ready, save, out, navigate, hash, clean } = c;
  const n = Number(process.env.QA_PERF_SAMPLES ?? 5);
  const events = JSON.parse(
    await readFile('.build/cycle3-point4/screen-kernel-product-proof.json', 'utf8'),
  ).results[0].events;
  const protocol = {
    version: 1,
    sourceWorld: '.build/cycle3-point4/baseline-world-100-v3/failed-world.sqlite',
    path: [events[0], events.at(-1)].map(({ u, v }) => ({ u, v })),
    height: { durationMs: 300, moveAtMs: 150, radius: 0.7, strength: 0.3, feather: 0.7 },
    scatter: {
      durationMs: 1800,
      radius: 0.7,
      strength: 0.3,
      feather: 0.7,
      noise: 0.5,
      seed: 0x51a7,
    },
    reset: 'exact canonical author bytes after normal Undo; camera checked separately',
    order:
      'height samples, scatter samples, ' +
      (process.env.QA_PERF_SKIP_NAV === '1' ? '0' : '30') +
      ' loaded navigation events',
    firstFrame:
      'onAfterRender with changed terrain arrays and loaded layers; GPU submission observation, no scanout',
    schedule:
      'host timers fixed at down dispatch, no wait for a live frame; actual renderer times reported',
  };
  if (result.mode === 'dense') {
    protocol.sourceWorld = '.build/cycle3-point2/dense-world.sqlite';
    protocol.path = [
      { u: 0.5, v: 0.5 },
      { u: 0.52, v: 0.5 },
    ];
    protocol.height.radius = protocol.scatter.radius = 128;
    protocol.height.strength = protocol.scatter.strength = 2;
  }
  result.protocol = protocol;
  await writeFile(path.join(out, 'protocol.json'), JSON.stringify(protocol, null, 2));
  await page.evaluate((seed) => {
    const random = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (values) => {
      if (values instanceof Uint32Array && values.length === 1) {
        values[0] = seed;
        return values;
      }
      return random(values);
    };
    const r = window.__qaRiverRaster;
    window.__efficiencyLastStroke = null;
    const preview = r.previewHeight.bind(r);
    window.__efficiencyGeometry = [];
    r.previewHeight = (stroke) => {
      window.__efficiencyLastStroke = stroke;
      const value = preview(stroke);
      window.__efficiencyGeometry.push({
        at: performance.now(),
        bytes: r.screenGeometry?.retainedBytes ?? 0,
        triangles: r.screenGeometry?.retainedTriangles ?? 0,
      });
      return value;
    };
  }, protocol.scatter.seed);
  const baseline = hash(clean(query().records));
  const initialPose = await page.evaluate(() => window.__qaRiverRaster.cameraPose());
  for (const kind of ['height', 'scatter']) {
    const spec = protocol[kind];
    await page.locator(`[data-tool-group="${kind === 'scatter' ? 'water' : 'land'}"]`).click();
    await page
      .locator(
        `[data-tool-select="land-tool"][data-tool-value="${kind === 'scatter' ? 'freshwater' : 'height'}"]`,
      )
      .first()
      .click();
    if (kind === 'scatter') {
      await page.locator('#land-freshwater-operation').selectOption('scatter');
      await page.locator('#land-lake-noise').fill(String(spec.noise));
    } else await setHeightDirection(page, 'raise');
    await setBrushWorldRadius(page, 'land-radius', spec.radius);
    for (const [id, value] of [
      ['land-height-strength', spec.strength],
      ['land-height-feather', spec.feather],
    ]) {
      await page.locator('#' + id).fill(String(value));
      await page.locator('#' + id).press('Tab');
    }
    await page.locator('#land-height-target-enabled').uncheck();
    const group = {
      label: (result.mode === 'dense' ? 'fixed-dense0-' : 'fixed-local75-') + kind,
      kind: 'terrain',
      samples: [],
    };
    result.groups.push(group);
    for (let i = 0; i < n; i++) {
      assert.equal(hash(clean(query().records)), baseline, 'exact source reset before sample');
      const b = await page.locator('#campaign-map').boundingBox();
      const [start, end] = protocol.path.map((p) => ({
        x: b.x + p.u * b.width,
        y: b.y + p.v * b.height,
      }));
      await page.mouse.move(start.x, start.y);
      await page.waitForFunction(
        () => document.querySelector('#campaign-map').dataset.terrainEditingState === 'ready',
        null,
        { timeout: 120000 },
      );
      const before = query();
      if (process.env.SALTMARCHER_TERRAIN_TRACE === '1')
        await native.app.evaluate(() => {
          globalThis.__efficiencyWorkerTraces = [];
          globalThis.__efficiencyWorkerTraceActive = true;
          globalThis.__saltTerrainTrace = { events: [], dropped: 0 };
        });
      await page.evaluate(() => window.__atlasEfficiency.begin('terrain'));
      const inputStart = performance.now(),
        commands = [];
      const command = async (name, action) => {
        const item = { name, dispatchedMs: performance.now() - inputStart };
        commands.push(item);
        try {
          await action();
        } finally {
          item.completedMs = performance.now() - inputStart;
        }
      };
      const jobs = [command('down', () => page.mouse.down())];
      if (kind === 'height')
        jobs.push(
          new Promise((resolve) => setTimeout(resolve, spec.moveAtMs)).then(() =>
            command('move', () => page.mouse.move(end.x, end.y)),
          ),
        );
      jobs.push(
        new Promise((resolve) => setTimeout(resolve, spec.durationMs)).then(() =>
          command('up', () => page.mouse.up()),
        ),
      );
      await Promise.all(jobs);
      const commitStart = Date.now();
      while (query().cursor === before.cursor) {
        assert(Date.now() - commitStart < 60000, 'no commit progress60s');
        await page.waitForTimeout(50);
      }
      await ready(kind + ' sample ' + i, 'edit');
      await page.mouse.move(start.x, start.y);
      await page.waitForFunction(
        () => document.querySelector('#campaign-map').dataset.terrainEditingState === 'ready',
        null,
        { timeout: 120000 },
      );
      const nextEditable = await page.evaluate(() => performance.now());
      const value = await page.evaluate(() => ({
        ...window.__atlasEfficiency.end(),
        stroke: structuredClone(window.__efficiencyLastStroke),
        geometryRetainedAfter: !!window.__qaRiverRaster.screenGeometry,
        geometry: window.__efficiencyGeometry.splice(0),
        pose: window.__qaRiverRaster.cameraPose(),
      }));
      if (process.env.SALTMARCHER_TERRAIN_TRACE === '1')
        Object.assign(
          value,
          await native.app.evaluate(() => {
            globalThis.__efficiencyWorkerTraceActive = false;
            return {
              workerTraces: globalThis.__efficiencyWorkerTraces,
              mainTraces: globalThis.__saltTerrainTrace,
            };
          }),
        );
      const after = query();
      const down = value.inputs.find((p) => p.type === 'pointerdown' && p.buttons === 1),
        up = value.inputs.find((p) => p.type === 'pointerup');
      Object.assign(value, {
        index: i,
        kind,
        commands,
        requestedDurationMs: spec.durationMs,
        actualDurationMs: down && up ? up.eventTimestamp - down.eventTimestamp : null,
        pointerupToNextEditableMs: up ? nextEditable - up.eventTimestamp : null,
        inputToNextEditableMs: down ? nextEditable - down.eventTimestamp : null,
        beforeCursor: before.cursor,
        afterCursor: after.cursor,
        beforeCanonicalSha256: baseline,
        afterCanonicalSha256: hash(clean(after.records)),
      });
      group.samples.push(value);
      await save();
      assert.equal(after.cursor, before.cursor + 1, 'one atomic history step');
      assert.notEqual(value.afterCanonicalSha256, baseline, 'actual authored effect');
      if (kind === 'scatter') assert.equal(value.stroke.seed, spec.seed);
      assert.equal(value.stroke.screenInput.version, 1);
      assert.equal(
        value.geometryRetainedAfter,
        false,
        'gesture releases geometry before next input',
      );
      await page.locator('#atlas-undo').click();
      const undoStart = Date.now();
      while (query().cursor !== before.cursor) {
        assert(Date.now() - undoStart < 60000, 'Undo progress60s');
        await page.waitForTimeout(50);
      }
      await ready(kind + ' reset ' + i, 'edit');
      assert.equal(hash(clean(query().records)), baseline, 'exact author source restored');
      value.resetMs = Date.now() - undoStart;
      value.resetPose = await page.evaluate(() => window.__qaRiverRaster.cameraPose());
      value.initialPose = initialPose;
      console.log(
        'fixed sample',
        kind,
        i,
        'live',
        value.firstTerrainFrameMs,
        'full',
        value.pointerupToFullFrameMs,
        'editable',
        value.pointerupToNextEditableMs,
        'actual input',
        value.actualDurationMs,
      );
      await save();
    }
    group.firstFrame = timingQuantiles(group.samples.map((s) => s.firstTerrainFrameMs));
    group.fullFrame = timingQuantiles(group.samples.map((s) => s.pointerupToFullFrameMs));
    group.nextEditable = timingQuantiles(group.samples.map((s) => s.pointerupToNextEditableMs));
  }
  if (process.env.QA_PERF_SKIP_NAV !== '1') await navigate('fixed-local75-loaded', 30);
  await save();
  await native.capture(page, 'fixed-baseline-complete');
}
