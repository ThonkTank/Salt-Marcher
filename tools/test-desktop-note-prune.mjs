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
  out = process.env.QA_EVIDENCE_DIR ?? path.join(root, '.build/note-prune', phase);
await runNativeProbe(
  { output: out, name: 'note-prune', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const require = createRequire(import.meta.url),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/note-prune-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/note-prune-store.cjs');
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
    const store = new CampaignStore(file),
      campaign = store.create('Mappe bereinigen'),
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
    for (const n of [npc, clue, overview, other])
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
      const openMap = async (title) => {
        await page.locator('#world-search').fill(title);
        await page.locator('#world-list button').filter({ hasText: title }).click();
        await page.waitForFunction((t) => document.querySelector('#note-title').value === t, title);
        await page.locator('#note-thread-open').click();
        await page.waitForFunction(() => document.querySelector('#note-thread-sources article'));
      };
      results.initialSources = await page.locator('#note-thread-sources').innerText();
      await page.screenshot({ path: path.join(out, 'initial-map.png') });
      if (before) {
        await page
          .getByRole('button', { name: 'Übersichtsnotiz bearbeiten…', exact: true })
          .click();
        await page.waitForFunction(
          (t) => document.querySelector('#note-title').value === t,
          overview.title,
        );
        for (const remaining of [1, 0]) {
          await page
            .locator('#note-relations > div')
            .filter({ hasText: npc.title })
            .first()
            .getByRole('button', { name: 'Beziehung lösen', exact: true })
            .click();
          await page.waitForFunction(
            ({ name, count }) =>
              [...document.querySelectorAll('#note-relations > div')].filter((e) =>
                e.textContent.includes(name),
              ).length === count,
            { name: npc.title, count: remaining },
          );
        }
        await page.locator('#note-thread-return').click();
        await page.waitForFunction(() => document.querySelector('#note-thread-editor').hidden);
        assert.equal(await page.locator('#note-thread-sources article').count(), 2);
        results.afterRelationshipsRemoved = await page.locator('#note-thread-sources').innerText();
        await page.screenshot({ path: path.join(out, 'still-linked-from-prose.png') });
        await page
          .getByRole('button', { name: 'Übersichtsnotiz bearbeiten…', exact: true })
          .click();
        await page.waitForFunction(
          (t) => document.querySelector('#note-title').value === t,
          overview.title,
        );
        await page
          .locator('#note-read-aloud')
          .fill((await page.locator('#note-read-aloud').inputValue()).replace(link, 'Nera'));
        await page
          .locator('#note-gm')
          .fill((await page.locator('#note-gm').inputValue()).replace(link, 'Nera'));
        await page.locator('#note-title').click();
        await page.locator('#note-thread-return').click();
      } else {
        const card = page.locator('#note-thread-sources article').filter({ hasText: npc.title }),
          review = card.locator('summary').filter({ hasText: 'Quelle aus dieser Mappe lösen…' });
        await page.locator('#note-thread-plan').selectOption('');
        await page.locator('#note-thread-plan-name').fill('Mein vorbereiteter Abend');
        await page.locator('#note-thread-visit-title').fill('Meine vorbereitete Spur');
        await page
          .locator('#note-thread-sources article')
          .filter({ hasText: clue.title })
          .locator('input[type=checkbox]')
          .uncheck();
        await review.click();
        assert((await card.innerText()).includes('2 Beziehungen entfernen: Quelle · kennt'));
        assert((await card.innerText()).includes('1 Textverweis in „Zum Vorlesen“'));
        assert((await card.innerText()).includes('1 Textverweis in „GM-Notizen“'));
        await card.getByRole('button', { name: 'Verknüpfungen behalten', exact: true }).click();
        assert.equal(await page.locator('#note-thread-sources article').count(), 2);
        await review.click();
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
        );
        const confirm = card.getByRole('button', { name: 'Verknüpfungen hier lösen', exact: true });
        await confirm.scrollIntoViewIfNeeded();
        assert(
          await confirm.evaluate((e) => {
            const r = e.getBoundingClientRect();
            return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
        );
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        await writeFile(
          path.join(out, 'unlink-100percent.png'),
          Buffer.from(
            await app.evaluate(async ({ BrowserWindow }) =>
              (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
                .toPNG()
                .toString('base64'),
            ),
            'base64',
          ),
        );
        await confirm.click();
        await page.waitForFunction(
          () =>
            document.querySelector('#note-thread-editor').hidden &&
            document.querySelectorAll('#note-thread-sources article').length === 1,
        );
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
        );
        assert.equal(
          await page.locator('#note-thread-plan-name').inputValue(),
          'Mein vorbereiteter Abend',
        );
        assert.equal(
          await page.locator('#note-thread-visit-title').inputValue(),
          'Meine vorbereitete Spur',
        );
        const remaining = page
          .locator('#note-thread-sources article')
          .filter({ hasText: clue.title })
          .locator('input[type=checkbox]');
        assert.equal(await remaining.isChecked(), false);
        await remaining.check();
        results.deliberateChoicesAndDestinationNamesRetained = true;
        results.previewKeepAndUnlinkAt100PercentExecuted = true;
      }
      await page.waitForFunction(
        () =>
          document.querySelector('#note-thread-editor').hidden &&
          document.querySelectorAll('#note-thread-sources article').length === 1,
      );
      results.cleanedMap = await page.locator('#note-thread-sources').innerText();
      await page.screenshot({ path: path.join(out, 'cleaned-map.png') });
      await page
        .locator('#note-thread-dialog')
        .getByRole('button', { name: 'Schließen', exact: true })
        .click();
      await openMap(other.title);
      await page.waitForFunction(
        (s) => document.querySelector('#note-thread-sources').textContent.includes(s),
        npc.gmNotes,
      );
      results.otherMapStillUsesOriginal = await page.locator('#note-thread-sources').innerText();
      await page.screenshot({ path: path.join(out, 'other-use-retained.png') });
      await page
        .locator('#note-thread-dialog')
        .getByRole('button', { name: 'Schließen', exact: true })
        .click();
      await openMap(overview.title);
      await page.locator('#note-thread-plan').selectOption('');
      await page.locator('#note-thread-plan-name').fill('Abend 10 · Die Küfergilde');
      await page.locator('#note-thread-visit-title').fill('Das Siegel verfolgen');
      await page.locator('#note-thread-use').click();
      await page.locator('#note-thread-dialog').waitFor({ state: 'hidden' });
      await page.locator('#session-packet-open').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#session-packet-dialog').open &&
          document.querySelector('#session-packet-dialog').getAttribute('aria-busy') === 'false',
      );
      results.packet = await page.locator('#session-packet-content').innerText();
      assert(results.packet.includes(clue.gmNotes));
      assert(!results.packet.includes(npc.gmNotes));
      await page.screenshot({ path: path.join(out, 'next-session-packet.png') });
      await close();
      page = await launch(1);
      results.freshMap = await page.locator('#note-thread-sources').innerText();
      await page.screenshot({ path: path.join(out, 'fresh-cleaned-map.png') });
      await close();
      const check = new CampaignStore(file);
      try {
        const a = check.activate(campaign.id),
          prep = check.preparation(a.token),
          saved = prep.notes.find((r) => r.note.id === overview.id).note;
        assert.deepEqual(prep.notes.find((r) => r.note.id === npc.id).note, npc);
        assert.deepEqual(prep.notes.find((r) => r.note.id === other.id).note, other);
        assert.deepEqual(prep.notes.find((r) => r.note.id === clue.id).note, clue);
        assert.equal(saved.gmNotes, expectedRoot.gmNotes);
        assert.equal(saved.readAloud, expectedRoot.readAloud);
        assert.deepEqual(saved.relations, expectedRoot.relations);
        assert.deepEqual(
          prep.plans.find((p) => p.id === plan.id),
          plan,
        );
        assert.deepEqual(check.session(a.token, plan.id).visits[0].noteIds, [other.id, npc.id]);
        const next = prep.plans.find((p) => p.id !== plan.id);
        assert.equal(next.name, 'Abend 10 · Die Küfergilde');
        assert.deepEqual(
          new Set(check.session(a.token, next.id).visits[0].noteIds),
          new Set([overview.id, clue.id]),
        );
        results.originalIdentitiesOtherUseAndPastPlanPreserved = true;
        results.plainProseAndLiteralCodePreserved = true;
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
