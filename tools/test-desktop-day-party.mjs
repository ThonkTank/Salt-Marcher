import { runNativeProbe } from './native-session.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

const source = process.cwd();
const output =
  process.env.QA_EVIDENCE_DIR ?? path.resolve(process.argv[2] ?? '.build/day-party-evidence');
await runNativeProbe({ output: output, name: 'day-party' }, async (native) => {
  await mkdir(output, { recursive: true });
  const require = createRequire(source + '/package.json'),
    { _electron } = require('playwright-core');
  require('esbuild').buildSync({
    entryPoints: ['src/app/storage/store.ts'],
    outfile: '.build/day-party-store.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore } = require(source + '/.build/day-party-store.cjs');
  const profile = native.profile,
    file = profile + '/workbench.sqlite',
    store = new CampaignStore(file),
    campaign = store.create('Expedition mit 45 Figuren'),
    w = store.activate(campaign.id);
  const command = (action) => ({
    campaignId: campaign.id,
    token: w.token,
    commandId: randomUUID(),
    action,
  });
  store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 }));
  for (let i = 1; i <= 45; i++) {
    const c = store.executeLive(
        command({
          kind: 'create-character',
          profile: { name: 'Figur ' + String(i).padStart(2, '0') },
        }),
      ).character,
      live = store.live(w.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: live.scene.id,
        expectedFocusRevision: live.focusRevision,
      }),
    );
    store.executeProgress(
      command({
        kind: 'xp',
        characterId: c.id,
        expectedRevision: 0,
        mode: 'set',
        amount: i === 45 ? 299 : 300,
        reason: 'Bestätigter Start',
      }),
    );
  }
  const facts = () =>
    ['roster_member', 'character_progress', 'live_scene'].map((table) =>
      store.db.prepare('SELECT * FROM ' + table + ' ORDER BY id').all(),
    );
  const before = facts();
  store.close();

  let app,
    closed = true;
  const errors = [],
    results = [],
    artifacts = {};
  for (const p of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html'])
    artifacts[p] = createHash('sha256')
      .update(await readFile('.build/desktop/' + p))
      .digest('hex');
  try {
    for (const scale of [1, 2]) {
      app = await native.launchConfigured({
        executablePath: source + '/node_modules/electron/dist/electron',
        args: [
          source + '/.build/desktop/main.cjs',
          '--ozone-platform=x11',
          '--force-device-scale-factor=' + scale,
          '--data-dir',
          profile,
        ],
        timeout: 30000,
      });
      closed = false;
      const page = await app.firstWindow();
      page.on('pageerror', (e) => errors.push(e.stack));
      page.setDefaultTimeout(15000);
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      if (await page.locator('#tutorial-dialog').isVisible())
        await page.locator('#tutorial-skip').click();
      await page
        .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
        .getByRole('button', { name: 'Fortsetzen', exact: true })
        .click();
      await page.locator('#day-trigger').click();
      await page.locator('#day-mode-progress').click();
      await page.locator('#day-total-xp').fill('1');
      await page.waitForFunction(
        () =>
          document.querySelector('#day-popover').getAttribute('aria-busy') === 'false' &&
          document.querySelector('#day-progress-summary'),
      );
      const more = page
        .locator('#day-summary')
        .getByRole('button', { name: 'Weitere 5 Figuren', exact: true });
      assert.equal(await page.locator('#day-summary > table td').count(), 160);
      await more.click();
      assert.equal(await page.locator('#day-summary > table td').count(), 180);
      const last = await page.locator('#day-summary > table tr').last().innerText();
      assert.match(last, /Figur 45/);
      assert.match(last, /299 → 300/);
      assert.match(last, /1 → 2/);
      const devicePixelRatio = await page.evaluate(() => window.devicePixelRatio);
      assert.equal(devicePixelRatio, scale);
      await page.locator('#day-summary > table tr').last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, 'projection-' + scale + '.png') });
      await page.locator('#day-current-details').locator('summary').click();
      await page
        .locator('#day-current')
        .getByRole('button', { name: 'Weitere 5 Figuren', exact: true })
        .click();
      assert.match(await page.locator('#day-current').innerText(), /Figur 45/);
      assert.equal(await page.locator('#day-current td').count(), 180);
      await page.locator('#day-current tr').last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, 'party-' + scale + '.png') });
      await page.locator('#day-close').click();
      await page.locator('#day-trigger').click();
      await page.waitForFunction(
        () => document.querySelector('#day-popover').getAttribute('aria-busy') === 'false',
      );
      assert.equal(
        await page.locator('#day-summary > table td').count(),
        160,
        'reopening confirms a new answer',
      );
      const exited = new Promise((resolve) =>
        app.process().once('exit', (code, signal) => resolve({ code, signal })),
      );
      await native.close();
      const exit = await exited;
      assert.deepEqual(exit, { code: 0, signal: null });
      closed = true;
      results.push({ scale, devicePixelRatio, last, exit });
    }
    const checked = new CampaignStore(file);
    try {
      for (const [i, table] of ['roster_member', 'character_progress', 'live_scene'].entries())
        assert.deepEqual(
          checked.db.prepare('SELECT * FROM ' + table + ' ORDER BY id').all(),
          before[i],
        );
    } finally {
      checked.close();
    }
    assert.deepEqual(errors, []);
    await native.recordResult({
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      workingTree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      profile,
      results,
      errors,
      artifacts,
      partyFactsUnchanged: true,
    });
    console.log(JSON.stringify({ results, partyFactsUnchanged: true }));
  } catch (error) {
    await writeFile(
      path.join(output, 'failure.json'),
      JSON.stringify({ error: error.stack, profile, results, errors }, null, 2),
    );
    if (app && !closed)
      try {
        await (await app.firstWindow()).screenshot({ path: path.join(output, 'failure.png') });
      } catch {}
    throw error;
  } finally {
    if (app && !closed) await native.close();
  }
});
