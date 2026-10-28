import { runNativeProbe } from './native-session.mjs';
let native,
  nativeCase = 0;
// Run with tools/ui-session.py after build:desktop. Own synthetic profile only.
import { createRequire } from 'node:module';
import { rm, mkdtemp, mkdir, writeFile, readFile, stat, cp, symlink } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { atlasCanvasReady, atlasCanvasPoint } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-author-native');
await mkdir(out, { recursive: true });
await rm(out + '/result.json', { force: true });
const require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/atlas-author-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/atlas-author-store.cjs');
require('esbuild').buildSync({
  entryPoints: ['src/app/atlas/drawing-model.ts'],
  outfile: '.build/atlas-author-elements.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { newElement } = require(root + '/.build/atlas-author-elements.cjs');
const runtime = await mkdtemp(out + '/runtime-');
await cp(process.env.ATLAS_AUTHOR_RUNTIME_DIR ?? root + '/.build/desktop', runtime, {
  recursive: true,
});
if (
  !(await stat(runtime + '/node_modules')
    .then(() => true)
    .catch(() => false))
)
  await symlink(root + '/node_modules', runtime + '/node_modules');

const result = {
  runtime,
  source:
    process.env.ATLAS_AUTHOR_RUNTIME_REVISION ??
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  checkoutDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  runtimeHashes: Object.fromEntries(
    await Promise.all(
      ['main.cjs', 'ui/renderer.js'].map(async (file) => [
        file,
        createHash('sha256')
          .update(await readFile(runtime + '/' + file))
          .digest('hex'),
      ]),
    ),
  ),
  cases: [],
};
let app;
try {
  for (const zoom of [1]) {
    await runNativeProbe(
      { output: out + '/case-' + ++nativeCase, name: 'atlas-author-overlay' },
      async (session) => {
        native = session;

        const profile = native.profile,
          store = new CampaignStore(profile + '/workbench.sqlite');
        const make = (id, x, y) => ({
          id,
          scopeId: 'local',
          floorId: 'ground',
          number: id === 'selected' ? '1' : id.slice(1),
          name: id === 'selected' ? 'Autorenraum' : 'Nachbar ' + id,
          revision: 0,
          polygons: [
            {
              outer: [
                { x, y },
                { x: x + 8, y },
                { x: x + 8, y: y + 8 },
                { x, y: y + 8 },
              ],
              holes: [],
            },
          ],
          sections: [],
        });
        const original = make('selected', 0, 0);
        original.polygons[0].outer = [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 80, y: 80 },
          { x: 0, y: 80 },
        ];
        const rooms = [original];
        for (let i = 0; i < 1600; i++) {
          const x = ((i % 40) - 20) * 12,
            y = (Math.floor(i / 40) - 20) * 12;
          if (x !== 0 || y !== 0) rooms.push(make('n' + (i + 2), x, y));
        }
        const campaign = store.create('Autorenebene', rooms);
        store.tutorial('skipped');
        const token = store.activateShell(campaign.id).token,
          glyph = {
            ...newElement('object', 'local', 'ground', 'selected', [{ x: 40, y: 40 }]),
            name: 'Sichtbares Objekt',
            width: 30,
            height: 30,
          };
        store.executeDrawing({
          commandId: randomUUID(),
          token,
          campaignId: campaign.id,
          action: { kind: 'element', element: glyph, expectedRevision: null },
        });
        store.close();
        const rec = { zoom, profile, rooms: rooms.length, errors: [] };
        result.cases.push(rec);
        const open = async () => {
          app = await native.launchConfigured({
            runtime: { kind: 'snapshot', directory: runtime },
            executablePath: root + '/node_modules/electron/dist/electron',
            args: [runtime + '/main.cjs', '--data-dir', profile, '--ozone-platform=x11'],
          });
          const page = await app.firstWindow();
          page.on('pageerror', (e) => rec.errors.push(e.stack));
          await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
          await app.evaluate(
            ({ BrowserWindow }, zoom) =>
              BrowserWindow.getAllWindows()
                .find((w) => w.getTitle() === 'SaltMarcher')
                .webContents.setZoomFactor(zoom),
            zoom,
          );
          await page.evaluate(
            (id) =>
              localStorage.setItem(
                'atlas-camera:' + id,
                JSON.stringify({ x: -10, y: -10, width: 30, height: 25 }),
              ),
            campaign.id,
          );
          await page
            .locator('#campaign-screen-list article')
            .filter({ hasText: 'Autorenebene' })
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
          await atlasCanvasReady(page);
          await page.locator('#atlas-search').fill('Autorenraum');
          await page
            .locator('#atlas-search-results button')
            .filter({ hasText: 'Autorenraum' })
            .click();
          await page.locator('#atlas-search').fill('');
          await atlasCanvasReady(page);
          await page.waitForFunction(
            () =>
              document.querySelector('#campaign-atlas').dataset.family === 'interior' &&
              document.querySelector('#atlas-selection-title').textContent === 'Autorenraum',
          );
          await page.locator('#atlas-dock-tool').click();
          return page;
        };
        const close = async () => {
          const exit = new Promise((r) =>
            app.process().once('exit', (code, signal) => r({ code, signal })),
          );
          await native.close();
          const status = await exit;
          assert.deepEqual(status, { code: 0, signal: null });
          app = null;
          (rec.exits ??= []).push(status);
        };
        const settle = async () => {
          await page.evaluate(
            () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
          );
          await atlasCanvasReady(page);
        };
        const pixelCount = () =>
          page.locator('#campaign-map').evaluate((c) => {
            const bytes = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let grips = 0;
            for (let i = 0; i < bytes.length; i += 4) {
              if (
                Math.abs(bytes[i] - 36) < 5 &&
                Math.abs(bytes[i + 1] - 79) < 5 &&
                Math.abs(bytes[i + 2] - 135) < 5
              )
                grips++;
            }
            return { grips };
          });
        let page = await open();
        await page.evaluate(() => {
          const proto = CanvasRenderingContext2D.prototype,
            clear = proto.clearRect,
            stroke = proto.stroke;
          proto.clearRect = function (...args) {
            if (this.canvas.id === 'campaign-map')
              window.__atlasAuthorPaint = { draft: 0, grips: 0 };
            return clear.apply(this, args);
          };
          proto.stroke = function (...args) {
            if (this.canvas.id === 'campaign-map') {
              if (this.strokeStyle === '#236871') window.__atlasAuthorPaint.draft++;
              if (this.strokeStyle === '#244f87') window.__atlasAuthorPaint.grips++;
            }
            return stroke.apply(this, args);
          };
        });
        // A visible glyph must join exact overlaps, even far from its logical anchor.
        await page.locator('#atlas-dock-tool').click();
        await page
          .locator('[data-tool-select=\"drawing-tool\"][data-tool-value=\"select\"]')
          .click();
        await settle();
        const glyphPoint = await atlasCanvasPoint(page, { x: 50, y: 50 });
        await page.mouse.click(glyphPoint.x, glyphPoint.y);
        await page.locator('#atlas-hit-candidates').waitFor({ state: 'visible' });
        const candidates = await page.locator('#atlas-hit-candidates').innerText();
        assert.match(candidates, /Objekt: Sichtbares Objekt/);
        assert.match(candidates, /Raum: 1. Autorenraum/);
        rec.glyphCandidates = candidates;
        await page.keyboard.press('Escape');
        rec.retainedPaints = [];
        await page.locator('#atlas-dock-tool').click();
        await page
          .locator('[data-tool-select=\"drawing-tool\"][data-tool-value=\"room-polygon\"]')
          .click();
        // Changing tool refreshes its context controls. Only subsequent draft updates
        // must retain the resulting inspector, so capture that settled baseline.
        await settle();
        await page.evaluate(
          () => (window.__retainedFloorOption = document.querySelector('#atlas-floor').firstChild),
        );
        for (const p of [
          { x: 10, y: 10 },
          { x: 70, y: 10 },
          { x: 70, y: 60 },
        ]) {
          const at = await atlasCanvasPoint(page, p);
          assert.equal(
            at.target,
            'campaign-map',
            JSON.stringify({
              p,
              at,
              view: await page.locator('#campaign-map').evaluate((c) => ({
                view: c.dataset.atlasView,
                r: c.getBoundingClientRect().toJSON(),
                width: c.clientWidth,
                height: c.clientHeight,
                innerHeight,
              })),
            }),
          );
          await page.mouse.click(at.x, at.y);
          await settle();
          rec.retainedPaints.push(
            await page.locator('#campaign-map').evaluate((c) => ({
              builds: Number(c.dataset.pathBuilds),
              reuses: Number(c.dataset.pathReuses),
              sameFloorOption:
                window.__retainedFloorOption === document.querySelector('#atlas-floor').firstChild,
            })),
          );
        }
        assert(
          rec.retainedPaints.every((p) => p.reuses > 50 && p.sameFloorOption),
          'draft updates must retain background paths and inspector controls',
        );
        await page.waitForFunction(() =>
          document.querySelector('#drawing-path-status').textContent.includes('3 Punkte'),
        );
        await page.locator('#campaign-map').evaluate((c) => {
          c.dispatchEvent(new Event('contextlost', { cancelable: true }));
          c.dispatchEvent(new Event('contextrestored'));
        });
        await settle();
        assert.match(await page.locator('#drawing-path-status').innerText(), /3 Punkte/);
        rec.restorationHandlerRetainedDraft = true;
        const center = await atlasCanvasPoint(page, { x: 40, y: 40 });
        await page.mouse.move(center.x, center.y);
        for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 100);
        await atlasCanvasReady(page);
        await page.waitForFunction(() =>
          document.querySelector('#atlas-hint').textContent.includes('Dichte Kartengeometrie'),
        );
        await settle();
        assert.match(await page.locator('#drawing-path-status').innerText(), /3 Punkte/);
        rec.authorPaint = await page.evaluate(() => window.__atlasAuthorPaint);
        assert(
          rec.authorPaint.draft > 0,
          'Actual Canvas2D draft strokes must be present above the dense raster',
        );
        rec.rasterDraft = await pixelCount();
        await writeFile(
          out + '/draft-' + zoom + '.png',
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
        const nextPoint = await atlasCanvasPoint(page, { x: 10, y: 60 });
        await page.mouse.click(nextPoint.x, nextPoint.y);
        await page.waitForFunction(() =>
          document.querySelector('#drawing-path-status').textContent.includes('4 Punkte'),
        );
        await settle();
        rec.continuedRasterDraft = true;
        await page.locator('#drawing-cancel').click();
        await page.locator('#atlas-dock-tool').click();
        await page
          .locator('[data-tool-select=\"drawing-tool\"][data-tool-value=\"select\"]')
          .click();
        await settle();
        rec.cancelledPaint = await page.evaluate(() => window.__atlasAuthorPaint);
        assert.equal(rec.cancelledPaint.draft, 0, 'Cancel must remove the actual draft stroke');
        assert.equal(rec.cancelledPaint.grips, 4);
        rec.rasterHandles = await pixelCount();
        assert(
          rec.rasterHandles.grips > 0,
          'Exact original handles must remain visible with a raster background',
        );
        // Dense images carry no per-object glyph ID: canonical footprint picking must work too.
        const denseGlyph = await atlasCanvasPoint(page, { x: 50, y: 50 });
        await page.mouse.click(denseGlyph.x, denseGlyph.y);
        await page.locator('#atlas-hit-candidates').waitFor({ state: 'visible' });
        rec.denseGlyphCandidates = await page.locator('#atlas-hit-candidates').innerText();
        assert.match(rec.denseGlyphCandidates, /Objekt: Sichtbares Objekt/);
        assert.match(rec.denseGlyphCandidates, /Raum: 1. Autorenraum/);
        await page.keyboard.press('Escape');
        const from = await atlasCanvasPoint(page, { x: 80, y: 0 }),
          to = await atlasCanvasPoint(page, { x: 100, y: 0 });
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 5 });
        await page.mouse.up();
        await page.waitForFunction(
          () => document.querySelector('#atlas-save-status').textContent === 'Gespeichert',
        );
        await settle();
        const db = () =>
          new (require('better-sqlite3'))(profile + '/workbench.sqlite', { readonly: true });
        const read = () => {
          const d = db();
          try {
            return JSON.parse(
              d.prepare('SELECT payload FROM room WHERE id=?').get('selected').payload,
            );
          } finally {
            d.close();
          }
        };
        const saved = read();
        assert(Math.abs(saved.polygons[0].outer[1].x - 100) < 0.5);
        assert.deepEqual(saved.polygons[0].outer[0], original.polygons[0].outer[0]);
        rec.savedVertex = saved.polygons[0].outer[1];
        await page.locator('#atlas-undo').click();
        await page.waitForFunction(
          () => document.querySelector('#atlas-save-status').textContent === 'Gespeichert',
        );
        await settle();
        assert.equal(read().polygons[0].outer[1].x, 80);
        await page.locator('#atlas-redo').click();
        await page.waitForFunction(
          () => document.querySelector('#atlas-save-status').textContent === 'Gespeichert',
        );
        await settle();
        assert.deepEqual(read().polygons, saved.polygons);
        rec.undoRedo = true;
        await close();
        page = await open();
        assert.deepEqual(read().polygons, saved.polygons);
        rec.reopened = true;
        assert.deepEqual(rec.errors, []);
        await close();

        console.log(JSON.stringify(rec));
      },
    );
  }
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
} catch (e) {
  if (app) {
    try {
      await writeFile(
        out + '/failure.png',
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
      ).catch(() => {});
    } catch {}
  }
  await writeFile(out + '/failure.json', JSON.stringify({ error: e.stack, result }, null, 2));
  throw e;
} finally {
  await native?.dispose();
}
