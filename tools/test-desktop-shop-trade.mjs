// Native GM workflow with disposable campaign: choose a trader once, buy, return a portion, close and reopen.
// Requires build:desktop and desktop:runtime; run via python3 tools/ui-session.py. GM_QA_ZOOM=2 repeats at 200%.
import { createNativeSession } from './native-session.mjs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const source = process.cwd(),
  output = process.env.QA_EVIDENCE_DIR ?? path.join(source, '.build/shop-trade-evidence'),
  zoom = Number(process.env.GM_QA_ZOOM ?? 1);
const native = await createNativeSession({ root: source, output, name: 'shop-trade' });
try {
  const require = createRequire(source + '/package.json'),
    storeBundle = path.join(source, '.build/shop-trade-store.cjs');
  require('esbuild').buildSync({
    entryPoints: ['src/app/storage/store.ts'],
    outfile: storeBundle,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore } = require(storeBundle);
  const profile = native.profile,
    file = profile + '/workbench.sqlite',
    store = new CampaignStore(file),
    campaign = store.create('Markttag mit zwei Händlern'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: w.token,
      action,
    });
  const heroes = ['Ada', 'Borin'].map(
      (name) =>
        store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
    ),
    scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 2 })).scene;
  for (const c of heroes) {
    const live = store.live(w.token);
    store.executeLive(
      command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: c.membershipRevision,
        expectedRosterRevision: live.rosterRevision,
        active: true,
        targetSceneId: scene.id,
        expectedFocusRevision: live.focusRevision,
      }),
    );
  }
  const defs = [];
  for (const [name, unitCopper] of [
    ['Seil', '200'],
    ['Heiltrank', '500'],
  ]) {
    const definition = {
      id: randomUUID(),
      revision: 0,
      name,
      category: 'equipment',
      magic: false,
      rarity: '',
      attunement: 'no',
      unitCopper,
      weightText: '',
      properties: [],
      description: '  Handarbeit\r\n- Markt',
      source: { kind: 'authored', label: 'GM', license: null, url: null },
      trashed: false,
    };
    defs.push(
      store.executeItemShop(command({ kind: 'definition', definition, expectedRevision: null }))
        .definition,
    );
  }
  const items = [];
  for (let i = 0; i < 2; i++) {
    const ack = store.executeProgress(
      command({
        kind: 'manual-item',
        characterId: heroes[i].id,
        expectedMembershipRevision: store.live(w.token).roster.find((c) => c.id === heroes[i].id)
          .membershipRevision,
        origin: 'manual',
        item: {
          name: defs[i].name,
          quantity: i === 0 ? 4 : 2,
          valueGold: i === 0 ? '2' : '5',
          category: 'equipment',
          reference: { kind: 'authored', definitionId: defs[i].id, revision: defs[i].revision },
        },
        note: '  Fund\r\n- Reise',
      }),
    );
    items.push(store.ledgerItem(w.token, ack.ledgerIds[0]));
  }
  const [a, b] = items,
    shops = [],
    uniqueInstance = randomUUID(),
    otherInstance = randomUUID();
  for (const [name, quantity, buyCopper] of [
    ['Hafenladen', 5, '200'],
    ['Bergladen', 7, '500'],
  ]) {
    const id = randomUUID(),
      npc = store.executeNpc({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        expectedNoteRevision: null,
        expectedRecordRevision: 0,
        expectedActorRevision: null,
        expectedPositionRevision: null,
        npc: {
          id,
          name: 'Besitzer ' + name,
          creatureId: null,
          readAloud: '',
          gmNotes: '',
          record: {
            id,
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
    const shop = {
      id: randomUUID(),
      revision: 0,
      name,
      owner: { kind: 'npc', id: npc.id },
      notes: '  Preisliste\r\n- Markttag',
      trashed: false,
      stock: [
        {
          id: randomUUID(),
          reference: { kind: 'authored', definitionId: defs[0].id, revision: defs[0].revision },
          quantity,
          unique: false,
          instanceId: null,
          buyCopper,
          sellCopper: '100',
          notes: '',
          restock: null,
        },
      ],
    };
    if (name === 'Hafenladen')
      shop.stock.push(
        {
          id: randomUUID(),
          reference: { kind: 'authored', definitionId: defs[1].id, revision: defs[1].revision },
          quantity: 1,
          unique: true,
          instanceId: otherInstance,
          buyCopper: '800',
          sellCopper: '13',
          notes: 'Anderes Einzelstück',
          restock: null,
        },
        {
          id: randomUUID(),
          reference: { kind: 'authored', definitionId: defs[1].id, revision: defs[1].revision },
          quantity: 1,
          unique: true,
          instanceId: uniqueInstance,
          buyCopper: '700',
          sellCopper: '37',
          notes: 'Einzelstück',
          restock: null,
        },
      );
    shops.push(
      store.executeItemShop(command({ kind: 'shop', shop, expectedRevision: null })).shop.shop,
    );
  }
  const [sa, sb] = shops;
  store.tutorial('skipped');
  store.close();
  let app, page;
  async function launch() {
    const page = await native.launch(zoom);
    app = native.app;
    if (await page.locator('#tutorial-dialog').isVisible())
      await page.locator('#tutorial-skip').click();
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
    if (!(await page.locator('#items-tab').isVisible())) {
      if (await page.locator('#atlas-navigation').isVisible())
        await page.locator('#atlas-navigation').click();
      if (!(await page.locator('#items-tab').isVisible()))
        await page.locator('#workspace-nav-summary').click();
    }
    if (native.launches.length === 1)
      await app.evaluate(({ ipcMain }) => {
        const original = ipcMain._invokeHandlers.get('campaign:preparation');
        let fail = true;
        ipcMain.removeHandler('campaign:preparation');
        ipcMain.handle('campaign:preparation', async (e, ...args) => {
          if (fail) {
            fail = false;
            return { ok: false, error: 'QA: Gemeinsamer Kontext nicht lesbar' };
          }
          return original(e, ...args);
        });
      });
    await page.locator('#items-tab').click();
    await page.locator('#items-show-shops').click();
    if (native.launches.length === 1) {
      await page.locator('#item-context-status[role=alert]').waitFor({ state: 'visible' });
      assert.match(
        await page.locator('#item-context-status').innerText(),
        /QA: Gemeinsamer Kontext/,
      );
      assert.equal(await page.locator('#item-context-retry').isVisible(), true);
      await page.locator('#item-context-retry').scrollIntoViewIfNeeded();
      await native.capture(page, 'shared-context-error');
      await page.locator('#item-context-retry').click();
    }
    await page.waitForFunction(() => document.querySelectorAll('#shops-list button').length === 2);
    return page;
  }
  page = await launch();
  const choose = async () => {
    await page
      .locator('#shops-list')
      .getByRole('button', { name: /^Hafenladen ·/ })
      .click();
    await page.waitForFunction(
      (n) =>
        document.querySelector('#shop-name').value === n &&
        !document.querySelector('#shop-fields').disabled,
      sa.name,
    );
  };
  const shot = (name) => native.capture(page, name);
  await choose();
  assert.equal(await page.locator('#items-catalog').isVisible(), false);
  assert.equal(await page.locator('#shop-settings').getAttribute('open'), null);
  await page.locator('#shop-seller').selectOption(heroes[1].id);
  await page.waitForFunction(() => !document.querySelector('#shop-sale-fields').disabled);
  assert.deepEqual(
    await page.locator('#shop-stock button[data-purchase-available]').allTextContents(),
    ['Für Borin kaufen', 'Für Borin kaufen', 'Für Borin kaufen'],
  );
  assert.equal(await page.locator('#shop-sale-submit').innerText(), 'Verkauf für Borin buchen');
  await page.locator('#shop-seller').scrollIntoViewIfNeeded();
  await shot('trade-entry');
  const stock = page
    .locator('#shop-stock article')
    .filter({ has: page.getByRole('heading', { name: /^Seil ·/ }) });
  await stock.getByLabel('Kaufmenge', { exact: true }).fill('3');
  assert.equal(
    await stock.getByLabel('Tatsächlich gezahlt (GM gesamt)', { exact: true }).inputValue(),
    '6.00',
  );
  await stock.getByLabel('Tatsächlich gezahlt (GM gesamt)', { exact: true }).fill('5.01');
  await stock.getByRole('button', { name: /^Für .* kaufen$/, exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('#status').textContent === 'Kauf gebucht.',
  );
  assert.equal(await page.locator('#shop-seller').inputValue(), heroes[1].id);
  await page.locator('#shop-sale-item').selectOption({ label: '3 × Seil' });
  await page.locator('#shop-sale-quantity').fill('1');
  assert.equal(await page.locator('#shop-sale-price').inputValue(), '1.00');
  await page.locator('#shop-sale-price').fill('0.77');
  assert.match(await page.locator('#shop-sale-heading').innerText(), /Borin.*Hafenladen/);
  await page.locator('#shop-sale-form').scrollIntoViewIfNeeded();
  await shot('same-trader-return');
  await page.locator('#shop-sale-form button[type=submit]').click();
  await page.waitForFunction(
    () => document.querySelector('#status').textContent === 'Verkauf gebucht.',
  );
  // The stock's concrete instance owns its quote, independently of the definition's guide price.
  const unique = page
    .locator('#shop-stock article')
    .filter({ has: page.getByRole('heading', { name: /^Heiltrank ·/ }) })
    .nth(1);
  await unique.getByRole('button', { name: 'Für Borin kaufen', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('#status').textContent === 'Kauf gebucht.',
  );
  await page.locator('#shop-sale-item').selectOption({ label: '1 × Heiltrank' });
  await page.locator('#shop-sale-quantity').fill('1');
  await shot('unique-return-quote');
  assert.equal(
    await page.locator('#shop-sale-price').inputValue(),
    '0.37',
    'A concrete item uses its own shop buyback quote, not the definition guide price',
  );
  await page.locator('#shop-sale-price').fill('0.29');
  await page.locator('#shop-sale-submit').click();
  await page.waitForFunction(
    () => document.querySelector('#status').textContent === 'Verkauf gebucht.',
  );
  const history = async () => {
    await page.getByText('Handels- und Auffüllverlauf', { exact: true }).click();
    await page.locator('#shop-history').scrollIntoViewIfNeeded();
    return await page.locator('#shop-history').innerText();
  };
  const beforeClose = await history();
  assert.match(beforeClose, /Gezahlt: 5,01 GM/);
  assert.match(beforeClose, /Erlös: 0,77 GM/);
  assert.match(beforeClose, /Figur: Borin/);
  await shot('trade-history');
  await native.close();
  // Later business moves both trades beyond the first page. Only canonical explicit writers run here.
  const later = new CampaignStore(file);
  try {
    const active = later.activate(campaign.id);
    for (let i = 0; i < 55; i++) {
      const current = later.shop(active.token, sa.id).shop;
      later.executeItemShop({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: active.token,
        action: {
          kind: 'restock',
          shopId: sa.id,
          expectedRevision: current.revision,
          entryId: current.stock[0].id,
          mode: 'add',
          quantity: 1,
          reason: 'Späterer Markttag ' + i,
        },
      });
    }
    const current = later.shop(active.token, sa.id).shop;
    current.stock[0].buyCopper = '900';
    current.stock[0].sellCopper = '400';
    later.executeItemShop({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token: active.token,
      action: { kind: 'shop', shop: current, expectedRevision: current.revision },
    });
  } finally {
    later.close();
  }
  page = await launch();
  await choose();
  await page.locator('#shop-seller').selectOption(heroes[1].id);
  await page
    .locator('#shop-sale-item')
    .getByRole('option', { name: '2 × Seil', exact: true })
    .waitFor({ state: 'attached' });
  assert.match(await page.locator('#shop-stock').innerText(), /58 verfügbar/);
  const firstPage = await history();
  assert(!firstPage.includes('Gezahlt: 5,01 GM'));
  await app.evaluate(({ ipcMain }) => {
    const original = ipcMain._invokeHandlers.get('items:shop-history');
    let fail = true;
    ipcMain.removeHandler('items:shop-history');
    ipcMain.handle('items:shop-history', async (e, ...args) => {
      if (fail) {
        fail = false;
        return { ok: false, error: 'QA: Ältere Belege vorübergehend nicht lesbar' };
      }
      return original(e, ...args);
    });
  });
  await page.locator('#shop-history-more').click();
  await page.locator('#shop-history-status[role=alert]').waitFor();
  assert.equal(await page.locator('#shop-history').innerText(), firstPage);
  await shot('older-history-read-error');
  await page.locator('#shop-history-more').click();
  await page.locator('#shop-history-more').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'shop-history-status');
  const completeHistory = await page.locator('#shop-history').innerText();
  assert(completeHistory.includes(beforeClose));
  await page
    .locator('#shop-history')
    .getByText(/Kauf: 3 × Seil · Gezahlt: 5,01 GM/)
    .scrollIntoViewIfNeeded();
  await shot('fresh-history');
  await page.locator('#items-show-catalog').click();
  await page.locator('#item-search').fill('Seil');
  await page
    .locator('#items-search-form')
    .getByRole('button', { name: 'Suchen', exact: true })
    .click();
  await page
    .locator('#items-results')
    .getByRole('button', { name: /^Seil ·/ })
    .click();
  await page.waitForFunction(
    () => document.querySelector('#item-reference-title').textContent === 'Seil',
  );
  await page.locator('#item-usage > summary').click();
  assert.equal(await page.locator('#item-open-shop').innerText(), 'Shop öffnen: Hafenladen');
  assert.equal(await page.locator('#shop-add-item').isEnabled(), true);
  await page.locator('#item-open-shop').click();
  assert.equal(await page.locator('#items-shops').isVisible(), true);
  assert.equal(await page.locator('#shop-seller').inputValue(), heroes[1].id);
  await page.locator('#shop-settings > summary').click();
  assert.equal(await page.locator('#shop-name').inputValue(), sa.name);
  assert.equal(await page.locator('#shop-notes').inputValue(), sa.notes.replace(/\r\n/g, '\n'));
  await native.close();
  const check = new CampaignStore(file);
  let canonical;
  try {
    const active = check.activate(campaign.id),
      inventory = check.ledgerInventory(active.token, {
        characterId: heroes[1].id,
        after: null,
      }).items,
      bought = inventory.find((l) => l.origin === 'purchase'),
      sold = check
        .ledger(active.token, {
          characterId: heroes[1].id,
          after: null,
          search: '',
          status: 'sold',
        })
        .items.filter((l) => l.reference.definitionId === defs[0].id);
    assert.equal(bought.quantity, 2);
    assert.equal(bought.paidCopper, '334');
    assert.equal(sold.length, 1);
    assert.equal(sold[0].quantity, 1);
    assert.equal(sold[0].paidCopper, '167');
    assert.equal(sold[0].actualSaleCopper, '77');
    assert.equal(sold[0].parentId, bought.id);
    assert.equal(sold[0].counterpartyReference.shopId, sa.id);
    assert.equal(bought.counterpartyReference.shopId, sa.id);
    assert.deepEqual(check.ledgerItem(active.token, a.id), a);
    assert.deepEqual(check.ledgerItem(active.token, b.id), b);
    const saved = check.shop(active.token, sa.id);
    assert.equal(saved.shop.stock[0].quantity, 58);
    assert.equal(saved.shop.stock.find((e) => e.instanceId === uniqueInstance).quantity, 1);
    assert.deepEqual(
      saved.shop.stock.find((e) => e.instanceId === otherInstance),
      sa.stock.find((e) => e.instanceId === otherInstance),
    );
    const returned = check
      .ledger(active.token, { characterId: heroes[1].id, after: null, search: '', status: 'sold' })
      .items.find((l) => l.instanceId === uniqueInstance);
    assert.equal(returned.actualSaleCopper, '29');
    assert.equal(saved.shop.notes, sa.notes);
    assert.equal(saved.shop.stock[0].buyCopper, '900');
    assert.equal(saved.shop.stock[0].sellCopper, '400');
    assert.deepEqual(check.shop(active.token, sb.id).shop, sb);
    canonical = { inventory, sold, shop: saved };
  } finally {
    check.close();
  }
  await native.finish({
    zoom,
    fixture: { campaign, heroes, shops, items },
    canonical,
    history: beforeClose,
    complete: true,
    catalogReturnVerified: true,
    sharedContextRetryVerified: true,
    olderHistoryRetryVerified: true,
    actualPricesDifferFromQuotes: true,
    uniqueQuoteUsed: true,
  });
  console.log('COMPLETE shop purchase, same trader partial return and fresh at ' + zoom);
} catch (e) {
  await native.fail(e);
  throw e;
} finally {
  await native.dispose();
}
