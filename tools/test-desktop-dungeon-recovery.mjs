import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Real desktop task: a saved round loses its reply; reconcile without replay,
// preserve newer input, close normally, reopen and finish the original journey.
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core');
const output = root + '/.build/dungeon-recovery-evidence';
await mkdir(output, { recursive: true });
const artifactHashes = {};
for (const file of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
  artifactHashes[file] = createHash('sha256')
    .update(await readFile(root + '/.build/desktop/' + file))
    .digest('hex');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/dungeon-recovery-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/dungeon-recovery-store.cjs'),
  profile = await mkdtemp('/tmp/dungeon-recovery-'),
  file = profile + '/workbench.sqlite';
const store = new CampaignStore(file),
  room = {
    id: randomUUID(),
    scopeId: 'local',
    floorId: 'ground',
    name: 'Langer Gang',
    number: '1',
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 96, y: 0 },
          { x: 96, y: 6 },
          { x: 0, y: 6 },
        ],
        holes: [],
      },
    ],
    sections: [
      {
        id: randomUUID(),
        kind: 'markdown',
        markdown: 'Originaler Gangtext.\r\n  Unveränderte Notiz.\r\n',
      },
    ],
  },
  campaign = store.create('Erkundung im Dungeon', [room]),
  w = store.activateShell(campaign.id);
const command = (action) => ({
  commandId: randomUUID(),
  token: w.token,
  campaignId: campaign.id,
  action,
});
store.tutorial('skipped');
const pc = store.executeLive(
  command({ kind: 'create-character', profile: { name: 'Iri', speedFeet: 30 } }),
).character;
store.executeLive(
  command({
    kind: 'membership',
    characterId: pc.id,
    expectedRevision: pc.membershipRevision,
    expectedRosterRevision: store.live(w.token).rosterRevision,
    active: true,
    targetSceneId: null,
    expectedFocusRevision: null,
  }),
);
const scene = store.executeLive(
  command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
).scene;
store.executeDungeon(
  command({
    kind: 'place',
    sceneId: scene.id,
    expectedPositionRevision: 0,
    pose: { scopeId: 'local', floorId: 'ground', roomId: room.id, x: 1.524, y: 1.524, z: 0 },
  }),
);
const originalDrawing = store.drawing(w.token);
store.close();
const bus = profile + '/bus',
  proxy = spawn(
    'xdg-dbus-proxy',
    [
      process.env.DBUS_SESSION_BUS_ADDRESS,
      bus,
      '--filter',
      '--talk=org.freedesktop.portal.Desktop',
      '--talk=org.freedesktop.Notifications',
    ],
    { stdio: 'ignore' },
  );
for (
  let i = 0;
  i < 100 &&
  !(await stat(bus)
    .then(() => true)
    .catch(() => false));
  i++
)
  await new Promise((r) => setTimeout(r, 20));
let app, token;
const errors = [],
  launches = [],
  results = {};
async function launch(scale) {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [
      root + '/.build/desktop/main.cjs',
      '--ozone-platform=x11',
      '--force-device-scale-factor=' + scale,
      '--data-dir',
      profile,
    ],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + bus },
    timeout: 30000,
  });
  launches.push({ scale, pid: app.process().pid });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: 'Fortsetzen', exact: true })
    .click();
  await page.locator('#live-travel-toggle').click();
  await page.waitForFunction(
    () =>
      document.getElementById('dungeon-travel-controls') &&
      !document.getElementById('dungeon-travel-controls').inert,
  );
  // Obtain the current activation token from a real desktop read, never reuse the fixture token.
  await app.evaluate(({ ipcMain }) => {
    const read = ipcMain._invokeHandlers.get('dungeon:view');
    ipcMain.removeHandler('dungeon:view');
    ipcMain.handle('dungeon:view', (event, t) => {
      globalThis.__dungeonToken = t;
      return read(event, t);
    });
  });
  await page.locator('#dungeon-refresh').click();
  await page.waitForFunction(() => !document.getElementById('dungeon-travel-controls').inert);
  token = await app.evaluate(() => globalThis.__dungeonToken);
  assert(token);
  return page;
}
async function canonical(page) {
  const r = await page.evaluate((t) => window.campaign.dungeon(t), token);
  assert(r.ok, r.error);
  return r.value;
}
async function close() {
  const exited = new Promise((resolve) =>
    app.process().once('exit', (code, signal) => resolve({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith('/index.html'))
      .close(),
  );
  let timer;
  try {
    const exit = await Promise.race([
      exited,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Normal desktop close timed out')), 10000);
      }),
    ]);
    assert.deepEqual(exit, { code: 0, signal: null });
    launches.at(-1).exit = exit;
    app = null;
  } finally {
    clearTimeout(timer);
  }
}
try {
  let page = await launch(1);
  await page.locator('#dungeon-travel-settings > summary').click();
  await page.locator('#dungeon-round-seconds').fill('60');
  await page.locator('#dungeon-pace-save').click();
  await page.waitForFunction(() =>
    document.getElementById('dungeon-round-status').textContent.includes('60 s'),
  );
  await page.locator('#dungeon-duration').fill('6000');
  await page.locator('#dungeon-plan').click();
  await page.waitForFunction(() => !document.getElementById('dungeon-confirm').disabled);
  await page.locator('#dungeon-confirm').click();
  await page.waitForFunction(() =>
    document.getElementById('dungeon-route-status').textContent.includes('Unterwegs'),
  );
  await app.evaluate(({ ipcMain }) => {
    globalThis.__commands = [];
    globalThis.__stateReads = [];
    const execute = ipcMain._invokeHandlers.get('dungeon:execute'),
      state = ipcMain._invokeHandlers.get('dungeon:command-state');
    ipcMain.removeHandler('dungeon:execute');
    ipcMain.handle('dungeon:execute', async (event, c) => {
      globalThis.__commands.push(c);
      const reply = await execute(event, c);
      if (c.action.kind === 'round' && !globalThis.__held) {
        globalThis.__held = true;
        await new Promise((resolve) => (globalThis.__release = resolve));
        throw Error('Kontrollierter Verlust der gespeicherten Dungeonrunde');
      }
      return reply;
    });
    ipcMain.removeHandler('dungeon:command-state');
    ipcMain.handle('dungeon:command-state', (event, c) => {
      globalThis.__stateReads.push(c);
      return globalThis.__stateReads.length === 1
        ? { ok: false, error: 'Kontrollierter Statuslesefehler' }
        : state(event, c);
    });
  });
  await page.locator('#dungeon-round-step').click();
  for (let i = 0; i < 100 && !(await app.evaluate(() => !!globalThis.__release)); i++)
    await new Promise((r) => setTimeout(r, 20));
  assert(await app.evaluate(() => !!globalThis.__release));
  await page.locator('#dungeon-group-speed').fill('12');
  await app.evaluate(() => globalThis.__release());
  await page.locator('#dungeon-reconcile').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#dungeon-travel-controls').evaluate((e) => e.inert), true);
  const saved = await canonical(page);
  assert.equal(saved.instantMs, '60000');
  assert.equal(saved.journey.segmentElapsedSeconds, 60);
  assert((await page.locator('#dungeon-context').innerText()).includes('0 min'));
  results.unknownOutcomeBlocksFurtherWrites = true;
  await page.locator('#dungeon-reconcile').click();
  await page.waitForFunction(() =>
    document.getElementById('status').textContent.includes('Kontrollierter Statuslesefehler'),
  );
  assert.equal(await page.locator('#dungeon-travel-controls').evaluate((e) => e.inert), true);
  await page.locator('#dungeon-reconcile').click();
  await page.waitForFunction(() => document.getElementById('dungeon-reconcile').hidden);
  assert.equal(await page.locator('#dungeon-group-speed').inputValue(), '12');
  assert((await page.locator('#dungeon-context').innerText()).includes('1 min'));
  assert.equal((await canonical(page)).instantMs, '60000');
  const calls = await app.evaluate(() => ({
    commands: globalThis.__commands,
    reads: globalThis.__stateReads,
  }));
  assert.equal(calls.commands.length, 1);
  assert.equal(calls.reads.length, 2);
  assert.deepEqual(calls.reads, [calls.commands[0], calls.commands[0]]);
  results.receiptReadRetryWithoutReplay = true;
  results.newerDraftPreserved = true;
  await page.locator('#dungeon-input-discard').click();
  await page.locator('#dungeon-pause').click();
  await page.waitForFunction(() =>
    document.getElementById('dungeon-route-status').textContent.includes('Pausiert'),
  );
  await page.locator('#dungeon-travel-console').scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + '/reconciled.png' });
  await close();
  page = await launch(2);
  const resumed = await canonical(page);
  assert.equal(resumed.instantMs, '60000');
  assert.equal(resumed.journey.segmentElapsedSeconds, 60);
  assert.equal(resumed.journey.status, 'paused');
  assert(
    (await page.locator('#dungeon-round-status').innerText()).includes('Wiedergabe angehalten'),
  );
  results.restartRetainsExactRemainderAndStopsPlayback = true;
  await page.locator('#dungeon-travel-settings > summary').click();
  await page.locator('#dungeon-round-seconds').fill('1800');
  await page.locator('#dungeon-pace-save').click();
  await page.waitForFunction(() =>
    document.getElementById('dungeon-round-status').textContent.includes('1800 s'),
  );
  await page.locator('#dungeon-pause').click();
  await page.waitForFunction(() =>
    document.getElementById('dungeon-route-status').textContent.includes('Unterwegs'),
  );
  let last = await canonical(page),
    rounds = 0;
  while (last.journey.status === 'active' && rounds++ < 5) {
    const revision = last.journey.revision;
    await page.locator('#dungeon-round-step').click();
    await page.waitForFunction(
      async ({ t, revision }) => {
        const r = await window.campaign.dungeon(t);
        return r.ok && r.value.journey.revision > revision;
      },
      { t: token, revision },
    );
    last = await canonical(page);
  }
  assert.equal(last.journey.status, 'arrived');
  assert.equal(last.instantMs, '6000000');
  assert(Math.abs(last.position.x - 48) < 1e-9);
  assert(Math.abs(last.position.y - 3) < 1e-9);
  results.originalJourneyArrivesAtExactTime = true;
  await page.locator('#dungeon-travel-console').scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + '/arrived-200.png' });
  await close();
  const checked = new CampaignStore(file);
  try {
    const current = checked.activate(campaign.id);
    assert.deepEqual(checked.drawing(current.token), originalDrawing);
    assert.equal(checked.dungeon(current.token).instantMs, '6000000');
    results.authoredGeometryAndNotesUnchanged = true;
  } finally {
    checked.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    output + '/result.json',
    JSON.stringify(
      {
        source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
        profile,
        results,
        errors,
        launches,
        artifactHashes,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ profile, results, launches }));
} catch (error) {
  await writeFile(
    output + '/failure.json',
    JSON.stringify({ error: error.stack, results, errors, launches }, null, 2),
  );
  if (app)
    try {
      await (await app.firstWindow()).screenshot({ path: output + '/failure.png' });
    } catch {}
  throw error;
} finally {
  if (app) {
    await app.evaluate(({ app }) => app.exit(1)).catch(() => {});
    await app.close().catch(() => {});
  }
  proxy.kill();
}
