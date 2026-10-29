import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';

const root = process.cwd(),
  output =
    process.env.QA_EVIDENCE_DIR ??
    path.resolve('.build/atlas-deck-native', `${Date.now()}-${process.pid}`);
const native = await createNativeSession({ root, output, name: 'atlas-deck' });
const files = [
  'src/app/atlas/atlas-deck-surface.ts',
  'src/app/atlas/atlas-metric-camera.ts',
  'src/app/atlas/atlas-world-tiles.ts',
  'src/app/atlas/atlas-deck-scene-model.ts',
  'src/app/atlas/atlas-scene-geometry.ts',
  'src/app/atlas/atlas-mesh-ray.ts',
  'src/app/atlas/atlas-deck-ray.ts',
  'src/app/atlas/atlas-deck-picking.ts',
  'src/app/atlas/atlas-deck-labels.ts',
  'src/app/atlas/atlas-assets.ts',
  'tools/test-desktop-atlas-deck.mjs',
  'tools/atlas-canonical-fixture.mjs',
  '.build/desktop/ui/atlas-deck-runtime.js',
  '.build/desktop/ui/atlas-fonts/NotoSans-VF.ttf',
  '.build/desktop/ui/atlas-fonts/NotoSansSymbols-VF.ttf',
  'package-lock.json',
];
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        createHash('sha256')
          .update(await readFile(file))
          .digest('hex'),
      ]),
    ),
  );
try {
  const fixture = await createAtlasCanonicalFixture({
      profilePath: native.profile,
      campaignName: 'Metric Atlas qualification',
    }),
    before = await hashes();
  const page = await native.launch();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const setup = await page.evaluate(async (fixture) => {
    const unwrap = (r) => {
      if (!r.ok) throw Error(JSON.stringify(r));
      return r.value;
    };
    const active = unwrap(await window.campaign.activate(fixture.campaignId));
    const runtime = await import('campaign://app/atlas-deck-runtime.js');
    await runtime.preloadAtlasFonts({ base: 'campaign://app/', document });
    const container = document.createElement('div');
    container.id = 'atlas-direct-probe';
    Object.assign(container.style, {
      position: 'fixed',
      left: '20px',
      top: '60px',
      width: '900px',
      height: '650px',
      background: '#d8e0de',
      zIndex: '99999',
    });
    document.body.append(container);
    const load = async (scopeId, floorId, roofs) => {
      const view = unwrap(
        await window.campaign.atlasRegion(
          active.token,
          { ...fixture.query, width: 900, height: 650, scopeId, floorId, roofs },
          'view',
        ),
      );
      const projection = unwrap(
        await window.campaign.atlasTerrainProjection(
          active.token,
          {
            revision: view.revision,
            fence: view.region.fence,
            view: {
              box: fixture.viewBox,
              frame: fixture.viewBox,
              columns: 65,
              rows: 65,
              focusM: 140,
              tilt: 0,
              rotation: 0,
              exaggeration: 1,
            },
            width: 64,
            height: 64,
            contours: 0,
            displayMpp: 1,
            objects: [],
          },
          'view',
        ),
      );
      if (projection.fence !== view.region.fence || projection.revision !== view.revision)
        throw Error('Scene revision mismatch');
      return {
        view,
        projection,
        model: runtime.buildAtlasDeckSceneModel({
          view,
          terrain: projection.grid,
          display: { metersPerPixel: 0.5, roofs, scopeId },
        }),
      };
    };
    const data = await load(null, 'ground', true),
      ownedErrors = [];
    const camera = {
      focus: fixture.buildingAnchor,
      focusHeightM: 145,
      metersPerPixel: 0.5,
      rotation: 37,
      tilt: 55,
      exaggeration: 1,
    };
    const surface = await runtime.AtlasDeckSurface.create({
      container,
      camera,
      model: data.model,
      onError: (e) => ownedErrors.push(e.message),
    });
    window.__direct = { surface, runtime, fixture, data, load, container, ownedErrors, active };
    return {
      targets: data.model.objects.map((o) => o.target),
      coverage: data.model.coverage,
      fonts: document.fonts.check('14px "Atlas Noto Sans"'),
      canvases: container.querySelectorAll('canvas').length,
    };
  }, fixture);
  assert.equal(setup.canvases, 1);
  assert(setup.fonts);
  assert(setup.targets.some((t) => t.kind === 'building'));
  const cameras = await page.evaluate(async () => {
    const f = window.__direct,
      s = f.surface,
      rows = [];
    for (const [rotation, tilt] of [
      [0, 0],
      [37, 55],
      [-143, 75],
    ]) {
      s.setCamera({ ...s.camera, rotation, tilt });
      const stale = s.pick(450, 325);
      await s.waitForFrame();
      // Use the interior of the camera-facing roof facet. An exact apex can
      // fall between GPU sample centers; a radius-zero pick may then correctly
      // return background even though the continuous author ray touches its tip.
      const dx = Math.sin((rotation * Math.PI) / 180) * 2,
        dy = Math.cos((rotation * Math.PI) / 180) * 2;
      const expected = {
        x: 24 + dx,
        y: 24 + dy,
        heightM: 152 - Math.max(Math.abs(dx), Math.abs(dy)) / 2,
      };
      const screen = s.frame.project(expected);
      rows.push({ rotation, tilt, stale, screen, expected, hit: s.pick(screen.x, screen.y) });
    }
    return rows;
  });
  await writeFile(path.join(output, 'camera-debug.json'), JSON.stringify(cameras, null, 2));
  await native.capture(page, 'camera-debug.png');
  for (const row of cameras) {
    assert.equal(row.stale, null);
    assert.equal(row.hit?.target.id, fixture.buildingId, JSON.stringify(row));
    assert(Math.abs(row.hit.point.heightM - row.expected.heightM) < 0.0001, JSON.stringify(row));
  }
  await native.capture(page, 'direct-canonical-hill.png');
  const occlusion = await page.evaluate(async () => {
    const f = window.__direct,
      s = f.surface,
      model = f.data.model;
    s.setCamera({
      ...s.camera,
      focus: { x: 24, y: 24 },
      focusHeightM: 0,
      rotation: 0,
      tilt: 0,
      metersPerPixel: 0.75,
    });
    await s.waitForFrame();
    const room = model.objects.find(
        (o) => o.target.kind === 'room' && o.target.scopeId === 'local',
      ),
      p = room.positions,
      i = room.indices;
    const point = {
      x: room.origin.x + (p[i[0] * 3] + p[i[1] * 3] + p[i[2] * 3]) / 3,
      y: room.origin.y + (p[i[0] * 3 + 1] + p[i[1] * 3 + 1] + p[i[2] * 3 + 1]) / 3,
      heightM: room.origin.heightM + p[i[0] * 3 + 2],
    };
    const screen = s.frame.project(point),
      withTerrain = s.pick(screen.x, screen.y);
    s.setScene({ ...model, objects: model.objects.filter((o) => o.target.kind !== 'terrain') });
    await s.waitForFrame();
    const without = s.pick(screen.x, screen.y);
    s.setScene(model);
    await s.waitForFrame();
    return { withTerrain, without, room: room.target, restored: s.pick(screen.x, screen.y) };
  });
  assert.equal(occlusion.withTerrain?.target.kind, 'terrain', JSON.stringify(occlusion));
  assert.equal(occlusion.without?.target.id, occlusion.room.id);
  assert.equal(occlusion.restored?.target.kind, 'terrain');
  const floors = [];
  for (const [floorId, heightM] of [
    ['ground', 141],
    [fixture.upperFloorId, 145],
  ]) {
    const row = await page.evaluate(
      async ({ floorId, heightM }) => {
        const f = window.__direct,
          s = f.surface,
          data = await f.load(f.fixture.scopeId, floorId, false);
        s.setScene(data.model);
        s.setCamera({
          ...s.camera,
          focus: f.fixture.buildingAnchor,
          focusHeightM: heightM,
          metersPerPixel: 20 / 900,
          rotation: 37,
          tilt: 55,
        });
        await s.waitForFrame();
        const room = data.model.objects.find(
            (o) => o.target.kind === 'room' && o.target.scopeId === f.fixture.scopeId,
          ),
          p = room.positions,
          i = room.indices;
        const point = {
          x: room.origin.x + (p[i[0] * 3] + p[i[1] * 3] + p[i[2] * 3]) / 3,
          y: room.origin.y + (p[i[0] * 3 + 1] + p[i[1] * 3 + 1] + p[i[2] * 3 + 1]) / 3,
          heightM,
        };
        s.setCamera({ ...s.camera, focus: point });
        await s.waitForFrame();
        const checks = [];
        for (const exaggeration of [0.25, 1, 8]) {
          s.setCamera({ ...s.camera, exaggeration });
          await s.waitForFrame();
          const screen = s.frame.project(point);
          checks.push({ exaggeration, hit: s.pick(screen.x, screen.y) });
        }
        f.inside = data;
        return { floorId, room: room.target, point, checks };
      },
      { floorId, heightM },
    );
    for (const c of row.checks) {
      assert.equal(c.hit?.target.id, row.room.id, JSON.stringify(row));
      assert(Math.abs(c.hit.point.heightM - heightM) < 0.0001, JSON.stringify(row));
    }
    floors.push(row);
  }
  await native.capture(page, 'direct-upper-room.png');
  const scales = await page.evaluate(async () => {
    const f = window.__direct,
      s = f.surface,
      rows = [];
    // Each scale has a genuinely visible, pickable mesh. These are deliberately
    // derived scale fixtures, not a claim of complete authored world coverage.
    for (const [name, span] of [
      ['world', 40e6],
      ['continent', 16e6],
      ['kingdom', 4e6],
      ['city', 3000],
      ['interior', 20],
    ]) {
      const mpp = span / 900,
        size = mpp * 40,
        objects = [],
        expected = [];
      for (const [kind, offset] of [
        ['building', -150],
        ['room', 0],
        ['terrain', 150],
      ]) {
        const target =
          kind === 'terrain'
            ? { kind }
            : {
                kind,
                id: `scale-${kind}-${name}`,
                scopeId: 'scale',
                floorId: 'ground',
                cityId: 'scale-city',
              };
        const centerX = 70e6 + offset * mpp,
          top = kind === 'building' ? 145 + size : 145;
        const positions = new Float32Array([
          -size,
          -size,
          top - 256,
          size,
          -size,
          top - 256,
          size,
          size,
          top - 256,
          -size,
          size,
          top - 256,
          -size,
          -size,
          145 - 256,
          size,
          -size,
          145 - 256,
          size,
          size,
          145 - 256,
          -size,
          size,
          145 - 256,
        ]);
        const indices = new Uint32Array(
          kind === 'building'
            ? [
                0, 1, 2, 0, 2, 3, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3,
                4, 0,
              ]
            : [0, 1, 2, 0, 2, 3],
        );
        const object = {
          id: `scale:${kind}:${name}`,
          target,
          origin: { x: centerX, y: -90e6, heightM: 256 },
          positions,
          indices,
        };
        objects.push(object);
        expected.push({ id: object.id, kind, x: centerX, y: -90e6, heightM: 256 + positions[2] });
      }
      const model = {
        objects,
        targets: new Map(objects.map((o) => [o.id, o.target])),
        coverage: {
          complete: true,
          supportedKinds: ['terrain', 'building', 'room'],
          unsupported: [],
        },
        verticalExaggeration: 1,
      };
      s.setScene(model);
      s.setCamera({
        focus: { x: 70e6, y: -90e6 },
        focusHeightM: 145,
        metersPerPixel: mpp,
        rotation: 37,
        tilt: 55,
        exaggeration: 1,
      });
      await s.waitForFrame();
      const picks = expected.map((point) => {
        const screen = s.frame.project(point);
        return { expected: point, screen, hit: s.pick(screen.x, screen.y) };
      });
      rows.push({
        name,
        span,
        picks,
        bufferKept: objects.every(
          (object, i) =>
            s.deckValue.props.layers[i].props.mesh.attributes.POSITION.value === object.positions,
        ),
      });
    }
    return rows;
  });
  for (const row of scales) {
    assert(row.bufferKept);
    for (const pick of row.picks) {
      assert.equal(pick.hit?.id, pick.expected.id, JSON.stringify(row));
      assert(Math.abs(pick.hit.point.x - pick.expected.x) < 0.0001, JSON.stringify(pick));
      assert(Math.abs(pick.hit.point.y - pick.expected.y) < 0.0001, JSON.stringify(pick));
      assert(
        Math.abs(pick.hit.point.heightM - pick.expected.heightM) < 0.0001,
        JSON.stringify(pick),
      );
    }
  }
  const prepared = await page.evaluate(async () => {
    const f = window.__direct,
      s = f.surface;
    const shifted = {
      ...f.data.model,
      objects: f.data.model.objects.map((o) => ({
        ...o,
        origin: { ...o.origin, x: o.origin.x + 232, y: o.origin.y + 232 },
      })),
    };
    s.setScene(shifted);
    s.setCamera({
      focus: { x: 255.8, y: 255.8 },
      focusHeightM: 145,
      metersPerPixel: 0.5,
      rotation: 0,
      tilt: 0,
      exaggeration: 1,
    });
    await s.waitForFrame();
    f.originalCanvas = s.canvas;
    f.buffers = shifted.objects.map((o) => o.positions);
    f.gpuModels = s.deckValue.props.layers.map((l) => l.state.model);
    f.oldOrigin = s.frame.origin;
    return { origin: s.frame.origin, camera: s.camera };
  });
  const box = await page.locator('#atlas-direct-probe canvas').boundingBox();
  await page.mouse.move(box.x + 450, box.y + 325);
  await page.mouse.down();
  await page.mouse.move(box.x + 425, box.y + 300, { steps: 5 });
  const crossing = await page.evaluate(async () => {
    const f = window.__direct,
      s = f.surface;
    await s.waitForFrame();
    const p = s.frame.project({ x: 256, y: 256, heightM: 152 });
    return {
      camera: s.camera,
      origin: s.frame.origin,
      oldOrigin: f.oldOrigin,
      sameCanvas: s.canvas === f.originalCanvas,
      buffers: s.model.objects.every((o, i) => o.positions === f.buffers[i]),
      gpuModels: s.deckValue.props.layers.every((l, i) => l.state.model === f.gpuModels[i]),
      hit: s.pick(p.x, p.y),
      drag: !!s.drag,
    };
  });
  await page.mouse.up();
  assert(crossing.drag);
  assert(
    crossing.origin.x !== prepared.origin.x && crossing.origin.y !== prepared.origin.y,
    JSON.stringify(crossing),
  );
  assert(crossing.sameCanvas && crossing.buffers && crossing.gpuModels, JSON.stringify(crossing));
  assert.equal(crossing.hit?.target.id, fixture.buildingId);
  await page.mouse.wheel(0, -120);
  await page.waitForFunction(() => window.__direct.surface.camera.metersPerPixel < 0.5);
  const lifecycle = await page.evaluate(async () => {
    const f = window.__direct,
      s = f.surface;
    await s.waitForFrame();
    f.container.style.width = '800px';
    f.container.style.height = '580px';
    s.resize();
    const stale = s.pick(400, 290);
    await s.waitForFrame();
    const camera = s.camera,
      buffers = s.model.objects.map((o) => o.positions),
      canvas = s.canvas;
    const gl = canvas.getContext('webgl2'),
      extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) throw Error('Context loss extension missing');
    extension.loseContext();
    await new Promise((resolve, reject) => {
      let n = 0;
      const poll = () => {
        if (s.canvas !== canvas && s.frameUsable) resolve();
        else if (n++ > 600) reject(Error('GPU recovery timed out'));
        else requestAnimationFrame(poll);
      };
      poll();
    });
    const p = s.frame.project({ x: 256, y: 256, heightM: 152 });
    const png = s.canvas.toDataURL('image/png');
    return {
      stale,
      width: s.frame.width,
      height: s.frame.height,
      camera,
      savedCamera: s.camera,
      canvases: f.container.querySelectorAll('canvas').length,
      buffers: s.model.objects.every((o, i) => o.positions === buffers[i]),
      hit: s.pick(p.x, p.y),
      png,
      errors: f.ownedErrors,
    };
  });
  assert.equal(lifecycle.stale, null);
  assert.equal(lifecycle.width, 800);
  assert.equal(lifecycle.height, 580);
  assert.deepEqual(lifecycle.camera, lifecycle.savedCamera);
  assert.equal(lifecycle.canvases, 1);
  assert(lifecycle.buffers);
  assert.equal(lifecycle.hit?.target.id, fixture.buildingId);
  assert.deepEqual(lifecycle.errors, []);
  await writeFile(
    path.join(output, 'direct-canvas-export.png'),
    Buffer.from(lifecycle.png.split(',')[1], 'base64'),
  );
  delete lifecycle.png;
  const labels = await page.evaluate(async () => {
    const f = window.__direct,
      s = f.surface;
    const gl = s.canvas.getContext('webgl2'),
      beforePixels = new Uint8Array(s.canvas.width * s.canvas.height * 4);
    gl.readPixels(0, 0, s.canvas.width, s.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, beforePixels);
    s.setLabels([
      {
        candidate: {
          id: 'place',
          text: 'Hügelwacht – Ελληνικά',
          kind: 'city',
          point: { x: 256, y: 256 },
          rank: 5,
        },
        heightM: 152,
      },
      {
        candidate: {
          id: 'duplicate',
          text: 'Überlappend',
          kind: 'city',
          point: { x: 256, y: 256 },
          rank: 0,
        },
        heightM: 152,
      },
    ]);
    await s.waitForFrame();
    await new Promise((r) => setTimeout(r, 300));
    const layer = s.deckValue.props.layers.at(-1),
      placements = layer.props.data;
    const afterPixels = new Uint8Array(beforePixels.length);
    gl.readPixels(0, 0, s.canvas.width, s.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, afterPixels);
    let changedPixels = 0;
    for (let i = 0; i < beforePixels.length; i += 4)
      if (
        beforePixels[i] !== afterPixels[i] ||
        beforePixels[i + 1] !== afterPixels[i + 1] ||
        beforePixels[i + 2] !== afterPixels[i + 2]
      )
        changedPixels++;
    return {
      texts: placements.map((p) => p.label.candidate.text),
      family: layer.props.fontFamily,
      changedPixels,
      canvases: f.container.querySelectorAll('canvas').length,
    };
  });
  assert(labels.changedPixels > 200, JSON.stringify(labels));
  assert(labels.texts.includes('Hügelwacht – Ελληνικά'));
  assert.equal(labels.family, 'Atlas Noto Sans');
  assert.equal(labels.canvases, 1);
  await native.capture(page, 'direct-labels.png');
  const cleanup = await page.evaluate(() => {
    const f = window.__direct;
    f.surface.dispose();
    f.surface.dispose();
    const canvases = f.container.querySelectorAll('canvas').length;
    f.container.remove();
    delete window.__direct;
    return { canvases };
  });
  assert.equal(cleanup.canvases, 0);
  assert.deepEqual(errors, []);
  const after = await hashes();
  assert.deepEqual(after, before);
  await native.close();
  // Fresh native process reopens the saved canonical campaign after disposal
  // and context recovery. This is persistence evidence, not a new author tool.
  const fresh = await native.launch();
  const reopened = await fresh.evaluate(async (fixture) => {
    const unwrap = (r) => {
      if (!r.ok) throw Error(JSON.stringify(r));
      return r.value;
    };
    const active = unwrap(await window.campaign.activate(fixture.campaignId));
    const view = unwrap(
      await window.campaign.atlasRegion(
        active.token,
        { ...fixture.query, width: 900, height: 650 },
        'view',
      ),
    );
    const projection = unwrap(
      await window.campaign.atlasTerrainProjection(
        active.token,
        {
          revision: view.revision,
          fence: view.region.fence,
          view: {
            box: fixture.viewBox,
            frame: fixture.viewBox,
            columns: 65,
            rows: 65,
            focusM: 140,
            tilt: 0,
            rotation: 0,
            exaggeration: 1,
          },
          width: 64,
          height: 64,
          contours: 0,
          displayMpp: 1,
          objects: [],
        },
        'view',
      ),
    );
    const runtime = await import('campaign://app/atlas-deck-runtime.js');
    const model = runtime.buildAtlasDeckSceneModel({
      view,
      terrain: projection.grid,
      display: { metersPerPixel: 0.5, roofs: true, scopeId: null },
    });
    const building = model.objects.find(
      (o) => o.target.kind === 'building' && o.target.id === fixture.buildingId,
    );
    let maxHeight = -Infinity;
    for (let i = 2; i < building.positions.length; i += 3)
      maxHeight = Math.max(maxHeight, building.origin.heightM + building.positions[i]);
    return {
      targets: model.objects.map((o) => o.target),
      maxHeight,
      revision: view.revision,
      fence: view.region.fence,
    };
  }, fixture);
  assert.deepEqual(reopened.targets, setup.targets);
  assert.equal(reopened.maxHeight, 152);
  assert.equal(reopened.revision, fixture.sourceRevision);
  await native.close();
  await native.finish({
    complete: true,
    scope:
      'Direct metric renderer on canonical preload data and explicit scale fixtures; not complete Atlas product or target-device acceptance.',
    fixture,
    setup,
    cameras,
    occlusion,
    floors,
    scales,
    crossing,
    lifecycle,
    labels,
    cleanup,
    reopened,
    errors,
    hashes: { before, after },
  });
  console.log(JSON.stringify({ complete: true, output }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
