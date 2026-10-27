import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { runNativeProbe } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
import { qualifyBiomeLibrary } from './atlas-biome-library-probe.mjs';
import { qualifyBiomeEarth, writeBiomeOverview } from './atlas-biome-earth-probe.mjs';
import { setBrushWorldRadius } from './atlas-brush-probe.mjs';

const root = process.cwd();
const earthOnly = process.argv.includes('--earth-only');
const library = process.argv.includes('--library') || earthOnly;
const marshOnly = process.argv.includes('--marsh-only');
const surfaceOnly = process.argv.includes('--surface-only');
const scale = Number(process.argv.find((a) => a.startsWith('--scale='))?.split('=')[1] ?? 1);
assert([1, 2].includes(scale));
const output = path.resolve(
  library ? '.build/cycle2-point2/native' : '.build/cycle2-point1/native',
  `${Date.now()}-${process.pid}`,
);
await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url),
  Database = require('better-sqlite3');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const bundle = await build({
  stdin: {
    contents:
      "export {brushFootprint} from './src/app/atlas/landscape-brush';export {contains,segmentDistance,bounds} from './src/app/atlas/landscape-geometry';export {vegetationSpec,vegetationEnvironment,generateVegetation} from './src/app/atlas/vegetation';export {vegetationGeometry} from './src/app/atlas/vegetation-geometry';export {vegetationCrownScale} from './src/app/atlas/vegetation-lod';",
    resolveDir: root,
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const {
  brushFootprint,
  contains,
  segmentDistance,
  bounds,
  vegetationSpec,
  vegetationEnvironment,
  generateVegetation,
  vegetationGeometry,
  vegetationCrownScale,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
);
const sources = [
  'tools/test-desktop-atlas-biome-stroke.mjs',
  'tools/atlas-biome-library-probe.mjs',
  'tools/atlas-biome-earth-probe.mjs',
  'src/app/atlas/terrain-field-stream.ts',
  'src/app/atlas/terrain-material.ts',
  'src/app/atlas/terrain-projection-cache.ts',
  'src/app/atlas/atlas-terrain-tile-model.ts',
  'src/app/atlas/atlas-terrain-material-layer.ts',
  'src/app/storage/atlas-material-tiles.ts',
  'src/app/atlas/vegetation-projection.ts',
  'src/app/atlas/vegetation-view.ts',
  'src/app/atlas/vegetation-lod.ts',
  'src/app/atlas/atlas-deck-vegetation.ts',
  'src/app/atlas/vegetation-controls.ts',
  'src/app/atlas/atlas-raster-kernel.ts',
  'tools/atlas-canonical-fixture.mjs',
  'src/app/atlas/atlas-landscape-ui.ts',
  'src/app/atlas/atlas-deck-surface.ts',
  'src/app/atlas/vegetation.ts',
  'src/app/atlas/vegetation-surface.ts',
  'src/app/atlas/vegetation-shape.ts',
  'src/app/atlas/vegetation-geometry.ts',
  'src/app/atlas/landscape-raster.ts',
  'src/app/atlas/atlas-cartographic-style.ts',
  'src/app/atlas/atlas-raster-presentation.ts',
];
const sourceHashes = Object.fromEntries(
  await Promise.all(sources.map(async (p) => [p, sha(await readFile(p))])),
);
const results = {
  scale,
  scope: earthOnly
    ? 'biome-earth-upper-bound'
    : library
      ? marshOnly
        ? 'marsh-vertical'
        : 'biome-library-scales'
      : surfaceOnly
        ? 'surface-only'
        : 'full',
  wheelGestures: [],
  node: process.version,
  sourceHashes,
  checks: {},
  strokes: [],
  observations: [],
};
const check = (name, passed, detail = {}) => {
  results.checks[name] = { passed, ...detail };
  // Keep the first complete vertical workflow even when a qualification assertion fails.
};
const save = () =>
  writeFile(path.join(output, 'observations.json'), JSON.stringify(results, null, 2));
const area = (polygons) =>
  polygons.reduce(
    (sum, p) =>
      sum + Math.abs(ringArea(p.outer)) - p.holes.reduce((n, h) => n + Math.abs(ringArea(h)), 0),
    0,
  );
function ringArea(r) {
  return (
    r.reduce((s, a, n) => {
      const b = r[(n + 1) % r.length];
      return s + a.x * b.y - b.x * a.y;
    }, 0) / 2
  );
}
const canonical = (rs) =>
  rs.map(({ revision, vegetationView, ...r }) => r).sort((a, b) => a.id.localeCompare(b.id));
const byId = (a) => [...a].sort((a, b) => a.id.localeCompare(b.id));
const margin = (p, polygons) =>
  Math.min(
    ...polygons.flatMap((poly) =>
      [poly.outer, ...poly.holes].flatMap((ring) =>
        ring.map((a, i) => segmentDistance(p, a, ring[(i + 1) % ring.length])),
      ),
    ),
  );

try {
  await runNativeProbe({ root, output, name: 'atlas-biome-stroke' }, async (native) => {
    const fixture = await createAtlasCanonicalFixture({
      profilePath: native.profile,
      campaignName: 'Biome Stroke',
      includeCity: false,
      includeRoom: false,
      baseHeightM: 30,
      peakRiseM: 0,
      flatTileSizeM: earthOnly ? 67108864 : 512,
    });
    results.fixture = fixture;
    const { CampaignStore: fixtureStore, heightRecord: fixtureHeightRecord } = require(
      path.join(root, '.build/atlas-canonical-fixture/store.cjs'),
    );
    if (library && !earthOnly) {
      const store = new fixtureStore(fixture.filename),
        token = store.activate(fixture.campaignId).token;
      try {
        for (const [id, y, waterLevelM] of [
          ['shallow', -20, 30.25],
          ['deep', 40, 32],
        ])
          store.executeAtlasCommit({
            commandId: crypto.randomUUID(),
            campaignId: fixture.campaignId,
            token,
            action: {
              kind: 'landscape-put',
              expectedRevision: null,
              record: {
                id,
                revision: 0,
                kind: 'patch',
                name: id,
                points: [],
                width: 0,
                resolution: 1,
                values: {},
                surface: 'freshwater',
                waterLevelM,
                polygons: [
                  {
                    outer: [
                      { x: -220, y },
                      { x: -140, y },
                      { x: -140, y: y + 60 },
                      { x: -220, y: y + 60 },
                    ],
                    holes: [],
                  },
                ],
              },
            },
          });
      } finally {
        store.close();
      }
    }
    if (earthOnly)
      writeBiomeOverview({
        fixture,
        fixtureStore,
        fixtureHeightRecord,
        vegetationSpec,
        side: 33554432,
        heightPixelSize: 0,
        smallPatch: true,
      });
    let page;
    const query = () => {
      const db = new Database(fixture.filename, { readonly: true });
      try {
        return {
          ...db
            .prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?')
            .get(fixture.campaignId),
          records: db
            .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY rowid')
            .all(fixture.campaignId)
            .map((r) => JSON.parse(r.payload)),
        };
      } finally {
        db.close();
      }
    };
    async function ready() {
      const revision = query().revision;
      await page.waitForFunction(
        (revision) => {
          const m = document.querySelector('#campaign-map'),
            r = window.__qaRaster;
          return (
            m?.dataset.terrainQuality === 'detail' &&
            Number(m.dataset.terrainRevision) >= revision &&
            r?.tiles.length &&
            r.tiles.every((t) => t.revision >= revision) &&
            !document.querySelector('#land-tool').disabled
          );
        },
        revision,
        { timeout: 90000 },
      );
      await page.evaluate(() =>
        Promise.race([
          window.__qaRaster.surface.waitForFrame(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Atlas frame did not complete within 60 seconds')),
              60000,
            ),
          ),
        ]),
      );
    }
    async function open() {
      page = await native.launch(scale);
      const code = await readFile(path.join(root, '.build/desktop/ui/renderer.js'), 'utf8');
      const offset = code.indexOf(
        'this.surface.setTerrain(',
        code.indexOf('var AtlasRasterPresentation = class'),
      );
      assert(offset > 0, 'Read-only presentation binding exists');
      const session = await page.context().newCDPSession(page);
      await session.send('Debugger.enable');
      const bp = await session.send('Debugger.setBreakpointByUrl', {
        urlRegex: 'renderer\\.js$',
        lineNumber: code.slice(0, offset).split('\n').length - 1,
      });
      session.once('Debugger.paused', async (e) => {
        try {
          await session.send('Debugger.evaluateOnCallFrame', {
            callFrameId: e.callFrames[0].callFrameId,
            expression: 'globalThis.__qaRaster = this',
          });
          await session.send('Debugger.removeBreakpoint', { breakpointId: bp.breakpointId });
        } finally {
          await session.send('Debugger.resume');
          await session.send('Debugger.disable');
        }
      });
      page.on('console', (m) => {
        if (m.type() === 'error') native.errors.push(m.text());
      });
      await native.app.evaluate(
        ({ BrowserWindow }, factor) =>
          BrowserWindow.getAllWindows()[0].setContentSize(1920 * factor, 1080 * factor),
        scale,
      );
      await page.evaluate(
        ({ id, earthOnly }) =>
          localStorage.setItem(
            'atlas-camera:' + id,
            JSON.stringify(
              earthOnly
                ? { x: -19000000, y: -12000000, width: 38000000, height: 24000000 }
                : { x: -260, y: -200, width: 520, height: 400 },
            ),
          ),
        { id: fixture.campaignId, earthOnly },
      );
      await page.reload();
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      await page
        .locator('.campaign-card')
        .filter({ hasText: fixture.campaignName })
        .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
        .click();
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
      if (await page.locator('#campaign-atlas').isHidden()) {
        if (!(await page.locator('#atlas-tab').isVisible()))
          await page.locator('#workspace-nav-summary').click();
        await page.locator('#atlas-tab').click();
      }
      await page.waitForFunction(() => !!window.__qaRaster);
      await page.locator('#atlas-section').selectOption('terrain');
      await page.locator('[data-tool-group="vegetation"]').click();
      await page.locator('[data-tool-select="land-tool"][data-tool-value="vegetation"]').click();
      await page.locator('#atlas-units').selectOption('metric');
      await ready();
      results.runtime = await page.evaluate(() => {
        const c = document.querySelector('#atlas-terrain-spatial canvas'),
          gl = c.getContext('webgl2'),
          info = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          dpr: devicePixelRatio,
          size: [innerWidth, innerHeight],
          canvas: [c.width, c.height],
          renderer: info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
          vendor: info && gl.getParameter(info.UNMASKED_VENDOR_WEBGL),
          camera: window.__qaRaster.cameraPose(),
        };
      });
      await page.evaluate(() => {
        const r = window.__qaRaster,
          original = r.point.bind(r);
        window.__qaGesturePoints = [];
        r.point = (e) => {
          const p = original(e);
          if (e.buttons || e.type === 'pointerdown' || e.type === 'pointerup')
            window.__qaGesturePoints.push({
              type: e.type ?? 'coalesced',
              ...p,
              clientX: e.clientX,
              clientY: e.clientY,
            });
          return p;
        };
      });
    }
    async function project(point) {
      return page.evaluate((p) => {
        const r = window.__qaRaster,
          a = r.surface.frame.project({ ...p, heightM: 30 }),
          box = document.querySelector('#campaign-map').getBoundingClientRect();
        return { x: box.x + a.x, y: box.y + a.y, visible: a.visible };
      }, point);
    }
    async function frame(points = []) {
      return page.evaluate((points) => {
        const r = window.__qaRaster;
        const tiles = r.tiles.map((t) => ({
          tile: t.tile,
          view: t.terrain.projection.grid.view.box,
          revision: t.revision,
          fence: t.fence,
        }));
        const samples = points.map((p) => {
          const t = r.tiles
            .filter((t) => {
              const b = t.terrain.projection.grid.view.box;
              return p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
            })
            .sort(
              (a, b) =>
                a.terrain.projection.grid.view.box.width - b.terrain.projection.grid.view.box.width,
            )[0];
          if (!t) throw Error('No loaded material sample at ' + JSON.stringify(p));
          const b = t.terrain.projection.grid.view.box,
            n =
              Math.min(255, Math.floor(((p.y - b.y) / b.height) * 256)) * 256 +
              Math.min(255, Math.floor(((p.x - b.x) / b.width) * 256));
          return {
            p,
            material: Object.fromEntries(
              Object.entries(t.material.channels).map(([k, v]) => {
                const stride = v.length / (256 * 256);
                return [k, Array.from(v.slice(n * stride, (n + 1) * stride))];
              }),
            ),
          };
        });
        return {
          camera: { ...r.cameraPose(), metersPerPixel: r.surface.frame.camera.metersPerPixel },
          tiles,
          samples,
        };
      }, points);
    }
    function materialAt(f, p) {
      const sample = f.samples.find((s) => s.p.x === p.x && s.p.y === p.y);
      assert(sample, 'Material sample recorded');
      return sample.material;
    }
    async function pixels(points) {
      await page.mouse.move(20, 20);
      await page.evaluate(() =>
        Promise.race([
          window.__qaRaster.surface.waitForFrame(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Atlas frame did not complete within 60 seconds')),
              60000,
            ),
          ),
        ]),
      );
      return page.evaluate((points) => {
        const r = window.__qaRaster,
          c = document.querySelector('#atlas-terrain-spatial canvas'),
          gl = c.getContext('webgl2'),
          frame = r.surface.frame,
          previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        const samples = points.map((p) => {
          const at = frame.project({ ...p, heightM: 30 }),
            rgb = new Uint8Array(4);
          gl.readPixels(
            Math.round((at.x / frame.width) * gl.drawingBufferWidth),
            Math.round((1 - at.y / frame.height) * gl.drawingBufferHeight),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            rgb,
          );
          return { p, rgb: Array.from(rgb) };
        });
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
        return samples;
      }, points);
    }
    async function mapImageHash() {
      await page.mouse.move(20, 20);
      return page.evaluate(async () => {
        await window.__qaRaster.surface.waitForFrame();
        const c = document.querySelector('#atlas-terrain-spatial canvas'),
          gl = c.getContext('webgl2'),
          previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
        const bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
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
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return {
          sha256: [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join(''),
          width: gl.drawingBufferWidth,
          height: gl.drawingBufferHeight,
        };
      });
    }
    async function history(kind) {
      native.mark('history ' + kind);
      const before = query().revision;
      await page.locator('#atlas-' + kind).click();
      await page.waitForFunction(
        (before) =>
          Number(document.querySelector('#campaign-map').dataset.terrainRevision) > before,
        before,
        { timeout: 60000 },
      );
      await ready();
    }
    async function sceneRead(box) {
      const scene = await page.evaluate(async (box) => {
        const r = await window.campaign.atlasVegetationScene(window.__qaRaster.token, box, 1);
        if (!r.ok) throw Error(r.error);
        return { revision: r.value.revision, instances: r.value.instances };
      }, box);
      assert.equal(
        scene.revision,
        query().revision,
        'Bounded vegetation read uses the confirmed source',
      );
      return byId(scene.instances);
    }
    async function sceneFromRecords(records, box) {
      const env = vegetationEnvironment(records);
      return byId(
        records
          .filter((r) => r.vegetation)
          .flatMap((r) =>
            generateVegetation(r, env, box, 1).instances.map((i) => ({ ...i, areaId: r.id })),
          ),
      );
    }
    async function zoomTo(target, focusPoint = { x: 0, y: 0 }) {
      for (let n = 0; n < 20; n++) {
        const mpp = await page.evaluate(
          () => window.__qaRaster.surface.frame.camera.metersPerPixel,
        );
        if (Math.abs(Math.log(mpp / target)) < 1e-5) break;
        const at = await project(focusPoint);
        await page.mouse.move(at.x, at.y);
        await page.evaluate(() => {
          window.__qaBiomeWheel = null;
          window.addEventListener(
            'wheel',
            (e) => {
              window.__qaBiomeWheel = { deltaY: e.deltaY, deltaMode: e.deltaMode };
            },
            { once: true, capture: true },
          );
        });
        // Electron's zoom scales CDP wheel pixels before exposing CSS deltas.
        const requestedDelta = (Math.log(target / mpp) / 0.002) * scale;
        await page.mouse.wheel(0, requestedDelta);
        await page.waitForFunction(() => !!window.__qaBiomeWheel);
        const received = await page.evaluate(() => window.__qaBiomeWheel);
        assert.equal(received.deltaMode, 0, 'Native driver sends pixel wheel deltas');
        const expected = mpp * Math.exp(Math.max(-1.2, Math.min(1.2, received.deltaY * 0.002)));
        results.wheelGestures.push({
          scale,
          fromMpp: mpp,
          targetMpp: target,
          requestedDelta,
          received,
          expectedMpp: expected,
        });
        await page.waitForFunction(
          (expected) =>
            Math.abs(Math.log(window.__qaRaster.surface.frame.camera.metersPerPixel / expected)) <
              1e-5 && !window.__qaRaster.navigating,
          expected,
          { timeout: 30000 },
        );
        await ready();
      }
      const actual = await page.evaluate(
        () => window.__qaRaster.surface.frame.camera.metersPerPixel,
      );
      assert(
        Math.abs(Math.log(actual / target)) < 1e-5,
        'Native wheel reached the requested texture scale',
      );
    }
    async function qualifySurfaceTexture(record, label) {
      native.mark('existing cartographic forest texture at surface scale');
      const originalMpp = await page.evaluate(
        () => window.__qaRaster.surface.frame.camera.metersPerPixel,
      );
      await zoomTo(8.1);
      const mpp = await page.evaluate(() => window.__qaRaster.surface.frame.camera.metersPerPixel);
      const points = [];
      for (let x = -125; x <= 125; x += 4)
        for (let y = -48; y <= 48; y += 4)
          if (margin({ x, y }, record.polygons) > 24) points.push({ x, y });
      const outside = [
        { x: 0, y: 120 },
        { x: 0, y: -120 },
        { x: -300, y: 0 },
        { x: 300, y: 0 },
      ];
      const painted = await pixels([...points, ...outside]);
      await native.capture(page, label + '-surface-texture.png');
      await history('undo');
      const base = await pixels([...points, ...outside]);
      await native.capture(page, label + '-surface-base.png');
      await history('redo');
      const restored = await pixels([...points, ...outside]);
      const colors = new Set(
          painted.slice(0, points.length).map((p) => p.rgb.slice(0, 3).join(',')),
        ),
        flatColors = new Set(base.slice(0, points.length).map((p) => p.rgb.slice(0, 3).join(',')));
      check(
        label + '-existing-surface-texture',
        mpp > 8 &&
          colors.size > 3 &&
          flatColors.size === 1 &&
          isDeepStrictEqual(painted.slice(points.length), base.slice(points.length)) &&
          isDeepStrictEqual(painted, restored),
        {
          mpp,
          outsideUnchanged: isDeepStrictEqual(
            painted.slice(points.length),
            base.slice(points.length),
          ),
          redoRestored: isDeepStrictEqual(painted, restored),
          insideColors: [...colors],
          baseColors: [...flatColors],
          samples: points.length,
          outside: painted.slice(points.length),
        },
      );
      await zoomTo(originalMpp);
      await native.capture(page, label + '-detail-restored.png');
    }
    await open();
    const baseline = query();
    results.fixtureSurface = await page.evaluate(() => ({
      groundM: window.__qaRaster.height({ x: 0, y: 0 }),
      seaLevelsM: [
        ...new Set(window.__qaRaster.tiles.map((t) => t.terrain.projection.grid.seaLevelM)),
      ],
    }));
    check(
      'fixture-flat-dry-ground',
      results.fixtureSurface.groundM === 30 &&
        results.fixtureSurface.seaLevelsM.every((h) => h === 0),
      results.fixtureSurface,
    );

    check(
      'fixture-four-flat-height-tiles',
      baseline.records.filter((r) => r.height).length === 4 &&
        baseline.records.every(
          (r) => (earthOnly || !r.vegetation) && !['road', 'river', 'building'].includes(r.kind),
        ),
    );
    if (earthOnly)
      await qualifyBiomeEarth({
        native,
        getPage: () => page,
        open,
        query,
        canonical,
        frame,
        pixels,
        project,
        zoomTo,
        check,
        results,
        save,
      });
    else if (library)
      await qualifyBiomeLibrary({
        native,
        getPage: () => page,
        open,
        ready,
        query,
        project,
        frame,
        pixels,
        sceneRead,
        history,
        mapImageHash,
        zoomTo,
        check,
        canonical,
        results,
        save,
        vegetationSpec,
        fixture,
        fixtureStore,
        fixtureHeightRecord,
        output,
        marshOnly,
      });
    for (const [radius, edge] of library
      ? []
      : surfaceOnly
        ? [[75, 16]]
        : [
            [25, 0],
            [75, 0],
            [75, 16],
          ]) {
      const label = `r${radius}-edge${edge}`;
      native.mark(label + ' real paint/history/fresh workflow');
      const before = query();
      assert(
        !before.records.some((r) => r.vegetation),
        'Each radius starts on the identical empty ground',
      );
      await setBrushWorldRadius(page, 'land-radius', radius);
      await page.locator('#vegetation-edge').fill(String(edge));
      await page.locator('#vegetation-edge').press('Tab');
      await ready();
      let beforeFrame = await frame();
      const tiles = beforeFrame.tiles.map(({ tile, view }) => ({ tile, view }));
      // Find a genuine loaded boundary crossed by the intended horizontal stroke.
      const boundaries = [
        ...new Set(tiles.flatMap((t) => [t.view.x, t.view.x + t.view.width])),
      ].filter((x) => x > -150 && x < 150);
      assert(boundaries.length, 'Paint crosses an actual loaded render tile boundary');
      const boundary = boundaries.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
      const start = await project({ x: -150, y: 0 }),
        end = await project({ x: 150, y: 0 });
      const samples = [];
      for (let x = -140; x <= 140; x += 7)
        for (let y = -radius + 8; y <= radius - 8; y += 7) samples.push({ x, y });
      const outside = [
        { x: -100, y: radius + 25 },
        { x: 100, y: -radius - 25 },
        { x: -150 - radius - 25, y: 0 },
        { x: 150 + radius + 25, y: 0 },
        { x: -90, y: radius + 2 },
        { x: 90, y: -radius - 2 },
      ];
      beforeFrame = await frame([...outside, { x: boundary - 2, y: 0 }, { x: boundary + 2, y: 0 }]);
      const beforePixels = await pixels([...samples, ...outside]);
      const mapHashes = { before: await mapImageHash() };
      await native.capture(page, label + '-before.png');
      await page.evaluate(() => {
        window.__qaGesturePoints = [];
      });
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 30 });
      await page.mouse.up();
      for (let n = 0; query().cursor === before.cursor && n < 300; n++)
        await page.waitForTimeout(100);
      assert.equal(query().cursor, before.cursor + 1, 'Pointerup confirmed');
      await ready();
      const painted = query(),
        record = painted.records.find((r) => r.vegetation);
      assert(record, 'Pointerup committed one vegetation author area');
      const actualGesture = await page.evaluate(() => window.__qaGesturePoints);
      const expectedPolygons = brushFootprint(record.points, radius, 0, record.vegetation.seed);
      const b = bounds(record),
        length = record.points
          .slice(1)
          .reduce(
            (s, p, i) => s + Math.hypot(p.x - record.points[i].x, p.y - record.points[i].y),
            0,
          ),
        measuredArea = area(record.polygons),
        idealArea = 2 * radius * length + Math.PI * radius * radius;
      check(
        label + '-radius-polygon-history',
        JSON.stringify(expectedPolygons) === JSON.stringify(record.polygons) &&
          Math.abs(b.height - 2 * radius) < 0.05 &&
          Math.abs(measuredArea / idealArea - 1) < 0.02 &&
          painted.cursor === before.cursor + 1 &&
          painted.records.length === before.records.length + 1,
        {
          bounds: b,
          measuredArea,
          idealArea,
          polylineLength: length,
          cursors: [before.cursor, painted.cursor],
        },
      );
      check(
        label + '-native-points-match-author',
        record.points.every((p) =>
          actualGesture.some((e) => Math.hypot(p.x - e.x, p.y - e.y) < 1e-6),
        ),
        { nativeSamples: actualGesture.length, authoredSamples: record.points.length },
      );
      const afterFrame = await frame([
          ...outside,
          { x: boundary - 2, y: 0 },
          { x: boundary + 2, y: 0 },
        ]),
        fullBox = { x: -240, y: -125, width: 480, height: 250 },
        instances = await sceneFromRecords(painted.records, fullBox);
      const overhang = instances.filter((i) => {
        const g = vegetationGeometry(i.asset, 'crown'),
          pos = g.getAttribute('position'),
          s = i.asset === 'oak' || i.asset === 'pine' ? vegetationCrownScale(i.size, 1, 4) : 1;
        let outside = false;
        for (let n = 0; n < pos.count; n++) {
          const x = pos.getX(n) * i.size * s,
            y = -pos.getY(n) * i.size * s;
          if (
            !contains(
              {
                x: i.x + x * Math.cos(-i.angle) - y * Math.sin(-i.angle),
                y: i.y + x * Math.sin(-i.angle) + y * Math.cos(-i.angle),
              },
              record.polygons,
            )
          ) {
            outside = true;
            break;
          }
        }
        g.dispose();
        return outside;
      });
      const rendererInstances = await page.evaluate(() =>
        window.__qaRaster.vegetation.batches
          .filter((b) => b.part === 'crown')
          .flatMap((b) => b.data.map(({ limit, ...i }) => i)),
      );
      check(
        label + '-renderer-uses-canonical-assets',
        isDeepStrictEqual(byId(rendererInstances), instances),
        {
          rendererCount: rendererInstances.length,
          canonicalCount: instances.length,
          firstMismatch: byId(rendererInstances).find(
            (i, n) => !isDeepStrictEqual(i, instances[n]),
          ),
        },
      );
      check(
        label + '-asset-footprints-inside',
        overhang.length === 0 && instances.every((i) => contains(i, record.polygons)),
        {
          instances: instances.length,
          overhang: overhang.map((i) => ({
            id: i.id,
            asset: i.asset,
            x: i.x,
            y: i.y,
            size: i.size,
            edgeDistance: margin(i, record.polygons),
          })),
        },
      );
      const counts = Object.fromEntries(
        ['oak', 'pine', 'shrub', 'rock'].map((a) => [
          a,
          instances.filter((i) => i.asset === a).length,
        ]),
      );
      check(
        label + '-matching-assets',
        counts.oak > 0 && counts.pine === 0 && counts.shrub > 0 && counts.rock > 0,
        { counts },
      );
      const left = await sceneRead({
          ...fullBox,
          width: boundary - fullBox.x,
        }),
        right = await sceneRead({
          ...fullBox,
          x: boundary,
          width: fullBox.x + fullBox.width - boundary,
        });
      const fullRead = await sceneRead(fullBox);
      check(label + '-canonical-scene-read', isDeepStrictEqual(fullRead, instances));
      const combined = new Map();
      let duplicatesIdentical = true;
      for (const i of [...left, ...right]) {
        const old = combined.get(i.id);
        if (old && JSON.stringify(old) !== JSON.stringify(i)) duplicatesIdentical = false;
        combined.set(i.id, i);
      }
      check(
        label + '-split-read-stability',
        duplicatesIdentical &&
          JSON.stringify(byId([...combined.values()])) === JSON.stringify(instances) &&
          new Set(instances.map((i) => i.id)).size === instances.length,
        {
          boundary,
          tiles,
          left: left.length,
          right: right.length,
          shared: left.length + right.length - combined.size,
        },
      );
      const crossed = tiles.filter((t) => t.view.y <= 0 && t.view.y + t.view.height > 0);
      const adjacentLeft = crossed.find((t) => t.view.x + t.view.width === boundary),
        adjacentRight = crossed.find((t) => t.view.x === boundary);
      assert(
        adjacentLeft &&
          adjacentRight &&
          adjacentLeft.view.y === adjacentRight.view.y &&
          adjacentLeft.view.height === adjacentRight.view.height,
        'Two actual adjacent render tiles cross the gesture',
      );
      const tileReads = [await sceneRead(adjacentLeft.view), await sceneRead(adjacentRight.view)];
      const unionRead = await sceneRead({
        ...adjacentLeft.view,
        width: adjacentLeft.view.width + adjacentRight.view.width,
      });
      const tileIds = new Map();
      let tileDuplicateMismatch = false;
      for (const i of tileReads.flat()) {
        if (tileIds.has(i.id) && !isDeepStrictEqual(tileIds.get(i.id), i))
          tileDuplicateMismatch = true;
        tileIds.set(i.id, i);
      }
      check(
        label + '-actual-tile-reads',
        !tileDuplicateMismatch && isDeepStrictEqual(byId([...tileIds.values()]), unionRead),
        {
          tiles: [adjacentLeft, adjacentRight],
          counts: tileReads.map((r) => r.length),
          shared: tileReads.flat().length - tileIds.size,
          union: unionRead.length,
        },
      );
      const free = samples.filter(
        (p) =>
          margin(p, record.polygons) > Math.max(8, edge) &&
          instances.every(
            (i) =>
              Math.hypot(i.x - p.x, i.y - p.y) > i.size * (i.asset === 'oak' ? 0.45 : 0.65) + 1.5,
          ),
      );
      assert(free.length > 3, 'Several bare interior ground pixels remain, without tree crowns');
      const afterPixels = await pixels([...samples, ...outside]);
      const groundPixels = free.map((p) => {
        const n = samples.findIndex((s) => s.x === p.x && s.y === p.y);
        return { p, before: beforePixels[n].rgb, after: afterPixels[n].rgb };
      });
      const changed = groundPixels.filter((p) =>
        p.before.slice(0, 3).some((v, n) => Math.abs(v - p.after[n]) > 8),
      );
      const controls = outside.map((p, n) => ({
        p,
        before: beforePixels[samples.length + n].rgb,
        after: afterPixels[samples.length + n].rgb,
        materialBefore: materialAt(beforeFrame, p),
        materialAfter: materialAt(afterFrame, p),
      }));
      check(
        label + '-bare-ground-color-and-outside',
        changed.length >= groundPixels.length * 0.8 &&
          controls.every(
            (p) =>
              JSON.stringify(p.before) === JSON.stringify(p.after) &&
              isDeepStrictEqual(p.materialBefore, p.materialAfter),
          ),
        { freeSamples: groundPixels.length, changed: changed.length, groundPixels, controls },
      );
      const interiorMaterial = [
        { x: boundary - 2, y: 0 },
        { x: boundary + 2, y: 0 },
      ].map((p) => ({ p, before: materialAt(beforeFrame, p), after: materialAt(afterFrame, p) }));
      check(
        label + '-continuous-ground-and-cover-material',
        interiorMaterial.every(
          (p) =>
            p.after.forest[0] > 200 &&
            p.after.deciduous[0] > 100 &&
            p.after.shrub[0] > 50 &&
            p.after.debris[0] > 0 &&
            JSON.stringify(p.before.baseColor) !== JSON.stringify(p.after.baseColor),
        ),
        { interiorMaterial },
      );
      mapHashes.painted = await mapImageHash();
      await native.capture(page, label + '-painted.png');
      const saved = { record: canonical([record])[0], instances, cursor: painted.cursor };
      await history('undo');
      const undone = query(),
        undoPixels = await pixels([...samples, ...outside]);
      check(
        label + '-undo-restores-base',
        JSON.stringify(canonical(undone.records)) === JSON.stringify(canonical(before.records)) &&
          JSON.stringify(undoPixels) === JSON.stringify(beforePixels) &&
          undone.cursor === before.cursor,
      );
      mapHashes.undo = await mapImageHash();
      await history('redo');
      const redone = query();
      check(
        label + '-redo-identical',
        JSON.stringify(canonical(redone.records.filter((r) => r.vegetation))) ===
          JSON.stringify([saved.record]) &&
          JSON.stringify(await sceneRead(fullBox)) === JSON.stringify(saved.instances) &&
          redone.cursor === saved.cursor,
      );
      mapHashes.redo = await mapImageHash();
      await native.capture(page, label + '-redo.png');
      await native.close();
      await open();
      const fresh = query(),
        freshPixels = await pixels([...samples, ...outside]);
      check(
        label + '-fresh-identical',
        JSON.stringify(canonical(fresh.records.filter((r) => r.vegetation))) ===
          JSON.stringify([saved.record]) &&
          JSON.stringify(await sceneRead(fullBox)) === JSON.stringify(saved.instances) &&
          fresh.cursor === saved.cursor &&
          JSON.stringify(freshPixels) === JSON.stringify(afterPixels),
      );
      mapHashes.fresh = await mapImageHash();
      check(
        label + '-whole-map-image-history-fresh',
        mapHashes.before.sha256 !== mapHashes.painted.sha256 &&
          mapHashes.undo.sha256 === mapHashes.before.sha256 &&
          mapHashes.redo.sha256 === mapHashes.painted.sha256 &&
          mapHashes.fresh.sha256 === mapHashes.painted.sha256,
        mapHashes,
      );
      await native.capture(page, label + '-fresh.png');
      if (edge === 16) await qualifySurfaceTexture(record, label);
      results.strokes.push({
        label,
        radius,
        edge,
        record,
        actualGesture,
        mapHashes,
        savedHash: sha(JSON.stringify(saved)),
        instanceHash: sha(JSON.stringify(instances)),
        tileBoundary: boundary,
        cameraBefore: beforeFrame.camera,
        cameraAfter: afterFrame.camera,
      });
      await save();
      if (edge !== 16) await history('undo');
    }
    await native.close();
    const failed = Object.entries(results.checks).filter(([, r]) => !r.passed);
    results.sourceHashesAfter = Object.fromEntries(
      await Promise.all(sources.map(async (p) => [p, sha(await readFile(p))])),
    );
    assert.deepEqual(
      results.sourceHashesAfter,
      sourceHashes,
      'Bound sources remain unchanged during qualification',
    );
    await save();
    assert.deepEqual(
      failed.map(([k]) => k),
      [],
      'All biome qualification assertions',
    );
    return results;
  });
} finally {
  await save();
}
console.log(output);
