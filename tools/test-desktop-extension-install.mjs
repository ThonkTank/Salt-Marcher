// Installation-wide package management from Settings, without opening a campaign.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createNativeSession } from './native-session.mjs';
const root = process.cwd(),
  out = process.env.QA_EVIDENCE_DIR ?? root + '/.build/extension-install';
await mkdir(out, { recursive: true });
await rm(out + '/result.json', { force: true });
const require = createRequire(root + '/package.json'),
  Database = require('better-sqlite3');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/extension-install-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/extension-install-store.cjs');
const presetStylesheet = digestStyle();
function digestStyle() {
  return createHash('sha256')
    .update(require('node:fs').readFileSync(root + '/.build/desktop/ui/preset-settings.css'))
    .digest('hex');
}
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  launches = [],
  results = [];
let native, db;
const digest = (b) => createHash('sha256').update(b).digest('hex');
const packageBytes = (id, name, rights) =>
  Buffer.from(
    JSON.stringify({
      format: 'Kampagnenwerkstatt Extension',
      version: 1,
      manifest: { id, name, version: '1.0.0', hostApi: 1, unitCodec: 'way-note:1', rights },
      renderer: {
        html: '<p>Zusatzdaten</p>',
        script: 'throw new Error("Package code must not execute during installation")',
        styles: '',
      },
    }),
  );
async function until(check) {
  for (let i = 0; i < 400; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert(check(), 'Expected persisted installation state');
}
try {
  for (const zoom of [1, 2]) {
    native = await createNativeSession({
      root,
      output: out + '/' + zoom,
      name: 'extension-install',
    });
    assert.equal(native.source, source);
    assert.equal(native.dirty, dirty);
    const profile = native.profile,
      store = new CampaignStore(profile + '/workbench.sqlite'),
      campaign = store.create('Ungeöffnete Kampagne'),
      body = Buffer.from([0, 255, 17, 34, 51]),
      unit = randomUUID();
    store.db
      .prepare('INSERT INTO campaign_capability VALUES(?,?,?,?,?,?,?)')
      .run(campaign.id, unit, 'own.way-note:way-note', 1, '[]', body, digest(body));
    store.tutorial('skipped');
    store.close();
    const way = packageBytes('own.way-note', 'Wegnotiz', ['ownedUnits.read', 'ownedUnits.write']),
      local = packageBytes('own.local-note', 'Lokale Notiz', []),
      wayFile = profile + '/way-note.json',
      localFile = profile + '/local-note.json',
      badFile = profile + '/invalid.json';
    await writeFile(wayFile, way);
    await writeFile(localFile, local);
    await writeFile(badFile, '{"format":"invalid"}');
    db = new Database(profile + '/workbench.sqlite', { readonly: true });
    const installation = (id) => {
        const row = db
          .prepare('SELECT value FROM settings WHERE key=?')
          .get('extension:installed:' + id);
        return row ? JSON.parse(row.value) : null;
      },
      receipts = () =>
        db.prepare("SELECT count(*) n FROM settings WHERE key LIKE 'extension:receipt:%'").get().n,
      unitState = () =>
        db
          .prepare('SELECT * FROM campaign_capability WHERE campaign_id=? AND id=?')
          .get(campaign.id, unit),
      originalUnit = unitState(),
      originalCampaign = db.prepare('SELECT * FROM campaign WHERE id=?').get(campaign.id);
    let app, page;
    async function launch(holdPreset = false) {
      assert.equal(digestStyle(), presetStylesheet);
      page = await native.launch(zoom);
      app = native.app;
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.unmaximize();
        w.setContentSize(1400, 1000);
      });
      assert.equal(
        await page.locator('body').evaluate((b) => b.classList.contains('has-workspace')),
        false,
      );
      if (holdPreset)
        await app.evaluate(({ ipcMain }) => {
          const read = ipcMain._invokeHandlers.get('campaign:preset-registry');
          globalThis.qaPresetReply = null;
          ipcMain.removeHandler('campaign:preset-registry');
          ipcMain.handle('campaign:preset-registry', async (e, ...args) => {
            const value = await read(e, ...args);
            return new Promise((resolve) => (globalThis.qaPresetReply = () => resolve(value)));
          });
        });
      await page.locator('#application-trigger').click();
      await page.locator('#application-settings').click();
      await page.locator('#preset-manager').waitFor({ state: 'visible' });
      assert(
        await page.locator('#preset-manager #extensions-open').isVisible(),
        'Package management must be reachable from Settings before opening a campaign',
      );
      await page.locator('#extensions-open').click();
      await page.locator('#extensions-dialog').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.activeElement?.id === 'extensions-heading');
      if (holdPreset) {
        assert(await page.locator('#preset-close').isDisabled(), 'generator load is still pending');
        assert(
          await app.evaluate(async () => {
            for (let i = 0; i < 100; i++) {
              if (globalThis.qaPresetReply) {
                globalThis.qaPresetReply();
                return true;
              }
              await new Promise((r) => setTimeout(r, 20));
            }
            return false;
          }),
        );
      }
    }
    async function preview(file) {
      await app.evaluate(({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
      }, file);
      await page.locator('#extension-pick').click();
    }
    async function consent() {
      const checks = page.locator('#extension-rights input');
      assert.equal(await checks.count(), 2);
      assert(await page.locator('#extension-install').isDisabled());
      await checks.nth(0).check();
      assert(await page.locator('#extension-install').isDisabled());
      await checks.nth(1).check();
      assert(await page.locator('#extension-install').isEnabled());
    }
    async function close() {
      if (await page.locator('#extensions-dialog').isVisible())
        await page.locator('#extensions-close').click();
      await page.locator('#preset-close').click();
      await page.locator('#preset-manager').waitFor({ state: 'hidden' });
      await native.close();
    }
    const row = (name) => page.locator('#extension-list article').filter({ hasText: name });
    await launch(true);
    await preview(badFile);
    await page.waitForFunction(() => !document.querySelector('#extension-pick').disabled);
    assert(await page.locator('#extension-preview').isHidden());
    assert.equal(receipts(), 0);
    await preview(wayFile);
    await page.locator('#extension-preview').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#extension-hash').textContent(), digest(way));
    await consent();
    await app.evaluate(({ ipcMain }) => {
      const execute = ipcMain._invokeHandlers.get('extensions:execute');
      globalThis.qaExtensionWrites = 0;
      ipcMain.removeHandler('extensions:execute');
      ipcMain.handle('extensions:execute', async (e, ...args) => {
        globalThis.qaExtensionWrites++;
        const result = await execute(e, ...args);
        if (globalThis.qaExtensionWrites === 1)
          throw Error('QA: install reply interrupted after commit');
        return result;
      });
    });
    await page.locator('#extension-install').click();
    await until(() => installation('own.way-note')?.state === 'installed');
    await page.locator('#extension-outcome').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#extension-outcome').disabled);
    const pending = await page.evaluate(() => localStorage.getItem('extension-pending-write'));
    assert(pending);
    assert.equal(receipts(), 1);
    assert.equal(await app.evaluate(() => globalThis.qaExtensionWrites), 1);
    assert.deepEqual(installation('own.way-note').grants, ['ownedUnits.read', 'ownedUnits.write']);
    await native.capture(page, 'unconfirmed-install');
    await close();
    await launch();
    assert.equal(
      await page.evaluate(() => localStorage.getItem('extension-pending-write')),
      pending,
    );
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'extension-outcome');
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () =>
        localStorage.getItem('extension-pending-write') === null &&
        !document.querySelector('#extension-pick').disabled,
    );
    assert.equal(receipts(), 1, 'Outcome lookup must not replay the writer');
    await row('Wegnotiz').getByRole('button', { name: 'Rechte widerrufen', exact: true }).click();
    await until(() => installation('own.way-note')?.revision === 2);
    await page.waitForFunction(() => !document.querySelector('#extension-pick').disabled);
    assert.deepEqual(installation('own.way-note').grants, []);
    assert(installation('own.way-note').packageBytes);
    assert.deepEqual(unitState(), originalUnit);
    assert.equal(
      await row('Wegnotiz').getByRole('button', { name: 'Rechte widerrufen', exact: true }).count(),
      0,
      'Revoked grants offer no redundant revoke action',
    );
    await row('Wegnotiz').getByRole('button', { name: 'Paket entfernen', exact: true }).click();
    await until(() => installation('own.way-note')?.state === 'removed');
    await page.waitForFunction(() => !document.querySelector('#extension-pick').disabled);
    assert.equal(installation('own.way-note').packageBytes, null);
    assert.deepEqual(unitState(), originalUnit);
    await preview(localFile);
    await page.locator('#extension-preview').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#extension-rights input').count(), 0);
    assert(await page.locator('#extension-install').isEnabled());
    await page.locator('#extension-install').click();
    await until(() => installation('own.local-note')?.state === 'installed');
    await page.waitForFunction(() => !document.querySelector('#extension-pick').disabled);
    assert.match(await row('Lokale Notiz').textContent(), /Installiert · keine Rechte angefordert/);
    assert.equal(
      await row('Lokale Notiz')
        .getByRole('button', { name: 'Rechte widerrufen', exact: true })
        .count(),
      0,
    );
    await native.capture(page, 'revoked-and-no-rights');
    await close();
    await launch();
    assert.match(await row('Wegnotiz').textContent(), /Entfernt/);
    assert.match(await row('Lokale Notiz').textContent(), /keine Rechte angefordert/);
    assert.deepEqual(unitState(), originalUnit);
    await preview(wayFile);
    await page.locator('#extension-preview').waitFor({ state: 'visible' });
    await consent();
    await page.locator('#extension-install').click();
    await until(() => installation('own.way-note')?.revision === 4);
    await page.waitForFunction(() => !document.querySelector('#extension-pick').disabled);
    assert.deepEqual(installation('own.way-note').grants, ['ownedUnits.read', 'ownedUnits.write']);
    assert.deepEqual(unitState(), originalUnit);
    assert.equal(receipts(), 5);
    await page.keyboard.press('Escape');
    await page.locator('#extensions-dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'extensions-open');
    assert(await page.locator('#preset-manager').isVisible());
    assert.equal(
      await page.locator('body').evaluate((b) => b.classList.contains('has-workspace')),
      false,
    );
    assert.deepEqual(
      db.prepare('SELECT * FROM campaign WHERE id=?').get(campaign.id),
      originalCampaign,
    );
    db.close();
    db = null;
    await close();
    launches.push(...native.launches);
    results.push({
      zoom,
      noCampaignOpened: true,
      independentOfPresetRead: true,
      explicitConsent: true,
      invalidPackageRejected: true,
      interruptedReplyRecoveredWithoutReplay: true,
      revocation: true,
      removal: true,
      zeroRightsTruthful: true,
      opaqueUnitPreserved: true,
      reinstalled: true,
      keyboardAndFocus: true,
    });
    assert.equal(digestStyle(), presetStylesheet);
    await native.finish({ result: results.at(-1), presetStylesheet });
    await native.dispose();
    native = null;
  }
  await writeFile(
    out + '/result.json',
    JSON.stringify({ source, dirty, presetStylesheet, launches, results }, null, 2),
  );
  console.log(JSON.stringify({ source, dirty, launches, results }));
} catch (e) {
  await native?.fail(e);
  throw e;
} finally {
  db?.close();
  await native?.dispose();
}
