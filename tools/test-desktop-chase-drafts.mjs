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
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/chase-drafts-evidence');
const group = await currentProcessGroup();
await mkdir(output, { recursive: true });
const require = createRequire(source + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/desktop/chase-drafts-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(source + '/.build/desktop/chase-drafts-store.cjs');
const profile = await mkdtemp('/tmp/gm-chase-drafts-'),
  file = profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Zwei unabhängige Verfolgungen'),
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
const chases = [];
for (const [title, name] of [
  ['Hafenflucht', 'Kurier'],
  ['Waldpfad', 'Späher'],
]) {
  let c = store.executeChase({
    ...command({ kind: 'create', title, goal: 'Tor erreichen' }),
    sceneId: scene.id,
    chaseId: null,
    expectedRevision: null,
  }).chase;
  c = store.executeChase({
    ...command({
      kind: 'participant',
      participant: {
        id: randomUUID(),
        characterId: null,
        name,
        side: 'quarry',
        distance: 18,
        speed: 9,
        exhaustion: 0,
        notes: '  Hinweis\r\n- Tor',
      },
    }),
    sceneId: scene.id,
    chaseId: c.id,
    expectedRevision: c.revision,
  }).chase;
  chases.push(c);
}
const [a, b] = chases;
const originalA = store.db.prepare('SELECT payload,checksum FROM chase WHERE id=?').get(a.id);
store.close();
const busPath = profile + '/qa-bus',
  proxy = spawn(
    'xdg-dbus-proxy',
    [
      process.env.DBUS_SESSION_BUS_ADDRESS,
      busPath,
      '--filter',
      '--talk=org.freedesktop.portal.Desktop',
      '--talk=org.freedesktop.Notifications',
    ],
    { stdio: 'ignore' },
  );
for (let i = 0; i < 100; i++) {
  if (
    await stat(busPath)
      .then(() => true)
      .catch(() => false)
  )
    break;
  await new Promise((r) => setTimeout(r, 20));
}
let app,
  pid,
  closed = false;
const errors = [],
  launches = [],
  results = {};
async function launch() {
  closed = false;
  app = await _electron.launch({
    executablePath: source + '/node_modules/electron/dist/electron',
    args: [source + '/.build/desktop/main.cjs', '--data-dir', profile],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + busPath },
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
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: /Öffnen|Fortsetzen/ })
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
  if (await page.locator('#live-continue').isVisible())
    await page.locator('#live-continue').click();
  await page.locator('#combat-panel').waitFor({ state: 'visible' });
  await page.waitForFunction(() =>
    document.querySelector('#chase-status').textContent.startsWith('Waldpfad ·'),
  );
  return page;
}
async function close() {
  assert.deepEqual(errors, []);
  const exit = new Promise((r) =>
    app.process().once('exit', (code, signal) => r({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === 'SaltMarcher')
      .close(),
  );
  assert.deepEqual(await exit, { code: 0, signal: null });
  closed = true;
}
try {
  let page = await launch();
  if (!before)
    await app.evaluate(({ ipcMain }) => {
      const original = ipcMain._invokeHandlers.get('campaign:keep-chase-draft');
      let fail = true;
      ipcMain.removeHandler('campaign:keep-chase-draft');
      ipcMain.handle('campaign:keep-chase-draft', async (e, ...args) => {
        if (fail && args[1].fields['chase-complication']) {
          fail = false;
          return { ok: false, error: 'QA: Entwurf vorübergehend nicht speicherbar' };
        }
        return original(e, ...args);
      });
    });
  await page.locator('#chase-people [data-distance]').fill('36');
  await page.locator('#chase-people [data-exhaustion]').fill('1');
  await page.locator('#chase-complication').fill('Umgestürzter Wagen');
  await page.locator('#chase-completion summary').click();
  await page.locator('#chase-outcome').fill('  Ergebnis offen\n- Tor');
  if (!before) {
    await page.locator('#chase-draft-status[role=alert]').waitFor();
    await page.locator('#chase-round').click();
    assert((await page.locator('#chase-status').innerText()).includes('Runde 0'));
    assert.equal(await page.locator('#chase-complication').inputValue(), 'Umgestürzter Wagen');
    await page.locator('#chase-draft-retry').click();
    results.saveFailureRetryPreservesInput = true;
  }
  if (!before)
    await page.waitForFunction(() =>
      document.querySelector('#chase-draft-status').textContent.includes('Entwurf gesichert'),
    );
  await close();
  page = await launch();
  results.afterRestart = {
    distance: await page.locator('#chase-people [data-distance]').inputValue(),
    exhaustion: await page.locator('#chase-people [data-exhaustion]').inputValue(),
    complication: await page.locator('#chase-complication').inputValue(),
    outcome: await page.locator('#chase-outcome').inputValue(),
  };
  if (!before) {
    assert.deepEqual(results.afterRestart, {
      distance: '36',
      exhaustion: '1',
      complication: 'Umgestürzter Wagen',
      outcome: '  Ergebnis offen\n- Tor',
    });
    assert((await page.locator('#chase-status').innerText()).includes('Runde 0'));
    await page.locator('#chase-people summary').click();
    await page
      .locator('#chase-people')
      .getByRole('button', { name: 'Auf Spieleranzeige verbergen', exact: true })
      .click();
    await page
      .locator('#chase-people')
      .getByRole('button', { name: 'Auf Spieleranzeige zeigen', exact: true })
      .waitFor();
    assert.equal(await page.locator('#chase-people [data-distance]').inputValue(), '36');
    assert.equal(await page.locator('#chase-complication').inputValue(), 'Umgestürzter Wagen');
    await page
      .locator('#chase-people')
      .getByRole('button', { name: 'Auf Spieleranzeige zeigen', exact: true })
      .click();
    await page
      .locator('#chase-people')
      .getByRole('button', { name: 'Auf Spieleranzeige verbergen', exact: true })
      .waitFor();
    results.visibilityRetainsUnconfirmedRound = true;
    await page.locator('#chase-status').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'draft-restored.png') });
    await page.locator('#chase-people [data-distance]').fill('');
    await page.waitForFunction(() =>
      document.querySelector('#chase-draft-status').textContent.includes('Entwurf gesichert'),
    );
    assert.equal(await page.locator('#chase-round').isEnabled(), false);
    await page.evaluate(() => document.querySelector('#chase-round').onclick());
    assert((await page.locator('#chase-status').innerText()).includes('Runde 0'));
    await close();
    page = await launch();
    assert.equal(await page.locator('#chase-people [data-distance]').inputValue(), '');
    assert.equal(await page.locator('#chase-round').isEnabled(), false);
    results.emptyRawDistanceRestart = true;
    await page.locator('#chase-people [data-distance]').fill('36');
    await page.locator('#chase-round').click();
    await page.waitForFunction(() =>
      document.querySelector('#chase-status').textContent.includes('Runde 1'),
    );
    assert.equal(await page.locator('#chase-complication').inputValue(), '');
  }
  await page.locator('#chase-status').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'draft-' + phase + '.png') });
  await close();
  const fresh = new CampaignStore(file);
  try {
    const active = fresh.activate(campaign.id),
      ca = fresh.chase(active.token, scene.id, a.id).chase,
      cb = fresh.chase(active.token, scene.id, b.id).chase;
    results.rounds = { a: ca.round, b: cb.round };
    if (!before) {
      assert.deepEqual(
        fresh.db.prepare('SELECT payload,checksum FROM chase WHERE id=?').get(a.id),
        originalA,
      );
      assert.equal(cb.round, 1);
      assert.equal(cb.participants[0].distance, 36);
      assert.equal(cb.participants[0].exhaustion, 1);
      assert.equal(cb.complication, 'Umgestürzter Wagen');
      const d = fresh.chase(active.token, scene.id, b.id).draft;
      assert.equal(d.fields['chase-outcome'], '  Ergebnis offen\n- Tor');
      assert.deepEqual(d.rows, []);
      assert.equal(d.fields['chase-complication'], undefined);
      results.atomicRoundDraftConsumption = true;
    }
  } finally {
    fresh.close();
  }
  await writeFile(
    path.join(output, 'draft-' + phase + '.json'),
    JSON.stringify({ results, launches, normalClose: true }, null, 2),
  );
  console.log(JSON.stringify({ results, normalClose: true }));
  assert.equal(
    results.afterRestart.distance,
    '36',
    'Unconfirmed distance must survive native restart',
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
  if (app && !closed) {
    await Promise.race([app.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
    if ((await readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '')).includes(profile))
      process.kill(pid, 'SIGKILL');
  }
  proxy.kill();
}
