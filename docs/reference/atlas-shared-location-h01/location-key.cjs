// Bounded #40 native Shared probe. UI writes only; synthetic input, never physical acceptance.
module.exports = ({ page, fs, path, assert, crypto, root, qa, vault, out, checks }) => {
  const fixture = path.join(root, 'tests/fixtures/atlas-e2e-spatial-v2');
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture, 'manifest.json'), 'utf8'));
  const expectedPath = path.join(qa, 'location-key-saved-oracle.json');
  const panel = () => page.locator('.dn-atlas:visible').last();
  const viewport = () => panel().locator('.dn-atlas-viewport');
  const key = () => panel().locator('.dn-location-key:not(.dn-atlas-room-key):visible');
  const button = (name) => panel().locator('.dn-atlas-toolbar').getByRole('button', { name, exact: true });
  const name = 'Ödhafen 🐉 – Shared';
  const markdown = '# Hafen\n\n**日本語**  \n[[Chronik]]\n';
  const note = '  Wörtliche Notiz\n\tEnde\n';
  const bytes = (file) => fs.readFileSync(path.join(vault, file), 'utf8');
  const settle = async () => {
    await page.evaluate(async () => {
      await app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view.editor.flush();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
  };
  async function state() {
    return page.evaluate(() => {
      const v = app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view;
      const s = v.campaignHost.state;
      if (s.kind !== 'active') return { kind: s.kind, reason: s.reason };
      s.assertCurrent();
      const initial = window.__hexSharedLocation;
      return { kind: s.kind, managed: v.managed, worldId: v.editor.terrain.world.id,
        campaignId: s.context.campaignId, generation: s.generation,
        repositoryMatches: s.repository === v.repository,
        historyMatches: s.history === v.editor.terrain.history,
        rendererMatches: s.renderer === v.editor.renderer,
        sameRepository: initial.repository === v.repository,
        sameHistory: initial.history === v.editor.terrain.history,
        sameRenderer: initial.renderer === v.editor.renderer,
        placements: v.editor.terrain.placements(), cells: v.editor.terrain.cells(),
        location: v.editor.selectedLocation ? v.repository.location(v.editor.selectedLocation).read() : null,
        depth: s.history.undoDepth, dirty: s.repository.dirty, draft: s.repository.hasDraft,
        pending: v.editor.pendingKey, camera: v.editor.renderer.camera,
        canvasCount: v.contentEl.querySelectorAll('.dn-atlas-viewport canvas').length,
        status: v.contentEl.querySelector('.dn-atlas-status')?.textContent };
    });
  }
  async function record(label, picture) {
    const s = await state();
    fs.writeFileSync(path.join(out, label + '.json'), JSON.stringify(s, null, 2));
    if (picture) await page.screenshot({ path: path.join(out, label + '.png') });
    assert.equal(s.kind, 'active'); assert.equal(s.managed, true); assert.equal(s.canvasCount, 1);
    for (const k of ['repositoryMatches', 'historyMatches', 'rendererMatches', 'sameRepository', 'sameHistory', 'sameRenderer'])
      assert.equal(s[k], true, k);
    return s;
  }
  async function open() {
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file)), manifest.input[0].path);
    await viewport().locator('canvas').waitFor({ state: 'visible' });
    await settle();
    await page.evaluate(() => {
      const v = app.workspace.getLeavesOfType('dungeon-native-atlas').at(-1).view;
      window.__hexSharedLocation = { repository: v.repository, history: v.editor.terrain.history, renderer: v.editor.renderer };
    });
  }
  async function screen(position) {
    const s = await state(), b = await viewport().boundingBox();
    return { x: b.x + b.width / 2 + (position.x - s.camera.center.x) / s.camera.metersPerPixel,
      y: b.y + b.height / 2 + (position.y - s.camera.center.y) / s.camera.metersPerPixel };
  }
  async function select(id) {
    await button('Hex auswählen').click();
    const p = (await state()).placements.find(p => p.locationId === id);
    const s = await screen(p.position); await page.mouse.click(s.x, s.y); await settle();
    assert.equal(await key().getAttribute('data-location-id'), id);
  }
  async function history(action, depth) {
    await button(action === 'undo' ? 'Atlasänderung rückgängig' : 'Atlasänderung wiederholen').click();
    await settle(); assert.equal((await state()).depth, depth);
  }
  async function edit() {
    await open(); const initial = await record('01-initial', true);
    assert.equal(initial.depth, 0);
    for (const row of [...manifest.input, { path: manifest.campaign.path, ...manifest.campaign.input }])
      assert.equal(bytes(row.path), fs.readFileSync(path.join(fixture, row.fixtureFile), 'utf8'));
    // Pan with real middle-mouse input so the new marker is clear of seeded locations.
    const b = await viewport().boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(b.x + b.width / 2 - 140, b.y + b.height / 2 - 90, { steps: 5 });
    await page.mouse.up({ button: 'middle' }); await settle();
    await button('POI in Kartenmitte anlegen').click(); await settle();
    await key().waitFor({ state: 'visible' });
    const id = await key().getAttribute('data-location-id');
    const created = await record('02-created', true);
    assert.equal(created.placements.length, initial.placements.length + 1); assert.equal(created.depth, 1);
    assert.equal(created.location.id, id); assert.equal(created.location.type, 'poi');
    await history('undo', 0); assert.deepEqual((await state()).placements, initial.placements);
    await history('redo', 1); await select(id);
    assert.deepEqual((await state()).location, created.location);
    checks.push('Actual POI toolbar creates a selected Location; common Undo/Redo removes/restores its same ID and Key');
    await key().getByRole('textbox', { name: 'Ortsname', exact: true }).fill(name);
    await key().getByRole('textbox', { name: 'Abschnitt 1: Markdown', exact: true }).fill(markdown);
    await key().getByRole('textbox', { name: 'Abschnitt 2: Markdown', exact: true }).fill(note);
    await key().getByRole('button', { name: 'Übernehmen', exact: true }).click(); await settle();
    const edited = await record('03-key-edited', true); assert.equal(edited.depth, 2);
    assert.equal(edited.location.name, name); assert.equal(edited.location.sections[0].markdown, markdown);
    assert.equal(edited.location.sections[1].markdown, note);
    assert.deepEqual(edited.location.sections.map(s => s.id), created.location.sections.map(s => s.id));
    await history('undo', 1); assert.deepEqual((await state()).location, created.location);
    await history('redo', 2); assert.deepEqual((await state()).location, edited.location);
    const beforeMove = await state(), placement = beforeMove.placements.find(p => p.locationId === id);
    const p = await screen(placement.position);
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x + 100, p.y + 65, { steps: 5 }); await page.mouse.up(); await settle();
    const moved = await record('04-marker-moved', true); assert.equal(moved.depth, 3);
    const after = moved.placements.find(p => p.locationId === id);
    assert(Math.abs(after.position.x - placement.position.x - 100 * beforeMove.camera.metersPerPixel) < 1);
    assert(Math.abs(after.position.y - placement.position.y - 65 * beforeMove.camera.metersPerPixel) < 1);
    assert.deepEqual(moved.location, edited.location); assert.deepEqual(moved.camera, beforeMove.camera);
    await history('undo', 2); assert.deepEqual((await state()).placements, beforeMove.placements);
    await history('redo', 3); assert.deepEqual((await state()).placements, moved.placements);
    checks.push('Actual Key fields preserve text and section IDs; actual pointer move and both edits share Undo/Redo, one camera and one History');
    // Editing only Location content/placement preserves every seeded foreign native file.
    for (const row of manifest.input) assert.equal(bytes(row.path), fs.readFileSync(path.join(fixture, row.fixtureFile), 'utf8'));
    await button('Atlas speichern').click(); await settle();
    const saved = await record('05-saved', true);
    assert.equal(saved.dirty, false); assert.equal(saved.draft, false); assert.equal(saved.pending, false);
    assert.equal(saved.depth, 3); assert.deepEqual(saved.camera, moved.camera);
    const world = JSON.parse(bytes(manifest.input[0].path));
    const locationPath = 'Orte/' + id + '.location';
    assert.deepEqual(world.placements, moved.placements);
    assert.deepEqual(JSON.parse(bytes(locationPath)), moved.location);
    for (const row of manifest.input.slice(1))
      assert.equal(bytes(row.path), fs.readFileSync(path.join(fixture, row.fixtureFile), 'utf8'), row.path);
    assert.equal(fs.existsSync(path.join(vault, manifest.input[0].path + '.journal')), false);
    const files = Object.fromEntries([...manifest.input.map(r => r.path), manifest.campaign.path, locationPath].map(p => [p, bytes(p)]));
    const expected = { id, location: moved.location, placements: moved.placements, worldId: world.id, files };
    fs.writeFileSync(expectedPath, JSON.stringify(expected, null, 2));
    fs.writeFileSync(path.join(out, 'saved-file-oracle.json'), JSON.stringify(expected, null, 2));
    checks.push('Actual Campaign Save writes new Location and its moved placement; all foreign native bytes retained and journal removed');
  }
  async function reopen() {
    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
    for (const [p, text] of Object.entries(expected.files)) assert.equal(bytes(p), text, p);
    await open(); const fresh = await record('06-fresh-process', true);
    assert.equal(fresh.worldId, expected.worldId); assert.equal(fresh.depth, 0);
    assert.equal(fresh.dirty, false); assert.equal(fresh.draft, false);
    assert.deepEqual(fresh.placements, expected.placements);
    await button('Atlasinhalt einpassen').click(); await settle(); await select(expected.id);
    const reopened = await record('07-fresh-location-key', true);
    assert.deepEqual(reopened.location, expected.location);
    assert.equal(await key().getByRole('textbox', { name: 'Ortsname', exact: true }).inputValue(), name);
    assert.equal(await key().getByRole('textbox', { name: 'Abschnitt 1: Markdown', exact: true }).inputValue(), markdown);
    assert.equal(await key().getByRole('textbox', { name: 'Abschnitt 2: Markdown', exact: true }).inputValue(), note);
    for (const [p, text] of Object.entries(expected.files)) assert.equal(bytes(p), text, p);
    checks.push('Fresh actual Obsidian process reopens saved same Atlas/Location/placement/section IDs and exact Key text on one canvas');
  }
  return { edit, reopen };
};
