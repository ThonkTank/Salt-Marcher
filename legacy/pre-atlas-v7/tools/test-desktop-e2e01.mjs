import { runE2E01Countercases } from './atlas-e2e01-countercases.mjs';
import { assertE2E01Scenarios } from './atlas-e2e01-scenarios.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { unzipSync } from 'fflate';
import { runNativeProbe } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';
import { setBrushWorldRadius } from './atlas-brush-probe.mjs';
import {
  fixtureRuntime,
  freezeTransferInventory,
  assertTransferInventory,
  seedE2E01,
  readE2E01,
  verifyMedia,
  digest,
} from './atlas-e2e01-fixture.mjs';

const root = process.cwd(),
  output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/e2e01-native');
await runNativeProbe(
  {
    output,
    name: 'e2e01',
    allowConfirmedCrash: true,
    closeCaptureTimeoutMs: 20000,
    captureFrameTimeoutMs: 15000,
  },
  async (native) => {
    const sourceFiles = [
      'tools/test-desktop-e2e01.mjs',
      'tools/atlas-e2e01-fixture.mjs',
      'tools/native-session.mjs',
      'tools/atlas-e2e01-countercases.mjs',
      'tools/atlas-e2e01-scenarios.mjs',
      'src/app/atlas/campaign-atlas-ui.ts',
      'tests/atlas/desktop-atlas-opening.test.mjs',
    ];
    const sourceHashes = Object.fromEntries(
      await Promise.all(sourceFiles.map(async (f) => [f, digest(await readFile(f))])),
    );
    const buildInfo = JSON.parse(await readFile('.build/desktop/build-info.json', 'utf8'));
    assert.equal(
      buildInfo.commit,
      native.source,
      'Native runtime must be built from this exact SHA',
    );
    const runtime = fixtureRuntime(root),
      { CampaignStore } = runtime,
      fixture = seedE2E01(CampaignStore, native.profile);
    const file = path.join(native.profile, 'workbench.sqlite');
    const seedDatabaseHash = digest(await readFile(file));
    const inventory = (id = fixture.a) => readE2E01(file, id);
    const softwareGpu = process.argv.includes('--software-gpu');
    const initial = inventory(),
      checks = [],
      comparisons = [];
    await writeFile(path.join(output, 'fixture.json'), JSON.stringify(fixture, null, 2));
    await writeFile(path.join(output, 'initial.json'), JSON.stringify(initial, null, 2));
    let page,
      nativeVersions,
      keyCaptureSequence = 0;
    function noSession(id = fixture.a) {
      const state = inventory(id);
      assert.deepEqual(state.live_scene, []);
      assert.deepEqual(state.live_state, []);
    }
    async function until(check, label) {
      const end = Date.now() + 20000;
      while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 30));
      assert(check(), label);
    }
    async function launch() {
      page = await native.launch(
        1,
        softwareGpu
          ? {
              args: [
                path.join(root, '.build/desktop/main.cjs'),
                '--ozone-platform=x11',
                '--use-gl=angle',
                '--use-angle=swiftshader',
                '--enable-unsafe-swiftshader',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-background-timer-throttling',
                '--data-dir',
                native.profile,
              ],
            }
          : {},
      );
      nativeVersions ??= await native.app.evaluate(({ app }) => ({
        application: app.getVersion(),
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome,
      }));
      await native.app.evaluate(({ BrowserWindow }, software) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.unmaximize();
        w.setContentSize(1400, 1000);
        if (software) w.webContents.setBackgroundThrottling(false);
      }, softwareGpu);
    }
    async function open(id) {
      if (!(await page.locator('#campaign-screen').isVisible())) {
        if (!(await page.locator('#campaign-header-name').isVisible()))
          await page.locator('#atlas-navigation').click();
        await page.locator('#campaign-header-name').click();
      }
      await page
        .locator('.campaign-card[data-campaign-id="' + id + '"]')
        .getByRole('button', { name: /Öffnen|Fortsetzen/ })
        .click();
      await page.waitForFunction(
        (id) =>
          document.querySelector('#campaigns').value === id &&
          document.body.classList.contains('has-workspace') &&
          !document.querySelector('main').inert,
        id,
      );
      if (!(await page.locator('#campaign-atlas').isVisible())) {
        if (!(await page.locator('#atlas-tab').isVisible()))
          await page.locator('#workspace-nav-summary').click();
        await page.locator('#atlas-tab').click();
      }
      await atlasCanvasReady(page);
      noSession(id);
    }
    async function room(name = 'E2E-01 Torhalle') {
      await page.locator('#atlas-search').fill(name);
      await page.locator('#atlas-search-results button').filter({ hasText: name }).first().click();
      await page.waitForFunction(
        (name) => document.querySelector('#room-name').value === name,
        name,
      );
      await atlasCanvasReady(page);
      await page.locator('#atlas-search').fill('');
    }
    async function keyEdit(text) {
      await room();
      await page.locator('#key-open').click();
      await page.locator('#key-dialog').waitFor({ state: 'visible' });
      await page.locator('#key-gm-notes').fill(text);
      await page.waitForFunction(
        () => document.querySelector('#key-save-status').dataset.state === 'saved',
      );
      await native.capture(page, 'key-' + ++keyCaptureSequence);
      await page.locator('#key-close').click();
      await page.locator('#key-dialog').waitFor({ state: 'hidden' });
      await atlasCanvasReady(page);
    }
    let planCaptureSequence = 0;
    async function inspectBoundPlan(id, campaignId) {
      const before = inventory(campaignId);
      if (await page.locator('#campaign-atlas').isVisible())
        await page.locator('#atlas-navigation').click();
      if (!(await page.locator('#catalog-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#catalog-tab').click();
      await page.locator('#encounter-list').selectOption(id);
      await page.waitForFunction(
        () => document.querySelector('#encounter-name').value === 'E2E-01 Torwachen',
      );
      assert.match(await page.locator('#encounter-assessment').textContent(), /50 Basis-XP/);
      assert.match(await page.locator('#encounter-entries').textContent(), /Guard/);
      const itemName = JSON.parse(initial.dungeon_key_content[0].payload).references.find(
        (r) => r.kind === 'item',
      ).label;
      assert((await page.locator('#encounter-items').textContent()).includes(itemName));
      await native.capture(page, 'bound-plan-' + ++planCaptureSequence);
      assert.deepEqual(
        inventory(campaignId),
        before,
        'Catalogue resolution and assessment are read-only',
      );
      if (!(await page.locator('#atlas-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#atlas-tab').click();
      await atlasCanvasReady(page);
      noSession(campaignId);
    }
    function semantic(state) {
      // Revisions/history are checked for exact reopen below, while Undo creates fresh revisions.
      return Object.fromEntries(
        Object.entries(state)
          .filter(([table]) => !['campaign', 'campaign_atlas'].includes(table))
          .map(([table, rows]) => [
            table,
            rows.map((row) => {
              const value = { ...row };
              delete value.revision;
              delete value.checksum;
              if (value.payload) {
                const payload = JSON.parse(value.payload);
                delete payload.revision;
                value.payload = JSON.stringify(payload);
              }
              return value;
            }),
          ]),
      );
    }
    const countercases = await runE2E01Countercases({
      native,
      runtime,
      fixture,
      file,
      output,
      launch,
      open,
      room,
      getPage: () => page,
      canvasReady: atlasCanvasReady,
    });
    if (process.env.E2E01_ONLY_COUNTERCASE)
      throw Error(
        'Targeted native diagnostic completed; the full mandatory E2E-01 catalogue was not executed.',
      );
    const scenarios = [...countercases];
    const passed = (id) =>
      scenarios.push({
        id,
        status: 'passed',
        fixtureHash: seedDatabaseHash,
        fixtureRecipeHash: fixture.recipeHash,
        build: native.source,
        storage: true,
        visible: true,
      });
    passed('E01-01-fixture');
    native.mark('same Atlas terrain edit');
    await launch();
    await open(fixture.a);
    await page.locator('#atlas-units').selectOption('metric');
    await page.locator('#atlas-section').selectOption('terrain');
    await atlasCanvasReady(page);
    const beforeTerrain = inventory();
    await page.locator('[data-tool-group="properties"]').click();
    await page.locator('[data-tool-select="land-tool"][data-tool-value="property"]').click();
    await page.locator('#land-field').selectOption('elevationM');
    await page.locator('#land-value').fill('321');
    const view = JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view'));
    await setBrushWorldRadius(page, 'land-radius', view.width * 0.025);
    await atlasCanvasReady(page);
    const canvas = await page.locator('#campaign-map').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * 0.25, canvas.y + canvas.height * 0.6);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * 0.3, canvas.y + canvas.height * 0.6, {
      steps: 3,
    });
    await page.mouse.up();
    await until(
      () =>
        inventory().atlas_landscape.some((r) => JSON.parse(r.payload).values.elevationM === 321),
      'Terrain property persisted',
    );
    await page.waitForFunction(
      () => document.querySelector('#land-status').textContent === 'Gespeichert',
    );
    await atlasCanvasReady(page);
    const afterTerrain = inventory();
    checks.push('terrain property authored through visible fixed-size brush');

    native.mark('house and room key in common Atlas history');
    await room();
    await page.locator('#atlas-placement > summary').click();
    await page.locator('#atlas-group-factor').fill('1.25');
    await page.locator('#atlas-group-scale').click();
    await until(
      () =>
        inventory().room.find((r) => r.id === fixture.roomId).payload !==
        afterTerrain.room.find((r) => r.id === fixture.roomId).payload,
      'House geometry autosaved',
    );
    await atlasCanvasReady(page);
    const afterHouse = inventory();
    await keyEdit('E2E-01 bestätigt: Das Salztor ist offen.');
    const afterKey = inventory();
    assert.notDeepEqual(afterKey.dungeon_key_content, afterHouse.dungeon_key_content);
    for (const [name, expected] of [
      ['key', afterHouse],
      ['house', afterTerrain],
      ['terrain', beforeTerrain],
    ]) {
      await page.locator('#atlas-undo').click();
      await until(
        () => JSON.stringify(semantic(inventory())) === JSON.stringify(semantic(expected)),
        'Shared undo ' + name,
      );
      await atlasCanvasReady(page);
    }
    for (const [name, expected] of [
      ['terrain', afterTerrain],
      ['house', afterHouse],
      ['key', afterKey],
    ]) {
      await page.locator('#atlas-redo').click();
      await until(
        () => JSON.stringify(semantic(inventory())) === JSON.stringify(semantic(expected)),
        'Shared redo ' + name,
      );
      await atlasCanvasReady(page);
    }
    checks.push('one history undoes and redoes key, house geometry and terrain in order');
    passed('E01-02-history');
    const beforeSwitch = inventory();
    await open(fixture.b);
    const b = inventory(fixture.b);
    assert.equal(b.room.length, 0);
    assert.equal(b.city_document.length, 0);
    assert.equal(b.atlas_landscape.length, 0);
    assert.equal(await page.locator('#atlas-undo').isDisabled(), true);
    await page.locator('#atlas-search').fill('E2E-01 Torhalle');
    assert.equal(await page.locator('#atlas-search-results button').count(), 0);
    await open(fixture.a);
    await room();
    assert.deepEqual(inventory(), beforeSwitch);
    await page.waitForFunction(
      () => document.querySelector('#atlas-status').dataset.error !== 'true',
    );
    checks.push(
      'A→B→A rebinds selection/history and leaves persisted A/B independent without session',
    );
    passed('E01-03-context');
    await native.capture(page, 'same-atlas');
    const beforeClose = inventory();
    await native.close();
    assert.deepEqual(inventory(), beforeClose);
    await launch();
    await open(fixture.a);
    await room();
    assert.deepEqual(inventory(), beforeClose);
    comparisons.push({
      kind: 'normal-close/fresh-process',
      sha256: digest(JSON.stringify(beforeClose)),
      equal: true,
    });
    checks.push('normal close and fresh process preserve complete selected persisted inventory');

    await inspectBoundPlan(fixture.planId, fixture.a);
    await room();
    passed('E01-04-fresh');
    native.mark('pending acknowledgement is visibly unconfirmed');
    await native.app.evaluate(({ ipcMain }) => {
      const name = 'atlas:drawing-commit',
        handler = ipcMain._invokeHandlers.get(name);
      if (!handler) throw Error('Atlas drawing commit handler missing');
      globalThis.__e2e01Held = { state: 'armed' };
      ipcMain.removeHandler(name);
      ipcMain.handle(name, async (event, ...args) => {
        const reply = await handler(event, ...args);
        if (globalThis.__e2e01Held.state === 'armed') {
          globalThis.__e2e01Held.state = 'held';
          globalThis.__e2e01Held.commandId = args[0].commandId;
          await new Promise((resolve) => {
            globalThis.__e2e01Release = resolve;
          });
          globalThis.__e2e01Held.state = 'released';
        }
        return reply;
      });
    });
    await page.locator('#key-open').click();
    await page.locator('#key-dialog').waitFor({ state: 'visible' });
    await page.locator('#key-gm-notes').fill('E2E-01 wartet auf Bestätigung.');
    const heldEnd = Date.now() + 15000;
    while (
      (await native.app.evaluate(() => globalThis.__e2e01Held.state)) !== 'held' &&
      Date.now() < heldEnd
    )
      await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(await native.app.evaluate(() => globalThis.__e2e01Held.state), 'held');
    assert.notEqual(await page.locator('#key-save-status').getAttribute('data-state'), 'saved');
    await native.capture(page, 'pending-acknowledgement');
    await native.app.evaluate(() => globalThis.__e2e01Release());
    await page.waitForFunction(
      () => document.querySelector('#key-save-status').dataset.state === 'saved',
    );
    await page.locator('#key-close').click();
    checks.push('held real Main commit reply leaves visible key unconfirmed until acknowledgement');

    native.mark('confirmed autosave survives intentional process crash');
    await keyEdit('E2E-01 bestätigt vor Prozessabbruch.');
    const beforeCrash = inventory();
    await native.crashAfterConfirmedAutosave({
      state: 'saved',
      inventorySha256: digest(JSON.stringify(beforeCrash)),
      evidence: 'key-save-status[data-state=saved] plus independent SQLite inventory',
      at: new Date().toISOString(),
    });
    await launch();
    await open(fixture.a);
    await room();
    await page.locator('#key-open').click();
    await page.locator('#key-dialog').waitFor({ state: 'visible' });
    assert.equal(
      await page.locator('#key-gm-notes').inputValue(),
      'E2E-01 bestätigt vor Prozessabbruch.',
    );
    await page.locator('#key-close').click();
    assert.deepEqual(inventory(), beforeCrash);
    comparisons.push({
      kind: 'confirmed-autosave/crash/fresh-process',
      sha256: digest(JSON.stringify(beforeCrash)),
      equal: true,
    });
    checks.push(
      'confirmed autosave survives intentional crash; unknown/pending never classified durable',
    );

    passed('E01-05-confirmed-crash');
    native.mark('Complete export and independent import of the same campaign');
    const sourceTransferInventory = freezeTransferInventory(runtime, file, fixture.a);
    await writeFile(
      path.join(output, 'frozen-transfer-inventory.json'),
      JSON.stringify(sourceTransferInventory, null, 2),
    );
    const originalBeforeImport = inventory(),
      archivePath = path.join(native.profile, 'e2e01.kwcampaign');
    await page.locator('#atlas-navigation').click();
    await page.locator('#campaign-manager').click();
    await page.locator('#campaign-manager-dialog').waitFor({ state: 'visible' });
    await native.app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, archivePath);
    await page.locator('#campaign-export').click();
    await page.waitForFunction(() =>
      document
        .querySelector('#status')
        .textContent.includes('Kampagnenpaket mit Daten und Medien exportiert.'),
    );
    const archive = await readFile(archivePath),
      files = unzipSync(archive),
      manifest = JSON.parse(Buffer.from(files['manifest.json']).toString('utf8'));
    for (const entry of manifest.files) {
      assert(files[entry.name], 'Manifest file ' + entry.name);
      assert.equal(files[entry.name].length, entry.bytes);
      assert.equal(digest(files[entry.name]), entry.sha256);
    }
    assert.deepEqual(
      Object.keys(files).sort(),
      ['manifest.json', ...manifest.files.map((f) => f.name)].sort(),
    );
    assert(
      manifest.files.some(
        (f) => f.name === fixture.media.name && f.sha256 === fixture.media.sha256,
      ),
    );
    await native.app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, archivePath);
    await page.locator('#campaign-import-package').click();
    await page.locator('#campaign-transfer-dialog').waitFor({ state: 'visible' });
    await page.locator('#campaign-transfer-name').fill('E2E-01 unabhängiger Import');
    await page.locator('#campaign-transfer-accept').click();
    await page.locator('#campaign-transfer-dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(
      () =>
        document.querySelector('#campaign-header-name').textContent ===
          'E2E-01 unabhängiger Import' && !document.querySelector('main').inert,
    );
    const imported = await page.locator('#campaigns').inputValue();
    assert.notEqual(imported, fixture.a);
    await atlasCanvasReady(page);
    assert.deepEqual(inventory(), originalBeforeImport);
    const Database = createRequire(import.meta.url)('better-sqlite3'),
      db = new Database(file, { readonly: true });
    let mapping;
    try {
      mapping = JSON.parse(
        db.prepare('SELECT local_map FROM campaign_origin WHERE campaign_id=?').get(imported)
          .local_map,
      );
    } finally {
      db.close();
    }
    await writeFile(path.join(output, 'import-remap.json'), JSON.stringify(mapping, null, 2));
    assert.equal(mapping[fixture.a], imported);
    for (const id of [
      fixture.roomId,
      fixture.authoredRoomId,
      fixture.houseId,
      fixture.cityId,
      fixture.locationId,
      fixture.planId,
      fixture.imageId,
      ...fixture.authoredSections.map((s) => s.id),
    ])
      assert(mapping[id] && mapping[id] !== id, 'Remapped fixture identity ' + id);
    const copied = inventory(imported);
    const transferEvidence = assertTransferInventory(
      runtime,
      sourceTransferInventory,
      freezeTransferInventory(runtime, file, imported),
      mapping,
      'E2E-01 unabhängiger Import',
    );
    assert.deepEqual(freezeTransferInventory(runtime, file, fixture.a), sourceTransferInventory);
    assert.deepEqual(JSON.parse(copied.encounter_plan[0].payload).sources, [
      fixture.creatureReference,
    ]);
    const copiedKey = JSON.parse(copied.dungeon_key_content[0].payload);
    assert.deepEqual(
      copiedKey.references.find((r) => r.kind === 'item').catalogReference,
      fixture.itemReference,
    );
    assert.equal(
      new Set(Object.values(mapping)).size,
      Object.keys(mapping).length,
      'Remap is injective',
    );
    // Compare every semantic row and every string reference via the recorded Old→New closure.
    const remap = (v) =>
      typeof v === 'string'
        ? (mapping[v] ?? v)
        : Array.isArray(v)
          ? v.map(remap)
          : v && typeof v === 'object'
            ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x)]))
            : v;
    for (const [table, rows] of Object.entries(originalBeforeImport)) {
      if (['campaign', 'campaign_atlas'].includes(table)) continue;
      const normalized = (values) =>
        values.map((r) => {
          const x = { ...r };
          delete x.checksum;
          if (x.payload) x.payload = JSON.parse(x.payload);
          return x;
        });
      const expected = remap(normalized(rows)),
        actual = normalized(copied[table]);
      const order = (r) => JSON.stringify(r);
      expected.sort((a, b) => order(a).localeCompare(order(b)));
      actual.sort((a, b) => order(a).localeCompare(order(b)));
      assert.deepEqual(actual, expected, 'Complete import preserves ' + table + ' through closure');
    }
    verifyMedia(native.profile, fixture);
    await room();
    await keyEdit('Nur im Import geändert.');
    await open(fixture.a);
    await room();
    await keyEdit('Nur im Original geändert.');
    const expectedA = inventory(),
      expectedImport = inventory(imported);
    await native.close();
    await launch();
    for (const [id, text, expected] of [
      [fixture.a, 'Nur im Original geändert.', expectedA],
      [imported, 'Nur im Import geändert.', expectedImport],
    ]) {
      await open(id);
      await room();
      await page.locator('#key-open').click();
      await page.locator('#key-dialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#key-gm-notes').inputValue(), text);
      await page.locator('#key-close').click();
      assert.deepEqual(inventory(id), expected);
      await inspectBoundPlan(id === fixture.a ? fixture.planId : mapping[fixture.planId], id);
      noSession(id);
    }
    assert.deepEqual(await readFile(archivePath), archive);
    await atlasCanvasReady(page);
    await native.capture(page, 'fresh-independent');
    await native.close();
    checks.push(
      'same fixture Complete archive checksums/media/closure, independent edits and fresh open of both campaigns',
    );
    passed('E01-06-complete');
    passed('E01-07-versioned-references');
    const captures = native.launches.flatMap((launch) => launch.captures ?? []);
    assert.equal(
      new Set(captures.map((capture) => capture.file)).size,
      captures.length,
      'Evidence captures must have unique filenames',
    );
    for (const capture of captures)
      assert.equal(
        digest(await readFile(path.join(output, capture.file))),
        capture.sha256,
        'Native capture must match its recorded bytes: ' + capture.file,
      );
    await writeFile(path.join(output, 'final-original.json'), JSON.stringify(inventory(), null, 2));
    await writeFile(
      path.join(output, 'final-import.json'),
      JSON.stringify(inventory(imported), null, 2),
    );
    assert.deepEqual(
      Object.fromEntries(
        await Promise.all(sourceFiles.map(async (f) => [f, digest(await readFile(f))])),
      ),
      sourceHashes,
      'Probe sources changed during qualification',
    );
    const report = {
      source: native.source,
      seedDatabaseHash,
      scenarios,
      transferEvidence,
      qualification:
        'E2E-01 technical native catalogue; target-device qualification and owner acceptance remain separate',
      host: {
        platform: process.platform,
        arch: process.arch,
        release: os.release(),
        node: process.version,
        softwareGpu,
        nativeVersions,
      },
      fixture,
      fixtureHash: digest(JSON.stringify(initial)),
      buildInfo,
      checks,
      comparisons,
      archive: { sha256: digest(archive), manifest },
      imported,
      remapEntries: Object.keys(mapping).length,
      sourceHashes,
      openRequirements: ['physical target device and owner acceptance'],
    };
    assertE2E01Scenarios(report);
    return report;
  },
);
