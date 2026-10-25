import { setBrushWorldRadius } from './atlas-brush-probe.mjs';
// Native layout/workflow regression. Synthetic profile only; no user campaign is opened.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json');
const { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/layout-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/layout-store.cjs'),
  Database = require('better-sqlite3');
const baseline = process.argv.includes('--baseline'),
  out = path.resolve(
    process.env.QA_EVIDENCE_DIR ?? '.build/atlas-layout-' + (baseline ? 'before' : 'after'),
  );
await mkdir(out, { recursive: true });
const profile = await mkdtemp('/tmp/saltmarcher-layout-'),
  store = new CampaignStore(profile + '/workbench.sqlite');
const room = {
  id: 'watch',
  scopeId: 'local',
  floorId: 'ground',
  number: '1',
  name: 'Wachstube',
  revision: 0,
  polygons: [
    {
      outer: [
        { x: 0, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 8 },
        { x: 0, y: 8 },
      ],
      holes: [],
    },
  ],
  sections: [],
};
const campaign = store.create('Atlaswerkstatt', [room]);
store.tutorial('skipped');
store.close();
const executable = process.env.ATLAS_PACKAGE
  ? path.join(process.env.ATLAS_PACKAGE, 'electron')
  : root + '/node_modules/electron/dist/electron';
const prefix = process.env.ATLAS_PACKAGE ? [] : [root + '/.build/desktop/main.cjs'];
const result = {
  baseline,
  profile,
  executable,
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  runtimeHashes: Object.fromEntries(
    await Promise.all(
      ['ui/renderer.js', 'ui/app.css'].map(async (file) => [
        file,
        createHash('sha256')
          .update(await readFile(root + '/.build/desktop/' + file))
          .digest('hex'),
      ]),
    ),
  ),
  frames: [],
  errors: [],
};
let app;
try {
  app = await _electron.launch({
    executablePath: executable,
    args: [...prefix, '--data-dir', profile, '--ozone-platform=x11'],
    timeout: 60000,
  });
  if (process.env.ATLAS_PACKAGE)
    assert.equal(
      await app.evaluate(({ app }) => app.getVersion()),
      require(root + '/package.json').version,
    );
  const page = await app.firstWindow();
  page.on('pageerror', (e) => {
    result.errors.push(e.stack ?? e.message);
    console.error(e.stack);
  });
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Atlaswerkstatt' })
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
  if (!baseline) await page.locator('#atlas-units').selectOption('metric'); // Existing fixture dimensions are meters.
  let frameWidth = 1280,
    frameHeight = 800,
    frameZoom = 1;
  async function frame(name, width = frameWidth, height = frameHeight, zoom = frameZoom) {
    frameWidth = width;
    frameHeight = height;
    frameZoom = zoom;
    await app.evaluate(
      ({ BrowserWindow }, s) => {
        const w = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'SaltMarcher');
        const frame = w.getBounds().height - w.getContentBounds().height;
        w.setMinimumSize(s.width, s.height + frame);
        w.setContentSize(s.width, s.height);
        w.setMinimumSize(320, 240);
        w.webContents.setZoomFactor(s.zoom);
      },
      { width, height, zoom },
    );
    await atlasCanvasReady(page);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const box = await page.locator('#campaign-map').boundingBox(),
      viewport = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        scroll: document.documentElement.scrollWidth > innerWidth,
      }));
    const actions = await page.locator('.atlas-command-bar button').evaluateAll((nodes) =>
      nodes
        .filter((n) => n.checkVisibility())
        .map((n) => {
          const b = n.getBoundingClientRect();
          return {
            id: n.id || n.getAttribute('aria-label'),
            left: b.left,
            right: b.right,
            top: b.top,
            bottom: b.bottom,
          };
        }),
    );
    const header = await page.locator('.atlas-command-bar').boundingBox();
    for (const b of actions)
      assert(
        b.left >= 0 &&
          b.right <= viewport.width &&
          b.top >= 0 &&
          b.bottom <= header.y + header.height,
        JSON.stringify(b),
      );
    const f = {
      name,
      box,
      viewport,
      actions,
      ratio: (box.width * box.height) / (viewport.width * viewport.height),
    };
    result.frames.push(f);
    const png = await app.evaluate(async ({ BrowserWindow }) =>
      (
        await BrowserWindow.getAllWindows()
          .find((w) => w.getTitle() === 'SaltMarcher')
          .webContents.capturePage()
      )
        .toPNG()
        .toString('base64'),
    );
    await writeFile(out + '/' + name + '.png', Buffer.from(png, 'base64'));
    return f;
  }
  const chooseSection = async (section) => {
    await page.locator('#atlas-section').selectOption(section);
    await atlasCanvasReady(page);
    await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
  };
  const chooseTool = async (group, tool) => {
    if ((await page.locator('#atlas-group-tools').getAttribute('data-group')) !== group)
      await page.locator('[data-tool-group="' + group + '"]').click();
    await page.locator('[data-atlas-tool="' + tool + '"]').click();
    await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
    await atlasCanvasReady(page);
  };
  const first = await frame('initial');
  if (!baseline) {
    assert(first.ratio >= 0.55, JSON.stringify(first));
    assert(!first.viewport.scroll);
    await page.locator('#atlas-search').fill('Wachstube');
    await page.locator('#atlas-search-results button').filter({ hasText: 'Wachstube' }).click();
    await atlasCanvasReady(page);
    await page.locator('#atlas-search').fill('');
    assert(await page.locator('#room-name').isVisible());
    assert.equal(await page.locator('#atlas-section option').count(), 3);
    assert(await page.locator('#atlas-group-tools').isVisible());
    assert.equal(await page.locator('#atlas-tool-groups button').count(), 4);
    assert(
      await page.locator('#atlas-tool-rail').evaluate((n) => n.scrollWidth <= n.clientWidth),
      'rail must not overflow horizontally',
    );
    assert.equal(
      await page.locator('#atlas-tool-rail').evaluate((n) => n.getBoundingClientRect().width),
      48,
    );
    assert(await page.locator('#atlas-tool-settings').isVisible());
    assert(
      await page.locator('#atlas-group-tools button').evaluateAll((nodes) =>
        nodes.every((n) => {
          const a = n.querySelector('.atlas-tool-icon').getBoundingClientRect(),
            b = n.querySelector('.atlas-tool-label').getBoundingClientRect();
          return b.top >= a.bottom && b.height > 0;
        }),
      ),
      'every tool has a visible caption below its icon',
    );
    assert.equal(await page.locator('#atlas-scale').count(), 0);
    await chooseTool('rooms', 'room-rectangle');
    assert.equal(await page.locator('#campaign-atlas').getAttribute('data-room-draw'), 'true');
    await chooseTool('walls', 'wall');
    assert.equal(
      await page.locator('#campaign-atlas').getAttribute('data-room-draw'),
      'false',
      'idle rectangle mode must not hijack the next tool',
    );
    await chooseTool('rooms', 'room-rectangle');
    const draftBox = await page.locator('#campaign-map').boundingBox();
    await page.mouse.click(draftBox.x + draftBox.width * 0.2, draftBox.y + draftBox.height * 0.2);
    await page.locator('[data-tool-group=walls]').click();
    await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
    assert.equal(await page.locator('#atlas-group-tools').getAttribute('data-group'), 'rooms');
    assert.equal(await page.locator('#campaign-atlas').getAttribute('data-room-draw'), 'true');
    await page.locator('#campaign-map').press('Escape');
    result.roomDraftSwitchBlocked = true;

    await chooseTool('rooms', 'room-rectangle');
    await page.locator('#atlas-select').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#campaign-atlas').dataset.family === 'interior' &&
        document.querySelector('#drawing-tool').value === 'select',
    );
    assert.equal(await page.locator('#atlas-select').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#campaign-atlas').getAttribute('data-room-draw'), 'false');
    result.idlePreviewSwitch = true;

    assert(await page.locator('#atlas-terrain').isHidden());
    assert(await page.locator('#atlas-hex-level').isHidden());

    await page.locator('#campaign-map').focus();
    await page.keyboard.press('Alt+p');
    assert.equal(
      await page.locator('#party-popover').evaluate((n) => n.matches(':popover-open')),
      false,
    );
    const camera = async () => {
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      return page.locator('#campaign-map').evaluate((n) => {
        const b = JSON.parse(n.dataset.atlasView),
          r = n.getBoundingClientRect();
        return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, mpp: b.width / r.width };
      });
    };
    const beforeTools = await camera();
    await page.locator('#atlas-select').click();
    await atlasCanvasReady(page);
    assert(await page.locator('#atlas-tool-settings').isVisible());
    const drawer = await page.locator('#atlas-tool-settings').boundingBox();
    assert.equal(drawer.x, 48);
    assert(drawer.width >= 220 && drawer.width <= 360);
    const openedTools = await camera();
    for (const k of ['cx', 'cy', 'mpp'])
      assert(Math.abs(beforeTools[k] - openedTools[k]) < 1e-7, k);
    await page.locator('#atlas-panel-width').focus();
    await page.keyboard.press('ArrowRight');
    await atlasCanvasReady(page);
    const resizedTools = await camera();
    for (const k of ['cx', 'cy', 'mpp'])
      assert(Math.abs(beforeTools[k] - resizedTools[k]) < 1e-7, k);
    await page.keyboard.press('ArrowLeft');
    await atlasCanvasReady(page);
    await frame('tool-settings-left');
    if (await page.locator('#atlas-secondary').isHidden())
      await page.locator('#atlas-context-toggle').click();
    await atlasCanvasReady(page);
    const stable = await camera();
    const history = await page
      .getByRole('button', { name: 'Vorige Ansicht', exact: true })
      .isDisabled();
    await page.locator('#atlas-secondary-close').click();
    await atlasCanvasReady(page);
    const closed = await camera();
    for (const k of ['cx', 'cy', 'mpp']) assert(Math.abs(stable[k] - closed[k]) < 1e-7, k);
    assert.equal(
      await page.getByRole('button', { name: 'Vorige Ansicht', exact: true }).isDisabled(),
      history,
    );
    await page.getByRole('button', { name: 'Vergrößern', exact: true }).click();
    await atlasCanvasReady(page);
    assert(await page.locator('#atlas-secondary').isHidden());
    assert(await page.locator('#atlas-tool-settings').isVisible());
    await page.getByRole('button', { name: 'Vorige Ansicht', exact: true }).click();
    await atlasCanvasReady(page);
    await page.locator('#atlas-context-toggle').click();
    await atlasCanvasReady(page);
    const beforeResize = await camera();
    await page.locator('#atlas-details-width').focus();
    await page.keyboard.press('ArrowLeft');
    await atlasCanvasReady(page);
    const afterResize = await camera();
    for (const k of ['cx', 'cy', 'mpp'])
      assert(Math.abs(beforeResize[k] - afterResize[k]) < 1e-7, k);
    await page.keyboard.press('ArrowRight');
    await atlasCanvasReady(page);
    result.cameraPreserved = true;
    result.detailsStayClosed = true;
    result.partyBlocked = true;

    await page.locator('#key-open').click();
    await page.locator('#key-read-aloud').waitFor({ state: 'visible' });
    await page.locator('#key-read-aloud').fill('Vor dem Tor wartet eine müde Wache.');
    await page.locator('#atlas-secondary-close').click();
    await page.locator('#atlas-context-toggle').click();
    assert.equal(
      await page.locator('#key-read-aloud').inputValue(),
      'Vor dem Tor wartet eine müde Wache.',
    );
    await chooseSection('terrain');
    assert(await page.locator('#key-read-aloud').isVisible());
    assert.equal(
      await page.locator('#key-read-aloud').inputValue(),
      'Vor dem Tor wartet eine müde Wache.',
    );
    await page.locator('#key-save').click();
    await page.waitForFunction(
      () => document.querySelector('#key-save-status').dataset.state === 'saved',
    );
    await frame('room-description');
    await page.locator('#key-close').click();
    await page.locator('#atlas-view').click();
    await page.locator('#atlas-tools-toggle').click();
    await page.keyboard.press('Escape');
    const collapsed = await frame('collapsed');
    assert(collapsed.ratio >= 0.9);
    await page.locator('#atlas-view').click();
    await page.locator('#atlas-tools-toggle').click();
    await page.keyboard.press('Escape');
    await page.locator('#atlas-view').click();
    await page.locator('#atlas-focus-map').click();
    await page.keyboard.press('Escape');
    const max = await frame('maximized');
    assert(max.ratio >= 0.9);
    await page.locator('#atlas-view').click();
    await page.locator('#atlas-tools-toggle').click();
    await page.keyboard.press('Escape');
    await chooseSection('terrain');
    // A real landscape gesture and shared history through the new direct route.
    if (await page.locator('#atlas-secondary').isVisible())
      await page.locator('#atlas-secondary-close').click();
    await chooseTool('land', 'land-shape');
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset.atlasTool),
      'land-shape',
    );
    await page.keyboard.press('Tab');
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset.atlasTool),
      'land-color',
    );
    await setBrushWorldRadius(page, 'land-radius', '2');
    const paintBox = await page.locator('#campaign-map').boundingBox();
    await page.mouse.move(paintBox.x + paintBox.width * 0.2, paintBox.y + paintBox.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(paintBox.x + paintBox.width * 0.3, paintBox.y + paintBox.height * 0.35, {
      steps: 5,
    });
    await page.mouse.up();
    await page.waitForFunction(
      () => document.querySelector('#land-status').textContent === 'Gespeichert',
    );
    await atlasCanvasReady(page);
    const landscapeCount = () => {
      const d = new Database(profile + '/workbench.sqlite', { readonly: true });
      try {
        return d.prepare('SELECT count(*) n FROM atlas_landscape').get().n;
      } finally {
        d.close();
      }
    };
    const painted = landscapeCount();
    assert(painted > 0);
    await page.locator('#atlas-undo').click();
    await page.waitForFunction(() => !document.querySelector('#atlas-redo').disabled);
    await atlasCanvasReady(page);
    assert(landscapeCount() < painted);
    await page.locator('#atlas-redo').click();
    await page.waitForFunction(() => document.querySelector('#atlas-redo').disabled);
    await atlasCanvasReady(page);
    assert.equal(landscapeCount(), painted);
    result.landscapeHistory = true;
    await chooseTool('water', 'river');
    await page.locator('#land-width').fill('31');
    await page.locator('[data-tool-group=land]').click();
    await chooseTool('water', 'river');
    assert.equal(await page.locator('#land-width').inputValue(), '31');
    const box = await page.locator('#campaign-map').boundingBox();
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await page.locator('[data-tool-group=land]').click();
    await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
    assert.equal(await page.locator('#land-tool').inputValue(), 'river');
    assert.equal(await page.locator('#atlas-group-tools').getAttribute('data-group'), 'water');
    await page.locator('#atlas-section').selectOption('city');
    await page.waitForFunction(() => !document.querySelector('#atlas-section').disabled);
    assert.equal(await page.locator('#atlas-section').inputValue(), 'terrain');
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.55);
    result.draftSwitchBlocked = true;
    await page.locator('#campaign-map').press('Enter');
    await page.waitForFunction(
      () => document.querySelector('#land-status').textContent === 'Gespeichert',
    );
    await frame('river');
    const before = await page.locator('#campaign-map').getAttribute('data-atlas-view');
    await page.locator('#campaign-map').focus();
    await page.keyboard.down('Space');
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5 + 35, box.y + box.height * 0.5 + 20, {
      steps: 4,
    });
    await page.mouse.up();
    await page.keyboard.up('Space');
    await atlasCanvasReady(page);
    assert.notEqual(await page.locator('#campaign-map').getAttribute('data-atlas-view'), before);
    // Exercise the re-arranged city controls, generated preview, room authoring and export.
    await frame('city-workspace', 1600, 900);
    await chooseSection('city');
    if (await page.locator('#atlas-secondary').isVisible())
      await page.locator('#atlas-secondary-close').click();
    await page.locator('#atlas-create-city').click();
    await page.locator('#atlas-new-name').fill('Eichenfurt');
    let map = await page.locator('#campaign-map').boundingBox();
    await page.mouse.click(map.x + map.width * 0.6, map.y + map.height * 0.6);
    await page.waitForFunction(
      () =>
        document.querySelector('#campaign-atlas').dataset.family === 'city' &&
        document.querySelector('#atlas-selection-title').textContent === 'Eichenfurt',
    );
    await atlasCanvasReady(page);
    await chooseTool('roads', 'road');
    map = await page.locator('#campaign-map').boundingBox();
    for (const [x, y] of [
      [0.25, 0.5],
      [0.75, 0.5],
    ])
      await page.mouse.click(map.x + map.width * x, map.y + map.height * y);
    await page.locator('#campaign-map').press('Enter');
    await page.waitForFunction(
      () => !document.querySelector('#city-path-hint').textContent.includes('2 Punkte'),
    );
    await atlasCanvasReady(page);
    await chooseTool('areas', 'district');
    for (const [x, y] of [
      [0.25, 0.3],
      [0.75, 0.3],
      [0.75, 0.7],
      [0.25, 0.7],
    ])
      await page.mouse.click(map.x + map.width * x, map.y + map.height * y);
    await page.locator('#campaign-map').press('Enter');
    await page.waitForFunction(() => document.querySelector('#city-district').options.length > 0);
    await atlasCanvasReady(page);
    await chooseTool('buildings', 'generation');
    await page.locator('#city-generate').click();
    await page.locator('#city-preview-actions').waitFor({ state: 'visible' });
    await frame('city-preview');
    await page.locator('#city-preview-accept').click();
    await page.locator('#city-preview-actions').waitFor({ state: 'hidden' });
    await atlasCanvasReady(page);
    await page.locator('#atlas-undo').click();
    await page.waitForFunction(() => !document.querySelector('#atlas-redo').disabled);
    await atlasCanvasReady(page);
    await page.locator('#atlas-redo').click();
    await page.waitForFunction(() => document.querySelector('#atlas-redo').disabled);
    await atlasCanvasReady(page);
    result.cityHistory = true;
    await page.locator('#atlas-secondary-close').click();
    const cityDb = new Database(profile + '/workbench.sqlite', { readonly: true });
    const houseRow = cityDb
        .prepare("SELECT payload,city_id FROM city_unit WHERE kind='building' LIMIT 1")
        .get(),
      house = JSON.parse(houseRow.payload),
      binding = cityDb
        .prepare("SELECT x,y,angle FROM atlas_binding WHERE kind='city' AND owner_id=?")
        .get(houseRow.city_id);
    cityDb.close();
    await page.locator('#atlas-select').click();
    await atlasCanvasReady(page);
    map = await page.locator('#campaign-map').boundingBox();
    const cityView = JSON.parse(
      await page.locator('#campaign-map').getAttribute('data-atlas-view'),
    );
    const c = house.outline.reduce(
        (p, q) => ({ x: p.x + q.x / house.outline.length, y: p.y + q.y / house.outline.length }),
        { x: 0, y: 0 },
      ),
      a = house.angle ?? 0,
      hp = {
        x: house.position.x + c.x * Math.cos(a) - c.y * Math.sin(a),
        y: house.position.y + c.x * Math.sin(a) + c.y * Math.cos(a),
      },
      world = {
        x: binding.x + hp.x * Math.cos(binding.angle) - hp.y * Math.sin(binding.angle),
        y: binding.y + hp.x * Math.sin(binding.angle) + hp.y * Math.cos(binding.angle),
      };
    await page.mouse.click(
      map.x + ((world.x - cityView.x) / cityView.width) * map.width,
      map.y + ((world.y - cityView.y) / cityView.height) * map.height,
    );
    await page.waitForFunction(
      () =>
        document.querySelector('#atlas-hit-candidates').open ||
        document.querySelector('#city-unit-name').checkVisibility(),
    );
    if (await page.locator('#atlas-hit-candidates').isVisible())
      await page
        .locator('#atlas-hit-candidates button')
        .filter({ hasText: /^Haus:/ })
        .first()
        .click();
    await atlasCanvasReady(page);
    await page.locator('#city-unit-name').fill('Haus am Brunnen');
    await page.locator('#city-unit-form button[type="submit"]').click();
    await atlasCanvasReady(page);
    result.houseEdited = true;
    await page.locator('#atlas-search').fill('Wachstube');
    await page.locator('#atlas-search-results button').filter({ hasText: 'Wachstube' }).click();
    await page.locator('#atlas-search').fill('');
    await atlasCanvasReady(page);
    await chooseTool('rooms', 'room-rectangle');
    await page.locator('#drawing-room-name').fill('Archiv');
    map = await page.locator('#campaign-map').boundingBox();
    await page.mouse.move(map.x + map.width * 0.65, map.y + map.height * 0.65);
    await page.mouse.down();
    await page.mouse.move(map.x + map.width * 0.8, map.y + map.height * 0.8, { steps: 5 });
    await page.mouse.up();
    await page.waitForFunction(
      () => document.querySelector('#atlas-selection-title').textContent === 'Archiv',
    );
    await atlasCanvasReady(page);
    await frame('new-room');
    await chooseTool('objects', 'object');
    assert(await page.locator('#drawing-object').isVisible());
    assert(await page.locator('#drawing-element-size').isVisible());
    await page.locator('#atlas-secondary-close').click();
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await atlasCanvasReady(page);
    map = await page.locator('#campaign-map').boundingBox();
    await page.mouse.click(map.x + map.width * 0.5, map.y + map.height * 0.5);
    await page.waitForFunction(
      () =>
        !document.querySelector('#drawing-finish').hidden &&
        !document.querySelector('#drawing-finish').disabled,
    );
    await page.locator('#campaign-map').press('Enter');
    await atlasCanvasReady(page);
    await page.locator('#drawing-element-name').waitFor({ state: 'visible' });
    await page.locator('#drawing-element-name').fill('Lesepult');
    await page.locator('#drawing-element-form button[type="submit"]').click();
    await atlasCanvasReady(page);
    result.objectEdited = true;
    await page.locator('#atlas-undo').click();
    await page.waitForFunction(() => !document.querySelector('#atlas-redo').disabled);
    await atlasCanvasReady(page);
    await page.locator('#atlas-redo').click();
    await page.waitForFunction(() => document.querySelector('#atlas-redo').disabled);
    await atlasCanvasReady(page);
    result.objectHistory = true;

    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, out + '/atlas.png');
    await page.locator('#atlas-output-open').click();
    await page.locator('#atlas-export-png').click();
    await page.waitForFunction(
      () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
    );
    await page.locator('#atlas-output-back').click();
    const beforeMenus = await page.locator('#campaign-map').boundingBox();
    for (const id of ['atlas-view', 'atlas-import', 'atlas-navigation', 'atlas-status']) {
      await page.locator('#' + id).click();
      assert.deepEqual(await page.locator('#campaign-map').boundingBox(), beforeMenus);
      await page.keyboard.press('Escape');
    }
    await page.locator('#atlas-navigation').click();
    await page.locator('#atlas-exit').click();
    await page.waitForFunction(() => document.body.classList.contains('campaign-screen-open'));
    assert(await page.locator('#campaign-screen').isVisible());
    await page
      .locator('.campaign-card')
      .filter({ hasText: 'Atlaswerkstatt' })
      .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
      .click();
    await page.waitForFunction(
      () =>
        document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
    );
    assert(!(await page.evaluate(() => document.body.classList.contains('atlas-workspace'))));
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('Alt+p');
    assert(await page.locator('#party-popover').evaluate((n) => n.matches(':popover-open')));
    await page.keyboard.press('Alt+p');
    await page.locator('#live-tab').click();
    await page.locator('#live').waitFor({ state: 'visible' });
    assert(await page.locator('#party-shortcut').isVisible());
    result.runtimeOutsideEditor = true;
    await page.locator('#atlas-tab').click();
    await atlasCanvasReady(page);
    await frame('returned');
    for (const [w, h, z] of [
      [1280, 880, 1],
      [1600, 900, 1],
      [1920, 1080, 1],
      [640, 480, 1],
      [1280, 880, 2],
    ]) {
      const f = await frame('viewport-' + w + '-' + z, w, h, z);
      assert(!f.viewport.scroll);
      assert(
        await page
          .locator('#atlas-group-tools,.atlas-dock-body,#atlas-tool-groups')
          .evaluateAll((nodes) => nodes.every((n) => n.scrollWidth <= n.clientWidth)),
        JSON.stringify(
          await page
            .locator('#atlas-group-tools,.atlas-dock-body,#atlas-tool-groups')
            .evaluateAll((nodes) =>
              nodes.map((n) => ({
                id: n.id || n.className,
                w: n.clientWidth,
                scroll: n.scrollWidth,
                wide: [...n.querySelectorAll('*')]
                  .filter(
                    (c) =>
                      c.checkVisibility() &&
                      c.getBoundingClientRect().right > n.getBoundingClientRect().right,
                  )
                  .map((c) => ({
                    id: c.id,
                    tag: c.tagName,
                    w: c.getBoundingClientRect().width,
                    right: c.getBoundingClientRect().right,
                  })),
              })),
            ),
        ),
      );
      if (z === 1 && w >= 1200) assert(f.ratio >= 0.55);
      await page.locator('#atlas-view').click();
      await page.locator('#atlas-reference-open').click();
      await page.locator('#atlas-reference-search').fill('Deutschland');
      await page
        .locator('#atlas-reference-results button')
        .filter({ hasText: /^Deutschland ·/ })
        .first()
        .click();
      await atlasCanvasReady(page);
      assert(
        await page
          .locator('#atlas-secondary-content')
          .evaluate((n) => n.scrollWidth <= n.clientWidth),
        'right controls fit',
      );
      assert(await page.locator('#atlas-create-city').isHidden());
      if (w / z < 1188) {
        assert.equal(await page.locator('#campaign-atlas').getAttribute('data-overlay'), 'true');
        assert.deepEqual(await page.locator('#campaign-map').boundingBox(), f.box);
      }
      await page.locator('#atlas-secondary-close').click();
      await page.locator('#campaign-map').focus();
      await page.keyboard.press('Escape');
      await atlasCanvasReady(page);
    }
  }
  assert.deepEqual(result.errors, []);
  const exit = new Promise((r) =>
    app.process().once('exit', (code, signal) => r({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === 'SaltMarcher')
      .close(),
  );
  result.exit = await exit;
  assert.deepEqual(result.exit, { code: 0, signal: null });
  app = null;
  if (!baseline) {
    app = await _electron.launch({
      executablePath: executable,
      args: [...prefix, '--data-dir', profile, '--ozone-platform=x11'],
      timeout: 60000,
    });
    const reopened = await app.firstWindow();
    reopened.on('pageerror', (e) => result.errors.push(e.stack ?? e.message));
    await reopened.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
    await reopened
      .locator('.campaign-card')
      .filter({ hasText: 'Atlaswerkstatt' })
      .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
      .click();
    await reopened.waitForFunction(
      () =>
        document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'SaltMarcher')
        .webContents.setZoomFactor(1),
    );
    if (await reopened.locator('#campaign-atlas').isHidden()) {
      if (!(await reopened.locator('#atlas-tab').isVisible()))
        await reopened.locator('#workspace-nav-summary').click();
      await reopened.locator('#atlas-tab').click();
    }
    await atlasCanvasReady(reopened);
    await reopened.locator('#atlas-search').fill('Archiv');
    await reopened.locator('#atlas-search-results button').filter({ hasText: 'Archiv' }).click();
    await atlasCanvasReady(reopened);
    assert.equal(await reopened.locator('#atlas-selection-title').textContent(), 'Archiv');
    const exitAgain = new Promise((r) =>
      app.process().once('exit', (code, signal) => r({ code, signal })),
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'SaltMarcher')
        .close(),
    );
    result.reopenExit = await exitAgain;
    assert.deepEqual(result.reopenExit, { code: 0, signal: null });
    app = null;
    assert.deepEqual(result.errors, []);
  }
  if (!baseline) {
    const verified = new CampaignStore(profile + '/workbench.sqlite');
    const w = verified.activate(campaign.id);
    assert(w.rooms.some((r) => r.name === 'Archiv'));
    assert(
      verified.db
        .prepare("SELECT 1 FROM city_unit WHERE json_extract(payload,'$.name')='Haus am Brunnen'")
        .get(),
    );
    assert(
      verified.db
        .prepare("SELECT 1 FROM drawing_element WHERE json_extract(payload,'$.name')='Lesepult'")
        .get(),
    );
    const drawing = verified.drawing(w.token);
    assert(JSON.stringify(drawing).includes('Vor dem Tor wartet eine müde Wache.'));
    const cities = verified.cities(w.token);
    result.persisted = { rooms: w.rooms.length, cities: cities.cities?.length ?? null };
    verified.close();
  }
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (e) {
  result.failure = e.stack;
  if (app)
    await (await app.firstWindow()).screenshot({ path: out + '/failure.png' }).catch(() => {});
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
  throw e;
} finally {
  if (app) {
    const proc = (() => {
        try {
          return app.process();
        } catch {
          return null;
        }
      })(),
      cleanup = setTimeout(() => proc?.kill('SIGKILL'), 5000);
    try {
      await app.close().catch(() => {});
    } finally {
      clearTimeout(cleanup);
    }
  }
}
