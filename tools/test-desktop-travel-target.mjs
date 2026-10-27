import { runNativeProbe } from './native-session.mjs';
import { currentProcessGroup } from './process-group.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const source = process.cwd(),
  before = process.argv.includes('--before'),
  phase = before ? 'before' : 'after',
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/travel-target-evidence');
await runNativeProbe(
  { output: output, name: 'travel-target', resultName: 'travel-' + phase + '.json' },
  async (native) => {
    const group = await currentProcessGroup();
    await mkdir(output, { recursive: true });
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/travel-native-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/travel-native-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      store = new CampaignStore(file),
      campaign = store.create('Reise nach der Ortswahl'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      });
    const pc = store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Iri' } }),
    ).character;
    store.executeLive(
      command({
        kind: 'membership',
        characterId: pc.id,
        expectedRevision: pc.membershipRevision,
        expectedRosterRevision: store.live(w.token).rosterRevision,
        active: true,
        targetSceneId: null,
        expectedFocusRevision: null,
      }),
    );
    const scene = store.executeLive(
      command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
    ).scene;
    const currentMap = store.world(w.token).maps[0],
      map = {
        ...currentMap,
        id: currentMap.id,
        revision: currentMap.revision,
        name: 'Küstenweg',
        hexMeters: currentMap.hexMeters,
        climate: 'temperate',
        seed: 'native-travel-target',
        cells: [
          {
            q: 1,
            r: 0,
            level: 0,
            terrain: 'plains',
            elevationM: 0,
            climate: null,
            road: false,
            river: false,
            label: 'Spuren',
            faction: '',
            interrupt: 'Frische Spuren am Weg',
          },
        ],
      };
    map.cells.push({ ...map.cells[0], q: 2, label: 'Zielpunkt', interrupt: '' });
    store.executeWorld(command({ kind: 'map', map, expectedRevision: currentMap.revision }));
    const location = {
      kind: 'location',
      version: 1,
      id: randomUUID(),
      name: 'Ruine',
      type: 'poi',
      sections: [{ id: randomUUID(), title: 'GM', markdown: '  Geschützte Prosa\r\n' }],
      detailMaps: [],
      keyLinks: [],
    };
    store.changePreparation({
      ...command(null),
      change: { kind: 'location', expectedRevision: null, document: location },
    });
    store.executeWorld(
      command({
        kind: 'place',
        mapId: map.id,
        locationId: location.id,
        expectedRevision: null,
        hex: { q: 3, r: 0 },
      }),
    );
    store.executeWorld(
      command({
        kind: 'place-scene',
        sceneId: scene.id,
        position: { mapId: map.id, q: 0, r: 0, locationId: null },
        expectedSceneRevision: scene.revision,
        expectedPositionRevision: 0,
      }),
    );
    store.executeWorld(
      command({
        kind: 'weather-override',
        sceneId: scene.id,
        expectedClockRevision: 0,
        expectedOverrideRevision: null,
        weather: {
          label: 'Klar',
          kind: 'clear',
          intensity: 0,
          windKmh: 0,
          effects: {
            visibilityMeters: 10000,
            travelFactor: 1,
            perception: 'Normal',
            temperatureC: 15,
            ambience: [],
            combatNote: '',
          },
          source: 'GM-Override',
        },
      }),
    );
    store.close();

    let app,
      pid,
      closed = false;
    const errors = [],
      launches = [],
      results = {};
    async function checkHexLabels(page) {
      const boxes = await page.locator('#world-map [data-hex-label]').evaluateAll((nodes) =>
        nodes.map((n) => {
          const b = n.getBoundingClientRect();
          return { text: n.textContent, x: b.x, y: b.y, width: b.width, height: b.height };
        }),
      );
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i],
            b = boxes[j];
          assert(
            a.x + a.width <= b.x ||
              b.x + b.width <= a.x ||
              a.y + a.height <= b.y ||
              b.y + b.height <= a.y,
            'Visible Hex labels overlap',
          );
        }
      return boxes;
    }

    async function launch() {
      closed = false;
      app = await native.launchConfigured({
        executablePath: source + '/node_modules/electron/dist/electron',
        args: [source + '/.build/desktop/main.cjs', '--data-dir', profile, '--ozone-platform=x11'],
        timeout: 20000,
      });
      pid = app.process().pid;
      assert((await readFile(`/proc/${pid}/cmdline`, 'utf8')).includes(profile));
      assert.equal((await readFile(`/proc/${pid}/cgroup`, 'utf8')).trim().split('::')[1], group);
      launches.push({ pid, cgroup: group });
      const page = await app.firstWindow();
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true', null, {
        timeout: 20000,
      });
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: 'Fortsetzen', exact: true })
        .click();
      await page.waitForFunction(
        () => !document.querySelector('main').inert && !document.querySelector('header').inert,
      );
      await page.locator('#world-tab').click();
      await page.locator('#world-map-select').selectOption(map.id);
      await page.locator('#world-scene').selectOption(scene.id);
      return page;
    }
    async function close() {
      assert.deepEqual(errors, []);
      const exit = new Promise((r) =>
        app.process().once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      assert.deepEqual(await exit, { code: 0, signal: null });
      closed = true;
    }
    try {
      let page = await launch();
      await page.locator('#world-map').scrollIntoViewIfNeeded();
      if (!before) {
        results.crowdedLabels = await checkHexLabels(page);
        assert.deepEqual(
          results.crowdedLabels.map((b) => b.text),
          ['Spuren'],
        );
      }
      await page.locator('#world-map').getByText('Spuren', { exact: true }).click();
      await page.waitForFunction(() =>
        document.querySelector('#hex-selected').textContent.includes('1,0'),
      );
      assert.equal(await page.locator('#travel-q').inputValue(), '1');
      results.mapSelectionUpdatesTarget = true;
      if (!before) {
        await page.locator('#world-map polygon[data-q="2"][data-r="0"]').click();
        await page.waitForFunction(
          () => document.querySelector('#hex-label').value === 'Zielpunkt',
        );
        assert.deepEqual(
          (await checkHexLabels(page)).map((b) => b.text),
          ['Zielpunkt'],
        );
        for (let i = 0; i < 7 && (await page.locator('#world-zoom-in').isEnabled()); i++)
          await page.locator('#world-zoom-in').click();
        results.zoomedLabels = await checkHexLabels(page);
        assert.equal(results.zoomedLabels.length, 2);
        await page.locator('#world-map').getByText('Spuren', { exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#hex-label').value === 'Spuren');
        await page
          .locator('.map-canvas-controls[data-canvas-for="world-map"] button')
          .last()
          .click();
      }

      await page.locator('#travel-mode-target').click();
      await page.locator('#travel-advanced > summary').click();
      await page.locator('#world-destination').selectOption(location.id);
      assert.equal(await page.locator('#travel-q').inputValue(), '3');
      await page.locator('#world-destination').selectOption('');
      results.afterReturningToSelectedHex = {
        q: await page.locator('#travel-q').inputValue(),
        r: await page.locator('#travel-r').inputValue(),
      };
      await page.locator('#world-destination').selectOption(location.id);
      await page.locator('#travel-q').fill('2');
      results.afterManualCoordinate = {
        locationId: await page.locator('#world-destination').inputValue(),
        q: await page.locator('#travel-q').inputValue(),
      };
      await page.locator('#world-travel-form').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, 'travel-' + phase + '.png') });
      if (!before) {
        assert.equal(results.afterReturningToSelectedHex.q, '1');
        assert.equal(results.afterManualCoordinate.locationId, '');
        await page.locator('#travel-final-hours').fill('2');
        await page
          .locator('#world-travel-form')
          .getByRole('button', { name: 'Route und Reisezeit ansehen', exact: true })
          .click();
        await page.locator('#travel-preview-dialog').waitFor({ state: 'visible' });
        results.preview = await page.locator('#travel-preview-summary').innerText();
        assert(results.preview.includes('2.00 km'));
        assert(results.preview.includes('2.00 Stunden'));
        await page.locator('#travel-preview-accept').click();
        await page.locator('#travel-preview-dialog').waitFor({ state: 'hidden' });
        await page.locator('#journey-many').click();
        await page.waitForFunction(() =>
          document
            .querySelector('#world-journey-status')
            .textContent.includes('Zur GM-Entscheidung angehalten'),
        );
        assert.equal(await page.locator('#journey-step').isDisabled(), true);
        results.interruption = await page.locator('#world-journey-status').innerText();
      }
      await close();
      if (!before) {
        const checkpoint = new CampaignStore(file);
        try {
          const w = checkpoint.activate(campaign.id),
            world = checkpoint.sceneWorld(w.token, scene.id);
          assert.equal(world.position.q, 1);
          assert.equal(world.scene.clock.instantMs, '3600000');
          assert.equal(world.journey.status, 'interrupted');
          results.pauseCheckpoint = { q: world.position.q, instant: world.scene.clock.instantMs };
        } finally {
          checkpoint.close();
        }
        page = await launch();
        await page.waitForFunction(() =>
          document
            .querySelector('#world-journey-status')
            .textContent.includes('Zur GM-Entscheidung angehalten'),
        );
        await page.locator('#journey-play').click();
        await page.locator('#journey-many').click();
        await page.waitForFunction(() =>
          document.querySelector('#world-journey-status').textContent.includes('Angekommen'),
        );
        await close();
        const fresh = new CampaignStore(file);
        try {
          const w = fresh.activate(campaign.id),
            world = fresh.sceneWorld(w.token, scene.id);
          assert.equal(world.position.q, 2);
          assert.equal(world.scene.clock.instantMs, '7200000');
          assert.equal(world.journey.status, 'arrived');
          assert.equal(
            fresh.db
              .prepare('SELECT count(*) n FROM scene_time_step WHERE campaign_id=? AND scene_id=?')
              .get(campaign.id, scene.id).n,
            2,
          );
          assert.deepEqual(
            fresh.preparation(w.token).locations[0].document.sections,
            location.sections,
          );
          results.nativeRestartResumeAndExactArrival = true;
        } finally {
          fresh.close();
        }
      }
      await native.recordResult({ results, launches, normalClose: true });
      console.log(JSON.stringify({ results, normalClose: true }));
      assert.equal(
        results.afterReturningToSelectedHex.q,
        '1',
        'Selected hex must replace the previous named destination',
      );
      assert.equal(
        results.afterManualCoordinate.locationId,
        '',
        'Manual coordinates must release the previous place binding',
      );
    } catch (e) {
      if (app && !closed) {
        await writeFile(
          path.join(output, 'failure.json'),
          JSON.stringify({ error: e.stack, results, pid }, null, 2),
        );
        try {
          await (await app.firstWindow()).screenshot({ path: path.join(output, 'failure.png') });
        } catch {}
      }
      throw e;
    } finally {
    }
  },
);
