import { runNativeProbe } from './native-session.mjs';
import { setBrushWorldRadius } from './atlas-brush-probe.mjs';
// Timed native moving-stroke probe: records received timestamps and coalesced samples.
// Actual Electron window and an isolated synthetic campaign. Never opens the user's profile.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  stdin: {
    contents:
      "export * from './src/app/storage/store';export * from './src/app/atlas/atlas-landscape';export * from './src/app/atlas/land-mask';",
    resolveDir: root,
  },
  outfile: '.build/fractal-strokes-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/fractal-strokes-native-store.cjs');
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/fractal-strokes-native');
await runNativeProbe({ output: out, name: 'fractal-strokes' }, async (native) => {
  const dir = native.profile;
  await mkdir(out, { recursive: true });
  const store = new CampaignStore(dir + '/workbench.sqlite'),
    room = {
      id: 'watch',
      scopeId: 'local',
      floorId: 'ground',
      number: '1',
      name: 'Referenzhaus',
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
  const cam = store.create('Pinselvergleich', [room]),
    active = store.activate(cam.id);
  store.tutorial('skipped');
  store.close();
  const Database = require('better-sqlite3'),
    db = new Database(dir + '/workbench.sqlite', { readonly: true }),
    records = () =>
      db
        .prepare('SELECT payload FROM atlas_landscape')
        .all()
        .map((r) => JSON.parse(r.payload));
  const result = {
    source: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      encoding: 'utf8',
    }).trim(),
    profile: dir,
    errors: [],
    checks: [],
  };
  let app, page;
  async function start() {
    const executable = process.env.ATLAS_PACKAGE
      ? path.join(process.env.ATLAS_PACKAGE, 'electron')
      : root + '/node_modules/electron/dist/electron';
    app = await native.launchConfigured({
      runtime: process.env.ATLAS_PACKAGE
        ? { kind: 'package', directory: process.env.ATLAS_PACKAGE }
        : undefined,
      executablePath: executable,
      args: [
        ...(process.env.ATLAS_PACKAGE ? [] : [root + '/.build/desktop/main.cjs']),
        '--data-dir',
        dir,
        '--ozone-platform=x11',
      ],
      timeout: 60000,
    });
    if (process.env.ATLAS_PACKAGE)
      assert.equal(
        await app.evaluate(({ app }) => app.getVersion()),
        JSON.parse(await readFile(root + '/package.json', 'utf8')).version,
      );
    page = await app.firstWindow();
    page.on('pageerror', (e) => result.errors.push(e.stack ?? e.message));
    await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
    await page
      .locator('.campaign-card')
      .filter({ hasText: 'Pinselvergleich' })
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
    await page.locator('#atlas-search').fill('Referenzhaus');
    await page.locator('#atlas-search-results button').filter({ hasText: 'Referenzhaus' }).click();
    await atlasCanvasReady(page);
    await page.locator('#atlas-search').fill('');
    await page.locator('button[data-family="terrain"]').click();
    await atlasCanvasReady(page);
  }
  const tool = async (value) => {
    await page.waitForFunction(() => !document.querySelector('#land-tool').disabled);
    await page.locator(`[data-tool-select="land-tool"][data-tool-value="${value}"]`).click();
    await page.waitForFunction(
      (value) => document.querySelector('#land-tool').value === value,
      value,
    );
    await atlasCanvasReady(page);
  };
  const camera = () =>
    page.locator('#campaign-map').evaluate((n) => ({
      view: JSON.parse(n.dataset.atlasView),
      left: n.getBoundingClientRect().left,
      top: n.getBoundingClientRect().top,
      width: n.getBoundingClientRect().width,
      height: n.getBoundingClientRect().height,
    }));
  async function at(x, y) {
    const c = await camera();
    return {
      x: c.left + ((x - c.view.x) / c.view.width) * c.width,
      y: c.top + ((y - c.view.y) / c.view.height) * c.height,
    };
  }
  async function capture(name) {
    await page.screenshot({ path: out + '/' + name + '.png' });
  }
  async function stroke(points) {
    const p = await at(...points[0]);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    for (const point of points.slice(1)) {
      const q = await at(...point);
      await page.mouse.move(q.x, q.y, { steps: 12 });
    }
    await page.mouse.up();
  }

  const maskBytes = () =>
    require('node:crypto')
      .createHash('sha256')
      .update(
        JSON.stringify(
          records()
            .filter((r) => r.mask)
            .map((r) => [r.id, r.mask.data])
            .sort(),
        ),
      )
      .digest('hex');
  async function settled() {
    await page.waitForFunction(
      () =>
        !document.querySelector('#land-tool').disabled &&
        document.querySelector('#land-status').textContent === 'Gespeichert',
      null,
      { timeout: 30000 },
    );
    await atlasCanvasReady(page);
  }
  async function mode(value, radius) {
    await page
      .locator('#land-operation')
      .selectOption(['land-erase', 'lower'].includes(value) ? 'erase' : 'add');
    await page
      .locator('#land-coast-roughness')
      .fill(['raise', 'lower'].includes(value) ? '2' : '0');
    await setBrushWorldRadius(page, 'land-radius', String(radius));
  }
  const core = require(root + '/.build/fractal-strokes-native-store.cjs');
  const rootRevision = () => db.prepare('SELECT cursor,revision FROM campaign_atlas').get();
  let gestureCamera;
  async function timedStroke(points, ms) {
    const screen = points.map((p) => ({
      x:
        gestureCamera.left +
        ((p.x - gestureCamera.view.x) / gestureCamera.view.width) * gestureCamera.width,
      y:
        gestureCamera.top +
        ((p.y - gestureCamera.view.y) / gestureCamera.view.height) * gestureCamera.height,
    }));
    await page.evaluate(() => {
      window.fractalTrace = [];
    });
    // XTEST input runs independently of Chromium compositor acknowledgements.
    const native = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getContentBounds(),
    );
    const mouse = (p) => [
      'mousemove',
      '--sync',
      String(Math.round(native.x + p.x)),
      String(Math.round(native.y + p.y)),
    ];
    const args = [...mouse(screen[0]), 'mousedown', '1'];
    for (let i = 1; i < screen.length; i++)
      args.push('sleep', String(ms / (screen.length - 1) / 1000), ...mouse(screen[i]));
    args.push('mouseup', '1');
    await new Promise((resolve, reject) =>
      execFile('xdotool', args, { env: process.env }, (error) =>
        error ? reject(error) : resolve(),
      ),
    );
    const trace = await page.evaluate(() => window.fractalTrace);
    await settled();
    return trace;
  }
  async function undo() {
    await page.locator('#atlas-undo').click();
    await atlasCanvasReady(page);
  }
  const area = (rs, b, r) => {
    const step = r / 20;
    let cells = 0,
      changed = 0;
    for (let y = b.y; y < b.y + b.height; y += step)
      for (let x = b.x; x < b.x + b.width; x += step) {
        cells++;
        if (core.effectiveLandscape(rs, { x, y }).terrain !== 'water') changed++;
      }
    return { cells, land: changed, landArea: changed * step * step };
  };
  try {
    await start();
    await tool('paint');
    for (let i = 0; i < 3; i++)
      await page.getByRole('button', { name: 'Verkleinern', exact: true }).click();
    await atlasCanvasReady(page);
    gestureCamera = await camera();
    await page.evaluate(() => {
      window.fractalTrace = [];
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
        window.addEventListener(
          type,
          (e) => {
            if (e.button !== 0 && e.buttons !== 1 && type !== 'pointerup') return;
            const samples = type === 'pointermove' ? (e.getCoalescedEvents?.() ?? []) : [];
            for (const sample of samples.length ? samples : [e])
              window.fractalTrace.push({
                type,
                t: sample.timeStamp,
                x: sample.clientX,
                y: sample.clientY,
                buttons: sample.buttons,
                trusted: sample.isTrusted,
              });
          },
          true,
        );
    });
    const c = gestureCamera,
      r = c.view.width * 0.05,
      world = (u, v) => ({
        x: c.view.x + u * c.view.width,
        y: c.view.y + v * c.view.height,
      });
    const shapes = {
      straight: Array.from({ length: 49 }, (_, i) => world(0.25 + (0.4 * i) / 48, 0.78)),
      curve: Array.from({ length: 65 }, (_, i) =>
        world(0.25 + (0.4 * i) / 64, 0.76 - 0.08 * Math.sin((i / 64) * Math.PI * 2)),
      ),
    };
    const bounds = {
      x: c.view.x + 0.18 * c.view.width,
      y: c.view.y + 0.58 * c.view.height,
      width: 0.55 * c.view.width,
      height: 0.34 * c.view.height,
    };
    result.package = process.env.ATLAS_PACKAGE ?? null;
    result.gestures = [];
    for (const brush of ['land', 'land-erase', 'raise', 'lower'])
      for (const [shape, points] of Object.entries(shapes))
        for (const speed of ['land', 'land-erase'].includes(brush) ? ['fast'] : ['fast', 'slow']) {
          const name = brush + '-' + shape + '-' + speed;
          console.log('START ' + name);
          if (['lower', 'land-erase'].includes(brush)) {
            await mode('land', r * 1.5);
            await timedStroke(points, 700);
          }
          const before = records(),
            beforeHash = maskBytes(),
            rootBefore = rootRevision(),
            baseline = area(before, bounds, r);
          await mode(brush, r);
          await page
            .locator('#land-coast-roughness')
            .fill(['land', 'land-erase'].includes(brush) ? '0' : '2');
          await capture(name + '-before');
          const trace = await timedStroke(points, speed === 'fast' ? 700 : 14000);
          const after = records(),
            afterHash = maskBytes(),
            afterArea = area(after, bounds, r),
            rootAfter = rootRevision();
          await writeFile(out + '/' + name + '-trace.json', JSON.stringify(trace, null, 2));
          const downs = trace.filter((p) => p.type === 'pointerdown'),
            ups = trace.filter((p) => p.type === 'pointerup'),
            moves = trace.filter((p) => p.type === 'pointermove' && p.buttons === 1);
          assert.equal(downs.length, 1);
          assert.equal(ups.length, 1);
          assert.equal(trace.filter((p) => p.type === 'pointercancel').length, 0);
          assert(trace.every((p) => p.trusted));
          assert(moves.length >= points.length * 0.8);
          const durationMs = ups[0].t - downs[0].t;
          const interior = points.slice(
            Math.ceil(points.length * 0.15),
            Math.floor(points.length * 0.85),
          );
          const changed = interior.filter(
            (p) =>
              core.effectiveLandscape(before, p).terrain !==
              core.effectiveLandscape(after, p).terrain,
          ).length;
          const stats = {
            name,
            radius: r,
            roughness: ['land', 'land-erase'].includes(brush) ? 0 : 2,
            requestedMs: speed === 'fast' ? 700 : 14000,
            durationMs,
            moves: moves.length,
            changedCenterSamples: changed,
            centerSamples: interior.length,
            beforeArea: baseline.landArea,
            afterArea: afterArea.landArea,
            areaDelta: afterArea.landArea - baseline.landArea,
            beforeHash,
            afterHash,
            rootBefore,
            rootAfter,
            trace,
          };
          result.gestures.push(stats);
          await writeFile(out + '/' + name + '.json', JSON.stringify(stats, null, 2));
          await capture(name + '-after');
          assert(
            Math.abs(durationMs - stats.requestedMs) <= Math.max(150, stats.requestedMs * 0.15),
            `Invalid speed comparison: requested ${stats.requestedMs} ms, received ${durationMs} ms`,
          );
          assert.equal(
            rootAfter.cursor,
            rootBefore.cursor + 1,
            'One moving stroke is one undo step',
          );
          assert.notEqual(
            afterHash,
            beforeHash,
            'Fast passes must still preserve subthreshold work',
          );
          if (['land', 'land-erase'].includes(brush))
            assert.equal(changed, interior.length, 'Hard brush covers the whole fast stroke');
          if (speed === 'slow') {
            const fast = result.gestures.find((g) => g.name === brush + '-' + shape + '-fast');
            assert(
              Math.abs(stats.areaDelta) > Math.abs(fast.areaDelta),
              'Longer exposure must change more visible area',
            );
            assert(
              changed / interior.length > 0.8,
              'Slow stroke must affect its length, not only endpoints',
            );
          }
          assert(
            ['raise', 'land'].includes(brush)
              ? afterArea.landArea >= baseline.landArea
              : afterArea.landArea <= baseline.landArea,
          );
          await undo();
          assert.equal(maskBytes(), beforeHash, 'Undo restores the entire moving stroke');
          await page.locator('#atlas-redo').click();
          await atlasCanvasReady(page);
          assert.equal(maskBytes(), afterHash, 'Redo restores exact mask bytes');
          await undo();
          if (['lower', 'land-erase'].includes(brush)) await undo();
          result.checks.push(name);
          console.log(
            'PASS ' + name + ' ' + Math.round(durationMs) + 'ms ' + changed + '/' + interior.length,
          );
        }
    // Preserve one curved moving stroke through a fresh process.
    await mode('raise', r);
    await timedStroke(shapes.curve, 14000);
    const persisted = maskBytes();
    await capture('persisted-curve');
    await native.close();
    app = null;
    await start();
    assert.equal(maskBytes(), persisted);
    result.checks.push('moving curve survives fresh process');
    assert.deepEqual(result.errors, []);
    result.ok = true;
  } catch (error) {
    result.error = error.stack ?? String(error);
    if (page) {
      result.status = await page.locator('#atlas-save-status').textContent();
      await capture('failure').catch(() => {});
    }
    throw error;
  } finally {
    if (app) {
      if (result.ok) {
        await native.close();
        result.normalExit = true;
      } else await native.dispose().catch(() => {});
    }
    db.close();
    await native.recordResult(result);
  }
});
