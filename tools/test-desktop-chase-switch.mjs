import { runNativeProbe } from './native-session.mjs';
import { currentProcessGroup } from './process-group.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
const layoutBaseline = process.argv.includes('--layout-baseline');
const source = process.cwd(),
  before = process.argv.includes('--before'),
  phase = before ? 'before' : 'after',
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/chase-switch-evidence');
await runNativeProbe(
  { output: output, name: 'chase-switch', resultName: 'chase-' + phase + '.json' },
  async (native) => {
    const group = await currentProcessGroup();
    await mkdir(output, { recursive: true });
    await rm(path.join(output, 'chase-after.json'), { force: true });
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/desktop/chase-switch-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/desktop/chase-switch-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      store = new CampaignStore(file),
      campaign = store.create('Zwei unabhängige Verfolgungen'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      });
    const scene = store.executeLive(
      command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
    ).scene;
    const chases = [];
    for (const [title, name] of [
      ['Hafenflucht', 'Kurier'],
      ['Waldpfad', 'Späher'],
    ]) {
      let c = store.executeChase({
        ...command({ kind: 'create', title, goal: 'Tor erreichen' }),
        sceneId: scene.id,
        chaseId: null,
        expectedRevision: null,
      }).chase;
      c = store.executeChase({
        ...command({
          kind: 'participant',
          participant: {
            id: randomUUID(),
            characterId: null,
            name,
            side: 'quarry',
            distance: 18,
            speed: 9,
            exhaustion: 0,
            notes: '  Hinweis\r\n- Tor',
          },
        }),
        sceneId: scene.id,
        chaseId: c.id,
        expectedRevision: c.revision,
      }).chase;
      chases.push(c);
    }
    const [a, b] = chases;
    const originalA = store.db.prepare('SELECT payload,checksum FROM chase WHERE id=?').get(a.id);
    const initialClock = store.liveScene(w.token, scene.id).clock;
    store.close();

    let app,
      pid,
      closed = false;
    const errors = [],
      launches = [],
      results = {};
    const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      buildHashes = {};
    for (const name of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
      buildHashes[name] = createHash('sha256')
        .update(await readFile(path.join(source, '.build/desktop', name)))
        .digest('hex');
    async function capture(page, name) {
      await page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            let frame;
            const timer = setTimeout(() => {
              cancelAnimationFrame(frame);
              reject(Error('No fresh native capture frames'));
            }, 2500);
            frame = requestAnimationFrame(() => {
              frame = requestAnimationFrame(() => {
                clearTimeout(timer);
                resolve();
              });
            });
          }),
      );
      const bytes = Buffer.from(
        await app.evaluate(async ({ BrowserWindow }) =>
          (
            await BrowserWindow.getAllWindows()
              .find((w) => w.webContents.getURL().endsWith('/index.html'))
              .webContents.capturePage()
          ).toPNG(),
        ),
      );
      const png = require('pngjs').PNG.sync.read(bytes),
        colors = new Set();
      for (let i = 0; i < png.data.length; i += 4 * 31) colors.add(png.data.readUInt32BE(i));
      assert(colors.size > 8);
      await writeFile(path.join(output, name + '.png'), bytes);
    }
    async function launch(zoom = 1, title = 'Waldpfad') {
      closed = false;
      app = await native.launchConfigured({
        executablePath: source + '/node_modules/electron/dist/electron',
        args: [source + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
        timeout: 20000,
      });
      pid = app.process().pid;
      assert((await readFile(`/proc/${pid}/cmdline`, 'utf8')).includes(profile));
      assert.equal((await readFile(`/proc/${pid}/cgroup`, 'utf8')).trim().split('::')[1], group);
      launches.push({ pid, cgroup: group, zoom });
      const page = await app.firstWindow();
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true', null, {
        timeout: 20000,
      });
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await app.evaluate(({ BrowserWindow }, zoom) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.webContents.setZoomFactor(zoom);
        w.show();
        w.focus();
      }, zoom);
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: /Öffnen|Fortsetzen/ })
        .click();
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
      if (!(await page.locator('#live-tab').isVisible())) {
        if (await page.locator('#atlas-navigation').isVisible())
          await page.locator('#atlas-navigation').click();
        else await page.locator('#workspace-nav-summary').click();
      }
      await page.locator('#live-tab').click();
      if (await page.locator('#live-continue').isVisible())
        await page.locator('#live-continue').click();
      await page.locator('#combat-panel').waitFor({ state: 'visible' });
      await page.waitForFunction(
        (title) => document.querySelector('#chase-status').textContent.startsWith(title + ' ·'),
        title,
      );
      return page;
    }
    async function close() {
      assert.deepEqual(errors, []);
      const exit = new Promise((r) =>
        app.process().once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      let timer;
      try {
        const result = await Promise.race([
          exit,
          new Promise(
            (_, reject) =>
              (timer = setTimeout(() => reject(Error('Normal close timed out')), 10000)),
          ),
        ]);
        assert.deepEqual(result, { code: 0, signal: null });
        launches.at(-1).exit = result;
        await assert.rejects(stat('/proc/' + pid), { code: 'ENOENT' });
        launches.at(-1).pidAbsent = true;
        closed = true;
      } finally {
        clearTimeout(timer);
      }
    }
    try {
      let page = await launch();
      const choose = async (id, title) => {
        await page.locator('#chase-recent').selectOption(id);
        await page.waitForFunction(
          (title) => document.querySelector('#chase-status').textContent.startsWith(title + ' ·'),
          title,
        );
      };
      await choose(a.id, a.title);
      await app.evaluate(({ ipcMain }, id) => {
        const original = ipcMain._invokeHandlers.get('campaign:chase');
        let hold = true;
        globalThis.qaChaseHeld = false;
        ipcMain.removeHandler('campaign:chase');
        ipcMain.handle('campaign:chase', async (e, ...args) => {
          const result = await original(e, ...args);
          if (hold && args[2] === id) {
            hold = false;
            globalThis.qaChaseHeld = true;
            return new Promise((resolve) => {
              globalThis.qaReleaseChase = () => resolve(result);
            });
          }
          return result;
        });
      }, b.id);
      await page.locator('#chase-recent').selectOption(b.id);
      for (let i = 0; i < 100; i++) {
        if (await app.evaluate(() => globalThis.qaChaseHeld)) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      assert(await app.evaluate(() => globalThis.qaChaseHeld));
      results.duringSwitch = {
        selected: await page.locator('#chase-recent').inputValue(),
        visible: await page.locator('#chase-status').innerText(),
        roundEnabled: await page.locator('#chase-round').isEnabled(),
      };
      if (before) {
        await page.locator('#chase-round').click();
        await page.waitForFunction(() =>
          document.querySelector('#chase-status').textContent.includes('Runde 1'),
        );
        await app.evaluate(() => globalThis.qaReleaseChase());
        await page.waitForFunction(() =>
          document.querySelector('#chase-status').textContent.startsWith('Waldpfad ·'),
        );
        await page.locator('#chase-people [data-distance]').fill('36');
        await page.locator('#chase-refresh').click();
        await page.waitForFunction(
          () => document.querySelector('#chase-people [data-distance]').value === '18',
        );
        results.unconfirmedDistanceAfterRefresh = await page
          .locator('#chase-people [data-distance]')
          .inputValue();
      } else {
        assert.equal(results.duringSwitch.roundEnabled, false);
        await page.evaluate(() => document.querySelector('#chase-round').onclick());
        await app.evaluate(() => globalThis.qaReleaseChase());
        await page.waitForFunction(() =>
          document.querySelector('#chase-status').textContent.startsWith('Waldpfad ·'),
        );
        await page.locator('#chase-people [data-distance]').fill('36');
        await page.locator('#chase-people [data-exhaustion]').fill('1');
        await page.locator('#chase-complication').fill('Umgestürzter Wagen');
        await page.locator('#chase-refresh').click();
        await page.waitForFunction(
          () => document.querySelector('#chase-panel').getAttribute('aria-busy') !== 'true',
        );
        assert.equal(await page.locator('#chase-people [data-distance]').inputValue(), '36');
        assert.equal(await page.locator('#chase-people [data-exhaustion]').inputValue(), '1');
        await choose(a.id, a.title);
        await choose(b.id, b.title);
        assert.equal(await page.locator('#chase-people [data-distance]').inputValue(), '36');
        assert.equal(await page.locator('#chase-complication').inputValue(), 'Umgestürzter Wagen');
        results.unconfirmedRoundRetained = true;
        await app.evaluate(({ ipcMain }, id) => {
          const original = ipcMain._invokeHandlers.get('campaign:chase');
          let fail = true;
          ipcMain.removeHandler('campaign:chase');
          ipcMain.handle('campaign:chase', async (e, ...args) => {
            if (fail && args[2] === id) {
              fail = false;
              return { ok: false, error: 'QA: Verfolgung vorübergehend nicht lesbar' };
            }
            return original(e, ...args);
          });
        }, a.id);
        await page.locator('#chase-recent').selectOption(a.id);
        await page.locator('#chase-load-status[role=alert]').waitFor();
        assert.equal(await page.locator('#chase-round').isEnabled(), false);
        await page.locator('#chase-refresh').click();
        await page.waitForFunction(() =>
          document.querySelector('#chase-status').textContent.startsWith('Hafenflucht ·'),
        );
        results.sameTargetRetry = true;
        await choose(b.id, b.title);
        await page.waitForFunction(() =>
          document.querySelector('#chase-draft-status').textContent.includes('Entwurf gesichert'),
        );
        await capture(page, 'unconfirmed-draft');
        await close();
        page = await launch();
        assert.equal(await page.locator('#chase-people [data-distance]').inputValue(), '36');
        assert.equal(await page.locator('#chase-people [data-exhaustion]').inputValue(), '1');
        assert.equal(await page.locator('#chase-complication').inputValue(), 'Umgestürzter Wagen');
        assert((await page.locator('#chase-status').innerText()).includes('Runde 0'));
        results.unconfirmedNativeRestart = true;
        await app.evaluate(({ ipcMain }) => {
          const execute = ipcMain._invokeHandlers.get('campaign:execute-chase'),
            status = ipcMain._invokeHandlers.get('campaign:commit-status');
          let drop = true,
            pending = false;
          ipcMain.removeHandler('campaign:execute-chase');
          ipcMain.handle('campaign:execute-chase', async (e, c) => {
            const result = await execute(e, c);
            if (drop && c.action.kind === 'round') {
              drop = false;
              pending = true;
              return { ok: false, error: 'QA: Bestätigungsantwort verloren' };
            }
            return result;
          });
          ipcMain.removeHandler('campaign:commit-status');
          ipcMain.handle('campaign:commit-status', async (e, ...args) => {
            if (pending) {
              pending = false;
              return { ok: true, value: { outcome: 'pending' } };
            }
            return status(e, ...args);
          });
        });
        await page.locator('#chase-round').click();
        await page.locator('#commit-pending').waitFor({ state: 'visible' });
        await page.waitForFunction(() => !document.querySelector('#commit-check').disabled);
        assert.equal(await page.locator('#chase-round').isEnabled(), false);
        await page.locator('#commit-check').click();
        await page.locator('#commit-pending').waitFor({ state: 'hidden' });
        await page.waitForFunction(
          () => document.querySelector('#chase-panel').getAttribute('aria-busy') !== 'true',
        );
        results.receiptRecoveryWithoutReplay = true;
        await page.waitForFunction(() =>
          document.querySelector('#chase-status').textContent.includes('Runde 1'),
        );
        assert.equal(await page.locator('#chase-people [data-distance]').inputValue(), '36');
        assert.equal(await page.locator('#chase-complication').inputValue(), '');
        await page.waitForFunction(() =>
          document.querySelector('#live-clock').textContent.endsWith('00:00:06'),
        );
        results.visibleSceneClock = await page.locator('#live-clock').innerText();
        if (!layoutBaseline) {
          assert.equal(
            await page.locator('#chase-clock').innerText(),
            'Gruppenzeit: Tag 0 · 00:00:06',
          );
          assert.equal(await page.locator('#chase-completion').getAttribute('open'), null);
          assert.equal(await page.locator('#chase-people [data-remove]').isVisible(), false);
          await page.locator('#chase-people summary').click();
          assert(await page.locator('#chase-people [data-remove]').isVisible());
          await page.locator('#chase-people summary').click();
          results.roundContext = true;
        }
      }
      await page.locator('#chase-status').scrollIntoViewIfNeeded();
      await capture(page, 'chase-' + phase);
      await page.locator('#live-clock').scrollIntoViewIfNeeded();
      await capture(page, 'scene-time');
      await close();
      const fresh = new CampaignStore(file);
      try {
        const active = fresh.activate(campaign.id),
          ca = fresh.chase(active.token, scene.id, a.id).chase,
          cb = fresh.chase(active.token, scene.id, b.id).chase;
        results.rounds = { a: ca.round, b: cb.round };
        if (!before) {
          assert.deepEqual(
            fresh.db.prepare('SELECT payload,checksum FROM chase WHERE id=?').get(a.id),
            originalA,
          );
          assert.equal(cb.round, 1);
          assert.equal(cb.participants[0].distance, 36);
          assert.equal(cb.participants[0].exhaustion, 1);
          assert.equal(cb.complication, 'Umgestürzter Wagen');
          const clock = fresh.liveScene(active.token, scene.id).clock;
          assert.equal(BigInt(clock.instantMs) - BigInt(initialClock.instantMs), 6000n);
          assert.equal(
            fresh.db
              .prepare('SELECT count(*) n FROM scene_time_step WHERE campaign_id=?')
              .get(campaign.id).n,
            1,
          );
          results.exactSixSecondsOnce = true;
          assert.equal(cb.participants[0].notes, b.participants[0].notes);
          results.freshStoreExact = true;
        }
      } finally {
        fresh.close();
      }
      if (!before) {
        page = await launch(2);
        assert((await page.locator('#live-clock').innerText()).endsWith('00:00:06'));
        assert.equal(await page.locator('#chase-people [data-distance]').inputValue(), '36');
        assert.equal(await page.locator('#chase-people [data-exhaustion]').inputValue(), '1');
        await page.locator('#chase-people [data-distance]').fill('72');
        await page.locator('#chase-people [data-exhaustion]').fill('');
        await page.locator('#chase-complication').fill('Brücke noch ungeklärt');
        await page.locator('#chase-participant-add summary').click();
        await page.locator('#chase-name').fill('Unfertige Wache');
        await page.locator('#chase-speed').fill('');
        if (!layoutBaseline) await page.locator('#chase-completion summary').click();
        await page.locator('#chase-outcome').fill('Späher erreicht das Tor.');
        await page.locator('#chase-status').scrollIntoViewIfNeeded();
        await capture(page, 'draft-before-finish-200');
        await page.locator('#chase-finish').click();
        await page.waitForFunction(() =>
          document.querySelector('#chase-status').textContent.includes('Späher erreicht das Tor.'),
        );
        await page.locator('#chase-status').scrollIntoViewIfNeeded();
        await capture(page, 'finished-200');
        assert(
          await page.locator('#chase-retained-draft').isVisible(),
          'Finishing must expose retained unconfirmed work',
        );
        assert.equal(await page.locator('#chase-people [data-distance]').inputValue(), '36');
        assert.equal(await page.locator('#chase-people [data-exhaustion]').inputValue(), '1');
        await close();
        const final = new CampaignStore(file);
        try {
          const active = final.activate(campaign.id);
          assert.equal(final.chase(active.token, scene.id, b.id).chase.status, 'finished');
          assert.equal(
            BigInt(final.liveScene(active.token, scene.id).clock.instantMs) -
              BigInt(initialClock.instantMs),
            6000n,
          );
          assert.equal(
            final.db
              .prepare(
                "SELECT count(*) n FROM world_history WHERE json_extract(payload,'$.facts.chaseId')=?",
              )
              .get(b.id).n,
            1,
          );
        } finally {
          final.close();
        }
        results.nativeRestartAndSingleFinish = true;
        page = await launch(2, 'Hafenflucht');
        await choose(b.id, b.title);
        assert(
          (await page.locator('#chase-status').innerText()).includes('Späher erreicht das Tor.'),
        );
        assert.equal(await page.locator('#chase-round').isEnabled(), false);
        assert((await page.locator('#live-clock').innerText()).endsWith('00:00:06'));
        await page.locator('#chase-status').scrollIntoViewIfNeeded();
        await capture(page, 'finished-fresh-200');
        assert(await page.locator('#chase-retained-draft').isVisible());
        const retained = await page.locator('#chase-retained-text').inputValue();
        assert(
          retained.includes('72') &&
            retained.includes('Brücke noch ungeklärt') &&
            retained.includes('Unfertige Wache'),
        );
        assert.equal(await page.locator('#chase-retained-text').isEditable(), false);
        await page.locator('#chase-retained-text').scrollIntoViewIfNeeded();
        await page.locator('#chase-retained-text').focus();
        await page.locator('#chase-retained-text').press('Control+A');
        assert.equal(
          await page
            .locator('#chase-retained-text')
            .evaluate((e) => e.selectionEnd - e.selectionStart),
          retained.length,
        );
        await capture(page, 'retained-draft-fresh-200');
        await close();
        results.unconfirmedFinishDraftRetained = true;
        results.finishedNativeFresh = true;
      }
      await native.recordResult({
        sourceRevision,
        dirty,
        layoutBaseline,
        buildHashes,
        profile,
        results,
        launches,
        normalClose: true,
      });
      console.log(JSON.stringify({ results, normalClose: true }));
      assert.equal(
        results.duringSwitch.roundEnabled,
        false,
        'Selecting B must not leave round confirmation for A available',
      );
    } catch (e) {
      if (app && !closed) {
        await writeFile(
          path.join(output, 'failure.json'),
          JSON.stringify(
            { sourceRevision, dirty, buildHashes, profile, error: e.stack, results, launches, pid },
            null,
            2,
          ),
        );
        try {
          await capture(await app.firstWindow({ timeout: 1000 }), 'failure');
        } catch {}
      }
      throw e;
    } finally {
    }
  },
);
