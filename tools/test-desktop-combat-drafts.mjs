import { _electron as electron } from 'playwright-core';
import { build } from 'esbuild';
import { zipSync } from 'fflate';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
const root = process.cwd(),
  out = path.resolve(process.argv[2]),
  version = JSON.parse(await readFile('package.json', 'utf8')).version,
  sha = (b) => createHash('sha256').update(b).digest('hex');
await mkdir(out, { recursive: true });
await mkdir('.build', { recursive: true });
const built = await mkdtemp(path.join(root, '.build/combat-draft-native-')),
  dataDir = await mkdtemp(path.join(tmpdir(), 'combat-draft-native-'));
let app, page, child;
const checks = [],
  exits = [],
  errors = [];
let actorId, combatId;
const read = (fn) => {
  const db = new Database(path.join(dataDir, 'workbench.sqlite'), { readonly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
};
const current = () =>
  read((db) =>
    JSON.parse(db.prepare('SELECT payload FROM combat WHERE id=?').get(combatId).payload),
  );
const drafts = () =>
  read((db) =>
    db
      .prepare('SELECT kind,payload FROM combat_working_draft')
      .all()
      .map((r) => ({ kind: r.kind, body: JSON.parse(r.payload) })),
  );
async function launch() {
  app = await electron.launch({
    executablePath: path.join(root, 'node_modules/electron/dist/electron'),
    args: [
      path.join(built, 'main.cjs'),
      '--data-dir',
      dataDir,
      '--js-flags=--max-old-space-size=256',
    ],
    timeout: 15000,
  });
  child = app.process();
  page = await app.firstWindow();
  page.setDefaultTimeout(5000);
  page.on('pageerror', (e) => errors.push(e.message));
  assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), dataDir);
  await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  if (await page.locator('#tutorial-dialog').evaluate((e) => e.open))
    await page.locator('#tutorial-skip').click();
  await page.locator('#live-tab').click();
  await page.locator('#live-continue').click();
  await page.locator('#combat-rows button').first().waitFor();
  await page.locator('#combat-rows button').first().click();
  await page.waitForFunction(() => !document.getElementById('fighter-initiative').disabled);
}
async function close() {
  const exited = new Promise((resolve) =>
    child.once('exit', (code, signal) => resolve({ code, signal })),
  );
  let timer;
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  try {
    const result = await Promise.race([
      exited,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Normal close timed out')), 8000);
      }),
    ]);
    assert.deepEqual(result, { code: 0, signal: null });
    exits.push(result);
  } finally {
    clearTimeout(timer);
  }
}
try {
  await mkdir(path.join(built, 'ui'));
  await mkdir(path.join(built, 'catalog'));
  await build({
    entryPoints: ['src/app/storage/store.ts'],
    outfile: path.join(built, 'fixture.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore } = createRequire(import.meta.url)(path.join(built, 'fixture.cjs')),
    store = new CampaignStore(path.join(dataDir, 'workbench.sqlite'), version);
  try {
    const c = store.create('Native Kampfeingaben'),
      w = store.activate(c.id),
      command = (action) => ({ commandId: randomUUID(), campaignId: c.id, token: w.token, action }),
      actor = store.executeLive(
        command({ kind: 'create-character', profile: { name: 'Native Figur' } }),
      ).character;
    actorId = actor.id;
    let live = store.live(w.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: actor.id,
        expectedRevision: actor.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: null,
        expectedFocusRevision: null,
      }),
    );
    live = store.live(w.token);
    store.executeLive(command({ kind: 'initialize', expectedRosterRevision: live.rosterRevision }));
    live = store.live(w.token);
    combatId = store.executeCombat({
      ...command({
        kind: 'create',
        title: 'Originalkampf',
        sceneId: live.focusId,
        includeParty: true,
        expectedMembershipRevision: live.scene.membershipRevision,
      }),
      combatId: null,
      expectedRevision: null,
    }).combat.id;
  } finally {
    store.close();
  }
  await build({
    entryPoints: ['desktop/main.ts'],
    outfile: path.join(built, 'main.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron', 'better-sqlite3'],
    define: { __APP_VERSION__: JSON.stringify(version) },
  });
  await build({
    entryPoints: ['desktop/preload.ts'],
    outfile: path.join(built, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
  });
  await build({
    entryPoints: ['src/app/renderer.ts'],
    outfile: path.join(built, 'ui/renderer.js'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
  });
  for (const n of ['index.html', 'app.css'])
    await copyFile('src/app/' + n, path.join(built, 'ui', n));
  for (const n of ['srd-5.1.generated.json', 'SRD-5.1-ATTRIBUTION.md'])
    await copyFile(
      path.join('src/features/catalog', n.endsWith('.json') ? 'data/' + n : n),
      path.join(built, 'catalog', n),
    );
  const files = [
      'main.cjs',
      'preload.cjs',
      'fixture.cjs',
      'ui/renderer.js',
      'ui/index.html',
      'ui/app.css',
      'catalog/srd-5.1.generated.json',
      'catalog/SRD-5.1-ATTRIBUTION.md',
    ],
    bytes = Object.fromEntries(
      await Promise.all(files.map(async (n) => [n, await readFile(path.join(built, n))])),
    ),
    archive = zipSync(bytes, { level: 6 });
  await writeFile(path.join(out, 'executed-build.zip'), archive);
  await launch();
  await page.locator('#fighter-initiative').fill('-');
  await page.locator('#combat-notes-details').evaluate((e) => (e.open = true));
  await page.locator('#combat-edit-title').fill('Noch nicht bestätigt');
  await page.locator('#combat-notes').fill('Roher Text ' + actorId + '\n☀');
  assert.equal(await page.locator('#fighter-initiative').inputValue(), '-');
  // Close exercises the real renderer flush instead of waiting through a private test API.
  await close();
  const stored = drafts();
  assert.equal(stored.length, 2);
  assert.equal(stored.find((d) => d.kind === 'fighter').body.values['fighter-initiative'], '-');
  assert.equal(current().title, 'Originalkampf');
  assert.equal(current().participants[0].initiative, 0);
  checks.push(
    'native raw minus and unconfirmed notes persist through normal Close without changing combat',
  );
  await launch();
  await page.waitForFunction(
    () =>
      document.getElementById('fighter-initiative').value === '-' &&
      document.getElementById('combat-edit-title').value === 'Noch nicht bestätigt',
  );
  assert.equal(await page.locator('#fighter-initiative').getAttribute('type'), 'text');
  assert.equal(await page.locator('#combat-notes').inputValue(), 'Roher Text ' + actorId + '\n☀');
  checks.push('fresh Electron process restores the raw fighter and note drafts from SQLite');
  await page.locator('#combat-participant-form').scrollIntoViewIfNeeded();
  const capture = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'),
  );
  await writeFile(path.join(out, 'fresh-draft.png'), Buffer.from(capture, 'base64'));
  await page.locator('#fighter-initiative').fill('14');
  await page.locator('#combat-participant-form button[type=submit]').click();
  await page.waitForFunction(
    () => document.getElementById('fighter-draft-status').textContent === '',
  );
  assert.equal(current().participants[0].initiative, 14);
  assert.equal(drafts().filter((d) => d.kind === 'fighter').length, 0);
  assert.equal(drafts().filter((d) => d.kind === 'notes').length, 1);
  checks.push(
    'explicit fighter submit consumes only its exact draft and preserves the separate note draft',
  );
  await page.locator('#combat-notes-details').evaluate((e) => (e.open = true));
  await page.locator('#combat-notes-form button[type=submit]').click();
  await page.waitForFunction(
    () => document.getElementById('combat-notes-draft-status').textContent === '',
  );
  assert.equal(current().title, 'Noch nicht bestätigt');
  assert.equal(drafts().length, 0);
  checks.push('explicit note submit adopts and consumes the independent note draft');
  await close();
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, 'result.json'),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        version,
        checks,
        exits,
        errors,
        executedBuildSha256: sha(archive),
        files: Object.fromEntries(files.map((n) => [n, sha(bytes[n])])),
        instrumentation:
          'Own temporary SQLite/userData seeded before launch; actual unmodified Main/preload/renderer, two Electron processes and native text fields. No substituted IPC responses.',
        limits:
          'Small Linux normal Close/Fresh and explicit-adoption path; not hard-crash, screenreader, large drafts, IME or cross-platform acceptance.',
      },
      null,
      2,
    ),
  );
  console.log('Native combat draft checks PASS; two normal exits.');
} catch (error) {
  await writeFile(
    path.join(out, 'failure.json'),
    JSON.stringify({ error: error.stack, checks, exits, errors }, null, 2),
  );
  throw error;
} finally {
  if (child?.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 5000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  await rm(dataDir, { recursive: true, force: true });
  await rm(built, { recursive: true, force: true });
}
