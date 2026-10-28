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
  out = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/note-hierarchy', phase);
await runNativeProbe(
  { output: out, name: 'note-hierarchy', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const require = createRequire(import.meta.url),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/note-hierarchy-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/note-hierarchy-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      make = (title, kind, gmNotes) => ({
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
      });
    const nera = make('Nera die Quartiermeisterin', 'npc', 'Nera kennt den Lastenaufzug.'),
      clue = make('Das blaue Siegel', 'rumor', 'Das blaue Siegel stammt aus der Nachtwache.'),
      closed = make('Die verlorenen Fässer', 'rumor', 'Diese Fasssuche ist abgeschlossen.'),
      irrelevant = make('Der Lieferbote', 'npc', 'Dieser Bote gehört zum anderen Unterstrang.'),
      personal = make('Eigene Spielnotiz', 'rule', 'Die Gruppe will Nera zuerst allein sprechen.'),
      childA = {
        ...make('Die Nachtwache', 'quest', 'Den Wachwechsel am Tor verstehen.'),
        relations: [nera, clue, closed].map((n) => ({ targetId: n.id, label: 'Quelle' })),
      },
      childB = {
        ...make('Die Lieferlisten', 'quest', 'Den Weg der Listen zurückverfolgen.'),
        relations: [clue, irrelevant].map((n) => ({ targetId: n.id, label: 'Quelle' })),
      },
      parent = {
        ...make('Die Aufzug-Verschwörung', 'quest', 'Zwei Unterstränge gehören zu diesem Auftrag.'),
        relations: [childA, childB].map((n) => ({ targetId: n.id, label: 'Unterstrang' })),
      },
      other = {
        ...make('Andere Verwendung', 'quest', 'Dieser Auftrag bleibt unangetastet.'),
        relations: [{ targetId: nera.id, label: 'Quelle' }],
      };
    const notes = [nera, clue, closed, irrelevant, personal, childA, childB, parent, other],
      makePlan = (name, titles) => ({
        version: 1,
        id: randomUUID(),
        revision: 1,
        name,
        scenes: titles.map((title) => ({
          id: randomUUID(),
          title,
          notes: '  Besuchsnotizen\r\nbleiben unverändert.\r\n',
          locationId: null,
        })),
      }),
      oldPlan = makePlan('Abend 01 · Die andere Spur', ['Alten Auftrag prüfen']),
      plan = makePlan('Abend 15 · Der Wachwechsel', [
        'Vorher am Kai',
        'Nera zum Wachwechsel befragen',
      ]),
      target = plan.scenes[1],
      newNera = nera.gmNotes + ' Sie nennt jetzt den zweiten Glockenschlag als Wachwechsel.';
    const store = new CampaignStore(file),
      campaign = store.create('Übergeordnete Mappe und Unterstränge'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action,
      });
    for (const note of notes)
      store.changePreparation({
        ...command(null),
        change: { kind: 'note', expectedRevision: null, note },
      });
    for (const p of [oldPlan, plan])
      store.changePreparation({
        ...command(null),
        change: { kind: 'plan', expectedRevision: null, plan: p },
      });
    const state = store.narrative(w.token, closed.id).state;
    store.executeProgress(
      command({
        kind: 'narrative-state',
        state: { ...state, status: 'closed' },
        expectedRevision: state.revision,
        expectedNoteRevision: 1,
      }),
    );
    for (const p of [oldPlan, plan]) {
      const visit = store.session(w.token, p.id).visits[p === plan ? 1 : 0];
      store.executeSession(
        command({
          kind: 'visit',
          planId: p.id,
          expectedRevision: visit.revision,
          detail: { ...visit, readAloud: '  Bestehende Begrüßung\r\n', noteIds: [personal.id] },
        }),
      );
    }
    const oldView = store.session(w.token, oldPlan.id),
      initialView = store.session(w.token, plan.id);
    store.close();

    let app,
      closedApp = true;
    const results = { destinations: [] },
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
      closedApp = false;
      launches.push({ pid: app.process().pid });
      const page = await app.firstWindow();
      page.setDefaultTimeout(10000);
      page.on('pageerror', (e) => errors.push(e.stack));
      await app.evaluate(
        ({ BrowserWindow }, z) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.setZoomFactor(z),
        zoom,
      );
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await page
        .locator('#campaign-screen-list article')
        .filter({ hasText: campaign.name })
        .getByRole('button', { name: 'Fortsetzen', exact: true })
        .click();
      await revealWorkspaceNavigation(page);
      await page.locator('#preparation-tab').click();
      return page;
    }
    async function selectVisit(page) {
      await page.locator('#preparation-planning').click();
      await page.locator('#plans').selectOption({ label: plan.name });
      await page.locator('#scene-list button').filter({ hasText: target.title }).click();
      await page.waitForFunction(
        (t) => document.querySelector('#scene-title').value === t,
        target.title,
      );
    }
    async function openMap(page, map) {
      await page.locator('#preparation-knowledge').click();
      await page.locator('#world-search').fill(map.title);
      await page
        .locator('#world-list')
        .getByRole('button', { name: map.title, exact: true })
        .click();
      await page.waitForFunction(
        (t) => document.querySelector('#note-title').value === t,
        map.title,
      );
      await page.locator('#note-thread-open').click();
      await page.waitForFunction(() => !document.querySelector('#note-thread-use').disabled);
    }
    async function screenshot(page, name) {
      return page.screenshot({ path: path.join(out, name) });
    }
    async function close() {
      const ended = new Promise((r) =>
        app.process().once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      const exit = await ended;
      assert.deepEqual(exit, { code: 0, signal: null });
      launches.at(-1).exit = exit;
      closedApp = true;
    }

    async function mapReady(page, title) {
      await page.waitForFunction(
        (t) =>
          document.querySelector('#note-thread-heading').textContent === 'Notizmappe: ' + t &&
          document.querySelector('#note-thread-editor').hidden &&
          !document.querySelector('#note-thread-use').disabled,
        title,
      );
    }
    async function enterChild(page) {
      if (!before) {
        await page
          .locator('#note-thread-sources article')
          .filter({ hasText: childA.title })
          .getByRole('button', { name: 'Notizmappe öffnen…', exact: true })
          .click();
        return;
      }
      await page
        .locator('#note-thread-sources article')
        .filter({ hasText: childA.title })
        .getByRole('button', { name: 'Notiz bearbeiten…', exact: true })
        .click();
      await page.waitForFunction(
        (t) =>
          !document.querySelector('#note-thread-editor').hidden &&
          document.querySelector('#note-title').value === t &&
          !document.querySelector('#note-thread-return').disabled,
        childA.title,
      );
      if (!before) await page.locator('#note-thread-editor #note-thread-open').click();
    }
    async function parentChoices(page) {
      await page.locator('#note-thread-include-root').uncheck();
      await page
        .locator('#note-thread-sources article')
        .filter({ hasText: childB.title })
        .locator('input[type=checkbox]')
        .uncheck();
    }
    async function checkParentChoices(page) {
      assert.equal(await page.locator('#note-thread-include-root').isChecked(), false);
      assert.equal(
        await page
          .locator('#note-thread-sources article')
          .filter({ hasText: childB.title })
          .locator('input[type=checkbox]')
          .isChecked(),
        false,
      );
      assert.equal(await page.locator('#note-thread-plan').inputValue(), plan.id);
      assert.equal(await page.locator('#note-thread-visit').inputValue(), target.id);
    }
    async function packet(page, name) {
      await page.locator('#session-packet-open').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#session-packet-dialog').open &&
          document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
      );
      const text = await page.locator('#session-packet-content').innerText();
      for (const n of [personal, clue, childA]) assert(text.includes(n.gmNotes));
      assert(text.includes(newNera));
      for (const n of [closed, irrelevant, childB, parent]) assert(!text.includes(n.gmNotes));
      results[name] = text;
      const original = page
        .locator('#session-packet-content .packet-text')
        .filter({ hasText: newNera });
      await original.scrollIntoViewIfNeeded();
      await screenshot(page, name + '.png');
      await page.locator('#session-packet-close').click();
    }
    try {
      let page = await launch();
      await selectVisit(page);
      await openMap(page, parent);
      await parentChoices(page);
      await enterChild(page);
      if (before) {
        results.childMapActionVisible = await page
          .locator('#note-thread-editor #note-thread-open')
          .isVisible();
        assert.equal(results.childMapActionVisible, false);
        await screenshot(page, 'child-original-without-map-action.png');
        await page
          .locator('#note-relations')
          .getByRole('button', { name: 'Quelle: ' + nera.title, exact: true })
          .click();
        await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
        await page.waitForFunction(
          (t) => document.querySelector('#note-title').value === t,
          nera.title,
        );
        results.followingChildSourceClosesParentMap = true;
        await page.locator('#note-gm').fill(newNera);
        await page.locator('#preparation-apply').click();
        await page.waitForFunction(
          () => document.querySelector('#status').textContent === 'Gespeichert.',
        );
        await page
          .locator('#note-incoming')
          .getByRole('button', { name: 'Verweis von ' + childA.title, exact: true })
          .click();
        await page.waitForFunction(
          (t) => document.querySelector('#note-title').value === t,
          childA.title,
        );
        await page
          .locator('#note-incoming')
          .getByRole('button', { name: 'Verweis von ' + parent.title, exact: true })
          .click();
        await page.waitForFunction(
          (t) => document.querySelector('#note-title').value === t,
          parent.title,
        );
        await page.locator('#note-thread-open').click();
        await mapReady(page, parent.title);
        results.parentChoicesAfterExternalReturn = {
          root: await page.locator('#note-thread-include-root').isChecked(),
          otherBranch: await page
            .locator('#note-thread-sources article')
            .filter({ hasText: childB.title })
            .locator('input[type=checkbox]')
            .isChecked(),
        };
        assert.equal(results.parentChoicesAfterExternalReturn.root, true);
        assert.equal(results.parentChoicesAfterExternalReturn.otherBranch, true);
        await parentChoices(page);
        await screenshot(page, 'parent-reassembled.png');
        await page
          .locator('#note-thread-dialog')
          .getByRole('button', { name: 'Schließen', exact: true })
          .click();
        await page
          .locator('#note-relations')
          .getByRole('button', { name: 'Unterstrang: ' + childA.title, exact: true })
          .click();
        await page.waitForFunction(
          (t) => document.querySelector('#note-title').value === t,
          childA.title,
        );
        await page.locator('#note-thread-open').click();
        await mapReady(page, childA.title);
      } else {
        await mapReady(page, childA.title);
        results.childMapOpenedInsideExistingContext = true;
        await screenshot(page, 'child-map.png');
        await page.waitForFunction(
          (t) => document.querySelector('#note-thread-sources').textContent.includes(t),
          nera.gmNotes,
        );
        assert.equal(
          await page
            .locator('#note-thread-sources article')
            .filter({ hasText: closed.title })
            .count(),
          0,
        );
        await page
          .locator('#note-thread-sources article')
          .filter({ hasText: nera.title })
          .getByRole('button', { name: 'Notiz bearbeiten…', exact: true })
          .click();
        await page.waitForFunction(
          (t) =>
            !document.querySelector('#note-thread-return').disabled &&
            document.querySelector('#note-title').value === t,
          nera.title,
        );
        await page.locator('#note-gm').fill(newNera);
        await page.locator('#note-thread-return').click();
        await mapReady(page, childA.title);
        await page.waitForFunction(
          (t) => document.querySelector('#note-thread-sources').textContent.includes(t),
          newNera,
        );
        await page.getByRole('button', { name: 'Zur Mappe: ' + parent.title, exact: true }).click();
        await mapReady(page, parent.title);
        await checkParentChoices(page);
        results.parentChoicesAndDestinationRetained = true;
        await screenshot(page, 'parent-restored.png');
        await enterChild(page);
        await mapReady(page, childA.title);
      }
      assert.equal(await page.locator('#note-thread-plan').inputValue(), plan.id);
      assert.equal(await page.locator('#note-thread-visit').inputValue(), target.id);
      await page.locator('#note-thread-use').click();
      await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#scene-title').inputValue(), target.title);
      await packet(page, 'prepared-packet');
      await close();
      page = await launch();
      await selectVisit(page);
      await packet(page, 'fresh-packet');
      await close();
      const check = new CampaignStore(file);
      try {
        const a = check.activate(campaign.id),
          view = check.session(a.token, plan.id),
          prep = check.preparation(a.token);
        assert.deepEqual(check.session(a.token, oldPlan.id), oldView);
        assert.deepEqual(view.visits[0], initialView.visits[0]);
        assert.deepEqual(
          new Set(view.visits[1].noteIds),
          new Set([personal, nera, clue, childA].map((n) => n.id)),
        );
        assert.equal(view.visits[1].noteIds.length, 4);
        assert.equal(view.visits[1].readAloud, initialView.visits[1].readAloud);
        assert.deepEqual(
          prep.plans.find((p) => p.id === plan.id),
          plan,
        );
        assert.deepEqual(
          prep.plans.find((p) => p.id === oldPlan.id),
          oldPlan,
        );
        assert.equal(prep.notes.length, notes.length);
        for (const n of notes)
          assert.deepEqual(
            prep.notes.find((r) => r.note.id === n.id).note,
            n === nera ? { ...n, revision: 2, gmNotes: newNera } : n,
          );
        results.onlyOriginalNpcTextAndIntendedVisitLinksChanged = true;
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
      console.log(
        'COMPLETE ' + phase + ' subordinate map read, original changed and selected visit prepared',
      );
    } catch (error) {
      await writeFile(
        path.join(out, 'failure.json'),
        JSON.stringify({ error: error.stack, results, errors, launches }, null, 2),
      );
      if (app && !closedApp)
        try {
          await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') });
        } catch {}
      throw error;
    } finally {
    }
  },
);
