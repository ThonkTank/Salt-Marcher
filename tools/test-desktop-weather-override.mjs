import { runNativeProbe } from './native-session.mjs';
let native,
  nativeCase = 0;
// Scene-specific GM weather, confirmed time, Fresh and explicit automatic release.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core'),
  Database = require('better-sqlite3');
const output = process.env.QA_EVIDENCE_DIR ?? (await mkdtemp('/tmp/weather-override-evidence-'));
await mkdir(output, { recursive: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/weather-override-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/weather-override-store.cjs');
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
const hashes = Object.fromEntries(
  await Promise.all(
    ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'].map(
      async (name) => [
        name,
        createHash('sha256')
          .update(await readFile(root + '/.build/desktop/' + name))
          .digest('hex'),
      ],
    ),
  ),
);
const launches = [],
  results = [],
  errors = [];
let app,
  page,
  stage = 'fixture';
async function bounded(task, ms) {
  let timer;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Desktop close timed out')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function close() {
  const ended = new Promise((resolve) =>
    app.process().once('exit', (code, signal) => resolve({ code, signal })),
  );
  await native.close();
  const exit = await bounded(ended, 10000);
  assert.deepEqual(exit, { code: 0, signal: null });
  launches.at(-1).exit = exit;
  app = null;
}
async function capture(name) {
  await page.locator('#live-world-summary').evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await page.locator('#live-weather-effects').scrollIntoViewIfNeeded();
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.screenshot({ path: output + '/' + name + '.png' });
}
async function automaticVisible(frame, notes) {
  const weather = frame.weather;
  assert(weather && weather.source !== 'GM-Override');
  await page.waitForFunction(
    ({ date, label, temperature, notes }) => {
      const summary = document.getElementById('live-world-summary').textContent;
      return (
        summary.includes(date) &&
        summary.includes(label) &&
        summary.includes(temperature + ' °C') &&
        !document.getElementById('live-weather-effects').textContent.includes(notes)
      );
    },
    { date: frame.date, label: weather.label, temperature: weather.effects.temperatureC, notes },
  );
}
for (const scale of [1, 2]) {
  await runNativeProbe(
    { output: output + '/case-' + ++nativeCase, name: 'weather-override' },
    async (session) => {
      native = session;

      const profile = native.profile,
        file = profile + '/workbench.sqlite',
        store = new CampaignStore(file),
        campaign = store.create('Wetter am geteilten Pass'),
        w = store.activate(campaign.id),
        cmd = (action) => ({
          commandId: randomUUID(),
          campaignId: campaign.id,
          token: w.token,
          action,
        });
      const heroes = ['Ada', 'Borin'].map(
        (name) => store.executeLive(cmd({ kind: 'create-character', profile: { name } })).character,
      );
      const primary = store.executeLive(
        cmd({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision }),
      ).scene;
      for (const h of heroes) {
        const live = store.live(w.token);
        store.executeLive(
          cmd({
            kind: 'membership',
            characterId: h.id,
            expectedRevision: h.membershipRevision,
            expectedRosterRevision: live.rosterRevision,
            active: true,
            targetSceneId: primary.id,
            expectedFocusRevision: live.focusRevision,
          }),
        );
      }
      const map = {
        ...store.world(w.token).maps[0],
        name: 'Passregion',
        seed: 'weather-override-native',
        climate: 'temperate',
        cells: [],
      };
      store.executeWorld(cmd({ kind: 'map', map, expectedRevision: map.revision }));
      let scene = store.liveScene(w.token, primary.id);
      store.executeWorld(
        cmd({
          kind: 'place-scene',
          sceneId: scene.id,
          position: { mapId: map.id, q: 0, r: 0, locationId: null },
          expectedSceneRevision: scene.revision,
          expectedPositionRevision: 0,
        }),
      );
      let live = store.live(w.token);
      scene = live.scene;
      const otherId = store.executeLive(
        cmd({
          kind: 'move',
          sceneId: scene.id,
          memberIds: [heroes[1].id],
          expectedRosterRevision: live.rosterRevision,
          expectedFocusRevision: live.focusRevision,
          expectedClockRevision: scene.clock.revision,
          expectedSceneMembershipRevision: scene.membershipRevision,
          target: { kind: 'new', title: 'Borin im Tal', expectedContentRevision: scene.revision },
        }),
      ).session.createdScene.id;
      let other = store.sceneWorld(w.token, otherId);
      store.executeWorld(
        cmd({
          kind: 'place-scene',
          sceneId: otherId,
          position: { mapId: map.id, q: 8, r: -3, locationId: null },
          expectedSceneRevision: other.scene.revision,
          expectedPositionRevision: other.position.revision,
        }),
      );
      other = store.sceneWorld(w.token, otherId);
      store.executeLive(
        cmd({
          kind: 'advance-clock',
          sceneId: otherId,
          expectedRevision: other.scene.clock.revision,
          amount: 2,
          unit: 'days',
          calendarVersion: 'relative-v1',
          reason: 'Gruppe im Tal ist voraus',
        }),
      );
      live = store.live(w.token);
      if (live.focusId !== primary.id)
        store.executeLive(
          cmd({ kind: 'focus', sceneId: primary.id, expectedRevision: live.focusRevision }),
        );
      const originalOther = store.sceneWorld(w.token, otherId),
        originalPrimary = store.sceneWorld(w.token, primary.id);
      store.tutorial('skipped');
      store.close();
      const db = new Database(file, { readonly: true }),
        override = () =>
          db
            .prepare(
              "SELECT * FROM world_record WHERE campaign_id=? AND kind='weather-override' AND id=?",
            )
            .get(campaign.id, primary.id),
        clock = () =>
          db
            .prepare('SELECT * FROM scene_clock WHERE campaign_id=? AND scene_id=?')
            .get(campaign.id, primary.id),
        otherClock = () =>
          db
            .prepare('SELECT * FROM scene_clock WHERE campaign_id=? AND scene_id=?')
            .get(campaign.id, otherId),
        originalOtherClock = otherClock();

      async function launch() {
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
        launches.push({ scale, pid: app.process().pid });
        page = await app.firstWindow();
        page.setDefaultTimeout(15000);
        page.on('pageerror', (e) => errors.push(e.stack));
        await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
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
        if (!(await page.locator('#live-tab').isVisible())) {
          if (await page.locator('#atlas-navigation').isVisible())
            await page.locator('#atlas-navigation').click();
          else await page.locator('#workspace-nav-summary').click();
        }
        await page.locator('#live-tab').click();
        await page.locator('#live-world-summary').waitFor();
        await page.waitForFunction(
          (id) => document.getElementById('scene-focus').value === id,
          primary.id,
        );
      }
      async function until(check) {
        const end = Date.now() + 20000;
        while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
        assert(check(), 'Expected confirmed weather/time facts');
      }
      const notes = 'Nebel am Pass – Sicht für Ada eingeschränkt';
      try {
        stage = 'set GM weather ' + scale;
        await launch();
        await page.locator('#weather-override-form').locator('..').locator('summary').click();
        await page.locator('#weather-override-kind').selectOption('fog');
        await page.locator('#weather-override-intensity').fill('80');
        await page.locator('#weather-override-temperature').fill('8');
        await page.locator('#weather-override-factor').fill('1.25');
        await page.locator('#weather-override-notes').fill(notes);
        await page.getByRole('button', { name: 'GM-Wetter übernehmen', exact: true }).click();
        await until(() => override()?.revision === 1);
        await page.waitForFunction(
          (text) => document.getElementById('live-weather-effects').textContent.includes(text),
          notes,
        );
        const saved = override();
        assert.equal(JSON.parse(saved.payload).weather.effects.combatNote, notes);
        assert.deepEqual(otherClock(), originalOtherClock);
        await capture('override-' + scale);
        stage = 'confirm scene time ' + scale;
        await page.locator('#time-plan-open').click();
        await page.locator('#time-navigator-amount').fill('3');
        await page.locator('#time-navigator-unit').selectOption('day');
        const before = clock();
        await page
          .locator('#time-navigator')
          .getByRole('button', { name: 'Vorschau berechnen', exact: true })
          .click();
        await page
          .locator('#time-navigator')
          .getByRole('button', { name: 'Zeit ausdrücklich verstreichen lassen', exact: true })
          .waitFor({ state: 'visible' });
        assert.deepEqual(clock(), before);
        assert.deepEqual(override(), saved);
        await page
          .locator('#time-navigator')
          .getByRole('button', { name: 'Zeit ausdrücklich verstreichen lassen', exact: true })
          .click();
        await page.locator('#time-navigator').waitFor({ state: 'hidden' });
        assert.equal(clock().instant_ms, '259200000');
        assert.equal(clock().revision, before.revision + 1);
        assert.deepEqual(override(), saved);
        assert.deepEqual(otherClock(), originalOtherClock);
        await close();
        stage = 'Fresh and split focus ' + scale;
        await launch();
        await page.waitForFunction(
          (text) => document.getElementById('live-weather-effects').textContent.includes(text),
          notes,
        );
        assert.deepEqual(override(), saved);
        await page.locator('#scene-focus').selectOption(otherId);
        await automaticVisible(originalOther, notes);
        assert.deepEqual(otherClock(), originalOtherClock);
        await page.locator('#scene-focus').selectOption(primary.id);
        await page.waitForFunction(
          (text) => document.getElementById('live-weather-effects').textContent.includes(text),
          notes,
        );
        await capture('fresh-' + scale);
        stage = 'release override ' + scale;
        const details = page.locator('#weather-override-form').locator('..');
        if (!(await details.evaluate((n) => n.open))) await details.locator('summary').click();
        await page.locator('#weather-release').click();
        await until(() => override()?.revision === 2);
        const check = new CampaignStore(file);
        try {
          await automaticVisible(
            check.sceneWorld(check.activate(campaign.id).token, primary.id),
            notes,
          );
        } finally {
          check.close();
        }
        assert.equal(await page.locator('#weather-release').isDisabled(), true);
        assert.equal(JSON.parse(override().payload).weather, null);
        assert.equal(clock().instant_ms, '259200000');
        assert.deepEqual(otherClock(), originalOtherClock);
        await capture('automatic-' + scale);
        await close();
        const fresh = new CampaignStore(file);
        try {
          const token = fresh.activate(campaign.id).token,
            a = fresh.sceneWorld(token, primary.id),
            b = fresh.sceneWorld(token, otherId);
          assert.notEqual(a.weather.source, 'GM-Override');
          assert.deepEqual(b, originalOther);
          assert.equal(a.weatherOverrideRevision, 2);
          assert.equal(a.scene.clock.instantMs, '259200000');
          assert.equal(a.scene.id, originalPrimary.scene.id);
          assert.equal(
            fresh.db
              .prepare(
                "SELECT count(*) n FROM world_history WHERE campaign_id=? AND scene_id=? AND json_extract(payload,'$.text') IN ('Wetter als GM gesetzt','Wetterautomatik wieder freigegeben')",
              )
              .get(campaign.id, primary.id).n,
            2,
          );
        } finally {
          fresh.close();
        }
        results.push({
          scale,
          profile,
          overridePreservedThroughTimeAndFresh: true,
          otherGroupUnchanged: true,
          automaticReleased: true,
          confirmedDays: 3,
          weatherChanges: 2,
        });
      } catch (error) {
        if (app) await capture('failure-' + scale).catch(() => {});
        await writeFile(
          output + '/failure.json',
          JSON.stringify({ source, dirty, stage, error: error.stack, launches, errors }, null, 2),
        );
        throw error;
      } finally {
        try {
          if (app) await bounded(native.dispose(), 3000);
        } finally {
          db.close();
        }
      }
    },
  );
}
assert.deepEqual(errors, []);
for (const { pid } of launches) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
await writeFile(
  output + '/result.json',
  JSON.stringify({ source, dirty, hashes, launches, results, errors }, null, 2),
);
console.log(JSON.stringify({ launches, results }));
