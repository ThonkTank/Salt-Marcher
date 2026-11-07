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
  zoom = 1,
  phase = before ? 'before' : 'after',
  out = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/note-source-choice', phase);
await runNativeProbe(
  { output: out, name: 'note-source-choice', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const require = createRequire(import.meta.url),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/note-source-choice-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/note-source-choice-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      title = 'Nera die Quartiermeisterin',
      common =
        'Nera verwaltet Listen und verlangt ihren ausstehenden Sold.\r\n' +
        Array(9)
          .fill(
            '  Ihr alter Dienst führte sie zwischen Nordtor und Südstadt; die üblichen Gerüchte widersprechen einander.\r\n',
          )
          .join('');
    const make = (name, kind, gmNotes) => ({
      version: 1,
      id: randomUUID(),
      revision: 1,
      title: name,
      kind,
      gmNotes,
      readAloud: '  Original zum Vorlesen\r\n',
      relations: [],
      creatureId: null,
      deleted: false,
    });
    const north = make(
        title,
        'npc',
        common +
          '\r\nAktueller Einsatz: Nordtor. Sie führt die Nachtwache.\r\nEntscheidender Hinweis: Kupfermarken öffnen den Lastenaufzug.\r\n',
      ),
      south = make(
        title,
        'npc',
        common +
          '\r\nAktueller Einsatz: Südstadt. Sie führt das Gildenlager.\r\nSie kennt den Lastenaufzug nicht.\r\n',
      ),
      east = make(
        title,
        'npc',
        common +
          '\r\nAktueller Einsatz: Flusshafen. Sie verwaltet die Fähren.\r\nSie kennt den Lastenaufzug nicht.\r\n',
      ),
      clue = make('Das blaue Siegel', 'rumor', 'Die Nachtwache meldet ein blaues Siegel.'),
      irrelevant = make(
        'Die alte Fährte',
        'rumor',
        'Diese Spur soll nicht mit in den neuen Abend.',
      ),
      overview = {
        ...make(
          'Die Aufzug-Verschwörung',
          'quest',
          '  Ziel: Den Auftraggeber am Nordtor befragen.\r\n',
        ),
        relations: [
          { targetId: clue.id, label: 'Quelle' },
          { targetId: irrelevant.id, label: 'Quelle' },
        ],
      },
      other = {
        ...make('Die Südstadt-Lieferung', 'quest', 'Andere Verwendung bleibt erhalten.'),
        relations: [{ targetId: south.id, label: 'Quelle' }],
      };
    const originalNotes = [north, south, east, clue, irrelevant, overview, other],
      plan = {
        version: 1,
        id: randomUUID(),
        revision: 1,
        name: 'Bisheriger Abend',
        scenes: [
          {
            id: randomUUID(),
            title: 'Das Gildenlager befragen',
            notes: '  Alter Plan bleibt.\r\n',
            locationId: null,
          },
        ],
      },
      nextName = 'Abend 13 · Die richtige Nera',
      nextVisit = 'Die Nachtwache am Nordtor befragen';
    const store = new CampaignStore(file),
      campaign = store.create('Gleichnamige Originalquellen unterscheiden'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action,
      });
    for (const note of originalNotes)
      store.changePreparation({
        ...command(null),
        change: { kind: 'note', expectedRevision: null, note },
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
        detail: { ...store.session(w.token, plan.id).visits[0], noteIds: [other.id, south.id] },
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
    async function openOverview(page, count = 2) {
      await page.locator('#world-search').fill(overview.title);
      await page.locator('#world-list button').filter({ hasText: overview.title }).click();
      await page.waitForFunction(
        (t) => document.querySelector('#note-title').value === t,
        overview.title,
      );
      await page.locator('#note-thread-open').click();
      await page.waitForFunction(
        (count) => document.querySelectorAll('#note-thread-sources article').length === count,
        count,
      );
    }
    async function launch(count = 2) {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
      });
      closed = false;
      launches.push({ pid: app.process().pid });
      const page = await app.firstWindow();
      await app.evaluate(
        ({ BrowserWindow }, zoom) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.setZoomFactor(zoom),
        zoom,
      );
      page.setDefaultTimeout(10000);
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await page
        .locator('#campaign-screen-list article')
        .filter({ hasText: campaign.name })
        .getByRole('button', { name: 'Fortsetzen', exact: true })
        .click();
      await revealWorkspaceNavigation(page);
      if (!(await page.locator('#preparation-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#preparation-tab').click();
      await page.locator('#preparation-knowledge').click();
      await openOverview(page, count);
      return page;
    }
    async function screenshot(page, filename) {
      return page.screenshot({ path: filename });
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
    async function choices(page) {
      await page
        .locator('#note-thread-sources article')
        .filter({ hasText: irrelevant.title })
        .locator('input[type=checkbox]')
        .uncheck();
      await page.locator('#note-thread-plan').selectOption('');
      await page.locator('#note-thread-plan-name').fill(nextName);
      await page.locator('#note-thread-visit-title').fill(nextVisit);
    }
    async function search(page, query, count) {
      const details = page
        .locator('#note-thread-dialog details')
        .filter({ has: page.locator('#note-thread-search') });
      if (!(await details.getAttribute('open').then((v) => v !== null)))
        await details.locator(':scope > summary').click();
      await page.locator('#note-thread-search').fill(query);
      await page.locator('#note-thread-find').click();
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll('#note-thread-candidates input[type=checkbox]').length ===
          count,
        count,
      );
    }
    try {
      let page = await launch();
      await choices(page);
      await search(page, 'Nera', 3);
      results.initialCandidates = await page.locator('#note-thread-candidates').innerText();
      results.candidateButtons = await page
        .locator('#note-thread-candidates button')
        .allTextContents();
      await page.locator('#note-thread-candidates').scrollIntoViewIfNeeded();
      await screenshot(page, path.join(out, 'same-name-candidates.png'));
      if (before) {
        assert.equal(await page.locator('#note-thread-candidates button').count(), 0);
        results.noOriginalInspectionInChooser = true;
        await page
          .locator('#note-thread-dialog')
          .getByRole('button', { name: 'Schließen', exact: true })
          .click();
        await page.locator('#world-search').fill('Nera');
        await page.waitForFunction(
          () => document.querySelectorAll('#world-list button').length === 3,
        );
        results.inspectedOriginals = [];
        let found = false;
        for (let i = 0; i < 3; i++) {
          await page.locator('#world-list button').nth(i).click();
          await page.waitForFunction(
            (i) =>
              document.querySelectorAll('#world-list button')[i]?.getAttribute('aria-pressed') ===
              'true',
            i,
          );
          await page.locator('#note-gm').focus();
          await page.keyboard.press('Control+End');
          const gm = await page.locator('#note-gm').inputValue();
          results.inspectedOriginals.push(gm);
          if (gm.includes('Aktueller Einsatz: Nordtor.')) {
            assert(gm.includes('Kupfermarken'));
            await screenshot(page, path.join(out, 'correct-original.png'));
            found = true;
            break;
          }
        }
        assert(found);
        await openOverview(page);
        results.destinationAfterExternalInspection = {
          plan: await page.locator('#note-thread-plan-name').inputValue(),
          visit: await page.locator('#note-thread-visit-title').inputValue(),
        };
        assert.notEqual(results.destinationAfterExternalInspection.plan, nextName);
        await choices(page);
        await search(page, 'Kupfermarken', 1);
        await page.locator('#note-thread-candidates input[type=checkbox]').check();
        results.externalSearchAndDestinationReentryRequired = true;
      } else {
        results.inspectedOriginals = [];
        let found = false;
        for (let i = 0; i < 3; i++) {
          await page
            .locator('#note-thread-candidates article')
            .nth(i)
            .getByRole('button', { name: 'Original prüfen…', exact: true })
            .click();
          await page.waitForFunction(
            () =>
              !document.querySelector('#note-thread-editor').hidden &&
              !document.querySelector('#note-thread-choose-source').disabled,
          );
          await page.locator('#note-gm').focus();
          await page.keyboard.press('Control+End');
          const gm = await page.locator('#note-gm').inputValue();
          results.inspectedOriginals.push(gm);
          if (gm.includes('Aktueller Einsatz: Nordtor.')) {
            assert(gm.includes('Kupfermarken'));
            await screenshot(page, path.join(out, 'correct-original.png'));
            await page.locator('#note-thread-choose-source').click();
            await page.waitForFunction(
              () =>
                document.querySelector('#note-thread-editor').hidden &&
                document.querySelectorAll('#note-thread-candidates input:checked').length === 1 &&
                !document.querySelector('#note-thread-add').disabled,
            );
            found = true;
            break;
          }
          await page.locator('#note-thread-return').click();
          await page.waitForFunction(() => document.querySelector('#note-thread-editor').hidden);
        }
        assert(found);
        assert.equal(await page.locator('#note-thread-search').inputValue(), 'Nera');
        assert.equal(await page.locator('#note-thread-plan-name').inputValue(), nextName);
        assert.equal(await page.locator('#note-thread-visit-title').inputValue(), nextVisit);
        assert.equal(
          await page
            .locator('#note-thread-sources article')
            .filter({ hasText: irrelevant.title })
            .locator('input[type=checkbox]')
            .isChecked(),
          false,
        );
        assert.equal(await page.locator('#note-thread-sources article').count(), 2);
        results.reviewBeforeLinkPreservesSearchChoicesAndDestination = true;
      }
      await page.locator('#note-thread-add').click();
      await page.waitForFunction(
        () => document.querySelectorAll('#note-thread-sources article').length === 3,
      );
      await page.waitForFunction(
        (text) => document.querySelector('#note-thread-sources').textContent.includes(text),
        'Aktueller Einsatz: Nordtor.',
      );
      const correct = page
        .locator('#note-thread-sources article')
        .filter({ hasText: 'Aktueller Einsatz: Nordtor.' });
      assert.equal(await correct.count(), 1);
      // Newly linked sources require an explicit current-revision choice.
      assert.equal(await correct.locator('input[type=checkbox]').isChecked(), false);
      await correct.locator('input[type=checkbox]').check();
      assert.equal(await correct.locator('input[type=checkbox]').isChecked(), true);
      assert.equal(
        await page
          .locator('#note-thread-sources article')
          .filter({ hasText: irrelevant.title })
          .locator('input[type=checkbox]')
          .isChecked(),
        false,
      );
      assert.equal(await page.locator('#note-thread-plan-name').inputValue(), nextName);
      assert.equal(await page.locator('#note-thread-visit-title').inputValue(), nextVisit);
      await screenshot(page, path.join(out, 'correct-source-linked.png'));
      await page.locator('#note-thread-use').click();
      await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
      await page.locator('#session-packet-open').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#session-packet-dialog').open &&
          document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
      );
      results.packet = await page.locator('#session-packet-content').innerText();
      assert(results.packet.includes('Aktueller Einsatz: Nordtor.'));
      assert(results.packet.includes('Kupfermarken'));
      assert(!results.packet.includes('Aktueller Einsatz: Südstadt.'));
      assert(!results.packet.includes('Aktueller Einsatz: Flusshafen.'));
      assert(!results.packet.includes(irrelevant.gmNotes));
      await screenshot(page, path.join(out, 'right-original-packet.png'));
      await close();
      page = await launch(3);
      await page.waitForFunction(
        (text) => document.querySelector('#note-thread-sources').textContent.includes(text),
        'Aktueller Einsatz: Nordtor.',
      );
      results.freshMap = await page.locator('#note-thread-dialog').innerText();
      await screenshot(page, path.join(out, 'fresh-map.png'));
      await close();
      const check = new CampaignStore(file);
      try {
        const a = check.activate(campaign.id),
          prep = check.preparation(a.token);
        assert.equal(prep.notes.length, originalNotes.length);
        for (const n of originalNotes.filter((n) => n.id !== overview.id))
          assert.deepEqual(prep.notes.find((r) => r.note.id === n.id).note, n);
        const saved = prep.notes.find((r) => r.note.id === overview.id).note;
        assert.equal(saved.gmNotes, overview.gmNotes);
        assert.equal(saved.readAloud, overview.readAloud);
        assert.deepEqual(saved.relations, [
          ...overview.relations,
          { targetId: north.id, label: 'Quelle' },
        ]);
        assert.deepEqual(
          prep.plans.find((p) => p.id === plan.id),
          plan,
        );
        assert.deepEqual(check.session(a.token, plan.id).visits[0].noteIds, [other.id, south.id]);
        const next = prep.plans.find((p) => p.id !== plan.id);
        assert.equal(next.name, nextName);
        assert.deepEqual(
          new Set(check.session(a.token, next.id).visits[0].noteIds),
          new Set([overview.id, clue.id, north.id]),
        );
        results.onlyReviewedIdentityLinkedAndPrepared = true;
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
        zoom,
        profile,
        results,
        launches,
        artifactHashes,
        errors,
        normalClose: true,
      });
      console.log('COMPLETE ' + phase + ' correct same-name source linked and used');
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
