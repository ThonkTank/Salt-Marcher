import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { currentProcessGroup } from './process-group.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const source = process.cwd(),
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/rule-reading-evidence');
const zoom = 1;
await runNativeProbe(
  { output: output, name: 'rule-reading', resultName: 'result-' + zoom + '.json' },
  async (native) => {
    const gitRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
    const group = await currentProcessGroup();
    await mkdir(output, { recursive: true });
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/rule-context-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/rule-context-store.cjs'),
      Database = require('better-sqlite3');
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
    store.executeLive(
      command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
    );
    const hero = store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Iri' } }),
    ).character;
    let live = store.live(w.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: hero.id,
        expectedRevision: hero.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: live.focusId,
        expectedFocusRevision: live.focusRevision,
      }),
    );
    const other = store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Nera' } }),
    ).character;
    live = store.live(w.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: other.id,
        expectedRevision: other.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: live.focusId,
        expectedFocusRevision: live.focusRevision,
      }),
    );
    live = store.live(w.token);
    const sceneA = live.scene.id;
    store.executeLive(
      command({
        kind: 'move',
        sceneId: sceneA,
        expectedRosterRevision: live.rosterRevision,
        expectedFocusRevision: live.focusRevision,
        expectedClockRevision: live.scene.clock.revision,
        expectedSceneMembershipRevision: live.scene.membershipRevision,
        memberIds: [hero.id],
        target: { kind: 'new', title: 'Keller', expectedContentRevision: live.scene.revision },
      }),
    );
    live = store.live(w.token);
    const sceneB = live.scenes.find((s) => s.id !== sceneA).id;
    store.executeLive(
      command({ kind: 'focus', sceneId: sceneA, expectedRevision: live.focusRevision }),
    );
    const notes = [
      ...Array.from({ length: 24 }, (_, i) => 'Hausregel ' + String(i + 1).padStart(2, '0')),
      'Hausregel 25 · Sicherung am Seil',
      ...Array.from(
        { length: 20 },
        (_, i) => 'Weitere Hausregel ' + String(i + 1).padStart(2, '0'),
      ),
    ].map((title) => ({
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'rule',
      title,
      readAloud: title + ' · öffentliche Regel',
      gmNotes:
        'Beim Erkunden wird die Position der Figuren vor der Probe geklärt. '.repeat(4) +
        (title.startsWith('Hausregel 25')
          ? 'Auf schlüpfrigen Stegen gibt eine festgehaltene Sicherungsleine Vorteil auf Geschicklichkeitsproben; ohne Ankerpunkt gilt dieser Vorteil nicht.'
          : 'Andere Tischabsprache: ' + title),
      relations: [],
      creatureId: null,
      deleted: false,
    }));
    for (const note of notes)
      store.changePreparation({
        ...command(null),
        change: { kind: 'note', expectedRevision: null, note },
      });
    const originalNotes = store.db
      .prepare('SELECT id,payload,checksum FROM world_note ORDER BY id')
      .all();
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
        args: [source + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
        timeout: 20000,
      });
      pid = app.process().pid;
      assert((await readFile(`/proc/${pid}/cmdline`, 'utf8')).includes(profile));
      assert.equal((await readFile(`/proc/${pid}/cgroup`, 'utf8')).trim().split('::')[1], group);
      launches.push({ pid, cgroup: group });
      const page = await app.firstWindow();
      page.setDefaultTimeout(10000);
      await app.evaluate(
        ({ BrowserWindow }, z) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.setZoomFactor(z),
        zoom,
      );
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true', null, {
        timeout: 20000,
      });
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await page
        .locator('#campaign-screen-list article')
        .filter({ hasText: campaign.name })
        .getByRole('button', { name: 'Fortsetzen', exact: true })
        .click();
      await revealWorkspaceNavigation(page);
      await page.locator('#live-tab').click();
      if (await page.locator('#live-continue').isVisible())
        await page.locator('#live-continue').click();
      await page.locator('#live-rules-panel').waitFor({ state: 'visible' });
      return page;
    }
    async function close() {
      assert.deepEqual(errors, []);
      const exit = new Promise((r) =>
        app.process().once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      const result = await exit;
      assert.deepEqual(result, { code: 0, signal: null });
      launches.at(-1).exit = result;
      closed = true;
    }

    async function shot(page, name) {
      await page
        .locator(
          name.startsWith('group-entry')
            ? '#live-rules-panel h3'
            : name.startsWith('read-before')
              ? '#live-rule-results button'
              : name.startsWith('pinned')
                ? '#live-check-latest'
                : '#live-rule-pins pre',
        )
        .last()
        .evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      const img = await app.evaluate(async ({ BrowserWindow }) =>
        (
          await BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.capturePage()
        )
          .toPNG()
          .toString('base64'),
      );
      await writeFile(path.join(output, name + '.png'), Buffer.from(img, 'base64'));
    }
    async function roll(page, label, noteId) {
      await page.locator('#live-rule-pins button[data-rule-id="' + noteId + '"]').click();
      assert.equal(await page.locator('#live-check-rule').inputValue(), noteId);
      await page.locator('#live-check-label').fill(label);
      await page.locator('#live-check-mode').selectOption('advantage');
      await page.locator('#live-check-modifier').fill('2');
      await page.locator('#live-check-dc').fill('12');
      await page.locator('#live-check-form button').click();
      await page.waitForFunction(
        (label) => document.querySelector('#live-check-latest').textContent.includes(label),
        label,
      );
      return page.locator('#live-check-latest').innerText();
    }
    try {
      let page = await launch();
      assert.equal(await page.locator('#live-rule-lookup').isVisible(), false);
      await page.locator('#live-check-form').scrollIntoViewIfNeeded();
      await shot(page, 'group-entry-' + zoom);
      await page.getByRole('button', { name: 'Regel nachschlagen…', exact: true }).click();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#live-rule-lookup').isVisible(), false);
      await page.getByRole('button', { name: 'Regel nachschlagen…', exact: true }).click();
      await page.waitForFunction(
        () => document.querySelectorAll('#live-rule-results article').length === 40,
      );
      await page
        .locator('#live-rule-results')
        .getByRole('button', { name: 'Weitere Regeln anzeigen', exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelectorAll('#live-rule-results article').length === 45,
      );
      results.all45RulesReachable = true;
      await page.locator('#live-rule-search').fill('schlüpfrigen');
      await page.waitForFunction(
        () =>
          document.querySelectorAll('#live-rule-results article').length === 1 &&
          document.querySelector('#live-rule-results').textContent.includes('Sicherung am Seil'),
      );
      await page.locator('#live-rule-results summary').click();
      await page.waitForFunction(() =>
        document
          .querySelector('#live-rule-results .rule-candidate-text:last-of-type')
          ?.textContent.includes('ohne Ankerpunkt gilt dieser Vorteil nicht.'),
      );
      assert.equal(await page.locator('#live-rule-pins article').count(), 0);
      await shot(page, 'read-before-pin-' + zoom);
      results.fullRuleBeforePin = true;
      await page
        .locator('#live-rule-results')
        .getByRole('button', { name: 'Anheften', exact: true })
        .click();
      await page.waitForFunction(() =>
        document.querySelector('#live-rule-pins').textContent.includes('Sicherung am Seil'),
      );
      assert.equal(await page.locator('#live-rule-lookup').isVisible(), false);
      results.latest = await roll(page, 'Auf dem schlüpfrigen Steg balancieren', notes[24].id);
      assert.match(
        results.latest,
        /Regelbasis: Hausregel 25 · Sicherung am Seil · Regelrevision 1/,
      );
      results.directRulePreparation = true;
      // A damaged current definition cannot hide the independently stored group rule.
      const db = new Database(file),
        original = db
          .prepare('SELECT payload,checksum FROM world_note WHERE campaign_id=? AND id=?')
          .get(campaign.id, notes[24].id),
        damaged = JSON.stringify({ ...JSON.parse(original.payload), gmNotes: 42 }),
        checksum = createHash('sha256').update(damaged).digest('hex');
      try {
        db.prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(
          damaged,
          checksum,
          campaign.id,
          notes[24].id,
        );
        const frozen = async () => {
          await page.waitForFunction(() =>
            document
              .querySelector('#live-rule-pins')
              .textContent.includes('Quelle nicht mehr verfügbar'),
          );
          assert.equal(await page.locator('#live-rule-pins article').count(), 1);
          assert.equal(await page.locator('#live-check-rule').inputValue(), notes[24].id);
          assert.equal(await page.locator('#live-check-latest').innerText(), results.latest);
        };
        await page.locator('#live-rules-refresh').click();
        await frozen();
        await page.locator('#live-rule-pins summary').click();
        await shot(page, 'unavailable-source-' + zoom);
        await page.locator('#scene-focus').selectOption(sceneB);
        await page.waitForFunction(() =>
          document.querySelector('#live-rule-pins').textContent.includes('Noch keine Regel'),
        );
        await page.locator('#scene-focus').selectOption(sceneA);
        await page.waitForFunction(() =>
          document.querySelector('#live-check-latest').textContent.includes('balancieren'),
        );
        await page.locator('#live-check-rule').selectOption(notes[24].id);
        await frozen();
        await close();
        page = await launch();
        await page.waitForFunction(() =>
          document.querySelector('#live-check-latest').textContent.includes('balancieren'),
        );
        await page.locator('#live-check-rule').selectOption(notes[24].id);
        await frozen();
        await page.locator('#live-rule-pins summary').click();
        assert((await page.locator('#live-rule-pins').innerText()).includes('ohne Ankerpunkt'));
        await shot(page, 'unavailable-source-fresh-' + zoom);
        assert.deepEqual(
          db
            .prepare('SELECT payload,checksum FROM world_note WHERE campaign_id=? AND id=?')
            .get(campaign.id, notes[24].id),
          { payload: damaged, checksum },
        );
        results.invalidSourcePreservesFrozenRule = true;
        results.invalidSourceFresh = true;
      } finally {
        db.prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(
          original.payload,
          original.checksum,
          campaign.id,
          notes[24].id,
        );
        db.close();
      }
      await page.locator('#live-rules-refresh').click();
      await page.waitForFunction(() =>
        document.querySelector('#live-rule-pins').textContent.includes('Quelle Revision 1'),
      );

      // Release an old A response only after B has become the active group.
      await app.evaluate(({ ipcMain }, id) => {
        const original = ipcMain._invokeHandlers.get('campaign:scene-rules');
        let hold = true;
        globalThis.qaRuleReadHeld = false;
        ipcMain.removeHandler('campaign:scene-rules');
        ipcMain.handle('campaign:scene-rules', async (e, ...args) => {
          const result = await original(e, ...args);
          if (hold && args[1] === id) {
            hold = false;
            globalThis.qaRuleReadHeld = true;
            return new Promise((resolve) => {
              globalThis.qaReleaseRuleRead = () => resolve(result);
            });
          }
          return result;
        });
      }, sceneA);
      await page.locator('#live-rules-refresh').click();
      for (let i = 0; i < 100 && !(await app.evaluate(() => globalThis.qaRuleReadHeld)); i++)
        await new Promise((r) => setTimeout(r, 20));
      assert(await app.evaluate(() => globalThis.qaRuleReadHeld));
      await page.locator('#scene-focus').selectOption(sceneB);
      await page.waitForFunction(() =>
        document.querySelector('#live-rule-pins').textContent.includes('Noch keine Regel'),
      );
      assert.equal(await page.locator('#live-check-latest').innerText(), '');
      await app.evaluate(() => globalThis.qaReleaseRuleRead());
      await page.getByRole('button', { name: 'Regel nachschlagen…', exact: true }).click();
      await page.locator('#live-rule-search').fill(notes[0].title);
      const otherRule = page.locator('#live-rule-results article').filter({
        has: page.locator('summary').filter({ hasText: /^Hausregel 01 · Regel lesen/ }),
      });
      await otherRule.locator('summary').click();
      await otherRule.getByRole('button', { name: 'Anheften', exact: true }).click();
      await page.waitForFunction(() =>
        document.querySelector('#live-rule-pins').textContent.includes('Hausregel 01'),
      );
      results.otherLatest = await roll(page, 'Andere Gruppenregel prüfen', notes[0].id);
      results.lateReplyIsolated = true;
      await page.locator('#scene-focus').selectOption(sceneA);
      await page.waitForFunction(() =>
        document.querySelector('#live-check-latest').textContent.includes('balancieren'),
      );
      assert.equal(await page.locator('#live-check-latest').innerText(), results.latest);
      assert.equal(await page.locator('#live-rule-pins article').count(), 1);
      await page.locator('#live-rule-pins summary').click();
      await shot(page, 'pinned-and-rolled-' + zoom);
      await close();
      page = await launch();
      await page.waitForFunction(() =>
        document.querySelector('#live-check-latest').textContent.includes('balancieren'),
      );
      assert.equal(await page.locator('#live-check-latest').innerText(), results.latest);
      await page.locator('#live-rule-pins summary').click();
      assert((await page.locator('#live-rule-pins').innerText()).includes('ohne Ankerpunkt'));
      await shot(page, 'fresh-' + zoom);
      await page.locator('#scene-focus').selectOption(sceneB);
      await page.waitForFunction(() =>
        document
          .querySelector('#live-check-latest')
          .textContent.includes('Andere Gruppenregel prüfen'),
      );
      assert.equal(await page.locator('#live-check-latest').innerText(), results.otherLatest);
      assert.equal(await page.locator('#live-rule-pins article').count(), 1);
      assert((await page.locator('#live-rule-pins').innerText()).includes('Hausregel 01'));
      results.otherGroupFresh = true;
      await page.locator('#scene-focus').selectOption(sceneA);
      await page.waitForFunction(() =>
        document.querySelector('#live-check-latest').textContent.includes('balancieren'),
      );
      await close();
      const check = new CampaignStore(file);
      try {
        const a = check.activate(campaign.id);
        assert.deepEqual(
          check.db.prepare('SELECT id,payload,checksum FROM world_note ORDER BY id').all(),
          originalNotes,
        );
        assert.equal(check.sceneRules(a.token, sceneA).pins.length, 1);
        assert.deepEqual(
          check.sceneRules(a.token, sceneB).pins.map((p) => p.noteId),
          [notes[0].id],
        );
        const b = check.sceneChecks(a.token, sceneB).checks;
        assert.equal(b.length, 1);
        assert.equal(b[0].ruleNoteId, notes[0].id);
        assert.equal(b[0].ruleSourceRevision, 1);
        assert.equal(b[0].rolls.length, 2);
        assert.equal(b[0].total, Math.max(...b[0].rolls) + 2);
        assert.equal(b[0].outcome, b[0].total >= 12 ? 'success' : 'failure');
        results.otherCanonicalCheck = b[0];
        const c = check.sceneChecks(a.token, sceneA).checks[0];
        assert.equal(c.ruleNoteId, notes[24].id);
        assert.equal(c.ruleSourceRevision, 1);
        assert.equal(c.rolls.length, 2);
        assert.equal(c.total, Math.max(...c.rolls) + 2);
        assert.equal(c.outcome, c.total >= 12 ? 'success' : 'failure');
        results.canonicalCheck = c;
        results.originalsUnchangedBeforeExplicitSourceEdit = true;
      } finally {
        check.close();
      }
      // Another client refreshes the pin after this UI has displayed revision 1.
      // A stale submission must not roll against that unseen definition.
      page = await launch();
      await page.waitForFunction(() =>
        document.querySelector('#live-check-latest').textContent.includes('balancieren'),
      );
      await page.locator('#live-check-label').fill('Sicherung nach erneuter Regelprüfung');
      await page.locator('#live-check-rule').selectOption(notes[24].id);
      await page.locator('#live-check-mode').selectOption('advantage');
      await page.locator('#live-check-modifier').fill('2');
      await page.locator('#live-check-dc').fill('12');
      const revisedNote = {
        ...notes[24],
        revision: 2,
        title: 'Sicherung am Seil · überarbeitet',
        gmNotes:
          'Vor der Probe muss die Spielleitung den festen Ankerpunkt ausdrücklich bestätigen.',
      };
      const peer = new CampaignStore(file);
      try {
        const pw = peer.activate(campaign.id);
        peer.changePreparation({
          commandId: randomUUID(),
          token: pw.token,
          campaignId: campaign.id,
          change: { kind: 'note', expectedRevision: 1, note: revisedNote },
        });
        const basis = peer.sceneRules(pw.token, sceneA);
        peer.executeSceneRule({
          commandId: randomUUID(),
          token: pw.token,
          campaignId: campaign.id,
          sceneId: sceneA,
          expectedRevision: basis.revision,
          action: { kind: 'refresh', noteId: notes[24].id, expectedSourceRevision: 2 },
        });
      } finally {
        peer.close();
      }
      const historyDb = new Database(file, { readonly: true }),
        historyRows = () => ({
          checks: historyDb.prepare('SELECT * FROM scene_check ORDER BY id').all(),
          receipts: historyDb
            .prepare('SELECT * FROM scene_check_receipt ORDER BY command_id')
            .all(),
          states: historyDb.prepare('SELECT * FROM scene_check_state ORDER BY scene_id').all(),
        }),
        beforeStale = historyRows();
      try {
        assert.match(await page.locator('#live-rule-pins').innerText(), /Quelle Revision 1/);
        await page.locator('#live-check-form button').click();
        await page.waitForFunction(() =>
          document.querySelector('#status').textContent.includes('Regelstand geändert'),
        );
        assert.deepEqual(historyRows(), beforeStale);
        assert.equal(await page.locator('#live-check-latest').innerText(), results.latest);
        for (const [id, value] of [
          ['live-check-label', 'Sicherung nach erneuter Regelprüfung'],
          ['live-check-rule', notes[24].id],
          ['live-check-mode', 'advantage'],
          ['live-check-modifier', '2'],
          ['live-check-dc', '12'],
        ])
          assert.equal(await page.locator('#' + id).inputValue(), value);
        await shot(page, 'rejected-rule-basis-' + zoom);
        await page.locator('#live-rules-refresh').click();
        await page.waitForFunction(() =>
          document.querySelector('#live-rule-pins').textContent.includes('Quelle Revision 2'),
        );
        await page.locator('#live-rule-pins summary').click();
        assert.match(
          await page.locator('#live-rule-pins').innerText(),
          /Ankerpunkt ausdrücklich bestätigen/,
        );
        await page.locator('#live-check-form button').click();
        await page.waitForFunction(() =>
          document
            .querySelector('#live-check-latest')
            .textContent.includes('Sicherung nach erneuter Regelprüfung'),
        );
        const accepted = JSON.parse(
          historyDb
            .prepare(
              'SELECT payload FROM scene_check WHERE scene_id=? ORDER BY ordinal DESC LIMIT 1',
            )
            .get(sceneA).payload,
        );
        assert.equal(accepted.ruleSourceRevision, 2);
        assert.equal(accepted.ruleTitle, revisedNote.title);
        assert.equal(accepted.total, Math.max(...accepted.rolls) + 2);
        assert.equal(accepted.outcome, accepted.total >= 12 ? 'success' : 'failure');
        const afterReviewed = historyRows();
        assert.equal(afterReviewed.checks.length, beforeStale.checks.length + 1);
        assert.equal(afterReviewed.receipts.length, beforeStale.receipts.length + 1);
        for (const row of beforeStale.checks)
          assert.deepEqual(
            afterReviewed.checks.find((c) => c.id === row.id),
            row,
          );
        for (const row of beforeStale.receipts)
          assert.deepEqual(
            afterReviewed.receipts.find((r) => r.command_id === row.command_id),
            row,
          );
        for (const row of beforeStale.states)
          assert.deepEqual(
            afterReviewed.states.find((r) => r.scene_id === row.scene_id),
            { ...row, revision: row.revision + (row.scene_id === sceneA ? 1 : 0) },
          );
        assert.deepEqual(
          JSON.parse(
            historyDb
              .prepare('SELECT payload FROM scene_check WHERE id=?')
              .get(results.canonicalCheck.id).payload,
          ),
          results.canonicalCheck,
        );
        for (const row of historyDb
          .prepare('SELECT id,payload,checksum FROM world_note ORDER BY id')
          .all())
          if (row.id !== notes[24].id)
            assert.deepEqual(
              row,
              originalNotes.find((n) => n.id === row.id),
            );
        const sourceNote = JSON.parse(
          historyDb.prepare('SELECT payload FROM world_note WHERE id=?').get(notes[24].id).payload,
        );
        assert.deepEqual(sourceNote, revisedNote);
        results.concurrentPinRefresh = {
          rejectedWithoutHistoryOrReceipt: true,
          inputsPreserved: true,
          reviewedRevision: 2,
          oldCheckPreserved: true,
          otherSourcesUnchanged: true,
          check: accepted,
        };
      } finally {
        historyDb.close();
      }
      await close();
      page = await launch();
      await page.waitForFunction(() =>
        document
          .querySelector('#live-check-latest')
          .textContent.includes('Sicherung nach erneuter Regelprüfung'),
      );
      await page.locator('#live-check-history summary').click();
      assert.match(await page.locator('#live-check-history').innerText(), /Regelrevision 1/);
      assert.match(await page.locator('#live-check-history').innerText(), /Regelrevision 2/);
      await shot(page, 'reviewed-rule-fresh-' + zoom);
      await close();
      results.concurrentPinRefresh.fresh = true;
      for (const l of launches) {
        let alive = false;
        try {
          process.kill(l.pid, 0);
          alive = true;
        } catch {}
        assert(!alive);
        l.pidAbsent = true;
      }
      assert.deepEqual(errors, []);
      const hashes = {};
      for (const rel of [
        'main.cjs',
        'preload.cjs',
        'ui/renderer.js',
        'ui/index.html',
        'ui/app.css',
      ])
        hashes[rel] = createHash('sha256')
          .update(await readFile('.build/desktop/' + rel))
          .digest('hex');
      await native.recordResult({
        gitRevision,
        dirty,
        profile,
        zoom,
        results,
        launches,
        hashes,
        errors,
        normalClose: true,
      });
      console.log('COMPLETE rule read, pin, check, group switch and fresh at zoom ' + zoom);
    } catch (e) {
      await writeFile(
        path.join(output, 'failure-' + zoom + '.json'),
        JSON.stringify({ error: e.stack, results, launches, errors }, null, 2),
      );
      if (app && !closed)
        await (
          await app.firstWindow()
        ).screenshot({ path: path.join(output, 'failure-' + zoom + '.png') });
      throw e;
    } finally {
    }
  },
);
