import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  out = path.resolve(process.argv[2] ?? '.build/session-source-order');
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/session-source-order-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/session-source-order-store.cjs'),
  profile = await mkdtemp('/tmp/session-order-'),
  file = profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Nordmark · gespeicherter Spielabend'),
  w = store.activate(campaign.id),
  planId = randomUUID();
const command = (action) => ({
  commandId: randomUUID(),
  campaignId: campaign.id,
  token: w.token,
  action,
});
store.changePreparation({
  ...command(null),
  change: {
    kind: 'plan',
    expectedRevision: null,
    plan: { version: 1, id: planId, revision: 1, name: 'Nordmark', scenes: [] },
  },
});
store.executeSession(
  command({
    kind: 'profile',
    expectedRevision: 0,
    profile: {
      planId,
      revision: 0,
      party: [
        { id: 'a', name: 'Gruppe A', level: 3, count: 2 },
        { id: 'b', name: 'Gruppe B', level: 4, count: 2 },
      ],
      adventureDayFraction: '0.6',
      seed: '179974',
      encounterCount: 3,
    },
  }),
);
const tables = ['Wache', 'Wildernis'].map((name) => ({
  id: randomUUID(),
  revision: 0,
  scope: 'campaign',
  name,
  description: '',
  entries: ['guard', 'goblin', 'ogre', 'wolf'].map((creatureId) => ({ creatureId, weight: '1' })),
  habitats: [],
  time: 'any',
  lootTableId: null,
  trashed: false,
}));
for (const table of tables)
  store.executeGeneration(command({ kind: 'table-save', expectedRevision: null, table }));
const registry = store.generatorRegistry(w.token),
  defaults = registry.presets.find((p) => p.id === registry.effectiveId).config.generationDefaults;
const run = store.generateSession(w.token, {
  planId,
  expectedProfileRevision: 1,
  count: 3,
  worldSourcesByLocation: true,
  locationIds: [],
  noteIds: [],
  encounter: {
    tableIds: tables.map((t) => t.id),
    filters: {},
    habitat: '',
    time: 'any',
    difficulty: 'weighted',
    amount: defaults.amount,
    balance: defaults.balance,
    diversity: defaults.diversity,
  },
});
store.executeSession(
  command({
    kind: 'edit-proposal',
    planId,
    runId: run.id,
    index: 0,
    expectedRevision: 1,
    title: 'Meine Brücke',
    notes: 'Eigener Text\r\n',
    readAloud: 'Still.',
    locationId: null,
    noteIds: [],
    reward: { poolXp: 11, items: [] },
  }),
);
const saved = Object.fromEntries(
  ['session_run', 'generation_run'].map((table) => [
    table,
    store.db.prepare('SELECT * FROM ' + table + ' ORDER BY id').all(),
  ]),
);
store.close();
const busPath = profile + '/bus',
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
  closed = true;
const errors = [],
  artifacts = {};
for (const p of ['main.cjs', 'preload.cjs', 'ui/renderer.js'])
  artifacts[p] = createHash('sha256')
    .update(await readFile('.build/desktop/' + p))
    .digest('hex');
try {
  app = await _electron.launch({
    executablePath: root + '/node_modules/electron/dist/electron',
    args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + busPath },
    timeout: 30000,
  });
  closed = false;
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  if (await page.locator('#tutorial-dialog').isVisible())
    await page.locator('#tutorial-skip').click();
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: 'Fortsetzen', exact: true })
    .click();
  await page.locator('#workspace-navigation').waitFor({ state: 'visible' });
  if (!(await page.locator('#preparation-tab').isVisible()))
    await page.locator('#workspace-nav-summary').click();
  await page.locator('#preparation-tab').click();
  await page.locator('#preparation-planning').click();
  await page.locator('#plans').selectOption(planId);
  await page.locator('#session-panel').evaluate((e) => {
    e.open = true;
  });
  await page.locator('#session-generation-options').evaluate((e) => {
    e.open = true;
  });
  await page.locator('#session-table-picks').evaluate((e) => {
    e.closest('details').open = true;
  });
  for (const table of tables)
    await page.locator('#session-table-picks input[value="' + table.id + '"]').check();
  async function generate() {
    await page.locator('#session-generate').click();
    await page.waitForFunction(() =>
      document
        .querySelector('#session-generation-feedback')
        .textContent.startsWith('Gespeicherte Vorschau geöffnet'),
    );
    assert.match(await page.locator('#session-preview').innerText(), /Meine Brücke/);
  }
  await generate();
  // Controlled presentation-order perturbation: same checked sources, different DOM/read order.
  const before = await page
    .locator('#session-table-picks input:checked')
    .evaluateAll((nodes) => nodes.map((n) => n.value));
  await page.locator('#session-table-picks').evaluate((e) => e.append(e.firstElementChild));
  const after = await page
    .locator('#session-table-picks input:checked')
    .evaluateAll((nodes) => nodes.map((n) => n.value));
  assert.deepEqual(after, before.slice().reverse());
  await generate();
  await page.locator('#session-preview').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, 'same-edited-preview.png') });
  const ended = new Promise((resolve) =>
    app.process().once('exit', (code, signal) => resolve({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith('/index.html'))
      .close(),
  );
  const exit = await ended;
  assert.deepEqual(exit, { code: 0, signal: null });
  closed = true;
  const fresh = new CampaignStore(file);
  try {
    for (const table of Object.keys(saved))
      assert.deepEqual(
        fresh.db.prepare('SELECT * FROM ' + table + ' ORDER BY id').all(),
        saved[table],
      );
  } finally {
    fresh.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, 'result.json'),
    JSON.stringify(
      {
        head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        workingTree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
        profile,
        runId: run.id,
        before,
        after,
        exit,
        errors,
        artifacts,
        immutableRowsUnchanged: true,
        presentationOrderPerturbed: true,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ runId: run.id, exit, immutableRowsUnchanged: true }));
} catch (error) {
  await writeFile(
    path.join(out, 'failure.json'),
    JSON.stringify({ error: error.stack, profile, errors }, null, 2),
  );
  if (app && !closed)
    try {
      await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') });
    } catch {}
  throw error;
} finally {
  if (app && !closed) await app.close();
  proxy.kill();
}
