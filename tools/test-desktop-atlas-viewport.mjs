// Resize, hidden/reopened workspace and picking on the ordinary Atlas camera.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { atlasCanvasReady, atlasCanvasPoint } from './atlas-canvas-probe.mjs';
import { createNativeSession } from './native-session.mjs';

const root = process.cwd(),
  require = createRequire(root + '/package.json');
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-viewport-native');
await mkdir(out, { recursive: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/viewport-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/viewport-store.cjs');
const native = await createNativeSession({ root, output: out, name: 'atlas-viewport' });
const store = new CampaignStore(native.profile + '/workbench.sqlite');
store.create('Ausschnittprüfung', [
  {
    id: 'viewport-room',
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
  },
]);
store.tutorial('skipped');
store.close();
const cases = [];
try {
  const page = await native.launch(),
    app = native.app;
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Ausschnittprüfung' })
    .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
  );
  if (await page.locator('#campaign-atlas').isHidden()) await page.locator('#atlas-tab').click();
  await atlasCanvasReady(page);
  await page.locator('#atlas-search').fill('Wachstube');
  await page.locator('#atlas-search-results button').filter({ hasText: 'Wachstube' }).click();
  await page.locator('#atlas-search').fill('');
  await atlasCanvasReady(page);

  async function camera() {
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await atlasCanvasReady(page);
    return page.locator('#campaign-map').evaluate((canvas) => {
      const b = JSON.parse(canvas.dataset.atlasView);
      return {
        cx: b.x + b.width / 2,
        cy: b.y + b.height / 2,
        mpp: b.width / canvas.clientWidth,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        aspect: b.width / b.height,
      };
    });
  }
  async function verify(name, before) {
    const after = await camera();
    for (const key of ['cx', 'cy', 'mpp'])
      assert(Math.abs(before[key] - after[key]) < 1e-7, name + ': ' + key);
    assert(Math.abs(after.aspect - after.width / after.height) < 1e-7, name + ': aspect');
    cases.push({ name, before, after });
  }
  async function pickRoom() {
    await page.locator('#atlas-select').click();
    if (await page.locator('#atlas-secondary').isVisible())
      await page.locator('#atlas-secondary-close').click();
    assert(await page.locator('#room-name').isHidden(), 'Room details start closed');
    const p = await atlasCanvasPoint(page, { x: 6, y: 4 }, false);
    await page.mouse.click(p.x, p.y);
    await page.locator('#room-name').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#room-name')?.value === 'Wachstube');
  }
  await pickRoom();
  const beforePanel = await camera();
  await page.locator('#atlas-panel-width').focus();
  await page.keyboard.press('ArrowRight');
  await verify('tool-panel-resize', beforePanel);
  if (await page.locator('#atlas-secondary').isHidden())
    await page.locator('#atlas-context-toggle').click();
  const beforeDetails = await camera();
  await page.locator('#atlas-secondary-close').click();
  await verify('details-close', beforeDetails);
  for (const [width, height, zoom] of [
    [1600, 900, 1],
    [960, 720, 1],
    [1280, 880, 2],
    [1280, 880, 1],
  ]) {
    const before = await camera();
    await app.evaluate(
      ({ BrowserWindow }, { width, height, zoom }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.setMinimumSize(320, 240);
        w.setContentSize(width, height);
        w.webContents.setZoomFactor(zoom);
      },
      { width, height, zoom },
    );
    await verify(`window-${width}-${height}-zoom-${zoom}`, before);
    await pickRoom();
  }
  await native.capture(page, 'resized-room');
  await page.locator('#atlas-navigation').click();
  await page.locator('#atlas-exit').click();
  await page.waitForFunction(() => document.body.classList.contains('campaign-screen-open'));
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Ausschnittprüfung' })
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
  await pickRoom();
  cases.push({ name: 'return-from-hidden-workspace', camera: await camera() });
  await native.capture(page, 'returned-room');
  await native.close();
  await native.finish({ complete: true, cases });
  console.log(JSON.stringify({ complete: true, out, cases: cases.map((c) => c.name) }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
