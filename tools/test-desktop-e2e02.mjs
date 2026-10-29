import assert from 'node:assert/strict';
import { readFile, writeFile, copyFile, cp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fixtureRuntime, digest } from './atlas-e2e01-fixture.mjs';
import { seedE2E02, readE2E02, preparationRows, notes } from './live-e2e02-fixture.mjs';
import { requiredE2E02Scenarios, e2e02Qualification } from './live-e2e02-scenarios.mjs';
import { runNativeProbe } from './native-session.mjs';
import { openNativeCampaign, revealWorkspaceNavigation } from './native-navigation.mjs';
import { runE2E02Countercases } from './live-e2e02-countercases.mjs';

const root = process.cwd(),
  output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/e2e02-native');
await runNativeProbe(
  { output, name: 'e2e02', captureFrameTimeoutMs: 15000, closeCaptureTimeoutMs: 20000 },
  async (native) => {
    const buildInfo = JSON.parse(await readFile('.build/desktop/build-info.json', 'utf8'));
    assert.equal(buildInfo.commit, native.source);
    const { CampaignStore } = fixtureRuntime(root),
      fixture = seedE2E02(CampaignStore, native.profile),
      file = path.join(native.profile, 'workbench.sqlite'),
      seedDatabaseHash = digest(await readFile(file)),
      inventory = () => readE2E02(file, fixture.a),
      initial = inventory(),
      preparation = preparationRows(initial),
      snapshots = [],
      traces = [],
      scenarios = [];
    const sourceFiles = [
      'tools/test-desktop-e2e02.mjs',
      'tools/live-e2e02-fixture.mjs',
      'tools/live-e2e02-scenarios.mjs',
      'tools/live-e2e02-countercases.mjs',
      'tools/atlas-e2e01-fixture.mjs',
      'tools/native-session.mjs',
    ];
    const sourceHashes = Object.fromEntries(
      await Promise.all(sourceFiles.map(async (f) => [f, digest(await readFile(f))])),
    );
    await writeFile(
      path.join(output, 'fixture.json'),
      JSON.stringify({ fixture, initial }, null, 2),
    );
    await copyFile(file, path.join(output, 'seed.sqlite'));
    await cp(path.join(native.profile, 'player-images'), path.join(output, 'seed-player-images'), {
      recursive: true,
    });
    let page, versions;
    function passed(id, evidence) {
      scenarios.push({
        id,
        status: 'passed',
        build: native.source,
        fixtureHash: seedDatabaseHash,
        fixtureRecipeHash: fixture.recipeHash,
        storage: true,
        visible: true,
        evidence,
      });
    }
    async function until(check, message) {
      const end = Date.now() + 15000;
      while (!check() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 40));
      assert(check(), message);
    }
    async function checkpoint(name) {
      const state = inventory();
      assert.deepEqual(
        preparationRows(state),
        preparation,
        name + ': authored preparation changed',
      );
      snapshots.push({ name, sha256: digest(JSON.stringify(state)), state });
      await writeFile(path.join(output, 'snapshots.json'), JSON.stringify(snapshots, null, 2));
      await native.capture(page, name);
      return state;
    }
    async function tab(id) {
      await revealWorkspaceNavigation(page);
      await page.locator(id).click();
    }
    async function encounter() {
      await tab('#catalog-tab');
      if (!(await page.locator('#encounter-list').isVisible()))
        await page.locator('#encounter-library > summary').click();
      await page.locator('#encounter-list').selectOption(fixture.planId);
      await page.locator('#catalog-plan-open').click();
    }
    async function launch() {
      page = await native.launch(
        1,
        process.argv.includes('--software-gpu')
          ? {
              args: [
                path.join(root, '.build/desktop/main.cjs'),
                '--ozone-platform=x11',
                '--use-gl=angle',
                '--use-angle=swiftshader',
                '--enable-unsafe-swiftshader',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-background-timer-throttling',
                '--data-dir',
                native.profile,
              ],
            }
          : {},
      );
      page.setDefaultTimeout(15000);
      versions ??= await native.app.evaluate(({ app }) => ({
        application: app.getVersion(),
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome,
      }));
      await native.app.evaluate(({ BrowserWindow, ipcMain }) => {
        const window = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        window.unmaximize();
        window.setContentSize(1400, 1000);
        globalThis.e2e02Trace = [];
        globalThis.e2e02Events = new Map();
        for (const channel of [
          'campaign:execute-live',
          'campaign:execute-combat',
          'campaign:execute-chase',
          'campaign:execute-progress',
        ]) {
          const handler = ipcMain._invokeHandlers.get(channel);
          if (!handler) throw Error('Missing native writer ' + channel);
          ipcMain.removeHandler(channel);
          ipcMain.handle(channel, async (event, command) => {
            globalThis.e2e02Events.set(channel, event);
            const entry = { channel, command: structuredClone(command) };
            globalThis.e2e02Trace.push(entry);
            try {
              const response = await handler(event, command);
              entry.response = response;
              return response;
            } catch (error) {
              entry.error = String(error);
              throw error;
            }
          });
        }
      });
      await openNativeCampaign(page, fixture.a);
    }
    async function close() {
      traces.push(...(await native.app.evaluate(() => globalThis.e2e02Trace)));
      await writeFile(path.join(output, 'commands.json'), JSON.stringify(traces, null, 2));
      await native.close();
    }
    const combat = () => {
      const rows = inventory().combat;
      return rows.length ? JSON.parse(rows.at(-1).payload) : null;
    };
    const chase = () => {
      const rows = inventory().chase;
      return rows.length ? JSON.parse(rows.at(-1).payload) : null;
    };
    await launch();
    native.mark('prepared location, party and stable catalogue references');
    assert.deepEqual(inventory().live_scene, []);
    await tab('#preparation-tab');
    await page.locator('#preparation-planning').click();
    await page.locator('#plans').selectOption(fixture.sessionPlanId);
    await page
      .locator('#scene-list button')
      .filter({ hasText: 'E2E-02 Wache am Salzsteg' })
      .click();
    assert.equal(await page.locator('#scene-notes').inputValue(), notes.replace(/\r/g, ''));
    await encounter();
    await page.waitForFunction(
      () => document.querySelector('#encounter-name').value === 'E2E-01 Torwachen',
    );
    assert.match(await page.locator('#encounter-entries').innerText(), /Guard/);
    assert.match(await page.locator('#encounter-entries').innerText(), /Wolf/);
    assert((await page.locator('#encounter-items').innerText()).trim());
    assert.match(
      await page.locator('#encounter-assessment').innerText(),
      /100 Basis-XP · ×2 · 200 angepasste XP · Mittel/,
    );
    await checkpoint('01-preparation');
    passed('E02-01-preparation-catalogue', [
      '01-preparation.png',
      'fixture.json',
      'snapshots.json#01-preparation',
    ]);

    native.mark('explicit initialize and saved visit adoption');
    await tab('#live-tab');
    assert.deepEqual(inventory().live_scene, []);
    await page.locator('#live-continue').click();
    await page.locator('#running-notes').waitFor({ state: 'visible' });
    const primaryId = inventory().live_state[0].primary_id;
    assert.equal(inventory().live_scene.length, 1);
    assert(inventory().roster_member.every((h) => h.active === 1 && h.scene_id === primaryId));
    assert.notEqual(primaryId, fixture.visitId);
    await page.locator('#adoption-picker > summary').click();
    await page.locator('#adoption-plan').selectOption(fixture.sessionPlanId);
    await page.locator('#adoption-visit').selectOption(fixture.visitId);
    await page.locator('#adoption-preview').click();
    await page.locator('#adoption-dialog').waitFor();
    const beforeCancel = inventory();
    await page.locator('#adoption-cancel').click();
    assert.deepEqual(inventory(), beforeCancel, 'Visit preview/cancel must not write');
    await page.locator('#adoption-preview').click();
    await page.locator('#adoption-confirm').click();
    await page.locator('#adoption-dialog').waitFor({ state: 'hidden' });
    await until(
      () => inventory().live_scene[0].location_id === fixture.locationId,
      'Confirmed location missing',
    );
    assert.equal(inventory().scene_adoption[0].notes, notes);
    await page.locator('#live-session-start').click();
    await page.locator('#live-session-end').waitFor();
    await checkpoint('02-initialized-adopted');

    native.mark('split, focus, move and rejoin');
    await page.locator('#group-move').click();
    await page.locator('#move-members input[value="' + fixture.heroes[1].id + '"]').check();
    await page.locator('#move-title').fill('E2E-02 Späher');
    await page.locator('#move-confirm').click();
    await page.locator('#move-dialog').waitFor({ state: 'hidden' });
    const splitId = inventory().live_scene.find((s) => s.id !== primaryId).id;
    await page.locator('#scene-focus').selectOption(splitId);
    await until(() => inventory().live_state[0].focus_id === splitId, 'Split focus missing');
    await checkpoint('03-split-focus');
    await page.locator('#group-move').click();
    await page.locator('#move-members input[value="' + fixture.heroes[1].id + '"]').check();
    await page.locator('#move-target').selectOption(primaryId);
    await page.locator('#move-confirm').click();
    await page.locator('#move-dialog').waitFor({ state: 'hidden' });
    await until(
      () => inventory().roster_member.every((h) => h.scene_id === primaryId),
      'Rejoin lost a hero',
    );
    assert.equal(new Set(inventory().roster_member.map((h) => h.id)).size, 3);
    assert.equal(inventory().scene_lifecycle.find((s) => s.id === splitId).retired, 1);
    assert.equal(inventory().live_state[0].focus_id, primaryId);
    await checkpoint('04-rejoined');
    passed('E02-04-split-move-rejoin', ['03-split-focus.png', '04-rejoined.png', 'snapshots.json']);

    native.mark('separate chase input, participants, round and closure');
    await page.locator('#chase-title').fill('E2E-02 Kurier am Salzsteg');
    await page.locator('#chase-goal').fill('Kurier erreichen');
    await page.locator('#chase-start').click();
    await page.locator('#chase-work').waitFor();
    await page.locator('#chase-participant-add > summary').click();
    await page.locator('#chase-party').click();
    await until(() => chase().participants.length === 3, 'Chase party IDs missing');
    await page.locator('#chase-round').click();
    await until(() => chase().round === 1, 'Chase round not confirmed');
    await page.locator('#chase-completion > summary').click();
    await page.locator('#chase-outcome').fill('Kurier erreicht, keine Teilnehmer verloren.');
    await page.locator('#chase-finish').click();
    await until(() => chase().status === 'finished', 'Chase not finished');
    await checkpoint('05-chase-finished');

    native.mark('catalogue encounter creates independent combat participants');
    await encounter();
    await page.locator('#encounter-prepare').click();
    await until(() => combat()?.participants.length === 6, 'Combat party/opponents missing');
    await tab('#live-tab');
    await page.locator('#combat-workspace').waitFor();
    const preparedCombat = combat(),
      guards = preparedCombat.participants.filter((p) => p.sourceId === 'guard');
    assert.equal(guards.length, 2);
    assert.equal(guards[0].groupId, guards[1].groupId);
    assert.equal(preparedCombat.participants.filter((p) => p.sourceId === 'wolf').length, 1);
    assert.equal(preparedCombat.planOrigin.id, fixture.planId);
    await checkpoint('06-combat-prepared');
    passed('E02-07-chase-combat', [
      '05-chase-finished.png',
      '06-combat-prepared.png',
      'snapshots.json',
    ]);

    native.mark('initiative, HP, condition and combat rounds');
    await page.locator('#combat-rows button').filter({ hasText: 'Guard' }).first().click();
    await page.locator('#fighter-values > summary').click();
    await page.locator('#fighter-initiative').fill('15');
    await page.locator('#fighter-conditions').fill('Liegend');
    await page.locator('#combat-participant-form button[type="submit"]').click();
    await until(
      () =>
        combat().participants.some(
          (p) => p.sourceId === 'guard' && p.initiative === 15 && p.conditions === 'Liegend',
        ),
      'Combat values not saved',
    );
    await page.locator('#fighter-amount').fill('2');
    await page.locator('#fighter-damage').click();
    await until(
      () => combat().participants.some((p) => p.sourceId === 'guard' && p.hp === p.maxHp - 2),
      'Damage not saved',
    );
    await page.locator('#combat-start').click();
    await until(() => combat().phase === 'running', 'Combat did not begin');
    const firstTurn = combat().turnId;
    for (let i = 0; i < 6; i++) await page.locator('#combat-next').click();
    await until(() => combat().round === 2, 'Combat round not advanced');
    assert.equal(combat().turnId, firstTurn);
    await checkpoint('07-combat-round-two');
    passed('E02-08-combat-progression', [
      '07-combat-round-two.png',
      'snapshots.json#07-combat-round-two',
    ]);

    native.mark('atomic combat reward, loot and explicit ledger allocation');
    await page.locator('#combat-finish').click();
    await page.locator('#combat-finish-dialog').waitFor();
    await page.locator('#combat-outcome').fill('Salzsteg gesichert.');
    await page.locator('#finish-no-xp').uncheck();
    await page.locator('#finish-xp').fill('99');
    for (const hero of fixture.heroes)
      await page.locator('#finish-recipients input[value="' + hero.id + '"]').check();
    await page.locator('#finish-has-loot').check();
    await page
      .locator('#finish-item-list')
      .getByRole('button', { name: 'Weiteren Gegenstand hinzufügen', exact: true })
      .click();
    await page
      .locator('#finish-item-list')
      .getByLabel('Gegenstand', { exact: true })
      .fill('E2E-02 Salzschlüssel');
    await page
      .locator('#finish-item-list')
      .getByLabel('Wert pro Stück in Gold', { exact: true })
      .fill('5');
    await page.locator('#combat-finish-form button[type="submit"]').click();
    await page.locator('#combat-finish-dialog').waitFor({ state: 'hidden' });
    await until(() => combat().phase === 'finished', 'Combat result not saved');
    assert.equal(inventory().combat_award.length, 1);
    assert.equal(inventory().treasure.length, 1);
    assert.equal(
      inventory().character_progress.every((row) => JSON.parse(row.payload).xp === 33),
      true,
    );
    // Fixed DMG-2014 oracle: 2 × Guard (25) + Wolf (50), three level-one PCs.
    assert.deepEqual(combat().assessment, {
      baseXp: 100,
      adjustedXp: 200,
      multiplier: 2,
      count: 3,
      partySize: 3,
      unknownLevels: 0,
      difficulty: 'Mittel',
      thresholds: [75, 150, 225, 300],
      missingXp: 0,
    });
    assert(combat().sources.every((s) => s.rulesVersion === '2014'));
    passed('E02-06-2014-group-individual', [
      '01-preparation.png',
      '06-combat-prepared.png',
      '08-reward.png',
      'snapshots.json',
    ]);
    await checkpoint('08-reward');
    await page
      .locator('#combat-resolution-treasures')
      .getByRole('button', { name: 'Gemeinsam verteilen…', exact: true })
      .click();
    await page.locator('#treasure-distribution-dialog').waitFor();
    await page
      .locator('#distribution-grid input[data-character-id="' + fixture.heroes[0].id + '"]')
      .fill('1');
    await page.locator('#distribution-check').click();
    await page.locator('#distribution-confirm').click();
    await until(
      () => inventory().character_ledger.length === 1,
      'Allocation did not reach the canonical ledger',
    );
    await page
      .locator('#treasure-distribution-dialog')
      .getByRole('button', { name: 'Schließen', exact: true })
      .click();
    const beforeReplay = inventory();
    // A deliberate protocol replay uses the real Main handlers and their original
    // sender events. It is separate from the still-open lost-response UI fault.
    const replay = await native.app.evaluate(async ({ ipcMain }) => {
      const results = [];
      for (const [channel, kind] of [
        ['campaign:execute-combat', 'finish'],
        ['campaign:execute-progress', 'allocate-batch'],
      ]) {
        const prior = globalThis.e2e02Trace.find(
          (e) => e.channel === channel && e.command.action.kind === kind,
        );
        if (!prior?.response?.ok) throw Error('Missing original successful reward/ledger command');
        const response = await ipcMain._invokeHandlers.get(channel)(
          globalThis.e2e02Events.get(channel),
          prior.command,
        );
        results.push({ commandId: prior.command.commandId, prior: prior.response, response });
      }
      return results;
    });
    for (const item of replay) assert.deepEqual(item.response, item.prior);
    assert.deepEqual(
      inventory(),
      beforeReplay,
      'Original reward/ledger CommandId replay duplicated a canonical effect',
    );
    await writeFile(path.join(output, 'reward-replay.json'), JSON.stringify(replay, null, 2));
    await checkpoint('08b-ledger-once');
    passed('E02-09-loot-reward-once', [
      '08-reward.png',
      '08b-ledger-once.png',
      'reward-replay.json',
      'snapshots.json',
    ]);

    native.mark('session closure and fresh process retain exact canonical state');
    await page.locator('#combat-scene').click();
    await page.locator('#live-session-end').click();
    await page.locator('#live-session-close-dialog').waitFor();
    await page.locator('#live-session-close-summary').fill('Salzsteg gesichert. Kurier erreicht.');
    await page.locator('#live-session-close-confirm').click();
    await page.locator('#live-session-close-dialog').waitFor({ state: 'hidden' });
    const beforeRestart = await checkpoint('09-session-ended');
    await close();
    await launch();
    await tab('#live-tab');
    if (await page.locator('#live-continue').isVisible())
      await page.locator('#live-continue').click();
    await page.locator('#running-notes').waitFor();
    // Continue on an existing runtime has its own receipt; compare domain/ledger rows,
    // and prove the prior receipt inventory remains a byte-identical subset.
    const afterRestart = await checkpoint('10-fresh-process');
    for (const [table, rows] of Object.entries(beforeRestart)) {
      if (['receipt', 'live_receipt'].includes(table)) {
        for (const row of rows)
          assert(afterRestart[table].some((r) => JSON.stringify(r) === JSON.stringify(row)));
      } else assert.deepEqual(afterRestart[table], rows, 'Fresh process changed ' + table);
    }
    passed('E02-10-fresh-process', [
      '09-session-ended.png',
      '10-fresh-process.png',
      'snapshots.json',
    ]);
    await close();
    const receiptTables = {
        live: 'live_receipt',
        combat: 'combat_receipt',
        chase: 'chase_receipt',
        progress: 'progress_receipt',
      },
      receiptTrace = traces.map((entry) => {
        assert.equal(entry.command.campaignId, fixture.a);
        assert.equal(entry.response?.ok, true, 'Recorded native command did not succeed');
        const family = entry.channel.split('-').at(-1),
          table = receiptTables[family],
          receipts = afterRestart[table].filter((r) => r.command_id === entry.command.commandId);
        assert.equal(
          receipts.length,
          1,
          'Exactly one persisted receipt for ' + entry.command.commandId,
        );
        assert.deepEqual(
          JSON.parse(receipts[0].payload),
          entry.response.value,
          'Main response and independent canonical receipt differ',
        );
        return {
          channel: entry.channel,
          commandId: entry.command.commandId,
          action: entry.command.action,
          receiptTable: table,
          receiptSha256: digest(receipts[0].payload),
        };
      });
    await writeFile(path.join(output, 'receipt-trace.json'), JSON.stringify(receiptTrace, null, 2));
    passed('E02-14-receipt-trace', [
      'commands.json',
      'receipt-trace.json',
      'snapshots.json',
      'reward-replay.json',
    ]);
    const planning = scenarios.find((s) => s.id === 'E02-01-preparation-catalogue');
    planning.status = 'partial';
    planning.reason =
      'Production writers seed the references and native UI selects/reads the prepared plan. Native creation by individually choosing Creature and Item remains open.';
    scenarios.push(
      ...(await runE2E02Countercases({
        output,
        fixture,
        seedDatabaseHash,
        source: native.source,
        softwareGpu: process.argv.includes('--software-gpu'),
      })),
    );
    const missing = {
      'E02-02-immutable-initialize':
        'Initialize accepts only expectedRosterRevision, no PreparationId/Revision/Snapshot or immutable SourceProvenance.',
      'E02-03-independent-runtime':
        'No own LiveSession identity or explicit second independent runtime start from the same snapshot.',
      'E02-05-focus-fail-closed':
        'Active split focus exercised; complete none/pending/unavailable/foreign/stale/retired/damaged matrix is not part of this run.',
      'E02-11-invalid-catalogue':
        'Missing, unknown, unavailable and stale source attempts need independent fixture copies and visible before/after checks.',
    };
    for (const id of requiredE2E02Scenarios)
      if (!scenarios.some((s) => s.id === id))
        scenarios.push({ id, status: 'open', reason: missing[id] });
    const result = {
      source: native.source,
      buildInfo,
      sourceHashes,
      fixture,
      seedDatabaseHash,
      versions,
      host: {
        platform: process.platform,
        arch: process.arch,
        kernel: os.release(),
        display: process.env.DISPLAY ?? null,
        softwareGpu: process.argv.includes('--software-gpu'),
        zoom: 1,
      },
      scenarios,
      snapshots: 'snapshots.json',
      commands: 'commands.json',
      workflowSubset: 'passed',
      complete: false,
      humanAcceptance: false,
      installedPackageAcceptance: false,
    };
    result.qualification = e2e02Qualification(result);
    assert.equal(result.qualification.technicalGate, 'open');
    assert.deepEqual(
      Object.fromEntries(
        await Promise.all(sourceFiles.map(async (f) => [f, digest(await readFile(f))])),
      ),
      sourceHashes,
      'Probe sources changed during the workflow',
    );
    return result;
  },
);
