// Isolated actual Obsidian/GPU proof with synthetic visible input, not physical GM acceptance.
module.exports = ({ page, fs, path, assert, crypto, root, vault, qa, out, checks }) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/atlas-e2e-spatial-v2/manifest.json')));
  const rows = [...manifest.input, { path: manifest.campaign.path, ...manifest.campaign.input }];
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const baseline = path.join(qa, 'city-building-name-baseline.json');
  const panel = () => page.locator('.dn-atlas:visible').last();
  const viewport = () => panel().locator('.dn-atlas-viewport');
  const inspector = () => panel().locator('.dn-atlas-city-building');
  const input = () => inspector().getByRole('textbox', { name: 'Gebäudename', exact: true });
  const toolbar = name => panel().locator('.dn-atlas-toolbar').getByRole('button', { name, exact: true });
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const hashes = () => Object.fromEntries(rows.map(r => [r.path, crypto.createHash('sha256').update(fs.readFileSync(path.join(vault, r.path))).digest('hex')]));
  const state = () => page.evaluate(() => {
    const v = app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view, a = v.campaignHost.state;
    if (a.kind !== 'active') throw new Error('Managed campaign inactive');
    a.assertCurrent();
    const original = window.__cityNameIdentity;
    return { city: a.repository.detail('city', '00000000-0000-4000-8000-000000000100').read(),
      camera: v.editor.renderer.camera, depth: a.history.undoDepth, pending: v.editor.pendingKey,
      dirty: a.repository.dirty, draft: a.repository.hasDraft,
      sameHistory: a.history === original.history, sameRepository: a.repository === original.repository,
      sameCamera: v.editor.renderer === original.renderer, sameToken: a.context.contextToken === original.token };
  });
  async function current() {
    const s = await state();
    for (const k of ['sameHistory', 'sameRepository', 'sameCamera', 'sameToken']) assert.equal(s[k], true, k);
    return s;
  }
  async function record(text) {
    checks.push(text);
    fs.writeFileSync(path.join(out, `city-name-${checks.length}.json`), JSON.stringify(await current(), null, 2));
  }
  async function open() {
    // Fixture entry/navigation only. All subsequent edits and selection use visible controls.
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file)), manifest.input[0].path);
    await viewport().locator('canvas').waitFor({ state: 'visible' });
    await page.evaluate(async cityId => {
      const v = app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view;
      await v.campaignHost.navigate({ kind: 'city', documentId: cityId, recordId: cityId, roomId: null });
      const a = v.campaignHost.state;
      window.__cityNameIdentity = { history: a.history, repository: a.repository, renderer: a.renderer, token: a.context.contextToken };
    }, id(100));
    await settle();
  }
  async function selectHouse() {
    await toolbar('Hex auswählen').click(); await settle();
    const s = await current(), b = await viewport().boundingBox();
    // Fixture house B: unrotated 8m square, (7,9) lies in its outer rim, outside its courtyard.
    // Do not pin or replace SpatialCanvas.hit: actual GPU scene/picking and pointer router run.
    await page.mouse.click(b.x + b.width / 2 + (7 - s.camera.center.x) / s.camera.metersPerPixel,
      b.y + b.height / 2 + (9 - s.camera.center.y) / s.camera.metersPerPixel);
    await inspector().waitFor({ state: 'visible' });
    assert.equal(await inspector().getAttribute('data-building-id'), id(106));
    assert.equal(await panel().locator('.dn-atlas-body > aside').count(), 1);
    await settle();
  }
  async function history(undo, depth) {
    await toolbar(undo ? 'Atlasänderung rückgängig' : 'Atlasänderung wiederholen').click();
    await page.waitForFunction(depth => app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view.editor.terrain.history.undoDepth === depth, depth);
    await settle();
  }
  async function edit() {
    for (const row of rows) assert.equal(hashes()[row.path], row.sha256, row.path);
    await open(); await selectHouse();
    const initial = await current(), name = '  日本語\n[[Hafenhaus]]\t  ';
    assert.equal(initial.depth, 0);
    await input().fill('x'.repeat(201)); await input().press('Escape'); await settle();
    const invalid = await current();
    assert.equal(await inspector().isVisible(), true); assert.equal(await input().inputValue(), 'x'.repeat(201));
    assert.equal(invalid.pending, true); assert.equal(invalid.depth, 0); assert.deepEqual(invalid.city, initial.city);
    await record('Actual house picking and invalid input Escape preserve visible draft without History mutation');
    await input().fill(name); await input().press('Escape');
    await panel().locator('.dn-atlas-location-dock').waitFor({ state: 'hidden' });
    const edited = await current(), expected = structuredClone(initial.city);
    expected.buildings.find(b => b.id === id(106)).name = name;
    assert.deepEqual(edited.city, expected); assert.equal(edited.depth, 1); assert.equal(edited.pending, false);
    assert.deepEqual(edited.camera, initial.camera);
    await history(true, 0); assert.deepEqual((await current()).city, initial.city);
    await history(false, 1); assert.deepEqual((await current()).city, expected);
    await selectHouse(); assert.equal(await input().inputValue(), name);
    await panel().getByRole('button', { name: 'Key-Inspector schließen', exact: true }).click();
    await panel().locator('.dn-atlas-location-dock').waitFor({ state: 'hidden' });
    await record('Valid exact text Escape, shared UndoRedo and cached house return retain IDs/geometry/camera');
    await toolbar('Atlas speichern').click();
    await page.waitForFunction(() => {
      const v = app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view;
      return !v.repository.dirty && !v.repository.hasDraft && !v.editor.pendingKey;
    });
    const saved = await current(), bytes = hashes(), cityPath = `Städte/${id(100)}.city`;
    assert.deepEqual(saved.city, expected); assert.equal(saved.depth, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(vault, cityPath))), expected);
    for (const row of manifest.input) if (row.path !== cityPath) assert.equal(bytes[row.path], row.sha256, row.path);
    assert.equal(fs.existsSync(path.join(vault, manifest.input[0].path + '.journal')), false);
    assert.equal(fs.existsSync(path.join(vault, manifest.input[0].path + '.draft')), false);
    fs.writeFileSync(baseline, JSON.stringify({ city: expected, name, hashes: bytes }, null, 2));
    await page.screenshot({ path: path.join(out, 'city-name-saved.png') });
    await record('Native Save writes exact City data, preserves foreign fixture bytes and removes own draft/journal');
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(baseline)); assert.deepEqual(hashes(), saved.hashes);
    await open(); await selectHouse();
    const fresh = await current();
    assert.equal(fresh.depth, 0); assert.equal(fresh.dirty, false); assert.equal(fresh.draft, false);
    assert.deepEqual(fresh.city, saved.city); assert.equal(await input().inputValue(), saved.name);
    assert.deepEqual(hashes(), saved.hashes);
    await page.screenshot({ path: path.join(out, 'city-name-fresh.png') });
    await record('Separate fresh Obsidian process retains saved exact name and all native City geometry through visible picking');
  }
  return { edit, reopen };
};
