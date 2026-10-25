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
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/npc-switch-evidence');
const group = await currentProcessGroup();
await mkdir(output, { recursive: true });
const require = createRequire(source + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/desktop/npc-switch-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(source + '/.build/desktop/npc-switch-store.cjs');
const profile = await mkdtemp('/tmp/gm-npc-switch-'),
  file = profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('NSCs während des Spiels wechseln'),
  w = store.activate(campaign.id);
const npcs = [];
for (const name of ['Hafenmeisterin Mira', 'Späher Borin']) {
  const id = randomUUID();
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
        creatureId: name === 'Späher Borin' ? 'goblin' : null,
        readAloud: '  Ein ruhiger Blick.\r\n- Reisemantel',
        gmNotes: 'Original: ' + name,
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
        health: null,
      },
    }),
  );
}
const [a, b] = npcs;
const originals = JSON.stringify(npcs);
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
    .locator('.campaign-card')
    .filter({ hasText: campaign.name })
    .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
  );
  if (await page.locator('#atlas-navigation').isVisible())
    await page.locator('#atlas-navigation').click();
  if (!(await page.locator('#groups-tab').isVisible()))
    await page.locator('#workspace-nav-summary').click();
  await page.locator('#groups-tab').click();
  await page.waitForFunction(() => document.querySelectorAll('#npc-list button').length === 2);
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
  const choose = async (npc, expectedName = npc.name) => {
    await page
      .locator('#npc-list')
      .getByRole('button', { name: new RegExp('^' + npc.name + ' ·') })
      .click();
    await page.waitForFunction(
      (name) => document.querySelector('#npc-name').value === name,
      expectedName,
    );
  };
  await choose(a);
  await page.locator('#npc-name').fill('');
  await page.locator('#npc-gmNotes').fill('Unfertiger Hinweis: rotes Segel');
  await page.waitForFunction(() =>
    document.querySelector('#npc-save-status').textContent.includes('Entwurf gesichert'),
  );
  await app.evaluate(({ ipcMain }, id) => {
    const original = ipcMain._invokeHandlers.get('campaign:npc-draft');
    let hold = true;
    ipcMain.removeHandler('campaign:npc-draft');
    ipcMain.handle('campaign:npc-draft', async (e, ...args) => {
      const result = await original(e, ...args);
      if (hold && args[1] === id) {
        hold = false;
        globalThis.qaNpcHeld = true;
        return new Promise((resolve) => {
          globalThis.qaNpcRelease = () => resolve(result);
        });
      }
      return result;
    });
  }, b.id);
  await page
    .locator('#npc-list')
    .getByRole('button', { name: new RegExp('^' + b.name + ' ·') })
    .click();
  for (let i = 0; i < 100; i++) {
    if (await app.evaluate(() => globalThis.qaNpcHeld)) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert(await app.evaluate(() => globalThis.qaNpcHeld));
  results.duringSwitch = {
    visible: await page.locator('#npc-gmNotes').inputValue(),
    notesEnabled: await page.locator('#npc-gmNotes').isEnabled(),
    submitEnabled: await page
      .locator('#npc-editor')
      .getByRole('button', { name: 'NPC übernehmen', exact: true })
      .isEnabled(),
  };
  if (before)
    await page.locator('#npc-gmNotes').fill('Zusatz während des Wechsels: silberner Ring');
  else {
    assert.equal(results.duringSwitch.notesEnabled, false);
    assert.equal(results.duringSwitch.submitEnabled, false);
    await page.locator('#npc-load-status').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'npc-loading.png') });
  }
  await app.evaluate(() => globalThis.qaNpcRelease());
  await page.waitForFunction((name) => document.querySelector('#npc-name').value === name, b.name);
  await page.waitForTimeout(600);
  if (!before) {
    await choose(a, '');
    assert.equal(await page.locator('#npc-name').inputValue(), '');
    assert.equal(
      await page.locator('#npc-gmNotes').inputValue(),
      'Unfertiger Hinweis: rotes Segel',
    );
    await app.evaluate(({ ipcMain }, id) => {
      const original = ipcMain._invokeHandlers.get('campaign:npc-draft');
      let fail = true;
      ipcMain.removeHandler('campaign:npc-draft');
      ipcMain.handle('campaign:npc-draft', async (e, ...args) => {
        if (fail && args[1] === id) {
          fail = false;
          return { ok: false, error: 'QA: NSC vorübergehend nicht lesbar' };
        }
        return original(e, ...args);
      });
    }, b.id);
    await page
      .locator('#npc-list')
      .getByRole('button', { name: new RegExp('^' + b.name + ' ·') })
      .click();
    await page.locator('#npc-load-status[role=alert]').waitFor();
    assert.equal(await page.locator('#npc-gmNotes').isEnabled(), false);
    await page.locator('#npc-load-status').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'npc-read-error.png') });
    await page.locator('#npc-load-retry').click();
    await page.waitForFunction(
      (name) => document.querySelector('#npc-name').value === name,
      b.name,
    );
    results.failedReadRetry = true;
    await page.locator('#npc-gmNotes').fill('Borin kennt den Fluchtweg');
    await page
      .locator('#npc-editor')
      .getByRole('button', { name: 'NPC übernehmen', exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelector('#npc-save-status').textContent === 'Gespeicherter Stand.',
    );
    await choose(a, '');
    assert.equal(await page.locator('#npc-name').inputValue(), '');
    assert.equal(
      await page.locator('#npc-gmNotes').inputValue(),
      'Unfertiger Hinweis: rotes Segel',
    );
    results.draftSurvivesOtherNpcWrite = true;
    await choose(b);
    await page.locator('#npc-enter').click();
    await page.locator('#combat-panel').waitFor({ state: 'visible' });
    await page
      .locator('#combat-rows .combat-health')
      .and(page.getByRole('button', { name: new RegExp('^' + b.name + ' ·') }))
      .click();
    assert.equal(await page.locator('#fighter-hp').inputValue(), String(b.health.hp));
    await page.locator('#fighter-amount').fill('1');
    await page.locator('#fighter-damage').click();
    await page.waitForFunction(
      (hp) => document.querySelector('#fighter-hp').value === String(hp),
      b.health.hp - 1,
    );
    if (await page.locator('#atlas-navigation').isVisible())
      await page.locator('#atlas-navigation').click();
    if (!(await page.locator('#groups-tab').isVisible()))
      await page.locator('#workspace-nav-summary').click();
    await page.locator('#groups-tab').click();
    await choose(b);
    assert.equal(await page.locator('#npc-hp').inputValue(), String(b.health.hp - 1));
    await choose(a, '');
    assert.equal(
      await page.locator('#npc-gmNotes').inputValue(),
      'Unfertiger Hinweis: rotes Segel',
    );
    results.nativeNpcCombatHealthShared = true;
  }
  await page.locator('#npc-save-status').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'npc-' + phase + '.png') });
  await close();
  const fresh = new CampaignStore(file);
  try {
    const active = fresh.activate(campaign.id),
      da = fresh.npcDraft(active.token, a.id),
      ca = fresh.npc(active.token, a.id),
      cb = fresh.npc(active.token, b.id);
    results.aDraftNotes = da?.fields.gmNotes;
    results.aDraftName = da?.fields.name;
    if (!before) assert.equal(da.fields.readAloud, a.readAloud);
    assert.deepEqual(ca, a);
    assert.equal(cb.gmNotes, before ? b.gmNotes : 'Borin kennt den Fluchtweg');
    assert.equal(cb.readAloud, b.readAloud);
    if (!before) {
      assert.equal(cb.health.hp, b.health.hp - 1);
      assert.equal(
        fresh
          .combat(active.token, fresh.live(active.token).focusId)
          .combat.participants.find((p) => p.worldActorId === b.id).hp,
        b.health.hp - 1,
      );
    }
    results.untouchedCrlfPreserved = true;
    results.originalAUnchanged = true;
    results.otherNpcOnlyExplicitWrite = true;
  } finally {
    fresh.close();
  }
  if (!before) {
    page = await launch();
    await choose(a, '');
    assert.equal(await page.locator('#npc-name').inputValue(), '');
    assert.equal(
      await page.locator('#npc-gmNotes').inputValue(),
      'Unfertiger Hinweis: rotes Segel',
    );
    await close();
    results.nativeDraftRestart = true;
  }
  await writeFile(
    path.join(output, 'npc-' + phase + '.json'),
    JSON.stringify({ results, launches, normalClose: true }, null, 2),
  );
  console.log(JSON.stringify({ results, normalClose: true }));
  assert.equal(
    results.duringSwitch.notesEnabled,
    false,
    'Selecting another NPC must lock the previous editor',
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
