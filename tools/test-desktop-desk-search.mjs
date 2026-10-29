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
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/desk-search-evidence');
await runNativeProbe(
  { output: output, name: 'desk-search', resultName: 'search-' + phase + '.json' },
  async (native) => {
    const group = await currentProcessGroup();
    await mkdir(output, { recursive: true });
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/desk-native-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/desk-native-store.cjs');
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
    const scene = store.executeLive(
      command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
    ).scene;
    const notes = [];
    for (const prefix of ['Hafen', 'Wald'])
      for (let i = 0; i < 65; i++) {
        const note = {
          version: 1,
          id: randomUUID(),
          revision: 1,
          kind: 'npc',
          title: prefix + ' ' + String(i).padStart(2, '0'),
          readAloud: '',
          gmNotes: '  Original\r\n' + prefix,
          relations: [],
          creatureId: null,
          deleted: false,
        };
        notes.push(note);
        store.changePreparation({
          ...command(null),
          change: { kind: 'note', expectedRevision: null, note },
        });
      }
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
      if (await page.locator('#live-continue').isVisible())
        await page.locator('#live-continue').click();
      await page.locator('#scene-desk').waitFor({ state: 'visible' });
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
      const submit = async (query) => {
        await page.locator('#desk-search').fill(query);
        await page
          .locator('#desk-search-form')
          .getByRole('button', { name: 'Suchen', exact: true })
          .click();
        await page.waitForFunction(
          () => document.querySelectorAll('#desk-results > div').length === 40,
        );
      };
      await submit('Hafen');
      await page
        .locator('#desk-results')
        .getByRole('button', { name: 'NPC · Hafen 00', exact: true })
        .click();
      await page.getByLabel('Szenentisch-Titel', { exact: true }).fill('');
      await page
        .locator('#desk-fields')
        .getByLabel('GM-Notizen', { exact: true })
        .fill('Unfertige Hafen-Notiz');
      await page.waitForFunction(
        () => document.querySelector('#desk-note-status').textContent === 'Eingabe gesichert.',
      );
      await page.locator('#desk-search').fill('Wald');
      results.afterQueryChange = {
        count: await page.locator('#desk-results > div').count(),
        moreVisible: await page.locator('#desk-more').isVisible(),
        title: await page.getByLabel('Szenentisch-Titel', { exact: true }).inputValue(),
      };
      if (before) {
        await page.locator('#desk-more').click();
        await page.waitForFunction(
          () => document.querySelectorAll('#desk-results > div').length === 65,
        );
        results.mixedTitles = await page
          .locator('#desk-results > div button:first-child')
          .allTextContents();
      } else {
        assert.equal(results.afterQueryChange.count, 0);
        assert.equal(results.afterQueryChange.moreVisible, false);
        assert.equal(results.afterQueryChange.title, '');
        await submit('Wald');
        await page.locator('#desk-more').click();
        await page.waitForFunction(
          () => document.querySelectorAll('#desk-results > div').length === 65,
        );
        const titles = await page
          .locator('#desk-results > div button:first-child')
          .allTextContents();
        assert.equal(new Set(titles).size, 65);
        assert(titles.every((t) => t.startsWith('NPC · Wald ')));
        assert(titles.includes('NPC · Wald 00'));
        assert(titles.includes('NPC · Wald 64'));
        results.completeWaldResults = true;
        await page.locator('#desk-search-kind').selectOption('creature');
        assert.equal(await page.locator('#desk-results > div').count(), 0);
        assert.equal(await page.locator('#desk-more').isVisible(), false);
        assert.equal(await page.getByLabel('Szenentisch-Titel', { exact: true }).inputValue(), '');
        results.areaSwitchPreservesEditor = true;
      }
      await page.locator('#desk-search-form').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, 'search-' + phase + '.png') });
      await close();
      const fresh = new CampaignStore(file);
      try {
        const active = fresh.activate(campaign.id),
          pre = fresh.preparation(active.token);
        for (const original of notes)
          assert.deepEqual(pre.notes.find((r) => r.note.id === original.id).note, original);
        const retained = fresh.preparationDraft(active.token, 'note', notes[0].id);
        assert.equal(retained.change.note.title, '');
        assert.equal(retained.change.note.gmNotes, 'Unfertige Hafen-Notiz');
        results.originalsAndIncompleteDraftRetained = true;
      } finally {
        fresh.close();
      }
      if (!before) {
        page = await launch();
        await submit('Hafen');
        await page
          .locator('#desk-results')
          .getByRole('button', { name: 'NPC · Hafen 00', exact: true })
          .click();
        assert.equal(await page.getByLabel('Szenentisch-Titel', { exact: true }).inputValue(), '');
        assert.equal(
          await page.locator('#desk-fields').getByLabel('GM-Notizen', { exact: true }).inputValue(),
          'Unfertige Hafen-Notiz',
        );
        await close();
        results.nativeDraftRestart = true;
      }
      await native.recordResult({ results, launches, normalClose: true });
      console.log(JSON.stringify({ results, normalClose: true }));
      assert.equal(
        results.afterQueryChange.count,
        0,
        'Changing a query must invalidate the previous result page',
      );
      assert.equal(results.afterQueryChange.moreVisible, false);
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
