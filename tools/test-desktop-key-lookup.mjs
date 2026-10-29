import { openDesktopKeyRoomBrowser } from './qa-key-entry.mjs';
import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { openDesktopKeyFromAtlas } from './qa-key-entry.mjs';
import { currentProcessGroup } from './process-group.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

const source = process.cwd(),
  before = process.argv.includes('--before'),
  phase = before ? 'before' : 'after';
const output =
  process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/key-lookup-evidence', phase);
await runNativeProbe(
  { output: output, name: 'key-lookup', resultName: 'result.json' },
  async (native) => {
    await mkdir(output, { recursive: true });
    const artifactHashes = {};
    for (const relative of [
      'main.cjs',
      'preload.cjs',
      'ui/renderer.js',
      'ui/index.html',
      'ui/app.css',
    ])
      artifactHashes[relative] = createHash('sha256')
        .update(await readFile(path.join('.build/desktop', relative)))
        .digest('hex');
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/key-lookup-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/key-lookup-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite';
    const room = (number, name, x) => ({
      id: randomUUID(),
      scopeId: 'local',
      floorId: 'ground',
      number,
      name,
      revision: 0,
      polygons: [
        {
          outer: [
            { x, y: 0 },
            { x: x + 9.144, y: 0 },
            { x: x + 9.144, y: 6.096 },
            { x, y: 6.096 },
          ],
          holes: [],
        },
      ],
      sections: [
        {
          id: randomUUID(),
          kind: 'markdown',
          markdown: 'Original ' + name + '\r\n  Unveränderter Raumtext.\r\n',
        },
      ],
    });
    const rooms = [room('1', 'Wachstube', 0), room('2', 'Archiv', 12), room('3', 'Schlafsaal', 24)],
      store = new CampaignStore(file),
      campaign = store.create('Schlüssel in der alten Garnison', rooms),
      w = store.activate(campaign.id);
    const command = (action) => ({
      campaignId: campaign.id,
      token: w.token,
      commandId: randomUUID(),
      action,
    });
    const block = (kind, text = '', extra = {}) => ({
      id: randomUUID(),
      kind,
      visibility: 'gm',
      text,
      templateId: null,
      suppressed: [],
      searchMethod: '',
      dc: null,
      discoveryNotes: '',
      revealedText: '',
      ...extra,
    });
    const templateId = randomUUID(),
      npcId = randomUUID();
    store.changePreparation({
      ...command(null),
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id: npcId,
          revision: 1,
          kind: 'npc',
          title: 'Nera die Quartiermeisterin',
          readAloud: 'Eine erschöpfte Wächterin.',
          gmNotes: 'Nera hat den Schlüssel versteckt.',
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
    store.executeDrawing(
      command({
        kind: 'key-content',
        content: {
          id: templateId,
          revision: 0,
          scopeId: 'local',
          kind: 'template',
          name: 'Wachposten',
          levelId: null,
          groupId: null,
          zSteps: [],
          attributes: {},
          blocks: [block('text', 'Ein Bronzeschlüssel liegt in der Schublade.')],
          tags: [],
          secret: false,
          status: '',
          references: [],
        },
        expectedRevision: null,
      }),
    );
    store.executeDrawing(
      command({
        kind: 'key-batch',
        rooms: [{ id: rooms[0].id, expectedRevision: 0, keyRevision: null }],
        patch: {
          blocks: [
            block('text', 'Die Wand ist feucht.', { visibility: 'public' }),
            block('template', '', { templateId }),
          ],
          references: [{ kind: 'npc', id: npcId, label: 'Nera die Quartiermeisterin' }],
        },
      }),
    );
    store.executeDrawing(
      command({
        kind: 'key-batch',
        rooms: [{ id: rooms[1].id, expectedRevision: 0, keyRevision: null }],
        patch: { gmNotes: { mode: 'replace', text: 'Ein Silberschlüssel hängt am Haken.' } },
      }),
    );
    const originalKeys = store.drawing(w.token).keyContent;
    store.close();

    let app,
      closed = true;
    const errors = [],
      launches = [],
      results = {};
    async function launch() {
      app = await native.launchConfigured({
        executablePath: source + '/node_modules/electron/dist/electron',
        args: [source + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
        timeout: 25000,
      });
      closed = false;
      const pid = app.process().pid;
      launches.push({
        pid,
        group: (await readFile(`/proc/${pid}/cgroup`, 'utf8')).trim(),
        driverGroup: await currentProcessGroup(),
      });
      assert.equal(launches.at(-1).group.slice(3), launches.at(-1).driverGroup);
      const page = await app.firstWindow();
      page.on('pageerror', (e) => errors.push(e.stack));
      page.setDefaultTimeout(10000);
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
      await page.locator('#atlas-tab').click();
      await openDesktopKeyFromAtlas(page, 'Wachstube');
      await openDesktopKeyRoomBrowser(page);
      await page.locator('#key-dialog').waitFor({ state: 'visible' });
      return page;
    }
    async function close() {
      const exited = new Promise((resolve) =>
        app.process().once('exit', (code, signal) => resolve({ code, signal })),
      );
      await native.close();
      const receipt = await exited;
      assert.deepEqual(receipt, { code: 0, signal: null });
      launches.at(-1).exit = receipt;
      closed = true;
    }
    async function search(page, query) {
      await page.locator('#key-search').fill(query);
      return await page.locator('#key-room-list button').allTextContents();
    }
    try {
      let page = await launch();
      results.direct = await search(page, 'Silberschlüssel');
      assert(results.direct.some((s) => s.includes('Archiv')));
      await search(page, '');
      await page.locator('#key-room-list button').filter({ hasText: 'Wachstube' }).click();
      await page
        .locator('#key-dialog summary')
        .filter({ hasText: 'Beschreibungsvorschau' })
        .click();
      results.rendered = await page.locator('#key-rendered').innerText();
      assert(results.rendered.includes('Bronzeschlüssel'));
      results.template = await search(page, 'Bronzeschlüssel');
      await page.screenshot({ path: path.join(output, 'template-search.png') });
      results.reference = await search(page, 'Nera');
      await page.screenshot({ path: path.join(output, 'reference-search.png') });
      if (!before) {
        assert.equal(results.template.length, 1);
        assert(results.template[0].includes('Wachstube'));
        assert.equal(results.reference.length, 1);
        assert(results.reference[0].includes('Wachstube'));
        await search(page, 'Bronzeschlüssel');
        await page.locator('#key-search').press('Enter');
        assert.equal(await page.locator('#key-name').inputValue(), 'Wachstube');
        assert((await page.locator('#key-rendered').innerText()).includes('Bronzeschlüssel'));
        results.enterOpensRoom = true;
        results.templateSnippet = await page.locator('#key-room-list .key-search-hit').innerText();
        assert(results.templateSnippet.includes('Vorlage · Wachposten'));
        await search(page, 'Nera');
        results.referenceSnippet = await page.locator('#key-room-list .key-search-hit').innerText();
        assert(results.referenceSnippet.includes('Verweis: Nera die Quartiermeisterin'));
        await page.locator('#key-close').click();
        await page.locator('#dungeon-binder-open').click();
        await page.locator('#dungeon-binder-search').fill('Bronzeschlüssel');
        await page.waitForFunction(
          () => document.querySelectorAll('#dungeon-binder-list button').length === 1,
        );
        results.existingBinderTemplate = await page
          .locator('#dungeon-binder-list button')
          .allTextContents();
        assert(results.existingBinderTemplate[0].includes('Wachstube'));
        await page.locator('#dungeon-binder-search').fill('KeinRaumMitDiesemWort');
        await page.waitForFunction(
          () => document.querySelectorAll('#dungeon-binder-list button').length === 0,
        );
        await page.locator('#dungeon-binder-search').fill('Nera');
        await page.waitForFunction(
          () => document.querySelectorAll('#dungeon-binder-list button').length === 1,
        );
        results.existingBinderReference = await page
          .locator('#dungeon-binder-list button')
          .allTextContents();
        assert(results.existingBinderReference[0].includes('Wachstube'));
        await page
          .locator('#dungeon-binder')
          .getByRole('button', { name: 'Schließen', exact: true })
          .click();
      }
      await close();
      const fresh = new CampaignStore(file);
      try {
        const active = fresh.activate(campaign.id);
        assert.deepEqual(fresh.drawing(active.token).keyContent, originalKeys);
        results.sourceRecordsUnchanged = true;
      } finally {
        fresh.close();
      }
      if (!before) {
        page = await launch();
        assert.equal((await search(page, 'Bronzeschlüssel')).length, 1);
        results.nativeRestart = true;
        await page.locator('#key-owner').selectOption(templateId);
        await page.waitForFunction(
          () => document.querySelector('#key-name').value === 'Wachposten',
        );
        await page.locator('#key-gm-notes').fill('Ein Eisenschlüssel liegt in der Schublade.');
        await page.waitForFunction(
          () => document.querySelector('#key-save-status').dataset.state === 'saved',
        );
        assert.equal((await search(page, 'Bronzeschlüssel')).length, 0);
        assert.equal((await search(page, 'Eisenschlüssel')).length, 1);
        results.templateUpdateRefreshesSearch = true;
        await page.locator('#key-search').press('Enter');
        await page.waitForFunction(() => document.querySelector('#key-name').value === 'Wachstube');
        await page.locator('#key-room-list').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'updated-template-search.png') });
        await close();
        page = await launch();
        assert.equal((await search(page, 'Eisenschlüssel')).length, 1);
        assert.equal((await search(page, 'Bronzeschlüssel')).length, 0);
        await close();
        results.updatedTemplateSurvivesRestart = true;
        const checked = new CampaignStore(file);
        try {
          const current = checked.activate(campaign.id),
            keys = checked.drawing(current.token).keyContent;
          assert.equal(
            keys.find((k) => k.id === templateId).blocks[0].text,
            'Ein Eisenschlüssel liegt in der Schublade.',
          );
          assert.deepEqual(
            keys.filter((k) => k.id !== templateId),
            originalKeys.filter((k) => k.id !== templateId),
          );
          assert.deepEqual(
            checked.workspace().rooms.map((r) => r.sections),
            rooms.map((r) => r.sections),
          );
          results.onlyAuthoredTemplateChanged = true;
        } finally {
          checked.close();
        }
      }
      assert.deepEqual(errors, []);
      await native.recordResult({
        phase,
        profile,
        results,
        errors,
        launches,
        normalClose: closed,
        artifactHashes,
      });
      console.log(JSON.stringify({ phase, results, normalClose: closed }));
    } catch (error) {
      await writeFile(
        path.join(output, 'failure.json'),
        JSON.stringify({ error: error.stack, results, launches, errors }, null, 2),
      );
      if (app && !closed)
        try {
          await (await app.firstWindow()).screenshot({ path: path.join(output, 'failure.png') });
        } catch {}
      throw error;
    } finally {
    }
  },
);
