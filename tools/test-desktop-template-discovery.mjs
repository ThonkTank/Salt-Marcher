import { openNativeCampaign } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { currentProcessGroup } from './process-group.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
// Record process ownership before launching native children.
const ownGroup = await currentProcessGroup();
const root = process.env.QA_EVIDENCE_DIR ?? process.cwd() + '/.build/template-discovery-evidence',
  after = true,
  snapshot = process.cwd(),
  require = createRequire(snapshot + '/package.json');
const { _electron } = require('playwright-core');
await runNativeProbe(
  { output: root, name: 'template-discovery', resultName: 'gm-template-secrets-after.json' },
  async (native) => {
    require('esbuild').buildSync({
      entryPoints: [snapshot + '/src/app/storage/store.ts'],
      outfile: snapshot + '/.build/withdraw-native-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(snapshot + '/.build/withdraw-native-store.cjs');
    await import('node:fs/promises').then((fs) => fs.mkdir(root, { recursive: true }));
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
          markdown: 'Original ' + name + '\r\n  Geschützter Absatz.\r\n',
        },
      ],
    });
    const first = room('1', 'Wachstube', 0),
      second = room('2', 'Echohalle', 9.144);
    const profile = native.profile,
      filename = profile + '/workbench.sqlite',
      store = new CampaignStore(filename),
      campaign = store.create('GM Raumtexte', [first, second]),
      w = store.activate(campaign.id),
      command = (action) => ({
        campaignId: campaign.id,
        token: w.token,
        commandId: randomUUID(),
        action,
      }),
      live = (a) => store.executeLive(command(a));
    // Fixture authored through public Core while the app is closed; all combat actions below are native UI actions.
    const c = live({ kind: 'create-character', profile: { name: 'Nera' } }).character;
    live({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision });
    let v = store.live(w.token);
    live({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: v.rosterRevision,
      active: true,
      targetSceneId: v.focusId,
      expectedFocusRevision: v.focusRevision,
    });
    store.executeProgress(
      command({
        kind: 'health',
        characterId: c.id,
        expectedRevision: store.progress(w.token).characters[0].revision,
        operation: 'set',
        health: { hp: 12, maxHp: 20, tempHp: 3, conditions: 'Vergiftet', concentrating: false },
        reason: 'Ausgangsstand',
      }),
    );
    store.executeDrawing(
      command({
        kind: 'key-batch',
        rooms: [{ id: first.id, expectedRevision: 0, keyRevision: null }],
        patch: {
          readAloud: { mode: 'replace', text: 'Die Bronzetür summt leise.' },
          gmNotes: { mode: 'replace', text: 'GM geheim: Wächter flieht vor Gold.' },
        },
      }),
    );
    const block = (text, visibility, extra = {}) => ({
      id: randomUUID(),
      kind: 'text',
      visibility,
      text,
      templateId: null,
      suppressed: [],
      searchMethod: 'Genau untersuchen',
      dc: 12,
      discoveryNotes: 'Privater GM-Hinweis',
      revealedText: text,
      ...extra,
    });
    const templateId = randomUUID(),
      keyLink1 = randomUUID(),
      keyLink2 = randomUUID();
    const template = {
      id: templateId,
      revision: 0,
      scopeId: 'local',
      kind: 'template',
      name: 'Wachposten-Geheimnisse',
      levelId: null,
      groupId: null,
      zSteps: [],
      attributes: {},
      blocks: [
        block('Ein Bronzeschlüssel liegt in der Schublade.', 'secret'),
        block('Eine versteckte Fallentür führt in den Keller.', 'secret'),
        block('GM-Code: 88.', 'gm'),
      ],
      tags: [],
      secret: false,
      status: '',
      references: [],
    };
    store.executeDrawing(
      command({ kind: 'key-content', content: template, expectedRevision: null }),
    );
    for (const [r, id] of [
      [first, keyLink1],
      [second, keyLink2],
    ]) {
      const current = store.workspace().rooms.find((x) => x.id === r.id),
        old = store.drawing(w.token).keyContent.find((k) => k.id === r.id),
        link = { ...block('', 'public'), id, kind: 'template', templateId };
      store.executeDrawing(
        command({
          kind: 'key-batch',
          rooms: [
            { id: r.id, expectedRevision: current.revision, keyRevision: old?.revision ?? null },
          ],
          patch: { blocks: [...(old?.blocks ?? []), link] },
        }),
      );
    }
    store.close();
    let app,
      pid,
      scope,
      closedNormally = false;
    const results = [],
      errors = [],
      launches = [];
    async function launch() {
      closedNormally = false;
      app = await native.launchConfigured({
        executablePath: snapshot + '/node_modules/electron/dist/electron',
        args: [snapshot + '/.build/desktop/main.cjs', '--data-dir', profile],
        timeout: 20000,
      });
      pid = app.process().pid;
      const args = await readFile(`/proc/${pid}/cmdline`, 'utf8');
      assert(args.includes(snapshot) && args.includes(profile));
      const nativeGroup = (await readFile(`/proc/${pid}/cgroup`, 'utf8')).trim();
      scope = nativeGroup.split('/').at(-1);
      console.log(
        JSON.stringify({ nativeGroup, driverGroup: await readFile('/proc/self/cgroup', 'utf8') }),
      );
      assert.equal(
        nativeGroup.split('::')[1],
        ownGroup,
        'Native process must remain in the recorded process group',
      );
      launches.push({ pid, scope });
      console.log(JSON.stringify({ ownedNative: { pid, scope, snapshot, profile } }));
      const page = await app.firstWindow();
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true', null, {
        timeout: 20000,
      });
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await openNativeCampaign(page, campaign.id);
      await page.locator('#live-tab').click();
      await page.locator('#live-continue').click();
      await page.locator('#running-editor').waitFor({ state: 'visible' });
      return page;
    }
    async function close(page) {
      assert.deepEqual(errors, []);
      assert.deepEqual(await page.pageErrors(), []);
      const closed = new Promise((r) => app.once('close', r)),
        exited = new Promise((r) =>
          app.process().once('exit', (code, signal) => r({ code, signal })),
        );
      await native.close();
      await closed;
      assert.deepEqual(await exited, { code: 0, signal: null });
      closedNormally = true;
    }

    async function showPlayers(page) {
      await page.locator('#player-open-controls').click();
      await page.locator('#player-dialog').waitFor({ state: 'visible' });
      await page.locator('#player-light').selectOption('daylight');
      let player = app.windows().find((w) => w.url().includes('player-display.html'));
      if (player) {
        await page.locator('#player-show-follow').click();
      } else {
        const opened = app.waitForEvent('window');
        await page.locator('#player-show-follow').click();
        player = await opened;
      }
      player.on('pageerror', (e) => errors.push(e.stack));
      await player.locator('.player-dungeon').waitFor({ state: 'visible' });
      await page.locator('#player-close-controls').click();
      await page.locator('#player-dialog').waitFor({ state: 'hidden' });
      return player;
    }
    try {
      let page = await launch();
      await page.locator('#dungeon-tab').click();
      await page.locator('#dungeon-room').selectOption(first.id);
      await page.locator('#dungeon-place').click();
      await page.waitForFunction(
        () => document.querySelectorAll('#dungeon-key-description .key-secret-block').length === 2,
      );
      let player = await showPlayers(page);
      assert(!(await player.locator('body').innerText()).includes('Bronzeschlüssel'));
      assert(!(await player.locator('body').innerText()).includes('Fallentür'));
      await page
        .locator('#dungeon-key-description .key-secret-block')
        .filter({ hasText: 'Bronzeschlüssel' })
        .getByRole('button', { name: 'Für Gruppe sichtbar machen', exact: true })
        .click();
      await player.waitForFunction(() => document.body.innerText.includes('Bronzeschlüssel'));
      const firstShown = await player.locator('body').innerText();
      results.push({
        afterOneReveal: {
          bronzeKey: firstShown.includes('Bronzeschlüssel'),
          trapdoor: firstShown.includes('Fallentür'),
          privateCode: firstShown.includes('GM-Code'),
        },
      });
      await player.screenshot({
        path: path.join(root, `gm-template-secrets-${after ? 'after' : 'before'}-player.png`),
      });
      if (after) {
        assert(!firstShown.includes('Fallentür'));
        assert(!firstShown.includes('GM-Code'));
        await page
          .locator('#dungeon-key-description .key-secret-block')
          .filter({ hasText: 'Fallentür' })
          .getByRole('button', { name: 'Für Gruppe sichtbar machen', exact: true })
          .click();
        await player.waitForFunction(() => document.body.innerText.includes('Fallentür'));
        await page
          .locator('#dungeon-key-description .key-secret-block')
          .filter({ hasText: 'Bronzeschlüssel' })
          .getByRole('button', { name: 'Für Gruppe wieder verbergen', exact: true })
          .click();
        await player.waitForFunction(
          () =>
            !document.body.innerText.includes('Bronzeschlüssel') &&
            document.body.innerText.includes('Fallentür'),
        );
        results.push({ independentRevealAndHide: true });
        await page.locator('#dungeon-room').selectOption(second.id);
        await page.locator('#dungeon-place').click();
        await page.waitForFunction(() =>
          document.querySelector('#dungeon-key-heading').textContent.includes('Echohalle'),
        );
        await player.waitForFunction(
          () =>
            !document.body.innerText.includes('Bronzeschlüssel') &&
            !document.body.innerText.includes('Fallentür'),
        );
        results.push({ secondRoomDoesNotInheritDiscovery: true });
        await page.locator('#dungeon-room').selectOption(first.id);
        await page.locator('#dungeon-place').click();
        await player.waitForFunction(
          () =>
            document.body.innerText.includes('Fallentür') &&
            !document.body.innerText.includes('Bronzeschlüssel'),
        );
        await page.locator('#atlas-tab').click();
        await page.locator('#key-open').click();
        await page.locator('#key-dialog').waitFor({ state: 'visible' });
        await page
          .locator('#key-room-list')
          .getByRole('button', { name: /Wachstube/ })
          .click();
        await page.locator('#key-block-options').locator('summary').click();
        await page
          .getByRole('button', { name: 'Vorlage lösen – Inhalt behalten', exact: true })
          .click();
        await page.locator('#key-save').click();
        await page.waitForFunction(
          () => document.querySelector('#key-save-status').dataset.state === 'saved',
        );
        await page.locator('#key-close').click();
        await player.waitForFunction(
          () =>
            document.body.innerText.includes('Fallentür') &&
            !document.body.innerText.includes('Bronzeschlüssel'),
        );
        results.push({ nativeDetachmentPreservesKnowledge: true });
      }
      await close(page);
      if (after) {
        page = await launch();
        await page.locator('#dungeon-tab').click();
        player = await showPlayers(page);
        await player.waitForFunction(() => document.body.innerText.includes('Fallentür'));
        assert(!(await player.locator('body').innerText()).includes('Bronzeschlüssel'));
        assert(!(await player.locator('body').innerText()).includes('GM-Code'));
        results.push({ nativeRestartPreservesIndependentKnowledge: true });
        await player.screenshot({
          path: path.join(root, 'gm-template-secrets-after-restart-player.png'),
        });
        await close(page);
      }
      await native.recordResult({ snapshot, results, launches, normalClose: true });
      console.log(JSON.stringify({ results, normalClose: true }));
      assert(
        !firstShown.includes('Fallentür'),
        'Revealing one template secret must not disclose its sibling',
      );
    } catch (error) {
      if (app && !closedNormally)
        try {
          const page = await app.firstWindow();
          await writeFile(
            path.join(root, 'gm-template-secrets-failure.json'),
            JSON.stringify({ error: error.stack, results, pid, scope, errors }, null, 2),
          );
          await page.screenshot({ path: path.join(root, 'gm-template-secrets-failure.png') });
        } catch {}
      throw error;
    }
  },
);
