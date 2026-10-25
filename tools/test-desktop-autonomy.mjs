import { createNativeSession } from './native-session.mjs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
if (process.argv.length > 2) throw Error('This probe checks the current application contract.');
const source = process.cwd(),
  zoom = Number(process.env.GM_QA_ZOOM ?? 1),
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/autonomy-evidence');
const require = createRequire(source + '/package.json'),
  Database = require('better-sqlite3');
const native = await createNativeSession({
    root: source,
    output,
    name: 'gm-autonomy',
    resultName: 'autonomy.json',
  }),
  file = native.profile + '/workbench.sqlite';
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/desktop/autonomy-probe-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(source + '/.build/desktop/autonomy-probe-store.cjs');
const store = new CampaignStore(file),
  room = {
    id: 'room',
    scopeId: 'local',
    floorId: 'ground',
    name: 'Halle',
    number: '1',
    revision: 0,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        holes: [],
      },
    ],
    sections: [],
  },
  campaign = store.create('Eine Wache mit bestätigter Zeit', [room]),
  w = store.activate(campaign.id),
  command = (action) => ({
    commandId: randomUUID(),
    token: w.token,
    campaignId: campaign.id,
    action,
  });
const id = randomUUID(),
  other = randomUUID(),
  prose = '  Kennt den Fluchtweg.\r\n- Ring behalten';
for (const [npcId, name] of [
  [id, 'Borin'],
  [other, 'Mira'],
])
  store.executeNpc({
    commandId: randomUUID(),
    token: w.token,
    campaignId: campaign.id,
    expectedNoteRevision: null,
    expectedRecordRevision: 0,
    expectedActorRevision: null,
    expectedPositionRevision: null,
    npc: {
      id: npcId,
      name,
      creatureId: null,
      readAloud: prose,
      gmNotes: prose,
      record: {
        id: npcId,
        revision: 0,
        factionId: null,
        modifier: 0,
        lifecycle: 'active',
        appearance: '',
        behavior: '',
        history: '',
      },
      locationId: null,
      health: null,
    },
  });
const element = {
  id: randomUUID(),
  revision: 0,
  scopeId: 'local',
  floorId: 'ground',
  roomId: 'room',
  kind: 'feature',
  points: [{ x: 5, y: 5 }],
  name: 'Fallgrube',
  notes: '',
  secret: true,
  color: '#000000',
  width: 1,
  height: 1,
  angle: 0,
  variant: '',
  blocksSight: false,
  blocksSound: false,
  passable: true,
  state: 'open',
  targetRoomId: null,
  targetFloorId: null,
  anchor: null,
  feature: 'trap',
  maxCharges: 1,
  resetSeconds: 0,
  resetMode: 'empty',
  triggerRadius: 0,
  triggerHeight: 0,
  assetId: null,
  archived: false,
};
store.executeDrawing(command({ kind: 'element', element, expectedRevision: null }));
store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 }));
const untouched = store.db
  .prepare('SELECT * FROM world_note WHERE campaign_id=? ORDER BY id')
  .all(campaign.id);
store.tutorial('skipped');
store.close();
const results = {};
async function navigate(page, id) {
  if (!(await page.locator('#' + id).isVisible())) {
    if (await page.locator('#atlas-navigation').isVisible())
      await page.locator('#atlas-navigation').click();
    if (!(await page.locator('#' + id).isVisible()))
      await page.locator('#workspace-nav-summary').click();
  }
  await page.locator('#' + id).click();
}
async function launch() {
  const page = await native.launch(zoom);
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: /Öffnen|Fortsetzen/ })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
  );
  await navigate(page, 'autonomy-tab');
  await page.locator('#autonomy-summary').filter({ hasText: 'aktivierte NPCs' }).waitFor();
  return page;
}
function inspect() {
  const db = new Database(file, { readonly: true });
  try {
    assert.deepEqual(
      db.prepare('SELECT * FROM world_note WHERE campaign_id=? ORDER BY id').all(campaign.id),
      untouched,
    );
    const latest = db
      .prepare('SELECT coalesce(max(ordinal),0) n FROM autonomy_interval WHERE campaign_id=?')
      .get(campaign.id).n;
    return {
      actors: db
        .prepare('SELECT payload FROM autonomy_actor WHERE campaign_id=? ORDER BY id')
        .all(campaign.id)
        .map((row) => {
          const actor = JSON.parse(row.payload);
          return { ...actor, remaining: latest - actor.cursor };
        }),
      logs: db
        .prepare(
          'SELECT payload FROM autonomy_log WHERE campaign_id=? ORDER BY rowid DESC LIMIT 100',
        )
        .all(campaign.id)
        .map((row) => JSON.parse(row.payload)),
      instant: db
        .prepare(
          'SELECT c.instant_ms FROM scene_clock c JOIN live_state s ON s.campaign_id=c.campaign_id AND s.focus_id=c.scene_id WHERE c.campaign_id=?',
        )
        .get(campaign.id).instant_ms,
    };
  } finally {
    db.close();
  }
}
try {
  let page = await launch();
  assert.deepEqual(inspect().actors, []);
  await page.locator('#autonomy-job-new').click();
  await page.locator('#autonomy-job-name').fill('Tor bewachen');
  await page.locator('#autonomy-job-kind').selectOption('guard');
  await page.locator('#autonomy-job-duration').fill('1');
  await page.locator('#autonomy-job-special > summary').click();
  assert.deepEqual(await page.locator('#autonomy-job-feature option').allTextContents(), [
    'Keine Auswahl',
    'Fallgrube',
  ]);
  await native.capture(page, 'trap-choices');
  await page.locator('#autonomy-job-form button[type=submit]').click();
  await page.waitForFunction(
    () => document.querySelector('#status').textContent === 'Jobangebot gespeichert.',
  );
  await page.locator('#autonomy-actor').selectOption(id);
  await page.locator('#autonomy-enabled').check();
  await page.locator('#autonomy-role').fill('Torwache');
  await page.locator('#autonomy-actor-form button[type=submit]').click();
  await page.waitForFunction(() =>
    document.querySelector('#autonomy-summary').textContent.startsWith('1 aktivierte'),
  );
  const before = inspect();
  assert.equal(before.instant, '0');
  assert.equal(before.logs.length, 0);
  await page.locator('#autonomy-refresh').click();
  assert.equal(inspect().logs.length, 0, 'opening and refreshing authorizes no elapsed time');
  await navigate(page, 'live-tab');
  await page.locator('#time-controls > summary').click();
  await page.locator('#time-amount').fill('2');
  await page.locator('#time-unit').selectOption('minutes');
  await page.locator('#time-reason').fill('Die Torwache erhält zwei Minuten');
  await page.locator('#time-advance').click();
  await page.waitForFunction(() =>
    document.querySelector('#live-clock').textContent.includes('00:02'),
  );
  await navigate(page, 'autonomy-tab');
  await page.locator('#autonomy-catchup').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#status').textContent ===
      'Bestätigte Zeit verarbeitet; Entscheidungsgrenzen bleiben pausiert.',
  );
  const applied = inspect();
  assert.equal(applied.instant, '120000');
  assert.equal(applied.actors.length, 1);
  assert.equal(applied.actors[0].id, id);
  assert.equal(applied.actors[0].role, 'Torwache');
  assert.equal(applied.actors[0].remaining, 0);
  const completed = applied.logs.filter((l) => l.kind === 'complete');
  assert.equal(completed.length, 2);
  assert(completed.every((l) => l.text === 'Tor bewachen abgeschlossen.'));
  await page.locator('#autonomy-catchup').click();
  await page.waitForFunction(() => !document.querySelector('#autonomy-catchup').disabled);
  assert.deepEqual(inspect(), applied, 'repeated catch-up has no repeated effects');
  await page.locator('#autonomy-log').scrollIntoViewIfNeeded();
  await native.capture(page, 'confirmed-jobs');
  await native.close();
  page = await launch();
  await page.locator('#autonomy-actors').filter({ hasText: 'Borin' }).waitFor();
  await page
    .locator('#autonomy-actors')
    .getByRole('button', { name: 'Konfigurieren', exact: true })
    .click();
  assert.equal(await page.locator('#autonomy-role').inputValue(), 'Torwache');
  assert.deepEqual(inspect(), applied);
  await page.locator('#autonomy-catchup').click();
  await page.waitForFunction(() => !document.querySelector('#autonomy-catchup').disabled);
  assert.deepEqual(inspect(), applied);
  await page.locator('#autonomy-actors').scrollIntoViewIfNeeded();
  await native.capture(page, 'fresh-state');
  await native.close();
  Object.assign(results, {
    trapChoices: ['Fallgrube'],
    enabledActors: 1,
    confirmedMilliseconds: applied.instant,
    completedJobs: completed.length,
    repeatedCatchupUnchanged: true,
    nativeRestart: true,
    exactNpcNotesPreserved: true,
  });
  await native.finish({ results });
  console.log(JSON.stringify({ results, normalClose: true }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
