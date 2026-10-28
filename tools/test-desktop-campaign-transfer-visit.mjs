import { runNativeProbe } from './native-session.mjs';
import { currentProcessGroup } from './process-group.mjs';
// A complete GM transfer visit through Main/preload/SQLite; only native file selection is instrumented.
// Initial fixtures use the Store; all campaign edits and transfer actions after launch use the visible UI.
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, stat, readFile, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
const root = process.cwd(),
  require = createRequire(import.meta.url),
  { _electron } = require('playwright-core'),
  phase = process.argv.includes('--before') ? 'before' : 'after';
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/campaign-copy-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/campaign-copy-store.cjs');
const out =
  process.env.QA_EVIDENCE_DIR ??
  root +
    '/.build/campaign-transfer-visit/' +
    (process.argv.includes('--before')
      ? 'before'
      : process.argv.includes('--zoom200')
        ? 'after-200'
        : 'after');
await runNativeProbe({ output: out, name: 'campaign-transfer-visit' }, async (native) => {
  const profile = native.profile;
  const file = profile + '/workbench.sqlite';
  await mkdir(out, { recursive: true });
  await rm(path.join(out, 'result.json'), { force: true });
  const group = await currentProcessGroup();
  const room = {
    id: randomUUID(),
    scopeId: 'local',
    floorId: 'ground',
    number: '1',
    name: 'Torhalle',
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 8, y: 0 },
          { x: 8, y: 8 },
          { x: 0, y: 8 },
        ],
        holes: [],
      },
    ],
    sections: [
      {
        id: randomUUID(),
        kind: 'markdown',
        markdown: '  Alter Torplan\r\n- Mauer aus Basalt',
      },
    ],
  };
  const store = new CampaignStore(file),
    original = store.create('Nebelmark Original', [room]),
    w = store.activate(original.id),
    npcId = randomUUID(),
    authorId = randomUUID(),
    npcText = '  Original Nera\r\n- Sie bewacht das Tor',
    authorText = `Sprich mit [Torwache](dungeon-ref:note/${npcId}).\r\n\`[Beispiel](dungeon-ref:note/${npcId})\``;
  for (const note of [
    { id: npcId, title: 'Nera', gmNotes: npcText, relations: [] },
    {
      id: authorId,
      title: 'Auftrag am Tor',
      kind: 'quest',
      gmNotes: authorText,
      relations: [{ id: randomUUID(), targetId: npcId, label: 'beauftragt' }],
    },
  ])
    store.changePreparation({
      commandId: randomUUID(),
      token: w.token,
      campaignId: original.id,
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          revision: 1,
          kind: 'npc',
          readAloud: '',
          creatureId: null,
          deleted: false,
          ...note,
        },
      },
    });
  store.executeDrawing({
    commandId: randomUUID(),
    token: w.token,
    campaignId: original.id,
    action: {
      kind: 'key-batch',
      rooms: [{ id: room.id, expectedRevision: 0, keyRevision: null }],
      patch: { references: [{ kind: 'npc', id: npcId, label: 'Nera' }] },
    },
  });
  store.tutorial('skipped');
  store.close();

  let app,
    child,
    page,
    closed = true;
  const exits = [],
    errors = [];
  async function launch() {
    app = await native.launchConfigured({
      executablePath: root + '/node_modules/electron/dist/electron',
      args: [root + '/.build/desktop/main.cjs', '--ozone-platform=x11', '--data-dir', profile],
    });
    child = app.process();
    closed = false;
    page = await app.firstWindow();
    await app.evaluate(({ ipcMain }, failImportedAtlas) => {
      const importedTokens = new Set();
      globalThis.__atlasRequests = [];
      let sequence = 0;
      for (const name of [
        'atlas:geometry-region',
        'atlas:region-cancel',
        'atlas:terrain-source',
        'campaign:activate-shell',
        'campaign:workspace-initial',
        'campaign:transfer-accept',
      ]) {
        const handler = ipcMain._invokeHandlers.get(name);
        if (!handler) continue;
        ipcMain.removeHandler(name);
        ipcMain.handle(name, async (event, ...args) => {
          const call = ++sequence;
          const identity = { call, name, token: args[0] };
          globalThis.__atlasRequests.push({ ...identity, event: 'start' });
          try {
            const reply =
              failImportedAtlas && name === 'atlas:geometry-region' && importedTokens.has(args[0])
                ? { ok: false, error: 'Controlled imported Atlas opening failure' }
                : await handler(event, ...args);
            if (
              name === 'campaign:workspace-initial' &&
              reply?.value?.campaign?.name === 'Nebelmark Import'
            )
              importedTokens.add(args[0]);
            globalThis.__atlasRequests.push({
              ...identity,
              event: 'end',
              ok: reply?.ok,
              error: reply?.error,
              campaignId: reply?.value?.campaign?.id,
              regionRevision: reply?.value?.region?.revision,
            });
            return reply;
          } catch (error) {
            globalThis.__atlasRequests.push({
              ...identity,
              event: 'throw',
              message: error.message,
              stack: error.stack,
            });
            throw error;
          }
        });
      }
    }, process.argv.includes('--fail-import-atlas'));
    const pid = child.pid,
      zoom = process.argv.includes('--zoom200') ? 2 : 1;
    assert((await readFile(`/proc/${pid}/cmdline`, 'utf8')).includes(profile));
    assert.equal((await readFile(`/proc/${pid}/cgroup`, 'utf8')).trim().split('::')[1], group);
    launches.push({ pid, zoom, cgroup: group });
    await app.evaluate(({ BrowserWindow }, zoom) => {
      const window = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith('/index.html'),
      );
      window.webContents.setZoomFactor(zoom);
      window.show();
      window.focus();
    }, zoom);
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(e.stack));
    await page.evaluate(() => {
      window.__atlasStates = [];
      new MutationObserver(() => {
        const root = document.querySelector('#campaign-atlas');
        if (!root) return;
        const state = {
          campaignId: document.querySelector('#campaigns').value,
          regionState: root.dataset.regionState,
          status: document.querySelector('#atlas-save-status').textContent,
        };
        if (JSON.stringify(state) !== JSON.stringify(window.__atlasStates.at(-1)))
          window.__atlasStates.push(state);
      }).observe(document.body, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
    });
    observations.runtime = await app.evaluate(({ app }) => ({
      version: app.getVersion(),
      electron: process.versions.electron,
      node: process.versions.node,
    }));
    await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
  }
  async function close() {
    const phase = 'launch-' + launches.length;
    const states = await page.evaluate(() => window.__atlasStates);
    observations.atlasStateTraces ??= [];
    observations.atlasStateTraces.push({ phase, states });
    await writeFile(out + '/' + phase + '-atlas-states.json', JSON.stringify(states, null, 2));
    await writeFile(
      out + '/' + phase + '-atlas-requests.json',
      JSON.stringify(await app.evaluate(() => globalThis.__atlasRequests), null, 2),
    );
    assert.deepEqual(errors, []);
    const done = new Promise((r) => child.once('exit', (code, signal) => r({ code, signal })));
    await native.close();
    let timer;
    try {
      const exit = await Promise.race([
        done,
        new Promise(
          (_, reject) => (timer = setTimeout(() => reject(Error('Normal close timed out')), 10000)),
        ),
      ]);
      assert.deepEqual(exit, { code: 0, signal: null });
      exits.push(exit);
      launches.at(-1).exit = exit;
      await assert.rejects(stat('/proc/' + launches.at(-1).pid), { code: 'ENOENT' });
      launches.at(-1).pidAbsent = true;
      closed = true;
    } finally {
      clearTimeout(timer);
    }
  }
  async function open(id) {
    if (!(await page.locator('#campaign-screen').isVisible())) {
      if (!(await page.locator('#campaign-header-name').isVisible()))
        await page.locator('#atlas-navigation').click();
      await page.locator('#campaign-header-name').click();
    }
    await page
      .locator('.campaign-card[data-campaign-id="' + id + '"]')
      .getByRole('button', { name: /Fortsetzen|Öffnen/ })
      .click();
    await page.waitForFunction(
      (id) =>
        document.querySelector('#campaigns').value === id &&
        document.body.classList.contains('has-workspace') &&
        !document.querySelector('main').inert,
      id,
    );
  }
  async function note(title) {
    if (!(await page.locator('#preparation-tab').isVisible())) {
      if (await page.locator('#atlas-navigation').isVisible())
        await page.locator('#atlas-navigation').click();
      if (!(await page.locator('#preparation-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
    }
    await page.locator('#preparation-tab').click();
    await page.locator('#preparation-knowledge').click();
    await page.locator('#world-search').fill(title);
    await page.locator('#world-list button').filter({ hasText: title }).click();
    await page.locator('#note-editor').waitFor({ state: 'visible' });
  }
  const observations = {},
    launches = [],
    artifactHashes = {};
  for (const rel of ['main.cjs', 'preload.cjs', 'ui/renderer.js', 'ui/index.html', 'ui/app.css'])
    artifactHashes[rel] = createHash('sha256')
      .update(await readFile(root + '/.build/desktop/' + rel))
      .digest('hex');
  async function shot(name) {
    await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          let frame;
          const timer = setTimeout(() => {
            cancelAnimationFrame(frame);
            reject(Error('No fresh native capture frames'));
          }, 2500);
          frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
              clearTimeout(timer);
              resolve();
            });
          });
        }),
    );
    const bytes = Buffer.from(
      await app.evaluate(async ({ BrowserWindow }) =>
        (
          await BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.capturePage()
        ).toPNG(),
      ),
    );
    const png = require('pngjs').PNG.sync.read(bytes),
      colors = new Set();
    for (let i = 0; i < png.data.length; i += 4 * 31) colors.add(png.data.readUInt32BE(i));
    assert(colors.size > 8);
    await writeFile(out + '/' + name + '.png', bytes);
    await writeFile(out + '/' + name + '.txt', await page.locator('body').ariaSnapshot());
  }
  async function map() {
    await page.locator('#note-room-uses-list button').filter({ hasText: 'Torhalle' }).click();
    await page.locator('#key-dialog').waitFor({ state: 'visible' });
  }
  async function atlasRoom(id, phase) {
    if (!(await page.locator('#campaign-atlas').isVisible())) {
      if (!(await page.locator('#atlas-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
      await page.locator('#atlas-tab').click();
    }
    await page.waitForFunction(() =>
      ['ready', 'failed'].includes(document.querySelector('#campaign-atlas').dataset.regionState),
    );
    assert.equal(await page.locator('#campaigns').inputValue(), id);
    assert.equal(await page.locator('#campaign-atlas').getAttribute('data-region-state'), 'ready');
    assert.notEqual(await page.locator('#atlas-save-status').getAttribute('data-error'), 'true');
    assert.equal(await page.locator('#atlas-region-retry').isVisible(), false);
    await page.locator('#atlas-search').fill('Torhalle');
    const result = page.locator('#atlas-search-results button').filter({ hasText: 'Torhalle' });
    await result.waitFor({ state: 'visible' });
    await result.click();
    await page.waitForFunction(
      () =>
        document.querySelector('#room-name').value === 'Torhalle' &&
        document.querySelector('#campaign-atlas').dataset.regionState === 'ready',
    );
    await page.locator('#room-name').waitFor({ state: 'visible' });
    await shot(phase + '-atlas-room');
    await page.locator('#key-open').click();
    await page.locator('#key-dialog').waitFor({ state: 'visible' });
    observations.atlasRoomVisits ??= [];
    observations.atlasRoomVisits.push({
      phase,
      campaignId: id,
      search: 'Torhalle',
      selected: await page.locator('#room-name').inputValue(),
    });
  }

  try {
    await launch();
    await shot('startup');
    await open(original.id);
    if (!process.argv.includes('--before'))
      assert.equal(
        await page.locator('#atlas-navigation').innerText(),
        'Atlas · Nebelmark Original ▾',
      );
    await page.locator('#atlas-navigation').click();
    await shot('navigation');
    await page.locator('#campaign-manager').click();
    await page.locator('#campaign-manager-dialog').waitFor({ state: 'visible' });
    await shot('export');
    if (!process.argv.includes('--before'))
      assert.equal(
        await page.locator('#campaign-transfer-source').innerText(),
        'Geöffnete Kampagne: Nebelmark Original',
      );
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    }, profile + '/transfer.kwcampaign');
    await page.locator('#campaign-export').click();
    await page.waitForFunction(() =>
      document
        .querySelector('#status')
        .textContent.includes('Kampagnenpaket mit Daten und Medien exportiert.'),
    );
    const archive = await readFile(profile + '/transfer.kwcampaign');
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, profile + '/transfer.kwcampaign');
    if (process.argv.includes('--before')) await page.locator('#campaign-import-package').click();
    else {
      await page.locator('#campaign-manager-close').click();
      if (!(await page.locator('#campaign-header-name').isVisible()))
        await page.locator('#atlas-navigation').click();
      await page.locator('#campaign-header-name').click();
      await page.locator('#campaign-screen-import').click();
    }
    await page.locator('#campaign-transfer-dialog').waitFor({ state: 'visible' });
    await shot('preview');
    observations.preview = await page.locator('#campaign-transfer-dialog').innerText();
    const layout = await page.locator('#campaign-transfer-dialog').evaluate((e) => ({
      right: e.getBoundingClientRect().right,
      viewport: innerWidth,
      scroll: e.scrollWidth,
      width: e.clientWidth,
    }));
    assert(layout.right <= layout.viewport + 1);
    assert(layout.scroll <= layout.width + 1);
    observations.previewFitsWidth = layout;
    if (!process.argv.includes('--before')) {
      assert.match(
        await page.locator('#campaign-transfer-summary').innerText(),
        /1 Dungeonzeichnung.*1 Raum.*2 Wissenseinträge/,
      );
      assert.equal(await page.locator('#campaign-manager-dialog').isVisible(), false);
      assert.equal(
        await page.locator('#campaign-transfer-origin').innerText(),
        'Quelle: Nebelmark Original',
      );
    }
    await page.locator('#campaign-transfer-name').fill('Nebelmark Import');
    await page.locator('#campaign-transfer-accept').scrollIntoViewIfNeeded();
    assert(
      await page.locator('#campaign-transfer-accept').evaluate((e) => {
        const r = e.getBoundingClientRect();
        return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    );
    await page.locator('#campaign-transfer-accept').click();
    await page.locator('#campaign-transfer-dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(
      () =>
        document.querySelector('#campaign-header-name').textContent === 'Nebelmark Import' &&
        document.querySelector('#campaign-screen').hidden &&
        !document.querySelector('main').inert,
    );
    const imported = await page.locator('#campaigns').inputValue();
    assert.notEqual(imported, original.id);
    if (!process.argv.includes('--before')) {
      assert.equal(await page.locator('#atlas-tab').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#live-tab').getAttribute('aria-pressed'), 'false');
      assert(await page.locator('#atlas-navigation').isVisible());
      assert.equal(
        await page.locator('#atlas-navigation').innerText(),
        'Atlas · Nebelmark Import ▾',
      );
      const label = await page.locator('#atlas-navigation').evaluate((e) => {
        const r = e.getBoundingClientRect();
        return {
          right: r.right,
          viewport: innerWidth,
          scroll: e.scrollWidth,
          width: e.clientWidth,
          hit: e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
        };
      });
      assert(label.right <= label.viewport + 1 && label.scroll <= label.width + 1 && label.hit);
      observations.activeCampaignLabel = label;
      observations.activeCampaignVisible = true;
      observations.normalCampaignViewRetained = true;
    }
    await shot('imported');
    await page.waitForFunction(() =>
      ['ready', 'failed'].includes(document.querySelector('#campaign-atlas').dataset.regionState),
    );
    observations.importedAtlas = await page.evaluate(() => ({
      campaignId: document.querySelector('#campaigns').value,
      regionState: document.querySelector('#campaign-atlas').dataset.regionState,
      status: document.querySelector('#status').textContent,
      atlasStatus: document.querySelector('#atlas-save-status').textContent,
      hint: document.querySelector('#atlas-hint').textContent,
    }));
    await writeFile(out + '/atlas-observation.json', JSON.stringify(observations, null, 2));
    const states = await page.evaluate(() => window.__atlasStates);
    await writeFile(out + '/atlas-states.json', JSON.stringify(states, null, 2));
    await writeFile(
      out + '/atlas-requests.json',
      JSON.stringify(await app.evaluate(() => globalThis.__atlasRequests), null, 2),
    );
    assert.deepEqual(
      states.filter((state) => state.regionState === 'failed'),
      [],
      'Imported Atlas must never fail during opening',
    );
    assert.equal(
      observations.importedAtlas.regionState,
      'ready',
      'Imported Atlas must be usable: ' + JSON.stringify(observations.importedAtlas),
    );
    await atlasRoom(imported, 'imported');
    await page.locator('#key-gm-notes').fill('Nur im Import: Der Basalttunnel ist offen.');
    await page.waitForFunction(
      () => document.querySelector('#key-save-status').dataset.state === 'saved',
    );
    await page.locator('#key-close').click();
    await note('Auftrag am Tor');
    await page.locator('#note-relations button').filter({ hasText: 'beauftragt: Nera' }).click();
    assert.equal(await page.locator('#note-gm').inputValue(), npcText.replaceAll('\r\n', '\n'));
    await page.locator('#note-gm').fill('Nur im Import: Nera öffnet das Tor.');
    await map();
    assert.equal(
      await page.locator('#key-gm-notes').inputValue(),
      'Nur im Import: Der Basalttunnel ist offen.',
    );
    await page.locator('#key-close').click();
    await shot('edited');
    await close();
    await launch();
    for (const [id, text, key] of [
      [original.id, npcText.replaceAll('\r\n', '\n'), ''],
      [
        imported,
        'Nur im Import: Nera öffnet das Tor.',
        'Nur im Import: Der Basalttunnel ist offen.',
      ],
    ]) {
      await open(id);
      await atlasRoom(id, id === original.id ? 'fresh-original' : 'fresh-imported');
      assert.equal(await page.locator('#key-gm-notes').inputValue(), key);
      await page.locator('#key-close').click();
      await note('Auftrag am Tor');
      await page.locator('#note-relations button').filter({ hasText: 'beauftragt: Nera' }).click();
      assert.equal(await page.locator('#note-gm').inputValue(), text);
      await map();
      assert.equal(await page.locator('#key-gm-notes').inputValue(), key);
      await page.locator('#key-close').click();
    }
    await page.locator('#note-gm').fill('Nur im Import: Nera ist abgereist.');
    await open(original.id);
    await note('Nera');
    await page.locator('#note-gm').fill('Nur im Original: Nera bleibt Wache.');
    await open(imported);
    await note('Nera');
    assert.equal(await page.locator('#note-gm').inputValue(), 'Nur im Import: Nera ist abgereist.');
    await shot('fresh-independent');
    await close();
    const check = new CampaignStore(file);
    try {
      const all = [];
      for (const id of [original.id, imported]) {
        const active = check.activate(id),
          notes = check.preparation(active.token).notes.map((r) => r.note),
          npc = notes.find((n) => n.title === 'Nera'),
          author = notes.find((n) => n.title === 'Auftrag am Tor'),
          rooms = check.workspace().rooms;
        all.push(npc.id, author.id, rooms[0].id);
        assert.equal(author.relations[0].targetId, npc.id);
        assert.equal(
          author.gmNotes,
          authorText.replace(
            `[Torwache](dungeon-ref:note/${npcId})`,
            `[Torwache](dungeon-ref:note/${npc.id})`,
          ),
        );
        assert.deepEqual(rooms[0].polygons, room.polygons);
        assert.deepEqual(
          rooms[0].sections.map((s) => s.markdown),
          room.sections.map((s) => s.markdown),
        );
        if (id !== original.id) assert.notEqual(rooms[0].sections[0].id, room.sections[0].id);
        assert.equal(
          npc.gmNotes,
          id === original.id
            ? 'Nur im Original: Nera bleibt Wache.'
            : 'Nur im Import: Nera ist abgereist.',
        );
      }
      assert.equal(new Set(all).size, 6);
    } finally {
      check.close();
    }
    assert.deepEqual(await readFile(profile + '/transfer.kwcampaign'), archive);
    assert.deepEqual(errors, []);
    assert.deepEqual(
      observations.atlasStateTraces
        .flatMap((trace) => trace.states)
        .filter((state) => state.regionState === 'failed'),
      [],
      'Every Atlas visit must remain free of view failures',
    );
    await native.recordResult({
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      profile,
      launches,
      exits,
      artifactHashes,
      sourceHashes: Object.fromEntries(
        await Promise.all(
          [
            'src/app/workspace/workspace-editors.ts',
            'src/app/atlas/atlas-regions.ts',
            'tools/test-desktop-campaign-transfer-visit.mjs',
            'tests/workspace/workspace-editor-registry.test.mjs',
          ].map(async (file) => [
            file,
            createHash('sha256')
              .update(await readFile(file))
              .digest('hex'),
          ]),
        ),
      ),
      buildInfo: JSON.parse(await readFile('.build/desktop/build-info.json', 'utf8')),
      observations,
      linkedNotesAndMapIndependent: true,
      archiveUnchanged: true,
      errors,
    });
    console.log(JSON.stringify({ out, exits, linkedNotesAndMapIndependent: true, errors }));
  } catch (error) {
    await writeFile(
      out + '/failure.json',
      JSON.stringify({ error: error.stack, profile, launches, errors }, null, 2),
    );
    if (app && !closed) {
      await shot('failure').catch(() => {});
      await close();
    }
    throw error;
  } finally {
  }
});
