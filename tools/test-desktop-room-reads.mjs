import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady, atlasCanvasPoint } from './atlas-canvas-probe.mjs';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const spatial = process.argv.includes('--regions'),
  zoom = Number((process.argv.find((a) => a.startsWith('--zoom=')) ?? '--zoom=1').split('=')[1]);
if (![1, 2].includes(zoom)) throw new Error('Zoom 1 oder 2 wählen.');
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  output = process.env.QA_EVIDENCE_DIR ?? path.resolve('.build/room-reads-evidence');
await mkdir(output, { recursive: true });
const native = await createNativeSession({
  root,
  output,
  name: 'room-reads',
  resultName: 'native.json',
});
try {
  require('esbuild').buildSync({
    entryPoints: ['src/app/storage/store.ts'],
    outfile: '.build/room-native-store.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore } = require(root + '/.build/room-native-store.cjs');

  const profile = native.profile,
    file = profile + '/workbench.sqlite',
    longId = 'last-' + 'x'.repeat(1500);
  const rooms = Array.from({ length: 4000 }, (_, i) => ({
    id: i === 3999 ? longId : 'room-' + (i + 1),
    scopeId: 'local',
    floorId: i === 3998 ? 'hidden' : 'ground',
    number: String(i + 1),
    name: i >= 3918 ? 'Treffer ' + (i - 3917) : 'Kammer ' + (i + 1),
    revision: 0,
    polygons: [
      {
        outer: [
          { x: i * 5, y: 0 },
          { x: i * 5 + 3, y: 0 },
          { x: i * 5 + 3, y: 3 },
          { x: i * 5, y: 3 },
        ],
        holes: [],
      },
    ],
    sections: [
      {
        id: randomUUID(),
        kind: 'markdown',
        markdown: 'PRIVATE-' + (i + 1) + '\r\n' + 'Raumprosa '.repeat(800),
      },
    ],
  }));
  const store = new CampaignStore(file),
    cam = store.create('Atlas Raumlesen', rooms);
  store.activateShell(cam.id);
  store.tutorial('skipped');
  store.db.prepare("INSERT INTO drawing_hidden VALUES(?,'hidden','local','floor',1,1)").run(cam.id);
  let cityId = null,
    sceneId = null;
  if (spatial) {
    const token = store.activateShell(cam.id).token,
      ack = store.executeAtlasCommit({
        commandId: randomUUID(),
        token,
        campaignId: cam.id,
        action: {
          kind: 'city-create',
          name: 'Großstadt',
          x: 50000,
          y: 40000,
          width: 2000,
          height: 2000,
        },
      });
    cityId = ack.result.id;
    store.db.transaction(() => {
      for (let i = 0; i < 5000; i++) {
        const unit = {
            id: 'building-' + i,
            kind: 'building',
            name: 'Haus ' + i,
            protected: true,
            position: { x: (i % 100) * 12 + 10, y: Math.floor(i / 100) * 12 + 10 },
            angle: 0,
            outline: [
              { x: -3, y: -3 },
              { x: 3, y: -3 },
              { x: 3, y: 3 },
              { x: -3, y: 3 },
            ],
            notes: 'PRIVATE-HOUSE-' + i + '\r\n' + 'Stadtnotiz '.repeat(400),
            recipe: { seed: 'keep-seed', algorithm: 'street-infill-v1' },
            externalExtension: { keep: 'yes' },
            use: 'Werkstatt',
            residentIds: [],
            workerIds: [],
            households: [],
            jobs: [],
          },
          payload = JSON.stringify(unit);
        store.db
          .prepare('INSERT INTO city_unit VALUES(?,?,?,?,?,?)')
          .run(
            cam.id,
            cityId,
            unit.id,
            unit.kind,
            payload,
            createHash('sha256').update(payload).digest('hex'),
          );
      }
    })();
    const command = (action) => ({ commandId: randomUUID(), token, campaignId: cam.id, action }),
      character = store.executeLive(
        command({ kind: 'create-character', profile: { name: 'Iri', speedFeet: 30 } }),
      ).character,
      live = store.live(token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: character.id,
        expectedRevision: character.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: null,
        expectedFocusRevision: live.focusRevision,
      }),
    );
    sceneId = store.executeLive(
      command({ kind: 'initialize', expectedRosterRevision: store.live(token).rosterRevision }),
    ).scene.id;
  }
  store.close();
  let app;
  const errors = native.errors,
    results = { profile, campaignId: cam.id, longId, launches: native.launches };
  async function launch() {
    const page = await native.launch(zoom);
    app = native.app;
    if (await page.locator('#tutorial-dialog').isVisible())
      await page.locator('#tutorial-skip').click();
    return page;
  }
  // Poll completed IPC results; a pending Promise is not a successful state check.
  async function waitForHouse(page, token, cityId, accept) {
    const deadline = Date.now() + 30000;
    for (;;) {
      const result = await page.evaluate(
        async ({ token, cityId }) => window.campaign.atlasCitySite(token, cityId, 'building-4999'),
        { token, cityId },
      );
      if (result.ok && accept(result.value.unit)) return result;
      if (Date.now() >= deadline)
        throw Error('Gespeicherter Hausstand nicht erreicht: ' + JSON.stringify(result));
      await page.waitForTimeout(100);
    }
  }
  async function capture(page, file) {
    await native.capture(page, path.basename(file));
  }
  async function scrollVisible(locator) {
    await locator.waitFor({ state: 'visible' });
    await locator.evaluate((node) => {
      node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      const r = node.getBoundingClientRect(),
        top = r.y + r.height / 2 - innerHeight * 0.62;
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/auto|scroll/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) {
          parent.scrollBy({ top, behavior: 'instant' });
          return;
        }
      }
      window.scrollBy({ top, behavior: 'instant' });
    });
  }
  async function dragHouse(page, position) {
    const point = await atlasCanvasPoint(page, { x: 50000 + position.x, y: 40000 + position.y });
    assert.equal(point.target, 'campaign-map', 'The native pointer must reach the visible Canvas');
    await page.evaluate(() => {
      window.__roomPointer = null;
      document.addEventListener(
        'pointermove',
        (e) => (window.__roomPointer = { x: e.clientX, y: e.clientY, target: e.target.id }),
        { capture: true },
      );
    });
    await page.mouse.move(point.x - 1, point.y - 1);
    await page.mouse.move(point.x, point.y);
    let actual = await page.evaluate(() => window.__roomPointer),
      factor = 1;
    if (!actual || Math.hypot(actual.x - point.x, actual.y - point.y) > 2) {
      factor = zoom;
      await page.mouse.move(point.x * factor, point.y * factor);
      actual = await page.evaluate(() => window.__roomPointer);
    }
    results.pointer = {
      requested: point,
      observed: actual,
      factor,
      expectedDelta: { x: 20 * point.unitsPerPixel, y: 10 * point.unitsPerPixel },
    };
    assert(
      actual &&
        Math.hypot(actual.x - point.x, actual.y - point.y) <= 2 &&
        actual.target === 'campaign-map',
    );
    await page.mouse.down();
    await page.mouse.move((point.x + 20) * factor, (point.y + 10) * factor, { steps: 5 });
    await page.mouse.up();
  }
  async function finish() {
    await native.close();
  }
  async function nav(page, id) {
    if (!(await page.locator('#' + id).isVisible())) {
      if (await page.locator('#atlas-navigation').isVisible())
        await page.locator('#atlas-navigation').click();
      else await page.locator('#workspace-nav-summary').click();
    }
    await page.locator('#' + id).click();
  }
  async function enter(page) {
    await page
      .locator('#campaign-screen-list article')
      .filter({ hasText: 'Atlas Raumlesen' })
      .getByRole('button', { name: 'Fortsetzen', exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
    );
    await nav(page, 'atlas-tab');
    await page.waitForFunction(
      () =>
        document.querySelector('#campaign-atlas') &&
        !document.querySelector('#campaign-atlas').hidden,
    );
  }
  async function instrument() {
    await app.evaluate(({ ipcMain }, spatial) => {
      global.__roomProbe = { calls: [], responses: [], token: null };
      for (const name of [
        'campaign:activate',
        'campaign:activate-shell',
        'campaign:catalog-shell',
        'campaign:workspace-geometry',
        'campaign:workspace-initial',
        'atlas:geometry-region',
        'atlas:focus',
        'atlas:city-site',
        'city:view',
        'city:list',
        'campaign:preparation',
        'drawing:view',
        'drawing:map',
        'drawing:element',
        'atlas:view',
        'atlas:render-view',
        'atlas:room',
        'atlas:room-commit',
        'campaign:room-directory',
      ]) {
        const previous = ipcMain._invokeHandlers.get(name);
        ipcMain.removeHandler(name);
        ipcMain.handle(name, async (event, ...args) => {
          global.__roomProbe.calls.push({ name, id: name === 'atlas:room' ? args[1] : undefined });
          if (
            [
              'campaign:activate',
              'atlas:view',
              ...(spatial
                ? ['atlas:render-view', 'campaign:workspace-geometry', 'city:view', 'city:list']
                : []),
            ].includes(name)
          )
            throw new Error('Legacy full read forbidden in probe');
          const value = await previous(event, ...args);
          const text = JSON.stringify(value);
          global.__roomProbe.responses.push({
            name,
            bytes: Buffer.byteLength(text),
            privateText: text.includes('PRIVATE-'),
            roomId: value.value?.room?.id,
            workspacePrivateText: JSON.stringify(value.value?.workspace ?? null).includes(
              'PRIVATE-',
            ),
          });
          if (value.ok && value.value?.token) global.__roomProbe.token = value.value.token;
          return value;
        });
      }
    }, spatial);
  }
  async function interior(page) {
    await page.locator('#atlas-section').selectOption('interior');
    await page.locator('#atlas-analysis-open').click();
  }
  async function search(page, text) {
    if (!(await page.locator('#search').isVisible()))
      await page.locator('#atlas-analysis-open').click();
    await page.locator('#search').fill(text);
    await page.waitForFunction(
      () => !document.querySelector('#rooms').textContent.includes('Räume werden gesucht'),
      { timeout: 30000 },
    );
  }
  native.mark('open and inspect bounded reads');
  let page = await launch();
  await instrument();
  await enter(page);
  await page.waitForFunction(() => document.querySelector('#rooms button'), { timeout: 30000 });
  const legacyMaps = async () => {
    const counts = await page.evaluate(() =>
      Object.fromEntries(
        ['map', 'city-map', 'world-map'].map((id) => [
          id,
          document.getElementById(id)?.childElementCount ?? -1,
        ]),
      ),
    );
    assert.deepEqual(
      counts,
      { map: 0, 'city-map': 0, 'world-map': 0 },
      'Shared Atlas must not build hidden SVG geometry',
    );
    assert.equal(
      await page.locator('#dungeon-map').count(),
      0,
      'Retired Dungeon map host is removed',
    );
    results.retiredMapNodes = counts;
  };
  await legacyMaps();
  const opening = await app.evaluate(() => global.__roomProbe);
  results.opening = opening;
  assert(
    !opening.calls.some((c) =>
      ['campaign:activate', 'atlas:view', 'drawing:view'].includes(c.name),
    ),
  );
  assert(
    opening.responses
      .filter((r) => !['atlas:room', 'campaign:room-directory'].includes(r.name))
      .every((r) => !r.privateText),
  );
  assert.deepEqual(
    [...new Set(opening.calls.filter((c) => c.name === 'atlas:room').map((c) => c.id))],
    ['room-1'],
  );
  results.opening = opening;
  await capture(page, output + '/opening.png');
  await page.locator('#atlas-search').fill('PRIVATE-4000');
  await page.locator('#atlas-search-results button').filter({ hasText: '4000' }).waitFor();
  results.visibleAtlasFullTextSearch = true;
  await page.locator('#atlas-search').fill('');
  native.mark('room search and pagination');
  await interior(page);
  await search(page, 'Treffer');
  await page.waitForFunction(() => document.querySelector('#rooms-more'));
  await page.locator('#rooms-more').click();
  await page.waitForFunction(() => document.querySelectorAll('#rooms button').length > 60, {
    timeout: 30000,
  });
  await page.locator('#rooms-more').click();
  await page.waitForFunction(
    () =>
      !document.querySelector('#rooms-more') &&
      document.querySelector('#rooms').textContent.includes('4000.'),
    { timeout: 30000 },
  );
  results.completePages = true;
  await page.locator('#rooms button').filter({ hasText: '4000.' }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('#room-name').value === 'Treffer 82' &&
      !document.querySelector('#room-name').disabled,
    { timeout: 30000 },
  );
  assert(
    await page
      .locator('#rooms')
      .innerText()
      .then((text) => text.includes('81 von 81 Räumen angezeigt')),
  );
  results.selectionRetainsSearchCompleteness = true;
  native.mark('save room text');
  if ((await page.locator('#room-extra-notes').getAttribute('open')) === null)
    await page.locator('#room-extra-notes > summary').click();
  await page
    .locator('#keys textarea')
    .first()
    .fill(rooms.at(-1).sections[0].markdown + '\nGeänderte Spur');
  await page.locator('#room-name').click();
  await page.waitForFunction(
    () => document.querySelector('#status').textContent === 'Gespeichert.',
    { timeout: 30000 },
  );
  const token = await app.evaluate(() => global.__roomProbe.token);
  const saved = await page.evaluate(async ({ token, id }) => window.campaign.atlasRoom(token, id), {
    token,
    id: longId,
  });
  assert(saved.ok);
  assert.equal(
    saved.value.sections[0].markdown,
    rooms.at(-1).sections[0].markdown + '\r\nGeänderte Spur',
  );
  results.longIdTextCommit = true;
  native.mark('invalid draft and selection');
  const pointsDetails = page.locator('#editor details').filter({ has: page.locator('#points') });
  if ((await pointsDetails.getAttribute('open')) === null)
    await pointsDetails.locator('summary').click();
  await page.locator('#points').fill('unvollständig');
  await search(page, 'Kammer 2');
  await page.locator('#rooms button').filter({ hasText: /^2\. / }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('#room-name').value === 'Kammer 2' &&
      !document.querySelector('#room-name').disabled,
    { timeout: 30000 },
  );
  await search(page, 'Geänderte Spur');
  await page.locator('#rooms button').filter({ hasText: '4000.' }).click();
  await page.waitForFunction(() => document.querySelector('#points').value === 'unvollständig', {
    timeout: 30000,
  });
  results.invalidDraftResumed = true;
  await page.locator('#points').fill('19995,0\n19998,0\n19998,3\n19995,3');
  await page.locator('#room-name').click();
  await page.waitForFunction(
    () => document.querySelector('#status').textContent === 'Gespeichert.',
    { timeout: 30000 },
  );
  await capture(page, output + '/selected.png');
  native.mark('spatial consumers');
  if (spatial) {
    await page.locator('#atlas-search').fill('Haus 4999');
    await page
      .locator('#atlas-search-results button')
      .filter({ hasText: /^Haus · Haus 4999$/ })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector('#city-unit-name').value === 'Haus 4999' &&
        !document.querySelector('#city-inspector').hidden,
    );
    assert((await page.locator('#city-count').innerText()).includes('Einzelauswahl'));
    await app.evaluate(({ ipcMain }) => {
      const commit = ipcMain._invokeHandlers.get('atlas:commit'),
        site = ipcMain._invokeHandlers.get('atlas:city-site');
      global.__siteFault = { arm: true, read: false, commits: 0 };
      ipcMain.removeHandler('atlas:commit');
      ipcMain.handle('atlas:commit', async (...args) => {
        const result = await commit(...args);
        if (result.ok && args[1]?.action?.kind === 'city') {
          global.__siteFault.commits++;
          if (global.__siteFault.arm) {
            global.__siteFault.arm = false;
            global.__siteFault.read = true;
          }
        }
        return result;
      });
      ipcMain.removeHandler('atlas:city-site');
      ipcMain.handle('atlas:city-site', (...args) => {
        if (global.__siteFault.read) {
          global.__siteFault.read = false;
          return { ok: false, error: 'Kontrollierter Detailread-Ausfall nach bestätigtem Commit' };
        }
        return site(...args);
      });
    });
    await page.locator('#city-unit-name').fill('Gespeicherte Werkstatt');
    await page.locator('#city-unit-type').click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('#status')
          .textContent.includes('Gespeichert. Element vor weiterer Änderung neu laden.'),
      null,
      { timeout: 30000 },
    );
    assert.equal(await app.evaluate(() => global.__siteFault.commits), 1);
    await page.locator('#city-unit-reload').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#city-unit-name').value === 'Gespeicherte Werkstatt' &&
        document.querySelector('#status').textContent === 'Gespeichertes Element geladen.',
    );
    assert.equal(await app.evaluate(() => global.__siteFault.commits), 1);
    results.knownCommitFailedReadRecovered = true;
    await page.locator('#city-unit-name').fill('Korrigierte Werkstatt');
    await page.locator('#city-unit-type').click();
    const site = await waitForHouse(page, token, cityId, (u) => u.name === 'Korrigierte Werkstatt');
    assert(site.ok);
    assert.equal(site.value.unit.name, 'Korrigierte Werkstatt');
    assert(site.value.unit.notes.startsWith('PRIVATE-HOUSE-4999\r\n'));
    await page.waitForFunction(
      () =>
        document.querySelector('#status').textContent === 'Stadt gespeichert.' &&
        !document.querySelector('#city-unit-name').disabled,
    );
    await atlasCanvasReady(page);
    results.targetedHouseEditPreservesNotes = true;
    native.mark('move house and undo');
    await page.locator('#atlas-section').selectOption('city');
    await page.locator('#atlas-select').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#campaign-atlas').dataset.panMode === 'false' &&
        document.querySelector('#campaign-atlas').dataset.regionState === 'ready' &&
        document.querySelector('#campaign-map').dataset.canvasState === 'loaded',
    );
    await dragHouse(page, site.value.unit.position);
    await page.waitForFunction(
      () => document.querySelector('#atlas-save-status').textContent === 'Gespeichert',
      null,
      { timeout: 30000 },
    );
    await waitForHouse(
      page,
      token,
      cityId,
      (u) => JSON.stringify(u.position) !== JSON.stringify(site.value.unit.position),
    );
    const moved = await page.evaluate(
      async ({ token, cityId }) => window.campaign.atlasCitySite(token, cityId, 'building-4999'),
      { token, cityId },
    );
    assert(moved.ok);
    assert.notDeepEqual(moved.value.unit.position, site.value.unit.position);
    for (const axis of ['x', 'y'])
      assert(
        Math.abs(
          moved.value.unit.position[axis] -
            site.value.unit.position[axis] -
            results.pointer.expectedDelta[axis],
        ) < 0.03,
        'House movement follows the displayed meter scale at ' + zoom + '× zoom',
      );
    assert.equal(moved.value.unit.notes, site.value.unit.notes);
    assert.deepEqual(moved.value.unit.recipe, site.value.unit.recipe);
    assert.deepEqual(moved.value.unit.externalExtension, { keep: 'yes' });
    await page.locator('#atlas-undo').click();
    await page.waitForFunction(
      () => document.querySelector('#atlas-save-status').textContent === 'Gespeichert',
      null,
      { timeout: 30000 },
    );
    await waitForHouse(
      page,
      token,
      cityId,
      (u) => JSON.stringify(u.position) === JSON.stringify(site.value.unit.position),
    );
    const undone = await page.evaluate(
      async ({ token, cityId }) => window.campaign.atlasCitySite(token, cityId, 'building-4999'),
      { token, cityId },
    );
    assert(undone.ok);
    assert.deepEqual(undone.value.unit.position, site.value.unit.position);
    results.exactHouseMoveUndo = true;
    native.mark('dense city geometry');
    const center = await atlasCanvasPoint(page, {
      x: 50000 + site.value.unit.position.x,
      y: 40000 + site.value.unit.position.y,
    });
    await page.mouse.move(center.x, center.y);
    for (let i = 0; i < 24; i++) await page.mouse.wheel(0, 100);
    await page.waitForFunction(
      () =>
        document.querySelector('#campaign-atlas').dataset.regionState === 'ready' &&
        document.querySelector('#atlas-hint').textContent.startsWith('Dichte Kartengeometrie'),
      null,
      { timeout: 60000 },
    );
    await scrollVisible(page.locator('#campaign-map'));
    await capture(page, output + '/dense-region.png');
    const denseImage = require('pngjs').PNG.sync.read(await readFile(output + '/dense-region.png')),
      paper = [1, 3, 5].map((i) => parseInt(site.value.header.paper.slice(i, i + 2), 16));
    let paperPixels = 0;
    for (let i = 0; i < denseImage.data.length; i += 4)
      if (paper.every((v, c) => Math.abs(denseImage.data[i + c] - v) < 2)) paperPixels++;
    assert(paperPixels > 100, 'Actual native screen paints the dense geometry image');
    results.denseRasterPixels = paperPixels;
    const hitPoint = await atlasCanvasPoint(page, {
      x: 50000 + site.value.unit.position.x,
      y: 40000 + site.value.unit.position.y,
    });
    await page.mouse.click(hitPoint.x, hitPoint.y);
    await page.waitForFunction(
      () =>
        document.querySelector('#campaign-atlas').dataset.regionState === 'ready' &&
        !document.querySelector('#atlas-hint').textContent.startsWith('Dichte Kartengeometrie') &&
        document.querySelector('#city-unit-name').value === 'Korrigierte Werkstatt',
      null,
      { timeout: 60000 },
    );
    results.exactRasterHit = true;
    await capture(page, output + '/city-region.png');
    await page.locator('#atlas-search').fill('Geänderte Spur');
    await page.locator('#atlas-search-results button').filter({ hasText: '4000' }).click();
    await page.waitForFunction(() => document.querySelector('#room-name').value === 'Treffer 82');
    await page.waitForFunction(
      () =>
        document.querySelector('#campaign-atlas').dataset.regionState === 'ready' &&
        document.querySelector('#campaign-map').dataset.canvasState === 'loaded',
      null,
      { timeout: 60000 },
    );
    const beforeLive = await page.evaluate(
      async ({ token, sceneId }) => window.campaign.sceneWorld(token, sceneId),
      { token, sceneId },
    );
    assert(beforeLive.ok);
    await page.evaluate(() => {
      window.__regionMap = document.querySelector('#campaign-map');
      window.__regionCamera = {
        x: window.__regionMap.dataset.atlasOriginX,
        y: window.__regionMap.dataset.atlasOriginY,
        width: JSON.parse(window.__regionMap.dataset.atlasView).width,
      };
    });
    await nav(page, 'live-tab');
    await page.locator('#live-travel-toggle').click();
    await page.locator('#live-center-map-tab').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#live-center-map #campaign-map') &&
        document.querySelector('#campaign-atlas').dataset.regionState === 'ready',
      null,
      { timeout: 60000 },
    );
    assert(
      await page.evaluate(
        () => window.__regionMap === document.querySelector('#live-center-map #campaign-map'),
      ),
    );
    const camera = await page.evaluate(() => ({
      before: window.__regionCamera,
      after: {
        x: window.__regionMap.dataset.atlasOriginX,
        y: window.__regionMap.dataset.atlasOriginY,
        width: JSON.parse(window.__regionMap.dataset.atlasView).width,
      },
    }));
    assert.deepEqual(camera.before, camera.after);
    const liveSample = {
      ...(await atlasCanvasPoint(page, { x: 19995.6, y: 0.6 })),
      fill: '#e8d8ac',
      ...(await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))),
    };
    await capture(page, output + '/live-region.png');
    const livePixels = require('pngjs').PNG.sync.read(await readFile(output + '/live-region.png')),
      expected = [1, 3, 5].map((i) => parseInt(liveSample.fill.slice(i, i + 2), 16)),
      sx = Math.round((liveSample.x * livePixels.width) / liveSample.width),
      sy = Math.round((liveSample.y * livePixels.height) / liveSample.height);
    let visibleRoomPixels = 0;
    for (let y = sy - 2; y <= sy + 2; y++)
      for (let x = sx - 2; x <= sx + 2; x++) {
        const i = (y * livePixels.width + x) * 4;
        if (expected.every((v, c) => Math.abs(livePixels.data[i + c] - v) < 3)) visibleRoomPixels++;
      }
    results.liveSample = { ...liveSample, sx, sy, matches: visibleRoomPixels };
    assert(
      visibleRoomPixels >= 5,
      'Actual native Live screen paints the displayed room at its expected location',
    );
    results.visibleLiveRoomPixels = visibleRoomPixels;
    await nav(page, 'atlas-tab');
    await page.waitForFunction(
      () =>
        !document.querySelector('#live-center-map #campaign-map') &&
        document.querySelector('#campaign-atlas').dataset.regionState === 'ready',
      null,
      { timeout: 60000 },
    );
    assert(
      await page.evaluate(() => window.__regionMap === document.querySelector('#campaign-map')),
    );
    const afterLive = await page.evaluate(
      async ({ token, sceneId }) => window.campaign.sceneWorld(token, sceneId),
      { token, sceneId },
    );
    assert(afterLive.ok);
    assert.deepEqual(afterLive.value.position, beforeLive.value.position);
    assert.equal(afterLive.value.scene.clock.instantMs, beforeLive.value.scene.clock.instantMs);
    results.sharedLiveCanvasAndFacts = true;
    const exportFile = output + '/region-export.png';
    await app.evaluate(({ dialog }, file) => {
      const original = dialog.showSaveDialog;
      dialog.showSaveDialog = async () => {
        dialog.showSaveDialog = original;
        return { canceled: false, filePath: file };
      };
    }, exportFile);
    const details = page
      .locator('details')
      .filter({ has: page.locator('#atlas-export-size') })
      .first();
    if ((await details.getAttribute('open')) === null)
      await details.locator(':scope > summary').click();
    await page.locator('#atlas-export-audience').selectOption('gm');
    await page.locator('#atlas-export-size').fill('1024');
    await page.locator('#atlas-export-png').click();
    await page.waitForFunction(
      () => document.querySelector('#atlas-save-status').textContent === 'Atlas-PNG gespeichert',
      null,
      { timeout: 60000 },
    );
    const png = require('pngjs').PNG.sync.read(await readFile(exportFile));
    let roomPixels = 0;
    for (let i = 0; i < png.data.length; i += 4)
      if (
        Math.abs(png.data[i] - 222) < 3 &&
        Math.abs(png.data[i + 1] - 215) < 3 &&
        Math.abs(png.data[i + 2] - 189) < 3
      )
        roomPixels++;
    assert(roomPixels > 50, 'Actual exported PNG contains room geometry');
    results.exportedGeometryPixels = roomPixels;
    results.zoom = zoom;
  }
  await legacyMaps();
  results.beforeClose = await app.evaluate(() => global.__roomProbe);
  assert(
    results.beforeClose.responses.some(
      (r) =>
        r.name === 'atlas:room-commit' && r.roomId === longId && r.workspacePrivateText === false,
    ),
  );
  await finish();
  native.mark('fresh reopen');
  page = await launch();
  await enter(page);
  await page.waitForFunction(
    () =>
      document.querySelector('#room-name').value === 'Treffer 82' &&
      !document.querySelector('#room-name').disabled,
    { timeout: 30000 },
  );
  assert.equal(
    await page.locator('#keys textarea').first().inputValue(),
    rooms.at(-1).sections[0].markdown.replace(/\r\n/g, '\n') + '\nGeänderte Spur',
  );
  results.freshPreservesSelectedText = true;
  await capture(page, output + '/reopen.png');
  await finish();
  const damaged = new CampaignStore(file);
  const bad = damaged.db
    .prepare('SELECT payload FROM room WHERE campaign_id=? AND id=?')
    .get(cam.id, 'room-2').payload;
  await writeFile(output + '/damaged-room-original.json', bad);
  damaged.db
    .prepare('UPDATE room SET payload=? WHERE campaign_id=? AND id=?')
    .run('{broken', cam.id, 'room-2');
  damaged.db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run('room-2', cam.id);
  damaged.close();
  page = await launch();
  await enter(page);
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('Raum konnte nicht geladen werden'),
  );
  assert.equal(await page.locator('#room-name').isDisabled(), true);
  await capture(page, output + '/damaged-selected.png');
  await page.locator('#atlas-search').fill('Kammer 3');
  await page.locator('#atlas-search-results button').filter({ hasText: /^3 · / }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('#room-name').value === 'Kammer 3' &&
      !document.querySelector('#room-name').disabled,
  );
  results.damagedSelectedDoesNotBlockOtherRoom = true;
  await finish();
  const verify = new CampaignStore(file);
  assert.equal(
    verify.db.prepare('SELECT payload FROM room WHERE campaign_id=? AND id=?').get(cam.id, 'room-2')
      .payload,
    '{broken',
  );
  verify.close();
  results.damagedBytesPreserved = true;
  results.errors = errors;
  assert.deepEqual(errors, []);
  await native.finish(results);
  console.log(
    JSON.stringify({
      output,
      completePages: results.completePages,
      invalidDraftResumed: results.invalidDraftResumed,
      normalExits: results.launches.length,
    }),
  );
} catch (e) {
  await native.fail(e);
  throw e;
} finally {
  await native.dispose();
}
