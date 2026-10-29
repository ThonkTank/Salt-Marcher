import { openNativeCampaign } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  before = process.argv.includes('--before'),
  phase = before ? 'before' : 'after',
  out = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/note-followup', phase);
await runNativeProbe(
  { output: out, name: 'note-followup', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const require = createRequire(import.meta.url),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/note-followup-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/note-followup-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      addition = 'Die Nachtwache wird von der Küfergilde bezahlt.',
      notes = [
        [
          'Nera die Quartiermeisterin',
          'npc',
          'Nera hält den Messingschlüssel zum Lastenaufzug. Sie kennt die Nachtwache.',
        ],
        [
          'Drei Glockenschläge',
          'rumor',
          'Vor jeder Übergabe läutet es dreimal. Offen: Wer bezahlt die Nachtwache?',
        ],
        [
          'Wiedergefundene Fässer',
          'rumor',
          'Das fehlende Fass ist wieder da. Diese Spur wurde abgeschlossen.',
        ],
        [
          'Das blaue Siegel',
          'rumor',
          'Auf den Zahlungslisten steht ein blaues Siegel. Offen: Wer führt die Küfergilde?',
        ],
        ...Array.from({ length: 8 }, (_, i) => [
          'Andere Spur ' + (i + 1),
          'rumor',
          'Am Nordtor kennt jemand den Boten.',
        ]),
      ].map(([title, kind, gmNotes]) => ({
        version: 1,
        id: randomUUID(),
        revision: 1,
        title,
        kind,
        gmNotes,
        readAloud: '  Original zum Vorlesen\r\n',
        relations: [],
        creatureId: null,
        deleted: false,
      }));
    const overview = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      kind: 'quest',
      title: 'Die Aufzug-Verschwörung',
      gmNotes: 'Ziel: Die nächtliche Übergabe stoppen. Welche Spur ist noch offen?',
      readAloud: '',
      relations: notes.slice(0, 4).map((n) => ({ targetId: n.id, label: 'Quelle' })),
      creatureId: null,
      deleted: false,
    };
    const store = new CampaignStore(file),
      campaign = store.create('Nach dem Spielabend'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action,
      }),
      plan = {
        version: 1,
        id: randomUUID(),
        revision: 1,
        name: 'Abend 8 · Die Nachtwache',
        scenes: [
          {
            id: randomUUID(),
            title: 'Die Nachtwache befragen',
            notes: '  Den Auftraggeber erfragen.\r\n',
            locationId: null,
          },
        ],
      };
    for (const n of [...notes, overview])
      store.changePreparation({
        ...command(null),
        change: { kind: 'note', expectedRevision: null, note: n },
      });
    store.changePreparation({
      ...command(null),
      change: { kind: 'plan', expectedRevision: null, plan },
    });
    store.executeSession(
      command({
        kind: 'visit',
        planId: plan.id,
        expectedRevision: 0,
        detail: {
          ...store.session(w.token, plan.id).visits[0],
          noteIds: [overview.id, notes[0].id, notes[1].id],
        },
      }),
    );
    const state = store.narrative(w.token, notes[2].id);
    store.executeProgress(
      command({
        kind: 'narrative-state',
        state: { ...state.state, status: 'closed' },
        expectedRevision: state.state.revision,
        expectedNoteRevision: 1,
      }),
    );
    store.close();

    let app,
      closed = true;
    const results = {},
      launches = [],
      errors = [],
      artifactHashes = {};
    for (const rel of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
      artifactHashes[rel] = createHash('sha256')
        .update(await readFile(path.join('.build/desktop', rel)))
        .digest('hex');
    async function launch(expectedCount = 3) {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
      });
      closed = false;
      launches.push({ pid: app.process().pid });
      const page = await app.firstWindow();
      page.setDefaultTimeout(10000);
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await openNativeCampaign(page, campaign.id);
      await page.locator('#preparation-tab').click();
      await page.locator('#preparation-knowledge').click();
      await page.locator('#world-search').fill(overview.title);
      await page.locator('#world-list button').filter({ hasText: overview.title }).click();
      await page.waitForFunction(
        (t) => document.querySelector('#note-title').value === t,
        overview.title,
      );
      await page.locator('#note-thread-open').click();
      await page.waitForFunction(
        (count) => document.querySelectorAll('#note-thread-sources article').length === count,
        expectedCount,
      );
      return page;
    }
    async function close() {
      const ended = new Promise((r) =>
        app.process().once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      const exit = await ended;
      assert.deepEqual(exit, { code: 0, signal: null });
      launches.at(-1).exit = exit;
      closed = true;
    }
    try {
      let page = await launch();
      await page.waitForFunction(() =>
        document
          .querySelector('#note-thread-sources')
          .textContent.includes('Wer führt die Küfergilde?'),
      );
      results.originalThread = await page.locator('#note-thread-sources').innerText();
      await page.screenshot({ path: path.join(out, 'initial-thread.png') });
      if (before) {
        results.sourceEditActions = await page
          .locator('#note-thread-sources button')
          .allTextContents();
        assert(!results.sourceEditActions.some((t) => t.includes('bearbeiten')));
        await page
          .locator('#note-thread-dialog')
          .getByRole('button', { name: 'Schließen', exact: true })
          .click();
        await page.locator('#note-relations button').filter({ hasText: notes[0].title }).click();
      } else {
        await page
          .locator('#note-thread-sources article')
          .filter({ hasText: notes[0].title })
          .getByRole('button', { name: 'Notiz bearbeiten…', exact: true })
          .click();
      }
      await page.waitForFunction(
        (t) => document.querySelector('#note-title').value === t,
        notes[0].title,
      );
      await page.locator('#note-gm').fill(notes[0].gmNotes + '\n\n' + addition);
      await page.locator('#note-title').click();
      if (before) {
        await page.locator('#note-incoming button').filter({ hasText: overview.title }).click();
        await page.waitForFunction(
          (t) => document.querySelector('#note-title').value === t,
          overview.title,
        );
        await page.locator('#note-relations button').filter({ hasText: notes[1].title }).click();
      } else {
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
        );
        await page.locator('#note-thread-return').scrollIntoViewIfNeeded();
        assert(
          await page.locator('#note-thread-return').evaluate((e) => {
            const r = e.getBoundingClientRect();
            return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
        );
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        await writeFile(
          path.join(out, 'edit-return-100percent.png'),
          Buffer.from(
            await app.evaluate(async ({ BrowserWindow }) =>
              (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
                .toPNG()
                .toString('base64'),
            ),
            'base64',
          ),
        );
        await page.locator('#note-thread-return').click();
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
        );
        results.editReturnAt100Percent = true;
        await page.waitForFunction(() => document.querySelector('#note-thread-editor').hidden);
        await page
          .locator('#note-thread-sources article')
          .filter({ hasText: notes[1].title })
          .getByRole('button', { name: 'Notiz bearbeiten…', exact: true })
          .click();
      }
      await page.waitForFunction(
        (t) => document.querySelector('#note-title').value === t,
        notes[1].title,
      );
      await page.getByLabel('Narrativer Status', { exact: true }).selectOption('closed');
      await page.getByRole('button', { name: 'Narrative Angaben speichern', exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('#status').textContent ===
          'Quest-/Gerüchtstatus und Belohnung gespeichert.',
      );
      await page.screenshot({ path: path.join(out, 'completed-source.png') });
      if (before) {
        await page.locator('#note-incoming button').filter({ hasText: overview.title }).click();
        await page.waitForFunction(
          (t) => document.querySelector('#note-title').value === t,
          overview.title,
        );
        await page.locator('#note-thread-open').click();
      } else {
        await page.locator('#note-thread-return').click();
      }
      await page.waitForFunction(
        () => document.querySelectorAll('#note-thread-sources article').length === 2,
      );
      await page.waitForFunction(
        (s) => document.querySelector('#note-thread-sources').textContent.includes(s),
        addition,
      );
      results.afterSessionThread = await page.locator('#note-thread-sources').innerText();
      assert(results.afterSessionThread.includes('Wer führt die Küfergilde?'));
      assert(!results.afterSessionThread.includes(notes[1].title));
      results.updatedOriginalAndRemainingQuestionReadable = true;
      await page.locator('#note-thread-sources').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, 'remaining-sources.png') });
      await page.locator('#note-thread-plan').selectOption('');
      await page.locator('#note-thread-plan-name').fill('Abend 9 · Die Küfergilde');
      await page.locator('#note-thread-visit-title').fill('Das blaue Siegel verfolgen');
      await page.locator('#note-thread-use').click();
      await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#scene-title').inputValue(), 'Das blaue Siegel verfolgen');
      await page.locator('#session-packet-open').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#session-packet-dialog').open &&
          document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
      );
      results.packet = await page.locator('#session-packet-content').innerText();
      assert(results.packet.includes(addition));
      assert(results.packet.includes('Wer führt die Küfergilde?'));
      assert(!results.packet.includes(notes[1].gmNotes));
      assert(!results.packet.includes(notes[2].gmNotes));
      await page.screenshot({ path: path.join(out, 'next-session-packet.png') });
      await close();
      page = await launch(2);
      await page.waitForFunction(
        (s) => document.querySelector('#note-thread-sources').textContent.includes(s),
        addition,
      );
      assert.equal(await page.locator('#note-thread-sources article').count(), 2);
      await page.screenshot({ path: path.join(out, 'fresh-remaining-sources.png') });
      await close();
      results.freshReopenRetainsOriginalFactAndConfirmedStatus = true;
      const check = new CampaignStore(file);
      try {
        const a = check.activate(campaign.id),
          prep = check.preparation(a.token),
          npc = prep.notes.find((r) => r.note.id === notes[0].id).note;
        assert.equal(npc.gmNotes, notes[0].gmNotes + '\n\n' + addition);
        assert.equal(npc.readAloud, notes[0].readAloud);
        for (const n of notes.slice(1))
          assert.deepEqual(prep.notes.find((r) => r.note.id === n.id).note, n);
        assert.deepEqual(prep.notes.find((r) => r.note.id === overview.id).note, overview);
        assert.equal(check.narrative(a.token, notes[1].id).state.status, 'closed');
        assert.equal(check.narrative(a.token, notes[3].id).state.status, 'open');
        assert.deepEqual(
          prep.plans.find((p) => p.id === plan.id),
          plan,
        );
        assert.deepEqual(check.session(a.token, plan.id).visits[0].noteIds, [
          overview.id,
          notes[0].id,
          notes[1].id,
        ]);
        const next = prep.plans.find((p) => p.id !== plan.id);
        assert.equal(next.name, 'Abend 9 · Die Küfergilde');
        assert.deepEqual(
          new Set(check.session(a.token, next.id).visits[0].noteIds),
          new Set([overview.id, notes[0].id, notes[3].id]),
        );
        results.originalIdentitiesAndPastPlanPreserved = true;
      } finally {
        check.close();
      }
      assert.deepEqual(errors, []);
      for (const l of launches) {
        let alive = false;
        try {
          process.kill(l.pid, 0);
          alive = true;
        } catch {}
        assert.equal(alive, false);
        l.mainPidAbsent = true;
      }
      await native.recordResult({
        phase,
        profile,
        results,
        launches,
        artifactHashes,
        errors,
        normalClose: true,
      });
      console.log(JSON.stringify({ phase, results, normalClose: true }));
    } catch (error) {
      await writeFile(
        path.join(out, 'failure.json'),
        JSON.stringify({ error: error.stack, results, launches, errors }, null, 2),
      );
      if (app && !closed)
        try {
          await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') });
        } catch {}
      throw error;
    } finally {
    }
  },
);
