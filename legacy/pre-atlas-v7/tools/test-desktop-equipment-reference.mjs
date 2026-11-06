// Complete read-only GM task; only the existing campaign is a fixture.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createNativeSession } from './native-session.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json'),
  output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/equipment-reference');
await mkdir(output, { recursive: true });
await rm(output + '/result.json', { force: true });
require('esbuild').buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/equipment-reference-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = require(root + '/.build/equipment-reference-store.cjs'),
  results = [];
for (const variant of [1, 2]) {
  const scale = 1;
  const native = await createNativeSession({
      root,
      output: output + '/variant-' + variant,
      name: 'gm-equipment-reference',
    }),
    store = new CampaignStore(native.profile + '/workbench.sqlite'),
    campaign = store.create('Stadtwache – Ausrüstungswahl');
  store.tutorial('skipped');
  store.close();
  async function open() {
    const page = await native.launch(scale);
    if (variant === 2)
      await native.app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.setMinimumSize(320, 240);
        w.setContentSize(640, 800);
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
    if (
      !(await page.locator('#catalog-tab').isVisible()) &&
      (await page.locator('#atlas-navigation').isVisible())
    )
      await page.locator('#atlas-navigation').click();
    if (!(await page.locator('#catalog-tab').isVisible()))
      await page.locator('#workspace-nav-summary').click();
    await page.locator('#catalog-tab').click();
    await page.locator('#catalog-items-tab').click();
    await settled(page);
    return page;
  }
  async function settled(page) {
    await page.waitForFunction(
      () =>
        document.getElementById('item-reference-table').getAttribute('aria-busy') === 'false' &&
        document.getElementById('item-reference-rows').children.length > 0,
    );
  }
  async function submit(page) {
    await page.locator('#item-reference-form button[type=submit]').click();
    await settled(page);
  }
  async function choose(page, name) {
    await page.locator('#item-reference-rows').getByRole('button', { name, exact: true }).click();
    return page.locator('#item-reference-detail');
  }
  async function reset(page) {
    await page.locator('#item-reference-form button[type=button]').click();
    await settled(page);
  }
  async function weapons(page) {
    await page
      .locator('#item-reference-subcategory')
      .selectOption({ label: 'Fernkampf · Kriegswaffen' });
    await page.locator('#item-reference-maximum').fill('59');
    await submit(page);
  }
  const facts = {};
  try {
    let page = await open();
    assert.equal(
      await page.locator('#item-reference-credit summary').innerText(),
      'Lokale SRD-Quelle · unvollständig',
    );
    await page.locator('#item-reference-credit summary').click();
    assert.match(
      await page.locator('#item-reference-credit p').innerText(),
      /Weitere magische Gegenstände fehlen/,
    );
    assert.match(await page.locator('#item-reference-credit p').innerText(), /CC-BY-4.0/);
    await page.locator('#item-reference-credit summary').click();
    assert.equal(await page.locator('#item-reference-extra').getAttribute('open'), null);
    assert.equal(
      await page
        .locator('#item-reference-form input:visible, #item-reference-form select:visible')
        .count(),
      4,
    );
    await weapons(page);
    assert.equal(await page.locator('#item-reference-rows tr').count(), 4);
    await native.capture(page, 'candidates');
    for (const [name, damage, weight, range] of [
      ['Longbow', '1d8', '2 lb.', '150/600'],
      ['Crossbow, heavy', '1d10', '18 lb.', '100/400'],
    ]) {
      const detail = await choose(page, name);
      facts[name] = await detail.innerText();
      assert.match(facts[name], /50 gp/);
      assert(
        facts[name].includes(damage) &&
          facts[name].includes(weight) &&
          facts[name].includes('range ' + range),
      );
      assert.match(facts[name], /Heavy/);
      assert.match(facts[name], /Two-handed/);
      assert.equal(facts[name].includes('Loading'), name === 'Crossbow, heavy');
      assert.match(facts[name], /SRD 5.1 · PDF-Seiten 66/);
      assert.deepEqual(await detail.locator('dt').allTextContents(), [
        'Kategorie',
        'Preis',
        'Gewicht',
        'Schadenswürfel',
        'Schadenstyp',
      ]);
      await native.capture(page, name === 'Longbow' ? 'longbow' : 'heavy-crossbow');
      await native.capture(
        page,
        name === 'Longbow' ? 'longbow-source' : 'heavy-crossbow-source',
        '#item-reference-detail h5',
      );
      if (variant === 2) {
        await page.locator('#item-reference-results-return').click();
        assert.equal(await page.locator('#item-reference-maximum').inputValue(), '59');
        assert.equal(
          await page.locator('#item-reference-rows button[aria-pressed=true]').innerText(),
          name,
        );
      }
    }
    await reset(page);
    await page.locator('#item-reference-category').selectOption({ label: 'Ausrüstung' });
    await page.locator('#item-reference-subcategory').selectOption({ label: 'Munition' });
    await page.locator('#item-reference-maximum').fill('1');
    await submit(page);
    for (const [name, weight] of [
      ['Arrows (20)', '1 lb.'],
      ['Crossbow bolts (20)', '1½ lb.'],
    ]) {
      const detail = await choose(page, name);
      facts[name] = await detail.innerText();
      assert(facts[name].includes('1 gp') && facts[name].includes(weight));
      assert.match(facts[name], /PDF-Seiten 69/);
      await native.capture(page, name.startsWith('Arrows') ? 'arrows' : 'bolts');
      if (variant === 2) await page.locator('#item-reference-results-return').click();
    }
    const before = await page.locator('#item-reference-detail').innerText();
    await page.locator('#catalog-monsters-tab').click();
    await page.locator('#catalog-items-tab').click();
    assert.equal(await page.locator('#item-reference-detail').innerText(), before);
    assert.equal(await page.locator('#item-reference-subcategory').inputValue(), 'ammunition');
    assert.equal(await page.locator('#item-reference-maximum').inputValue(), '1');
    await native.capture(page, 'returned');
    // Less frequent filters stay discoverable, visible as constraints and effective when collapsed.
    await reset(page);
    await page.locator('#item-reference-extra summary').click();
    await page.locator('#item-reference-name').fill('Ring of Protection');
    await page.locator('#item-reference-rarity').selectOption('rare');
    await page.locator('#item-reference-magic').selectOption('yes');
    await page.locator('#item-reference-attunement').selectOption('required');
    await submit(page);
    await page.locator('#item-reference-extra summary').click();
    assert.equal(
      await page.locator('#item-reference-extra summary').innerText(),
      'Weitere Filter · 3 aktiv',
    );
    const magic = await choose(page, 'Ring of Protection');
    assert.match(await magic.innerText(), /Erforderlich/);
    assert.match(await magic.innerText(), /Selten/);
    assert.match(await magic.innerText(), /Nicht angegeben/);
    await native.capture(page, 'active-extra-filters');
    await page.locator('#catalog-monsters-tab').click();
    await page.locator('#catalog-items-tab').click();
    assert.equal(
      await page.locator('#item-reference-extra summary').innerText(),
      'Weitere Filter · 3 aktiv',
    );
    await reset(page);
    assert.equal(await page.locator('#item-reference-extra summary').innerText(), 'Weitere Filter');
    await native.close();
    page = await open();
    await weapons(page);
    const fresh = await choose(page, 'Longbow');
    assert.equal(await fresh.innerText(), facts.Longbow);
    await native.capture(page, 'fresh-reference');
    await native.close();
    await native.finish({
      complete: true,
      lookup: facts,
      budgetGold: 120,
      setCostGold: 102,
      bowSetsWeightLb: 6,
      crossbowSetsWeightLb: 39,
    });
    results.push(
      JSON.parse(await readFile(output + '/variant-' + variant + '/result.json', 'utf8')),
    );
  } catch (error) {
    await native.fail(error);
    throw error;
  } finally {
    await native.dispose();
  }
}
assert(
  results.every(
    (r) =>
      r.source === results[0].source &&
      JSON.stringify(r.artifacts) === JSON.stringify(results[0].artifacts),
  ),
  'Both scales must use the same application build',
);
await writeFile(output + '/result.json', JSON.stringify({ complete: true, results }, null, 2));
console.log(
  JSON.stringify({ complete: true, output, scales: results.map((r) => r.launches[0].zoom) }),
);
