// Native task: move the same partially allocated fund through location, inbox and group.
// Requires build:desktop; run via tools/ui-session.py. Native UI probes use 100%.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createNativeSession } from './native-session.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  out = process.env.GM_QA_OUT ?? root + '/.build/treasure-anchor-evidence';
const native = await createNativeSession({ root, output: out, name: 'treasure-anchor' });
try {
  require('esbuild').buildSync({
    entryPoints: ['src/app/storage/store.ts'],
    outfile: root + '/.build/treasure-anchor-store.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore } = require(root + '/.build/treasure-anchor-store.cjs');
  const file = native.profile + '/workbench.sqlite',
    store = new CampaignStore(file),
    campaign = store.create('Schatz auf neuer Route'),
    w = store.activate(campaign.id),
    cmd = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  const hero = store.executeLive(
    cmd({ kind: 'create-character', profile: { name: 'Ada' } }),
  ).character;
  const scene = store.executeLive(cmd({ kind: 'initialize', expectedRosterRevision: 1 })).scene;
  store.executeLive(
    cmd({
      kind: 'membership',
      characterId: hero.id,
      expectedRevision: 0,
      expectedRosterRevision: 1,
      active: true,
      targetSceneId: scene.id,
      expectedFocusRevision: 0,
    }),
  );
  const place = randomUUID();
  store.changePreparation({
    ...cmd(null),
    change: {
      kind: 'location',
      expectedRevision: null,
      document: {
        kind: 'location',
        version: 1,
        id: place,
        name: 'Salzspeicher',
        type: 'poi',
        sections: [],
        detailMaps: [],
        keyLinks: [],
      },
    },
  });
  const id = store.executeProgress(
    cmd({
      kind: 'treasure',
      sceneId: scene.id,
      title: 'Fund der Hafenwache',
      items: [{ name: 'Heiltrank', category: 'equipment', quantity: 3, valueGold: '50' }],
    }),
  ).treasureId;
  const treasure = store.treasure(w.token, id),
    lot = treasure.items[0];
  const ack = store.executeProgress(
    cmd({
      kind: 'allocate',
      treasureId: id,
      expectedRevision: treasure.revision,
      itemId: lot.id,
      expectedDefinitionRevision: lot.currentDefinition.revision,
      quantity: 1,
      characterId: hero.id,
      expectedMembershipRevision: 1,
    }),
  );
  const original = store.treasure(w.token, id),
    expectedItems = original.items.map((i) => ({
      ...i,
      origin: { treasureId: id, itemId: i.id, combatId: null, sceneId: scene.id, locationId: null },
    })),
    ledger = store.ledgerItem(w.token, ack.ledgerIds[0]);
  store.tutorial('skipped');
  store.close();
  const facts = () => {
    const s = new CampaignStore(file);
    try {
      const a = s.activate(campaign.id);
      return { treasure: s.treasure(a.token, id), ledger: s.ledgerItem(a.token, ledger.id) };
    } finally {
      s.close();
    }
  };
  const zoom = 1,
    snapshots = [];
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
    if (!(await page.locator('#treasury-tab').isVisible())) {
      if (await page.locator('#atlas-navigation').isVisible())
        await page.locator('#atlas-navigation').click();
      if (!(await page.locator('#treasury-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
    }
    await page.locator('#treasury-tab').click();
    await page.locator('#treasury-title').waitFor();
    return page;
  }
  async function shot(page, name) {
    await native.capture(page, name);
    snapshots.push({ name, text: await page.locator('#treasury').innerText() });
    await writeFile(out + '/snapshots.json', JSON.stringify(snapshots, null, 2));
  }
  let page = await launch();
  const groupLabel = 'Gruppe: Unbenannte Gruppe · ' + scene.id.slice(0, 8);
  assert.match(await page.locator('#treasury-list').innerText(), new RegExp(scene.id.slice(0, 8)));
  for (const control of ['treasury-filter-anchor', 'treasury-anchor-target'])
    assert.equal(
      await page.locator('#' + control + ' option[value="scene:' + scene.id + '"]').textContent(),
      groupLabel,
    );
  await shot(page, 'entry');
  const summary = page.getByText('Ganzen Schatz einer Gruppe oder einem Ort zuordnen', {
    exact: true,
  });
  await summary.click();
  await page.locator('#treasury-anchor-target').selectOption('location:' + place);
  await page
    .locator('#treasury-anchor-reason')
    .fill('Wache bringt den verbleibenden Fund zum Salzspeicher.');
  await page.locator('#treasury-anchor-apply').click();
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('gespeichert'),
  );
  await shot(page, 'at-place');
  assert.equal(facts().treasure.locationId, place);
  assert.equal(facts().treasure.sceneId, null);
  assert.deepEqual(facts().treasure.items, expectedItems);
  assert.deepEqual(facts().ledger, ledger);
  await page.locator('#treasury-filter-anchor').selectOption('location:' + place);
  await page.locator('#treasury-filter-form button').click();
  await page.locator('#treasury-list button').waitFor();
  await shot(page, 'found-place');
  await native.close();
  page = await launch();
  await page.locator('#treasury-filter-anchor').selectOption('location:' + place);
  await page.locator('#treasury-filter-form button').click();
  await page.locator('#treasury-list button').click();
  await shot(page, 'fresh');
  await page
    .getByText('Ganzen Schatz einer Gruppe oder einem Ort zuordnen', { exact: true })
    .click();
  await page.locator('#treasury-anchor-target').selectOption('unplaced');
  await page.locator('#treasury-anchor-reason').fill('Fund noch ohne endgültiges Versteck.');
  await page.locator('#treasury-anchor-apply').click();
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('gespeichert'),
  );
  await page.locator('#treasury-filter-anchor').selectOption('inbox');
  await page.locator('#treasury-filter-form button').click();
  await page.locator('#treasury-list button').waitFor();
  await shot(page, 'inbox');
  // Move the same partially distributed fund back to its identifiable running group.
  await page.locator('#treasury-anchor-target').selectOption({ label: groupLabel });
  await page.locator('#treasury-anchor-reason').fill('Wache nimmt den Rest wieder mit.');
  await page.locator('#treasury-anchor-apply').click();
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('gespeichert'),
  );
  await page.locator('#treasury-filter-anchor').selectOption({ label: groupLabel });
  await page.locator('#treasury-filter-form button').click();
  await page.locator('#treasury-list button').waitFor();
  await shot(page, 'returned-group');
  await native.close();
  page = await launch();
  await page.locator('#treasury-filter-search').fill(scene.id.slice(0, 8));
  await page.locator('#treasury-filter-form button').click();
  await page.locator('#treasury-list button').waitFor();
  assert.match(await page.locator('#treasury-list').innerText(), new RegExp(scene.id.slice(0, 8)));
  await shot(page, 'fresh-group');
  await native.close();
  const final = facts();
  assert.equal(final.treasure.sceneId, scene.id);
  assert.equal(final.treasure.locationId, null);
  assert.deepEqual(final.treasure.items, expectedItems);
  assert.deepEqual(final.ledger, ledger);
  await native.finish({
    complete: true,
    task: 'Move partially distributed treasure from group to location, find by anchor, reopen, move to inbox, return to group and refind after restart',
    original,
    final,
    zoom,
  });
  console.log('complete ' + out);
} catch (e) {
  await native.fail(e);
  if (native.app) await native.close().catch(() => {});
  throw e;
} finally {
  await native.dispose();
}
