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
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/archive-evidence');
const group = await currentProcessGroup();
await mkdir(output, { recursive: true });
const require = createRequire(source + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/desktop/archive-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(source + '/.build/desktop/archive-store.cjs');
const profile = await mkdtemp('/tmp/gm-archive-'),
  file = profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Rückblick am Spieltisch'),
  w = store.activate(campaign.id),
  command = (action) => ({
    commandId: randomUUID(),
    token: w.token,
    campaignId: campaign.id,
    action,
  });
const heroes = ['Ada', 'Borin'].map(
  (name) => store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
);
let scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 2 })).scene;
for (const c of heroes) {
  const v = store.live(w.token);
  store.executeLive(
    command({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: v.rosterRevision,
      active: true,
      targetSceneId: scene.id,
      expectedFocusRevision: v.focusRevision,
    }),
  );
}
scene = store.live(w.token).scene;
store.executeLive(
  command({
    kind: 'scene-content',
    sceneId: scene.id,
    expectedRevision: scene.revision,
    title: 'Am alten Tor',
    notes: '  Geheim: Silberzeichen.\r\n- Schlüssel behalten',
    locationId: null,
  }),
);
scene = store.live(w.token).scene;
const combats = [];
for (const title of ['Torwache', 'Kellerwolf']) {
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
      name: title === 'Torwache' ? 'Wache' : 'Wolf',
      count: 1,
      grouped: false,
      maxHp: 8,
      armorClass: 12,
      initiativeBonus: 1,
    }),
    combatId: c.id,
    expectedRevision: c.revision,
  }).combat;
  c = store.executeCombat({
    ...command({ kind: 'notes', title, notes: '  Beleg: ' + title + '\r\n- ungeklärt' }),
    combatId: c.id,
    expectedRevision: c.revision,
  }).combat;
  combats.push(c);
}
const chase = store.executeChase({
  ...command({ kind: 'create', title: 'Flucht zum Hafen', goal: 'Boot erreichen' }),
  sceneId: scene.id,
  chaseId: null,
  expectedRevision: null,
}).chase;
const live = store.live(w.token);
store.executeLive(
  command({
    kind: 'move',
    sceneId: scene.id,
    expectedRosterRevision: live.rosterRevision,
    expectedFocusRevision: live.focusRevision,
    expectedClockRevision: scene.clock.revision,
    expectedSceneMembershipRevision: scene.membershipRevision,
    memberIds: heroes.map((c) => c.id),
    target: { kind: 'new', title: 'Am Hafen', expectedContentRevision: scene.revision },
  }),
);
assert.equal(store.liveArchives(w.token, null).items.length, 1);
const original = JSON.stringify({
  live: store.live(w.token),
  masks: combats.map((c) => store.combat(w.token, scene.id, c.id)),
  chase: store.chase(w.token, scene.id, chase.id),
});
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
  await page.locator('#campaigns').selectOption(campaign.id);
  await page.locator('#live-tab').click();
  await page.locator('#live-continue').click();
  await page.locator('#combat-panel').waitFor({ state: 'visible' });
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
  await app.evaluate(({ ipcMain }, id) => {
    const original = ipcMain._invokeHandlers.get('campaign:live-scene');
    let fail = true;
    ipcMain.removeHandler('campaign:live-scene');
    ipcMain.handle('campaign:live-scene', async (e, ...args) => {
      if (fail && args[1] === id) {
        fail = false;
        globalThis.qaArchiveFailed = true;
        return { ok: false, error: 'QA: Archiv vorübergehend nicht lesbar' };
      }
      return original(e, ...args);
    });
  }, scene.id);
  await page.locator('#live-archives').click();
  await page.locator('#archive-dialog').waitFor({ state: 'visible' });
  await page
    .locator('#archive-list')
    .getByRole('button', { name: 'Am alten Tor', exact: true })
    .click();
  for (let i = 0; i < 100; i++) {
    if (await app.evaluate(() => globalThis.qaArchiveFailed)) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert(await app.evaluate(() => globalThis.qaArchiveFailed));
  await page.waitForTimeout(100);
  results.failure = {
    detail: await page.locator('#archive-detail').innerText(),
    localError: await page
      .locator('#archive-dialog')
      .getByText('QA: Archiv vorübergehend nicht lesbar', { exact: true })
      .count(),
    retry: await page
      .locator('#archive-detail')
      .getByRole('button', { name: 'Erneut laden', exact: true })
      .count(),
  };
  await page
    .locator('#archive-dialog')
    .screenshot({ path: path.join(output, 'archive-' + phase + '-error.png') });
  if (!before) {
    assert.equal(results.failure.localError, 1);
    assert.equal(results.failure.retry, 1);
    await page
      .locator('#archive-detail')
      .getByRole('button', { name: 'Erneut laden', exact: true })
      .click();
  } else
    await page
      .locator('#archive-list')
      .getByRole('button', { name: 'Am alten Tor', exact: true })
      .click();
  {
    await page.locator('#archive-detail h3').getByText('Am alten Tor', { exact: true }).waitFor();
    assert((await page.locator('#archive-detail').innerText()).includes('Silberzeichen'));
    await page
      .locator('#archive-detail')
      .getByRole('button', { name: /^Kampf: Torwache/ })
      .click();
    await page.locator('#archive-detail h4').getByText('Torwache', { exact: true }).waitFor();
    await app.evaluate(({ ipcMain }, id) => {
      const original = ipcMain._invokeHandlers.get('campaign:combat');
      let hold = true;
      ipcMain.removeHandler('campaign:combat');
      ipcMain.handle('campaign:combat', async (e, ...args) => {
        if (hold && args[2] === id) {
          hold = false;
          globalThis.qaArchiveHeld = true;
          return new Promise((resolve) => {
            globalThis.qaArchiveRelease = async () => resolve(await original(e, ...args));
          });
        }
        return original(e, ...args);
      });
    }, combats[1].id);
    await page
      .locator('#archive-detail')
      .getByRole('button', { name: /^Kampf: Kellerwolf/ })
      .click();
    for (let i = 0; i < 100; i++) {
      if (await app.evaluate(() => globalThis.qaArchiveHeld)) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert(await app.evaluate(() => globalThis.qaArchiveHeld));
    results.loadingText = await page
      .locator('#archive-detail section > div:last-child')
      .innerText();
    if (!before) {
      assert(results.loadingText.includes('Kellerwolf'));
      assert(!results.loadingText.includes('Beleg: Torwache'));
    }
    await app.evaluate(() => globalThis.qaArchiveRelease());
    await page.locator('#archive-detail h4').getByText('Kellerwolf', { exact: true }).waitFor();
    await page
      .locator('#archive-detail')
      .getByRole('button', { name: /^Verfolgung: Flucht/ })
      .click();
    await page
      .locator('#archive-detail h4')
      .getByText('Flucht zum Hafen', { exact: true })
      .waitFor();
    assert((await page.locator('#archive-detail').innerText()).includes('Boot erreichen'));
    await page
      .locator('#archive-dialog')
      .screenshot({ path: path.join(output, 'archive-' + phase + '.png') });
    await page.locator('#archive-close').click();
    assert.equal(await page.locator('#running-title').inputValue(), 'Am Hafen');
    results.returnedToCurrent = true;
  }
  await close();
  const fresh = new CampaignStore(file);
  try {
    const active = fresh.activate(campaign.id);
    assert.equal(
      JSON.stringify({
        live: fresh.live(active.token),
        masks: combats.map((c) => fresh.combat(active.token, scene.id, c.id)),
        chase: fresh.chase(active.token, scene.id, chase.id),
      }),
      original,
    );
    results.readOnlyFresh = true;
  } finally {
    fresh.close();
  }
  if (!before) {
    page = await launch();
    await page.locator('#live-archives').click();
    await page
      .locator('#archive-list')
      .getByRole('button', { name: 'Am alten Tor', exact: true })
      .click();
    await page.locator('#archive-detail h3').getByText('Am alten Tor', { exact: true }).waitFor();
    await page.locator('#archive-close').click();
    assert.equal(await page.locator('#running-title').inputValue(), 'Am Hafen');
    await close();
    results.nativeRestart = true;
  }
  await writeFile(
    path.join(output, 'archive-' + phase + '.json'),
    JSON.stringify({ results, launches, normalClose: true }, null, 2),
  );
  console.log(JSON.stringify({ results, normalClose: true }));
  assert.equal(results.failure.localError, 1, 'An archive error must be visible inside the modal');
  assert.equal(results.failure.retry, 1);
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
