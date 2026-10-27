import { revealWorkspaceNavigation } from './native-navigation.mjs';
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
  out = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/session-note-organizing', phase);
await runNativeProbe(
  { output: out, name: 'session-note-organizing', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const require = createRequire(import.meta.url),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/session-note-organizing-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/session-note-organizing-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      notes = [
        [
          'Nera die Quartiermeisterin',
          'npc',
          'Nera hält den Schlüssel zum Lastenaufzug. Sie verlangt ihren Sold.',
        ],
        [
          'Die flüsternden Listen',
          'quest',
          'Die Liste nennt den Lastenaufzug als Übergabeort. Offen: Wer schrieb die Namen?',
        ],
        ['Nachtwache', 'rumor', 'Die Nachtwache hört im Lastenaufzug drei Glockenschläge.'],
        ...Array.from({ length: 9 }, (_, i) => [
          'Andere Spur ' + (i + 1),
          'rumor',
          'Am Nordtor fehlt ein Fass. Die Gruppe kennt den Boten.',
        ]),
      ].map(([title, kind, gmNotes]) => ({
        version: 1,
        id: randomUUID(),
        revision: 1,
        title,
        kind,
        gmNotes,
        readAloud: '',
        relations: [],
        creatureId: null,
        deleted: false,
      }));
    const room = {
        id: randomUUID(),
        scopeId: 'local',
        floorId: 'ground',
        number: '2',
        name: 'Archiv',
        revision: 0,
        polygons: [
          {
            outer: [
              { x: 0, y: 0 },
              { x: 6, y: 0 },
              { x: 6, y: 6 },
              { x: 0, y: 6 },
            ],
            holes: [],
          },
        ],
        sections: [
          {
            id: randomUUID(),
            kind: 'markdown',
            markdown: '  Unter den Listen wartet der Aufzug.\r\n',
          },
        ],
      },
      store = new CampaignStore(file),
      campaign = store.create('Verstreute Hinweise für Abend 7', [room]),
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
        name: 'Abend 7 · Die Übergabe',
        scenes: [
          {
            id: randomUUID(),
            title: 'Im Archiv ermitteln',
            notes: '  Zuerst die Listen prüfen.\r\n',
            locationId: null,
          },
          {
            id: randomUUID(),
            title: 'Rückweg zum Nordtor',
            notes: 'Anderer Besuch bleibt erhalten.',
            locationId: null,
          },
        ],
      };
    for (const note of notes)
      store.changePreparation({
        ...command(null),
        change: { kind: 'note', expectedRevision: null, note },
      });
    store.changePreparation({
      ...command(null),
      change: { kind: 'plan', expectedRevision: null, plan },
    });
    const detail = store.session(w.token, plan.id).visits[0];
    store.executeSession(
      command({
        kind: 'visit',
        planId: plan.id,
        expectedRevision: detail.revision,
        detail: { ...detail, noteIds: [notes[3].id] },
      }),
    );
    store.executeDrawing(
      command({
        kind: 'key-batch',
        rooms: [{ id: room.id, expectedRevision: 0, keyRevision: null }],
        patch: {
          references: notes.slice(0, 3).map((n) => ({ id: n.id, kind: n.kind, label: n.title })),
        },
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
    async function launch() {
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
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: 'Fortsetzen', exact: true })
        .click();
      await revealWorkspaceNavigation(page);
      if (!(await page.locator('#atlas-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#preparation-tab').click();
      await page.locator('#preparation-planning').click();
      await page.locator('#plans').selectOption(plan.id);
      await page.locator('#scene-list button').filter({ hasText: plan.scenes[0].title }).click();
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
      await page
        .locator('#visit-preparation summary')
        .filter({ hasText: 'Verknüpftes Weltwissen' })
        .click();
      if (before) {
        results.availableLabels = await page.locator('#visit-note-refs label').allTextContents();
        results.searchFields = await page.locator('#visit-note-refs input[type=search]').count();
        results.bodyClueVisible = (await page.locator('#visit-note-refs').innerText()).includes(
          'Lastenaufzug',
        );
        await page.locator('#visit-note-refs').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, 'title-only-list.png') });
        await page.locator('#preparation-knowledge').click();
        await page.locator('#world-search').fill('Lastenaufzug');
        await page.waitForFunction(
          () => document.querySelectorAll('#world-list button').length === 3,
        );
        results.searchResultTitles = await page.locator('#world-list button').allTextContents();
        results.readNotes = [];
        for (const note of notes.slice(0, 3)) {
          await page.locator('#world-list button').filter({ hasText: note.title }).click();
          await page.waitForFunction(
            (title) => document.querySelector('#note-title').value === title,
            note.title,
          );
          results.readNotes.push({
            title: await page.locator('#note-title').inputValue(),
            text: await page.locator('#note-gm').inputValue(),
          });
        }
        await page.locator('#preparation-planning').click();
        await page.locator('#scene-list button').filter({ hasText: plan.scenes[0].title }).click();
        results.returnedReferenceLabels = await page
          .locator('#visit-note-refs label')
          .allTextContents();
        await page.locator('#visit-note-refs').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, 'after-knowledge-search.png') });
        for (const note of notes.slice(0, 3))
          await page.locator('#visit-note-refs input[value="' + note.id + '"]').check();
      } else {
        await page.locator('#visit-note-search').fill('Lastenaufzug');
        await page.locator('#visit-note-find').click();
        await page.waitForFunction(
          () => document.querySelectorAll('#visit-note-results article').length === 3,
        );
        results.resultTitles = await page.locator('#visit-note-results strong').allTextContents();
        for (const note of notes.slice(0, 3)) {
          await page
            .locator('#visit-note-results')
            .getByRole('button', { name: 'Notiz lesen: ' + note.title, exact: true })
            .click();
          await page.waitForFunction(
            (text) => document.querySelector('#visit-note-detail').textContent.includes(text),
            note.gmNotes,
          );
          assert.equal(await page.locator('#scene-title').inputValue(), plan.scenes[0].title);
          assert.equal(await page.locator('#scene-editor').isVisible(), true);
          await page.locator('#visit-note-results input[value="' + note.id + '"]').check();
        }
        await page.waitForFunction(() =>
          document.querySelector('#visit-note-selection-summary').textContent.startsWith('4 '),
        );
        await page.waitForFunction(() =>
          document.querySelector('#visit-note-detail').textContent.includes('Archiv'),
        );
        await page
          .locator('#visit-note-refs')
          .evaluate((e) => e.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: path.join(out, 'search-preview-and-links.png') });
        await page.locator('#visit-note-search').fill('keinpassenderHinweis');
        await page.locator('#visit-note-find').click();
        await page.waitForFunction(
          () =>
            document.querySelector('#visit-note-search-status').textContent ===
            '0 Notizen angezeigt.',
        );
        assert.equal(
          await page
            .locator('#visit-note-selected')
            .getByRole('button', { name: 'Andere Spur 1', exact: true })
            .count(),
          1,
        );
        assert.equal(
          await page
            .locator('#visit-note-selected')
            .getByRole('button', { name: notes[2].title, exact: true })
            .count(),
          1,
        );
        await page
          .locator('#visit-note-selected')
          .getByRole('button', { name: notes[2].title, exact: true })
          .click();
        await page.waitForFunction(
          (text) => document.querySelector('#visit-note-detail').textContent.includes(text),
          notes[2].gmNotes,
        );
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2),
        );
        const toggle = page.locator('#visit-note-detail [data-note-toggle]');
        await toggle.scrollIntoViewIfNeeded();
        assert(
          await toggle.evaluate((e) => {
            const r = e.getBoundingClientRect();
            return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
        );
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        await writeFile(
          path.join(out, 'reading-200percent.png'),
          Buffer.from(
            await app.evaluate(async ({ BrowserWindow }) =>
              (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
                .toPNG()
                .toString('base64'),
            ),
            'base64',
          ),
        );
        await toggle.click();
        await page.waitForFunction(() =>
          document.querySelector('#visit-note-selection-summary').textContent.startsWith('3 '),
        );
        await toggle.click();
        await page.waitForFunction(() =>
          document.querySelector('#visit-note-selection-summary').textContent.startsWith('4 '),
        );
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
        );
        results.readAndLinkWithinSameVisit = true;
        results.selectedReferencesSurviveEmptySearch = true;
        results.zoom200ToggleActuallyUsed = true;
      }
      await page.locator('#scene-title').click();
      await page.locator('#session-packet-open').click();
      await page.locator('#session-packet-dialog').waitFor({ state: 'visible' });
      await page.waitForFunction(
        () =>
          document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
      );
      results.packet = await page.locator('#session-packet-content').innerText();
      for (const n of notes.slice(0, 4)) assert(results.packet.includes(n.title));
      await page.screenshot({ path: path.join(out, 'packet.png') });
      await close();
      const check = new CampaignStore(file);
      try {
        const a = check.activate(campaign.id),
          view = check.session(a.token, plan.id);
        assert.deepEqual(
          new Set(view.visits[0].noteIds),
          new Set(notes.slice(0, 4).map((n) => n.id)),
        );
        assert.equal(view.visits[1].noteIds.length, 0);
        for (const row of check.preparation(a.token).notes)
          assert.deepEqual(
            row.note,
            notes.find((n) => n.id === row.note.id),
          );
        assert.deepEqual(check.preparation(a.token).plans[0], plan);
        results.onlyVisitLinksChanged = true;
      } finally {
        check.close();
      }
      if (!before) {
        page = await launch();
        await page
          .locator('#visit-preparation summary')
          .filter({ hasText: 'Verknüpftes Weltwissen' })
          .click();
        await page.waitForFunction(() =>
          document.querySelector('#visit-note-selection-summary').textContent.startsWith('4 '),
        );
        await page
          .locator('#visit-note-selected')
          .getByRole('button', { name: notes[0].title, exact: true })
          .click();
        await page.waitForFunction(
          (text) => document.querySelector('#visit-note-detail').textContent.includes(text),
          notes[0].gmNotes,
        );
        await page.locator('#visit-note-selected').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, 'fresh-visit-links.png') });
        await close();
        results.freshProcessRetainsLinksAndReadsSource = true;
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
