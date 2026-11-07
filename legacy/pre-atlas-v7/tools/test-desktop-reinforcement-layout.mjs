import { revealWorkspaceNavigation } from './native-navigation.mjs';
import { createNativeSession } from './native-session.mjs';
// Complete GM task from a seeded running encounter. All subsequent actions use native UI.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  Database = require('better-sqlite3'),
  zoom = 1,
  out = process.env.QA_EVIDENCE_DIR ?? root + '/.build/reinforcement-layout-' + zoom;
const replyLoss = process.argv.includes('--reply-loss');
const native = await createNativeSession({ root, output: out, name: 'gm-reinforcement' }),
  { profile, launches, errors } = native;
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/reinforcement-probe-store-' + process.pid + '.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(
  root + '/.build/reinforcement-probe-store-' + process.pid + '.cjs',
);
const store = new CampaignStore(profile + '/workbench.sqlite'),
  campaign = store.create('Goblinverstärkung am Hafentor'),
  w = store.activate(campaign.id),
  cmd = (action) => ({ commandId: randomUUID(), campaignId: campaign.id, token: w.token, action });
const scene = store.executeLive(cmd({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
let combat = store.executeCombat({
  ...cmd({
    kind: 'create',
    sceneId: scene.id,
    title: 'Hafentor',
    includeParty: false,
    expectedMembershipRevision: scene.membershipRevision,
  }),
  combatId: null,
  expectedRevision: null,
}).combat;
function seed(action) {
  combat = store.executeCombat({
    ...cmd(action),
    combatId: combat.id,
    expectedRevision: combat.revision,
  }).combat;
}
seed({ kind: 'add-creature', creatureId: 'goblin', count: 2, grouped: true, initiative: 12 });
seed({ kind: 'start' });
seed({
  kind: 'edit',
  participantId: combat.participants[0].id,
  changes: { hp: 4, conditions: 'Liegend' },
});
const original = structuredClone(combat);
store.tutorial('skipped');
store.close();
let app,
  page,
  stage = 'launch';
const states = [],
  recoveries = [];
const read = () => {
  const db = new Database(profile + '/workbench.sqlite', { readonly: true });
  try {
    return JSON.parse(db.prepare('SELECT payload FROM combat WHERE id=?').get(combat.id).payload);
  } finally {
    db.close();
  }
};
async function shot(name) {
  await native.capture(page, name);
  states.push({
    name,
    layout: await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      headerPosition: getComputedStyle(document.querySelector('body>header')).position,
      navigationTop: document.querySelector('#workspace-navigation').getBoundingClientRect().top,
      tableMaxHeight: getComputedStyle(document.querySelector('.combat-table-scroll')).maxHeight,
    })),
    text: (await page.locator('dialog[open]').count())
      ? await page.locator('dialog[open]').innerText()
      : await page.locator('#combat-panel').innerText(),
  });
}
async function launch(expected = 'running') {
  page = await native.launch(zoom);
  app = native.app;
  await page
    .locator('.campaign-card[data-campaign-id="' + campaign.id + '"]')
    .getByRole('button', { name: /Öffnen|Fortsetzen/ })
    .click();
  await revealWorkspaceNavigation(page);
  await page.getByRole('button', { name: 'Party und Leiten', exact: true }).click();
  await page.waitForFunction(
    (expected) =>
      document
        .getElementById('combat-status')
        .textContent.includes(expected === 'running' ? 'Am Zug: Goblin A' : 'Abgeschlossen'),
    expected,
  );
}
async function checkControls(ids) {
  if (!process.argv.includes('--assert-layout')) return;
  for (const id of ids) {
    assert(
      await page.locator('#' + id).evaluate((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          r.left >= 0 &&
          r.right <= innerWidth &&
          e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
        );
      }),
      id + ' must be fully visible and uncovered',
    );
  }
}
async function close() {
  await native.close();
  app = null;
}
async function add(lose) {
  const count = read().participants.length,
    source = await page.locator('#combat-creature-source').inputValue();
  if (lose)
    await app.evaluate(({ ipcMain }) => {
      // Each fault wraps the original handlers, never the preceding logger.
      const write = (globalThis.qaReinforcementOriginalWrite ??=
          ipcMain._invokeHandlers.get('campaign:execute-combat')),
        read = (globalThis.qaReinforcementOriginalRead ??=
          ipcMain._invokeHandlers.get('campaign:commit-status'));
      let lose = true;
      globalThis.qaReinforcementStatusUnavailable = true;
      globalThis.qaReinforcementWrites = [];
      ipcMain.removeHandler('campaign:commit-status');
      ipcMain.handle('campaign:commit-status', (e, ...args) =>
        globalThis.qaReinforcementStatusUnavailable
          ? { ok: false, error: 'Controlled reinforcement status read failure' }
          : read(e, ...args),
      );
      ipcMain.removeHandler('campaign:execute-combat');
      ipcMain.handle('campaign:execute-combat', async (e, c) => {
        globalThis.qaReinforcementWrites.push(c);
        const result = await write(e, c);
        if (c.action.kind === 'add-creature' && lose) {
          lose = false;
          throw Error('Controlled reinforcement reply loss after commit');
        }
        return result;
      });
    });
  await page.locator('#combat-creature-add').click();
  if (lose) {
    await page.waitForFunction(() =>
      document.getElementById('combat-add-status').textContent.includes('Buchungsantwort fehlt'),
    );
    assert.equal(await page.locator('#combat-creature-add').isDisabled(), true);
    assert.equal(await page.locator('#combat-add-close').isEnabled(), true);
    assert.equal(await page.locator('#combat-creature-count').inputValue(), '1');
    assert.equal(await page.locator('#combat-creature-source').inputValue(), source);
    await shot('unconfirmed-' + source);
    await checkControls(['combat-add-close', 'combat-add-status']);
    if (source !== 'catalog') await page.locator('#combat-add-close').click();
    else await page.keyboard.press('Escape');
    await page.locator('#combat-add-dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#combat-next').isDisabled(), true);
    await app.evaluate(() => {
      globalThis.qaReinforcementStatusUnavailable = false;
    });
    await page.locator('#commit-check').click();
    await page.locator('#commit-pending').waitFor({ state: 'hidden' });
    const writes = await app.evaluate(() => globalThis.qaReinforcementWrites);
    assert.equal(writes.length, 1);
    const db = new Database(profile + '/workbench.sqlite', { readonly: true });
    try {
      assert.equal(
        db
          .prepare('SELECT count(*) n FROM combat_receipt WHERE command_id=?')
          .get(writes[0].commandId).n,
        1,
      );
    } finally {
      db.close();
    }
    recoveries.push({
      source,
      countBefore: count,
      countAfter: read().participants.length,
      commands: writes.map((c) => c.commandId),
    });
  }
  await page.locator('#combat-add-dialog').waitFor({ state: 'hidden' });
  await page.locator('#combat-next:enabled').waitFor();
  if (lose)
    await page.waitForFunction(
      (total) =>
        document.getElementById('combat-assessment').textContent.startsWith(total + ' Basis-XP'),
      read().participants.reduce((sum, p) => sum + (p.xp ?? 0), 0),
    );
  assert.equal(read().participants.length, count + 1);
}
try {
  await launch();
  await page.locator('#combat-add-open').scrollIntoViewIfNeeded();
  await shot('running');
  stage = 'existing troop';
  await page.locator('.combat-mob-reinforce').click();
  assert.equal(await page.locator('#combat-creature-source').inputValue(), 'group');
  assert.equal(
    await page.locator('#combat-creature-select').inputValue(),
    'group:' + original.participants[0].groupId,
  );
  assert.equal(await page.evaluate(() => document.activeElement.id), 'combat-creature-count');
  await shot('existing-troop');
  await checkControls([
    'combat-creature-source',
    'combat-creature-select',
    'combat-creature-count',
    'combat-creature-add',
  ]);
  await page.locator('#combat-creature-count').fill('1');
  await add(replyLoss);
  let current = read();
  assert.deepEqual(current.participants.slice(0, 2), original.participants);
  assert.equal(current.turnId, original.turnId);
  assert.equal(current.participants.length, 3);
  assert.equal(current.participants[2].groupId, original.participants[0].groupId);
  stage = 'new creature';
  await page.locator('#combat-add-open').click();
  await page.locator('#combat-creature-source').selectOption('catalog');
  await page.locator('#combat-creature-search').fill('Hobgoblin');
  await page
    .locator('#combat-creature-search-form')
    .getByRole('button', { name: 'Monster suchen', exact: true })
    .click();
  await page
    .locator('#combat-creature-select option[value="creature:hobgoblin"]')
    .waitFor({ state: 'attached' });
  await page.locator('#combat-creature-select').selectOption('creature:hobgoblin');
  await page.locator('#combat-creature-initiative').fill('10');
  await shot('new-creature');
  await checkControls([
    'combat-creature-source',
    'combat-creature-select',
    'combat-creature-count',
    'combat-creature-initiative',
    'combat-creature-add',
  ]);
  await add(replyLoss);
  current = read();
  assert.equal(current.participants.length, 4);
  assert.deepEqual(current.participants.slice(0, 2), original.participants);
  assert.equal(current.turnId, original.turnId);
  assert.equal(current.round, original.round);
  const hob = current.participants.find((p) => p.sourceId === 'hobgoblin');
  assert.equal(hob.hp, 11);
  assert.equal(hob.initiative, 10);
  await page.locator('#combat-add-open').scrollIntoViewIfNeeded();
  await shot('reinforced');
  await page
    .locator('#combat-rows')
    .getByRole('button', { name: 'Goblin A · Schaden oder Heilung', exact: true })
    .scrollIntoViewIfNeeded();
  await page.getByText('Vorderes Mitglied: Liegend.', { exact: true }).scrollIntoViewIfNeeded();
  if (process.argv.includes('--assert-layout'))
    assert(
      await page.evaluate(() => {
        const hp = document.querySelector('.combat-mob-health').getBoundingClientRect(),
          condition = [...document.querySelectorAll('#combat-rows p')]
            .find((p) => p.textContent === 'Vorderes Mitglied: Liegend.')
            .getBoundingClientRect(),
          footer = document.querySelector('#music-mini').getBoundingClientRect();
        return (
          hp.top >= 0 &&
          condition.top >= 0 &&
          hp.bottom <= footer.top &&
          condition.bottom <= footer.top
        );
      }),
      'HP and condition must be visible together above the transport bar',
    );
  await shot('reinforced-health');
  await close();
  stage = 'fresh running';
  await launch();
  assert.deepEqual(read(), current);
  await shot('fresh-running');
  await page.locator('#combat-next').click();
  await page.waitForFunction(() =>
    document.getElementById('combat-status').textContent.includes('Am Zug: Goblin B'),
  );
  stage = 'finish';
  await page.locator('#combat-finish').click();
  await page.locator('#combat-outcome').fill('Die Verstärkung ergibt sich.');
  await page.locator('#finish-no-xp').check();
  await page
    .getByRole('button', { name: 'Ergebnis speichern und abschließen', exact: true })
    .click();
  await page.locator('#combat-finish-dialog').waitFor({ state: 'hidden' });
  await page.waitForFunction(() =>
    document.getElementById('combat-status').textContent.includes('Abgeschlossen'),
  );
  await shot('finished');
  const final = read();
  assert.equal(final.outcome, 'Die Verstärkung ergibt sich.');
  assert.deepEqual(final.participants, current.participants);
  await close();
  stage = 'fresh finished';
  await launch('finished');
  assert.match(
    await page.locator('#combat-resolution-summary').innerText(),
    /Die Verstärkung ergibt sich/,
  );
  await shot('fresh-finished');
  stage = 'rejected initial catalog preparation';
  await page.locator('#combat-creation summary').click();
  await page.locator('#combat-catalog-open').click();
  await app.evaluate(({ ipcMain }) => {
    const write = ipcMain._invokeHandlers.get('campaign:execute-combat');
    ipcMain.removeHandler('campaign:execute-combat');
    ipcMain.handle('campaign:execute-combat', (e, c) =>
      c.action.kind === 'create' && !globalThis.qaAcceptInitialCatalog
        ? { ok: false, error: 'Controlled initial catalog rejection' }
        : write(e, c),
    );
  });
  await page.locator('#combat-creature-add').click();
  await page.waitForFunction(() =>
    document
      .getElementById('combat-add-status')
      .textContent.includes('Controlled initial catalog rejection'),
  );
  assert.equal(await page.locator('#combat-add-close').isEnabled(), true);
  assert.equal(await page.locator('#combat-creature-add').isEnabled(), true);
  await shot('rejected-initial-catalog');
  await checkControls(['combat-add-close', 'combat-add-status']);
  assert.deepEqual(read(), final);
  const db = new Database(profile + '/workbench.sqlite', { readonly: true });
  try {
    assert.equal(db.prepare('SELECT count(*) n FROM combat').get().n, 1);
  } finally {
    db.close();
  }
  await native.app.evaluate(() => {
    globalThis.qaAcceptInitialCatalog = true;
  });
  await page.locator('#combat-creature-add').click();
  await page.waitForFunction(() =>
    document.getElementById('combat-add-status').textContent.includes('übernommen.'),
  );
  await page.locator('#combat-preparation-initiative').click();
  await page.locator('#combat-add-dialog').waitFor({ state: 'hidden' });
  await page.locator('#combat-start:enabled').waitFor();
  assert.deepEqual(read(), final);
  const created = new Database(profile + '/workbench.sqlite', { readonly: true });
  try {
    assert.equal(created.prepare('SELECT count(*) n FROM combat').get().n, 2);
  } finally {
    created.close();
  }
  await shot('initial-catalog-confirmed');
  await close();
  assert.deepEqual(errors, []);
  await native.finish({
    zoom,
    original,
    current,
    final,
    states,
    recoveries,
    initialCatalogCreated: true,
    directTroopEntry: true,
    complete: true,
    humanAcceptance: false,
    installedPackageAcceptance: false,
  });
  console.log(JSON.stringify({ out, launches }));
} catch (e) {
  await native.fail(e);
  console.error(stage, e);
  throw e;
} finally {
  await native.dispose();
}
