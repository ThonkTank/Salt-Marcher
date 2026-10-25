// Reproduce intermediate-scale stalls and optionally observe bounded native memory.
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { mixedWorldInventory } from './atlas-mixed-world-fixture.mjs';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  Database = require('better-sqlite3');
const input = process.env.ATLAS_MIXED_SOURCE;
assert(input, 'Set ATLAS_MIXED_SOURCE to a retained synthetic world, never a live user database');
const minutes = Number(process.env.ATLAS_NAVIGATION_MINUTES ?? 0);
assert(Number.isFinite(minutes) && minutes >= 0 && minutes <= 60);
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-scale-roundtrip'),
  native = await createNativeSession({
    root,
    output: out,
    name: 'atlas-navigation-soak',
  });
const original = new Database(input, { readonly: true });
await original.backup(native.profile + '/workbench.sqlite');
const campaign = original.prepare('SELECT id,name FROM campaign').get(),
  inventory = mixedWorldInventory(original, campaign.id);
original.close();
assert(
  inventory.buildings >= 5000 && inventory.dungeonRooms > 4000,
  'Use the populated mixed-world fixture',
);
const filename = native.profile + '/workbench.sqlite',
  durationMs = minutes * 60 * 1000,
  wait = (ms) => new Promise((r) => setTimeout(r, ms));
function canonical() {
  const db = new Database(filename, { readonly: true }),
    hash = createHash('sha256');
  try {
    for (const table of ['atlas_landscape', 'room', 'drawing_element', 'atlas_territory'])
      for (const row of db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').iterate())
        hash.update(JSON.stringify(row));
    return {
      sha256: hash.digest('hex'),
      atlas: db.prepare('SELECT campaign_id,revision FROM campaign_atlas').get(),
    };
  } finally {
    db.close();
  }
}
const before = canonical(),
  result = {
    purpose:
      'Repeated main-Atlas navigation on the mixed world. No forced GC, no editing; this is not the full navigation-and-editing plateau qualification.',
    durationMs,
    canonicalBefore: before,
    inventory,
    samples: [],
    cycles: [],
    probeSha256: createHash('sha256')
      .update(await readFile(import.meta.filename))
      .digest('hex'),
  };
let page, cdp, start;
async function ready() {
  await atlasCanvasReady(page);
  await page.waitForFunction(
    () => document.querySelector('#campaign-map').dataset.terrainReady === 'ready',
    null,
    { timeout: 60000 },
  );
}
async function zoom(width) {
  for (let n = 0; n < 40; n++) {
    const old = await page
        .locator('#campaign-map')
        .evaluate((n) => JSON.parse(n.dataset.atlasView).width),
      ratio = width / old;
    if (Math.abs(Math.log(ratio)) < 0.02) {
      await ready();
      return;
    }
    const b = await page.locator('#campaign-map').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, Math.log(ratio) / 0.002);
    await page.waitForFunction(
      (w) =>
        Math.abs(
          JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width / w - 1,
        ) > 0.005,
      old,
    );
    await ready();
  }
  throw Error('Scale not reached');
}
async function sample(cycle, scale) {
  const processes = await native.app.evaluate(({ app }) => app.getAppMetrics());
  for (const p of processes) {
    const text = await readFile('/proc/' + p.pid + '/smaps_rollup', 'utf8').catch(() => null);
    p.pssKb = text ? Number(text.match(/^Pss:\s+(\d+)/m)?.[1]) : null;
  }
  const row = {
    cycle,
    scale,
    elapsedMs: performance.now() - start,
    heap: await cdp.send('Runtime.getHeapUsage'),
    processes,
    pssKb: processes.every((p) => p.pssKb !== null)
      ? processes.reduce((n, p) => n + p.pssKb, 0)
      : null,
    canvas: await page.locator('#campaign-map').evaluate((n) => ({ ...n.dataset })),
  };
  result.samples.push(row);
  await writeFile(out + '/progress.json', JSON.stringify(result, null, 2));
  return row;
}
try {
  page = await native.launch();
  await native.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1440, 900),
  );
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        'atlas-camera:' + id,
        JSON.stringify({
          x: -20000000,
          y: -12500000,
          width: 40000000,
          height: 25000000,
        }),
      ),
    before.atlas.campaign_id,
  );
  await page
    .locator('.campaign-card')
    .filter({ hasText: campaign.name })
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
  await ready();
  cdp = await page.context().newCDPSession(page);
  start = performance.now();
  await sample(-1, 40000000);
  for (let cycle = 0; cycle === 0 || performance.now() - start < durationMs; cycle++) {
    const began = performance.now();
    for (const width of [2000000, 20000, 400, 80, 2000000, 40000000]) {
      await zoom(width);
      await wait(1000);
      await sample(cycle, width);
      if (cycle === 0 && [80, 400, 40000000].includes(width))
        await native.capture(page, 'first-cycle-' + width);
    }
    const b = await page.locator('#campaign-map').boundingBox(),
      x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(x + 100, y + 50, { steps: 10 });
    await page.mouse.move(x, y, { steps: 10 });
    await page.mouse.up({ button: 'middle' });
    await ready();
    await wait(Math.max(1000, (durationMs ? 60000 : 0) - (performance.now() - began)));
    const row = await sample(cycle, 'world-settled');
    result.cycles.push({
      cycle,
      elapsedMs: row.elapsedMs,
      pssKb: row.pssKb,
      heapUsed: row.heap.usedSize,
    });
    console.log(JSON.stringify(result.cycles.at(-1)));
  }
  result.elapsedMs = performance.now() - start;
  assert(result.elapsedMs >= durationMs);
  result.canonicalAfter = canonical();
  assert.deepEqual(result.canonicalAfter, before);
  await native.capture(page, 'final-world');
  await native.close();
  await native.finish(result);
} catch (error) {
  if (page)
    result.failureState = await page
      .evaluate(() => ({
        canvas: { ...document.querySelector('#campaign-map')?.dataset },
        root: { ...document.querySelector('#campaign-atlas')?.dataset },
      }))
      .catch(() => null);
  await writeFile(out + '/progress.json', JSON.stringify(result, null, 2));
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
