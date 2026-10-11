// Actual isolated Obsidian; synthetic visible input, not physical or GM acceptance.
module.exports = ({ page, fs, path, assert, crypto, root, vault, qa, out, checks }) => {
  const fixture = path.join(root, "tests/fixtures/atlas-e2e-spatial-v2");
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture, "manifest.json"), "utf8"));
  const rows = [...manifest.input, { path: manifest.campaign.path, ...manifest.campaign.input }];
  const baselinePath = path.join(qa, "dungeon-at-location-baseline.json");
  const inspectorN02 = process.argv.includes("--hex04-inspector-n02");
  const inspectorBaselinePath = path.join(qa, "inspector-n02-baseline.json");
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
    for (const key of ["sameRepository", "sameHistory", "sameRenderer", "sameToken"])
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
        renderer: v.editor.renderer, token: active.context.contextToken };
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
  async function inspectorLayout(name) {
    const layout = await panel().evaluate((host) => {
      const rect = (element) => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const visible = (selector) => [...host.querySelectorAll(selector)]
        .filter((element) => !element.hidden && element.getClientRects().length > 0).length;
      return {
        innerWidth, innerHeight,
        viewport: rect(host.querySelector(".dn-atlas-viewport")),
        inspector: rect(host.querySelector(".dn-atlas-location-dock")),
        docks: visible(".dn-atlas-location-dock"),
        locationKeys: visible(".dn-location-key:not(.dn-atlas-room-key)"),
        roomKeys: visible(".dn-atlas-room-key"),
      };
    });
    assert.equal(layout.innerWidth, 1024);
    assert.equal(layout.innerHeight, 800);
    assert.equal(layout.docks, 1, "one visible common Inspector");
    assert.ok(layout.viewport.width >= 200, "usable narrow map beside the Inspector");
    assert.equal(layout.locationKeys + layout.roomKeys, 1, "one active Key panel");
    fs.writeFileSync(path.join(out, `inspector-n02-${name}-layout.json`), JSON.stringify(layout, null, 2));
    await page.screenshot({ path: path.join(out, `inspector-n02-${name}.png`) });
  }
  async function closedInspector() {
    await page.waitForFunction(() => {
      const host = document.querySelector(".dn-atlas");
      return host?.querySelector(".dn-atlas-location-dock")?.hidden &&
        document.activeElement === host.querySelector(".dn-atlas-viewport");
    });
    assert.equal(await panel().locator(".dn-atlas-location-dock:visible").count(), 0);
    assert.equal((await current()).pending, false);
  }
  async function narrowEdit() {
    await page.setViewportSize({ width: 1024, height: 800 });
    await open();
    for (const row of rows) assert.equal(hashes()[row.path], row.sha256, row.path);
    await select(id(12));
    const initial = await current();
    assert.equal(initial.depth, 0);
    await inspectorLayout("location");
    const name = locationKey().getByRole("textbox", { name: "Ortsname", exact: true });
    const text = locationKey().getByRole("textbox", { name: "Abschnitt 1: Markdown", exact: true });
    await name.fill("");
    await name.press("Escape");
    await settle();
    assert.equal(await name.inputValue(), "");
    assert.equal(await panel().locator(".dn-atlas-location-dock:visible").count(), 1);
    const rejected = await current();
    assert.equal(rejected.pending, true); assert.equal(rejected.depth, 0);
    sameData(rejected, initial); assert.deepEqual(rejected.camera, initial.camera);
    await page.screenshot({ path: path.join(out, "inspector-n02-invalid-location.png") });
    await record("N02 native Escape from invalid Location input retains visible draft, native data and camera");
    const locationName = "N02 Mühle — exakt", locationText = "## Ort\nN02: Escape erhält diesen Text.  \n\n";
    await name.fill(locationName); await text.fill(locationText);
    const beforeEscape = await current();
    assert.equal(beforeEscape.pending, true);
    // Actual native input event path: no direct handler or model invocation.
    await text.press("Escape");
    await closedInspector();
    const atLocation = await current();
    assert.equal(atLocation.depth, 1);
    assert.equal(atLocation.a.name, locationName);
    assert.equal(atLocation.a.sections[0].markdown, locationText);
    assert.deepEqual(atLocation.camera, beforeEscape.camera);
    const expectedA = structuredClone(initial.a);
    expectedA.name = locationName; expectedA.sections[0].markdown = locationText;
    assert.deepEqual(atLocation.a, expectedA); assert.deepEqual(atLocation.dungeon, initial.dungeon);
    await record("N02 native Escape from focused Location textarea commits exact text in one shared undo step and returns map focus");
    await select(id(11)); await bind();
    const bound = await current(); assert.equal(bound.depth, 2);
    const key = await enterRoom();
    await inspectorLayout("room");
    const roomName = "N02 Torraum — exakt", roomText = "## Eingang\nN02: Raumtext mit Leerzeichen.  \n\n";
    await key.getByRole("textbox", { name: "Raumname", exact: true }).fill(roomName);
    const roomField = key.getByRole("textbox", { name: "Raumtext 1", exact: true });
    await roomField.fill(roomText);
    const roomCamera = (await current()).camera;
    await roomField.press("Escape"); await closedInspector();
    const edited = await current(); assert.equal(edited.depth, 3);
    const expectedDungeon = structuredClone(initial.dungeon);
    expectedDungeon.entities[0].name = roomName;
    expectedDungeon.entities[0].key.sections[0].markdown = roomText;
    assert.deepEqual(edited.dungeon, expectedDungeon);
    assert.deepEqual(edited.camera, roomCamera);
    await history("undo", 2); sameData(await current(), bound);
    await history("redo", 3); sameData(await current(), edited);
    assert.deepEqual((await current()).camera, roomCamera);
    await record("N02 native Escape from Room textarea preserves exact text, shared Undo/Redo and one camera");
    await select(id(11)); await enterRoom(); await back();
    await inspectorLayout("cached-location-return");
    const viaButtonName = "N02 Torheim — Zur Karte";
    await locationKey().getByRole("textbox", { name: "Ortsname", exact: true }).fill(viaButtonName);
    await panel().getByRole("button", { name: "Key-Inspector schließen", exact: true }).click();
    await closedInspector();
    const final = await current(); assert.equal(final.depth, 4);
    assert.equal(final.b.name, viaButtonName);
    const expectedB = structuredClone(edited.b); expectedB.name = viaButtonName;
    assert.deepEqual(final.b, expectedB);
    await history("undo", 3); sameData(await current(), edited);
    await history("redo", 4); sameData(await current(), final);
    await record("N02 visible Zur Karte closes the cached Location panel after exact checked text apply with shared Undo/Redo");
    await button("Atlas speichern").click();
    await page.waitForFunction(() => {
      const v = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view;
      return !v.repository.dirty && !v.repository.hasDraft && !v.editor.pendingKey;
    });
    const saved = await current(); sameData(saved, final); assert.equal(saved.depth, 4);
    const bytes = hashes();
    for (const row of manifest.input.filter((r) => r.path.endsWith(".city") || r.path.includes("/terrain/")))
      assert.equal(bytes[row.path], row.sha256, "unrelated native bytes: " + row.path);
    assert.equal(fs.existsSync(path.join(vault, manifest.input[0].path + ".journal")), false);
    fs.writeFileSync(inspectorBaselinePath, JSON.stringify({ state: saved, hashes: bytes,
      locationName, locationText, viaButtonName, roomName, roomText }, null, 2));
    await page.screenshot({ path: path.join(out, "inspector-n02-saved.png") });
    await record("N02 actual native Save retains exact key texts and unrelated City/terrain bytes and removes the journal");
  }
  async function narrowReopen() {
    await page.setViewportSize({ width: 1024, height: 800 });
    const baseline = JSON.parse(fs.readFileSync(inspectorBaselinePath, "utf8"));
    assert.deepEqual(hashes(), baseline.hashes);
    await open();
    const fresh = await current(); sameData(fresh, baseline.state);
    assert.equal(fresh.depth, 0); assert.equal(fresh.dirty, false); assert.equal(fresh.draft, false);
    await select(id(12));
    assert.equal(await locationKey().getByRole("textbox", { name: "Ortsname", exact: true }).inputValue(), baseline.locationName);
    assert.equal(await locationKey().getByRole("textbox", { name: "Abschnitt 1: Markdown", exact: true }).inputValue(), baseline.locationText);
    await select(id(11));
    assert.equal(await locationKey().getByRole("textbox", { name: "Ortsname", exact: true }).inputValue(), baseline.viaButtonName);
    const key = await enterRoom(); await inspectorLayout("fresh-room");
    assert.equal(await key.getByRole("textbox", { name: "Raumname", exact: true }).inputValue(), baseline.roomName);
    assert.equal(await key.getByRole("textbox", { name: "Raumtext 1", exact: true }).inputValue(), baseline.roomText);
    await back(); await inspectorLayout("fresh-cached-location");
    assert.deepEqual(hashes(), baseline.hashes);
    await record("N02 separate fresh Obsidian process visibly reopens exact saved Location/Room texts and native bytes at 1024 by800");
  }
  async function edit() {
    if (inspectorN02) return narrowEdit();
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
    // This deliberately edited textarea value uses LF; binding/Undo retain the original CRLF exactly.
    const roomName = "Torraum am Ort", roomText = "## Eingang\nDie Basalttür ist geschlossen.  \n\nH01: Am Ort verortet.\n";
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
    if (inspectorN02) return narrowReopen();
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
