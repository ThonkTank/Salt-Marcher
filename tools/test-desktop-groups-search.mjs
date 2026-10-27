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
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/groups-search-evidence');
await runNativeProbe(
  { output: output, name: 'groups-search', resultName: 'groups-' + phase + '.json' },
  async (native) => {
    const group = await currentProcessGroup();
    await mkdir(output, { recursive: true });
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/desktop/groups-native-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/desktop/groups-native-store.cjs');
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
    const originals = [];
    for (const prefix of ['Hafen', 'Wald'])
      for (let i = 0; i < 65; i++) {
        const ack = store.executeProgress(
          command({
            kind: 'group-create',
            title: prefix + ' ' + String(i).padStart(2, '0'),
            encounterId: null,
            expectedEncounterRevision: null,
          }),
        );
        originals.push(store.groupView(w.token, ack.groupId));
      }
    let scene = store.executeLive(
      command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
    ).scene;
    if (!before)
      for (let i = 0; i < 2003; i++)
        scene = store.executeLive(
          command({
            kind: 'advance-clock',
            sceneId: scene.id,
            expectedRevision: scene.clock.revision,
            amount: 1,
            unit: 'minutes',
            calendarVersion: 'relative-v1',
            reason: i === 0 ? 'Bronzeschlüssel nach der Nachtwache' : 'Routinenotiz ' + i,
          }),
        ).scene;
    const timeRows = store.db
      .prepare('SELECT id,payload,checksum FROM scene_time_step ORDER BY id')
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
      await page.locator('#groups-tab').click();
      await page.waitForFunction(
        () => document.querySelectorAll('#groups-list button').length === 25,
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
      const submit = async (text, expected = 25) => {
        await page.locator('#groups-search').fill(text);
        await page
          .locator('#groups-search-form')
          .getByRole('button', { name: 'Suchen', exact: true })
          .click();
        await page.waitForFunction(
          (n) =>
            document.querySelectorAll('#groups-list button').length === n &&
            [...document.querySelectorAll('#groups-list button')].every((b) =>
              b.textContent.startsWith(document.querySelector('#groups-search').value),
            ),
          expected,
        );
      };
      await submit('Hafen');
      await page.locator('#groups-list button').first().click();
      await page.locator('#groups-title').fill('');
      await page.locator('#groups-notes').fill('Unfertige Hafen-Notiz');
      await page.waitForFunction(
        () =>
          document.querySelector('#groups-draft-status').textContent ===
          'Gruppeneingabe gesichert · noch nicht übernommen.',
      );
      results.selectedOriginalTitle = await page
        .locator('#groups-list button[aria-pressed=true]')
        .innerText();
      await page.locator('#groups-search').fill('Wald');
      results.afterQueryChange = {
        count: await page.locator('#groups-list button').count(),
        moreEnabled: await page.locator('#groups-more').isEnabled(),
        title: await page.locator('#groups-title').inputValue(),
      };
      if (before) {
        await page.locator('#groups-more').click();
        await page.waitForFunction(
          () => document.querySelectorAll('#groups-list button').length > 25,
        );
        results.mixedTitles = await page.locator('#groups-list button').allTextContents();
      } else {
        assert.equal(results.afterQueryChange.count, 0);
        assert.equal(results.afterQueryChange.moreEnabled, false);
        assert.equal(results.afterQueryChange.title, '');
        await submit('Wald');
        while (await page.locator('#groups-more').isEnabled()) {
          const count = await page.locator('#groups-list button').count();
          await page.locator('#groups-more').click();
          await page.waitForFunction(
            (n) => document.querySelectorAll('#groups-list button').length > n,
            count,
          );
        }
        const titles = await page.locator('#groups-list button').allTextContents();
        assert.equal(titles.length, 65);
        assert.equal(new Set(titles).size, 65);
        assert(titles.every((t) => t.startsWith('Wald ')));
        assert.equal(await page.locator('#groups-title').inputValue(), '');
        results.completeWaldResults = true;
        results.incompleteEditorPreserved = true;
      }
      await page.locator('#groups-search-form').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, 'groups-' + phase + '.png') });
      if (!before) {
        await page.locator('#chronicle-tab').click();
        await page.locator('#chronicle-category').selectOption('world');
        await page.locator('#chronicle-search').fill('Bronzeschlüssel');
        await page.waitForFunction(
          () =>
            document.querySelectorAll('#chronicle-list article').length === 1 &&
            document.querySelector('#chronicle-list').textContent.includes('Bronzeschlüssel'),
        );
        results.olderTimeNoteFound = true;
        await page.locator('#chronicle-category').selectOption('party');
        await page.waitForFunction(
          () =>
            document.querySelector('#chronicle-count').textContent.startsWith('0 ') &&
            document.querySelector('#chronicle').getAttribute('aria-busy') === 'false',
        );
        results.timeDoesNotLeakToParty = true;
        await page.locator('#groups-tab').click();
        assert.equal(await page.locator('#groups-title').inputValue(), '');
        assert.equal(await page.locator('#groups-notes').inputValue(), 'Unfertige Hafen-Notiz');
        results.otherTabPreservesDraft = true;
      }
      await close();
      const fresh = new CampaignStore(file);
      try {
        const active = fresh.activate(campaign.id);
        for (const original of originals)
          assert.deepEqual(fresh.groupView(active.token, original.id), original);
        const drafts = originals.map((g) => fresh.groupDraft(active.token, g.id)).filter(Boolean);
        assert.equal(drafts.length, 1);
        assert.equal(drafts[0].title, '');
        assert.equal(drafts[0].notes, 'Unfertige Hafen-Notiz');
        assert.deepEqual(
          fresh.db.prepare('SELECT id,payload,checksum FROM scene_time_step ORDER BY id').all(),
          timeRows,
        );
        results.timeHistoryUnchanged = true;
        results.draftId = drafts[0].groupId;
        results.originalsAndIncompleteDraftRetained = true;
      } finally {
        fresh.close();
      }
      if (!before) {
        page = await launch();
        const selected = originals.find((g) => g.id === results.draftId);
        await submit(selected.title, 1);
        await page.locator('#groups-list button').first().click();
        assert.equal(await page.locator('#groups-title').inputValue(), '');
        assert.equal(await page.locator('#groups-notes').inputValue(), 'Unfertige Hafen-Notiz');
        await close();
        results.nativeDraftRestart = true;
      }
      await native.recordResult({ results, launches, normalClose: true });
      console.log(JSON.stringify({ results, normalClose: true }));
      assert.equal(
        results.afterQueryChange.count,
        0,
        'Query changes must invalidate prior groups and cursor',
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
