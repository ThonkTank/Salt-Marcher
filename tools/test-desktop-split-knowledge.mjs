import { currentProcessGroup } from './process-group.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const snapshot = process.cwd(),
  before = process.argv.includes('--before'),
  phase = before ? 'before' : 'after';
const output =
  process.env.QA_EVIDENCE_DIR ?? path.join(snapshot, '.build/split-knowledge-evidence');
const group = await currentProcessGroup();
await mkdir(output, { recursive: true });
const require = createRequire(snapshot + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/split-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(snapshot + '/.build/split-native-store.cjs');
const profile = await mkdtemp('/tmp/gm-split-knowledge-'),
  file = profile + '/workbench.sqlite';
const room = {
  id: randomUUID(),
  scopeId: 'local',
  floorId: 'ground',
  number: '1',
  name: 'Wachstube',
  revision: 0,
  polygons: [
    {
      outer: [
        { x: 0, y: 0 },
        { x: 9.144, y: 0 },
        { x: 9.144, y: 6.096 },
        { x: 0, y: 6.096 },
      ],
      holes: [],
    },
  ],
  sections: [{ id: randomUUID(), kind: 'markdown', markdown: '  Geschützte GM-Prosa\r\n' }],
};
const store = new CampaignStore(file),
  campaign = store.create('Drei Gruppen', [room]),
  w = store.activate(campaign.id);
const command = (action) => ({
  campaignId: campaign.id,
  token: w.token,
  commandId: randomUUID(),
  action,
});
store.executeLive(
  command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
);
const ids = {};
for (const name of ['Nera', 'Aran', 'Sela']) {
  const c = store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
    v = store.live(w.token);
  ids[name] = c.id;
  store.executeLive(
    command({
      kind: 'membership',
      characterId: c.id,
      expectedRevision: c.membershipRevision,
      expectedRosterRevision: v.rosterRevision,
      active: true,
      targetSceneId: v.focusId,
      expectedFocusRevision: v.focusRevision,
    }),
  );
}
const primary = store.live(w.token).primaryId;
store.executeDrawing(
  command({
    kind: 'key-batch',
    rooms: [{ id: room.id, expectedRevision: 0, keyRevision: null }],
    patch: {
      blocks: [
        {
          id: randomUUID(),
          kind: 'text',
          visibility: 'secret',
          text: 'Ein Bronzeschlüssel liegt in der Schublade.',
          templateId: null,
          suppressed: [],
          searchMethod: 'Genau untersuchen',
          dc: 12,
          discoveryNotes: 'Privater GM-Hinweis',
          revealedText: '',
        },
      ],
    },
  }),
);
store.close();
const busPath = profile + '/qa-session-bus',
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
    executablePath: snapshot + '/node_modules/electron/dist/electron',
    args: [snapshot + '/.build/desktop/main.cjs', '--data-dir', profile],
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
  await page.locator('#running-editor').waitFor({ state: 'visible' });
  return page;
}
async function close() {
  assert.deepEqual(errors, []);
  const exited = new Promise((r) =>
    app.process().once('exit', (code, signal) => r({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === 'SaltMarcher')
      .close(),
  );
  assert.deepEqual(await exited, { code: 0, signal: null });
  closed = true;
}
async function focus(page, id) {
  await page.locator('#live-tab').click();
  await page.locator('#scene-focus').selectOption(id);
  await page.waitForFunction((id) => document.querySelector('#scene-focus').value === id, id);
}
async function split(page, name) {
  await page.locator('#group-move').click();
  await page.locator('#move-dialog').waitFor({ state: 'visible' });
  await page.locator(`#move-members input[value="${ids[name]}"]`).check();
  await page.locator('#move-confirm').click();
  await page.locator('#move-dialog').waitFor({ state: 'hidden' });
  return page
    .locator('#scene-focus option')
    .evaluateAll(
      (options, name) =>
        options.find((o) => o.textContent.includes(name) && !o.textContent.includes('Hauptgruppe'))
          .value,
      name,
    );
}
async function players(page) {
  await page.locator('#player-open-controls').click();
  await page.locator('#player-dialog').waitFor({ state: 'visible' });
  await page.locator('#player-light').selectOption('daylight');
  let player = app.windows().find((p) => p.url().includes('player-display.html'));
  if (player) await page.locator('#player-show-follow').click();
  else {
    const opened = app.waitForEvent('window');
    await page.locator('#player-show-follow').click();
    player = await opened;
  }
  player.on('pageerror', (e) => errors.push(e.stack));
  await page.locator('#player-close-controls').click();
  await player.locator('.player-dungeon').waitFor({ state: 'visible' });
  return player;
}
try {
  let page = await launch();
  await page.locator('#dungeon-tab').click();
  await page.locator('#dungeon-room').selectOption(room.id);
  await page.locator('#dungeon-place').click();
  await page.waitForFunction(() =>
    document.querySelector('#dungeon-key-heading').textContent.includes('Wachstube'),
  );
  await page.locator('#live-tab').click();
  const aran = await split(page, 'Aran');
  await focus(page, primary);
  const sela = await split(page, 'Sela');
  await focus(page, primary);
  await page.locator('#dungeon-tab').click();
  await page
    .locator('#dungeon-key-description')
    .getByRole('button', { name: 'Für Gruppe sichtbar machen', exact: true })
    .click();
  let player = await players(page);
  await player.waitForFunction(() => document.body.innerText.includes('Bronzeschlüssel'));
  await focus(page, aran);
  await page.locator('#dungeon-tab').click();
  await page.waitForFunction(() =>
    document.querySelector('#dungeon-key-heading').textContent.includes('Wachstube'),
  );
  await player.waitForFunction(() => !document.body.innerText.includes('Bronzeschlüssel'));
  results.splitRetainsDungeonPosition = true;
  results.focusFiltersCharacterKnowledge = true;
  await page.locator('#live-tab').click();
  await page.locator('#group-move').click();
  await page.locator('#move-dialog').waitFor({ state: 'visible' });
  results.moveSource = await page.locator('#move-source').innerText();
  results.destinations = await page
    .locator('#move-target option')
    .evaluateAll((options) => options.map((o) => ({ id: o.value, text: o.textContent })));
  await page.locator('#move-target').selectOption(primary);
  await page.screenshot({ path: path.join(output, `split-${phase}.png`) });
  if (!before) {
    assert(results.moveSource.includes('Aran'));
    assert(results.destinations.find((o) => o.id === primary).text.includes('Nera'));
    assert(results.destinations.find((o) => o.id === sela).text.includes('Sela'));
  }
  await page.locator('#move-cancel').click();
  await close();
  if (!before) {
    page = await launch();
    player = await players(page);
    await focus(page, aran);
    await page.locator('#group-move').click();
    await page.locator(`#move-members input[value="${ids.Aran}"]`).check();
    await page.locator('#move-target').selectOption(primary);
    await page.locator('#move-confirm').click();
    await page.locator('#move-dialog').waitFor({ state: 'hidden' });
    await focus(page, primary);
    await player.waitForFunction(() => document.body.innerText.includes('Bronzeschlüssel'));
    await page.locator('#dungeon-tab').click();
    await page.waitForFunction(() =>
      document.querySelector('#dungeon-key-heading').textContent.includes('Wachstube'),
    );
    results.nativeRestartAndRejoin = true;
    await close();
    const fresh = new CampaignStore(file);
    try {
      const live = fresh.activate(campaign.id),
        state = fresh.live(live.token);
      assert.equal(state.roster.find((c) => c.id === ids.Aran).sceneId, primary);
      assert.equal(state.scenes.length, 2);
      assert(state.scenes.every((s) => s.title === ''));
      assert.equal(
        fresh.db
          .prepare('SELECT count(*) n FROM dungeon_key_discovery WHERE character_id=? AND known=1')
          .get(ids.Aran).n,
        0,
      );
      assert.deepEqual(fresh.workspace().rooms[0].sections, room.sections);
      results.authoredTitlesAndLegacyAndPersonalKnowledgePreserved = true;
    } finally {
      fresh.close();
    }
  }
  await writeFile(
    path.join(output, `split-${phase}.json`),
    JSON.stringify({ results, launches, normalClose: true }, null, 2),
  );
  console.log(JSON.stringify({ results, normalClose: true }));
  if (before)
    assert(
      results.destinations.find((o) => o.id === primary).text.includes('Nera'),
      'Rejoin must identify its destination by the participating characters',
    );
} catch (error) {
  if (app && !closed) {
    await writeFile(
      path.join(output, 'failure.json'),
      JSON.stringify({ error: error.stack, results, errors, pid }, null, 2),
    );
    try {
      await (await app.firstWindow()).screenshot({ path: path.join(output, 'failure.png') });
    } catch {}
  }
  throw error;
} finally {
  if (app && !closed) {
    await Promise.race([app.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
    if ((await readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '')).includes(profile))
      process.kill(pid, 'SIGKILL');
  }
  proxy.kill();
}
