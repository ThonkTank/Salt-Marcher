import { setBrushWorldRadius } from './atlas-brush-probe.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { copyFile, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { digest, freezeTransferInventory } from './atlas-e2e01-fixture.mjs';

/** Native faults stay in the test process/Main handler boundary. No renderer capability is added. */
export async function runE2E01Countercases({
  native,
  runtime,
  fixture,
  file,
  output,
  launch,
  open,
  room,
  getPage,
  canvasReady,
}) {
  const Database = createRequire(import.meta.url)('better-sqlite3');
  const baseline = path.join(output, 'countercase-baseline.sqlite');
  await copyFile(file, baseline);
  const fixtureHash = digest(await import('node:fs/promises').then((fs) => fs.readFile(baseline)));
  const evidence = [];
  const state = () => {
    const db = new Database(file, { readonly: true });
    try {
      return Object.fromEntries(
        db
          .prepare(
            "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
          )
          .all()
          .map(({ name }) => [
            name,
            db
              .prepare('SELECT * FROM "' + name + '"')
              .all()
              .map((r) => JSON.stringify(r))
              .sort(),
          ]),
      );
    } finally {
      db.close();
    }
  };
  const unchanged = (before, label) =>
    assert.equal(digest(JSON.stringify(state())), digest(JSON.stringify(before)), label);
  const waitMain = async (key) => {
    const end = Date.now() + 20000;
    while (
      !(await native.app.evaluate((_, key) => !!globalThis.__e01?.[key], key)) &&
      Date.now() < end
    )
      await new Promise((r) => setTimeout(r, 25));
    assert(
      await native.app.evaluate((_, key) => !!globalThis.__e01?.[key], key),
      'Main fault reached ' +
        key +
        ': ' +
        JSON.stringify(
          await native.app.evaluate(() => ({
            requests: globalThis.__e01?.requests?.length,
            armed: globalThis.__e01?.armed,
            entered: globalThis.__e01?.entered,
            responseReady: globalThis.__e01?.responseReady,
            held: globalThis.__e01?.held,
          })),
        ),
    );
  };
  const arm = async (channel, mode, details = {}) =>
    native.app.evaluate(
      ({ ipcMain }, config) => {
        const original = ipcMain._invokeHandlers.get(config.channel);
        if (!original) throw Error('Required production handler missing: ' + config.channel);
        globalThis.__e01 = { requests: [], resolutions: [], armed: true };
        ipcMain.removeHandler(config.channel);
        ipcMain.handle(config.channel, async (event, ...args) => {
          const fault = globalThis.__e01;
          fault.requests.push(args[0]?.commandId ?? args[0]);
          const first = fault.armed;
          fault.armed = false;
          if (first && config.mode === 'mutate') {
            const c = args[0];
            if (config.details.kind === 'foreign-campaign')
              c.campaignId = config.details.campaignId;
            else if (config.details.kind === 'stale-campaign') c.expectedCampaignRevision += 1;
            else
              c.action = {
                kind: 'world',
                command: {
                  commandId: c.commandId,
                  token: c.token,
                  campaignId: c.campaignId,
                  action: config.details.action,
                },
              };
          }
          fault.entered = true;
          const reply = await original(event, ...args);
          fault.responseReady = true;
          if (first && config.mode === 'hold') {
            fault.held = true;
            fault.command = args[0];
            fault.reply = reply;
            await new Promise((resolve) => {
              fault.release = resolve;
            });
            fault.released = true;
          }
          if (first && config.mode === 'lost') {
            fault.command = args[0];
            fault.lost = true;
            throw Error('E2E-01 deliberately lost the committed reply');
          }
          return reply;
        });
      },
      { channel, mode, details },
    );
  const reset = async () => {
    for (const directory of ['Local Storage', 'Session Storage', 'IndexedDB', 'atlas-region-cache'])
      await rm(path.join(native.profile, directory), { recursive: true, force: true });
    for (const suffix of ['-wal', '-shm']) await rm(file + suffix, { force: true });
    await copyFile(baseline, file);
  };
  async function scenario(id, work) {
    if (process.env.E2E01_ONLY_COUNTERCASE && process.env.E2E01_ONLY_COUNTERCASE !== id) return;
    native.mark(id);
    await reset();
    await launch();
    await open(fixture.a);
    const before = state();
    native.mark(id + ' assertions');
    await work(getPage(), before);
    await native.capture(getPage(), id);
    await native.close();
    evidence.push({
      id,
      status: 'passed',
      fixtureHash,
      fixtureRecipeHash: fixture.recipeHash,
      build: native.source,
      storage: true,
      visible: true,
    });
  }
  const camera = async (page) =>
    JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view'));
  const sameCamera = (actual, expected) => {
    for (const [a, b] of [
      [actual.x + actual.width / 2, expected.x + expected.width / 2],
      [actual.y + actual.height / 2, expected.y + expected.height / 2],
      [actual.width, expected.width],
    ])
      assert(
        Math.abs(a - b) <= Math.max(1e-8, Math.abs(b) * 1e-8),
        'Camera centre and scale remain with their campaign across viewport resize',
      );
  };
  const pan = async (page) => {
    const box = await page.locator('#campaign-map').boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 4 });
    await page.mouse.up({ button: 'middle' });
    await canvasReady(page);
  };
  await scenario('E01-N01-context-camera-focus', async (page, before) => {
    await room();
    const a = await camera(page);
    await open(fixture.b);
    assert.notDeepEqual(await camera(page), a);
    assert(
      !(await page
        .locator('#atlas-selection-title')
        .textContent()
        .then((s) => s.includes('Torhalle'))),
    );
    await pan(page);
    const b = await camera(page);
    await page.locator('#atlas-search').fill('Besitzer B');
    assert.equal(await page.locator('#atlas-search').inputValue(), 'Besitzer B');
    assert.equal(
      await page.locator('#atlas-search').evaluate((n) => n === document.activeElement),
      true,
    );
    await open(fixture.a);
    sameCamera(await camera(page), a);
    await room();
    await page.locator('#atlas-search').fill('Besitzer A');
    assert.equal(
      await page.locator('#atlas-search').evaluate((n) => n === document.activeElement),
      true,
    );
    await open(fixture.b);
    sameCamera(await camera(page), b);
    assert.equal(await page.locator('#atlas-search').inputValue(), '');
    for (const table of [
      'room',
      'dungeon_key_content',
      'encounter_plan',
      'atlas_command',
      'atlas_receipt',
      'drawing_history',
    ])
      assert.deepEqual(state()[table], before[table]);
    const now = freezeTransferInventory(runtime, file, fixture.a);
    assert.deepEqual(JSON.parse(now.rows.encounter_plan[0].payload).sources, [
      fixture.creatureReference,
    ]);
  });
  await scenario('E01-N02-late-load', async (page, before) => {
    await room();
    await arm('atlas:geometry-region', 'hold');
    await page.locator('#atlas-region-retry').evaluate((button) => button.click());
    await waitMain('held');
    await open(fixture.b);
    const b = await camera(page),
      title = await page.locator('#atlas-selection-title').textContent();
    await native.app.evaluate(() => globalThis.__e01.release());
    await waitMain('released');
    await canvasReady(page);
    sameCamera(await camera(page), b);
    assert.equal(await page.locator('#atlas-selection-title').textContent(), title);
    assert.equal(await page.locator('#atlas-save-status').getAttribute('data-error'), 'false');
    await page.locator('#atlas-search').fill('Torhalle');
    assert.equal(await page.locator('#atlas-search-results button').count(), 0);
    // Switching itself may update active/open metadata. All owner data, history and receipts stay unchanged.
    for (const table of [
      'room',
      'dungeon_key_content',
      'encounter_plan',
      'atlas_command',
      'atlas_receipt',
      'drawing_history',
    ])
      assert.deepEqual(state()[table], before[table]);
  });
  await scenario('E01-N03-held-write-switch-fence', async (page) => {
    await room();
    await arm('atlas:drawing-commit', 'hold');
    await page.locator('#key-open').click();
    await page.locator('#key-gm-notes').fill('A besitzt diesen bestätigten Text.');
    await waitMain('held');
    assert.notEqual(await page.locator('#key-save-status').getAttribute('data-state'), 'saved');
    // The actual campaign transition drains in-flight writers. It must stay at A until this receipt arrives.
    await page.evaluate((id) => {
      const s = document.querySelector('#campaigns');
      s.value = id;
      s.dispatchEvent(new Event('change'));
    }, fixture.b);
    await page.waitForFunction(() => document.querySelector('main').inert);
    assert.equal(await page.locator('#campaign-header-name').textContent(), 'E2E-01 Nebelmark');
    await native.app.evaluate(() => globalThis.__e01.release());
    await page.waitForFunction(
      (id) =>
        document.querySelector('#campaigns').value === id && !document.querySelector('main').inert,
      fixture.b,
    );
    await canvasReady(page);
    assert.equal(await page.locator('#key-dialog').isVisible(), false);
    assert.equal(
      await page
        .locator('#atlas-save-status')
        .textContent()
        .then((s) => s.includes('A besitzt')),
      false,
    );
    const db = new Database(file, { readonly: true });
    try {
      const key = JSON.parse(
        db
          .prepare('SELECT payload FROM dungeon_key_content WHERE campaign_id=? AND id=?')
          .get(fixture.a, fixture.roomId).payload,
      );
      assert(key.blocks.some((b) => b.text === 'A besitzt diesen bestätigten Text.'));
      assert.equal(
        db.prepare('SELECT count(*) n FROM dungeon_key_content WHERE campaign_id=?').get(fixture.b)
          .n,
        0,
      );
    } finally {
      db.close();
    }
  });
  await scenario('E01-N03b-late-write-after-owner-change', async (page) => {
    await room();
    await arm('atlas:drawing-commit', 'hold');
    await page.locator('#key-open').click();
    await page.locator('#key-gm-notes').fill('A bleibt Besitzer der späten Schreibantwort.');
    await waitMain('held');
    const committed = state();
    // Adversarial lifecycle ordering is injected only through the native test process's debugger.
    // Temporarily bypass the already-tested transition drain; the real deactivation/activation and real reply consumers still run.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Debugger.enable');
    const renderer = await readFile(
      path.join(process.cwd(), '.build/desktop/ui/renderer.js'),
      'utf8',
    );
    const line = renderer
      .split('\n')
      .findIndex((line) => /\("campaigns"\)\.addEventListener\("change"/.test(line));
    assert(line >= 0, 'Production campaign lifecycle handler must exist in this exact build');
    const { breakpointId } = await cdp.send('Debugger.setBreakpointByUrl', {
      urlRegex: 'renderer\\.js$',
      lineNumber: line + 1,
    });
    let editorObject, originalFlush, hookError;
    const paused = new Promise((resolve) =>
      cdp.once('Debugger.paused', async ({ callFrames }) => {
        try {
          const frame = callFrames[0].callFrameId;
          editorObject = (
            await cdp.send('Debugger.evaluateOnCallFrame', {
              callFrameId: frame,
              expression: 'editors',
            })
          ).result.objectId;
          originalFlush = (
            await cdp.send('Debugger.evaluateOnCallFrame', {
              callFrameId: frame,
              expression: 'editors.flush',
            })
          ).result.objectId;
          assert(
            editorObject && originalFlush,
            'The test process must bind the actual lifecycle owner',
          );
          await cdp.send('Debugger.evaluateOnCallFrame', {
            callFrameId: frame,
            expression: 'editors.flush = async () => true',
          });
          await cdp.send('Debugger.removeBreakpoint', { breakpointId });
        } catch (error) {
          hookError = error;
        } finally {
          await cdp.send('Debugger.resume');
          resolve();
        }
      }),
    );
    try {
      await page.evaluate((id) => {
        const s = document.querySelector('#campaigns');
        s.value = id;
        s.dispatchEvent(new Event('change'));
      }, fixture.b);
      await paused;
      if (hookError) throw hookError;
      await page.waitForFunction(
        (id) =>
          document.querySelector('#campaigns').value === id &&
          !document.querySelector('main').inert,
        fixture.b,
      );
      await canvasReady(page);
      const status = await page.locator('#atlas-save-status').textContent();
      await native.app.evaluate(() => globalThis.__e01.release());
      await waitMain('released');
      await canvasReady(page);
      assert.equal(await page.locator('#key-dialog').isVisible(), false);
      assert.equal(await page.locator('#atlas-save-status').textContent(), status);
      assert.equal(await page.locator('#atlas-save-status').getAttribute('data-error'), 'false');
      assert.equal(
        await page
          .locator('#key-gm-notes')
          .inputValue()
          .then((s) => s.includes('späten Schreibantwort')),
        false,
      );
      for (const table of [
        'room',
        'dungeon_key_content',
        'encounter_plan',
        'atlas_command',
        'atlas_receipt',
        'drawing_history',
      ])
        assert.deepEqual(state()[table], committed[table]);
      await page.locator('#atlas-search').fill('Eingabe gehört B');
      assert.equal(
        await page.locator('#atlas-search').evaluate((n) => document.activeElement === n),
        true,
      );
    } finally {
      if (editorObject && originalFlush)
        await cdp.send('Runtime.callFunctionOn', {
          objectId: editorObject,
          functionDeclaration: 'function(original) { this.flush = original; }',
          arguments: [{ objectId: originalFlush }],
        });
      await cdp.detach();
    }
  });
  for (const kind of [
    'foreign-campaign',
    'stale-campaign',
    'foreign-world',
    'stale-world',
    'foreign-location',
    'stale-location',
  ])
    await scenario('E01-N04-' + kind, async (page) => {
      await room();
      const db = new Database(file, { readonly: true });
      let details;
      try {
        const world = JSON.parse(
            db
              .prepare("SELECT payload FROM world_record WHERE campaign_id=? AND kind='map'")
              .get(fixture.a).payload,
          ),
          foreignWorld = db
            .prepare("SELECT id FROM world_record WHERE campaign_id=? AND kind='map'")
            .get(fixture.b).id,
          location = db
            .prepare('SELECT revision FROM location WHERE campaign_id=? AND id=?')
            .get(fixture.a, fixture.locationId);
        details = { kind, campaignId: fixture.b };
        if (kind.endsWith('world'))
          details.action = {
            kind: 'cell',
            mapId: kind.startsWith('foreign') ? foreignWorld : world.id,
            expectedRevision: kind.startsWith('foreign') ? world.revision : world.revision + 1,
            cell: { q: 0, r: 0, level: 0, terrain: 'plains', elevationM: 0 },
          };
        if (kind.endsWith('location'))
          details.action = {
            kind: 'place',
            mapId: world.id,
            locationId: kind.startsWith('foreign') ? fixture.foreignLocationId : fixture.locationId,
            expectedRevision: kind.startsWith('foreign')
              ? null
              : db
                  .prepare('SELECT revision FROM atlas_place WHERE campaign_id=? AND location_id=?')
                  .get(fixture.a, fixture.locationId).revision,
            expectedLocationRevision: location.revision + 1,
            hex: { q: 0, r: 0 },
          };
      } finally {
        db.close();
      }
      await arm('atlas:commit', 'mutate', details);
      const before = state();
      await page.locator('#atlas-placement > summary').click();
      await page.locator('#atlas-group-factor').fill('1.1');
      await page.locator('#atlas-group-scale').click();
      await page.waitForFunction(
        () => document.querySelector('#atlas-save-status').dataset.error === 'true',
      );
      assert.match(
        await page.locator('#atlas-save-status').textContent(),
        /geändert|Kampagne|Karte|Ort|Atlas|Welt|früheren|Datenbankzeile/i,
      );
      unchanged(before, kind + ' rejects before data, history or receipt mutation');
      await page.locator('#atlas-search').fill('Archiv');
      assert.equal(await page.locator('#atlas-search').inputValue(), 'Archiv');
    });
  await scenario('E01-N05-lost-commit-reconcile', async (page) => {
    await room();
    await arm('atlas:drawing-commit', 'lost');
    await page.locator('#key-open').click();
    await page.locator('#key-gm-notes').fill('Einmal trotz verlorener Antwort.');
    await waitMain('lost');
    await page.waitForFunction(
      () =>
        document.querySelector('#key-save-status').dataset.state === 'error' &&
        document.querySelector('#atlas-recover').hidden === false,
    );
    assert.notEqual(await page.locator('#key-save-status').getAttribute('data-state'), 'saved');
    const command = await native.app.evaluate(() => globalThis.__e01.command);
    const after = state();
    await native.app.evaluate(({ ipcMain }) => {
      const original = ipcMain._invokeHandlers.get('atlas:reconcile-commit');
      ipcMain.removeHandler('atlas:reconcile-commit');
      ipcMain.handle('atlas:reconcile-commit', async (event, command) => {
        globalThis.__e01.resolutions.push(command.commandId);
        return original(event, command);
      });
    });
    await page.locator('#atlas-status').click();
    await page.locator('#atlas-recover').click();
    await page.waitForFunction(() => document.querySelector('#atlas-recover').hidden);
    assert.deepEqual(await native.app.evaluate(() => globalThis.__e01.resolutions), [
      command.commandId,
    ]);
    assert.deepEqual(await native.app.evaluate(() => globalThis.__e01.requests), [
      command.commandId,
    ]);
    unchanged(after, 'Receipt clarification cannot issue a replacement write');
    await page.locator('#key-reload').click();
    assert.equal(
      await page.locator('#key-gm-notes').inputValue(),
      'Einmal trotz verlorener Antwort.',
    );
    await page.locator('#key-gm-notes').fill('Nach Klärung weitergearbeitet.');
    await page.waitForFunction(
      () => document.querySelector('#key-save-status').dataset.state === 'saved',
    );
  });
  for (const fault of ['missing-source', 'unknown-source', 'source-version', 'unavailable-source'])
    await scenario('E01-N06-' + fault, async (page) => {
      await room();
      const db = new Database(file);
      const restore = [];
      try {
        if (fault === 'missing-source') {
          const ids = db
            .prepare(
              "SELECT id FROM item_definition WHERE json_extract(payload,'$.source.kind')='srd51'",
            )
            .all()
            .map((r) => r.id);
          for (const table of ['item_definition', 'item_definition_version', 'authored_item']) {
            const rows = db
              .prepare('SELECT * FROM ' + table)
              .all()
              .filter((r) => ids.includes(r.id));
            restore.push([table, rows]);
            for (const id of ids) db.prepare('DELETE FROM ' + table + ' WHERE id=?').run(id);
          }
        } else if (fault === 'unavailable-source') {
          const row = db
            .prepare('SELECT * FROM item_definition_version WHERE id=? AND revision=?')
            .get(fixture.itemReference.entryId, Number(fixture.itemReference.sourceVersion));
          restore.push(['item_definition_version', [row]]);
          db.prepare('UPDATE item_definition_version SET checksum=? WHERE id=? AND revision=?').run(
            '0'.repeat(64),
            row.id,
            row.revision,
          );
        } else {
          const row = db
              .prepare('SELECT * FROM dungeon_key_content WHERE campaign_id=? AND id=?')
              .get(fixture.a, fixture.roomId),
            key = JSON.parse(row.payload);
          restore.push(['dungeon_key_content', [row]]);
          const ref = key.references.find((r) => r.kind === 'item').catalogReference;
          if (fault === 'unknown-source') ref.sourceId = 'not-installed-provider';
          else ref.sourceVersion = '999999';
          const payload = JSON.stringify(key);
          db.prepare(
            'UPDATE dungeon_key_content SET payload=?,checksum=? WHERE campaign_id=? AND id=?',
          ).run(payload, digest(payload), fixture.a, fixture.roomId);
        }
      } finally {
        db.close();
      }
      const before = state();
      await page.locator('#key-open').click();
      await page.locator('#key-dialog').waitFor({ state: 'visible' });
      await page.waitForFunction(
        (fault) =>
          [...document.querySelectorAll('#key-references [data-state=error]')].some((n) =>
            n.textContent.includes(fault),
          ),
        fault,
      );
      await page.locator('#key-gm-notes').fill('Diese Übernahme muss vollständig scheitern.');
      await page.waitForFunction(
        () => document.querySelector('#key-save-status').dataset.state === 'error',
      );
      assert.match(await page.locator('#key-save-status').textContent(), new RegExp(fault));
      unchanged(before, fault + ' cannot partially adopt a key or append history/receipts');
      // The failed draft is explicitly reloaded. Unaffected work must succeed while the source is still faulty.
      await page.locator('#key-reload').click();
      await page.locator('#key-close').click();
      await open(fixture.b);
      await page.locator('#atlas-units').selectOption('metric');
      await page.locator('#atlas-section').selectOption('terrain');
      await canvasReady(page);
      await page.locator('[data-tool-group="properties"]').click();
      await page.locator('[data-tool-select="land-tool"][data-tool-value="property"]').click();
      await page.locator('#land-field').selectOption('elevationM');
      await page.locator('#land-value').fill('123');
      const view = await camera(page);
      await setBrushWorldRadius(page, 'land-radius', view.width * 0.025);
      await canvasReady(page);
      const canvas = await page.locator('#campaign-map').boundingBox();
      await page.mouse.move(canvas.x + canvas.width * 0.25, canvas.y + canvas.height * 0.6);
      await page.mouse.down();
      await page.mouse.move(canvas.x + canvas.width * 0.3, canvas.y + canvas.height * 0.6, {
        steps: 3,
      });
      await page.mouse.up();
      await page.waitForFunction(
        () => document.querySelector('#land-status').textContent === 'Gespeichert',
      );
      const independent = new Database(file, { readonly: true });
      try {
        assert(
          independent
            .prepare('SELECT count(*) n FROM atlas_landscape WHERE campaign_id=?')
            .get(fixture.b).n > 0,
        );
        const originalKey = independent
          .prepare('SELECT * FROM dungeon_key_content WHERE campaign_id=? AND id=?')
          .get(fixture.a, fixture.roomId);
        assert(
          before.dungeon_key_content.includes(JSON.stringify(originalKey)),
          'Unrelated B edit cannot repair or mutate faulty A source bindings',
        );
      } finally {
        independent.close();
      }
      const stillUnavailable = await page.evaluate(
        (reference) => window.campaign.resolveCatalogReference(reference),
        fault === 'unknown-source'
          ? { ...fixture.itemReference, sourceId: 'not-installed-provider' }
          : fault === 'source-version'
            ? { ...fixture.itemReference, sourceVersion: '999999' }
            : fixture.itemReference,
      );
      assert.equal(stillUnavailable.ok, false);
      assert.match(stillUnavailable.error, new RegExp(fault));
      // Restore only the test-owned damaged source and return to the original editor.

      const repair = new Database(file);
      try {
        repair.transaction(() => {
          for (const [table, rows] of restore)
            for (const row of rows) {
              const columns = Object.keys(row);
              repair
                .prepare(
                  'INSERT OR REPLACE INTO ' +
                    table +
                    '(' +
                    columns.join(',') +
                    ') VALUES(' +
                    columns.map(() => '?').join(',') +
                    ')',
                )
                .run(...Object.values(row));
            }
        })();
      } finally {
        repair.close();
      }
      await open(fixture.a);
      await room();
      await page.locator('#key-open').click();
      await page.locator('#key-gm-notes').fill('Weiterarbeit nach sichtbarer Quellenklärung.');
      await page.waitForFunction(
        () => document.querySelector('#key-save-status').dataset.state === 'saved',
      );
    });
  await reset();
  await writeFile(path.join(output, 'countercases.json'), JSON.stringify(evidence, null, 2));
  return evidence;
}
