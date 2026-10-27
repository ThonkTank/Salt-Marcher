import { runNativeProbe } from './native-session.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  { _electron } = require('playwright-core'),
  out =
    process.env.QA_EVIDENCE_DIR ??
    path.resolve(process.argv[2] ?? '.build/dungeon-authoring-evidence');
await runNativeProbe(
  { output: out, name: 'dungeon-authoring', resultName: 'result.json' },
  async (native) => {
    await mkdir(out, { recursive: true });
    require('esbuild').buildSync({
      entryPoints: ['src/app/storage/store.ts'],
      outfile: '.build/native-dungeon-authoring-store.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
    });
    const { CampaignStore } = require(root + '/.build/native-dungeon-authoring-store.cjs'),
      profile = native.profile,
      file = profile + '/workbench.sqlite';
    const rooms = ['Torhalle', 'Wachstube', 'Archivgeschoss', 'Archivierter Raum'].map(
      (name, i) => ({
        id: randomUUID(),
        scopeId: 'local',
        floorId: i === 0 ? 'ground' : i === 2 ? 'buried' : 'upper',
        number: String(i + 1),
        name,
        revision: 0,
        polygons: [
          {
            outer: [
              { x: i * 30, y: 0 },
              { x: i * 30 + 6, y: 0 },
              { x: i * 30 + 6, y: 6 },
              { x: i * 30, y: 6 },
            ],
            holes: [],
          },
        ],
        sections: [
          {
            id: randomUUID(),
            kind: 'markdown',
            markdown: '  Original ' + name + '\r\nUnverändert.\n',
          },
        ],
      }),
    );
    const store = new CampaignStore(file),
      campaign = store.create('Dungeon Autorenprobe', rooms),
      token = store.activateShell(campaign.id).token;
    store.tutorial('skipped');
    store.executeDrawing({
      commandId: randomUUID(),
      token,
      campaignId: campaign.id,
      action: { kind: 'room-hide', roomId: rooms[3].id, hidden: true },
    });
    store.db
      .prepare("INSERT INTO drawing_hidden VALUES(?,'buried','local','floor',1,1)")
      .run(campaign.id);
    // Actual damaged runtime-only data; authoring must remain independent, without repairing it.
    store.db
      .prepare('INSERT INTO dungeon_trace VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(campaign.id, 'bad-trace', null, null, 'local', 'ground', 'epoch', '0', '{}', 'broken');
    assert.throws(() => store.dungeon(token), /wahrnehmung beschädigt/);
    store.close();

    let app, page;
    const errors = [],
      launches = [],
      results = {},
      hashes = {};
    for (const f of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
      hashes[f] = createHash('sha256')
        .update(await readFile(root + '/.build/desktop/' + f))
        .digest('hex');
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
    async function launch(scale) {
      app = await native.launchConfigured({
        executablePath: root + '/node_modules/electron/dist/electron',
        args: [
          root + '/.build/desktop/main.cjs',
          '--ozone-platform=x11',
          '--force-device-scale-factor=' + scale,
          '--data-dir',
          profile,
        ],
        timeout: 30000,
      });
      launches.push({ pid: app.process().pid, scale });
      page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      await app.evaluate(({ ipcMain }) => {
        globalThis.__authorReads = [];
        for (const name of [
          'dungeon:view',
          'dungeon:authoring',
          'atlas:execute',
          'atlas:drawing-commit',
        ]) {
          const original = ipcMain._invokeHandlers.get(name);
          ipcMain.removeHandler(name);
          ipcMain.handle(name, (...args) => {
            globalThis.__authorReads.push(name);
            return original(...args);
          });
        }
      });
      await page
        .locator('#campaign-screen-list article')
        .filter({ hasText: campaign.name })
        .getByRole('button', { name: 'Fortsetzen', exact: true })
        .click();
      await page.locator('#atlas-tab').click();
      await page.locator('#atlas-families button[data-family=interior]').click();
      if ((await page.locator('#atlas-advanced').getAttribute('open')) === null)
        await page.locator('#atlas-advanced > summary').click();
    }
    async function key() {
      await page.locator('#key-open').click();
      await page.locator('#key-room-list button').first().waitFor();
    }
    async function choose(name) {
      await page.locator('#key-room-list button').filter({ hasText: name }).click();
      await page.waitForFunction(
        (name) => document.getElementById('key-name').value === name,
        name,
      );
    }
    async function saved() {
      await page.waitForFunction(
        () => document.getElementById('key-save-status').dataset.state === 'saved',
      );
    }
    async function shot(name) {
      await page.screenshot({ path: out + '/' + name + '.png' });
    }
    async function close() {
      const exit = new Promise((r) =>
        app.process().once('exit', (code, signal) => r({ code, signal })),
      );
      await native.close();
      const result = await Promise.race([
        exit,
        new Promise((_, reject) => setTimeout(() => reject(Error('Normal exit timed out')), 10000)),
      ]);
      assert.deepEqual(result, { code: 0, signal: null });
      launches.at(-1).exit = result;
      app = null;
    }
    try {
      await launch(1);
      await key();
      assert.equal(await page.locator('#key-room-list button').count(), 4);
      assert.match(
        await page
          .locator('#key-room-list button')
          .filter({ hasText: 'Archivgeschoss' })
          .innerText(),
        /^Archiviert/,
      );
      await choose('Wachstube');
      assert.doesNotMatch(
        await page.locator('#key-room-list button').filter({ hasText: 'Wachstube' }).innerText(),
        /Ohne Geometrie|Archiviert/,
      );
      assert.equal(await page.locator('#key-map').isEnabled(), true);
      await page.locator('#key-gm-notes').fill('Wachwechsel um Mitternacht.');
      await saved();
      await shot('runtime-damaged-key');
      await page.locator('#key-close').click();
      if (!(await page.locator('#volume-open').isVisible()))
        await page.locator('.dungeon-more-tools > summary').click();
      await page.locator('#volume-open').click();
      await page.locator('#volume-dialog').waitFor({ state: 'visible' });
      await shot('runtime-damaged-volume');
      await page.locator('#volume-close').click();
      const isolatedReads = await app.evaluate(() => globalThis.__authorReads);
      assert(isolatedReads.includes('atlas:drawing-commit'));
      assert(!isolatedReads.includes('dungeon:view'));
      assert(!isolatedReads.includes('atlas:execute'));
      results.isolatedReads = isolatedReads;
      await close();
      // End this deliberate fault case. Repair only its injected row in the closed fixture;
      // the separate healthy map/navigation workflow must not claim runtime-error recovery.
      const repair = new CampaignStore(file);
      try {
        assert.throws(
          () => repair.dungeon(repair.activateShell(campaign.id).token),
          /wahrnehmung beschädigt/,
        );
        assert.equal(
          repair.db
            .prepare(
              "DELETE FROM dungeon_trace WHERE campaign_id=? AND id='bad-trace' AND checksum='broken'",
            )
            .run(campaign.id).changes,
          1,
        );
      } finally {
        repair.close();
      }
      results.faultCaseEndedWithFixtureRepair = true;
      await launch(1);
      await key();
      await choose('Wachstube');
      assert.equal(await page.locator('#key-gm-notes').inputValue(), 'Wachwechsel um Mitternacht.');
      await shot('upper-key');
      await page.locator('#key-map').click();
      await page.waitForFunction(
        () =>
          !document.getElementById('key-dialog').open &&
          document.getElementById('room-name').value === 'Wachstube' &&
          document.getElementById('campaign-atlas').dataset.regionState === 'ready',
      );
      results.mapFloor = await page.locator('#floors').inputValue();
      assert.equal(JSON.parse(results.mapFloor)[1], 'upper');
      await shot('upper-map');
      if (!(await page.locator('#volume-open').isVisible()))
        await page.locator('.dungeon-more-tools > summary').click();
      await page.locator('#volume-open').click();
      await page.locator('#volume-dialog').waitFor({ state: 'visible' });
      await shot('volume');
      await page.locator('#volume-close').click();
      await key();
      await choose('Archivgeschoss');
      assert.equal(await page.locator('#key-map').isDisabled(), true);
      await page.locator('#key-gm-notes').fill('Auch im archivierten Geschoss erhalten.');
      await saved();
      await shot('archived-key');
      await page.locator('#key-close').click();
      const reads = await app.evaluate(() => globalThis.__authorReads);
      assert(reads.includes('dungeon:authoring'));
      assert(!reads.includes('dungeon:view'));
      results.reads = reads;
      await close();
      await launch(2);
      await key();
      await choose('Wachstube');
      assert.equal(await page.locator('#key-gm-notes').inputValue(), 'Wachwechsel um Mitternacht.');
      assert.equal(await page.locator('#key-map').isEnabled(), true);
      await choose('Archivgeschoss');
      assert.equal(
        await page.locator('#key-gm-notes').inputValue(),
        'Auch im archivierten Geschoss erhalten.',
      );
      assert.equal(await page.locator('#key-map').isDisabled(), true);
      await shot('restart-200');
      await page.locator('#key-close').click();
      await close();
      const reopened = new CampaignStore(file);
      try {
        const t = reopened.activateShell(campaign.id).token,
          v = reopened.dungeonAuthoring(t);
        for (const original of rooms) {
          const room = [...v.rooms, ...v.drawing.hiddenRooms].find((r) => r.id === original.id);
          assert.deepEqual(room.sections, original.sections);
          assert.deepEqual(room.polygons, original.polygons);
        }
        assert.equal(v.drawing.hiddenRooms.length, 2);
        assert.doesNotThrow(() => reopened.dungeon(t));
        results.authoredBytesPreserved = true;
      } finally {
        reopened.close();
      }
      assert.deepEqual(errors, []);
      await native.recordResult({
        complete: true,
        head,
        dirty,
        profile,
        campaign,
        rooms,
        hashes,
        launches,
        errors,
        results,
      });
      console.log(JSON.stringify({ complete: true, out, head, launches, results }));
    } catch (e) {
      if (page) await shot('failure').catch(() => {});
      await writeFile(
        out + '/failure.json',
        JSON.stringify(
          { error: e.stack, head, dirty, profile, launches, errors, results },
          null,
          2,
        ),
      );
      throw e;
    } finally {
    }
  },
);
