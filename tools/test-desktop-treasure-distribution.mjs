// Native GM workflow with disposable campaign: split a shared treasure, transfer one potion, close and reopen all inventories.
// Requires build:desktop and desktop:runtime; run via python3 tools/ui-session.py. GM_QA_ZOOM=2 repeats at 200%.
import { currentProcessGroup } from './process-group.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const source = process.cwd(),
  output =
    process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/treasure-distribution-evidence');
const scale = Number(process.env.QA_DEVICE_SCALE ?? 1);
await mkdir(output, { recursive: true });
await rm(path.join(output, 'result.json'), { force: true });
const replyLoss = process.argv.includes('--reply-loss'),
  rejectOnce = process.argv.includes('--reject-once');
const checkout = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  hashes = {};
for (const f of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
  hashes[f] = createHash('sha256')
    .update(await readFile(source + '/.build/desktop/' + f))
    .digest('hex');
const group = await currentProcessGroup();
const require = createRequire(source + '/package.json'),
  { _electron } = require('playwright-core'),
  Database = require('better-sqlite3'),
  storeBundle = path.join(
    source,
    '.build/desktop/treasure-distribution-store-' + process.pid + '.cjs',
  );
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: storeBundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(storeBundle);
const profile = await mkdtemp('/tmp/gm-treasure-'),
  file = profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Beute aus dem Hafenfund'),
  w = store.activate(campaign.id),
  command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    action,
  });
const heroes = ['Ada', 'Borin', 'Cleo'].map(
  (name) => store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
);
const scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 3 })).scene;
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
const treasureId = store.executeProgress(
  command({
    kind: 'treasure',
    sceneId: scene.id,
    title: 'Hafenfund',
    items: [
      { name: 'Goldmünze', category: 'coins', quantity: 101, valueGold: '1' },
      { name: 'Heiltrank', category: 'equipment', quantity: 2, valueGold: '50' },
    ],
  }),
).treasureId;
const originalProgress = store.progress(w.token);
store.tutorial('skipped');
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
  audits = [];
let allocationCommand, allocationReceipt;
async function launch() {
  closed = false;
  app = await _electron.launch({
    executablePath: source + '/node_modules/electron/dist/electron',
    args: [
      source + '/.build/desktop/main.cjs',
      '--ozone-platform=x11',
      '--force-device-scale-factor=' + scale,
      '--data-dir',
      profile,
    ],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + busPath },
    timeout: 20000,
  });
  pid = app.process().pid;
  assert((await readFile(`/proc/${pid}/cmdline`, 'utf8')).includes(profile));
  assert.equal((await readFile(`/proc/${pid}/cgroup`, 'utf8')).trim().split('::')[1], group);
  launches.push({ pid, cgroup: group });
  const page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true', null, {
    timeout: 20000,
  });
  await app.evaluate(
    ({ BrowserWindow }, zoom) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('/index.html'))
        .webContents.setZoomFactor(zoom),
    Number(process.env.GM_QA_ZOOM ?? 1),
  );
  if (await page.locator('#tutorial-dialog').isVisible())
    await page.locator('#tutorial-skip').click();
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: /Öffnen|Fortsetzen/ })
    .click();
  await page.waitForFunction(
    (id) =>
      document.getElementById('campaigns').value === id &&
      !document.getElementById('workspace-navigation').inert,
    campaign.id,
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
      .find((w) => w.webContents.getURL().endsWith('/index.html'))
      .close(),
  );
  let timer;
  const ended = await Promise.race([
    exit,
    new Promise(
      (_, reject) => (timer = setTimeout(() => reject(Error('Normal close timed out')), 10000)),
    ),
  ]).finally(() => clearTimeout(timer));
  assert.deepEqual(ended, { code: 0, signal: null });
  launches.at(-1).exit = ended;
  closed = true;
}

let page;
async function tab(id) {
  await page.waitForFunction(() => !document.querySelector('#workspace-navigation').inert);
  if (
    !(await page.locator(id).isVisible()) &&
    (await page.locator('#atlas-navigation').isVisible())
  )
    await page.locator('#atlas-navigation').click();
  if (!(await page.locator(id).isVisible())) await page.locator('#workspace-nav-summary').click();
  await page.locator(id).click();
}
async function shot(name) {
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await writeFile(
    path.join(output, name + '.png'),
    Buffer.from(
      await app.evaluate(async ({ BrowserWindow }) =>
        (
          await BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.capturePage()
        )
          .toPNG()
          .toString('base64'),
      ),
      'base64',
    ),
  );
}
function database(read) {
  const db = new Database(file, { readonly: true });
  try {
    return read(db);
  } finally {
    db.close();
  }
}
function assertFailureVisible() {
  return page
    .locator('#distribution-status')
    .evaluate((e) => {
      const r = e.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    })
    .then((visible) => assert(visible, 'allocation failure must be visible after confirmation'));
}
async function confirm() {
  await app.evaluate(
    ({ ipcMain }, { rejectOnce, replyLoss }) => {
      const write = ipcMain._invokeHandlers.get('campaign:execute-progress'),
        read = ipcMain._invokeHandlers.get('campaign:commit-status');
      let reject = rejectOnce,
        lose = replyLoss;
      globalThis.qaAllocationCommands = [];
      globalThis.qaTreasureStatusUnavailable = false;
      ipcMain.removeHandler('campaign:commit-status');
      ipcMain.handle('campaign:commit-status', (e, ...args) =>
        globalThis.qaTreasureStatusUnavailable
          ? { ok: false, error: 'Controlled receipt read failure' }
          : read(e, ...args),
      );
      ipcMain.removeHandler('campaign:execute-progress');
      ipcMain.handle('campaign:execute-progress', async (e, c) => {
        if (c.action.kind === 'allocate-batch') {
          globalThis.qaAllocationCommands.push(c);
          if (reject) {
            reject = false;
            return { ok: false, error: 'Controlled allocation conflict' };
          }
        }
        const result = await write(e, c);
        if (c.action.kind === 'allocate-batch' && lose) {
          lose = false;
          globalThis.qaTreasureStatusUnavailable = true;
          throw Error('Controlled allocation reply loss');
        }
        return result;
      });
    },
    { rejectOnce, replyLoss },
  );
  await page.locator('#distribution-confirm').click();
  if (rejectOnce) {
    await page.waitForFunction(() =>
      document
        .getElementById('distribution-status')
        .textContent.includes('Controlled allocation conflict'),
    );
    await assertFailureVisible();
    assert.equal(await page.getByLabel('Goldmünze an Ada', { exact: true }).inputValue(), '33');
    assert.equal(await page.getByLabel('Heiltrank an Ada', { exact: true }).inputValue(), '1');
    database((db) => {
      assert.equal(db.prepare('SELECT count(*) n FROM character_ledger').get().n, 0);
      const t = JSON.parse(
        db.prepare('SELECT payload FROM treasure WHERE id=?').get(treasureId).payload,
      );
      assert(t.items.every((i) => i.allocated === 0));
    });
    await shot('rejected');
    await page.locator('#distribution-confirm').click();
  }
  if (replyLoss) {
    await page.waitForFunction(() =>
      document.getElementById('distribution-status').textContent.includes('Buchungsantwort fehlt'),
    );
    await assertFailureVisible();
    assert.equal(await page.getByLabel('Goldmünze an Ada', { exact: true }).inputValue(), '33');
    await shot('unconfirmed');
    await page.locator('#distribution-confirm').click();
    await page.waitForFunction(() =>
      document
        .getElementById('distribution-status')
        .textContent.includes('Eine Buchung ist noch ungeklärt'),
    );
    assert.equal(
      (await app.evaluate(() => globalThis.qaAllocationCommands)).length,
      rejectOnce ? 2 : 1,
    );
    if (Number(process.env.GM_QA_ZOOM ?? 1) === 2) await page.keyboard.press('Escape');
    else
      await page
        .locator('#treasure-distribution-dialog')
        .getByRole('button', { name: 'Schließen', exact: true })
        .click();
    await page.locator('#treasure-distribution-dialog').waitFor({ state: 'hidden' });
    await app.evaluate(() => {
      globalThis.qaTreasureStatusUnavailable = false;
    });
    await page.locator('#commit-check').click();
    await page.locator('#commit-pending').waitFor({ state: 'hidden' });
    await page.waitForFunction(() =>
      document.getElementById('treasury-allocated').textContent.includes('99 × Goldmünze'),
    );
    await shot('recovered');
  } else {
    await page.locator('#distribution-receipt').waitFor({ state: 'visible' });
    assert.match(
      await page.locator('#distribution-receipt').innerText(),
      /Im Schatz verbleiben: 2 × Goldmünze/,
    );
    await shot('distributed');
  }
  const commands = await app.evaluate(() => globalThis.qaAllocationCommands);
  assert.equal(commands.length, rejectOnce ? 2 : 1);
  allocationCommand = commands.at(-1);
  allocationReceipt = database((db) => {
    if (rejectOnce)
      assert.equal(
        db
          .prepare('SELECT count(*) n FROM progress_receipt WHERE command_id=?')
          .get(commands[0].commandId).n,
        0,
      );
    const row = db
      .prepare('SELECT payload FROM progress_receipt WHERE command_id=?')
      .get(allocationCommand.commandId);
    assert(row);
    return row.payload;
  });
  audits.push({
    rejectOnce,
    replyLoss,
    commands: commands.map((c) => c.commandId),
    appliedCommand: allocationCommand.commandId,
  });
}
try {
  page = await launch();
  await tab('#treasury-tab');
  await page
    .locator('#treasury-list')
    .getByRole('button', { name: /Hafenfund/ })
    .click();
  await page.locator('#treasury-distribute').click();
  await page.locator('#distribution-even').click();
  await shot('distribution');
  await page.getByLabel('Heiltrank an Ada', { exact: true }).fill('1');
  await page.getByLabel('Heiltrank an Borin', { exact: true }).fill('1');
  const adaRecipient = page.locator('#distribution-people').getByLabel('Ada', { exact: true });
  await adaRecipient.uncheck();
  await shot('recipient-excluded');
  assert.equal(await page.getByLabel('Heiltrank an Ada', { exact: true }).count(), 0);
  assert.match(
    await page.locator('#distribution-summary').innerText(),
    /Eingaben für 1 abgewählte Figur/,
  );
  await page.locator('#distribution-even').click();
  assert.equal(await page.getByLabel('Goldmünze an Borin', { exact: true }).inputValue(), '50');
  assert.equal(await page.getByLabel('Goldmünze an Cleo', { exact: true }).inputValue(), '50');
  await adaRecipient.check();
  assert.equal(
    await page.getByLabel('Goldmünze an Ada', { exact: true }).inputValue(),
    '33',
    'changing recipient selection must retain the prepared coin amount',
  );
  assert.equal(
    await page.getByLabel('Heiltrank an Ada', { exact: true }).inputValue(),
    '1',
    'changing recipient selection must retain the prepared potion amount',
  );
  assert(
    await page.locator('#distribution-check').isDisabled(),
    'restored amounts must be revalidated against the available treasure',
  );
  assert.doesNotMatch(
    await page.locator('#distribution-summary').innerText(),
    /Einheiten vorbereitet|bleiben im Schatz/,
  );
  await shot('recipient-restored-overflow');
  await page.getByLabel('Goldmünze an Borin', { exact: true }).fill('33');
  await page.getByLabel('Goldmünze an Cleo', { exact: true }).fill('33');
  await page.getByLabel('Heiltrank an Cleo', { exact: true }).fill('');
  database((db) => assert.equal(db.prepare('SELECT count(*) n FROM character_ledger').get().n, 0));
  await page.locator('#distribution-check').click();
  await shot('review');
  await confirm();
  if (replyLoss) {
    await tab('#live-tab');
    await page.getByRole('button', { name: 'Ada · Beute ansehen', exact: true }).click();
  } else
    await page
      .locator('#distribution-receipt')
      .getByRole('button', { name: 'Ada · Beute ansehen', exact: true })
      .click();
  await page.locator('#live').waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => document.querySelector('#ledger-character-heading').textContent === 'Beute: Ada',
  );
  await shot('personal-entry');
  await page
    .locator('#ledger-list')
    .getByRole('button', { name: /33 × Goldmünze/ })
    .click();
  await page.locator('#ledger-adjustments summary').click();
  await page.locator('#ledger-operation').selectOption('correct');
  assert.equal(await page.locator('#ledger-quantity').inputValue(), '33');
  await page.locator('#ledger-quantity').fill('32');
  await page.locator('#ledger-reason').fill('Eine Münze beim Nachzählen zu viel.');
  await page.locator('#ledger-form button[type=submit]').click();
  await page.waitForFunction(() =>
    document.querySelector('#ledger-list').textContent.includes('32 × Goldmünze'),
  );
  await shot('corrected');
  await page
    .locator('#ledger-list')
    .getByRole('button', { name: /1 × Heiltrank/ })
    .click();
  await page
    .locator('#ledger-stack-tools')
    .getByRole('button', { name: 'An Figur weitergeben' })
    .waitFor({ state: 'visible' });
  await shot('transfer-entry');
  await page.getByLabel('Empfänger der Weitergabe', { exact: true }).selectOption(heroes[2].id);
  await page.getByLabel('Stapelgrund', { exact: true }).fill('Trank für Cleo');
  await page.getByRole('button', { name: 'An Figur weitergeben', exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('#ledger-list').textContent.includes('Weitergegeben'),
  );
  await shot('transferred');
  await close();
  page = await launch();
  await tab('#treasury-tab');
  await page
    .locator('#treasury-list')
    .getByRole('button', { name: /Hafenfund · 2 unverteilte/ })
    .click();
  assert.match(await page.locator('#treasury-allocated').innerText(), /99 × Goldmünze/);
  await shot('fresh-remainder');
  await tab('#live-tab');
  for (const c of heroes) {
    await page
      .getByRole('button', { name: c.profile.name + ' · Beute ansehen', exact: true })
      .click();
    await page.locator('#ledger-filter').selectOption('received');
    await page.waitForFunction(
      ({ name, n }) =>
        document.querySelector('#ledger-character-heading').textContent === 'Beute: ' + name &&
        document.querySelector('#ledger-list').textContent.includes(n + ' × Goldmünze'),
      { name: c.profile.name, n: c.id === heroes[0].id ? 32 : 33 },
    );
    const text = await page.locator('#ledger-list').innerText();
    if (c.id === heroes[0].id) assert.match(text, /0 × Heiltrank/);
    else assert.match(text, /1 × Heiltrank/);
    await shot('fresh-' + c.profile.name);
    if (c.id === heroes[0].id) {
      await page.locator('#live-loot-back').click();
      if ((await page.locator('#live-party-details').getAttribute('open')) === null)
        await page.locator('#live-party-details>summary').click();
      const history = page.locator('#progress-history-list').locator('..');
      if ((await history.getAttribute('open')) === null) await history.locator('summary').click();
      await page.waitForFunction(() =>
        document
          .getElementById('progress-history-list')
          .textContent.includes('Beutemenge korrigiert: 33 → 32'),
      );
      assert.match(await history.innerText(), /Eine Münze beim Nachzählen zu viel/);
      await history.scrollIntoViewIfNeeded();
      await shot('fresh-correction-history');
    }
  }

  await writeFile(path.join(output, 'ui.txt'), await page.locator('body').innerText());
  await close();
  const check = new CampaignStore(file);
  let canonical;
  try {
    const fresh = check.activate(campaign.id),
      book = check.treasure(fresh.token, treasureId);
    assert.deepEqual(
      book.items.map((i) => i.allocated),
      [99, 2],
    );
    assert.deepEqual(check.progress(fresh.token), originalProgress);
    const inventories = heroes.map(
      (c) => check.ledgerInventory(fresh.token, { characterId: c.id, after: null }).items,
    );
    for (const [i, items] of inventories.entries()) {
      assert.equal(items.find((l) => l.name === 'Goldmünze').quantity, i === 0 ? 32 : 33);
      assert.equal(items.find((l) => l.name === 'Heiltrank')?.quantity ?? 0, i === 0 ? 0 : 1);
      for (const l of items) {
        assert.equal(check.ledgerItem(fresh.token, l.id).sourceTitle, 'Hafenfund');
        assert.deepEqual(l.reference, book.items.find((t) => t.name === l.name).reference);
      }
    }
    const given = check.ledger(fresh.token, {
      characterId: heroes[0].id,
      after: null,
      search: '',
      status: 'given',
    }).items;
    assert.equal(given.length, 1);
    assert.equal(given[0].quantity, 1);
    assert.equal(given[0].recipientCharacterId, heroes[2].id);
    const corrections = check
      .progressHistory(fresh.token, heroes[0].id, null)
      .items.filter((e) => e.kind === 'loot-correction');
    assert.equal(corrections.length, 1);
    const correction = corrections[0].facts;
    assert.equal(correction.before.quantity, 33);
    assert.equal(correction.after.quantity, 32);
    assert.equal(correction.originalId, correction.before.id);
    assert.deepEqual(correction.before.reference, correction.after.reference);
    assert.equal(correction.reason, 'Eine Münze beim Nachzählen zu viel.');
    assert.equal(
      check.db
        .prepare('SELECT payload FROM progress_receipt WHERE command_id=?')
        .get(allocationCommand.commandId).payload,
      allocationReceipt,
    );
    canonical = { book, inventories, given, corrections };
  } finally {
    check.close();
  }
  for (const l of launches)
    l.pidAbsent = !(await stat('/proc/' + l.pid)
      .then(() => true)
      .catch(() => false));
  assert(launches.every((l) => l.exit?.code === 0 && l.pidAbsent));
  await writeFile(
    path.join(output, 'result.json'),
    JSON.stringify(
      {
        checkout,
        dirty,
        hashes,
        profile,
        zoom: Number(process.env.GM_QA_ZOOM ?? 1),
        fixture: { campaign, heroes, treasureId },
        launches,
        errors,
        audits,
        canonical,
        complete: true,
        installedPackageAcceptance: false,
        humanAcceptance: false,
      },
      null,
      2,
    ),
  );
  console.log(
    'COMPLETE treasure distribution, correction, transfer, receipt and Fresh at ' +
      (process.env.GM_QA_ZOOM ?? 1),
  );
} catch (e) {
  await writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify({ error: e.stack, launches, errors, profile }, null, 2),
  );
  if (app && !closed) await shot('failure').catch(() => {});
  throw e;
} finally {
  if (app && !closed) {
    const proc = app.process(),
      timer = setTimeout(() => {
        if (proc.exitCode === null) proc.kill('SIGKILL');
      }, 5000);
    try {
      await app.close().catch(() => {});
    } finally {
      clearTimeout(timer);
    }
  }
  proxy.kill();
}
