import { currentProcessGroup } from './process-group.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const pending = process.argv.includes('--pending');
const source = process.cwd(),
  before = process.argv.includes('--before'),
  layoutBefore = process.argv.includes('--layout-before'),
  phase = (pending ? 'pending-' : 'error-') + (before ? 'before' : 'after'),
  mode = process.argv.includes('--combat')
    ? 'combat'
    : process.argv.includes('--chase')
      ? 'chase'
      : 'scene',
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/player-blank-evidence');
const group = await currentProcessGroup();
await mkdir(output, { recursive: true });
const require = createRequire(source + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/desktop/player-blank-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(source + '/.build/desktop/player-blank-store.cjs');
const profile = await mkdtemp('/tmp/gm-player-scene-'),
  file = profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Getrennte Spieler- und GM-Texte'),
  w = store.activate(campaign.id),
  command = (action) => ({
    commandId: randomUUID(),
    token: w.token,
    campaignId: campaign.id,
    action,
  });
const character = store.executeLive(
  command({ kind: 'create-character', profile: { name: 'Ada' } }),
).character;
const scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 1 })).scene;
store.executeLive(
  command({
    kind: 'membership',
    characterId: character.id,
    expectedRevision: 0,
    expectedRosterRevision: 1,
    active: true,
    targetSceneId: scene.id,
    expectedFocusRevision: 0,
  }),
);
const gmTitle = 'Hinterhalt: Der freundliche Wirt ist ein Vampir',
  gmNotes = 'GM-GEHEIM: Schlüssel unter der Falltür',
  publicText = '  Am Tor wartet ein freundlicher Wirt.\n\n  Er winkt euch zu.  ';
store.executeLive(
  command({
    kind: 'scene-content',
    sceneId: scene.id,
    expectedRevision: 0,
    title: gmTitle,
    readAloud: publicText,
    notes: gmNotes,
    locationId: null,
  }),
);
let mask = null;
if (mode === 'combat') {
  mask = store.executeCombat({
    ...command({
      kind: 'create',
      sceneId: scene.id,
      title: gmTitle,
      includeParty: true,
      expectedMembershipRevision: 1,
    }),
    combatId: null,
    expectedRevision: null,
  }).combat;
  mask = store.executeCombat({
    ...command({ kind: 'start' }),
    combatId: mask.id,
    expectedRevision: mask.revision,
  }).combat;
} else if (mode === 'chase') {
  mask = store.executeChase({
    ...command({ kind: 'create', title: gmTitle, goal: gmNotes }),
    sceneId: scene.id,
    chaseId: null,
    expectedRevision: null,
  }).chase;
  mask = store.executeChase({
    ...command({
      kind: 'participants',
      participants: [
        {
          id: randomUUID(),
          characterId: character.id,
          name: 'Ada',
          side: 'quarry',
          distance: 18,
          speed: 9,
          exhaustion: 0,
          notes: gmNotes,
        },
      ],
    }),
    sceneId: scene.id,
    chaseId: mask.id,
    expectedRevision: mask.revision,
  }).chase;
}
const originalMask = mask
  ? store.db.prepare('SELECT payload,checksum FROM ' + mode + ' WHERE id=?').get(mask.id)
  : null;
const original = store.db.prepare('SELECT * FROM live_scene WHERE id=?').get(scene.id);
const v = store.playerView(w.token);
store.executePlayer({
  ...command({
    kind: 'settings',
    settings: {
      blank: false,
      mode: 'scene',
      imageId: null,
      title: '',
      labels: false,
      light: 'daylight',
      displayId: null,
      fullscreen: false,
    },
  }),
  expectedRevision: v.settings.revision,
  expectedFocusId: v.focusId,
  expectedFocusRevision: v.focusRevision,
  expectedFocusMembershipRevision: v.focusMembershipRevision,
});
store.playerWindowOpen(w.token, true);
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
async function getPlayer() {
  for (let i = 0; i < 100; i++) {
    const p = app.windows().find((p) => p.url().includes('player-display.html'));
    if (p) return p;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error('Player window missing');
}
try {
  let page = await launch(),
    player = await getPlayer();
  await player.waitForFunction(() =>
    document.querySelector('#player-stage').classList.contains('player-scene'),
  );
  await app.evaluate(({ ipcMain }, pending) => {
    globalThis.__qaBlank = { reads: 0, writes: [] };
    const execute = ipcMain._invokeHandlers.get('player:execute');
    ipcMain.removeHandler('player:view');
    ipcMain.handle('player:view', () => {
      const s = globalThis.__qaBlank;
      s.reads++;
      if (pending)
        return new Promise(
          (resolve) =>
            (s.release = () => resolve({ ok: false, error: 'QA: Spielersteuerung nicht lesbar.' })),
        );
      return { ok: false, error: 'QA: Spielersteuerung nicht lesbar.' };
    });
    ipcMain.removeHandler('player:execute');
    ipcMain.handle('player:execute', (event, ...args) => {
      globalThis.__qaBlank.writes.push(args[0].action.kind);
      return execute(event, ...args);
    });
  }, pending);
  await page.locator('#running-player-blank').click();
  if (before) {
    if (pending) {
      for (let i = 0; i < 100 && !(await app.evaluate(() => globalThis.__qaBlank.reads)); i++)
        await new Promise((r) => setTimeout(r, 10));
      assert.equal(await app.evaluate(() => globalThis.__qaBlank.reads), 1);
    } else
      await page.waitForFunction(() =>
        document.querySelector('#status').textContent.includes('QA: Spielersteuerung'),
      );
  } else
    await player.waitForFunction(() =>
      document.querySelector('#player-stage').classList.contains('player-blank'),
    );
  results.frame = await player.evaluate(() => window.playerDisplay.frame());
  results.dom = await player.locator('#player-stage').textContent();
  results.calls = await app.evaluate(() => ({
    reads: globalThis.__qaBlank.reads,
    writes: globalThis.__qaBlank.writes,
  }));
  assert.equal(results.frame.value.frame.mode, before ? 'scene' : 'blank');
  assert.deepEqual(results.calls, { reads: before ? 1 : 0, writes: before ? [] : ['blank'] });
  await player.screenshot({ path: path.join(output, 'blank-' + phase + '.png') });
  if (before && pending) await app.evaluate(() => globalThis.__qaBlank.release());
  await close();
  if (!before) {
    page = await launch();
    player = await getPlayer();
    await player.waitForFunction(() =>
      document.querySelector('#player-stage').classList.contains('player-blank'),
    );
    results.restartStayedBlank = true;
    await close();
  }
  const fresh = new CampaignStore(file);
  try {
    const next = fresh.activate(campaign.id),
      view = fresh.playerView(next.token);
    assert.equal(view.settings.blank, !before);
    assert.deepEqual(
      fresh.db.prepare('SELECT * FROM live_scene WHERE id=?').get(scene.id),
      original,
    );
    results.persistedBlank = view.settings.blank;
    results.sceneUnchanged = true;
  } finally {
    fresh.close();
  }
  await writeFile(
    path.join(output, 'blank-' + phase + '.json'),
    JSON.stringify({ results, launches, normalClose: true }, null, 2),
  );
  console.log(JSON.stringify({ results, normalClose: true }));
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
