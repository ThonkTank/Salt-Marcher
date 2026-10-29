import { createRequire } from 'node:module';
import { createNativeSession } from './native-session.mjs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

const source = process.cwd(),
  output =
    process.env.QA_EVIDENCE_DIR ?? path.resolve(process.argv[2] ?? '.build/day-refresh-evidence');
const native = await createNativeSession({ root: source, output, name: 'day-refresh' });
const require = createRequire(source + '/package.json');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/day-refresh-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(source + '/.build/day-refresh-store.cjs');
const profile = native.profile,
  file = profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Tagesplan und Vergleichsgruppe'),
  w = store.activate(campaign.id);
const command = (action) => ({
  campaignId: campaign.id,
  token: w.token,
  commandId: randomUUID(),
  action,
});
store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 }));
for (let i = 1; i <= 2; i++) {
  const c = store.executeLive(
      command({
        kind: 'create-character',
        profile: { name: 'Figur ' + String(i).padStart(2, '0') },
      }),
    ).character,
    live = store.live(w.token);
  store.executeLive(
    command({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: live.rosterRevision,
      active: true,
      targetSceneId: live.scene.id,
      expectedFocusRevision: live.focusRevision,
    }),
  );
  store.executeProgress(
    command({
      kind: 'xp',
      characterId: c.id,
      expectedRevision: 0,
      mode: 'set',
      amount: 300,
      reason: 'Bestätigter Start',
    }),
  );
}
const facts = () =>
  ['roster_member', 'character_progress', 'live_scene'].map((table) =>
    store.db.prepare('SELECT * FROM ' + table + ' ORDER BY id').all(),
  );
const plan = store.saveEncounterPlan({
  ...command(null),
  expectedRevision: null,
  plan: {
    id: randomUUID(),
    revision: 0,
    name: 'Wachpatrouille',
    notes: 'Unveränderte Quelle',
    party: [],
    entries: [{ id: randomUUID(), creatureId: 'goblin', count: 1, grouped: false }],
    sources: [],
    catalogHash: '',
  },
});
const sourceBefore = store.db.prepare('SELECT * FROM encounter_plan ORDER BY id').all(),
  before = facts();
store.close();
let app;
const results = [];
const capture = (page, name) => native.capture(page, name);
try {
  for (const variant of [1, 2]) {
    const scale = 1;
    const page = await native.launch(scale);
    app = native.app;
    if (await page.locator('#tutorial-dialog').isVisible())
      await page.locator('#tutorial-skip').click();
    await app.evaluate(({ ipcMain }) => {
      globalThis.__dayReads = [];
      globalThis.__dayFailNext = false;
      globalThis.__dayHold = false;
      globalThis.__dayRelease = null;
      const read = ipcMain._invokeHandlers.get('campaign:adventuring-day');
      ipcMain.removeHandler('campaign:adventuring-day');
      ipcMain.handle('campaign:adventuring-day', async (event, token, input) => {
        globalThis.__dayReads.push(structuredClone(input));
        if (globalThis.__dayHold)
          await new Promise((resolve) => {
            globalThis.__dayRelease = resolve;
          });
        if (globalThis.__dayFailNext) {
          globalThis.__dayFailNext = false;
          return { ok: false, error: 'Kontrollierter Tagesplan-Lesefehler' };
        }
        return read(event, token, input);
      });
    });
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith('/index.html'),
      );
      w.show();
      w.focus();
    });
    await page
      .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
      .getByRole('button', { name: /^(Öffnen|Fortsetzen)$/ })
      .click();
    await page.waitForFunction(
      () =>
        document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
    );
    if (!(await page.locator('#live-tab').isVisible())) {
      if (await page.locator('#atlas-navigation').isVisible())
        await page.locator('#atlas-navigation').click();
      else await page.locator('#workspace-nav-summary').click();
    }
    await page.locator('#live-tab').click();
    await page.locator('#day-trigger').click();
    const settled = async () =>
      page.waitForFunction(
        () => document.querySelector('#day-popover').getAttribute('aria-busy') === 'false',
      );
    await settled();
    if (variant === 2) {
      assert.equal(await page.locator('#day-use-encounters').isChecked(), true);
      assert.equal(await page.locator('#day-active').getAttribute('aria-pressed'), 'true');
      assert.deepEqual(
        await page
          .locator('#day-plan-selected input')
          .evaluateAll((nodes) => nodes.map((n) => n.value)),
        ['6', '12'],
      );
      assert.deepEqual(
        await page
          .locator('#day-plan-selected select')
          .evaluateAll((nodes) => nodes.map((n) => n.value)),
        ['none', 'short'],
      );
      assert.equal(await page.locator('#day-total-xp').inputValue(), '1368');
      await capture(page, 'restored-plan-' + variant);
      await page.locator('#day-use-encounters').uncheck();
      await settled();
      assert.equal(await page.locator('#day-total-xp').inputValue(), '600');
    }
    await page.locator('#day-active').click();
    await settled();
    await page.locator('#day-mode-progress').click();
    await page.locator('#day-total-xp').fill('600');
    await settled();
    // Keep a real IPC read pending: old answers must be invisible without moving the form.
    const answerHeight = await page
      .locator('#day-results')
      .evaluate((n) => n.getBoundingClientRect().height);
    await app.evaluate(() => {
      globalThis.__dayHold = true;
    });
    await page.locator('#day-total-xp').fill('601');
    await page.waitForFunction(
      () => document.querySelector('#day-popover').getAttribute('aria-busy') === 'true',
    );
    assert.equal(
      await page.locator('#day-results').evaluate((n) => getComputedStyle(n).visibility),
      'hidden',
    );
    assert.equal(
      await page.locator('#day-results').evaluate((n) => n.getBoundingClientRect().height),
      answerHeight,
    );
    await capture(page, 'pending-' + variant);
    // A native screenshot gives the debounced read time to arrive; await the exact gate too.
    for (let attempts = 0; !(await app.evaluate(() => !!globalThis.__dayRelease)); attempts++) {
      assert.ok(attempts < 100, 'the held read reached Main');
      await page.waitForTimeout(20);
    }
    await app.evaluate(() => {
      globalThis.__dayHold = false;
      globalThis.__dayRelease();
      globalThis.__dayRelease = null;
    });
    await settled();
    assert.equal(
      await page.locator('#day-results').evaluate((n) => getComputedStyle(n).visibility),
      'visible',
    );
    await page.locator('#day-total-xp').fill('600');
    await settled();
    // Deliver both actions in one renderer task so this race test is independent
    // of automation/host speed. The actual DOM handlers, preload and SQLite read run.
    const before = await app.evaluate(() => globalThis.__dayReads.length);
    await page.evaluate(() => {
      const level = document.querySelector('#day-rows input');
      level.value = '4';
      level.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#day-active').click();
    });
    await settled();
    await page.waitForTimeout(200);
    const partyReads = await app.evaluate((_electron, n) => globalThis.__dayReads.slice(n), before);
    await capture(page, 'party-' + variant);
    assert.equal(partyReads.length, 1, 'choosing the active party consumes the queued edit');
    assert.equal(partyReads[0].source, 'active');
    await page.locator('#day-custom').click();
    await settled();
    assert.equal(
      await page.getByRole('spinbutton', { name: 'Level Zeile 1', exact: true }).inputValue(),
      '4',
    );
    assert.match(await page.locator('#day-summary').innerText(), /3.400 XP Tagesbudget/);
    await app.evaluate(() => {
      globalThis.__dayFailNext = true;
    });
    const failuresBefore = await app.evaluate(() => globalThis.__dayReads.length);
    await page.evaluate(() => {
      const count = document.querySelectorAll('#day-rows input')[1];
      count.value = '3';
      count.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#day-close').click();
      document.querySelector('#day-trigger').click();
    });
    await settled();
    await page.waitForTimeout(200);
    const failedReads = await app.evaluate(
      (_electron, n) => globalThis.__dayReads.slice(n),
      failuresBefore,
    );
    assert.equal(failedReads.length, 1, 'a failed reopening must not retry itself');
    assert.match(
      await page.locator('#day-status').innerText(),
      /Kontrollierter Tagesplan-Lesefehler/,
    );
    assert.equal(await page.locator('#day-summary').locator('*').count(), 0);
    assert.equal(
      await page.getByRole('spinbutton', { name: 'Anzahl Zeile 1', exact: true }).inputValue(),
      '3',
    );
    await capture(page, 'failure-' + variant);
    await page.locator('#day-close').click();
    await page.locator('#day-trigger').click();
    await settled();
    assert.match(await page.locator('#day-summary').innerText(), /5.100 XP Tagesbudget/);
    assert.match(await page.locator('#day-summary').innerText(), /200 XP je Figur/);
    assert.equal(await page.locator('#day-total-xp').inputValue(), '600');
    await page.getByRole('spinbutton', { name: 'Anzahl Zeile 1', exact: true }).fill('2');
    await settled();
    // Give the debounced input its own read before restarting.
    await page.waitForFunction(() =>
      document.querySelector('#day-summary').textContent.includes('3.400 XP Tagesbudget'),
    );
    const zoom = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('/index.html'))
        .webContents.getZoomFactor(),
    );
    assert.equal(zoom, scale);
    await page.locator('#day-summary').scrollIntoViewIfNeeded();
    await capture(page, 'recovered-' + variant);
    await page.locator('#day-active').click();
    await settled();
    if ((await page.locator('#day-plan-panel').getAttribute('open')) === null)
      await page.locator('#day-plan-panel > summary').click();
    await page.locator('#day-use-encounters').check();
    await settled();
    await page.locator('#day-plan-clear').click();
    await settled();
    await page
      .locator('#day-plan-matches')
      .getByRole('button', { name: 'Wachpatrouille · hinzufügen', exact: true })
      .click();
    await page
      .getByRole('spinbutton', { name: 'Wiederholungen Wachpatrouille', exact: true })
      .fill('18');
    await page.waitForFunction(
      () =>
        document.querySelector('#day-total-xp').value === '1368' &&
        document.querySelector('#day-popover').getAttribute('aria-busy') === 'false',
    );
    await page.locator('.day-rest-stops > summary').click();
    await page
      .getByRole('button', { name: 'Hier kurze Rast einplanen', exact: true })
      .first()
      .click();
    await settled();
    assert.deepEqual(
      await page
        .locator('#day-plan-selected input')
        .evaluateAll((nodes) => nodes.map((n) => n.value)),
      ['6', '12'],
    );
    assert.deepEqual(
      await page
        .locator('#day-plan-selected select')
        .evaluateAll((nodes) => nodes.map((n) => n.value)),
      ['none', 'short'],
    );
    assert.equal(await page.locator('#day-total-xp').inputValue(), '1368');
    assert.equal(await page.locator('#day-reward-xp').inputValue(), '900');
    assert.match(
      await page.locator('#day-plan-result').innerText(),
      /1 kurze \/ 0 lange Rasten geplant/,
    );
    await page
      .getByRole('button', { name: 'Wachpatrouille nach unten', exact: true })
      .first()
      .click();
    await settled();
    assert.deepEqual(
      await page
        .locator('#day-plan-selected input')
        .evaluateAll((nodes) => nodes.map((n) => n.value)),
      ['12', '6'],
    );
    assert.deepEqual(
      await page
        .locator('#day-plan-selected select')
        .evaluateAll((nodes) => nodes.map((n) => n.value)),
      ['short', 'none'],
    );
    assert.equal(await page.locator('#day-total-xp').inputValue(), '1368');
    await page
      .getByRole('button', { name: 'Wachpatrouille nach oben', exact: true })
      .last()
      .click();
    await settled();
    assert.deepEqual(
      await page
        .locator('#day-plan-selected input')
        .evaluateAll((nodes) => nodes.map((n) => n.value)),
      ['6', '12'],
    );
    assert.deepEqual(
      await page
        .locator('#day-plan-selected select')
        .evaluateAll((nodes) => nodes.map((n) => n.value)),
      ['none', 'short'],
    );
    const planLayout = await page.locator('#day-plan-selected .day-plan-row').evaluateAll((rows) =>
      rows.map((row) => {
        const title = row.querySelector('strong'),
          r = title.getBoundingClientRect(),
          size = parseFloat(getComputedStyle(title).fontSize),
          bounds = row.getBoundingClientRect();
        return {
          title: title.textContent,
          width: r.width,
          height: r.height,
          fontSize: size,
          controlsFit: [...row.querySelectorAll('input,select,button')].every((n) => {
            const b = n.getBoundingClientRect();
            return b.left >= bounds.left - 1 && b.right <= bounds.right + 1;
          }),
        };
      }),
    );
    for (const row of planLayout) {
      assert.equal(row.title, 'Wachpatrouille');
      assert(row.width > 100);
      assert(row.height < row.fontSize * 2, 'short source name remains on one readable line');
      assert(row.controlsFit);
    }
    await page.locator('#day-plan-selected').scrollIntoViewIfNeeded();
    await capture(page, 'split-plan-' + variant);
    await page.locator('#day-custom').click();
    await settled();
    assert.equal(
      await page.getByRole('spinbutton', { name: 'Level Zeile 1', exact: true }).inputValue(),
      '4',
    );
    assert.equal(await page.locator('#day-total-xp').inputValue(), '1368');
    await page.locator('#day-active').click();
    await settled();
    await native.close();
    results.push({
      zoom,
      partyReads: partyReads.length,
      failedReads: failedReads.length,
      planLayout,
    });
  }
  const checked = new CampaignStore(file);
  try {
    assert.deepEqual(
      checked.db.prepare('SELECT * FROM encounter_plan ORDER BY id').all(),
      sourceBefore,
    );
    for (const [i, table] of ['roster_member', 'character_progress', 'live_scene'].entries())
      assert.deepEqual(
        checked.db.prepare('SELECT * FROM ' + table + ' ORDER BY id').all(),
        before[i],
      );
  } finally {
    checked.close();
  }
  await native.finish({
    complete: true,
    results,
    partyFactsUnchanged: true,
    sourceUnchanged: true,
    splitPlanRestart: true,
  });
  console.log(JSON.stringify({ results, partyFactsUnchanged: true }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
