// Actual Workbench camera, distant terrain, output and normal reopen in an isolated profile.
import assert from 'node:assert/strict';
import { createNativeSession } from './native-session.mjs';
import { createAtlasCanonicalFixture } from './atlas-canonical-fixture.mjs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const root = process.cwd(),
  require = createRequire(import.meta.url);
const native = await createNativeSession({
    root,
    output: process.env.QA_EVIDENCE_DIR ?? root + '/.build/atlas-camera-coverage',
    name: 'atlas-camera-coverage',
  }),
  errors = [],
  results = [];
try {
  const fixture = await createAtlasCanonicalFixture({
      profilePath: native.profile,
      campaignName: 'Geneigter Atlas',
    }),
    page = await native.launch();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        'atlas-camera:' + id,
        JSON.stringify({ x: -96, y: -64, width: 256, height: 192 }),
      ),
    fixture.campaignId,
  );
  await page
    .locator('.campaign-card')
    .filter({ hasText: 'Geneigter Atlas' })
    .getByRole('button', { name: /Öffnen|Fortsetzen/ })
    .click();
  await page.waitForFunction(
    () =>
      !document.querySelector('main').inert &&
      document.querySelector('#campaign-map')?.dataset.terrainQuality === 'detail',
    null,
    { timeout: 120000 },
  );
  await page.locator('#atlas-section').selectOption('terrain');
  if (await page.locator('#atlas-secondary').isVisible())
    await page.locator('#atlas-secondary-close').click();
  await page.locator('#atlas-view').click();
  for (const tilt of [45, 65, 75]) {
    await page.locator('#terrain-tilt').evaluate((input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, tilt);
    await page.waitForFunction(
      () => document.querySelector('#campaign-map').dataset.terrainQuality === 'detail',
      null,
      { timeout: 120000 },
    );
    // The shared surface publishes a complete coarse frame before detail. Wait for
    // image stability as well as the public readiness marker, without private hooks.
    let prior = '',
      stable = 0;
    for (let attempt = 0; attempt < 120 && stable < 3; attempt++) {
      await page.waitForTimeout(250);
      const next = await page.evaluate(() =>
        document.querySelector('#atlas-terrain-spatial canvas').toDataURL(),
      );
      stable = next === prior ? stable + 1 : 0;
      prior = next;
    }
    assert.equal(stable, 3, 'The final camera image settles');
    const pixels = await page.evaluate(() => {
      const c = document.querySelector('#atlas-terrain-spatial canvas'),
        gl = c.getContext('webgl2'),
        data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data,
      );
      let covered = 0,
        total = 0;
      for (let y = 0; y < gl.drawingBufferHeight * 0.45; y += 7)
        for (let x = 0; x < gl.drawingBufferWidth; x += 7) {
          total++;
          if (data[(y * gl.drawingBufferWidth + x) * 4 + 3] > 240) covered++;
        }
      return {
        covered,
        total,
        ready: document.querySelector('#campaign-map').dataset.terrainReady,
      };
    });
    assert.equal(pixels.ready, 'ready');
    assert(
      pixels.covered / pixels.total > 0.99,
      'The near half of the tilted viewport has no terrain holes',
    );
    await native.capture(page, 'tilt-' + tilt);
    results.push({ tilt, ...pixels });
  }
  await page.locator('#atlas-view').click();
  await page.locator('#atlas-output-open').click();
  await page.locator('#atlas-output details summary').click();
  await page.locator('#atlas-export-size').fill('2048');
  const file = native.profile + '/tilted.png';
  await native.app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, file);
  await page.locator('#atlas-export-png').click();
  await page.waitForFunction(
    () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
    null,
    { timeout: 120000 },
  );
  const png = require('pngjs').PNG.sync.read(await readFile(file));
  assert.equal(Math.max(png.width, png.height), 2048);
  assert.equal(errors.length, 0, errors.join('\n'));
  await native.close();
  await native.finish({ results, export: { width: png.width, height: png.height } });
  console.log(JSON.stringify(results));
} catch (e) {
  await native.fail(e);
  throw e;
} finally {
  await native.dispose();
}
