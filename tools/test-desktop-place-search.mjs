import { runNativeProbe } from './native-session.mjs';
// A distant named World location: search, edit in context, return, and find after restart.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/place-search'),
  zoom = Number(process.env.GM_QA_ZOOM ?? 1),
  baseline = process.argv.includes('--baseline');
await runNativeProbe(
  { output: out, name: 'place-search', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    await rm(out + '/result.json', { force: true });
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/place-search-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/place-search-store.cjs'),
      profile = native.profile,
      filename = profile + '/workbench.sqlite',
      store = new CampaignStore(filename),
      campaign = store.create('Orte am Küstenweg'),
      w = store.activate(campaign.id);
    const command = (action) => ({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action,
      }),
      placeIds = [],
      sections = [];
    for (const [name, x] of [
      ['Wegposten', 0],
      ['Salzfurt', 1250000],
    ]) {
      const id = randomUUID(),
        section = randomUUID();
      placeIds.push(id);
      sections.push(section);
      store.changePreparation({
        ...command(null),
        change: {
          kind: 'location',
          expectedRevision: null,
          document: {
            kind: 'location',
            version: 1,
            id,
            name,
            type: 'poi',
            sections: [
              {
                id: section,
                title: 'Am Fluss',
                markdown: '  Die Fährfrau wartet bis Sonnenuntergang.\r\n',
              },
            ],
            detailMaps: [],
            keyLinks: [],
          },
        },
      });
      store.executeAtlasCommit(
        command({
          kind: 'landscape-put',
          record: {
            id: randomUUID(),
            revision: 0,
            kind: 'place',
            name,
            locationId: id,
            points: [{ x, y: 0 }],
            polygons: [],
            width: 0,
            resolution: 100,
            values: {},
          },
          expectedRevision: null,
        }),
      );
    }
    store.tutorial('skipped');
    store.close();
    const result = {
      checkout: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      zoom,
      baseline,
      profile,
      hashes: {},
      errors: [],
      launches: [],
      searches: [],
    };
    for (const file of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
      result.hashes[file] = createHash('sha256')
        .update(await readFile(root + '/.build/desktop/' + file))
        .digest('hex');
    let app, page;
    const shot = async (name) => {
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      await writeFile(
        out + '/' + name + '.png',
        Buffer.from(
          await app.evaluate(async ({ BrowserWindow }) =>
            (
              await BrowserWindow.getAllWindows()
                .find((w) => w.webContents.getURL().endsWith('/index.html'))
                .webContents.capturePage()
            ).toPNG(),
          ),
        ),
      );
    };
    async function launch() {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [root + '/.build/desktop/main.cjs', '--data-dir', profile, '--ozone-platform=x11'],
        timeout: 60000,
      });
      page = await app.firstWindow();
      page.setDefaultTimeout(30000);
      page.on('pageerror', (e) => result.errors.push(e.stack));
      result.launches.push({ pid: app.process().pid });
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      await app.evaluate(
        ({ BrowserWindow }, z) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.setZoomFactor(z),
        zoom,
      );
      await page
        .locator('.campaign-card')
        .filter({ hasText: campaign.name })
        .getByRole('button', { name: /^(Öffnen|Fortsetzen)$/ })
        .click();
      await page.waitForFunction(() => !document.querySelector('main').inert);
      if (await page.locator('#campaign-atlas').isHidden()) {
        if (!(await page.locator('#atlas-tab').isVisible()))
          await page.locator('#workspace-nav-summary').click();
        await page.locator('#atlas-tab').click();
      }
      await atlasCanvasReady(page);
    }
    async function close() {
      const pid = app.process().pid,
        ended = new Promise((r) =>
          app.process().once('exit', (code, signal) => r({ code, signal })),
        );
      await native.close();
      const exit = await ended;
      assert.deepEqual(exit, { code: 0, signal: null });
      result.launches.at(-1).exit = exit;
      result.launches.at(-1).pidAbsent = !(await stat('/proc/' + pid)
        .then(() => true)
        .catch(() => false));
      assert(result.launches.at(-1).pidAbsent);
      app = null;
    }
    async function find(name) {
      await page.locator('#atlas-search').fill('');
      await page.locator('#atlas-search').fill(name);
      await page.locator('#atlas-search-results button').filter({ hasText: name }).click();
      await atlasCanvasReady(page);
      await shot('find-' + result.searches.length);
      const visible = await page.locator('#land-name').isVisible(),
        value = visible ? await page.locator('#land-name').inputValue() : null;
      result.searches.push({
        name,
        visible,
        value,
        camera: JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view')),
      });
      return visible && value === name;
    }
    try {
      await launch();
      assert(await find('Wegposten'));
      result.firstClick = await find('Salzfurt');
      if (!baseline) {
        assert.equal(
          await page.locator('#atlas-group-tools').getAttribute('data-group'),
          'objects',
        );
        assert.equal(await page.locator('#atlas-active-tool').textContent(), 'Objekt auswählen');
        assert.equal(await page.locator('#land-position').evaluate((n) => n.open), false);
        assert.equal(await page.locator('#land-x').isVisible(), false);
        for (const id of [
          'land-radius-slider',
          'vegetation-selection-filter',
          'vegetation-spatial',
          'land-cursor-height',
        ])
          assert.equal(
            await page.locator('#' + id).isVisible(),
            false,
            id + ' is unrelated to editing place prose',
          );
        assert(await page.locator('[data-section-body="' + sections[1] + '"]').isVisible());
      }
      if (!result.firstClick) {
        if (!baseline)
          throw Error('Ein Suchtreffer muss die Ortsdetails beim ersten Klick öffnen.');
        result.retry = await find('Salzfurt');
      }
      if (result.firstClick || result.retry) {
        await page.locator('#land-name').fill('Salzfurt am Fluss');
        await page
          .locator('[data-section-body="' + sections[1] + '"]')
          .fill('  Die Fährfrau wartet jetzt bis Mitternacht.\n');
        await page
          .locator('#land-selection')
          .getByRole('button', { name: 'Auswahl speichern', exact: true })
          .click();
        await atlasCanvasReady(page);
        await shot('edited');
        await page.getByRole('button', { name: 'Vorige Ansicht', exact: true }).click();
        await atlasCanvasReady(page);
        const back = JSON.parse(
          await page.locator('#campaign-map').getAttribute('data-atlas-view'),
        );
        result.returned = Math.abs(back.x + back.width / 2) < 10000;
        assert(result.returned, 'Vorige Ansicht returns to the starting place without retyping it');
        await shot('returned');
        await close();
        await launch();
        result.reopened = await find('Salzfurt am Fluss');
        if (result.reopened)
          assert.equal(
            await page.locator('[data-section-body="' + sections[1] + '"]').inputValue(),
            '  Die Fährfrau wartet jetzt bis Mitternacht.\n',
          );
      }
      if (!baseline && app) {
        await page.locator('[data-tool-group=land]').click();
        await page.locator('[data-atlas-tool=land-shape]').click();
        assert(
          await page.locator('#land-radius-slider').isVisible(),
          'drawing tools retain their radius',
        );
        await page.locator('[data-tool-group=objects]').click();
        await page.locator('[data-atlas-tool=object-select]').click();
        assert.equal(await page.locator('#land-radius-slider').isVisible(), false);
      }
      if (app) await close();
      const fresh = new CampaignStore(filename);
      try {
        const fw = fresh.activate(campaign.id),
          p = fresh.deskContent(fw.token, { kind: 'location', id: placeIds[1] });
        result.saved = p.location;
        assert.equal(p.location.name, 'Salzfurt am Fluss');
        assert.equal(
          p.location.sections[0].markdown,
          '  Die Fährfrau wartet jetzt bis Mitternacht.\n',
        );
        assert.deepEqual(
          fresh.landscapeFind(fw.token, placeIds[1]).find((r) => r.locationId === placeIds[1])
            .points,
          [{ x: 1250000, y: 0 }],
        );
        assert.equal(
          fresh.deskContent(fw.token, { kind: 'location', id: placeIds[0] }).location.name,
          'Wegposten',
        );
      } finally {
        fresh.close();
      }
      result.complete = !!result.firstClick && !!result.returned && !!result.reopened;
      assert.deepEqual(result.errors, []);
      await native.recordResult(result);
      console.log(
        JSON.stringify({
          complete: result.complete,
          firstClick: result.firstClick,
          searches: result.searches,
          launches: result.launches,
        }),
      );
    } catch (e) {
      if (app) await shot('failure').catch(() => {});
      await writeFile(
        out + '/failure.json',
        JSON.stringify({ ...result, error: e.stack }, null, 2),
      );
      throw e;
    } finally {
    }
  },
);
