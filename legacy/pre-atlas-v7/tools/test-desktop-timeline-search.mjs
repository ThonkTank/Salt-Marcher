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
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/timeline-search-evidence');
await runNativeProbe(
  { output: output, name: 'timeline-search', resultName: 'timeline-search-' + phase + '.json' },
  async (native) => {
    const group = await currentProcessGroup();
    await mkdir(output, { recursive: true });
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/timeline-native-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/timeline-native-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      store = new CampaignStore(file),
      campaign = store.create('Den richtigen Besuch wiederfinden'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      });
    const visits = Array.from({ length: 65 }, (_, i) => ({
        id: randomUUID(),
        title: 'Hafenbesuch',
        notes:
          i === 63
            ? '  Kupfersiegel\r\n- Die Mühle erneut besuchen'
            : '  Original ' + i + '\r\n- Unverändert',
        locationId: null,
      })),
      plan = { version: 1, id: randomUUID(), revision: 1, name: 'Spuren am Hafen', scenes: visits };
    store.changePreparation({
      ...command(null),
      change: { kind: 'plan', expectedRevision: null, plan },
    });
    const initial = store.preparation(w.token, '').plans.find((p) => p.id === plan.id);
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
      await page.locator('#preparation-tab').click();
      await page.locator('#preparation-planning').click();
      await page.locator('#plans').selectOption(plan.id);
      await page.waitForFunction(
        () => document.querySelectorAll('#scene-list button').length === 65,
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
      results.totalVisits = await page.locator('#scene-list button').count();
      results.hasTimelineSearch = (await page.locator('#scene-search').count()) > 0;
      if (before) {
        let openings = 1;
        for (let i = 1; i < visits.length; i++) {
          await page
            .locator('#scene-list')
            .getByRole('button', { name: i + 1 + '. Hafenbesuch', exact: true })
            .click();
          await page.waitForFunction(
            (notes) => document.querySelector('#scene-notes').value === notes,
            visits[i].notes.replace(/\r\n/g, '\n'),
          );
          openings++;
          if ((await page.locator('#scene-notes').inputValue()).includes('Kupfersiegel')) break;
        }
        results.editorOpeningsToFindHint = openings;
      } else {
        await page.locator('#scene-notes').fill('  Eigene Erstnotiz\n- Noch offen');
        await page.locator('#scene-search').fill('kupfersiegel MÜHLE');
        await page.waitForFunction(
          () => document.querySelectorAll('#scene-list button').length === 1,
        );
        assert.equal(
          await page.locator('#scene-notes').inputValue(),
          '  Eigene Erstnotiz\n- Noch offen',
        );
        results.selectedDraftKeptWhileFiltering = true;
        await page.locator('#scene-list button').click();
        await page.waitForFunction(() =>
          document.querySelector('#scene-notes').value.includes('Kupfersiegel'),
        );
        results.editorOpeningsToFindHint = 1;
        await page.locator('#scene-search').fill('Unauffindbar');
        await page.waitForFunction(
          () => document.querySelectorAll('#scene-list button').length === 0,
        );
        assert((await page.locator('#scene-notes').inputValue()).includes('Kupfersiegel'));
        results.noHitsKeepsEditor = true;
        await page.locator('#scene-search').fill('kupfersiegel');
        await page.locator('#scene-up').click();
        await page.waitForFunction(
          () => document.querySelector('#scene-list button')?.textContent === '63. Hafenbesuch',
        );
        results.filteredMoveUsesFullOrder = true;
        await page.locator('#scene-add').click();
        await page.waitForFunction(
          () => document.querySelector('#scene-title').value === 'Neue Szene',
        );
        assert.equal(await page.locator('#scene-search').inputValue(), '');
        assert.equal(await page.locator('#scene-list button').count(), 66);
        await page.locator('#scene-remove').click();
        await page.waitForFunction(
          () => document.querySelectorAll('#scene-list button').length === 65,
        );
        await page.locator('#scene-search').fill('Kupfersiegel');
        await page.locator('#scene-list button').click();
        await page.waitForFunction(() =>
          document.querySelector('#scene-notes').value.includes('Kupfersiegel'),
        );
        await page.locator('#scene-search').scrollIntoViewIfNeeded();
      }
      await page.screenshot({ path: path.join(output, 'timeline-search-' + phase + '.png') });
      await close();
      const fresh = new CampaignStore(file);
      try {
        const active = fresh.activate(campaign.id),
          saved = fresh.preparation(active.token, '').plans.find((p) => p.id === plan.id);
        assert.equal(saved.scenes.length, 65);
        if (!before) {
          const expected = initial.scenes.map((s) => s.id);
          [expected[62], expected[63]] = [expected[63], expected[62]];
          assert.deepEqual(
            saved.scenes.map((s) => s.id),
            expected,
          );
          assert.equal(
            saved.scenes.find((s) => s.id === visits[0].id).notes,
            '  Eigene Erstnotiz\n- Noch offen',
          );
          for (const visit of visits.slice(1))
            assert.equal(saved.scenes.find((s) => s.id === visit.id).notes, visit.notes);
          results.otherProseAndIdsPreserved = true;
        } else assert.deepEqual(saved, initial);
        const live = fresh.live(active.token);
        assert.equal(live.roster.length, 0);
        assert.equal(live.scenes.length, 0);
        results.noRuntimeOrPartyCreated = true;
      } finally {
        fresh.close();
      }
      if (!before) {
        page = await launch();
        assert.equal(await page.locator('#scene-search').inputValue(), '');
        await page.locator('#scene-search').fill('Kupfersiegel');
        await page.waitForFunction(
          () => document.querySelectorAll('#scene-list button').length === 1,
        );
        await page.locator('#scene-list button').click();
        await page.waitForFunction(() =>
          document.querySelector('#scene-notes').value.includes('Kupfersiegel'),
        );
        await page.locator('#scene-adopt').click();
        await page.locator('#live-continue').click();
        await page.locator('#running-editor').waitFor({ state: 'visible' });
        if (!(await page.locator('#adoption-plan').isVisible()))
          await page.locator('#adoption-picker summary').click();
        await page.locator('#adoption-plan').selectOption(plan.id);
        await page.locator('#adoption-visit').selectOption(visits[63].id);
        await page.locator('#adoption-preview').click();
        await page.locator('#adoption-dialog').waitFor();
        assert((await page.locator('#adoption-content').innerText()).includes('Kupfersiegel'));
        await page.locator('#adoption-confirm').click();
        await page.waitForFunction(() =>
          document.querySelector('#running-notes').value.includes('Kupfersiegel'),
        );
        await page.locator('#running-notes').fill('Am Spieltisch: Kupfersiegel entdeckt.');
        await page.locator('#preparation-tab').click();
        await page.locator('#preparation-planning').click();
        await page.locator('#scene-search').fill('Kupfersiegel');
        await page.locator('#scene-list button').click();
        await page.waitForFunction(() =>
          document.querySelector('#scene-notes').value.includes('Die Mühle erneut besuchen'),
        );
        await close();
        results.nativeRestart = true;
        const final = new CampaignStore(file);
        try {
          const active = final.activate(campaign.id),
            live = final.live(active.token),
            saved = final.preparation(active.token, '').plans.find((p) => p.id === plan.id);
          assert.equal(live.scene.adoption.visitId, visits[63].id);
          assert.equal(live.scene.notes, 'Am Spieltisch: Kupfersiegel entdeckt.');
          assert.equal(live.roster.length, 0);
          assert.equal(saved.scenes.find((s) => s.id === visits[63].id).notes, visits[63].notes);
          assert.equal(saved.scenes.length, 65);
          results.explicitAdoptionAndIndependentLiveNotes = true;
        } finally {
          final.close();
        }
      }
      await native.recordResult({ results, launches, normalClose: true });
      console.log(JSON.stringify({ results, normalClose: true }));
      assert.equal(
        results.hasTimelineSearch,
        true,
        'A note-only timeline clue must be findable without opening visits one by one',
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
