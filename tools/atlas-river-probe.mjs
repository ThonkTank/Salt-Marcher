import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { riverAnchors, riverSamples } from '../tests/helpers/river-terrain.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const { PNG } = createRequire(import.meta.url)('pngjs');
const hash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex');

// Bind the existing presentation only for read-only frame/data diagnostics,
// using the same native debugger seam as the biome qualification.
export async function observeRiverSurface(
  page,
  root,
  directory = path.join(root, '.build/desktop'),
) {
  const code = await readFile(path.join(directory, 'ui/renderer.js'), 'utf8'),
    offset = code.indexOf(
      'this.surface.setTerrain(',
      code.indexOf('var AtlasRasterPresentation = class'),
    );
  assert(offset > 0, 'Read-only presentation binding exists');
  const session = await page.context().newCDPSession(page);
  await session.send('Debugger.enable');
  const points = new Map();
  const entries = [],
    timelineId = Date.now();
  const probes = [
    ['surface', offset],
    ['restore', code.indexOf('if (!pose || !pose.frame', code.indexOf('restoreCameraPose(pose)'))],
    ['remember', code.indexOf('if (!this.owner) return;', code.indexOf('    remember() {'))],
    ['first-terrain', code.indexOf('if (!this.ready && !this.navigating')],
    [
      'apply-pose',
      code.indexOf('this.frame = { ...pose.frame };', code.indexOf('    applyCameraPose(pose)')),
    ],
    ['navigation-end', code.indexOf('if (ended) this.refocusCamera();')],
  ];
  for (const [label, at] of probes) {
    assert(at >= 0, 'Camera observation point: ' + label);
    const bp = await session.send('Debugger.setBreakpointByUrl', {
      urlRegex: 'renderer\\.js$',
      lineNumber: code.slice(0, at).split('\n').length - 1,
    });
    points.set(bp.breakpointId, label);
  }
  session.on('Debugger.paused', async (event) => {
    const phase = points.get(event.hitBreakpoints?.[0]);
    try {
      const sample = await session.send('Debugger.evaluateOnCallFrame', {
        callFrameId: event.callFrames[0].callFrameId,
        expression: `(() => {
          const r = this.raster ?? this;
          ${phase === 'surface' ? 'globalThis.__qaRiverRaster = this;' : ''}
          return { at: performance.now(), phase: ${JSON.stringify(phase)},
            pose: r.cameraPose?.(), incoming: typeof pose === 'undefined' ? null : pose,
            ready: r.ready, quality: r.input?.dataset.terrainQuality,
            saved: this.owner ? JSON.parse(localStorage.getItem('atlas-camera:' + this.owner.campaign.id)) : null,
            frame: this.camera?.view,
            lod: r.tiles?.map(t => t.tile.lod) };
        })()`,
        returnByValue: true,
      });
      entries.push(sample.result.value ?? { phase, error: sample.exceptionDetails });
      await writeFile(
        path.join(
          process.env.QA_EVIDENCE_DIR ?? '.build/terrain-routes-native',
          'camera-timeline-' + timelineId + '.json',
        ),
        JSON.stringify(entries, null, 2),
      );
    } finally {
      await session.send('Debugger.resume');
    }
  });
}

/** The river-only native lane deliberately excludes the older road/structure matrix. */
export async function qualifyRiverRoute({
  api,
  native,
  getPage,
  start,
  close,
  records,
  cursor,
  revision,
  ready,
  change,
  save,
  focus,
  capture,
  scale,
  depression,
  out,
  result,
}) {
  const clean = (rs) => rs.map(({ revision, ...r }) => r),
    original = records(),
    beforeCursor = cursor(),
    name = `Meerfluss ${depression}m`,
    tolerance = 1e-5;
  const check = (label, condition, detail) => {
    assert(condition, label + (detail ? ': ' + JSON.stringify(detail) : ''));
    result.checks.push(label);
    console.log(label);
  };
  const editor = () => getPage().locator('#terrain-route-editor'),
    action = (kind) => editor().locator(`[data-action="${kind}"]`);
  const viewReady = async () => {
    await atlasCanvasReady(getPage());
    await getPage().waitForFunction(
      (expected) => {
        const d = document.querySelector('#campaign-map')?.dataset;
        return (
          d?.terrainReady === 'ready' &&
          d.terrainQuality === 'detail' &&
          Number(d.terrainRevision) >= expected
        );
      },
      revision(),
      { timeout: 60000 },
    );
  };
  const pose = async (tilted) => {
    const page = getPage();
    await page.locator('#atlas-view').click();
    await page.locator(tilted ? '#atlas-terrain-tilt' : '#terrain-top').click();
    await page.locator('#atlas-search').click();
    await viewReady();
  };
  async function waitCursor(expected) {
    const deadline = Date.now() + 60000;
    while (cursor() !== expected && Date.now() < deadline) await getPage().waitForTimeout(100);
    assert.equal(cursor(), expected, 'History command must finish before checking its projection');
  }
  const checkpoints = [];
  async function checkpoint(label) {
    const state = await getPage().evaluate(() => ({
      pose: window.__qaRiverRaster.savedCameraPose,
      displayed: JSON.parse(document.querySelector('#campaign-map').dataset.terrainProjection),
      quality: document.querySelector('#campaign-map').dataset.terrainQuality,
      stored: Object.fromEntries(
        Object.keys(localStorage)
          .filter((k) => k.startsWith('atlas-camera:'))
          .map((k) => [k, JSON.parse(localStorage.getItem(k))]),
      ),
    }));
    checkpoints.push({ label, state });
    await writeFile(path.join(out, 'pose-checkpoints.json'), JSON.stringify(checkpoints, null, 2));
    return state;
  }
  const snapshots = {};
  async function picture(label) {
    const page = getPage(),
      filename = label + '.png';
    await page.mouse.move(10, 10);
    await viewReady();
    await page.evaluate(() => window.__qaRiverRaster.surface.waitForFrame());
    const sources = await page.evaluate(() => {
      const r = window.__qaRiverRaster,
        checksum = (array) => {
          if (!array) return null;
          const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
          let value = 2166136261;
          for (const byte of bytes) value = Math.imul(value ^ byte, 16777619);
          return (value >>> 0).toString(16);
        };
      return {
        revision: r.revision,
        frameUsable: r.surface.frameUsable,
        samples: [
          { x: 100, y: 12 },
          { x: 300, y: 12 },
          { x: 400, y: 12 },
        ].map((p) => ({ ...p, height: r.height(p) })),
        tiles: r.tiles.map((t) => ({
          tile: t.tile,
          revision: t.revision,
          height: checksum(t.terrain.projection.grid.heights),
          ground: checksum(t.terrain.projection.grid.editing?.ground),
          relief: checksum(t.material.channels.relief),
        })),
        models: r.surface.terrain.map((t) => ({
          id: t.object.id,
          position: checksum(t.mesh.attributes.POSITION.value),
          normal: checksum(t.mesh.attributes.NORMAL.value),
          relief: checksum(t.relief.data),
        })),
      };
    });
    await checkpoint(label);
    await capture(filename);
    const source = PNG.sync.read(await readFile(path.join(out, filename))),
      rect = await page.locator('#campaign-map').boundingBox(),
      dpr = await page.evaluate(() => devicePixelRatio),
      x = Math.round(rect.x * dpr),
      y = Math.round(rect.y * dpr),
      width = Math.round(rect.width * dpr),
      height = Math.round(rect.height * dpr),
      image = new PNG({ width, height });
    for (let row = 0; row < height; row++)
      source.data.copy(
        image.data,
        row * width * 4,
        ((y + row) * source.width + x) * 4,
        ((y + row) * source.width + x + width) * 4,
      );
    await writeFile(path.join(out, label + '-map.png'), PNG.sync.write(image));
    const camera = await page.locator('#campaign-map').getAttribute('data-terrain-projection');
    snapshots[label] = {
      camera: JSON.parse(camera),
      sha256: hash(image.data),
      width,
      height,
      sources,
    };
    await writeFile(path.join(out, 'snapshots.json'), JSON.stringify(snapshots, null, 2));
    return image;
  }
  function hydraulics(river) {
    const samples = riverSamples(api, original, river),
      limit = river.route.limits;
    check(
      'mandatory anchors retained',
      riverAnchors.every((p) =>
        river.route.nodes.some((n) => Math.hypot(p.x - n.x, p.y - n.y) < 1e-8),
      ),
    );
    check('sea endpoint is 0m', river.route.nodes.at(-1).z === 0);
    check(
      'every profile edge falls',
      river.route.nodes.every((p, i, a) => !i || p.z < a[i - 1].z),
    );
    check(
      'continuous sampled water and bed within explicit earthwork budget',
      samples.every(
        (p, i) =>
          Number.isFinite(p.water) &&
          Math.abs(p.water - p.profile) < tolerance &&
          (p.station === 0 ? p.bed <= p.water + tolerance : p.bed < p.water - tolerance) &&
          p.base - p.bed <= limit.cut + tolerance &&
          p.bed - p.base <= tolerance &&
          (!i || p.water < samples[i - 1].water),
      ),
      { count: samples.length, spacingM: 0.25, toleranceM: tolerance, cut: limit.cut },
    );
    const mouth = samples.at(-1);
    check(
      'mouth bed remains submerged without gap',
      mouth.bed < mouth.water && Math.abs(mouth.water) < tolerance,
    );
    return samples;
  }
  await start();
  await checkpoint('initial-ready');
  let page = getPage();
  await page.locator('#atlas-units').selectOption('metric');
  await page.locator('#atlas-section').selectOption('terrain');
  await page.locator('[data-tool-group="water"]').click();
  await page.locator('[data-tool-select="land-tool"][data-tool-value="river"]').click();
  await page.locator('#land-route-plan').click();
  await page.waitForFunction(
    () => document.querySelector('#terrain-route-editor')?.getAttribute('aria-busy') === 'false',
  );
  const clicks = [];
  for (let i = 0; i < riverAnchors.length; i++) {
    const p = riverAnchors[i],
      raw = new api.TerrainSampler(original, false),
      camera = JSON.parse(
        await page.locator('#campaign-map').getAttribute('data-terrain-projection'),
      ),
      rect = await page.locator('#campaign-map').boundingBox(),
      screen = api.projectTerrain(camera, p, Math.max(0, raw.sample(p).heightM)),
      screenPoint = { x: rect.x + screen.x * rect.width, y: rect.y + screen.y * rect.height };
    assert(screen.x > 0 && screen.x < 1 && screen.y > 0 && screen.y < 1, 'Anchor visible');
    await page.mouse.click(screenPoint.x, screenPoint.y);
    await page.waitForFunction(
      (count) => document.querySelectorAll('#route-points li').length === count,
      i + 1,
    );
    const actual = {
      x: Number(await page.locator(`#route-point-x-${i}`).inputValue()),
      y: Number(await page.locator(`#route-point-y-${i}`).inputValue()),
    };
    clicks.push({ requested: p, screen: screenPoint, actual, camera });
    check(
      'mouse anchor ' + i + ' within rendered picking tolerance',
      Math.hypot(p.x - actual.x, p.y - actual.y) < 3,
      clicks.at(-1),
    );
    // Correct the precise mandatory point through the ordinary coordinate fields.
    for (const axis of ['x', 'y']) {
      await page.locator(`#route-point-${axis}-${i}`).fill(String(p[axis]));
      await page.locator(`#route-point-${axis}-${i}`).press('Tab');
    }
  }
  await change('name', name);
  await change('width', 12);
  await action('fit').click();
  if (depression === 12) {
    await page.waitForFunction(
      () =>
        document.querySelector('#terrain-route-editor')?.getAttribute('aria-busy') === 'false' &&
        document.querySelector('#route-status')?.textContent.includes('Kein durchgängiger Abfluss'),
    );
    check(
      'impossible basin refused without canonical or history mutation',
      hash(records()) === hash(original) &&
        cursor() === beforeCursor &&
        (await action('save').isDisabled()),
    );
    await page.locator('#route-status').scrollIntoViewIfNeeded();
    await picture('impossible-basin');
    await editor().getByText('Planungsgrenzen', { exact: true }).click();
    await change('cut', 16);
    check(
      'budget increased only by explicit author input',
      (await page.locator('#route-cut').inputValue()) === '16',
    );
  }
  await ready();
  check(
    'preview remains read-only',
    hash(records()) === hash(original) && cursor() === beforeCursor,
  );
  await pose(false);
  await page.locator('#route-profile').scrollIntoViewIfNeeded();
  await picture('preview-top');
  await pose(true);
  await picture('preview-tilted');
  await save();
  const saved = records(),
    river = saved.find((r) => r.name === name),
    samples = hydraulics(river);
  check(
    'save is one atomic history action',
    cursor() === beforeCursor + 1 && saved.length === original.length + 1,
  );
  check(
    'all original terrain bytes unchanged',
    hash(saved.filter((r) => r.height)) === hash(original.filter((r) => r.height)),
  );
  async function inspectSaved(label) {
    await action('close').click();
    await focus(name);
    await getPage()
      .getByRole('button', { name: 'Verlauf und Gelände bearbeiten', exact: true })
      .click();
    await ready();
    await pose(false);
    await action('fit').click();
    await viewReady();
    const top = await picture(label + '-top');
    await pose(true);
    const tilted = await picture(label + '-tilted');
    return { top, tilted };
  }
  const first = await inspectSaved('saved');
  await page.locator('#atlas-undo').click();
  await waitCursor(beforeCursor);
  await viewReady();
  check(
    'one undo removes river and derived bed',
    cursor() === beforeCursor && hash(records()) === hash(original),
  );
  const rawSampler = new api.TerrainSampler(records());
  check(
    'undo restores sampled base ground',
    samples.every((p) => Math.abs(rawSampler.sample(p).heightM - p.base) < tolerance),
  );
  await picture('undo');
  await page.locator('#atlas-redo').click();
  await waitCursor(beforeCursor + 1);
  await viewReady();
  check(
    'redo restores canonical route and profile exactly',
    hash(clean(records())) === hash(clean(saved)) && cursor() === beforeCursor + 1,
  );
  const redoSamples = riverSamples(
    api,
    original,
    records().find((r) => r.id === river.id),
  );
  check('redo restores effective bed and water exactly', hash(redoSamples) === hash(samples));
  const redo = await inspectSaved('redo');
  if (process.argv.includes('--diagnose-river')) {
    result.complete = false;
    result.riverDiagnostic = { snapshots };
    await action('close').click();
    await close();
    return;
  }
  await action('close').click();
  const closing = await checkpoint('before-normal-close');
  await close();
  await start();
  page = getPage();
  const restored = await checkpoint('restarted-first-ready');
  check(
    'restart preserves stored camera focus',
    Math.abs(closing.pose.focusM - restored.pose.focusM) < 0.0001,
    { closing, restored },
  );
  check(
    'fresh process restores route, profile and untouched terrain',
    hash(clean(records())) === hash(clean(saved)),
  );
  check(
    'fresh process restores derived sample heights',
    hash(
      riverSamples(
        api,
        original,
        records().find((r) => r.id === river.id),
      ),
    ) === hash(samples),
  );
  await focus(name);
  await page.getByRole('button', { name: 'Verlauf und Gelände bearbeiten', exact: true }).click();
  await ready();
  // inspectSaved closes and reopens the editor to reproduce the saved selection.
  const fresh = await inspectSaved('fresh');
  function imageDifference(a, b) {
    assert.equal(a.width, b.width);
    assert.equal(a.height, b.height);
    let different = 0,
      max = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const delta = Math.max(...[0, 1, 2].map((c) => Math.abs(a.data[i + c] - b.data[i + c])));
      max = Math.max(max, delta);
      if (delta > 2) different++;
    }
    return { different, total: a.width * a.height, ratio: different / (a.width * a.height), max };
  }
  for (const label of ['redo-top', 'redo-tilted', 'fresh-top', 'fresh-tilted']) {
    const expected = snapshots[label.endsWith('top') ? 'saved-top' : 'saved-tilted'].camera,
      actual = snapshots[label].camera;
    check(
      'fixed camera pose ' + label,
      ['x', 'y', 'width', 'height'].every(
        (k) => Math.abs(expected.frame[k] - actual.frame[k]) < 0.001,
      ) &&
        ['tilt', 'rotation', 'exaggeration', 'focusM'].every(
          (k) => Math.abs(expected[k] - actual[k]) < 0.0001,
        ),
      { expected, actual },
    );
  }
  const differences = {
    redoTop: imageDifference(first.top, redo.top),
    redoTilted: imageDifference(first.tilted, redo.tilted),
    freshTop: imageDifference(first.top, fresh.top),
    freshTilted: imageDifference(first.tilted, fresh.tilted),
  };
  for (const [label, value] of Object.entries(differences))
    check('fixed camera image ' + label, value.ratio < 0.005, value);
  result.river = {
    scale,
    depression,
    toleranceM: tolerance,
    clicks,
    sampleCount: samples.length,
    samplesHash: hash(samples),
    canonicalHash: hash(clean(saved)),
    snapshots,
    checkpoints,
    differences,
  };
  result.sourceHashes = Object.fromEntries(
    await Promise.all(
      [
        'src/app/atlas/atlas-raster-presentation.ts',
        'src/app/atlas/campaign-atlas-ui.ts',
        'src/app/atlas/terrain-route-ui.ts',
        'src/app/atlas/terrain-route-planner.ts',
        'src/app/atlas/terrain-route.ts',
        'src/app/atlas/route-segment-range.ts',
        'src/app/atlas/terrain-route-clip.ts',
        'tools/test-desktop-terrain-routes.mjs',
        'tools/atlas-river-probe.mjs',
        'tests/helpers/river-terrain.mjs',
      ].map(async (f) => [f, hash(await readFile(f))]),
    ),
  );
  result.runtimeView = await page.evaluate(() => {
    const c = document.querySelector('#atlas-terrain-spatial canvas'),
      gl = c.getContext('webgl2'),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      dpr: devicePixelRatio,
      size: [innerWidth, innerHeight],
      canvas: [c.width, c.height],
      renderer: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
    };
  });
  await action('close').click();
  await close();
}
