// Isolated actual Obsidian/GPU proof with synthetic visible input, not physical GM acceptance.
module.exports = ({ page, fs, path, assert, crypto, root, vault, qa, out, checks }) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/atlas-e2e-spatial-v2/manifest.json')));
  const rows = [...manifest.input, { path: manifest.campaign.path, ...manifest.campaign.input }];
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const baseline = path.join(qa, 'city-building-rotation-baseline.json');
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
    const original = window.__cityRotationIdentity;
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
    fs.writeFileSync(path.join(out, `city-rotation-${checks.length}.json`), JSON.stringify(await current(), null, 2));
  }
  async function open() {
    // Fixture entry/navigation only. All subsequent edits and selection use visible controls.
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file)), manifest.input[0].path);
    await viewport().locator('canvas').waitFor({ state: 'visible' });
    await page.evaluate(async cityId => {
      const v = app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view;
      await v.campaignHost.navigate({ kind: 'city', documentId: cityId, recordId: cityId, roomId: null });
      const a = v.campaignHost.state;
      window.__cityRotationIdentity = { history: a.history, repository: a.repository, renderer: a.renderer, token: a.context.contextToken };
    }, id(100));
    await settle();
  }
  async function selectHouse() {
    await toolbar('Hex auswählen').click(); await settle();
    // At city entry's 1m/px the existing Location marker overlaps the small house.
    // Zoom using the same visible input as a user, then pick outside its pixel grip.
    for (let n = 0; n < 20; n++) {
      const camera = (await current()).camera;
      if (Math.abs(Math.log(camera.metersPerPixel / 0.1)) < 1e-8) break;
      const bounds = await viewport().boundingBox();
      await viewport().dispatchEvent('wheel', { clientX: bounds.x + bounds.width / 2,
        clientY: bounds.y + bounds.height / 2, ctrlKey: true,
        deltaY: Math.max(-500, Math.min(500, Math.log(0.1 / camera.metersPerPixel) / 0.002)),
        bubbles: true, cancelable: true });
      await settle();
    }
    const s = await current(), b = await viewport().boundingBox();
    assert(Math.abs(s.camera.metersPerPixel - 0.1) < 1e-8, 'visible zoom reached house scale');
    // Fixture house B local (1,1) is outer rim, outside its courtyard.
    const house = s.city.buildings.find(h => h.id === id(106));
    const c = Math.cos(house.rotationRadians), sin = Math.sin(house.rotationRadians);
    const point = { x: house.position.x + house.scale.x*c - house.scale.y*sin,
      y: house.position.y + house.scale.x*sin + house.scale.y*c };
    // Do not pin or replace SpatialCanvas.hit: actual GPU scene/picking and pointer router run.
    await page.mouse.click(b.x + b.width / 2 + (point.x - s.camera.center.x) / s.camera.metersPerPixel,
      b.y + b.height / 2 + (point.y - s.camera.center.y) / s.camera.metersPerPixel);
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
  const rotate = right => inspector().getByRole('button', { name: right ? '90° rechts drehen' : '90° links drehen', exact: true });
  async function edit() {
    for (const row of rows) assert.equal(hashes()[row.path], row.sha256, row.path);
    await open(); await selectHouse();
    const initial = await current(), expected = structuredClone(initial.city);
    const turned = expected.buildings.find(b => b.id === id(106));
    // Independent known-fixture oracle: the 8x8 courtyard rotates about (10,12),
    // so its corner anchor becomes (14,8) while world bounds remain unchanged.
    assert.deepEqual(turned.position, { x: 6, y: 8 });
    turned.position = { x: 14, y: 8 };
    turned.rotationRadians += Math.PI / 2;
    assert.equal(initial.depth, 0);
    await page.screenshot({ path: path.join(out, 'city-rotation-before.png') });
    await input().fill('Pending house name');
    await rotate(true).click(); await settle();
    assert.deepEqual((await current()).city, initial.city);
    assert.equal((await current()).depth, 0);
    assert.equal(await input().inputValue(), 'Pending house name');
    assert.match(await inspector().textContent(), /Hausname zuerst übernehmen oder verwerfen/);
    for (const row of rows) assert.equal(hashes()[row.path], row.sha256, row.path);
    await inspector().getByRole('button', { name: 'Namenseingabe verwerfen', exact: true }).click();
    await rotate(true).click(); await settle();
    assert.deepEqual((await current()).city, expected);
    assert.equal((await current()).depth, 1);
    assert.deepEqual((await current()).camera, initial.camera);
    await page.screenshot({ path: path.join(out, 'city-rotation-right.png') });
    await rotate(false).click(); await settle();
    assert.deepEqual((await current()).city, initial.city);
    assert.equal((await current()).depth, 2);
    await rotate(true).click(); await settle();
    await history(true, 2); assert.deepEqual((await current()).city, initial.city);
    await history(false, 3); assert.deepEqual((await current()).city, expected);
    await record('Visible quarter-turn controls use one shared step each; pending name blocks without publication; UndoRedo preserves exact document/camera');
    await toolbar('Atlas speichern').click();
    await page.waitForFunction(() => {
      const v = app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view;
      return !v.repository.dirty && !v.repository.hasDraft && !v.editor.pendingKey;
    });
    const saved = await current(), bytes = hashes(), cityPath = `Städte/${id(100)}.city`;
    assert.deepEqual(saved.city, expected); assert.equal(saved.depth, 3);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(vault, cityPath))), expected);
    for (const row of manifest.input) if (row.path !== cityPath) assert.equal(bytes[row.path], row.sha256, row.path);
    fs.writeFileSync(baseline, JSON.stringify({ city: expected, hashes: bytes }, null, 2));
    await page.screenshot({ path: path.join(out, 'city-rotation-saved.png') });
    await record('Native Save retains full rotated house/courtyard document and every foreign fixture byte');
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(baseline)); assert.deepEqual(hashes(), saved.hashes);
    await open(); await selectHouse();
    const fresh = await current();
    assert.equal(fresh.depth, 0); assert.equal(fresh.dirty, false); assert.equal(fresh.draft, false);
    assert.deepEqual(fresh.city, saved.city); assert.deepEqual(hashes(), saved.hashes);
    await page.screenshot({ path: path.join(out, 'city-rotation-fresh.png') });
    await record('Separate fresh Obsidian process displays and picks the saved rotated courtyard house with exact native document');
  }
  return { edit, reopen };
};
