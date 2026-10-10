// Actual isolated Obsidian; synthetic visible input, not physical or GM acceptance.
module.exports = ({ page, fs, path, assert, crypto, root, vault, qa, out, checks }) => {
  const fixture = path.join(root, "tests/fixtures/atlas-e2e-spatial-v2");
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture, "manifest.json"), "utf8"));
  const rows = [...manifest.input, { path: manifest.campaign.path, ...manifest.campaign.input }];
  const baselinePath = path.join(qa, "dungeon-at-location-baseline.json");
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const panel = () => page.locator(".dn-atlas:visible").last();
  const viewport = () => panel().locator(".dn-atlas-viewport");
  const button = (name) => panel().locator(".dn-atlas-toolbar").getByRole("button", { name, exact: true });
  const locationKey = () => panel().locator(".dn-location-key:not(.dn-atlas-room-key)");
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const state = () => page.evaluate(() => {
    const v = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
    const active = v.campaignHost.state;
    if (active.kind !== "active") return { kind: active.kind, reason: active.reason };
    active.assertCurrent();
    const seed = window.__hex04Identity;
    const a = "00000000-0000-4000-8000-000000000012";
    const b = "00000000-0000-4000-8000-000000000011";
    return {
      kind: active.kind, managed: v.managed, campaignId: active.context.campaignId,
      sameRepository: v.repository === seed.repository && active.repository === seed.repository,
      sameHistory: v.editor.terrain.history === seed.history && active.history === seed.history,
      sameRenderer: v.editor.renderer === seed.renderer && active.renderer === seed.renderer,
      sameCamera: v.editor.renderer.relativeCamera === seed.camera,
      sameToken: active.context.contextToken === seed.token,
      camera: v.editor.renderer.camera, depth: active.history.undoDepth,
      dirty: active.repository.dirty, draft: active.repository.hasDraft,
      pending: v.editor.pendingKey,
      world: v.editor.terrain.spatialState(), placements: v.editor.terrain.placements(),
      a: v.repository.location(a).read(), b: v.repository.location(b).read(),
      aDetails: v.campaignHost.details(a), bDetails: v.campaignHost.details(b),
      dungeon: v.repository.detail("dungeon", "00000000-0000-4000-8000-000000000030").read().document,
    };
  });
  async function current() {
    const s = await state();
    assert.equal(s.kind, "active"); assert.equal(s.managed, true); assert.equal(s.campaignId, id(1));
    for (const key of ["sameRepository", "sameHistory", "sameRenderer", "sameCamera", "sameToken"])
      assert.equal(s[key], true, key);
    return s;
  }
  async function record(name) {
    checks.push(name);
    fs.writeFileSync(path.join(out, `dungeon-at-location-${checks.length}.json`), JSON.stringify(await current(), null, 2));
  }
  async function open() {
    // Fixture entry only; every subsequent edit/navigation uses a visible control.
    await page.evaluate(async (file) => app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file)), manifest.input[0].path);
    await viewport().locator("canvas").waitFor({ state: "visible" });
    await settle();
    await page.evaluate(() => {
      const v = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
      const active = v.campaignHost.state;
      window.__hex04Identity = { repository: v.repository, history: v.editor.terrain.history,
        renderer: v.editor.renderer, camera: v.editor.renderer.relativeCamera, token: active.context.contextToken };
    });
    await current();
  }
  async function select(locationId) {
    await button("Atlasinhalt einpassen").click();
    await button("Hex auswählen").click();
    await settle();
    const s = await current(), marker = s.placements.find((p) => p.locationId === locationId);
    assert.ok(marker, "fixture Location marker");
    const b = await viewport().boundingBox();
    const x = b.x + b.width / 2 + (marker.position.x - s.camera.center.x) / s.camera.metersPerPixel;
    const y = b.y + b.height / 2 + (marker.position.y - s.camera.center.y) / s.camera.metersPerPixel;
    await page.mouse.click(x, y);
    await locationKey().waitFor({ state: "visible" });
    await page.waitForFunction((locationId) => document.querySelector(".dn-atlas:has(.dn-atlas-viewport) .dn-location-key:not(.dn-atlas-room-key)")?.dataset.locationId === locationId, locationId);
  }
  async function bind() {
    const action = panel().locator(".dn-atlas-dungeon-bindings").getByRole("button", { name: /^Hier verorten:/ });
    assert.equal(await action.count(), 1, "one existing native Dungeon candidate");
    await action.click(); await settle();
  }
  async function history(direction, depth) {
    await button(direction === "undo" ? "Atlasänderung rückgängig" : "Atlasänderung wiederholen").click();
    await page.waitForFunction((depth) => app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor.terrain.history.undoDepth === depth, depth);
    await settle();
  }
  const placement = (s) => s.world.detailPlacements.find((p) => p.id === id(202));
  const hasDungeon = (s, which) => s[which].detailMaps.some((d) => d.kind === "dungeon" && d.documentId === id(30));
  const hashes = () => Object.fromEntries(rows.map((r) => [r.path, crypto.createHash("sha256").update(fs.readFileSync(path.join(vault, r.path))).digest("hex")]));
  function sameData(actual, expected) {
    for (const key of ["world", "a", "b", "dungeon"])
      assert.deepEqual(actual[key], expected[key], key);
  }
  async function enterRoom() {
    const s = await current();
    const entry = s.bDetails.entries.find((e) => e.target.kind === "room" && e.target.recordId === id(31));
    assert.ok(entry);
    await panel().locator(".dn-atlas-detail-entry > ul").getByRole("button", { name: entry.label, exact: true }).click();
    const key = panel().locator(".dn-atlas-room-key");
    await key.waitFor({ state: "visible" });
    assert.equal(await key.getAttribute("data-room-id"), id(31));
    assert.equal(await viewport().getAttribute("data-visible-rooms"), "1");
    return key;
  }
  async function back() {
    await panel().locator(".dn-atlas-detail-entry > ul").getByRole("button", { name: "Orts-Key", exact: true }).click();
    await locationKey().waitFor({ state: "visible" }); await settle();
    assert.equal(await locationKey().getAttribute("data-location-id"), id(11));
    assert.equal(await panel().locator(".dn-atlas-room-key:visible").count(), 0);
  }
  async function edit() {
    await open();
    for (const row of rows) assert.equal(hashes()[row.path], row.sha256, row.path);
    await select(id(12));
    const initial = await current(); assert.equal(initial.depth, 0);
    await locationKey().getByRole("textbox", { name: "Ortsname", exact: true }).fill("H01 Mühle mit Dungeon");
    await locationKey().getByRole("button", { name: "Übernehmen", exact: true }).click();
    await settle(); assert.equal((await current()).depth, 1);
    await bind();
    const atA = await current(); assert.equal(atA.depth, 2);
    assert.deepEqual(placement(atA).parent, { kind: "location", locationId: id(12) });
    assert.equal(hasDungeon(atA, "a"), true);
    await record("Visible Location Key and existing Dungeon binding use the confirmed Campaign mount");
    await select(id(11)); await bind();
    const atB = await current(); assert.equal(atB.depth, 3);
    assert.deepEqual(placement(atB).parent, { kind: "location", locationId: id(11) });
    assert.equal(hasDungeon(atB, "a"), false); assert.equal(hasDungeon(atB, "b"), true);
    assert.equal(atB.aDetails.entries.some((e) => e.target.documentId === id(30)), false);
    assert.deepEqual(atB.b.detailMaps.filter((d) => d.kind === "city"), initial.b.detailMaps.filter((d) => d.kind === "city"));
    await history("undo", 2); sameData(await current(), atA);
    await history("redo", 3); sameData(await current(), atB);
    // Binding retains the original identity, entrance and local geometry.
    assert.deepEqual(placement(atB), { ...placement(initial),
      parent: { kind: "location", locationId: id(11) },
      anchor: { ...placement(initial).anchor, parentPointMeters: { x: 0, y: 0 } } });
    assert.deepEqual(atB.dungeon, initial.dungeon);
    await record("Visible A to B move removes the old link; shared Undo/Redo restores both Locations and placement");
    const key = await enterRoom();
    const roomName = "Torraum am Ort", roomText = initial.dungeon.entities[0].key.sections[0].markdown + "\nH01: Am Ort verortet.\n";
    await key.getByRole("textbox", { name: "Raumname", exact: true }).fill(roomName);
    await key.getByRole("textbox", { name: "Raumtext 1", exact: true }).fill(roomText);
    await key.getByRole("button", { name: "Übernehmen", exact: true }).click();
    await settle();
    const edited = await current(); assert.equal(edited.depth, 4);
    const expectedDungeon = structuredClone(initial.dungeon);
    expectedDungeon.entities[0].name = roomName;
    expectedDungeon.entities[0].key.sections[0].markdown = roomText;
    assert.deepEqual(edited.dungeon, expectedDungeon);
    await page.screenshot({ path: path.join(out, "dungeon-at-location-room-key.png") });
    await back();
    const savedCamera = (await current()).camera;
    for (let depth = 3; depth >= 0; depth--) await history("undo", depth);
    sameData(await current(), initial);
    for (let depth = 1; depth <= 4; depth++) await history("redo", depth);
    sameData(await current(), edited);
    assert.deepEqual((await current()).camera, savedCamera);
    await record("Visible room Key, return and all four Undo/Redo actions preserve one camera/history and native IDs/geometry");
    await button("Atlas speichern").click();
    await page.waitForFunction(() => {
      const v = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
      return !v.repository.dirty && !v.repository.hasDraft && !v.editor.pendingKey;
    });
    const saved = await current(); sameData(saved, edited); assert.equal(saved.depth, 4);
    assert.deepEqual(saved.camera, savedCamera);
    const bytes = hashes();
    for (const row of manifest.input.filter((r) => r.path.endsWith(".city") || r.path.includes("/terrain/")))
      assert.equal(bytes[row.path], row.sha256, "unrelated native bytes: " + row.path);
    assert.equal(fs.existsSync(path.join(vault, manifest.input[0].path + ".journal")), false);
    fs.writeFileSync(baselinePath, JSON.stringify({ state: saved, hashes: bytes, roomName, roomText }, null, 2));
    await page.screenshot({ path: path.join(out, "dungeon-at-location-saved.png") });
    await record("Actual native Save preserves unrelated City/terrain bytes, IDs and geometry and removes its journal");
  }
  async function reopen() {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    assert.deepEqual(hashes(), baseline.hashes);
    await open();
    const fresh = await current(); sameData(fresh, baseline.state);
    assert.equal(fresh.depth, 0); assert.equal(fresh.dirty, false); assert.equal(fresh.draft, false);
    await select(id(12));
    assert.equal(await locationKey().getByRole("textbox", { name: "Ortsname", exact: true }).inputValue(), "H01 Mühle mit Dungeon");
    assert.equal((await current()).aDetails.entries.some((e) => e.target.documentId === id(30)), false);
    await select(id(11)); const key = await enterRoom();
    assert.equal(await key.getByRole("textbox", { name: "Raumname", exact: true }).inputValue(), baseline.roomName);
    assert.equal(await key.getByRole("textbox", { name: "Raumtext 1", exact: true }).inputValue(), baseline.roomText);
    await page.screenshot({ path: path.join(out, "dungeon-at-location-fresh-room-key.png") });
    await back();
    assert.deepEqual(hashes(), baseline.hashes);
    await record("Separate fresh Obsidian process reopens exact native saved bytes and the visible Location/room path");
  }
  return { edit, reopen };
};
