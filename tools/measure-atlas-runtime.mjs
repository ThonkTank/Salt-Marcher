import { setBrushWorldRadius } from './atlas-brush-probe.mjs';
// Native same-task Atlas benchmark. Run through tools/ui-session.py after build:desktop.
// ATLAS_BASELINE_FIXTURES copies authored fixtures; ATLAS_RUNTIME_DIR freezes a baseline runtime.
// ATLAS_CYCLES controls repeated navigation; ATLAS_COLLECT_GC records separate post-GC memory.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, stat, cp, symlink } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { totalmem, cpus, release } from 'node:os';
import assert from 'node:assert/strict';
const platform = process.env.QA_OZONE_PLATFORM;
assert(platform === undefined || ['auto', 'x11', 'wayland'].includes(platform));
const platformArgs = platform ? [`--ozone-platform=${platform}`] : [];
const cycles = Number(process.env.ATLAS_CYCLES ?? 3);
assert(Number.isInteger(cycles) && cycles >= 1 && cycles <= 120);
const root = process.cwd(),
  out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-runtime-evidence');
await mkdir(out, { recursive: true });
const require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {volumeRow} from './src/app/storage/volume';",
    resolveDir: root,
  },
  outfile: root + '/.build/atlas-plan-bench-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore, volumeRow } = require(root + '/.build/atlas-plan-bench-store.cjs');
const runtime = await mkdtemp(out + '/runtime-');
await cp(process.env.ATLAS_RUNTIME_DIR ?? root + '/.build/desktop', runtime, { recursive: true });
if (
  !(await stat(runtime + '/node_modules')
    .then(() => true)
    .catch(() => false))
)
  await symlink(root + '/node_modules', runtime + '/node_modules');
const bus = (await mkdtemp('/tmp/atlas-plan-bus-')) + '/bus',
  proxy = spawn(
    'xdg-dbus-proxy',
    [
      process.env.DBUS_SESSION_BUS_ADDRESS,
      bus,
      '--filter',
      '--talk=org.freedesktop.portal.Desktop',
      '--talk=org.freedesktop.Notifications',
    ],
    { stdio: 'ignore' },
  );
for (let i = 0; i < 100; i++) {
  if (
    await stat(bus)
      .then(() => true)
      .catch(() => false)
  )
    break;
  await new Promise((r) => setTimeout(r, 20));
}
const fixtures = process.env.ATLAS_BASELINE_FIXTURES
  ? JSON.parse(await readFile(process.env.ATLAS_BASELINE_FIXTURES, 'utf8'))
  : null;
const runtimeHashes = Object.fromEntries(
  await Promise.all(
    ['main.cjs', 'preload.cjs', 'atlas-region-worker.cjs', 'ui/renderer.js'].map(async (file) => [
      file,
      createHash('sha256')
        .update(await readFile(runtime + '/' + file))
        .digest('hex'),
    ]),
  ),
);
const result = {
  platform: platform ?? 'default',
  metricTimeDomain: 'timeTicks',
  cpuMetric: 'ThreadTime',
  taskMetric: 'TaskDuration',
  runtimeHashes,
  cycles,
  collectGc: !!process.env.ATLAS_COLLECT_GC,
  host: { memoryBytes: totalmem(), cpu: cpus()[0]?.model, os: release(), node: process.version },
  runtimeSource:
    process.env.ATLAS_RUNTIME_REVISION ??
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  checkoutDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  method:
    'Fresh Electron processes; warm OS cache not controlled. Identical fixture copies when ATLAS_BASELINE_FIXTURES is supplied. Renderer CPU uses CDP ThreadTime; elapsed renderer task time uses TaskDuration in the explicit timeTicks domain, across real native input and two animation frames; frame delivery and GPU execution are not inferred from handler time. Mixed zoom sequences settle at changed scales as well as returning to the original scale; settling interval CPU is reported separately from per-input samples. Physical 16-GiB qualification is separate.',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  rendererHash: createHash('sha256')
    .update(await readFile(runtime + '/ui/renderer.js'))
    .digest('hex'),
  cases: [],
};
let app;
try {
  for (const kind of (process.env.ATLAS_CASES ?? 'small,landscape,city,dungeon').split(',')) {
    const profile = await mkdtemp(out + '/' + kind + '-');
    let campaign;
    if (fixtures) {
      const original = fixtures.cases.find((c) => c.kind === kind);
      assert(original, 'Missing baseline fixture ' + kind);
      const db = new (require('better-sqlite3'))(original.profile + '/workbench.sqlite', {
        readonly: true,
      });
      await db.backup(profile + '/workbench.sqlite');
      campaign = db.prepare('SELECT id,name FROM campaign').get();
      db.close();
    } else {
      const store = new CampaignStore(profile + '/workbench.sqlite');
      const room = {
        id: 'room',
        scopeId: 'local',
        floorId: 'ground',
        number: '1',
        name: 'Messraum',
        revision: 0,
        polygons: [
          {
            outer: [
              { x: 0, y: 0 },
              { x: kind === 'dungeon' ? 762 : 10, y: 0 },
              { x: kind === 'dungeon' ? 762 : 10, y: kind === 'dungeon' ? 304.8 : 10 },
              { x: 0, y: kind === 'dungeon' ? 304.8 : 10 },
            ],
            holes: [],
          },
        ],
        sections: [{ id: randomUUID(), kind: 'markdown', markdown: 'Original\r\n' }],
      };
      campaign = store.create('Atlas ' + kind, kind === 'landscape' ? [] : [room]);
      const shell = store.activateShell(campaign.id);
      if (kind === 'landscape')
        store.db.transaction(() => {
          const put = store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
          for (let i = 0; i < 100000; i++) {
            const x = (i % 500) * 20,
              y = Math.floor(i / 500) * 20,
              r = {
                id: 'p' + i,
                revision: 0,
                kind: 'patch',
                name: 'Wald',
                points: [],
                polygons: [
                  {
                    outer: [
                      { x, y },
                      { x: x + 20, y },
                      { x: x + 20, y: y + 20 },
                      { x, y: y + 20 },
                    ],
                    holes: [],
                  },
                ],
                resolution: 20,
                width: 0,
                values: { terrain: 'forest' },
              };
            put.run(campaign.id, r.id, 0, x, x + 20, y, y + 20, JSON.stringify(r));
          }
          for (let i = 0; i < 1200; i++) {
            const k = i % 3 === 0 ? 'place' : i % 3 === 1 ? 'road' : 'river',
              x = (i % 400) * 20,
              y = Math.floor(i / 400) * 100,
              r = {
                id: 'object' + i,
                revision: 0,
                kind: k,
                name: k + ' ' + i,
                points:
                  k === 'place'
                    ? [{ x, y }]
                    : [
                        { x, y },
                        { x: x + 500, y: y + 100 },
                      ],
                polygons: [],
                resolution: 20,
                width: 4,
                values: { original: 'kept' },
              };
            put.run(campaign.id, r.id, 0, x, x + 500, y, y + 100, JSON.stringify(r));
          }
        })();
      if (kind === 'city') {
        const id = store.executeAtlasCommit({
          commandId: randomUUID(),
          token: shell.token,
          campaignId: campaign.id,
          action: { kind: 'city-create', name: 'Messstadt', x: 0, y: 0, width: 1500, height: 1000 },
        }).result.id;
        store.db.transaction(() => {
          const put = store.db.prepare('INSERT INTO city_unit VALUES(?,?,?,?,?,?)');
          for (let i = 0; i < 5000; i++) {
            const u = {
                id: 'b' + i,
                kind: 'building',
                name: 'Haus ' + i,
                protected: true,
                position: { x: (i % 100) * 12 + 10, y: Math.floor(i / 100) * 12 + 10 },
                angle: ((i % 4) * Math.PI) / 8,
                outline: [
                  { x: -3, y: -3 },
                  { x: 3, y: -3 },
                  { x: 3, y: 3 },
                  { x: -3, y: 3 },
                ],
                notes: 'PRIVATE\r\n' + 'x'.repeat(4096),
                residentIds: [],
                workerIds: [],
              },
              s = JSON.stringify(u);
            put.run(campaign.id, id, u.id, u.kind, s, createHash('sha256').update(s).digest('hex'));
          }
        })();
      }
      if (kind === 'dungeon') {
        const v = {
          id: 'volume',
          revision: 0,
          scopeId: 'local',
          roomId: 'room',
          floorId: 'ground',
          columns: Array.from({ length: 100000 }, (_, i) => ({
            x: i % 500,
            y: Math.floor(i / 500),
            spans: [{ z: 0, height: 1, floor: true, ceiling: true, medium: 'air' }],
          })),
          faces: {},
        };
        const r = volumeRow(campaign.id, v);
        store.db
          .prepare(
            'INSERT INTO dungeon_volume(campaign_id,id,scope_id,room_id,revision,payload,checksum) VALUES(@campaign_id,@id,@scope_id,@room_id,@revision,@payload,@checksum)',
          )
          .run(r);
      }
      store.tutorial('skipped');
      store.close();
    }
    const proofDb = new (require('better-sqlite3'))(profile + '/workbench.sqlite', {
      readonly: true,
    });
    const population = {
      landscape: proofDb.prepare('SELECT count(*) n FROM atlas_landscape').get().n,
      buildings: proofDb.prepare("SELECT count(*) n FROM city_unit WHERE kind='building'").get().n,
      cells: proofDb
        .prepare(
          "SELECT coalesce(sum(json_extract(s.value,'$.height')),0) n FROM dungeon_volume v,json_each(v.payload,'$.columns') c,json_each(c.value,'$.spans') s",
        )
        .get().n,
    };
    proofDb.close();
    if (kind === 'landscape') assert.equal(population.landscape, 101200);
    if (kind === 'city') assert.equal(population.buildings, 5000);
    if (kind === 'dungeon') assert.equal(population.cells, 100000);
    for (const zoom of (process.env.ATLAS_ZOOMS ?? '1,2').split(',').map(Number)) {
      const rec = { kind, profile, zoom, population, errors: [] },
        started = performance.now();
      result.cases.push(rec);
      app = await _electron.launch({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [runtime + '/main.cjs', '--data-dir', profile, ...platformArgs],
        env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + bus },
        timeout: 60000,
      });
      const page = await app.firstWindow();
      page.on('pageerror', (e) => rec.errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      rec.appReadyMs = performance.now() - started;
      await app.evaluate(
        ({ BrowserWindow }, z) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.getTitle() === 'SaltMarcher')
            .webContents.setZoomFactor(z),
        zoom,
      );
      const view =
        kind === 'landscape'
          ? { x: -500, y: -500, width: 12000, height: 7000 }
          : kind === 'city'
            ? { x: -100, y: -100, width: 1700, height: 1000 }
            : kind === 'dungeon'
              ? { x: -20, y: -20, width: 900, height: 500 }
              : { x: -2, y: -2, width: 20, height: 15 };
      await page.evaluate(
        ({ id, view }) => localStorage.setItem('atlas-camera:' + id, JSON.stringify(view)),
        { id: campaign.id, view },
      );
      const session = await page.context().newCDPSession(page);
      await session.send('Performance.enable', { timeDomain: 'timeTicks' });
      await app.evaluate(() => {
        const { Worker } = process.getBuiltinModule('worker_threads'),
          post = Worker.prototype.postMessage;
        globalThis.__atlasWorkerMetrics = { threads: {}, maxActive: 0, jobs: 0, last: null };
        Worker.prototype.postMessage = function (job, ...args) {
          if (job?.source && ['region', 'focus', 'hit', 'candidates'].includes(job.kind)) {
            const stats = globalThis.__atlasWorkerMetrics,
              id = this.threadId;
            if (!stats.threads[id]) {
              stats.threads[id] = { active: 0, jobs: 0 };
              this.on('message', (message) => {
                stats.threads[id].active = 0;
                if (message.value?.coverage)
                  stats.last = {
                    coverage: message.value.coverage,
                    landscape: message.value.landscape?.coverage,
                    tiles: message.value.landscape?.tiles.length,
                    query: stats.threads[id].query,
                  };
              });
            }
            const thread = stats.threads[id];
            thread.query = job.query;
            thread.active++;
            thread.jobs++;
            stats.jobs++;
            stats.maxActive = Math.max(stats.maxActive, thread.active);
          }
          return post.call(this, job, ...args);
        };
      });
      const opened = performance.now();
      await page
        .locator('#campaign-screen-list article')
        .filter({ hasText: 'Atlas ' + kind })
        .getByRole('button', { name: /^(Öffnen|Fortsetzen)$/ })
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
      await page.locator('#campaign-map').scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () =>
          document.querySelector('#campaign-atlas').dataset.regionState === 'ready' &&
          document.querySelector('#campaign-map').dataset.canvasState === 'loaded' &&
          Number(document.querySelector('#campaign-map').dataset.paintCommands) > 0,
        null,
        { timeout: 120000 },
      );
      await page.locator('#campaign-map').evaluate((c) => {
        const b = c.getBoundingClientRect();
        window.scrollBy(0, b.top + b.height / 2 - innerHeight * 0.6);
      });
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      rec.initialViewport = await page.locator('#campaign-map').evaluate((c) => {
        const b = c.getBoundingClientRect();
        return {
          visibleWidth: Math.max(0, Math.min(innerWidth, b.right) - Math.max(0, b.left)),
          visibleHeight: Math.max(0, Math.min(innerHeight, b.bottom) - Math.max(0, b.top)),
        };
      });
      assert(
        rec.initialViewport.visibleWidth >= 32 && rec.initialViewport.visibleHeight >= 32,
        'The usable map must be visible inside the window',
      );
      rec.openToUsableMs = performance.now() - opened;
      rec.startToUsableMs = performance.now() - started;
      rec.canvas = await page.locator('#campaign-map').evaluate((c) => ({ ...c.dataset }));
      rec.initialWorkerFrame = await app.evaluate(() => globalThis.__atlasWorkerMetrics.last);
      assert(
        rec.initialWorkerFrame?.coverage.complete && rec.initialWorkerFrame?.landscape.complete,
        'Usable content requires complete source coverage',
      );
      if (kind === 'landscape')
        assert(
          rec.initialWorkerFrame.tiles > 0 && rec.initialWorkerFrame.landscape.objects === 1200,
        );
      else assert(rec.initialWorkerFrame.coverage.objects > 0);
      rec.nativeMetrics = await app.evaluate(({ app }) => app.getAppMetrics());
      await writeFile(
        out + '/' + kind + '-' + zoom + '.png',
        Buffer.from(
          await app.evaluate(async ({ BrowserWindow }) =>
            (
              await BrowserWindow.getAllWindows()
                .find((w) => w.getTitle() === 'SaltMarcher')
                .webContents.capturePage()
            )
              .toPNG()
              .toString('base64'),
          ),
          'base64',
        ),
      );

      const settled = async () =>
        page.waitForFunction(
          () =>
            document.querySelector('#campaign-atlas').dataset.regionState === 'ready' &&
            document.querySelector('#campaign-map').dataset.canvasState === 'loaded',
          null,
          { timeout: 120000 },
        );
      const frames = () =>
        page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
      const metrics = async () =>
        Object.fromEntries(
          (await session.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]),
        );
      const samples = { pan: [], hover: [], preview: [], zoom: [] };
      const sample = async (type, action) => {
        const before = await metrics(),
          t = performance.now();
        await action();
        await frames();
        const after = await metrics();
        assert(
          Number.isFinite(before.ThreadTime) && Number.isFinite(after.ThreadTime),
          'Renderer CPU metric ThreadTime must be available',
        );
        samples[type].push({
          rendererCpuMs: (after.ThreadTime - before.ThreadTime) * 1000,
          rendererTaskMs: (after.TaskDuration - before.TaskDuration) * 1000,
          scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
          layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
          sampleWallMs: performance.now() - t,
        });
      };
      const center = async () =>
        page.evaluate(() => {
          const c = document.querySelector('#campaign-map'),
            r = c.getBoundingClientRect(),
            p = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          window.scrollBy(0, p.y - innerHeight * 0.6);
          const b = c.getBoundingClientRect();
          const at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
          if (document.elementFromPoint(at.x, at.y) !== c)
            throw Error('Native input must target the visible map');
          return at;
        });
      await frames();
      let p = await center();
      await frames();
      const beforePan = await app.evaluate(() => globalThis.__atlasWorkerMetrics),
        scene = await page.locator('#campaign-map').getAttribute('data-scene-version'),
        beforePanView = await page.locator('#campaign-map').getAttribute('data-atlas-view');
      await page.mouse.move(p.x, p.y);
      await page.mouse.down({ button: 'middle' });
      for (let i = 0; i < 30; i++)
        await sample('pan', () =>
          page.mouse.move(p.x + Math.sin(i / 4) * 10, p.y + Math.cos(i / 5) * 8),
        );
      await page.mouse.up({ button: 'middle' });
      await settled();
      assert.notEqual(
        await page.locator('#campaign-map').getAttribute('data-atlas-view'),
        beforePanView,
        'Native pan must actually move the camera',
      );
      rec.bufferedPanRetainedScene =
        scene === (await page.locator('#campaign-map').getAttribute('data-scene-version'));
      assert(rec.bufferedPanRetainedScene);
      const afterPan = await app.evaluate(() => globalThis.__atlasWorkerMetrics);
      assert.equal(afterPan.jobs, beforePan.jobs, 'Buffered camera frames must not read SQLite');
      const beforeHover = await app.evaluate(() => globalThis.__atlasWorkerMetrics.jobs);
      for (let i = 0; i < 30; i++)
        await sample('hover', () => page.mouse.move(p.x + Math.sin(i) * 12, p.y + Math.cos(i) * 8));
      assert.equal(
        await app.evaluate(() => globalThis.__atlasWorkerMetrics.jobs),
        beforeHover,
        'Hover must not read SQLite',
      );
      await page.locator('#atlas-section').selectOption('terrain');
      await settled();
      await page.locator('[data-tool-group=properties]').click();
      await page.locator('[data-atlas-tool=property]').click();
      await setBrushWorldRadius(page, 'land-radius', '5');
      await settled();
      p = await center();
      const previewRevision = await page
        .locator('#campaign-map')
        .getAttribute('data-atlas-region-revision');
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      for (let i = 0; i < 20; i++)
        await sample('preview', () => page.mouse.move(p.x + i * 0.6, p.y + Math.sin(i / 3) * 3));
      await page.locator('#campaign-map').press('Escape');
      await page.mouse.up();
      await settled();
      assert.equal(
        await page.locator('#campaign-map').getAttribute('data-atlas-region-revision'),
        previewRevision,
        'Preview cancellation must not change author data',
      );
      const memory = [];
      const snapshot = async () => {
        if (process.env.ATLAS_COLLECT_GC) await session.send('HeapProfiler.collectGarbage');
        memory.push({
          postGc: !!process.env.ATLAS_COLLECT_GC,
          renderer: await metrics(),
          native: await app.evaluate(({ app }) => app.getAppMetrics()),
          canvas: await page.locator('#campaign-map').evaluate((c) => ({ ...c.dataset })),
          workers: await app.evaluate(() => globalThis.__atlasWorkerMetrics),
        });
      };
      await snapshot();
      for (let cycle = 0; cycle < cycles; cycle++) {
        p = await center();
        await page.mouse.move(p.x, p.y);
        const began = performance.now();
        const steps = cycle % 3 === 2 ? 10 : 9,
          direction = cycle % 3 === 1 ? -1 : 1;
        for (let i = 0; i < steps; i++)
          await sample('zoom', () => page.mouse.wheel(0, (i < 5 ? -100 : 100) * direction));
        const settling = await metrics(),
          settleStart = performance.now();
        await settled();
        await frames();
        const settledMetrics = await metrics();
        memory.push({
          cycle,
          sequenceMs: performance.now() - began,
          settleMs: performance.now() - settleStart,
          settleRendererTaskMs: (settledMetrics.TaskDuration - settling.TaskDuration) * 1000,
          settleRendererCpuMs: (settledMetrics.ThreadTime - settling.ThreadTime) * 1000,
        });
        await snapshot();
      }
      if (kind === 'dungeon') {
        await page.locator('#atlas-search').fill('Messraum');
        await page.locator('#atlas-search-results button').filter({ hasText: 'Messraum' }).click();
        await page.locator('#atlas-search').fill('');
        await settled();
        const sliceStarted = performance.now();
        await page.locator('#atlas-slice-enabled').check();
        await settled();
        await frames();
        rec.volumeSliceMs = performance.now() - sliceStarted;
        rec.volumeFrame = await app.evaluate(() => globalThis.__atlasWorkerMetrics.last);
        assert.equal(rec.volumeFrame.query.scopeId, 'local');
        assert.equal(rec.volumeFrame.query.slice, 0);
        assert(rec.volumeFrame.coverage.complete && rec.volumeFrame.coverage.objects > 0);
        await writeFile(
          out + '/volume-slice-' + zoom + '.png',
          Buffer.from(
            await app.evaluate(async ({ BrowserWindow }) =>
              (
                await BrowserWindow.getAllWindows()
                  .find((w) => w.getTitle() === 'SaltMarcher')
                  .webContents.capturePage()
              )
                .toPNG()
                .toString('base64'),
            ),
            'base64',
          ),
        );
        await page.locator('#atlas-slice-enabled').uncheck();
        await settled();
      }
      if (!(await page.locator('#catalog-tab').isVisible()))
        await page.locator('#atlas-navigation').click();
      await page.locator('#catalog-tab').click();
      await page.waitForFunction(() => document.querySelector('#campaign-atlas').hidden);
      await page.waitForTimeout(250);
      const warmStart = performance.now();
      if (!(await page.locator('#atlas-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#atlas-tab').click();
      await settled();
      await frames();
      rec.warmOpenToUsableMs = performance.now() - warmStart;
      rec.memory = memory;
      rec.workers = await app.evaluate(() => globalThis.__atlasWorkerMetrics);
      assert(rec.workers.maxActive <= 1, 'One SQLite request at a time per worker');
      const summarize = (values) => {
        const ordered = [...values].sort((a, b) => a - b);
        return {
          n: ordered.length,
          median: ordered[Math.floor(ordered.length / 2)],
          p95: ordered[Math.ceil(ordered.length * 0.95) - 1],
          max: ordered.at(-1),
        };
      };
      rec.inputSamples = samples;
      rec.cpu = Object.fromEntries(
        Object.entries(samples).map(([type, rows]) => [
          type,
          summarize(rows.map((r) => r.rendererCpuMs)),
        ]),
      );
      rec.taskTime = Object.fromEntries(
        Object.entries(samples).map(([type, rows]) => [
          type,
          summarize(rows.map((r) => r.rendererTaskMs)),
        ]),
      );
      rec.targets = {
        ...(kind === 'dungeon' ? { volumeSlice2s: rec.volumeSliceMs <= 2000 } : {}),
        warmOpen2s: rec.warmOpenToUsableMs <= 2000,
        open2s: rec.openToUsableMs <= 2000,
        cameraCpu16ms: Math.max(rec.cpu.pan.p95, rec.cpu.hover.p95, rec.cpu.zoom.p95) <= 16,
        previewCpu50ms: rec.cpu.preview.p95 <= 50,
        cameraTask16ms:
          Math.max(rec.taskTime.pan.p95, rec.taskTime.hover.p95, rec.taskTime.zoom.p95) <= 16,
        previewTask50ms: rec.taskTime.preview.p95 <= 50,
        presentation16ms: null,
      };
      assert.deepEqual(rec.errors, []);
      const exit = new Promise((resolve) =>
        app.process().once('exit', (code, signal) => resolve({ code, signal })),
      );
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.getTitle() === 'SaltMarcher')
          .close(),
      );
      rec.exit = await exit;
      assert.deepEqual(rec.exit, { code: 0, signal: null });
      app = null;
      await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
      console.log(
        JSON.stringify({
          kind,
          zoom,
          appReadyMs: rec.appReadyMs,
          openToUsableMs: rec.openToUsableMs,
          startToUsableMs: rec.startToUsableMs,
          cpu: rec.cpu,
          taskTime: rec.taskTime,
          targets: rec.targets,
        }),
      );
    }
  }
} catch (e) {
  await writeFile(out + '/failure.json', JSON.stringify({ error: e.stack, result }, null, 2));
  throw e;
} finally {
  if (app) await app.close().catch(() => {});
  proxy.kill();
}
