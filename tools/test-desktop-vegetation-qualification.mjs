import { setBrushWorldRadius } from './atlas-brush-probe.mjs';
// Real Electron controls in a disposable profile. No author mutation via page.evaluate.
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { homedir, cpus, totalmem } from 'node:os';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { atlasCanvasReady, atlasCanvasPoint } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(import.meta.url),
  { _electron } = require('playwright-core'),
  { buildSync } = require('esbuild');
const cache = homedir() + '/.cache/saltmarcher';
await mkdir(cache, { recursive: true });
const navigationOnly = process.argv.includes('--navigation-only');
const dir = await mkdtemp(cache + '/vegetation-qualification-'),
  out = root + '/.build/' + (navigationOnly ? 'vegetation-navigation' : 'vegetation-qualification');
await mkdir(out, { recursive: true });
// Keep this probe's compiled application separate from other native probes.
await writeFile(
  out + '/build.mjs',
  (await readFile('tools/build-desktop.mjs', 'utf8')).replaceAll(
    '.build/desktop',
    '.build/vegetation-qualification-desktop',
  ),
);
execFileSync(process.execPath, [out + '/build.mjs'], { cwd: root, stdio: 'pipe' });
buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/vegetation';",
    resolveDir: root,
  },
  outfile: out + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, heightRecord, emptyRecord, vegetationSpec } = require(out + '/store.cjs'),
  Database = require('better-sqlite3'),
  { PNG } = require('pngjs');
const store = new CampaignStore(dir + '/workbench.sqlite'),
  cam = store.create('Vegetationsprobe'),
  active = store.activate(cam.id);
const write = (action) =>
  store.executeAtlasCommit({
    commandId: randomUUID(),
    campaignId: cam.id,
    token: active.token,
    action,
  });
const save = (r) => write({ kind: 'landscape-put', record: r, expectedRevision: null });
for (let y = -1; y <= 0; y++)
  for (let x = -1; x <= 0; x++)
    save(
      heightRecord(
        x * 512,
        y * 512,
        8,
        Float32Array.from({ length: 4096 }, (_, i) => {
          const wx = x * 512 + (i % 64) * 8,
            wy = y * 512 + Math.floor(i / 64) * 8;
          return 35 + 80 * Math.exp(-((wx + 180) ** 2 + (wy - 80) ** 2) / 40000);
        }),
      ),
    );
const poly = (x, y, w, h) => ({
  outer: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  holes: [],
});
const wood = {
  ...emptyRecord('vegetation'),
  name: 'Testwald',
  points: [],
  polygons: [poly(-300, -200, 300, 400)],
  resolution: 3,
  values: { terrain: 'forest' },
  vegetation: vegetationSpec('conifer', 123),
};
save(wood);
save({
  ...emptyRecord('vegetation'),
  name: 'Geröllhang',
  points: [],
  polygons: [poly(30, 40, 240, 160)],
  resolution: 3,
  values: { terrain: 'hills' },
  vegetation: vegetationSpec('scree', 77),
});
save({
  ...emptyRecord('road'),
  name: 'Prüfweg',
  points: [
    { x: -280, y: -30 },
    { x: 260, y: 30 },
  ],
  width: 8,
});
write({ kind: 'landscape-vegetation-edit', mode: 'clear', polygons: [poly(-160, -80, 65, 70)] });
// Coarse continental data underneath the explicitly authored local detail.
for (let y = -1; y <= 0; y++)
  for (let x = -1; x <= 0; x++)
    save(heightRecord(x * 65536, y * 65536, 1024, new Float32Array(4096).fill(35)));
const broad = {
  ...emptyRecord('vegetation'),
  name: 'Regionalwald',
  points: [],
  polygons: [
    {
      outer: Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2,
          r = 1 + 0.12 * Math.sin(a * 5);
        return { x: Math.cos(a) * 28000 * r, y: Math.sin(a) * 19000 * r };
      }),
      holes: [],
    },
  ],
  resolution: 100,
  values: { terrain: 'forest' },
  vegetation: vegetationSpec('deciduous', 891),
};
save(broad);
const selectionWood = store.atlasLandscapeObject(active.token, wood.id);
selectionWood.vegetation.overrides = [
  { id: 'qualification-tree', x: -100, y: 80, asset: 'oak', size: 30, angle: 0 },
  { id: 'qualification-rock', x: -100, y: 80, asset: 'rock', size: 6, angle: 0 },
];
write({ kind: 'landscape-put', record: selectionWood, expectedRevision: selectionWood.revision });
store.tutorial('skipped');
store.close();
const db = new Database(dir + '/workbench.sqlite', { readonly: true }),
  records = () =>
    db
      .prepare(
        "SELECT payload FROM atlas_landscape WHERE json_extract(payload,'$.vegetation') IS NOT NULL",
      )
      .all()
      .map((r) => JSON.parse(r.payload));
const result = {
  profile: dir,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  checks: [],
  errors: [],
  sourceHashes: {},
  host: { cpu: cpus()[0].model, memoryBytes: totalmem() },
};
for (const file of [
  'tools/test-desktop-vegetation-qualification.mjs',
  'src/app/atlas/vegetation.ts',
  'src/app/vegetation-spatial.ts',
  'src/app/atlas/atlas-landscape-ui.ts',
  'src/app/storage/vegetation.ts',
  'src/app/storage/atlas-landscape-region.ts',
  'src/app/atlas/vegetation-view.ts',
  'src/app/atlas/atlas-tool-catalog.ts',
  '.build/vegetation-qualification-desktop/ui/renderer.js',
  '.build/vegetation-qualification-desktop/main.cjs',
])
  result.sourceHashes[file] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
const mark = (s) => {
  result.checks.push(s);
  console.log(s);
};
let app, page;
async function close() {
  if (!app) return;
  const proc = app.process(),
    exit = new Promise((resolve) => proc.once('exit', (code, signal) => resolve({ code, signal })));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  const ended = await exit;
  assert.deepEqual(ended, { code: 0, signal: null });
  app = null;
  result.exits ??= [];
  result.exits.push(ended);
}
async function capture(name) {
  await page.screenshot({ path: out + '/' + name + '.png' });
}
async function start() {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [
      root + '/.build/vegetation-qualification-desktop/main.cjs',
      '--data-dir',
      dir,
      '--ozone-platform=x11',
    ],
    timeout: 45000,
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => result.errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  // Fixture-only saved camera preference; all subsequent navigation uses real inputs.
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        'atlas-camera:' + id,
        JSON.stringify({ x: -300, y: -225, width: 600, height: 450 }),
      ),
    cam.id,
  );
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Vegetationsprobe' })
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
  await atlasCanvasReady(page);
  await page.locator('#atlas-units').selectOption('metric');
  await page.locator('#atlas-section').selectOption('terrain');
  await page.locator('[data-tool-group="vegetation"]').click();
  await atlasCanvasReady(page);
  for (let i = 0; i < 24; i++) {
    const c = await camera();
    if (c.view.width < 900) break;
    await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  }
  await atlasCanvasReady(page);
  const c = await camera(),
    scale = Math.min(c.width / c.view.width, c.height / c.view.height),
    cx = c.left + c.width / 2,
    cy = c.top + c.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(
    cx + (c.view.x + c.view.width / 2) * scale,
    cy + (c.view.y + c.view.height / 2) * scale,
    { steps: 10 },
  );
  await page.mouse.up({ button: 'middle' });
  await atlasCanvasReady(page);
}
const camera = () =>
  page.locator('#campaign-map').evaluate((n) => ({
    view: JSON.parse(n.dataset.atlasView),
    left: n.getBoundingClientRect().left,
    top: n.getBoundingClientRect().top,
    width: n.clientWidth,
    height: n.clientHeight,
  }));
async function at(x, y) {
  return atlasCanvasPoint(page, { x, y }, false);
}
async function tool(id) {
  await page.locator('[data-atlas-tool="' + id + '"]').click();
  await atlasCanvasReady(page);
}
async function settled() {
  await page.waitForFunction(
    () =>
      !document.querySelector('#land-tool').disabled &&
      document.querySelector('#land-status').textContent === 'Gespeichert',
  );
  await atlasCanvasReady(page);
}
async function stroke(a, b) {
  const x = await at(...a),
    y = await at(...b);
  await page.mouse.move(x.x, x.y);
  await page.mouse.down();
  await page.mouse.move(y.x, y.y, { steps: 8 });
  await page.mouse.up();
  await settled();
}
const spatialReady = () =>
  page.waitForFunction(
    () =>
      document.querySelector('#vegetation-spatial-canvas')?.getAttribute('aria-busy') === 'false',
  );
async function openSpatial() {
  await page.locator('#vegetation-spatial').click();
  await spatialReady();
}
async function spatialPoint(x, y) {
  return page.evaluate(
    ({ x, y }) => {
      const box = JSON.parse(document.querySelector('#campaign-map').dataset.atlasView),
        r = document.querySelector('#vegetation-spatial-canvas').getBoundingClientRect(),
        span = Math.max(box.height, box.width / (r.width / r.height)),
        scale = r.height / span;
      return {
        x: r.x + r.width / 2 + (x - box.x - box.width / 2) * scale,
        y: r.y + r.height / 2 + (y - box.y - box.height / 2) * scale,
      };
    },
    { x, y },
  );
}
async function closeSpatial() {
  await page.locator('#vegetation-spatial-close').click();
  await atlasCanvasReady(page);
}
async function zoomTo(mpp) {
  for (let n = 0; n < 8; n++) {
    const c = await camera();
    if (c.view.width / c.width >= mpp) return c;
    const delta = Math.min(600, Math.log((mpp * 1.05) / (c.view.width / c.width)) / 0.002),
      target = c.view.width * Math.exp(delta * 0.002);
    await page.mouse.move(c.left + c.width / 2, c.top + c.height / 2);
    await page.mouse.wheel(0, delta);
    await page.waitForFunction(
      (target) =>
        JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width >=
        target * 0.999,
      target,
    );
    await atlasCanvasReady(page);
  }
  throw Error('Maßstab nicht erreicht');
}
async function exportMatches(name) {
  await page.locator('#vegetation-spatial-tool').selectOption('navigate');
  // Export clears the brush guide. Move the cursor outside the terrain first.
  await page.locator('#vegetation-top-view').click();
  const expected = Buffer.from(
    (
      await page.locator('#vegetation-spatial-canvas').evaluate((n) => n.toDataURL('image/png'))
    ).split(',')[1],
    'base64',
  );
  await app.evaluate(
    ({ dialog }, filename) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: filename });
    },
    out + '/' + name + '.png',
  );
  await page.locator('#vegetation-spatial-export').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#vegetation-spatial-status')
      .textContent.includes('als PNG gespeichert'),
  );
  const actual = await readFile(out + '/' + name + '.png'),
    a = PNG.sync.read(expected),
    b = PNG.sync.read(actual);
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  assert.deepEqual(a.data, b.data);
  result.exports ??= [];
  result.exports.push({ name, width: a.width, height: a.height, identicalPixels: true });
}
async function exportMap() {
  const authored = JSON.stringify(records());
  await page.locator('#atlas-output-open').click();
  await page.locator('#atlas-output-view').click();
  await page.locator('#atlas-output summary').filter({ hasText: 'Bildoptionen' }).click();
  await page.locator('#atlas-export-size').fill('1024');
  await page.locator('#atlas-export-grid').uncheck();
  await page.locator('#atlas-export-scale').uncheck();
  await atlasCanvasReady(page);
  const c = await camera();
  await app.evaluate(({ dialog }, filename) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: filename });
  }, out + '/map-export.png');
  const exportStarted = performance.now();
  await page.locator('#atlas-export-png').click();
  await page.waitForFunction(
    () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
    null,
    { timeout: 180000 },
  );
  const png = PNG.sync.read(await readFile(out + '/map-export.png'));
  // The protected rock is the same authored object in the map, inspector and
  // output. Compare its world coordinate, not different LOD/selection pixels.
  const x = Math.round(((-100 - c.view.x) / c.view.width) * png.width),
    y = Math.round(((80 - c.view.y) / c.view.height) * png.height);
  let rockPixels = 0;
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const p = ((y + dy) * png.width + x + dx) * 4;
      if (png.data[p] === 142 && png.data[p + 1] === 135 && png.data[p + 2] === 120) rockPixels++;
    }
  assert(
    rockPixels > 0,
    'the map PNG must contain the protected rock at its canonical world coordinate',
  );
  assert.equal(JSON.stringify(records()), authored, 'export must not change vegetation');
  result.mapExport = {
    elapsedMs: performance.now() - exportStarted,
    width: png.width,
    height: png.height,
    box: c.view,
    protectedRock: { x: -100, y: 80, matchingPixels: rockPixels },
    authoredUnchanged: true,
  };
  await capture('map-export-panel');
  await page.locator('#atlas-output-back').click();
  await atlasCanvasReady(page);
  mark(
    'Normal map PNG retains the selected rock at its canonical world coordinate without author changes',
  );
}
try {
  const openingStarted = performance.now();
  await start();
  result.openingMs = performance.now() - openingStarted;
  console.log('Initial camera', JSON.stringify(await camera()));
  await capture('01-local-map');
  if (!navigationOnly) {
    await tool('vegetation-select');
    await page.locator('#vegetation-selection-filter').selectOption('rocks');
    const mapPick = await at(-100, 80);
    await page.mouse.click(mapPick.x, mapPick.y);
    await page.waitForFunction(
      () => document.querySelector('#vegetation-object-asset')?.value === 'rock',
    );
    assert.equal(Number(await page.locator('#vegetation-object-x').inputValue()), -100);
    await page.locator('#vegetation-selection-filter').selectOption('all');
    mark('The map selects the protected rock under a canopy through the same type filter');
    await tool('vegetation');
    await setBrushWorldRadius(page, 'land-radius', '20');
    await page.evaluate(() => {
      const c = document.querySelector('#campaign-map');
      window.vegetationMapLatency = [];
      document.addEventListener(
        'pointermove',
        (e) => {
          if (e.target !== c || !e.buttons) return;
          const start = e.timeStamp,
            version = c.dataset.sceneVersion;
          function frame() {
            if (c.dataset.sceneVersion !== version && c.dataset.canvasState === 'loaded')
              window.vegetationMapLatency.push(performance.now() - start);
            else if (performance.now() - start < 5000) requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        },
        { capture: true },
      );
    });
    const mapCount = records().length,
      ma = await at(60, -140),
      mb = await at(180, -140);
    await page.mouse.move(ma.x, ma.y);
    await page.mouse.down();
    await page.mouse.move(mb.x, mb.y, { steps: 24 });
    await page.waitForFunction(() => window.vegetationMapLatency.length >= 12);
    await page.mouse.up();
    await settled();
    assert.equal(records().length, mapCount + 1);
    const mapLatency = await page.evaluate(() => window.vegetationMapLatency);
    mapLatency.sort((a, b) => a - b);
    result.mapBrushFeedback = {
      samples: mapLatency.length,
      maxMs: mapLatency.at(-1),
      p95Ms: mapLatency[Math.floor(mapLatency.length * 0.95)],
      scope: 'real map vegetation drag; input timestamp through a new loaded canvas scene',
    };
    result.mapBrushFeedback.targetMet = result.mapBrushFeedback.maxMs <= 100;
    const sceneVersion = await page.locator('#campaign-map').getAttribute('data-scene-version');
    await page.locator('#atlas-undo').click();
    await page.waitForFunction(
      (v) => document.querySelector('#campaign-map').dataset.sceneVersion !== v,
      sceneVersion,
    );
    await atlasCanvasReady(page);
    assert.equal(records().length, mapCount);
    mark(
      'Map brush feedback measured through actual new scene publication; save and undo preserve the original area count',
    );
    await exportMap();
    await openSpatial();
    await page.locator('#vegetation-top-view').click();
    result.gpu = await page.locator('#vegetation-spatial-canvas').evaluate((c) => {
      const gl = c.getContext('webgl2'),
        ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER);
    });
    await page.locator('#vegetation-spatial-tool').selectOption('select');
    let p = await spatialPoint(-100, 80);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(
      () => document.querySelector('#vegetation-object-asset')?.value === 'oak',
    );
    await openSpatial();
    await page.locator('#vegetation-top-view').click();
    await page.locator('#vegetation-spatial-tool').selectOption('select');
    await page.locator('#vegetation-spatial-selection-filter').selectOption('rocks');
    p = await spatialPoint(-100, 80);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(
      () => document.querySelector('#vegetation-object-asset')?.value === 'rock',
    );
    assert.equal(Number(await page.locator('#vegetation-object-x').inputValue()), -100);
    assert.equal(Number(await page.locator('#vegetation-object-y').inputValue()), 80);
    await capture('02-rock-under-canopy');
    mark(
      'Native selection reaches the same protected rock under an oak canopy using the object filter',
    );

    await openSpatial();
    await page.locator('#vegetation-top-view').click();
    await page.locator('#vegetation-spatial-tool').selectOption('paint');
    // Observe real pointer events and the next frame. Inputs still come from Playwright's mouse.
    await page.evaluate(() => {
      const c = document.querySelector('#vegetation-spatial-canvas');
      window.vegetationLatency = [];
      c.addEventListener(
        'pointermove',
        (e) => {
          if (!e.buttons) return;
          const start = e.timeStamp;
          requestAnimationFrame(() => window.vegetationLatency.push(performance.now() - start));
        },
        { capture: true },
      );
    });
    const areaCount = records().length,
      a = await spatialPoint(70, -140),
      b = await spatialPoint(210, -140);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    const beforeGuide = await page
      .locator('#vegetation-spatial-canvas')
      .evaluate((n) => n.toDataURL());
    await page.mouse.move(b.x, b.y, { steps: 24 });
    const afterGuide = await page
      .locator('#vegetation-spatial-canvas')
      .evaluate((n) => n.toDataURL());
    assert.notEqual(beforeGuide, afterGuide, 'the measured gesture must visibly update the guide');
    await page.mouse.up();
    await spatialReady();
    const latency = await page.evaluate(() => window.vegetationLatency);
    assert(latency.length >= 12);
    latency.sort((a, b) => a - b);
    result.brushFeedback = {
      samples: latency.length,
      maxMs: latency.at(-1),
      p95Ms: latency[Math.floor(latency.length * 0.95)],
      scope: 'real spatial vegetation drag; input timestamp through next animation frame',
    };
    // Record a failed performance target without discarding functional evidence.
    result.brushFeedback.targetMet = result.brushFeedback.maxMs <= 100;
    assert.equal(records().length, areaCount + 1);
    await page.locator('#vegetation-spatial-undo').click();
    await spatialReady();
    assert.equal(records().length, areaCount);
    mark(
      'Real vegetation brush feedback measured with a visible changing guide; one undo restores the authored area count',
    );
  } else await openSpatial();
  // Measure ordinary rotation through the visible range control on the local scene.
  await page.locator('#vegetation-spatial-tool').selectOption('navigate');
  const navigationAuthored = JSON.stringify(records());
  const zoomWidth = Number(
    (await page.locator('#vegetation-spatial-status').textContent()).match(
      /· (\d+) m Ausschnitt/,
    )[1],
  );
  await page.evaluate(() => {
    window.vegetationFrames = [];
    window.vegetationMeasuring = true;
    let previous;
    function frame(t) {
      if (previous !== undefined) window.vegetationFrames.push(t - previous);
      previous = t;
      if (window.vegetationMeasuring) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  const range = await page.locator('#vegetation-spatial-rotation').boundingBox();
  await page.mouse.move(range.x + range.width * 0.5, range.y + range.height / 2);
  await page.mouse.down();
  await page.mouse.move(range.x + range.width * 0.9, range.y + range.height / 2, { steps: 90 });
  await page.mouse.up();
  const frames = await page.evaluate(() => {
    window.vegetationMeasuring = false;
    return window.vegetationFrames;
  });
  assert(frames.length >= 10);
  frames.sort((a, b) => a - b);
  result.navigation = {
    frames: frames.length,
    meanFps: 1000 / (frames.reduce((a, b) => a + b, 0) / frames.length),
    frameP95Ms: frames[Math.floor(frames.length * 0.95)],
    scope: 'visible rotation slider during real mouse drag',
  };
  result.navigation.targetMet = result.navigation.meanFps >= 30;
  await capture('navigation');
  await page.locator('#vegetation-spatial-tool').selectOption('navigate');
  await page.locator('#vegetation-top-view').click();
  const canvas = page.locator('#vegetation-spatial-canvas'),
    rect = await canvas.boundingBox(),
    beforePan = await canvas.evaluate((n) => n.toDataURL());
  await page.evaluate(() => {
    window.vegetationPanFrames = [];
    window.vegetationPanActive = true;
    let previous;
    function frame(t) {
      if (previous !== undefined) window.vegetationPanFrames.push(t - previous);
      previous = t;
      if (window.vegetationPanActive) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  await page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.6, rect.y + rect.height * 0.55, { steps: 90 });
  assert.notEqual(await canvas.evaluate((n) => n.toDataURL()), beforePan);
  const panFrames = await page.evaluate(() => {
    window.vegetationPanActive = false;
    return window.vegetationPanFrames;
  });
  await page.mouse.up();
  await spatialReady();
  panFrames.sort((a, b) => a - b);
  assert(panFrames.length >= 10);
  result.pan = {
    frames: panFrames.length,
    meanFps: 1000 / (panFrames.reduce((a, b) => a + b, 0) / panFrames.length),
    frameP95Ms: panFrames[Math.floor(panFrames.length * 0.95)],
    scope: 'visible spatial camera movement during real canvas drag',
  };
  result.pan.targetMet = result.pan.meanFps >= 30;
  await page.evaluate(() => {
    const c = document.querySelector('#vegetation-spatial-canvas'),
      before = c.toDataURL();
    c.addEventListener(
      'wheel',
      (e) => {
        const start = e.timeStamp;
        function frame() {
          const elapsed = performance.now() - start;
          if (c.toDataURL() !== before) window.vegetationZoomFeedback = elapsed;
          else if (elapsed < 5000) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      },
      { capture: true, once: true },
    );
  });
  // Delay only delivery of the real read response so overlap is reproducible
  // even on a fast host. No payload or author command is replaced.
  await app.evaluate(({ ipcMain }) => {
    const handlers = ipcMain._invokeHandlers,
      original = handlers.get('atlas:spatial-scene');
    if (typeof original !== 'function')
      throw Error('Spatial read handler unavailable for the overlap probe');
    globalThis.vegetationProbeReadHandler = original;
    handlers.set('atlas:spatial-scene', async (...args) => {
      const result = await original(...args);
      await new Promise((resolve) => setTimeout(resolve, 250));
      return result;
    });
  });
  await page.mouse.wheel(0, -120);
  await page.waitForFunction(
    () => document.querySelector('#vegetation-spatial-canvas').getAttribute('aria-busy') === 'true',
    null,
    { timeout: 5000 },
  );
  await page.mouse.wheel(0, -120);
  await page.waitForFunction(() => window.vegetationZoomFeedback !== undefined);
  await spatialReady();
  await app.evaluate(({ ipcMain }) => {
    ipcMain._invokeHandlers.set('atlas:spatial-scene', globalThis.vegetationProbeReadHandler);
    delete globalThis.vegetationProbeReadHandler;
  });
  result.zoom = {
    feedbackMs: await page.evaluate(() => window.vegetationZoomFeedback),
    scope: 'wheel input through first changed spatial canvas pixels',
  };
  result.zoom.targetMet = result.zoom.feedbackMs <= 100;
  const loadedWidth = Number(
    (await page.locator('#vegetation-spatial-status').textContent()).match(
      /· (\d+) m Ausschnitt/,
    )[1],
  );
  assert(
    Math.abs(loadedWidth - zoomWidth * Math.exp(-0.24)) <= 1,
    'both queued wheel gestures must survive the pending read',
  );
  assert.equal(
    JSON.stringify(records()),
    navigationAuthored,
    'camera gestures must not modify authored vegetation',
  );
  result.zoom.queuedGestures = {
    count: 2,
    readResponseDelayMs: 250,
    initialWidth: zoomWidth,
    loadedWidth,
    authoredUnchanged: true,
  };
  if (navigationOnly) {
    // The revised read queue must also release authoring normally after settling.
    const count = records().length;
    await page.locator('#vegetation-spatial-tool').selectOption('paint');
    await page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.65, rect.y + rect.height * 0.5, { steps: 12 });
    await page.mouse.up();
    await spatialReady();
    assert.equal(records().length, count + 1);
    await page.locator('#vegetation-spatial-undo').click();
    await spatialReady();
    assert.equal(JSON.stringify(records()), navigationAuthored);
    mark(
      'Queued camera gestures retain their final viewport and release authoring; painting and undo restore the exact vegetation payloads',
    );
  }
  await capture('navigation-pan-zoom');
  if (!navigationOnly) {
    await closeSpatial();
    await openSpatial();
    result.scales = [];
    for (const [name, minMpp] of [
      ['local', 0],
      ['region', 5],
      ['world', 85],
    ]) {
      if (name !== 'local') {
        await closeSpatial();
        await zoomTo(minMpp);
        await capture(name + '-map');
        await openSpatial();
      }
      const c = await camera();
      const mpp = c.view.width / c.width;
      await page.locator('#vegetation-top-view').click();
      await capture(name + '-top');
      await exportMatches(name + '-export');
      await page.locator('#vegetation-tilted-view').click();
      await capture(name + '-tilted');
      result.scales.push({
        name,
        mpp,
        box: c.view,
        status: await page.locator('#vegetation-spatial-status').textContent(),
      });
    }
    mark(
      'Three real camera scales captured in the map and tilted view; each top-view PNG is pixel-identical to the editor canvas',
    );
  }
  await closeSpatial();
  await close();
  mark('Native rotation, pan and zoom performance measured and Electron exited normally');
  assert.deepEqual(result.errors, []);
  result.complete = true;
} catch (e) {
  result.complete = false;
  result.error = e.stack;
  result.camera = await camera().catch(() => null);
  await page?.screenshot({ path: out + '/failure.png' }).catch(() => {});
  throw e;
} finally {
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
  db.close();
  if (app) {
    const proc = app.process(),
      timer = setTimeout(() => proc.kill('SIGKILL'), 4000);
    try {
      await app.close();
    } finally {
      clearTimeout(timer);
    }
  }
  console.log(
    JSON.stringify({
      complete: result.complete,
      out,
      checks: result.checks,
      profile: dir,
      brushFeedback: result.brushFeedback,
      navigation: result.navigation,
    }),
  );
}
