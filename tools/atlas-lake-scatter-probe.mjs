import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setBrushWorldRadius } from './atlas-brush-probe.mjs';

// Math.sin/cos in Node and Electron can differ by a few ulps. Check the
// author geometry to 10 nm while retaining exact Float32 height/bed bytes.
function equalAuthors(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i],
      e = expected[i];
    assert.equal(a.id, e.id);
    assert.equal(a.polygons.length, e.polygons.length);
    const ap = a.polygons.flatMap((p) => [p.outer, ...p.holes]),
      ep = e.polygons.flatMap((p) => [p.outer, ...p.holes]);
    assert.equal(ap.length, ep.length);
    for (let j = 0; j < ap.length; j++) {
      assert.equal(ap[j].length, ep[j].length);
      for (let k = 0; k < ap[j].length; k++)
        for (const axis of ['x', 'y'])
          assert(
            Math.abs(ap[j][k][axis] - ep[j][k][axis]) < 1e-8,
            'Native author geometry tolerance: ' + a.id,
          );
    }
    if (a.waterLevelM !== undefined) assert(Math.abs(a.waterLevelM - e.waterLevelM) < 1e-8);
    assert.deepEqual(
      {
        ...a,
        polygons: e.polygons,
        ...(a.waterLevelM !== undefined ? { waterLevelM: e.waterLevelM } : {}),
      },
      e,
    );
  }
}

/** Compact scatter lane of the existing native lake harness. Read back only
 * after release; the draw callback captures the first usable changed GPU frame. */
export async function qualifyLakeScatter(c) {
  const {
    api,
    canonicalGrid,
    native,
    start,
    pose,
    picture,
    records,
    cursor,
    clean,
    screen,
    viewReady,
    waitCursor,
    pixelPatch,
    savePatch,
    output,
    gestures,
    mark,
    early,
  } = c;
  const pageOf = c.page;
  const p = { x: 35, y: 0 };
  await start({ x: -140, y: -140, width: 400, height: 280 });
  let page = pageOf();
  await pose(false);
  mark(
    'scatter native GPU and scale',
    await page.evaluate(() => {
      const canvas = document.querySelector('#atlas-terrain-spatial canvas'),
        gl = canvas.getContext('webgl2'),
        info = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        dpr: devicePixelRatio,
        content: [innerWidth, innerHeight],
        renderer: info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
        vendor: info && gl.getParameter(info.UNMASKED_VENDOR_WEBGL),
      };
    }),
  );
  await picture('scatter-00-source');
  const baseline = clean(records()),
    baselineCursor = cursor();
  async function gesture(
    noise,
    {
      duration = 1800,
      strength = 2,
      label = 'scatter',
      erase = false,
      radius = 75,
      moving = false,
    } = {},
  ) {
    page = pageOf();
    await page.locator('[data-tool-group="water"]').click();
    await page
      .locator('[data-tool-select="land-tool"][data-tool-value="freshwater"]')
      .first()
      .click();
    await page.locator('#land-freshwater-operation').selectOption(erase ? 'erase' : 'scatter');
    if (!erase) await page.locator('#land-lake-noise').fill(String(noise));
    await page.locator('#land-height-strength').fill(String(strength));
    await page.locator('#land-height-strength').press('Tab');
    await setBrushWorldRadius(page, 'land-radius', radius);
    const point = await screen(p);
    const patchSize = await page.evaluate(() => Math.round(384 * devicePixelRatio));
    await page.mouse.move(point.x, point.y);
    await page.waitForFunction(
      () => document.querySelector('#campaign-map').dataset.terrainEditingState === 'ready',
      null,
      { timeout: 60000 },
    );
    const callCount = await native.app.evaluate(() => globalThis.__qaLake.calls.length);
    const boundGrid = await canonicalGrid();
    const before = records(),
      beforeCursor = cursor(),
      beforePixels = await pixelPatch({ ...point, size: patchSize });
    await page.evaluate(
      ({ point, beforePixels }) => {
        window.__qaObserveLake = null;
        window.__saltTerrainTrace = { events: [], dropped: 0 };
        const r = window.__qaRiverRaster,
          deck = r.surface.deckValue,
          previous = deck.props.onAfterRender;
        // Keep a bounded transition trace at the existing read-only probe seam.
        // A commit can succeed while display readiness stalls; retain its input
        // and the actual read outcome before that readiness gate can time out.
        if (!r.__qaRefreshTrace) {
          const events = (r.__qaRefreshTrace = []);
          r.__qaRefreshState = () => ({
            now: performance.now(),
            token: r.token,
            revision: r.revision,
            fence: r.fence,
            generation: r.generation,
            request: r.request,
            dirty: r.dirty,
            gesturing: r.gesturing,
            preferDetail: r.preferDetail,
            writing: r.host.writing(),
            editingRead: r.editingRead?.control,
            objectRead: r.objectRead?.control,
            quality: r.input.dataset.terrainQuality,
            tiles: r.tiles.map((t) => ({ ...t.tile, revision: t.revision, fence: t.fence })),
          });
          const record = (event, detail = {}) => {
            events.push({ event, ...r.__qaRefreshState(), ...detail });
            if (events.length > 256) events.shift();
          };
          for (const name of ['pauseReads', 'reconcile', 'sync']) {
            const original = r[name].bind(r);
            r[name] = (...args) => {
              record(name);
              return original(...args);
            };
          }
          const load = r.stream.load.bind(r.stream);
          r.stream.load = async (input, fetch, publish) => {
            record('stream.start', { input });
            try {
              await load(input, fetch, (frame) => {
                record('stream.publish', {
                  complete: frame.complete,
                  overviewComplete: frame.overviewComplete,
                  frameRevision: frame.tiles[0]?.revision,
                  frameFence: frame.tiles[0]?.fence,
                });
                publish(frame);
              });
              record('stream.end');
            } catch (error) {
              record('stream.error', { error: String(error) });
              throw error;
            }
          };
        }
        const state = (window.__qaScatter = {
          active: true,
          observations: [],
          holding: null,
          moving: null,
          frameChecks: [],
          sourceGrids: r.tiles.map((t) => ({
            columns: t.terrain.projection.grid.view.columns,
            rows: t.terrain.projection.grid.view.rows,
            width: t.material.width,
            height: t.material.height,
          })),
        });
        deck.setProps({
          onAfterRender: (...args) => {
            previous?.(...args);
            if (state.active && state.frameChecks.length < 128)
              state.frameChecks.push({
                now: performance.now(),
                gesturing: r.gesturing,
                usable: r.surface.frameUsable,
                draft: !!r.draft,
                sampleT: r.pendingStroke?.samples.at(-1)?.t,
                sampleCount: r.pendingStroke?.samples.length,
                appliedSampleCount: r.draft?.consumed,
                pendingLayers: (deck.props.layers ?? [])
                  .filter((l) => l && 'isLoaded' in l && !l.isLoaded)
                  .map((l) => l.id),
              });
            if (
              !state.active ||
              !r.gesturing ||
              !r.surface.frameUsable ||
              !r.draft ||
              !r.pendingStroke ||
              r.draft.consumed !== r.pendingStroke.samples.length
            )
              return;
            const stroke = r.pendingStroke,
              rs = r.draft.tiles[0].terrain.projection.grid.editing.author.records,
              lakes = rs.filter((v) => v.id.startsWith(stroke.id + ':')),
              snapshot = {
                now: performance.now(),
                sampleT: stroke.samples.at(-1).t,
                sampleCount: stroke.samples.length,
                appliedSampleCount: r.draft.consumed,
                ids: lakes.map((v) => v.id).sort(),
                seed: stroke.seed,
                noise: stroke.noise,
                polygons: [...lakes]
                  .sort((a, b) => a.id.localeCompare(b.id))
                  .map((v) => v.polygons),
                stroke: structuredClone(stroke),
              };
            if (!lakes.length) return;
            state.observations.push({
              now: snapshot.now,
              sampleT: snapshot.sampleT,
              sample: stroke.samples.at(-1),
              ids: snapshot.ids,
            });
            const moved = stroke.samples.some((p) => p.x - stroke.samples[0].x > 20);
            if (!state.holding || (moved && !state.moving)) {
              const pixels = window.__qaLakePixels(point);
              let changed = 0;
              for (let i = 0; i < pixels.bytes.length; i += 4)
                if (
                  Math.abs(pixels.bytes[i] - beforePixels.bytes[i]) +
                    Math.abs(pixels.bytes[i + 1] - beforePixels.bytes[i + 1]) +
                    Math.abs(pixels.bytes[i + 2] - beforePixels.bytes[i + 2]) >
                  12
                )
                  changed++;
              if (changed > 100) {
                state.holding ??= { ...snapshot, pixels, changed };
                if (moved) state.moving ??= { ...snapshot, pixels, changed };
              }
            }
          },
        });
      },
      { point: { ...point, size: patchSize }, beforePixels },
    );
    await page.mouse.down();
    if (moving) {
      for (const target of [
        { x: 65, y: -20 },
        { x: 95, y: 20 },
        { x: 125, y: 0 },
      ]) {
        await new Promise((resolve) => setTimeout(resolve, duration / 3));
        const next = await screen(target);
        await page.mouse.move(next.x, next.y, { steps: 3 });
      }
    } else await new Promise((resolve) => setTimeout(resolve, duration));
    if (!erase)
      await page.waitForFunction(
        (moving) => (moving ? !!window.__qaScatter.moving : !!window.__qaScatter.holding),
        moving,
        { timeout: 60000 },
      );
    await page.mouse.up();
    const observed = await page.evaluate(() => {
      window.__qaScatter.active = false;
      return {
        ...window.__qaScatter,
        input: window.__qaLakeInputs.slice(-2),
        trace: window.__saltTerrainTrace,
      };
    });
    const capture = async () => ({
      input: observed.input,
      live: observed.holding ? { ...observed.holding, pixels: undefined } : null,
      moving: observed.moving ? { ...observed.moving, pixels: undefined } : null,
      observations: observed.observations,
      trace: observed.trace,
      frameChecks: observed.frameChecks,
      sourceGrids: observed.sourceGrids,
      commands: await native.app.evaluate(() => globalThis.__qaLake.calls),
      refresh: await page.evaluate(() => ({
        state: window.__qaRiverRaster.__qaRefreshState(),
        events: window.__qaRiverRaster.__qaRefreshTrace,
      })),
    });
    await writeFile(
      path.join(output, label + '-released.json'),
      JSON.stringify(await capture(), null, 2),
    );
    try {
      await waitCursor(beforeCursor + 1);
      await writeFile(
        path.join(output, label + '-settled.json'),
        JSON.stringify(await capture(), null, 2),
      );
    } catch (error) {
      await writeFile(
        path.join(output, label + '-stalled.json'),
        JSON.stringify(await capture(), null, 2),
      );
      throw error;
    }
    const commands = await native.app.evaluate(() => globalThis.__qaLake.calls),
      command = commands.at(-1),
      stroke = command.action.stroke,
      after = records();
    await writeFile(
      path.join(output, label + '-input.json'),
      JSON.stringify(
        {
          input: observed.input,
          live: observed.holding ? { ...observed.holding, pixels: undefined } : null,
          observations: observed.observations,
          trace: observed.trace,
          frameChecks: observed.frameChecks,
          sourceGrids: observed.sourceGrids,
          command,
        },
        null,
        2,
      ),
    );
    assert.equal(
      commands.length,
      callCount + 1,
      'A gesture submits exactly one existing Atlas command',
    );
    assert.equal(command.action.kind, 'landscape-lake-stroke');
    assert.equal(stroke.screenInput?.version, 1);
    assert.equal(stroke.radius, radius);
    assert.equal(stroke.strength, strength);
    if (!erase) {
      assert.equal(stroke.noise, noise);
    }

    assert.equal(stroke.mode, erase ? 'erase' : 'scatter');
    assert.equal(cursor(), beforeCursor + 1);
    const actual = observed.input[1].t - observed.input[0].t;
    assert.equal(
      stroke.samples.at(-1).t,
      actual,
      'Canonical duration uses actual received input timestamps',
    );
    assert(actual >= duration - 300, JSON.stringify({ duration, actual }));
    assert(actual <= 120000, 'Loaded scatter edit must remain within 120 seconds');
    if (moving) {
      assert(new Set(stroke.samples.map((p) => `${p.x}:${p.y}`)).size >= 4);
      assert(
        stroke.samples.at(-1).x - stroke.samples[0].x > 80,
        'Native drag reaches its distant endpoint',
      );
    }
    equalAuthors(
      clean(after),
      clean(api.mergeLakeBrush(before, api.applyLakeBrush(before, stroke, boundGrid))),
    );
    if (!erase) {
      assert(observed.holding, 'A changed usable GPU frame must exist before pointerup');
      if (moving) {
        assert(observed.moving, 'A changed usable GPU frame must include actually moved samples');
        assert(observed.moving.now < observed.input[1].t);
        assert(observed.moving.stroke.samples.some((p) => p.x - stroke.samples[0].x > 20));
        assert.equal(observed.moving.seed, stroke.seed);
        assert.deepEqual(
          observed.moving.ids,
          api
            .applyLakeBrush(before, observed.moving.stroke, boundGrid)
            .records.filter((r) => r.surface === 'freshwater')
            .map((r) => r.id)
            .sort(),
        );
      }
      assert.equal(stroke.seed, observed.holding.seed);
      assert(observed.holding.now < observed.input[1].t);
      const expected = api
        .applyLakeBrush(before, observed.holding.stroke, boundGrid)
        .records.filter((r) => r.surface === 'freshwater');
      assert.deepEqual(observed.holding.ids, expected.map((r) => r.id).sort());
      for (const o of moving ? [] : observed.observations)
        assert.deepEqual(
          o.ids,
          observed.holding.ids,
          'Holding may deepen but never invent or move basins',
        );
      const finalLakes = after.filter((r) => r.id.startsWith(stroke.id + ':'));
      if (!moving) assert.deepEqual(finalLakes.map((r) => r.id).sort(), observed.holding.ids);
      equalAuthors(
        clean(finalLakes),
        clean(
          api
            .applyLakeBrush(before, stroke, boundGrid)
            .records.filter((r) => r.surface === 'freshwater'),
        ),
      );
      for (const r of moving ? [] : finalLakes) {
        const index = observed.holding.ids.indexOf(r.id);
        const earlier = observed.holding.polygons[index];
        // Compare holding against final contours, with time-independent geometry.
        equalAuthors([{ id: r.id, polygons: r.polygons }], [{ id: r.id, polygons: earlier }]);
      }
      gestures.push({
        label,
        noise,
        strength,
        stroke,
        input: observed.input,
        actualDurationMs: actual,
        live: {
          ...observed.holding,
          pixels: await savePatch(label + '-holding-gpu.png', observed.holding.pixels),
        },
        ...(moving
          ? {
              moving: {
                ...observed.moving,
                pixels: await savePatch(label + '-moving-gpu.png', observed.moving.pixels),
              },
            }
          : {}),
        beforeGpu: await savePatch(label + '-before-gpu.png', beforePixels),
        observations: observed.observations,
        basinCount: finalLakes.length,
      });
    } else gestures.push({ label, stroke, input: observed.input, actualDurationMs: actual });
    await picture(label + '-after');
    mark(
      label +
        (erase
          ? ' one transaction; timed input and canonical erasure agree'
          : ' one transaction; live, frozen basin keys, timed input and canonical operator agree'),
    );
    return {
      after: clean(after),
      stroke,
      lakes: after.filter((r) => r.id.startsWith(stroke.id + ':')),
    };
  }
  async function undoToBaseline() {
    while (cursor() > baselineCursor) {
      const target = cursor() - 1;
      await pageOf().locator('#atlas-undo').click();
      await waitCursor(target);
    }
    assert.deepEqual(clean(records()), baseline);
  }
  if (process.argv.includes('--dense')) {
    const moved = await gesture(0.5, {
      moving: true,
      label: 'dense-moving-scatter',
      duration: 2400,
    });
    await pageOf().locator('#atlas-undo').click();
    await waitCursor(baselineCursor);
    assert.deepEqual(clean(records()), baseline);
    await pageOf().locator('#atlas-redo').click();
    await waitCursor(baselineCursor + 1);
    assert.deepEqual(clean(records()), moved.after);
    await gesture(0, {
      erase: true,
      radius: 24,
      duration: 150,
      label: 'dense-scatter-partial-erase',
    });
    assert(records().some((r) => r.lakeBed));
    await gesture(0, {
      erase: true,
      radius: 240,
      duration: 150,
      label: 'dense-scatter-full-erase',
    });
    assert(!records().some((r) => r.lakeBed));
    const saved = clean(records()),
      savedCursor = cursor();
    await native.close();
    await start();
    page = pageOf();
    assert.deepEqual(clean(records()), saved);
    assert.equal(cursor(), savedCursor);
    await picture('dense-scatter-fresh');
    mark('dense moving scatter, live frame, partial/full erase, Undo/Redo/Fresh');
    await native.close();
    return;
  }
  if (process.argv.includes('--scatter-moving')) {
    for (const noise of [0, 1]) {
      await undoToBaseline();
      const moved = await gesture(noise, {
        moving: true,
        label: `scatter-moving-${noise}`,
        duration: 2400,
      });
      await pageOf().locator('#atlas-undo').click();
      await waitCursor(baselineCursor);
      assert.deepEqual(clean(records()), baseline);
      await pageOf().locator('#atlas-redo').click();
      await waitCursor(baselineCursor + 1);
      assert.deepEqual(clean(records()), moved.after);
      await native.close();
      await start();
      page = pageOf();
      assert.deepEqual(clean(records()), moved.after);
      assert.equal(cursor(), baselineCursor + 1);
      await picture(`scatter-moving-${noise}-fresh`);
      mark(`Noise ${noise}: native moving stroke, live frame, one history step, Undo/Redo/Fresh`);
    }
    await native.close();
    return;
  }
  if (process.argv.includes('--scatter-diagnose')) {
    await gesture(1, { label: 'diagnose-noise1' });
    await native.close();
    return;
  }
  const few = await gesture(0, { label: 'scatter-01-noise0' });
  await page.locator('#atlas-undo').click();
  await waitCursor(baselineCursor);
  assert.deepEqual(clean(records()), baseline);
  await page.locator('#atlas-redo').click();
  await waitCursor(baselineCursor + 1);
  assert.deepEqual(clean(records()), few.after);
  await picture('scatter-02-redo');
  await undoToBaseline();
  const many = await gesture(1, { label: 'scatter-03-noise1' });
  assert(many.lakes.length > few.lakes.length * 2);
  if (!early) {
    await undoToBaseline();
    const middle = await gesture(0.5, { label: 'scatter-04-middle', strength: 4, duration: 2200 });
    assert(middle.lakes.length > few.lakes.length && middle.lakes.length < many.lakes.length);
    const source = clean(records());
    const retainedCursor = cursor();
    await native.close();
    await start();
    page = pageOf();
    assert.deepEqual(clean(records()), source);
    assert.equal(cursor(), retainedCursor);
    await picture('scatter-04-middle-fresh');
    mark('Fresh retains scattered basin authors and their excavation before erasure');

    await gesture(0, { label: 'scatter-05-partial-erase', erase: true, radius: 24, duration: 500 });
    assert(records().some((r) => r.lakeBed));
    await page.locator('#atlas-undo').click();
    await waitCursor(baselineCursor + 1);
    assert.deepEqual(clean(records()), source);
    await page.locator('#atlas-redo').click();
    await waitCursor(baselineCursor + 2);
    await gesture(0, { label: 'scatter-06-full-erase', erase: true, radius: 130, duration: 500 });
    assert(!records().some((r) => r.lakeBed));
  }
  const saved = clean(records()),
    savedCursor = cursor();
  await native.close();
  await start();
  page = pageOf();
  assert.deepEqual(clean(records()), saved);
  assert.equal(cursor(), savedCursor);
  await picture('scatter-07-fresh');
  await native.close();
  mark('scatter Fresh preserves heights, individual water authors, ownership and history');
  await writeFile(
    path.join(output, 'scatter-bindings.json'),
    JSON.stringify(
      { baselineCursor, fewCount: few.lakes.length, manyCount: many.lakes.length, savedCursor },
      null,
      2,
    ),
  );
}
