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
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/npc-search-evidence');
await runNativeProbe(
  { output: output, name: 'npc-search', resultName: 'npc-search-' + phase + '.json' },
  async (native) => {
    const group = await currentProcessGroup();
    await mkdir(output, { recursive: true });
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/desktop/npc-search-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/desktop/npc-search-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      store = new CampaignStore(file),
      campaign = store.create('NSCs im Spiel wiederfinden'),
      w = store.activate(campaign.id),
      npcs = [];
    for (const prefix of ['Hafen', 'Wald'])
      for (let i = 0; i < 65; i++) {
        const id = randomUUID(),
          name = prefix + ' ' + String(i).padStart(2, '0');
        npcs.push(
          store.executeNpc({
            commandId: randomUUID(),
            campaignId: campaign.id,
            token: w.token,
            expectedNoteRevision: null,
            expectedRecordRevision: 0,
            expectedActorRevision: null,
            expectedPositionRevision: null,
            npc: {
              id,
              name,
              creatureId: null,
              readAloud: '  Beschreibung ' + name + '\r\n- Reisemantel',
              gmNotes:
                prefix === 'Wald' && i === 63 ? 'Er besitzt den Zinnschlüssel.' : 'Notiz ' + name,
              record: {
                id,
                revision: 0,
                factionId: null,
                modifier: 0,
                lifecycle: i === 64 ? 'defeated' : 'active',
                appearance: '',
                behavior: '',
                history: '',
              },
              locationId: null,
              health: null,
            },
          }),
        );
      }
    const a = npcs[0],
      originals = {
        notes: store.db.prepare('SELECT id,payload,checksum FROM world_note ORDER BY id').all(),
        records: store.db.prepare('SELECT id,payload,checksum FROM npc_record ORDER BY id').all(),
      };
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
      await page.waitForFunction(() => document.querySelectorAll('#npc-list button').length === 50);
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
      const submit = async (text, count) => {
        await page.locator('#npc-search').fill(text);
        await page
          .locator('#npc-search-form')
          .getByRole('button', { name: 'Suchen', exact: true })
          .click();
        await page.waitForFunction(
          (n) => document.querySelectorAll('#npc-list button').length === n,
          count,
        );
      };
      await submit('Hafen', 50);
      await page.locator('#npc-list button').first().click();
      await page.waitForFunction(
        (name) => document.querySelector('#npc-name').value === name,
        a.name,
      );
      await page.locator('#npc-name').fill('');
      await page.locator('#npc-gmNotes').fill('Unfertiger Hinweis: rotes Segel');
      await page.waitForFunction(() =>
        document.querySelector('#npc-save-status').textContent.includes('Entwurf gesichert'),
      );
      await page.locator('#npc-search').fill('Wald');
      results.queryChange = {
        count: await page.locator('#npc-list button').count(),
        moreEnabled: await page.locator('#npc-more').isEnabled(),
      };
      if (before) {
        await page.locator('#npc-more').click();
        await page.waitForFunction(() =>
          document.querySelector('#npc-page').textContent.startsWith('51–'),
        );
        results.afterWrongPage = {
          labels: await page.locator('#npc-list button').allTextContents(),
          page: await page.locator('#npc-page').innerText(),
        };
        await submit('Zinnschlüssel', 0);
        results.noteSearchCount = await page.locator('#npc-list button').count();
      } else {
        assert.equal(results.queryChange.count, 0);
        assert.equal(results.queryChange.moreEnabled, false);
        await page.waitForFunction(
          () =>
            document.querySelectorAll('#npc-list button').length === 50 &&
            [...document.querySelectorAll('#npc-list button')].every((b) =>
              b.textContent.startsWith('Wald '),
            ),
        );
        const titles = await page.locator('#npc-list button').allTextContents();
        await page.locator('#npc-more').click();
        await page.waitForFunction(() =>
          document.querySelector('#npc-page').textContent.startsWith('51–'),
        );
        titles.push(...(await page.locator('#npc-list button').allTextContents()));
        assert.equal(titles.length, 65);
        assert.equal(new Set(titles).size, 65);
        assert(titles.some((t) => t.startsWith('Wald 00')));
        assert(titles.some((t) => t.startsWith('Wald 64')));
        await page.locator('#npc-previous').click();
        await page.waitForFunction(() =>
          document.querySelector('#npc-page').textContent.startsWith('1–'),
        );
        results.completeWaldPaging = true;
        await app.evaluate(({ ipcMain }) => {
          const original = ipcMain._invokeHandlers.get('campaign:npcs');
          let fail = true;
          globalThis.qaNpcPageOffsets = [];
          ipcMain.removeHandler('campaign:npcs');
          ipcMain.handle('campaign:npcs', async (e, ...args) => {
            globalThis.qaNpcPageOffsets.push(args[1].offset);
            if (fail && args[1].offset === 50) {
              fail = false;
              return { ok: false, error: 'QA: NSC-Seite vorübergehend nicht lesbar' };
            }
            return original(e, ...args);
          });
        });
        await page.locator('#npc-more').click();
        await page.locator('#npc-list-status[role=alert]').waitFor();
        await page.locator('#npc-list-status').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'npc-search-error.png') });
        await page.locator('#npc-list-retry').click();
        await page.waitForFunction(() =>
          document.querySelector('#npc-page').textContent.startsWith('51–'),
        );
        assert.deepEqual(
          (await app.evaluate(() => globalThis.qaNpcPageOffsets)).slice(-2),
          [50, 50],
        );
        results.retryDoesNotSkipPage = true;
        assert.equal(await page.locator('#npc-list-status').isVisible(), false);
        assert(!(await page.locator('#status').innerText()).includes('QA: NSC-Seite'));
        results.localErrorRecovered = true;
        await submit('Zinnschlüssel', 1);
        assert((await page.locator('#npc-list button').innerText()).startsWith('Wald 63'));
        results.noteSearchCount = 1;
        await page.locator('#npc-filter-life').selectOption('defeated');
        await page.waitForFunction(
          () => document.querySelector('#npc-page').textContent === 'Keine passenden NSCs.',
        );
        await page.locator('#npc-filter-life').selectOption('all');
        await page.waitForFunction(
          () => document.querySelectorAll('#npc-list button').length === 1,
        );
        results.filtersApply = true;
        assert.equal(await page.locator('#npc-name').inputValue(), '');
        assert.equal(
          await page.locator('#npc-gmNotes').inputValue(),
          'Unfertiger Hinweis: rotes Segel',
        );
        results.incompleteDraftPreserved = true;
      }
      await page.locator('#npc-search').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, 'npc-search-' + phase + '.png') });
      await close();
      const fresh = new CampaignStore(file);
      try {
        const active = fresh.activate(campaign.id);
        assert.deepEqual(
          {
            notes: fresh.db.prepare('SELECT id,payload,checksum FROM world_note ORDER BY id').all(),
            records: fresh.db
              .prepare('SELECT id,payload,checksum FROM npc_record ORDER BY id')
              .all(),
          },
          originals,
        );
        const draft = fresh.npcDraft(active.token, a.id);
        assert.equal(draft.fields.name, '');
        assert.equal(draft.fields.gmNotes, 'Unfertiger Hinweis: rotes Segel');
        results.sourceBytesUnchanged = true;
      } finally {
        fresh.close();
      }
      if (!before) {
        page = await launch();
        await page
          .locator('#npc-list')
          .getByRole('button', { name: new RegExp('^' + a.name + ' ·') })
          .click();
        await page.waitForFunction(
          () =>
            document.querySelector('#npc-name').value === '' &&
            !document.querySelector('#npc-name').disabled,
        );
        assert.equal(
          await page.locator('#npc-gmNotes').inputValue(),
          'Unfertiger Hinweis: rotes Segel',
        );
        await close();
        results.nativeDraftRestart = true;
      }
      await native.recordResult({ results, launches, normalClose: true });
      console.log(JSON.stringify({ results, normalClose: true }));
      assert.equal(results.queryChange.count, 0, 'A new NPC query must invalidate the old page');
      assert.equal(results.noteSearchCount, 1, 'NPC search must find a clue in GM notes');
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
