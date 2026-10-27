import { runNativeProbe } from './native-session.mjs';
import { currentProcessGroup } from './process-group.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
const applyDamage = process.argv.includes('--apply-rolled-damage');
let expectedWolf = 7;
const source = process.cwd(),
  phase = 'after',
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/combat-switch-evidence');
await runNativeProbe(
  { output: output, name: 'combat-switch', resultName: 'combat-' + phase + '.json' },
  async (native) => {
    const group = await currentProcessGroup();
    await mkdir(output, { recursive: true });
    await rm(path.join(output, 'combat-after.json'), { force: true });
    await rm(path.join(output, 'failure.json'), { force: true });
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/desktop/combat-switch-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/desktop/combat-switch-store.cjs');
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
    const combats = [];
    for (const [title, name, hp] of [
      ['Torwache', 'Wache', 10],
      ['Keller', 'Wolf', 8],
    ]) {
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
      c = store.executeCombat({
        ...command({
          kind: 'add',
          name,
          count: 1,
          grouped: false,
          maxHp: hp,
          armorClass: 10,
          initiativeBonus: 0,
        }),
        combatId: c.id,
        expectedRevision: c.revision,
      }).combat;
      c = store.executeCombat({
        ...command({
          kind: 'notes',
          title,
          notes: '  Erster Hinweis.\r\n- Bronzeschlüssel\r\n- Fluchtweg',
        }),
        combatId: c.id,
        expectedRevision: c.revision,
      }).combat;
      combats.push(c);
    }
    const [a, b] = combats;
    let goblin = null;
    const updated = store.executeCombat({
      ...command({ kind: 'add-creature', creatureId: 'goblin', count: 1, grouped: false }),
      combatId: b.id,
      expectedRevision: b.revision,
    }).combat;
    Object.assign(b, updated);
    goblin = b.participants.find((p) => p.sourceId === 'goblin');
    assert(goblin);
    let archived = store.executeCombat({
      ...command({
        kind: 'create',
        sceneId: scene.id,
        title: 'Alter Wachtposten',
        includeParty: false,
        expectedMembershipRevision: scene.membershipRevision,
      }),
      combatId: null,
      expectedRevision: null,
    }).combat;
    archived = store.executeCombat({
      ...command({
        kind: 'add',
        name: 'Alte Wache',
        count: 1,
        grouped: false,
        maxHp: 10,
        armorClass: 10,
        initiativeBonus: 0,
      }),
      combatId: archived.id,
      expectedRevision: archived.revision,
    }).combat;
    archived = store.executeCombat({
      ...command({ kind: 'finish', outcome: 'Voriger Spielabend' }),
      combatId: archived.id,
      expectedRevision: archived.revision,
    }).combat;
    const originalArchived = store.db
      .prepare('SELECT payload,checksum FROM combat WHERE id=?')
      .get(archived.id);
    const originalA = store.db.prepare('SELECT payload,checksum FROM combat WHERE id=?').get(a.id);
    store.close();

    let app,
      pid,
      closed = false;
    const errors = [],
      launches = [],
      results = {};
    const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      buildHashes = {};
    for (const name of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
      buildHashes[name] = createHash('sha256')
        .update(await readFile(path.join(source, '.build/desktop', name)))
        .digest('hex');
    async function capture(page, name) {
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.show();
        w.focus();
      });
      await page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            let frame;
            const timer = setTimeout(() => {
              cancelAnimationFrame(frame);
              reject(Error('No fresh native capture frames'));
            }, 2500);
            frame = requestAnimationFrame(() => {
              frame = requestAnimationFrame(() => {
                clearTimeout(timer);
                resolve();
              });
            });
          }),
      );
      const bytes = Buffer.from(
        await app.evaluate(async ({ BrowserWindow }) =>
          (
            await BrowserWindow.getAllWindows()
              .find((w) => w.webContents.getURL().endsWith('/index.html'))
              .webContents.capturePage()
          ).toPNG(),
        ),
      );
      const png = require('pngjs').PNG.sync.read(bytes),
        colors = new Set();
      for (let i = 0; i < png.data.length; i += 4 * 31) colors.add(png.data.readUInt32BE(i));
      assert(colors.size > 8);
      await writeFile(path.join(output, name + '.png'), bytes);
    }
    async function launch(zoom = 1) {
      closed = false;
      app = await native.launchConfigured({
        executablePath: source + '/node_modules/electron/dist/electron',
        args: [source + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
        timeout: 20000,
      });
      pid = app.process().pid;
      assert((await readFile(`/proc/${pid}/cmdline`, 'utf8')).includes(profile));
      assert.equal((await readFile(`/proc/${pid}/cgroup`, 'utf8')).trim().split('::')[1], group);
      launches.push({ pid, cgroup: group, zoom });
      const page = await app.firstWindow();
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true', null, {
        timeout: 20000,
      });
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await app.evaluate(({ BrowserWindow }, zoom) => {
        const window = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        window.webContents.setZoomFactor(zoom);
        window.show();
        window.focus();
      }, zoom);
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: /Öffnen|Fortsetzen/ })
        .click();
      await page.waitForFunction(
        () =>
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
      );
      if (!(await page.locator('#live-tab').isVisible())) {
        if (await page.locator('#atlas-navigation').isVisible())
          await page.locator('#atlas-navigation').click();
        else await page.locator('#workspace-nav-summary').click();
      }
      await page.locator('#live-tab').click();
      if (await page.locator('#live-continue').isVisible())
        await page.locator('#live-continue').click();
      await page.locator('#combat-panel').waitFor({ state: 'visible' });
      await page.waitForFunction(
        () =>
          document.querySelector('#combat-panel').getAttribute('aria-busy') === 'false' &&
          document.querySelector('#combat-title').textContent !== 'Begegnung führen',
      );
      return page;
    }
    async function close() {
      assert.deepEqual(errors, []);
      const exit = new Promise((r) =>
        app.process().once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      let timer;
      try {
        const result = await Promise.race([
          exit,
          new Promise(
            (_, reject) =>
              (timer = setTimeout(() => reject(Error('Normal close timed out')), 10000)),
          ),
        ]);
        assert.deepEqual(result, { code: 0, signal: null });
        launches.at(-1).exit = result;
        await assert.rejects(stat('/proc/' + pid), { code: 'ENOENT' });
        launches.at(-1).pidAbsent = true;
        closed = true;
      } finally {
        clearTimeout(timer);
      }
    }
    try {
      let page = await launch();
      const historyMenu = () => page.locator('#combat-history-details summary'),
        selectHistory = async (id) => {
          if (!(await page.locator('#combat-history').isVisible())) await historyMenu().click();
          await page.locator('#combat-history').selectOption(id);
          await historyMenu().click();
        },
        choose = async (id) => {
          await selectHistory(id);
          await page.waitForFunction(
            (title) =>
              document.querySelector('#combat-title').textContent === title &&
              document.querySelector('#combat-panel').getAttribute('aria-busy') === 'false',
            id === a.id ? a.title : b.title,
          );
        };
      await choose(a.id);
      await page
        .locator('#combat-rows')
        .getByRole('button', { name: a.participants[0].name, exact: true })
        .click();
      await page.locator('#fighter-amount').fill('1');
      await page.locator('#combat-notes-details summary').click();
      await page.locator('#combat-edit-title').fill('');
      await page.locator('#combat-notes').fill('Unfertige Hafennotiz');
      await app.evaluate(({ ipcMain }, id) => {
        const original = ipcMain._invokeHandlers.get('campaign:combat');
        let hold = true;
        globalThis.qaCombatHeld = false;
        globalThis.qaCombatReads = [];
        ipcMain.removeHandler('campaign:combat');
        ipcMain.handle('campaign:combat', async (e, ...args) => {
          globalThis.qaCombatReads.push(args[2]);
          const result = await original(e, ...args);
          if (hold && args[2] === id) {
            hold = false;
            globalThis.qaCombatHeld = true;
            return new Promise((resolve) => {
              globalThis.qaReleaseCombat = () => resolve(result);
            });
          }
          return result;
        });
      }, b.id);
      await selectHistory(b.id);
      for (let i = 0; i < 100; i++) {
        if (await app.evaluate(() => globalThis.qaCombatHeld)) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      assert(await app.evaluate(() => globalThis.qaCombatHeld));
      results.duringSwitch = {
        selected: await page.locator('#combat-history').inputValue(),
        visible: await page.locator('#combat-title').innerText(),
        damageEnabled: await page.locator('#fighter-damage').isEnabled(),
      };
      assert.equal(results.duringSwitch.damageEnabled, false);
      await page.evaluate(() => document.querySelector('#fighter-damage').onclick());
      await app.evaluate(() => globalThis.qaReleaseCombat());
      await page.waitForFunction(
        () => document.querySelector('#combat-title').textContent === 'Keller',
      );
      await page
        .locator('#combat-rows')
        .getByRole('button', { name: b.participants[0].name, exact: true })
        .click();
      await page.locator('#fighter-amount').fill('1');
      await page.locator('#fighter-damage').click();
      await page.waitForFunction(() => document.querySelector('#fighter-hp').value === '7');
      await page
        .locator('#combat-rows')
        .getByRole('button', { name: goblin.name, exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector('#live-rules-panel').getAttribute('aria-busy') !== 'true',
      );
      await page
        .locator('#fighter-actions')
        .getByRole('button', { name: /^Angriff / })
        .first()
        .click();
      await page.locator('#combat-attack-effect').waitFor({ state: 'visible' });
      await page.locator('#combat-attack-target').selectOption(b.participants[0].id);
      await page.locator('#combat-attack-roll').click();
      await page.waitForFunction(() =>
        document.querySelector('#live-check-latest').textContent.includes('Goblin'),
      );
      results.nativeStatblockRoll = await page.locator('#live-check-latest').innerText();
      results.nativeTargetedAttack = await page.locator('#combat-attack-result').innerText();
      if (applyDamage) {
        await page.locator('#fighter-statblock > summary').click();
        await page
          .locator('#fighter-statblock')
          .getByRole('button', { name: /^Schaden / })
          .first()
          .click();
        await page.locator('#combat-hit-effect').waitFor({ state: 'visible' });
        await page.locator('#combat-hit-target').selectOption(b.participants[0].id);
        const part = page.locator('#combat-hit-parts .combat-hit-part').first();
        await part.getByRole('button', { name: 'Würfeln', exact: true }).click();
        await page.waitForFunction(() =>
          document.querySelector('#live-check-latest').textContent.includes('Schaden'),
        );
        const total = Number(await part.locator('input[type=number]').inputValue());
        assert.equal(await page.locator('#fighter-hp').inputValue(), String(goblin.hp));
        await part.locator('select').selectOption('half');
        await page.locator('#combat-hit-apply').click();
        await page.locator('#combat-hit-effect').waitFor({ state: 'hidden' });
        expectedWolf = Math.max(0, 7 - Math.floor(total / 2));
        results.explicitRolledDamage = {
          total,
          scale: 'half',
          target: b.participants[0].name,
          expectedHp: expectedWolf,
        };
      }

      await app.evaluate(({ ipcMain }, id) => {
        const original = ipcMain._invokeHandlers.get('campaign:combat');
        let fail = true;
        ipcMain.removeHandler('campaign:combat');
        ipcMain.handle('campaign:combat', async (e, ...args) => {
          if (fail && args[2] === id) {
            fail = false;
            return { ok: false, error: 'QA: Begegnung vorübergehend nicht lesbar' };
          }
          return original(e, ...args);
        });
      }, a.id);
      await selectHistory(a.id);
      await page.locator('#combat-load-status[role=alert]').waitFor();
      assert.equal(await page.locator('#fighter-damage').isEnabled(), false);
      assert.equal(await page.locator('#combat-refresh').isEnabled(), true);
      await page.locator('#combat-load-status').scrollIntoViewIfNeeded();
      await capture(page, 'combat-read-error');
      assert.equal(await page.locator('#combat-history-details').getAttribute('open'), null);
      assert.equal(await page.locator('#combat-load-retry').isVisible(), true);
      await page.locator('#combat-load-retry').click();
      await page.waitForFunction(
        () => document.querySelector('#combat-title').textContent === 'Torwache',
      );
      assert.equal(await page.locator('#combat-load-retry').isVisible(), false);
      assert.equal(await page.locator('#combat-edit-title').inputValue(), '');
      assert.equal(await page.locator('#combat-notes').inputValue(), 'Unfertige Hafennotiz');
      results.failedReadRetrySameTarget = true;
      results.unfinishedNotesRetained = true;
      await page.locator('#combat-title').scrollIntoViewIfNeeded();
      await capture(page, 'combat-' + phase);
      await close();
      const fresh = new CampaignStore(file);
      try {
        const active = fresh.activate(campaign.id),
          ca = fresh.combat(active.token, scene.id, a.id).combat,
          cb = fresh.combat(active.token, scene.id, b.id).combat;
        results.hpAfter = { a: ca.participants[0].hp, b: cb.participants[0].hp };
        assert.deepEqual(
          fresh.db.prepare('SELECT payload,checksum FROM combat WHERE id=?').get(a.id),
          originalA,
        );
        assert.equal(cb.participants[0].hp, expectedWolf);
        const checks = fresh.sceneChecks(active.token, scene.id).checks,
          check = checks.find((c) => c.formulaKind === 'attack');
        if (applyDamage) {
          const damage = checks.find((c) => c.formulaKind === 'damage');
          assert(damage);
          assert.equal(damage.total, results.explicitRolledDamage.total);
        }
        assert.equal(check.rollKind, 'formula');
        assert.equal(check.sourceCreatureId, 'goblin');
        assert.equal(check.dc, b.participants[0].armorClass);
        assert(check.label.includes(b.participants[0].name));
        assert.equal(check.actor, goblin.name);
        assert.equal(check.total, check.rolls.reduce((sum, n) => sum + n, 0) + check.modifier);
        assert.equal(cb.participants.find((p) => p.id === goblin.id).hp, goblin.hp);
        results.formulaOwnershipAndNoImplicitDamage = true;
        const d = fresh.combatDraft(active.token, a.id, 'notes', a.id);
        assert.equal(d.values.title, '');
        assert.equal(d.values.notes, 'Unfertige Hafennotiz');
        results.aBytesUnchanged = true;
      } finally {
        fresh.close();
      }
      page = await launch(2);
      await choose(a.id);
      assert.equal(await page.locator('#combat-edit-title').inputValue(), '');
      assert.equal(await page.locator('#combat-notes').inputValue(), 'Unfertige Hafennotiz');
      results.nativeDraftRestart = true;
      await selectHistory(archived.id);
      await page.waitForFunction(
        () =>
          document.querySelector('#combat-title').textContent === 'Alter Wachtposten' &&
          document.querySelector('#combat-panel').getAttribute('aria-busy') === 'false',
      );
      assert.equal(await page.locator('#combat-controls').isVisible(), false);
      await choose(a.id);
      assert.equal(await page.locator('#combat-edit-title').inputValue(), '');
      assert.equal(await page.locator('#combat-notes').inputValue(), 'Unfertige Hafennotiz');
      results.finishedVisitPreservesDraft = true;
      await app.evaluate(({ ipcMain }, id) => {
        const original = ipcMain._invokeHandlers.get('campaign:combat');
        let fail = true;
        ipcMain.removeHandler('campaign:combat');
        ipcMain.handle('campaign:combat', async (e, ...args) => {
          if (fail && args[2] === id) {
            fail = false;
            return { ok: false, error: 'QA: Begegnung vorübergehend nicht lesbar' };
          }
          return original(e, ...args);
        });
      }, b.id);
      await selectHistory(b.id);
      await page.locator('#combat-load-status[role=alert]').waitFor();
      assert.equal(await page.locator('#combat-history-details').getAttribute('open'), null);
      await page.locator('#combat-load-retry').scrollIntoViewIfNeeded();
      await capture(page, 'combat-read-error-200');
      await page.locator('#combat-load-retry').click();
      await page.waitForFunction(
        () => document.querySelector('#combat-title').textContent === 'Keller',
      );
      await choose(a.id);
      if ((await page.locator('#combat-notes-details').getAttribute('open')) === null)
        await page.locator('#combat-notes-details summary').click();
      await page.locator('#combat-notes').scrollIntoViewIfNeeded();
      await capture(page, 'after-finished-visit');
      await page.locator('#combat-edit-title').fill('Torwache korrigiert');
      await page
        .locator('#combat-notes-form')
        .getByRole('button', { name: 'Kampfnotizen speichern', exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.querySelector('#combat-title').textContent === 'Torwache korrigiert' &&
          document.querySelector('#combat-panel').getAttribute('aria-busy') === 'false',
      );
      await capture(page, 'corrected-notes');
      await close();
      page = await launch();
      await selectHistory(a.id);
      await page.waitForFunction(
        () => document.querySelector('#combat-title').textContent === 'Torwache korrigiert',
      );
      assert.equal(await page.locator('#combat-edit-title').inputValue(), 'Torwache korrigiert');
      assert.equal(await page.locator('#combat-notes').inputValue(), 'Unfertige Hafennotiz');
      results.correctedDraftSavedAndReopened = true;
      await close();
      const checked = new CampaignStore(file);
      try {
        assert.deepEqual(
          checked.db.prepare('SELECT payload,checksum FROM combat WHERE id=?').get(archived.id),
          originalArchived,
        );
        const active = checked.activate(campaign.id),
          corrected = checked.combat(active.token, scene.id, a.id).combat;
        assert.equal(corrected.title, 'Torwache korrigiert');
        assert.equal(corrected.notes, 'Unfertige Hafennotiz');
        assert.deepEqual(corrected.participants, a.participants);
        assert.equal(checked.combatDraft(active.token, a.id, 'notes', a.id), null);
      } finally {
        checked.close();
      }
      await native.recordResult({
        sourceRevision,
        dirty,
        buildHashes,
        profile,
        results,
        launches,
        normalClose: true,
      });
      console.log(JSON.stringify({ results, normalClose: true }));
      assert.equal(
        results.duringSwitch.damageEnabled,
        false,
        'Selecting B must not leave damage actions for A available',
      );
    } catch (e) {
      console.error(e.stack);
      await writeFile(
        path.join(output, 'failure.json'),
        JSON.stringify(
          { sourceRevision, dirty, buildHashes, profile, error: e.stack, results, launches },
          null,
          2,
        ),
      );
      if (app && !closed)
        try {
          await capture(await app.firstWindow({ timeout: 1000 }), 'failure');
        } catch {}
      throw e;
    } finally {
    }
  },
);
