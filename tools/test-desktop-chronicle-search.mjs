import { currentProcessGroup } from './process-group.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const zoom = process.argv.includes('--zoom=2') ? 2 : 1;
const source = process.cwd(),
  output =
    process.env.QA_EVIDENCE_DIR ?? (await mkdtemp(path.join(source, '.build/chronicle-search-')));
const group = await currentProcessGroup();
await mkdir(output, { recursive: true });
const require = createRequire(source + '/package.json'),
  { _electron } = require('playwright-core');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/chronicle-native-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(source + '/.build/chronicle-native-store.cjs');
const profile = await mkdtemp('/tmp/gm-chronicle-search-'),
  file = profile + '/workbench.sqlite',
  store = new CampaignStore(file),
  campaign = store.create('Reise nach der Ortswahl'),
  w = store.activate(campaign.id),
  command = (action) => ({
    commandId: randomUUID(),
    token: w.token,
    campaignId: campaign.id,
    action,
  });
const hero = store.executeLive(
  command({ kind: 'create-character', profile: { name: 'Iri' } }),
).character;
let revision = store.progress(w.token).characters.find((c) => c.characterId === hero.id).revision;
for (let i = 0; i < 2003; i++)
  store.executeProgress(
    command({
      kind: 'xp',
      characterId: hero.id,
      expectedRevision: revision++,
      mode: 'add',
      amount: 1,
      reason: i === 0 ? 'Bronzeschlüssel am Hafen gefunden' : 'Routinenotiz ' + i,
    }),
  );
const originalRows = store.db
  .prepare('SELECT id,payload,checksum FROM progress_event WHERE campaign_id=? ORDER BY id')
  .all(campaign.id);
store.close();
console.log('Fixture: 2003 confirmed XP changes');
const result = {
  zoom,
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  profile,
  hashes: {},
  results: {},
  launches: [],
  errors: [],
};
for (const name of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
  result.hashes[name] = createHash('sha256')
    .update(await readFile(path.join(source, '.build/desktop', name)))
    .digest('hex');
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
  closed = true;
const { results, launches, errors } = result;
async function ready(page) {
  await page.waitForFunction(
    () => document.querySelector('#chronicle').getAttribute('aria-busy') === 'false',
  );
}
async function launch() {
  app = await _electron.launch({
    executablePath: source + '/node_modules/electron/dist/electron',
    args: [source + '/.build/desktop/main.cjs', '--data-dir', profile, '--ozone-platform=x11'],
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + busPath },
    timeout: 60000,
  });
  closed = false;
  const pid = app.process().pid;
  assert((await readFile(`/proc/${pid}/cmdline`, 'utf8')).includes(profile));
  assert.equal((await readFile(`/proc/${pid}/cgroup`, 'utf8')).trim().split('::')[1], group);
  launches.push({ pid, cgroup: group });
  const page = await app.firstWindow({ timeout: 60000 });
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
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
  if (
    !(await page.locator('#chronicle-tab').isVisible()) &&
    (await page.locator('#atlas-navigation').isVisible())
  )
    await page.locator('#atlas-navigation').click();
  if (!(await page.locator('#chronicle-tab').isVisible()))
    await page.locator('#workspace-nav-summary').click();
  await page.locator('#chronicle-tab').click();
  await ready(page);
  await app.evaluate(
    ({ BrowserWindow }, factor) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() === 'SaltMarcher')
        .webContents.setZoomFactor(factor),
    zoom,
  );
  return page;
}
async function close() {
  const exit = new Promise((r) =>
    app.process().once('exit', (code, signal) => r({ code, signal })),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === 'SaltMarcher')
      .close(),
  );
  let timer;
  try {
    const ended = await Promise.race([
      exit,
      new Promise(
        (_, reject) => (timer = setTimeout(() => reject(Error('Normal close timed out')), 10000)),
      ),
    ]);
    assert.deepEqual(ended, { code: 0, signal: null });
    launches.at(-1).exit = ended;
    launches.at(-1).pidAbsent = !(await stat('/proc/' + app.process().pid)
      .then(() => true)
      .catch(() => false));
    assert(launches.at(-1).pidAbsent);
    closed = true;
  } finally {
    clearTimeout(timer);
  }
}
async function capture(page, file) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const png = await app.evaluate(async ({ BrowserWindow }) =>
    (
      await BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('/index.html'))
        .webContents.capturePage()
    )
      .toPNG()
      .toString('base64'),
  );
  await writeFile(file, Buffer.from(png, 'base64'));
}
async function exportFile(page, count, destination) {
  await page.locator('#chronicle-export').click();
  await page.waitForFunction(
    (count) =>
      document.querySelector('#chronicle-export-status').textContent ===
      count + ' Ereignisse vollständig als Markdown gespeichert.',
    count,
  );
  return readFile(destination, 'utf8');
}
try {
  let page = await launch();
  assert.equal(await page.locator('#chronicle-list article').count(), 100);
  results.initialCount = await page.locator('#chronicle-count').innerText();
  const first = await page.locator('#chronicle-list article').first().innerText();
  await page.locator('#chronicle-navigation-bottom').scrollIntoViewIfNeeded();
  results.pageEnd = await page.locator('#chronicle-next-bottom').evaluate((e) => {
    const r = e.getBoundingClientRect(),
      music = document.getElementById('music-mini').getBoundingClientRect();
    const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    return {
      top: r.top,
      bottom: r.bottom,
      safeBottom: music.top,
      height: innerHeight,
      uncovered: e === hit || e.contains(hit),
    };
  });
  assert(
    results.pageEnd.top >= 0 &&
      results.pageEnd.bottom <= results.pageEnd.safeBottom &&
      results.pageEnd.uncovered,
    'Next page must be reachable below the last event',
  );
  await capture(page, path.join(output, 'chronicle-page-end.png'));
  if (zoom === 2) await page.locator('#chronicle-next-bottom').press('Enter');
  else await page.locator('#chronicle-next-bottom').click();
  await ready(page);
  assert.match(await page.locator('#chronicle-count').innerText(), /^Seite 2/);
  assert.notEqual(await page.locator('#chronicle-list article').first().innerText(), first);
  await page.waitForFunction(() => document.activeElement?.id === 'chronicle-count');
  results.pageStart = await page.locator('#chronicle-count').evaluate((e) => {
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    return {
      top: r.top,
      bottom: r.bottom,
      height: innerHeight,
      uncovered: e === hit || e.contains(hit),
    };
  });
  assert(
    results.pageStart.top >= 0 &&
      results.pageStart.bottom < results.pageStart.height &&
      results.pageStart.uncovered,
  );
  await capture(page, path.join(output, 'chronicle-next-page.png'));
  await page.locator('#chronicle-navigation-bottom').scrollIntoViewIfNeeded();
  await page.locator('#chronicle-previous-bottom').click();
  await ready(page);
  assert.equal(await page.locator('#chronicle-list article').first().innerText(), first);
  results.snapshotPaging = true;
  assert.equal(
    await page.locator('#chronicle-export').innerText(),
    'Gesamte Chronik als Markdown…',
  );
  const destination = profile + '/chronicle.md';
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, destination);
  const complete = await exportFile(page, 2003, destination);
  assert(!complete.includes('ältere passende Einträge'));
  assert(complete.includes('Bronzeschlüssel'));
  assert.equal((complete.match(/^## XP korrigiert$/gm) ?? []).length, 2003);
  await writeFile(path.join(output, 'chronicle-complete.md'), complete);
  results.completeExportBeyondFormerWindow = true;
  await page.locator('#chronicle-search').fill('Bronzeschlüssel');
  await page.waitForFunction(
    () =>
      document.querySelectorAll('#chronicle-list article').length === 1 &&
      document.querySelector('#chronicle').getAttribute('aria-busy') === 'false',
  );
  assert.equal(await page.locator('#chronicle-export').innerText(), 'Treffer als Markdown…');
  assert.equal(await page.locator('#chronicle-export-status').innerText(), '');
  assert.equal(await page.locator('#chronicle-navigation-bottom').isVisible(), false);
  results.filteredText = await page.locator('#chronicle-list').innerText();
  assert(results.filteredText.includes('Bronzeschlüssel'));
  await capture(page, path.join(output, 'chronicle-filtered.png'));
  const filtered = await exportFile(page, 1, destination);
  assert(filtered.includes('Bronzeschlüssel'));
  assert(!filtered.includes('Routinenotiz'));
  results.filteredNativeExport = true;
  await writeFile(path.join(output, 'chronicle-filtered.md'), filtered);
  await close();
  const fresh = new CampaignStore(file);
  try {
    assert.deepEqual(
      fresh.db
        .prepare('SELECT id,payload,checksum FROM progress_event WHERE campaign_id=? ORDER BY id')
        .all(campaign.id),
      originalRows,
    );
    results.originalHistoryUnchanged = true;
  } finally {
    fresh.close();
  }
  page = await launch();
  await page.locator('#chronicle-search').fill('Bronzeschlüssel');
  await page.waitForFunction(() =>
    document.querySelector('#chronicle-list').textContent.includes('Bronzeschlüssel'),
  );
  results.nativeRestartSearch = true;
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('campaign:chronicle-page');
    ipcMain.handle('campaign:chronicle-page', () => {
      throw new Error('QA: Chronikquelle vorübergehend nicht lesbar');
    });
  });
  await page.locator('#chronicle-refresh').click();
  await page.locator('#chronicle-list [role=alert]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#chronicle-list article').count(), 0);
  assert(
    !(await page.locator('#chronicle-list [role=alert]').innerText()).includes('remote method'),
  );
  assert(!(await page.locator('#status').innerText()).includes('campaign:chronicle'));
  assert.equal(await page.locator('#chronicle-export').isDisabled(), true);
  assert.equal(await page.locator('#chronicle').getAttribute('aria-busy'), 'false');
  results.controlledNativeReadFailure = true;
  await capture(page, path.join(output, 'chronicle-read-error.png'));
  await close();
  assert.deepEqual(errors, []);
  result.ok = true;
  console.log('COMPLETE: paging, full/filtered export, Fresh and read rejection');
} catch (error) {
  result.error = error.stack;
  if (app && !closed) {
    try {
      await (
        await app.firstWindow({ timeout: 1000 })
      ).screenshot({ path: path.join(output, 'failure.png') });
    } catch {}
  }
  throw error;
} finally {
  if (app && !closed) {
    await Promise.race([app.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
  }
  proxy.kill();
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
}
