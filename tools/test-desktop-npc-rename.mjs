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
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/npc-rename-evidence');
await runNativeProbe(
  { output: output, name: 'npc-rename', resultName: 'npc-rename-' + phase + '.json' },
  async (native) => {
    const group = await currentProcessGroup();
    await mkdir(output, { recursive: true });
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/desktop/npc-rename-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/desktop/npc-rename-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      store = new CampaignStore(file),
      campaign = store.create('Derselbe NSC nach einer Umbenennung'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        action,
      });
    const id = randomUUID(),
      npc = store.executeNpc({
        commandId: randomUUID(),
        token: w.token,
        campaignId: campaign.id,
        expectedNoteRevision: null,
        expectedRecordRevision: 0,
        expectedActorRevision: null,
        expectedPositionRevision: null,
        npc: {
          id,
          name: 'Späher Borin',
          creatureId: 'goblin',
          readAloud: '  Ein ruhiger Blick.\r\n- Reisemantel',
          gmNotes: '  Kennt den Fluchtweg.\r\n- Ring behalten',
          record: {
            id,
            revision: 0,
            factionId: null,
            modifier: 0,
            lifecycle: 'active',
            appearance: '',
            behavior: '',
            history: '',
          },
          locationId: null,
          health: { hp: 6, maxHp: 7, tempHp: 2, conditions: 'vergiftet', concentrating: true },
        },
      });
    const scene = store.executeLive(
        command({ kind: 'initialize', expectedRosterRevision: 0 }),
      ).scene,
      combats = [];
    for (const title of ['Gestern', 'Torwache', 'Hinterhalt']) {
      let c = store.executeCombat({
        ...command({
          kind: 'create',
          sceneId: scene.id,
          title,
          includeParty: false,
          expectedMembershipRevision: scene.membershipRevision,
        }),
        combatId: null,
        expectedRevision: null,
      }).combat;
      let n = store.npc(w.token, id);
      c = store.executeCombat({
        ...command({
          kind: 'add-world-actor',
          actorId: id,
          expectedActorRevision: n.actorRevision,
          expectedRecordRevision: n.record.revision,
        }),
        combatId: c.id,
        expectedRevision: c.revision,
      }).combat;
      c = store.executeCombat({
        ...command({ kind: 'notes', title, notes: '  Original: ' + title + '\r\n- GM-Geheimnis' }),
        combatId: c.id,
        expectedRevision: c.revision,
      }).combat;
      if (title === 'Gestern')
        c = store.executeCombat({
          ...command({ kind: 'finish', outcome: 'Unverändert abgeschlossen' }),
          combatId: c.id,
          expectedRevision: c.revision,
        }).combat;
      combats.push(c);
    }
    const historical = store.db
      .prepare('SELECT payload,checksum FROM combat WHERE id=?')
      .get(combats[0].id);
    store.close();
    const renamed = 'Borin Nachtwache';

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
      await page.waitForFunction(() => document.querySelectorAll('#npc-list button').length === 1);
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
      await page.locator('#npc-list button').click();
      await page.waitForFunction(
        (name) => document.querySelector('#npc-name').value === name,
        npc.name,
      );
      await page.locator('#npc-name').fill(renamed);
      await page
        .locator('#npc-editor')
        .getByRole('button', { name: 'NPC übernehmen', exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector('#npc-save-status').textContent === 'Gespeicherter Stand.',
      );
      assert.equal(await page.locator('#npc-name').inputValue(), renamed);
      await page.locator('#live-tab').click();
      if (await page.locator('#live-continue').isVisible())
        await page.locator('#live-continue').click();
      await page.locator('#scene-desk').waitFor({ state: 'visible' });
      await page.locator('#combat-panel').waitFor({ state: 'visible' });
      results.encounters = [];
      for (const c of combats.slice(1)) {
        await page.locator('#combat-history').selectOption(c.id);
        await page.waitForFunction(
          (title) => document.querySelector('#combat-title').textContent === title,
          c.title,
        );
        const labels = await page.locator('#combat-rows button').allTextContents();
        results.encounters.push({ title: c.title, labels });
        if (!before) assert(labels.some((label) => label.startsWith(renamed + ' ·')));
      }
      await page.locator('#combat-rows').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, 'npc-rename-' + phase + '.png') });
      if (!before) {
        await page
          .locator('#combat-rows')
          .getByRole('button', { name: new RegExp('^' + renamed + ' ·') })
          .click();
        assert.equal(await page.locator('#fighter-hp').inputValue(), '6');
        assert.equal(await page.locator('#fighter-temp-hp').inputValue(), '2');
        await page.locator('#fighter-amount').fill('3');
        await page.locator('#fighter-damage').click();
        await page.waitForFunction(() => document.querySelector('#fighter-hp').value === '5');
        results.damageStillUsesSameNpc = true;
      }
      await close();
      const fresh = new CampaignStore(file);
      try {
        const active = fresh.activate(campaign.id),
          current = fresh.npc(active.token, id);
        assert.equal(current.name, renamed);
        assert.equal(current.readAloud, npc.readAloud);
        assert.equal(current.gmNotes, npc.gmNotes);
        assert.deepEqual(
          fresh.db.prepare('SELECT payload,checksum FROM combat WHERE id=?').get(combats[0].id),
          historical,
        );
        for (const c of combats.slice(1)) {
          const p = fresh.combat(active.token, scene.id, c.id).combat.participants[0];
          assert.equal(p.worldActorId, id);
          assert.equal(p.hp, before ? 6 : 5);
          assert.equal(p.tempHp, before ? 2 : 0);
          assert.equal(p.conditions, 'vergiftet');
          assert.equal(p.concentrating, true);
          if (!before) assert.equal(p.name, renamed);
        }
        results.exactProseAndHistoricalBytesPreserved = true;
        results.sameNpcAndHealthFresh = true;
      } finally {
        fresh.close();
      }
      if (!before) {
        page = await launch();
        await page.locator('#npc-list button').click();
        await page.waitForFunction(
          (name) => document.querySelector('#npc-name').value === name,
          renamed,
        );
        assert.equal(await page.locator('#npc-hp').inputValue(), '5');
        await page.locator('#live-tab').click();
        if (await page.locator('#live-continue').isVisible())
          await page.locator('#live-continue').click();
        await page.locator('#scene-desk').waitFor({ state: 'visible' });
        await page
          .locator('#combat-rows')
          .getByRole('button', { name: new RegExp('^' + renamed + ' ·') })
          .waitFor();
        await close();
        results.nativeRestart = true;
      }
      await native.recordResult({ results, launches, normalClose: true });
      console.log(JSON.stringify({ results, normalClose: true }));
      assert(
        results.encounters.every((c) => c.labels.some((label) => label.startsWith(renamed + ' ·'))),
        'Open encounters must show the NPC name the GM just saved',
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
