import { runNativeProbe } from './native-session.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
// Deterministic Canvas2D fault injection in real Electron, not a physical GPU-reset qualification.
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const output = process.env.QA_EVIDENCE_DIR ?? root + '/.build/canvas-recovery-evidence';
await runNativeProbe(
  { output: output, name: 'canvas-recovery', resultName: 'result.json' },
  async (native) => {
    await mkdir(output, { recursive: true });
    const artifactHashes = {};
    for (const file of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
      artifactHashes[file] = createHash('sha256')
        .update(await readFile(root + '/.build/desktop/' + file))
        .digest('hex');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/canvas-recovery-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/canvas-recovery-store.cjs'),
      profile = native.profile,
      file = profile + '/workbench.sqlite',
      store = new CampaignStore(file);
    const rooms = [
      ['Wachstube', 0],
      ['Archiv', 20],
    ].map(([name, x]) => ({
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number: String(x / 20 + 1),
      name,
      revision: 0,
      polygons: [
        {
          outer: [
            { x, y: 0 },
            { x: x + 12, y: 0 },
            { x: x + 12, y: 9 },
            { x, y: 9 },
          ],
          holes: [],
        },
      ],
      sections: [
        {
          id: randomUUID(),
          kind: 'markdown',
          markdown: 'Original ' + name + '\r\n  Unverändert.\r\n',
        },
      ],
    }));
    const campaign = store.create('Wiederherstellbare Kartenfläche', rooms),
      w = store.activateShell(campaign.id),
      originalDrawing = store.drawing(w.token);
    store.tutorial('skipped');
    store.close();

    let app;
    const errors = [],
      launches = [],
      results = [];
    const state = (page) =>
      page.locator('#campaign-map').evaluate((e) => ({
        state: e.dataset.canvasState,
        view: JSON.parse(e.dataset.atlasView),
        version: Number(e.dataset.sceneVersion ?? 0),
        width: e.clientWidth,
      }));
    async function loaded(page) {
      await page.waitForFunction(
        () => document.getElementById('campaign-map').dataset.canvasState === 'loaded',
      );
    }
    async function choose(page, name) {
      await page.locator('#atlas-search').fill(name);
      await page.waitForFunction(
        (n) => document.getElementById('atlas-search-results').textContent.includes(n),
        name,
      );
      await page.locator('#atlas-search-results button').filter({ hasText: name }).first().click();
      await page.waitForFunction(
        () => document.getElementById('campaign-atlas').dataset.regionState === 'ready',
      );
    }
    async function close() {
      const exited = new Promise((r) =>
        app.process().once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      let timer;
      try {
        const exit = await Promise.race([
          exited,
          new Promise(
            (_, reject) =>
              (timer = setTimeout(() => reject(Error('Normal close timed out')), 10000)),
          ),
        ]);
        assert.deepEqual(exit, { code: 0, signal: null });
        launches.at(-1).exit = exit;
        app = null;
      } finally {
        clearTimeout(timer);
      }
    }
    async function launch(scale) {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [
          root + '/.build/desktop/main.cjs',
          '--ozone-platform=x11',
          '--force-device-scale-factor=' + scale,
          '--data-dir',
          profile,
        ],
        timeout: 30000,
      });
      launches.push({ scale, pid: app.process().pid });
      const page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: /Öffnen|Fortsetzen/ })
        .click();
      await page.locator('#campaign-atlas').waitFor({ state: 'visible' });
      await choose(page, 'Wachstube');
      return page;
    }
    try {
      for (const scale of [1]) {
        const page = await launch(scale);
        await loaded(page);
        const before = await state(page),
          retry = page.locator('.map-canvas-state[data-canvas-for="campaign-map"] button');
        const loss = await page.evaluate(() => {
          const root = document.getElementById('campaign-map'),
            ctx = root.getContext('2d');
          window.__lost = true;
          ctx.clearRect(0, 0, root.width, root.height);
          ctx.isContextLost = () => window.__lost;
          for (const name of ['fill', 'stroke', 'fillText', 'strokeText', 'drawImage']) {
            const real = ctx[name].bind(ctx);
            ctx[name] = (...args) => {
              if (!window.__lost) return real(...args);
            };
          }
          const event = new Event('contextlost', { cancelable: true });
          root.dispatchEvent(event);
          return { canceled: event.defaultPrevented };
        });
        assert.equal(loss.canceled, false, 'Canvas2D browser restoration must remain allowed');
        for (let i = 0; i < 3; i++) {
          await retry.click();
          assert.equal((await state(page)).state, 'unavailable');
          assert(await retry.isVisible());
        }
        assert.deepEqual((await state(page)).view, before.view);
        // Facts/navigation remain useful while drawing is unavailable. Restore the latest adopter frame.
        await choose(page, 'Archiv');
        const selected = await state(page);
        assert.equal(selected.state, 'unavailable');
        assert.equal(await page.locator('#atlas-selection-title').innerText(), 'Archiv');
        await page.evaluate(() => {
          window.__lost = false;
          document.getElementById('campaign-map').dispatchEvent(new Event('contextrestored'));
        });
        await loaded(page);
        assert.deepEqual((await state(page)).view, selected.view);
        assert.equal(await page.locator('#atlas-selection-title').innerText(), 'Archiv');
        const pixels = await page.locator('#campaign-map').evaluate((e) => {
          const data = e.getContext('2d').getImageData(0, 0, e.width, e.height).data;
          let visible = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i]) visible++;
          return visible;
        });
        assert(pixels > 100);
        assert.equal(await page.locator('#campaign-map').count(), 1);
        assert.equal(
          await page.locator('.map-canvas-controls[data-canvas-for="campaign-map"]').count(),
          1,
        );
        await page.evaluate(() => {
          const root = document.getElementById('campaign-map'),
            get = root.getContext.bind(root);
          window.__lost = true;
          root.dispatchEvent(new Event('contextlost', { cancelable: true }));
          window.__acquisitionBroken = true;
          root.getContext = (...args) => {
            if (window.__acquisitionBroken) throw Error('Kontrollierter Kontextfehler');
            return get(...args);
          };
        });
        await retry.click();
        assert.equal((await state(page)).state, 'unavailable');
        assert(
          (
            await page.locator('.map-canvas-state[data-canvas-for="campaign-map"]').innerText()
          ).includes('Kontrollierter Kontextfehler'),
        );
        await page.evaluate(() =>
          document.getElementById('campaign-map').dispatchEvent(new Event('contextrestored')),
        );
        assert.equal((await state(page)).state, 'unavailable');
        await page.evaluate(() => {
          window.__lost = false;
          window.__acquisitionBroken = false;
        });
        await retry.click();
        await loaded(page);
        assert.deepEqual((await state(page)).view, selected.view);
        const box = await page.locator('#campaign-map').boundingBox(),
          start = await state(page);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down({ button: 'middle' });
        await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2);
        await page.mouse.up({ button: 'middle' });
        await loaded(page);
        const panned = await state(page);
        assert(
          Math.abs(panned.view.x - (start.view.x - (40 * start.view.width) / start.width)) < 1e-6,
          'one pointer drag must have one passive camera effect',
        );
        await page.getByRole('button', { name: '← Vorige Ansicht', exact: true }).click();
        await loaded(page);
        assert.deepEqual((await state(page)).view, start.view);
        await page
          .locator('#campaign-map')
          .screenshot({ path: output + '/restored-' + scale + '.png' });
        results.push({
          scale,
          lossNotCanceled: true,
          lostRetryRemainsUnavailable: true,
          latestSelectionAndCameraRestored: true,
          visiblePixels: pixels,
          singleCameraGesture: true,
          acquisitionExceptionRecovered: true,
        });
        await close();
      }
      const checked = new CampaignStore(file);
      try {
        const active = checked.activateShell(campaign.id);
        assert.deepEqual(checked.drawing(active.token), originalDrawing);
      } finally {
        checked.close();
      }
      assert.deepEqual(errors, []);
      await native.recordResult({
        source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
        profile,
        results,
        errors,
        launches,
        artifactHashes,
        authoredDataUnchanged: true,
        qualification:
          'Controlled Canvas2D API/event fault injection; physical GPU/driver recovery remains open.',
      });
      console.log(JSON.stringify({ profile, results, launches, authoredDataUnchanged: true }));
    } catch (error) {
      await writeFile(
        output + '/failure.json',
        JSON.stringify({ error: error.stack, results, errors, launches }, null, 2),
      );
      if (app)
        try {
          await (await app.firstWindow()).screenshot({ path: output + '/failure.png' });
        } catch {}
      throw error;
    } finally {
    }
  },
);
