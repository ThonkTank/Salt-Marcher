import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
const root = process.cwd(),
  output =
    process.env.QA_EVIDENCE_DIR ??
    path.resolve('.build/atlas-raster-gpu-native', `${Date.now()}-${process.pid}`);
const native = await createNativeSession({ root, output, name: 'atlas-raster-gpu' });
try {
  const runtimeHash = async () =>
    createHash('sha256')
      .update(await readFile(path.join(root, '.build/desktop/ui/atlas-deck-runtime.js')))
      .digest('hex');
  const runtimeSha256 = await runtimeHash();
  const fixture = await createAtlasCanonicalFixture({
    profilePath: native.profile,
    campaignName: 'Raster GPU qualification',
  });
  let page = await native.launch();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.text().includes('GL_INVALID')) errors.push(m.text());
  });
  const result = await page.evaluate(async (fixture) => {
    const unwrap = (r) => {
      if (!r.ok) throw Error(JSON.stringify(r));
      return r.value;
    };
    const active = unwrap(await window.campaign.activate(fixture.campaignId));
    const revision = unwrap(await window.campaign.atlasTerrainSource(active.token)).revision;
    const runtime = await import('campaign://app/atlas-deck-runtime.js');
    const request = { tile: { lod: -2, x: 0, y: 0 }, revision };
    const terrain = unwrap(
      await window.campaign.atlasTerrainTile(active.token, { ...request, product: 'height' }),
    );
    const material = unwrap(await window.campaign.atlasMaterialTile(active.token, request));
    const container = document.createElement('div');
    container.id = 'raster-gpu';
    Object.assign(container.style, {
      position: 'fixed',
      left: '20px',
      top: '60px',
      width: '800px',
      height: '600px',
      zIndex: '99999',
      background: '#d8e0de',
    });
    document.body.append(container);
    const surface = await runtime.AtlasDeckSurface.create({
      container,
      camera: {
        focus: { x: 32, y: 32 },
        focusHeightM: 40,
        metersPerPixel: 0.14,
        rotation: 0,
        tilt: 40,
        exaggeration: 0.25,
      },
      model: {
        objects: [],
        targets: new Map(),
        coverage: { complete: true, supportedKinds: ['terrain'], unsupported: [] },
        verticalExaggeration: 1,
      },
      onError: (e) => console.error(e.stack ?? e.message),
    });
    const style = {
      version: 1,
      mode: 'shaded',
      land: '#eee5cf',
      ink: '#685639',
      lightDegrees: 315,
      strength: 0.65,
      mountains: true,
      snowlineM: 100,
    };
    const stream = new runtime.AtlasSurfaceTileStream();
    const frames = [];
    await stream.load(
      {
        box: { x: 0, y: 0, width: 64, height: 64 },
        metersPerPixel: 0.25,
        revision,
        source: terrain.fence,
      },
      runtime.atlasSurfaceTileFetcher(window.campaign, active.token, crypto.randomUUID()),
      (frame) => {
        frames.push({ tiles: frame.tiles.length, complete: frame.complete });
        surface.setTerrain(
          frame.tiles.map((pair) => runtime.atlasTerrainTileModel(pair.terrain, pair.material)),
          style,
        );
      },
    );
    await surface.waitForFrame();
    if (!frames.at(-1).complete) throw Error('Incomplete surface stream');
    // Retain the exact displayed tile/model for uniform and picking checks.
    const displayed = surface.terrain[0];
    await new Promise((resolve, reject) => {
      let n = 0;
      const check = () => {
        if (surface.deckValue.props.layers.every((layer) => layer.isLoaded)) resolve();
        else if (++n > 300) reject(Error('Terrain layer not loaded'));
        else requestAnimationFrame(check);
      };
      check();
    });
    surface.deckValue.redraw(true);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const capture = () => {
      const gl = surface.canvas.getContext('webgl2'),
        pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
      return pixels;
    };
    const before = capture(),
      gpuModel = surface.deckValue.props.layers[0].state.model,
      positions = displayed.object.positions;
    surface.setTerrain([displayed], { ...style, snowlineM: -300 });
    await surface.waitForFrame();
    const after = capture();
    let changed = 0;
    for (let i = 0; i < before.length; i += 4)
      if (
        before[i] !== after[i] ||
        before[i + 1] !== after[i + 1] ||
        before[i + 2] !== after[i + 2]
      )
        changed++;
    const sameGpuModel = surface.deckValue.props.layers[0].state.model === gpuModel;
    surface.setCamera({ ...surface.camera, rotation: 30, exaggeration: 0.5, metersPerPixel: 0.3 });
    await surface.waitForFrame();
    const screen = surface.frame.project({ x: 24, y: 24, heightM: 140 }),
      hit = surface.pick(screen.x, screen.y);
    window.__rasterGpu = { surface, model: displayed, terrain, material, style, stream, runtime };
    return {
      changed,
      sameGpuModel,
      samePositions: positions === displayed.object.positions,
      frames,
      hit,
      heightSum: terrain.projection.grid.heights.reduce((a, b) => a + b, 0),
      materialCache: material.cache,
    };
  }, fixture);
  assert(result.changed > 100, JSON.stringify(result));
  assert(result.sameGpuModel);
  assert(result.samePositions);
  assert.equal(result.hit?.target.kind, 'terrain');
  await native.capture(page, 'material-snow-and-relief.png');
  const contours = await page.evaluate(async () => {
    const { surface, model, style } = window.__rasterGpu;
    surface.setCamera({ ...surface.camera, tilt: 0, exaggeration: 1 });
    surface.setTerrain([model], { ...style, mode: 'height' }, { contours: 10, seaLevelM: 0 });
    await surface.waitForFrame();
    return { loaded: surface.frameUsable, modelRetained: surface.terrain[0] === model };
  });
  assert(contours.loaded && contours.modelRetained);
  await native.capture(page, 'height-analysis-contours.png');
  const patch = await page.evaluate(async () => {
    const { surface, terrain, material, style, runtime } = window.__rasterGpu;
    surface.setTerrain([runtime.atlasTerrainTileModel(terrain, material)], style);
    await surface.waitForFrame();
    const layer = () => surface.deckValue.props.layers[0],
      state = layer().state,
      model = state.model,
      geometry = state.atlasGeometry;
    const texture = state.atlasBaseTexture,
      masks = state.atlasMaskTexture;
    const baseColor = material.channels.baseColor.slice();
    for (let y = 100; y < 110; y++)
      for (let x = 100; x < 110; x++) baseColor.set([255, 0, 120, 255], (y * 256 + x) * 4);
    const colored = { ...material, channels: { ...material.channels, baseColor } };
    surface.setTerrain([runtime.atlasTerrainTileModel(terrain, colored)], style);
    await surface.waitForFrame();
    const colorRetained =
      layer().state.model === model &&
      layer().state.atlasGeometry === geometry &&
      layer().state.atlasBaseTexture === texture &&
      layer().state.atlasMaskTexture === masks;
    const grid = terrain.projection.grid,
      heights = grid.heights.slice();
    heights[32 * 65 + 32] += 4;
    const raised = {
      ...terrain,
      projection: { ...terrain.projection, grid: { ...grid, heights } },
    };
    const next = runtime.atlasTerrainTileModel(raised, colored);
    surface.setTerrain([next], style);
    await surface.waitForFrame();
    const heightRetained =
      layer().state.model === model &&
      layer().state.atlasGeometry === geometry &&
      layer().state.atlasBaseTexture === texture &&
      layer().state.atlasMaskTexture === masks;
    window.__rasterGpu.model = next;
    return {
      colorRetained,
      heightRetained,
      hasGeometry: !!geometry,
      hasTexture: !!texture,
      hasMasks: !!masks,
    };
  });
  assert(
    patch.colorRetained &&
      patch.heightRetained &&
      patch.hasGeometry &&
      patch.hasTexture &&
      patch.hasMasks,
    JSON.stringify(patch),
  );
  await native.capture(page, 'local-buffer-patch.png');
  const recovery = await page.evaluate(async () => {
    const { surface } = window.__rasterGpu,
      old = surface.canvas,
      pose = surface.camera;
    const capture = () => {
      const gl = surface.canvas.getContext('webgl2'),
        bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bytes,
      );
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
      return bytes;
    };
    const before = capture(),
      beforeSize = [surface.canvas.width, surface.canvas.height];
    await surface.recover();
    const after = capture(),
      afterSize = [surface.canvas.width, surface.canvas.height];
    return {
      beforeSize,
      afterSize,
      newCanvas: surface.canvas !== old,
      canvases: document.querySelectorAll('#raster-gpu canvas').length,
      sameCamera: JSON.stringify(surface.camera) === JSON.stringify(pose),
      samePixels: before.length === after.length && before.every((v, i) => v === after[i]),
      changedBytes: before.reduce((n, v, i) => n + (v !== after[i] ? 1 : 0), 0),
    };
  });
  assert(
    recovery.newCanvas && recovery.canvases === 1 && recovery.sameCamera && recovery.samePixels,
    JSON.stringify(recovery),
  );
  await page.evaluate(() => {
    window.__rasterGpu.stream.dispose();
    window.__rasterGpu.surface.dispose();
  });
  await native.close();
  assert.deepEqual(errors, []);
  page = await native.launch();
  const reopen = await page.evaluate(async (fixture) => {
    const unwrap = (r) => {
      if (!r.ok) throw Error(r.error);
      return r.value;
    };
    const active = unwrap(await window.campaign.activate(fixture.campaignId)),
      source = unwrap(await window.campaign.atlasTerrainSource(active.token));
    const request = { tile: { lod: -2, x: 0, y: 0 }, revision: source.revision };
    const terrain = unwrap(
      await window.campaign.atlasTerrainTile(active.token, { ...request, product: 'height' }),
    );
    const material = unwrap(await window.campaign.atlasMaterialTile(active.token, request));
    return {
      heightCache: terrain.cache,
      materialCache: material.cache,
      heightSum: terrain.projection.grid.heights.reduce((a, b) => a + b, 0),
    };
  }, fixture);
  assert.equal(reopen.heightCache, 'hit');
  assert(Object.values(reopen.materialCache).every((v) => v === 'hit'));
  assert.equal(reopen.heightSum, result.heightSum);
  await native.close();
  assert.equal(await runtimeHash(), runtimeSha256);
  await native.finish({
    runtimeSha256,
    result,
    contours,
    patch,
    recovery,
    reopen,
    errors,
    complete: true,
    scope: 'Isolated GPU material and canonical tile bridge; not Workbench tool qualification.',
  });
  console.log(output);
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
