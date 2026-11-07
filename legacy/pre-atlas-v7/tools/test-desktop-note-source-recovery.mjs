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
  phase = before ? 'before' : process.argv.includes('--final') ? 'after-final' : 'after',
  out = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/note-source-recovery', phase);
await runNativeProbe(
  { output: out, name: 'note-source-recovery', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const require = createRequire(import.meta.url),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/note-source-recovery-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/note-source-recovery-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite';
    const make = (title, kind, gmNotes) => ({
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
    });
    const npc = make(
        'Nera die Quartiermeisterin',
        'npc',
        'Neras Originalwissen: Die Nachtwache zahlt mit kupfernen Marken.',
      ),
      clue = make('Das blaue Siegel', 'rumor', 'Offen: Wer führt die Küfergilde?');
    const link = '[Nera](dungeon-ref:note/' + npc.id + ')';
    const overview = {
      ...make(
        'Die Aufzug-Verschwörung',
        'quest',
        '  Ziel: Die Übergabe stoppen.\nEin alter Verweis auf ' +
          link +
          ' gehört nicht zu diesem Auftrag.\n\nBeispielcode: `' +
          link +
          '` bleibt unverändert.\n',
      ),
      readAloud: '  Ein Aushang erwähnt ' + link + '.\n',
      relations: [
        { targetId: npc.id, label: 'Quelle' },
        { targetId: npc.id, label: 'kennt' },
        { targetId: clue.id, label: 'Quelle' },
      ],
    };
    const other = {
      ...make('Die Torwache', 'quest', 'Nera wird am Nordtor gebraucht.'),
      relations: [{ targetId: npc.id, label: 'Quelle' }],
    };
    const expectedRoot = {
      ...overview,
      readAloud: overview.readAloud.replace(link, 'Nera'),
      gmNotes: overview.gmNotes.replace(link, 'Nera'),
      relations: [{ targetId: clue.id, label: 'Quelle' }],
    };
    const added = make('Die neue Zeugin', 'npc', 'Die Lieferung kommt über das Nordtor.');
    const laterTitle = 'Die Aufzug-Verschwörung · geprüft',
      laterGm =
        expectedRoot.gmNotes.replace(
          'Ziel: Die Übergabe stoppen.',
          'Ziel: Den Auftraggeber identifizieren.',
        ) + '\nSpätere Erkenntnis: Die Lieferung kommt über das Nordtor.\n',
      laterPublic = expectedRoot.readAloud + '\nEin neues Wachssiegel hängt am Brett.\n';
    const store = new CampaignStore(file),
      campaign = store.create('Versehentlich gelöste Zuordnung'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action,
      });
    const plan = {
      version: 1,
      id: randomUUID(),
      revision: 1,
      name: 'Bisheriger Abend',
      scenes: [
        {
          id: randomUUID(),
          title: 'Die Nachtwache befragen',
          notes: '  Alter Plan bleibt.\r\n',
          locationId: null,
        },
      ],
    };
    for (const n of [npc, clue, overview, other, added])
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
        detail: { ...store.session(w.token, plan.id).visits[0], noteIds: [other.id, npc.id] },
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
    async function launch(expectedCount = 2) {
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
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
      if (await page.locator('#atlas-navigation').isVisible())
        await page.locator('#atlas-navigation').click();
      if (!(await page.locator('#preparation-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#preparation-tab').click();
      await page.locator('#preparation-knowledge').click();
      await page.locator('#world-search').fill(overview.title);
      await page.locator('#world-list button').filter({ hasText: overview.title }).click();
      await page.waitForFunction(
        (t) => document.querySelector('#note-title').value.startsWith(t),
        overview.title,
      );
      await page.locator('#note-thread-open').click();
      await page.waitForFunction(
        (count) => document.querySelectorAll('#note-thread-sources article').length === count,
        expectedCount,
      );
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
    try {
      let page = await launch();
      const remove = async () => {
        const card = page.locator('#note-thread-sources article').filter({ hasText: npc.title });
        await card.locator('summary').filter({ hasText: 'Quelle aus dieser Mappe lösen…' }).click();
        await card.getByRole('button', { name: 'Verknüpfungen hier lösen', exact: true }).click();
        await page.waitForFunction(
          () =>
            document.querySelector('#note-thread-editor').hidden &&
            document.querySelectorAll('#note-thread-sources article').length === 1,
        );
      };
      await remove();
      await page.getByRole('button', { name: 'Übersichtsnotiz bearbeiten…', exact: true }).click();
      await page.waitForFunction(
        (t) => document.querySelector('#note-title').value === t,
        overview.title,
      );
      await page.locator('#note-title').fill(laterTitle);
      await page.locator('#note-read-aloud').fill(laterPublic);
      await page.locator('#note-gm').fill(laterGm);
      await page.locator('#relation-target').selectOption({ label: added.title });
      await page.locator('#relation-label').fill('Neue Quelle');
      await page.locator('#relation-add').click();
      await page.waitForFunction(
        (t) => document.querySelector('#note-relations').textContent.includes(t),
        added.title,
      );
      await page.locator('#note-thread-return').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#note-thread-editor').hidden &&
          document.querySelectorAll('#note-thread-sources article').length === 2,
      );
      await screenshot(page, path.join(out, 'later-edits.png'));
      await close();
      // The retained clue plus the newly added source were both confirmed above.
      page = await launch(2);
      results.afterReopen = await page.locator('#note-thread-dialog').innerText();
      results.offeredButtons = await page.locator('#note-thread-dialog button').allTextContents();
      await screenshot(page, path.join(out, 'recovery-entry.png'));
      if (before) {
        await page.keyboard.press('Control+z');
        assert.equal(await page.locator('#note-thread-sources article').count(), 2);
        results.nativeUndoDidNotRestoreSource = true;
        await page
          .getByRole('button', { name: 'Übersichtsnotiz bearbeiten…', exact: true })
          .click();
        await page.waitForFunction(
          (t) => document.querySelector('#note-title').value === t,
          laterTitle,
        );
        for (const label of ['Quelle', 'kennt']) {
          await page.locator('#relation-target').selectOption({ label: npc.title });
          await page.locator('#relation-label').fill(label);
          await page.locator('#relation-add').click();
          await page.waitForFunction(
            ({ name, label }) =>
              [...document.querySelectorAll('#note-relations > div')].some((e) =>
                e.textContent.includes(label + ': ' + name),
              ),
            { name: npc.title, label },
          );
        }
        await page
          .locator('#note-read-aloud')
          .fill((await page.locator('#note-read-aloud').inputValue()).replace('Nera', link));
        await page
          .locator('#note-gm')
          .fill(
            (await page.locator('#note-gm').inputValue()).replace(
              'Ein alter Verweis auf Nera',
              'Ein alter Verweis auf ' + link,
            ),
          );
        await page.locator('#note-title').click();
        await page.locator('#note-thread-return').click();
        results.manualReconstructionRequired = true;
      } else {
        await page
          .getByRole('button', { name: 'Gelöste Quellen wiederherstellen…', exact: true })
          .click();
        await page.locator('#note-thread-recoveries article').waitFor();
        const recovery = page
          .locator('#note-thread-recoveries article')
          .filter({ hasText: npc.title });
        assert.equal(await recovery.count(), 1);
        await recovery.locator('summary').click();
        await recovery
          .getByRole('button', { name: 'Verknüpfungen wiederherstellen', exact: true })
          .scrollIntoViewIfNeeded();
        await screenshot(page, path.join(out, 'recovery-preview.png'));
        await recovery
          .getByRole('button', { name: 'Verknüpfungen wiederherstellen', exact: true })
          .click();
        results.selectiveRecoveryAfterRestart = true;
      }
      await page.waitForFunction(
        () =>
          document.querySelector('#note-thread-editor').hidden &&
          document.querySelectorAll('#note-thread-sources article').length === 3,
      );
      results.recoveredMap = await page.locator('#note-thread-dialog').innerText();
      assert(
        results.recoveredMap.includes('Spätere Erkenntnis: Die Lieferung kommt über das Nordtor.'),
      );
      assert(results.recoveredMap.includes('Ein neues Wachssiegel hängt am Brett.'));
      await screenshot(page, path.join(out, 'recovered-map.png'));
      await page
        .getByRole('checkbox', { name: 'Für Spielabend auswählen: ' + npc.title, exact: true })
        .check();
      await page.locator('#note-thread-plan').selectOption('');
      await page.locator('#note-thread-plan-name').fill('Abend 11 · Die neue Zeugin');
      await page.locator('#note-thread-visit-title').fill('Nera und die Lieferung befragen');
      await page.locator('#note-thread-use').click();
      await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
      await page.locator('#session-packet-open').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#session-packet-dialog').open &&
          document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
      );
      results.packet = await page.locator('#session-packet-content').innerText();
      assert(results.packet.includes(npc.gmNotes));
      assert(results.packet.includes(added.gmNotes));
      assert(results.packet.includes('Ziel: Den Auftraggeber identifizieren.'));
      await screenshot(page, path.join(out, 'recovered-packet.png'));
      await close();
      page = await launch(3);
      results.freshRecoveredMap = await page.locator('#note-thread-dialog').innerText();
      await screenshot(page, path.join(out, 'fresh-recovered.png'));
      await close();
      const check = new CampaignStore(file);
      try {
        const a = check.activate(campaign.id),
          prep = check.preparation(a.token),
          saved = prep.notes.find((r) => r.note.id === overview.id).note;
        assert.equal(saved.title, laterTitle);
        assert.equal(saved.readAloud, laterPublic.replace('Nera', link));
        assert.equal(
          saved.gmNotes,
          laterGm.replace('Ein alter Verweis auf Nera', 'Ein alter Verweis auf ' + link),
        );
        assert.deepEqual(
          new Set(saved.relations.map((r) => r.targetId + '|' + r.label)),
          new Set(
            [...overview.relations, { targetId: added.id, label: 'Neue Quelle' }].map(
              (r) => r.targetId + '|' + r.label,
            ),
          ),
        );
        for (const n of [npc, clue, other, added])
          assert.deepEqual(prep.notes.find((r) => r.note.id === n.id).note, n);
        assert.deepEqual(
          prep.plans.find((p) => p.id === plan.id),
          plan,
        );
        assert.deepEqual(check.session(a.token, plan.id).visits[0].noteIds, [other.id, npc.id]);
        const next = prep.plans.find((p) => p.id !== plan.id);
        assert.deepEqual(
          new Set(check.session(a.token, next.id).visits[0].noteIds),
          new Set([overview.id, npc.id, clue.id, added.id]),
        );
        results.originalsLaterProseNewRelationshipAndOldPlanPreserved = true;
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
