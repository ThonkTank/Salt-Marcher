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
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/ledger-switch-evidence');
await runNativeProbe(
  { output: output, name: 'ledger-switch', resultName: 'ledger-switch-' + phase + '.json' },
  async (native) => {
    const group = await currentProcessGroup();
    await mkdir(output, { recursive: true });
    const require = createRequire(source + '/package.json'),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/desktop/ledger-switch-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(source + '/.build/desktop/ledger-switch-store.cjs');
    const profile = native.profile,
      file = profile + '/workbench.sqlite',
      store = new CampaignStore(file),
      campaign = store.create('Funde nach dem Spiel verkaufen'),
      w = store.activate(campaign.id),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action,
      });
    const heroes = ['Ada', 'Borin'].map(
        (name) =>
          store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
      ),
      scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 2 })).scene;
    for (const c of heroes) {
      const live = store.live(w.token);
      store.executeLive(
        command({
          kind: 'membership',
          characterId: c.id,
          expectedRevision: c.membershipRevision,
          expectedRosterRevision: live.rosterRevision,
          active: true,
          targetSceneId: scene.id,
          expectedFocusRevision: live.focusRevision,
        }),
      );
    }
    const items = [];
    for (const [name, quantity, valueGold] of [
      ['Seil', 4, '2'],
      ['Heiltrank', 2, '5'],
    ]) {
      const result = store.executeProgress(
        command({
          kind: 'manual-item',
          characterId: heroes[0].id,
          expectedMembershipRevision: store.live(w.token).roster.find((c) => c.id === heroes[0].id)
            .membershipRevision,
          origin: 'manual',
          item: { name, quantity, valueGold, category: 'equipment' },
          note: '  Fundprotokoll\r\n- Gemeinsamer Ausflug',
        }),
      );
      items.push(store.ledgerItem(w.token, result.ledgerIds[0]));
    }
    const [a, b] = items,
      initialA = store.db
        .prepare('SELECT payload,checksum FROM character_ledger WHERE id=?')
        .get(a.id);
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
      await page.locator('#live-continue').click();
      await page.waitForFunction(
        () => document.querySelectorAll('#ledger-list button').length >= 2,
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
      const choose = async (item) => {
        await page
          .locator('#ledger-list')
          .getByRole('button', { name: new RegExp('^' + item.quantity + ' × ' + item.name + ' ·') })
          .click();
        await page.waitForFunction(
          (name) => document.querySelector('#ledger-detail').textContent.startsWith(name + ' ·'),
          item.name,
        );
      };
      await choose(a);
      await page
        .locator('#ledger-stack-tools input[aria-label="Stapelgrund"]')
        .fill('Teil für Borin');
      await page.evaluate(() => {
        globalThis.qaOldSplit = [...document.querySelectorAll('#ledger-stack-tools button')].find(
          (b) => b.textContent === 'Mengenstapel teilen',
        ).onclick;
      });
      await app.evaluate(({ ipcMain }, id) => {
        const original = ipcMain._invokeHandlers.get('campaign:ledger-item');
        let hold = true;
        ipcMain.removeHandler('campaign:ledger-item');
        ipcMain.handle('campaign:ledger-item', async (e, ...args) => {
          const result = await original(e, ...args);
          if (hold && args[1] === id) {
            hold = false;
            globalThis.qaLedgerHeld = true;
            return new Promise((resolve) => {
              globalThis.qaLedgerRelease = () => resolve(result);
            });
          }
          return result;
        });
      }, b.id);
      await page
        .locator('#ledger-list')
        .getByRole('button', { name: new RegExp('^' + b.quantity + ' × ' + b.name + ' ·') })
        .click();
      for (let i = 0; i < 100; i++) {
        if (await app.evaluate(() => globalThis.qaLedgerHeld)) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      assert(await app.evaluate(() => globalThis.qaLedgerHeld));
      results.duringSwitch = {
        detail: await page.locator('#ledger-detail').innerText(),
        saveEnabled: await page.locator('#ledger-form button[type=submit]').isEnabled(),
      };
      if (before) {
        await page.locator('#ledger-operation').selectOption('sold');
        await page.locator('#ledger-quantity').fill('1');
        await page.locator('#ledger-price').fill('3');
        await page.locator('#ledger-reason').fill('Marktverkauf');
        await page.locator('#ledger-form button[type=submit]').click();
        await page.waitForFunction(() =>
          [...document.querySelectorAll('#ledger-list button')].some((b) =>
            b.textContent.startsWith('3 × Seil'),
          ),
        );
        await app.evaluate(() => globalThis.qaLedgerRelease());
      } else {
        assert.equal(results.duringSwitch.saveEnabled, false);
        await page.evaluate(() => {
          globalThis.qaOldSplit();
          document.querySelector('#ledger-form').onsubmit({ preventDefault() {} });
        });
        await app.evaluate(() => globalThis.qaLedgerRelease());
        await page.waitForFunction(() =>
          document.querySelector('#ledger-detail').textContent.startsWith('Heiltrank ·'),
        );
        await page.locator('#ledger-operation').selectOption('sold');
        await page.locator('#ledger-quantity').fill('1');
        await page.locator('#ledger-price').fill('3');
        await page.locator('#ledger-reason').fill('Marktverkauf');
        await page.locator('#ledger-form button[type=submit]').click();
        await page.waitForFunction(() =>
          [...document.querySelectorAll('#ledger-list button')].some((b) =>
            b.textContent.startsWith('1 × Heiltrank'),
          ),
        );
        await app.evaluate(({ ipcMain }, id) => {
          const original = ipcMain._invokeHandlers.get('campaign:ledger-item');
          let fail = true;
          ipcMain.removeHandler('campaign:ledger-item');
          ipcMain.handle('campaign:ledger-item', async (e, ...args) => {
            if (fail && args[1] === id) {
              fail = false;
              return { ok: false, error: 'QA: Beuteeintrag vorübergehend nicht lesbar' };
            }
            return original(e, ...args);
          });
        }, a.id);
        await page
          .locator('#ledger-list')
          .getByRole('button', { name: /^4 × Seil ·/ })
          .click();
        await page.locator('#ledger-load-status[role=alert]').waitFor();
        assert.equal(await page.locator('#ledger-form button[type=submit]').isEnabled(), false);
        await page.locator('#ledger-load-status').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'ledger-switch-retry.png') });
        await page.locator('#ledger-retry').click();
        await page.waitForFunction(() =>
          document.querySelector('#ledger-detail').textContent.startsWith('Seil ·'),
        );
        results.failedReadRetry = true;
      }
      await page.locator('#ledger-list').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, 'ledger-switch-' + phase + '.png') });
      await close();
      const fresh = new CampaignStore(file);
      try {
        const active = fresh.activate(campaign.id),
          ca = fresh.ledgerItem(active.token, a.id),
          cb = fresh.ledgerItem(active.token, b.id),
          ledger = fresh.ledger(active.token, {
            characterId: heroes[0].id,
            after: null,
            search: '',
            status: '',
          });
        results.quantities = { a: ca.quantity, b: cb.quantity };
        results.sold = ledger.items
          .filter((i) => i.status === 'sold')
          .map((i) => ({
            name: i.name,
            quantity: i.quantity,
            actualSaleCopper: i.actualSaleCopper,
          }));
        results.totalCopper = ledger.totalCopper;
        if (!before) {
          assert.deepEqual(
            fresh.db.prepare('SELECT payload,checksum FROM character_ledger WHERE id=?').get(a.id),
            initialA,
          );
          assert.equal(cb.quantity, 1);
          assert.deepEqual(results.sold, [
            { name: 'Heiltrank', quantity: 1, actualSaleCopper: '300' },
          ]);
          assert.equal(ledger.totalCopper, '1600');
          assert.equal(
            fresh.ledger(active.token, {
              characterId: heroes[1].id,
              after: null,
              search: '',
              status: '',
            }).items.length,
            0,
          );
          results.otherItemAndCharacterUnchanged = true;
          const history = fresh.progressHistory(active.token, heroes[0].id, null);
          assert.equal(history.items.filter((e) => e.kind === 'loot-sold').length, 1);
          results.historyOnce = true;
        }
      } finally {
        fresh.close();
      }
      if (!before) {
        page = await launch();
        await page
          .locator('#ledger-list')
          .getByRole('button', { name: /^4 × Seil ·/ })
          .waitFor();
        await page
          .locator('#ledger-list')
          .getByRole('button', { name: /^1 × Heiltrank · Erhalten/ })
          .waitFor();
        await page
          .locator('#ledger-list')
          .getByRole('button', { name: /^1 × Heiltrank · Erhalten/ })
          .click();
        await page.waitForFunction(() =>
          document.querySelector('#ledger-detail').textContent.startsWith('Heiltrank ·'),
        );
        assert.equal(
          await page
            .locator('#ledger-stack-tools')
            .getByRole('button', { name: 'Mengenstapel teilen' })
            .isEnabled(),
          false,
        );
        await page.locator('#ledger-stack-tools').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'ledger-switch-one-unit.png') });
        await close();
        results.nativeRestart = true;
        results.oneUnitSplitDisabled = true;
      }
      await native.recordResult({ results, launches, normalClose: true });
      console.log(JSON.stringify({ results, normalClose: true }));
      assert.equal(
        results.duringSwitch.saveEnabled,
        false,
        'Selecting another loot entry must disable mutations for the old one',
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
