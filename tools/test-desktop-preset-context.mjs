import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { runNativeProbe } from './native-session.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  out =
    process.env.QA_EVIDENCE_DIR ??
    path.resolve(process.argv[2] ?? '.build/preset-context-evidence');
await runNativeProbe(
  { output: out, name: 'preset-context', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    const require = createRequire(import.meta.url),
      { _electron } = require('playwright-core');
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/preset-context-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/preset-context-store.cjs'),
      profile = native.profile,
      file = profile + '/workbench.sqlite',
      store = new CampaignStore(file),
      a = store.create('Wald'),
      b = store.create('Hafen');
    store.close();

    for (let i = 0; i < 100; i++) {
      if (
        await stat(profile + '/bus')
          .then(() => true)
          .catch(() => false)
      )
        break;
      await new Promise((r) => setTimeout(r, 20));
    }
    const results = [],
      errors = [],
      artifacts = {};
    for (const p of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/preset-settings.js'])
      artifacts[p] = createHash('sha256')
        .update(await readFile('.build/desktop/' + p))
        .digest('hex');
    let app,
      page,
      closed = true,
      presetId;
    async function launch(scale, campaign) {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [
          root + '/.build/desktop/main.cjs',
          '--ozone-platform=x11',
          '--force-device-scale-factor=' + scale,
          '--data-dir',
          profile,
        ],
      });
      closed = false;
      page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      if (await page.locator('#tutorial-skip').isVisible())
        await page.locator('#tutorial-skip').click();
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: /^(Öffnen|Fortsetzen)$/ })
        .click();
      await revealWorkspaceNavigation(page);
      await app.evaluate(({ ipcMain }) => {
        globalThis.__presetWrites = [];
        const reader = ipcMain._invokeHandlers.get('campaign:preset-registry'),
          writer = ipcMain._invokeHandlers.get('campaign:preset-command');
        ipcMain.removeHandler('campaign:preset-registry');
        ipcMain.handle('campaign:preset-registry', async (event, id) => {
          if (id !== globalThis.__failedPresetContext) return reader(event, id);
          if (globalThis.__holdPresetContext) {
            globalThis.__presetContextHeld = true;
            await new Promise((resolve) => (globalThis.__releasePresetContext = resolve));
          }
          return { ok: false, error: 'Kontrollierter Kontextlesefehler' };
        });
        ipcMain.removeHandler('campaign:preset-command');
        ipcMain.handle('campaign:preset-command', async (event, command) => {
          globalThis.__presetWrites.push({
            kind: command.action.kind,
            campaignId: command.campaignId,
          });
          return writer(event, command);
        });
      });
      await settings();
      assert.equal(await page.locator('#preset-context').inputValue(), campaign.id);
    }
    async function settings() {
      await revealWorkspaceNavigation(page);
      await page.locator('#application-trigger').click();
      await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector('#preset-manager').open &&
          !document.querySelector('#preset-close').disabled,
      );
    }
    async function saved() {
      await page.locator('#preset-save').click();
      await page.waitForFunction(() =>
        document.querySelector('#preset-status').textContent.startsWith('Preset gespeichert.'),
      );
    }
    async function assign() {
      await page.locator('#preset-assign').click();
      await page.waitForFunction(
        () => document.querySelector('#preset-status').textContent === 'Zuweisung gespeichert.',
      );
    }
    async function close() {
      const ended = new Promise((r) =>
        app.process().once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      const exit = await ended;
      assert.deepEqual(exit, { code: 0, signal: null });
      closed = true;
      return exit;
    }
    try {
      await launch(1, a);
      await page.locator('#preset-copy').click();
      presetId = await page.locator('#preset-selection').inputValue();
      await page.locator('#preset-name').fill('Waldregeln');
      await saved();
      assert.match(await page.locator('#preset-effective').innerText(), /Systempreset/);
      await assign();
      await page.locator('#preset-name').fill('Gemeinsame Einzelinitiative');
      await page.locator('#preset-mob').fill('0');
      await app.evaluate((_, id) => {
        globalThis.__failedPresetContext = id;
        globalThis.__holdPresetContext = true;
      }, b.id);
      await page.locator('#preset-context').selectOption(b.id);
      for (let i = 0; i < 100; i++) {
        if (await app.evaluate(() => !!globalThis.__presetContextHeld)) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.equal(await app.evaluate(() => !!globalThis.__presetContextHeld), true);
      assert.equal(await page.locator('#preset-context').inputValue(), a.id);
      assert.equal(await page.locator('#preset-context').isDisabled(), true);
      assert.match(await page.locator('#preset-effective').innerText(), /Waldregeln/);
      assert.match(await page.locator('#preset-status').innerText(), /geladen/);
      await page.screenshot({ path: path.join(out, 'pending-switch-confirmed.png') });
      await app.evaluate(() => {
        globalThis.__holdPresetContext = false;
        globalThis.__releasePresetContext();
      });
      await page.waitForFunction(
        () =>
          document.querySelector('#preset-status').textContent ===
          'Kontrollierter Kontextlesefehler',
      );
      assert.equal(await page.locator('#preset-context').inputValue(), a.id);
      assert.equal(await page.locator('#preset-name').inputValue(), 'Gemeinsame Einzelinitiative');
      assert.equal(await page.locator('#preset-mob').inputValue(), '0');
      assert.match(await page.locator('#preset-effective').innerText(), /Waldregeln/);
      assert.equal(await app.evaluate(() => globalThis.__presetWrites.length), 2);
      await page.screenshot({ path: path.join(out, 'failed-switch-retained.png') });
      await app.evaluate(() => {
        globalThis.__failedPresetContext = null;
      });
      await page.locator('#preset-context').selectOption(b.id);
      await page.waitForFunction(() => !document.querySelector('#preset-context').disabled);
      assert.match(await page.locator('#preset-effective').innerText(), /Systempreset/);
      assert.equal(await page.locator('#preset-name').inputValue(), 'Gemeinsame Einzelinitiative');
      assert.equal(await page.locator('#preset-assign').isDisabled(), true);
      await saved();
      assert.match(await page.locator('#preset-effective').innerText(), /Systempreset/);
      await assign();
      assert.equal(await page.locator('#preset-context').inputValue(), b.id);
      assert.match(
        await page.locator('#preset-effective').innerText(),
        /Gemeinsame Einzelinitiative/,
      );
      await page.locator('#preset-close').click();
      // Reopening a requested context must not reuse the prior registry on failure.
      await app.evaluate((_, id) => {
        globalThis.__failedPresetContext = id;
        globalThis.__holdPresetContext = true;
        globalThis.__presetContextHeld = false;
      }, a.id);
      const opening = settings();
      for (let i = 0; i < 100; i++) {
        if (await app.evaluate(() => !!globalThis.__presetContextHeld)) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.equal(await app.evaluate(() => !!globalThis.__presetContextHeld), true);
      assert.equal(await page.locator('#preset-selection option').count(), 0);
      assert.match(await page.locator('#preset-effective').innerText(), /geladen/);
      assert.equal(await page.locator('#preset-form').isVisible(), false);
      await page.screenshot({ path: path.join(out, 'pending-open-unavailable.png') });
      await app.evaluate(() => {
        globalThis.__holdPresetContext = false;
        globalThis.__releasePresetContext();
      });
      await opening;
      assert.equal(await page.locator('#preset-form').isVisible(), false);
      assert.match(await page.locator('#preset-effective').innerText(), /nicht verfügbar/);
      for (const id of ['preset-save', 'preset-assign', 'preset-copy'])
        assert.equal(await page.locator('#' + id).isDisabled(), true);
      await page.screenshot({ path: path.join(out, 'failed-open-unavailable.png') });
      await page.locator('#preset-close').click();
      const writes = await app.evaluate(() => globalThis.__presetWrites);
      assert.deepEqual(writes, [
        { kind: 'preset-save', campaignId: a.id },
        { kind: 'preset-assign', campaignId: a.id },
        { kind: 'preset-save', campaignId: b.id },
        { kind: 'preset-assign', campaignId: b.id },
      ]);
      results.push({ scale: 1, writes, exit: await close() });
      await launch(2, b);
      assert.equal(await page.locator('#preset-selection').inputValue(), presetId);
      assert.equal(await page.locator('#preset-name').inputValue(), 'Gemeinsame Einzelinitiative');
      assert.equal(await page.locator('#preset-mob').inputValue(), '0');
      assert.match(
        await page.locator('#preset-effective').innerText(),
        /Gemeinsame Einzelinitiative/,
      );
      await page.screenshot({ path: path.join(out, 'reopened-200.png') });
      await page.locator('#preset-close').click();
      results.push({ scale: 2, exit: await close() });
      const fresh = new CampaignStore(file);
      let state;
      try {
        const ar = fresh.presetRegistry(a.id),
          br = fresh.presetRegistry(b.id);
        assert.equal(ar.effectiveId, presetId);
        assert.equal(br.effectiveId, presetId);
        const p = br.presets.find((p) => p.id === presetId);
        assert.equal(p.config.combat.mobThreshold, 0);
        assert.equal(p.name, 'Gemeinsame Einzelinitiative');
        state = {
          a: ar.effectiveId,
          b: br.effectiveId,
          name: p.name,
          mobThreshold: p.config.combat.mobThreshold,
        };
      } finally {
        fresh.close();
      }
      assert.deepEqual(errors, []);
      await native.recordResult({
        head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        workingTree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
        profile,
        results,
        state,
        errors,
        artifacts,
      });
      console.log(JSON.stringify({ results, state }));
    } catch (error) {
      await writeFile(
        path.join(out, 'failure.json'),
        JSON.stringify({ error: error.stack, profile, results, errors }, null, 2),
      );
      if (app && !closed)
        await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
      throw error;
    } finally {
    }
  },
);
