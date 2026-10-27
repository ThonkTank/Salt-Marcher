import { openNativeCampaign } from './native-navigation.mjs';
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
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/mask-history-evidence');
await runNativeProbe(
  { output: output, name: 'mask-history', resultName: 'history-' + phase + '.json' },
  async (native) => {
    const group = await currentProcessGroup();
    await mkdir(output, { recursive: true });
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/desktop/mask-history-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/desktop/mask-history-store.cjs');
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
    for (let i = 0; i < 38; i++) {
      let c = store.executeChase({
        ...command({
          kind: 'create',
          title: i === 0 ? 'Kupfersiegel am Hafen' : i === 37 ? 'Waldpfad' : 'Marktlauf ' + i,
          goal: 'Tor erreichen',
        }),
        sceneId: scene.id,
        chaseId: null,
        expectedRevision: null,
      }).chase;
      if (i === 0)
        c = store.executeChase({
          ...command({
            kind: 'participant',
            participant: {
              id: randomUUID(),
              characterId: null,
              name: 'Kurier',
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
      if (i > 0 && i < 37)
        c = store.executeChase({
          ...command({ kind: 'finish', outcome: 'Am Markt beendet' }),
          sceneId: scene.id,
          chaseId: c.id,
          expectedRevision: c.revision,
        }).chase;
      chases.push(c);
    }
    const a = chases[0],
      b = chases.at(-1);
    const combats = [];
    for (let i = 0; i < 107; i++) {
      let c = store.executeCombat({
        ...command({
          kind: 'create',
          sceneId: scene.id,
          title: i === 0 ? 'Bronzeschlüssel am Tor' : 'Wachen ' + i,
          includeParty: false,
          expectedMembershipRevision: scene.membershipRevision,
        }),
        combatId: null,
        expectedRevision: null,
      }).combat;
      if (i === 0)
        c = store.executeCombat({
          ...command({
            kind: 'notes',
            title: c.title,
            notes: '  Torwache\r\n- Schlüssel behalten',
          }),
          combatId: c.id,
          expectedRevision: c.revision,
        }).combat;
      combats.push(c);
    }
    const oldCombat = combats[0],
      lastCombat = combats.at(-1),
      originalOldChase = store.db
        .prepare('SELECT payload,checksum FROM chase WHERE id=?')
        .get(a.id),
      originalOldCombat = store.db
        .prepare('SELECT payload,checksum FROM combat WHERE id=?')
        .get(oldCombat.id);
    const archiveCampaign = store.create('Archiv einer früheren Gruppe'),
      aw = store.activate(archiveCampaign.id),
      acmd = (action) => ({
        commandId: randomUUID(),
        token: aw.token,
        campaignId: archiveCampaign.id,
        action,
      }),
      hero = store.executeLive(
        acmd({ kind: 'create-character', profile: { name: 'Ada' } }),
      ).character;
    let archivedScene = store.executeLive(
      acmd({ kind: 'initialize', expectedRosterRevision: 1 }),
    ).scene;
    store.executeLive(
      acmd({
        kind: 'membership',
        characterId: hero.id,
        expectedRevision: 0,
        expectedRosterRevision: 1,
        active: true,
        targetSceneId: archivedScene.id,
        expectedFocusRevision: 0,
      }),
    );
    archivedScene = store.live(aw.token).scene;
    store.executeLive(
      acmd({
        kind: 'scene-content',
        sceneId: archivedScene.id,
        expectedRevision: archivedScene.revision,
        title: 'Am alten Hafen',
        notes: '  Archivnotiz\r\n- vertraulich',
        locationId: null,
      }),
    );
    archivedScene = store.live(aw.token).scene;
    let archivedChase, archivedCombat;
    for (let i = 0; i < 35; i++) {
      const c = store.executeChase({
        ...acmd({
          kind: 'create',
          title: i === 0 ? 'Kupfersiegel im Archiv' : 'Archivlauf ' + i,
          goal: 'Boot erreichen',
        }),
        sceneId: archivedScene.id,
        chaseId: null,
        expectedRevision: null,
      }).chase;
      if (i === 0) archivedChase = c;
    }
    for (let i = 0; i < 103; i++) {
      const c = store.executeCombat({
        ...acmd({
          kind: 'create',
          sceneId: archivedScene.id,
          title: i === 0 ? 'Bronzeschlüssel im Archiv' : 'Archivwache ' + i,
          includeParty: false,
          expectedMembershipRevision: archivedScene.membershipRevision,
        }),
        combatId: null,
        expectedRevision: null,
      }).combat;
      if (i === 0) archivedCombat = c;
    }
    const live = store.live(aw.token);
    store.executeLive(
      acmd({
        kind: 'move',
        sceneId: archivedScene.id,
        expectedRosterRevision: live.rosterRevision,
        expectedFocusRevision: live.focusRevision,
        expectedClockRevision: archivedScene.clock.revision,
        expectedSceneMembershipRevision: archivedScene.membershipRevision,
        memberIds: [hero.id],
        target: {
          kind: 'new',
          title: 'Am neuen Hafen',
          expectedContentRevision: archivedScene.revision,
        },
      }),
    );
    const archiveBefore = JSON.stringify(
      ['combat', 'chase'].map((table) =>
        store.db
          .prepare('SELECT id,payload,checksum FROM ' + table + ' WHERE campaign_id=? ORDER BY id')
          .all(archiveCampaign.id),
      ),
    );
    store.close();

    let app,
      pid,
      closed = false;
    const errors = [],
      launches = [],
      results = {};
    async function launch() {
      closed = false;
      app = await native.launchConfigured({
        executablePath: source + '/node_modules/electron/dist/electron',
        args: [source + '/.build/desktop/main.cjs', '--data-dir', profile],
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
      await openNativeCampaign(page, campaign.id);
      await page.locator('#live-tab').click();
      await page.locator('#live-continue').click();
      await page.locator('#combat-panel').waitFor({ state: 'visible' });
      await page.waitForFunction(() =>
        document.querySelector('#chase-status').textContent.startsWith('Waldpfad ·'),
      );
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
      results.initial = {
        chases: await page.locator('#chase-recent option').count(),
        chaseOldReachable: await page
          .locator('#chase-recent option')
          .evaluateAll((nodes, id) => nodes.some((n) => n.value === id), a.id),
        combats: await page.locator('#combat-history option').count(),
        combatOldReachable: await page
          .locator('#combat-history option')
          .evaluateAll((nodes, id) => nodes.some((n) => n.value === id), oldCombat.id),
      };
      if (!before) {
        await page.locator('#chase-complication').fill('Offener Waldhinweis');
        await app.evaluate(({ ipcMain }) => {
          const original = ipcMain._invokeHandlers.get('campaign:mask-history');
          let fail = true;
          ipcMain.removeHandler('campaign:mask-history');
          ipcMain.handle('campaign:mask-history', async (e, ...args) => {
            if (fail && args[2].search === 'KUPFERSIEGEL') {
              fail = false;
              return { ok: false, error: 'QA: Suchseite vorübergehend nicht lesbar' };
            }
            return original(e, ...args);
          });
        });
        await page.locator('#chase-history-open').click();
        await page.locator('#mask-history-results button').first().waitFor();
        await page.locator('#mask-history-search').fill('KUPFERSIEGEL');
        await page.locator('#mask-history-summary[role=alert]').waitFor();
        assert.equal(await page.locator('#mask-history-results button').count(), 0);
        await page.locator('#mask-history-retry').click();
        results.localReadRetry = true;
        await page
          .locator('#mask-history-results button')
          .filter({ hasText: 'Kupfersiegel am Hafen' })
          .waitFor();
        await page.screenshot({ path: path.join(output, 'history-browser.png') });
        await page
          .locator('#mask-history-results button')
          .filter({ hasText: 'Kupfersiegel am Hafen' })
          .click();
        await page.waitForFunction(() =>
          document.querySelector('#chase-status').textContent.startsWith('Kupfersiegel am Hafen ·'),
        );
        await page.locator('#chase-people [data-distance]').fill('27');
        await page.locator('#chase-round').click();
        await page.waitForFunction(() =>
          document.querySelector('#chase-status').textContent.includes('Runde 1'),
        );
        results.oldChaseResumed = true;
        await app.evaluate(({ ipcMain }, id) => {
          const original = ipcMain._invokeHandlers.get('campaign:combat');
          let fail = true;
          ipcMain.removeHandler('campaign:combat');
          ipcMain.handle('campaign:combat', async (e, ...args) => {
            if (fail && args[2] === id) {
              fail = false;
              return { ok: false, error: 'QA: Älterer Kampf vorübergehend nicht lesbar' };
            }
            return original(e, ...args);
          });
        }, oldCombat.id);
        await page.locator('#combat-history-open').click();
        await page.locator('#mask-history-search').fill('BRONZESCHLÜSSEL');
        await page
          .locator('#mask-history-results button')
          .filter({ hasText: 'Bronzeschlüssel am Tor' })
          .click();
        await page.locator('#combat-load-status[role=alert]').waitFor();
        assert.equal(await page.locator('#combat-history-open').isEnabled(), true);
        await page.locator('#combat-history-open').click();
        await page.locator('#mask-history-search').fill('BRONZESCHLÜSSEL');
        await page
          .locator('#mask-history-results button')
          .filter({ hasText: 'Bronzeschlüssel am Tor' })
          .click();
        results.combatReadErrorCanBrowse = true;
        await page.waitForFunction(
          () => document.querySelector('#combat-title').textContent === 'Bronzeschlüssel am Tor',
        );
        assert.equal(await page.locator('#combat-history').inputValue(), oldCombat.id);
        await page.locator('#combat-notes-details summary').click();
        assert.equal(
          await page.locator('#combat-notes').inputValue(),
          '  Torwache\n- Schlüssel behalten',
        );
        results.oldCombatOpened = true;
        await page.locator('#combat-title').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'history-combat.png') });
        await page.locator('#chase-history-open').click();
        await page.locator('#mask-history-state').selectOption('finished');
        await page.locator('#mask-history-results button').first().waitFor();
        const first = await page.locator('#mask-history-results button').allTextContents();
        await page.locator('#mask-history-next').click();
        await page.waitForFunction(() =>
          document.querySelector('#mask-history-summary').textContent.startsWith('21–'),
        );
        const second = await page.locator('#mask-history-results button').allTextContents();
        assert.equal(first.filter((n) => second.includes(n)).length, 0);
        await page.locator('#mask-history-prev').click();
        await page.waitForFunction(() =>
          document.querySelector('#mask-history-summary').textContent.startsWith('1–'),
        );
        assert.deepEqual(
          await page.locator('#mask-history-results button').allTextContents(),
          first,
        );
        results.bidirectionalPages = true;
        await page.locator('#mask-history-close').click();
      }
      await page.locator('#chase-status').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, 'history-' + phase + '.png') });
      await close();
      const fresh = new CampaignStore(file);
      try {
        const active = fresh.activate(campaign.id);
        assert.equal(fresh.chase(active.token, scene.id, a.id).chase.id, a.id);
        assert.equal(fresh.combat(active.token, scene.id, oldCombat.id).combat.id, oldCombat.id);
        results.oldRecordsPresent = true;
        if (!before) {
          assert.deepEqual(
            fresh.db.prepare('SELECT payload,checksum FROM combat WHERE id=?').get(oldCombat.id),
            originalOldCombat,
          );
          assert.equal(
            fresh.chase(active.token, scene.id, b.id).draft.fields['chase-complication'],
            'Offener Waldhinweis',
          );
          results.otherOpenDraftRetained = true;
          assert.equal(fresh.chase(active.token, scene.id, a.id).chase.round, 1);
          assert.equal(
            fresh.chase(active.token, scene.id, a.id).chase.participants[0].distance,
            27,
          );
          assert.deepEqual(
            fresh.db.prepare('SELECT payload,checksum FROM chase WHERE id=?').get(b.id),
            {
              payload: JSON.stringify(b),
              checksum: require('node:crypto')
                .createHash('sha256')
                .update(JSON.stringify(b))
                .digest('hex'),
            },
          );
        }
      } finally {
        fresh.close();
      }
      if (!before) {
        page = await launch();
        await page.locator('#chase-history-open').click();
        await page.locator('#mask-history-search').fill('kupfersiegel');
        await page
          .locator('#mask-history-results button')
          .filter({ hasText: 'Kupfersiegel am Hafen' })
          .click();
        await page.waitForFunction(() =>
          document.querySelector('#chase-status').textContent.includes('Runde 1'),
        );
        assert.equal(await page.locator('#chase-people [data-distance]').inputValue(), '27');
        results.nativeRestart = true;
        await openNativeCampaign(page, archiveCampaign.id);
        await page.locator('#live-tab').click();
        await page.locator('#live-continue').click();
        await page.locator('#live-archives').click();
        await page
          .locator('#archive-list')
          .getByRole('button', { name: 'Am alten Hafen', exact: true })
          .click();
        await page
          .locator('#archive-detail')
          .getByRole('button', { name: 'Alle Verfolgungen suchen', exact: true })
          .click();
        await page.locator('#mask-history-search').fill('Kupfersiegel');
        await page
          .locator('#mask-history-results button')
          .filter({ hasText: 'Kupfersiegel im Archiv' })
          .click();
        await page.waitForFunction(() =>
          document
            .querySelector('#archive-mask-detail')
            .textContent.includes('Kupfersiegel im Archiv'),
        );
        assert.equal(await page.locator('#archive-dialog').isVisible(), true);
        assert.equal(await page.locator('#archive-mask-detail input').count(), 0);
        await page
          .locator('#archive-detail')
          .getByRole('button', { name: 'Alle Kämpfe suchen', exact: true })
          .click();
        await page.locator('#mask-history-search').fill('Bronzeschlüssel');
        await page
          .locator('#mask-history-results button')
          .filter({ hasText: 'Bronzeschlüssel im Archiv' })
          .click();
        await page.waitForFunction(() =>
          document
            .querySelector('#archive-mask-detail')
            .textContent.includes('Bronzeschlüssel im Archiv'),
        );
        assert.equal(await page.locator('#archive-mask-detail input').count(), 0);
        await page.locator('#archive-mask-detail').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'history-archive.png') });
        await page.locator('#archive-close').click();
        await close();
        const audit = new CampaignStore(file);
        try {
          assert.equal(
            JSON.stringify(
              ['combat', 'chase'].map((table) =>
                audit.db
                  .prepare(
                    'SELECT id,payload,checksum FROM ' + table + ' WHERE campaign_id=? ORDER BY id',
                  )
                  .all(archiveCampaign.id),
              ),
            ),
            archiveBefore,
          );
        } finally {
          audit.close();
        }
        results.olderArchiveMasksReadOnlyAndByteExact = true;
      }
      await native.recordResult({ results, launches, normalClose: true });
      console.log(JSON.stringify({ results, normalClose: true }));
      assert(
        before ? results.initial.chaseOldReachable === true : results.oldChaseResumed,
        'Old running chase must remain reachable after 36 newer finished chases',
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
