// A selected entrance remains usable after the ordinary shared Atlas moves away.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createNativeSession } from './native-session.mjs';
import { atlasCanvasReady } from './atlas-canvas-probe.mjs';

const root = process.cwd(),
  require = createRequire(root + '/package.json');
const out = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/atlas-entrance-context');
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/entrance-context-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/entrance-context-store.cjs');
const native = await createNativeSession({ root, output: out, name: 'atlas-entrance-context' });
const store = new CampaignStore(native.profile + '/workbench.sqlite');
const campaign = store.create('Eingang am Kartenrand', [
  {
    id: 'gate-room',
    scopeId: 'local',
    floorId: 'ground',
    number: '1',
    name: 'Torhaus',
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 12, y: 0 },
          { x: 12, y: 8 },
          { x: 0, y: 8 },
        ],
        holes: [],
      },
    ],
    sections: [],
  },
]);
const token = store.activate(campaign.id).token,
  command = (action) => ({ commandId: randomUUID(), token, campaignId: campaign.id, action });
store.executeAtlasCommit(
  command({
    kind: 'entrance',
    entrance: {
      id: 'gate-door',
      scopeId: 'local',
      roomId: 'gate-room',
      floorId: 'ground',
      inside: { x: 1, y: 4 },
      outside: { x: -1, y: 4 },
      revision: 0,
    },
  }),
);
store.executeAtlasCommit(
  command({
    kind: 'entrance',
    entrance: {
      id: 'side-door',
      scopeId: 'local',
      roomId: 'gate-room',
      floorId: 'ground',
      inside: { x: 2, y: 4 },
      outside: { x: -1, y: 4 },
      revision: 0,
    },
  }),
);
const pc = store.executeLive(
    command({ kind: 'create-character', profile: { name: 'Iri', speedFeet: 30 } }),
  ).character,
  live = store.live(token);
store.executeLive(
  command({
    kind: 'membership',
    characterId: pc.id,
    expectedRevision: pc.membershipRevision,
    expectedRosterRevision: live.rosterRevision,
    active: true,
    targetSceneId: null,
    expectedFocusRevision: live.focusRevision,
  }),
);
const scene = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: store.live(token).rosterRevision }),
  ).scene,
  view = store.campaignAtlas(token);
store.executeAtlasTravel({
  ...command({
    kind: 'place',
    point: { x: -1, y: 4 },
    expectedPositionRevision: view.scene.position.revision,
    expectedMembershipRevision: view.scene.scene.membershipRevision,
  }),
  sceneId: scene.id,
});
store.tutorial('skipped');
store.close();
try {
  const page = await native.launch(),
    app = native.app;
  await app.evaluate(({ ipcMain }) => {
    const channel = 'atlas:geometry-region',
      handler = ipcMain._invokeHandlers.get(channel);
    global.__entranceReads = [];
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (event, token, query, ...rest) => {
      const reply = await handler(event, token, query, ...rest);
      if (reply.ok)
        global.__entranceReads.push({
          query,
          entrances: reply.value.entrances.map((e) => e.id),
          bindings: reply.value.bindings.map((b) => b.ownerId),
          room: reply.value.geometry.position?.roomId ?? null,
        });
      if (global.__holdEntranceRead) {
        global.__holdEntranceRead = false;
        await new Promise((resolve) => (global.__releaseEntranceRead = resolve));
      }
      return reply;
    });
  });
  await page
    .locator('.campaign-card')
    .filter({ hasText: campaign.name })
    .getByRole('button', { name: /^(Fortsetzen|Öffnen)$/ })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
  );
  if (!(await page.locator('#live-tab').isVisible())) {
    if (await page.locator('#atlas-navigation').isVisible())
      await page.locator('#atlas-navigation').click();
    else await page.locator('#workspace-nav-summary').click();
  }
  await page.locator('#live-tab').click();
  if (await page.locator('#live-continue').isVisible())
    await page.locator('#live-continue').click();
  await page.locator('#live-travel-toggle').click();
  await page.locator('#live-center-map-tab').click();
  await atlasCanvasReady(page);
  await page.locator('#live-travel-navigation > summary').click();
  await page.locator('#atlas-to-party').click();
  await atlasCanvasReady(page);
  if (!(await page.locator('#atlas-local-entrance').isVisible()))
    await page.locator('#live-atlas-local-travel > summary').click();
  await page.locator('#atlas-entrance-choice').selectOption('gate-door');
  await page.getByRole('button', { name: 'Eingang betreten', exact: true }).waitFor();
  await app.evaluate(() => {
    global.__holdEntranceRead = true;
  });
  await page.locator('#atlas-overview').click();
  await page.waitForFunction(
    () => document.querySelector('#campaign-atlas').dataset.regionState === 'loading',
  );
  for (let i = 0; i < 200 && !(await app.evaluate(() => !!global.__releaseEntranceRead)); i++)
    await page.waitForTimeout(25);
  assert(
    await app.evaluate(() => !!global.__releaseEntranceRead),
    'Delayed region reply reached the real Main handler',
  );
  assert(
    await page.locator('#atlas-entrance-choice').isDisabled(),
    'Docked entrance selection is locked while its new context is pending',
  );
  await app.evaluate(() => global.__releaseEntranceRead());
  await atlasCanvasReady(page);
  const reads = await app.evaluate(() => global.__entranceReads);
  assert(
    reads.some(
      (r) =>
        r.query.entranceId === 'gate-door' &&
        r.bindings.length === 0 &&
        r.entrances.includes('gate-door'),
    ),
    'World overview keeps the chosen entrance through the real preload/Main path',
  );
  await native.capture(page, 'world-selected-entrance', '#atlas-local-entrance');
  await page.getByRole('button', { name: 'Eingang betreten', exact: true }).click();
  await page.getByRole('button', { name: 'Eingang verlassen', exact: true }).waitFor();
  await native.capture(page, 'inside-from-overview', '#atlas-local-entrance');
  await page.getByRole('button', { name: 'Eingang verlassen', exact: true }).click();
  await page.getByRole('button', { name: 'Eingang betreten', exact: true }).waitFor();
  const completedReads = await app.evaluate(() => global.__entranceReads);
  await native.close();
  const fresh = new CampaignStore(native.profile + '/workbench.sqlite');
  let final;
  try {
    const data = fresh.campaignAtlas(fresh.activate(campaign.id).token);
    assert.equal(data.geometry.position, null);
    assert.equal(data.scene.position.outdoor.x, -1);
    assert.equal(data.scene.position.outdoor.y, 4);
    final = { position: data.scene.position, room: data.geometry.position };
  } finally {
    fresh.close();
  }
  await native.finish({ complete: true, reads: completedReads, final });
  console.log(JSON.stringify({ complete: true, out }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
