import { runNativeProbe } from './native-session.mjs';
import { setBrushWorldRadius, setHeightDirection } from './atlas-brush-probe.mjs';
// Real Electron controls in a disposable profile. No author mutation via page.evaluate.
import { createRequire } from 'node:module';
import { cp, mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(import.meta.url),
  { _electron } = require('playwright-core'),
  { buildSync } = require('esbuild');
const cache = homedir() + '/.cache/saltmarcher';
await mkdir(cache, { recursive: true });
const out = process.env.QA_EVIDENCE_DIR ?? root + '/.build/terrain-spatial-native';
await runNativeProbe({ output: out, name: 'terrain-spatial' }, async (native) => {
  const dir = native.profile;
  await mkdir(out, { recursive: true });
  // Qualify an isolated copy of the complete current desktop build.
  await cp(root + '/.build/desktop', root + '/.build/terrain-spatial-desktop', { recursive: true });
  buildSync({
    stdin: {
      contents:
        "export * from './src/app/storage/store';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/terrain-height';",
      resolveDir: root,
    },
    outfile: out + '/store.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore, heightRecord, emptyRecord, TerrainSampler } = require(out + '/store.cjs'),
    Database = require('better-sqlite3');
  const store = new CampaignStore(dir + '/workbench.sqlite'),
    cam = store.create('Räumliche Geländeprobe'),
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
            return (
              60 +
              100 * Math.exp(-((wx - 170) ** 2 + wy ** 2) / 4000) +
              100 * Math.exp(-((wx + 170) ** 2 + wy ** 2) / 4000)
            );
          }),
        ),
      );
  save({
    ...emptyRecord('road'),
    name: 'Prüfweg',
    points: [
      { x: -280, y: -30 },
      { x: 260, y: 30 },
    ],
    width: 8,
  });

  const initialScene = store.atlasSpatialScene(
    active.token,
    { x: -340, y: -240, width: 680, height: 480 },
    0.7,
  );
  store.tutorial('skipped');
  store.close();
  const db = new Database(dir + '/workbench.sqlite', { readonly: true });
  const result = {
    initialSurface: initialScene.grid.columns,
    profile: dir,
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    checks: [],
    errors: [],
    sourceHashes: {},
  };
  for (const file of [
    'src/app/atlas/spatial-terrain.ts',
    'src/app/atlas/atlas-vegetation-layer.ts',
    'src/app/atlas/atlas-deck-vegetation.ts',
    'src/app/atlas/atlas-landscape-ui.ts',
    'src/app/storage/vegetation.ts',
    '.build/terrain-spatial-desktop/ui/renderer.js',
    '.build/terrain-spatial-desktop/main.cjs',
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
      exit = new Promise((resolve) =>
        proc.once('exit', (code, signal) => resolve({ code, signal })),
      );
    await native.close();
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
    app = await native.launchConfigured({
      runtime: { kind: 'snapshot', directory: root + '/.build/terrain-spatial-desktop' },
      executablePath: root + '/node_modules/electron/dist/electron',
      args: [
        root + '/.build/terrain-spatial-desktop/main.cjs',
        '--data-dir',
        dir,
        '--ozone-platform=x11',
      ],
      timeout: 45000,
    });
    page = await app.firstWindow();
    page.setDefaultTimeout(20000);
    page.on('pageerror', (e) => result.errors.push(e.stack));
    await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
    await page
      .locator('.campaign-card')
      .filter({ hasText: 'Räumliche Geländeprobe' })
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
    await page.locator('#atlas-search').fill('Prüfweg');
    await page.locator('#atlas-search-results button').filter({ hasText: 'Prüfweg' }).click();
    await atlasCanvasReady(page);
    await page.locator('#atlas-search').fill('');
    await page.locator('#atlas-units').selectOption('metric');
    await page.locator('#atlas-section').selectOption('terrain');
    await page.locator('[data-tool-group="land"]').click();
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
  const all = () =>
    db
      .prepare('SELECT payload FROM atlas_landscape ORDER BY id')
      .all()
      .map((r) => JSON.parse(r.payload));
  const heights = () =>
    JSON.stringify(
      all()
        .filter((r) => r.height)
        .map((r) => r.height),
    );
  const height = (x = 0, y = 0) => new TerrainSampler(all()).query({ x, y });
  const spatialReady = () =>
    page.waitForFunction(
      () =>
        document.querySelector('#vegetation-spatial-canvas')?.getAttribute('aria-busy') === 'false',
      null,
      { timeout: 60000 },
    );
  const center = () =>
    page.locator('#vegetation-spatial-canvas').evaluate((n) => {
      const b = n.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
  async function range(id, value) {
    await page.locator('#' + id).focus();
    await page.keyboard.press('Home');
    for (let i = 0; i < value; i++) await page.keyboard.press('ArrowRight');
  }
  async function press(ms = 600) {
    const p = await center();
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await spatialReady();
  }
  try {
    await start();
    await page.locator('[data-atlas-tool="land-shape"]').click();
    await setBrushWorldRadius(page, 'land-radius', '48');
    await page.locator('#land-height-strength').fill('300');
    const startingCamera = await camera();
    await page.locator('#vegetation-spatial').click();
    await spatialReady();
    assert.equal(await page.locator('#vegetation-spatial-tool').inputValue(), 'height');
    assert.equal(await page.locator('#terrain-spatial-controls #land-radius').inputValue(), '48');
    const original = heights(),
      before = height();
    await capture('00-tilted-pass');
    await page.locator('#land-radius-fixed').uncheck();
    await page.locator('#land-radius-value').fill('65');
    await page.locator('#land-radius-value').press('Tab');
    const screenWorld = Number(await page.locator('#land-radius').inputValue()),
      zoomPoint = await center();
    await page.mouse.move(zoomPoint.x, zoomPoint.y);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(350);
    await spatialReady();
    assert(
      Math.abs(
        Number(await page.locator('#land-radius').inputValue()) / screenWorld - Math.exp(-0.24),
      ) < 0.001,
    );
    assert.equal(Number(await page.locator('#land-radius-value').inputValue()), 65);
    await page.keyboard.down('Shift');
    await page.mouse.wheel(0, -80);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(200);
    await spatialReady();
    assert(
      Math.abs(
        Number(await page.locator('#land-radius-value').inputValue()) - 65 * Math.exp(0.16),
      ) < 0.01,
    );
    assert(
      Math.abs(
        Number(await page.locator('#land-radius').inputValue()) / screenWorld -
          Math.exp(-0.24 + 0.16),
      ) < 0.001,
    );
    await page.keyboard.down('Shift');
    await page.mouse.wheel(0, 80);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(200);
    await spatialReady();
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(350);
    await spatialReady();
    await setBrushWorldRadius(page, 'land-radius', '48');
    for (const tool of ['paint', 'clear', 'thin', 'dense', 'line']) {
      await page.locator('#vegetation-spatial-tool').selectOption(tool);
      await spatialReady();
      const radius = Number(await page.locator('#vegetation-spatial-radius').inputValue()),
        p = await center();
      await page.mouse.move(p.x, p.y);
      await page.keyboard.down('Shift');
      await page.mouse.wheel(0, -80);
      await page.keyboard.up('Shift');
      await page.waitForTimeout(200);
      assert(
        Math.abs(
          Number(await page.locator('#vegetation-spatial-radius').inputValue()) / radius -
            Math.exp(0.16),
        ) < 0.001,
        tool,
      );
      await page.keyboard.down('Shift');
      await page.mouse.wheel(0, 80);
      await page.keyboard.up('Shift');
      await page.waitForTimeout(200);
      assert(
        Math.abs(
          Number(await page.locator('#vegetation-spatial-radius').inputValue()) / radius - 1,
        ) < 0.001,
        tool,
      );
    }
    await page.locator('#vegetation-spatial-tool').selectOption('height');
    await spatialReady();
    mark('Shift + Mausrad ändert räumliche Gelände- und Bewuchsradien ohne Kamerazoom');
    mark(
      'Räumlicher Bildschirmradius bleibt beim Zoom konstant; Umrechnung folgt der orthografischen Projektion',
    );
    await range('terrain-spatial-exaggeration', 15);
    assert.equal(await page.locator('#terrain-spatial-exaggeration').inputValue(), '4');
    assert.equal(heights(), original);
    await setHeightDirection(page, 'lower');
    await page.locator('#land-height-target-enabled').check();
    await page.locator('#land-height-target').fill('10');
    const p = await center();
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForFunction(
      () => document.querySelector('#vegetation-spatial-canvas').dataset.terrainDraft === 'ready',
      null,
      { timeout: 60000 },
    );
    const heldRadius = await page.locator('#land-radius').inputValue();
    await page.keyboard.down('Shift');
    await page.mouse.wheel(0, -80);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#land-radius').inputValue(), heldRadius);
    assert.equal(heights(), original);
    await capture('01-lowered-preview');
    await page.mouse.up();
    await spatialReady();
    assert(height().heightM < before.heightM - 20);
    assert(Math.abs(height().heightM - 10) < 1);
    const lowered = heights();
    mark(
      'Gekippten Pass bei vierfacher Überhöhung absenken: Vorschau schreibt nichts, tatsächliche Meter und Zielhöhe stimmen',
    );
    await page.locator('#vegetation-top-view').click();
    await capture('02-pass-top');
    assert.equal(heights(), lowered);
    await page.locator('#vegetation-spatial-undo').click();
    await spatialReady();
    assert.equal(heights(), original);
    await page.locator('#vegetation-spatial-redo').click();
    await spatialReady();
    assert.equal(heights(), lowered);
    mark('Draufsicht und gekippte Ansicht teilen exakt einen Undo-/Redo-Schritt');
    await page.locator('#land-height-target-enabled').uncheck();
    const unchanged = heights();
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForFunction(
      () => document.querySelector('#vegetation-spatial-canvas').dataset.terrainDraft === 'ready',
    );
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.equal(heights(), unchanged);
    assert(await page.locator('#vegetation-spatial-canvas').isVisible());
    mark('Escape verwirft die räumliche Höhenvorschau ohne Autorenänderung');
    await setHeightDirection(page, 'raise');
    await page.locator('#land-height-target-enabled').uncheck();
    await page.locator('#land-height-strength').fill('60');
    await press(200);
    const peak = height().heightM;
    await page.locator('#vegetation-spatial-tool').selectOption('smooth');
    await setBrushWorldRadius(page, 'land-radius', '48');
    await page.locator('#land-height-strength').fill('300');
    await press();
    assert(height().heightM < peak);
    assert(height().heightM >= 10);
    mark('Glätten wirkt auf denselben Höhenkern und erhält die Grenzen der Nachbarschaft');
    await page.locator('#vegetation-spatial-tool').selectOption('color');
    await setBrushWorldRadius(page, 'land-radius', '48');
    await page.locator('#land-tip').selectOption('round');
    await page.locator('#land-color-operation').selectOption('paint');
    const preColor = heights();
    await press();
    assert.equal(heights(), preColor);
    assert(all().some((r) => r.paint?.operation === 'paint'));
    await page.locator('#land-color-operation').selectOption('erase');
    await press();
    assert.equal(heights(), preColor);
    assert(all().some((r) => r.paint?.operation === 'erase'));
    await capture('03-color-and-smooth');
    mark('Land bemalen und Farbradierung sind in 3D bedienbar und verändern keine Höhen');
    await page.locator('#vegetation-spatial-tool').selectOption('height');
    await page.locator('#land-height-target-enabled').uncheck();
    const baseline = heights();
    const fault = new Database(dir + '/workbench.sqlite');
    fault.exec('BEGIN IMMEDIATE');
    await press(200);
    await page.waitForFunction(() => document.body.textContent.includes('database is locked'));
    assert.equal(heights(), baseline);
    fault.exec('ROLLBACK');
    fault.close();
    await page.locator('#vegetation-spatial-finish').click();
    await spatialReady();
    assert.notEqual(heights(), baseline);
    await page.locator('#vegetation-spatial-undo').click();
    await spatialReady();
    assert.equal(heights(), baseline);
    mark(
      'Schreibfehler erhält den Entwurf; Wiederholen speichert, ein Undo stellt den Ausgang wieder her',
    );
    await setHeightDirection(page, 'lower');
    await page.locator('#land-height-strength').fill('300');
    await page.locator('#land-height-target-enabled').check();
    await page.locator('#land-height-target').fill('-20');
    await press(800);
    assert(height().water);
    await capture('04-new-coast');
    await page.locator('#vegetation-tilted-view').click();
    await capture('04-new-coast-tilted');
    assert(height().water);
    await page.locator('#vegetation-spatial-undo').click();
    await spatialReady();
    assert.equal(heights(), baseline);
    mark(
      'Absenken unter Meeresspiegel erzeugt dieselbe Küste in beiden Ansichten; Undo stellt Land und Höhen wieder her',
    );
    await page.locator('#vegetation-tilted-view').click();
    await page.locator('#vegetation-spatial-close').click();
    await atlasCanvasReady(page);
    assert.equal(await page.locator('#land-radius').inputValue(), '48');
    assert.equal(heights(), baseline);
    const returnedCamera = await camera();
    assert(
      Math.abs(
        returnedCamera.view.x +
          returnedCamera.view.width / 2 -
          startingCamera.view.x -
          startingCamera.view.width / 2,
      ) < 0.01,
    );
    assert(
      Math.abs(
        returnedCamera.view.y +
          returnedCamera.view.height / 2 -
          startingCamera.view.y -
          startingCamera.view.height / 2,
      ) < 0.01,
    );
    await capture('04-return-to-map');
    await page.locator('#vegetation-spatial').click();
    await spatialReady();
    assert.equal(await page.locator('#terrain-spatial-exaggeration').inputValue(), '4');
    await capture('05-reopen-view');
    await page.locator('#vegetation-top-view').click();
    await range('terrain-spatial-exaggeration', 0);
    await page.locator('#vegetation-spatial-tool').selectOption('select');
    const roadCanvas = await page.locator('#vegetation-spatial-canvas').boundingBox(),
      roadScale = Math.min(
        roadCanvas.width / returnedCamera.view.width,
        roadCanvas.height / returnedCamera.view.height,
      ),
      roadPick = await center();
    await page.mouse.click(
      roadPick.x + (-278 - returnedCamera.view.x - returnedCamera.view.width / 2) * roadScale,
      roadPick.y +
        (-30 + (2 / 540) * 60 - returnedCamera.view.y - returnedCamera.view.height / 2) * roadScale,
    );
    await page.locator('#vegetation-spatial-canvas').waitFor({ state: 'detached' });
    await page.waitForFunction(
      (id) => document.querySelector('#land-selection')?.dataset.selectionId === id,
      all().find((r) => r.kind === 'road').id,
    );
    mark('Auswahl des sichtbaren Weges öffnet denselben Atlasdatensatz und Inspektor');
    await atlasCanvasReady(page);
    const expected = all();
    await close();
    await start();
    assert.deepEqual(all(), expected);
    await capture('06-fresh-process');
    await close();
    mark(
      'Rückkehr erhält Ausschnitt und Werkzeuge; Ansichtsüberhöhung bleibt visuell, frischer Prozess erhält gespeicherte Höhen',
    );
    assert.deepEqual(result.errors, []);
    result.complete = true;
  } catch (e) {
    result.complete = false;
    result.error = e.stack;
    await page?.screenshot({ path: out + '/failure.png' }).catch(() => {});
    throw e;
  } finally {
    await native.recordResult(result);
    db.close();

    console.log(
      JSON.stringify({ complete: result.complete, out, checks: result.checks, profile: dir }),
    );
  }
});
