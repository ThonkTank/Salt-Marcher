const MAP = "Dungeons/Phase7QA/Karte.dungeon";
const TEXT = "*Wortlaut der Phase-7-Probe.*\n[[QA/Beute|Beute]]\n";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const savedPath = path.join(qa, "phase7-combined-saved.json");
  const editor = () => page.evaluate(() => {
    const leaf = app.workspace.getLeavesOfType("dungeon-native-pending")[0] ??
      app.workspace.getLeavesOfType("dungeon-native-map")[0];
    const e = leaf?.view?.editor;
    if (!e) return null;
    return { document: e.session.document(), history: e.session.historySize,
      selection: [...e.selection], dirty: e.session.dirty,
      camera: { x: e.renderer.camera.x, y: e.renderer.camera.y,
        scale: e.renderer.camera.scale } };
  });
  const screen = (point) => page.evaluate((point) => {
    const e = (app.workspace.getLeavesOfType("dungeon-native-pending")[0] ??
      app.workspace.getLeavesOfType("dungeon-native-map")[0]).view.editor;
    const box = e.renderer.canvas.getBoundingClientRect();
    const x = box.x + e.renderer.camera.x + point.x * e.renderer.camera.scale;
    const y = box.y + e.renderer.camera.y + point.y * e.renderer.camera.scale;
    if (x < box.x || x > box.right || y < box.y || y > box.bottom)
      throw new Error("Phase-7-Geste außerhalb des Canvas");
    return { x, y };
  }, point);
  const click = async (point) => {
    const p = await screen(point);
    await page.mouse.click(p.x, p.y);
  };
  const drag = async (from, to) => {
    const a = await screen(from), b = await screen(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
  };
  const selectObjects = () => page.locator('.dn-selection-filter input[type="checkbox"]')
    .evaluateAll((inputs) => {
      for (const input of inputs) {
        const label = input.getAttribute("aria-label");
        if (!label?.startsWith("Objektarten: ") || label === "Objektarten: Alle") continue;
        const checked = label === "Objektarten: Objekte";
        if (input.checked !== checked) {
          input.checked = checked;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
  const snapshot = async (name) => {
    fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(await editor(), null, 2));
    await page.screenshot({ path: path.join(out, name + ".png"), timeout: 30000 });
  };
  const rooms = (state) => state.document.entities.filter((entity) =>
    entity.kind === "building" && entity.number);
  const occurrence = (state) => state.document.content.occurrences[0];
  const object = (state, id) => state.document.entities.find((entity) => entity.id === id);
  const section = (state, roomId, sectionId) => object(state, roomId)?.key.sections
    .find((item) => item.id === sectionId);
  const open = async () => {
    await page.evaluate(async (mapPath) =>
      app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(mapPath)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible", timeout: 30000 });
  };
  async function edit() {
    const pck = fixtures.verifyPck(), pack = fixtures.verifyColorPack();
    await page.evaluate(async (path) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(path), pck);
    await page.evaluate(async (encoded) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
      const [record] = await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
      window.__phase7PackId = record.metadata.id;
      await plugin.create("Phase7QA", 26, 14);
      const e = app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor;
      const before = e.session.settings;
      e.session.execute({ label: "QA-Paket aktivieren", settings: { before,
        after: { ...before, assetPacks: [record.metadata.id], builtInAssets: true } } });
    }, pack.toString("base64"));
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible", timeout: 30000 });
    await chooseTool("Raum");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    for (const [a, b] of [
      [{ x: 1, y: 1 }, { x: 10, y: 11 }],
      [{ x: 14, y: 1 }, { x: 23, y: 11 }],
    ]) {
      const beforeIds = new Set((await editor()).document.entities.map((e) => e.id));
      await drag(a, b);
      await page.waitForFunction((ids) => {
        const e = app.workspace.getLeavesOfType("dungeon-native-pending")[0]?.view?.editor;
        return e?.session.document().entities.some((item) =>
          item.kind === "building" && !ids.includes(item.id));
      }, [...beforeIds], { timeout: 30000 });
      const building = (await editor()).document.entities.find((e) =>
        e.kind === "building" && !beforeIds.has(e.id));
      assert(building, "Raumgrundriss fehlt");
      await page.evaluate(async (id) =>
        app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor.select(id),
      building.id);
      await page.getByRole("button", { name: "Raum anlegen", exact: true }).click();
    }
    const built = await editor();
    assert.equal(rooms(built).length, 2);
    await chooseTool("Tür");
    await click({ x: 5, y: 1 });
    const portal = (await editor()).document.entities.find((e) => e.kind === "door");
    assert.equal(portal?.anchor?.boundaryId, rooms(built)[0].id);
    await snapshot("p7-rooms-and-portal");
    checks.push("Two V4 rooms and one anchored portal created through canvas gestures");

    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await click({ x: 4, y: 4 });
    const builtIn = (await editor()).document.entities.filter((e) => e.kind === "object")[0];
    assert.equal(builtIn.roomId, rooms(built)[0].id);
    await page.locator('.dn-object-library-tile[aria-label="QA Object Color"]').click();
    await page.getByRole("spinbutton", { name: "Rotation", exact: true }).fill("45");
    await page.getByRole("spinbutton", { name: "Rotation", exact: true }).press("Tab");
    await click({ x: 7, y: 7 });
    const placed = await editor();
    const packageObject = placed.document.entities.filter((e) => e.kind === "object")
      .find((e) => e.id !== builtIn.id);
    assert(packageObject?.assetId && packageObject.roomId === rooms(built)[0].id);
    assert.equal(packageObject.rotation, Math.PI / 4);
    await snapshot("p7-built-in-and-package");
    checks.push("Built-in and package objects placed in one room; package rotation persists");

    await page.evaluate(() => {
      const session = app.workspace.getLeavesOfType("dungeon-native-pending")[0].view.editor.session;
      const before = session.content;
      session.execute({ label: "QA-Featuredefinition", content: { before,
        after: { ...before, definitions: [{ id: "phase7-definition", name: "Zeichen",
          kind: "feature", xp: 0, lootValue: 0 }] } } });
    });

    await chooseTool("Auswahl");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await selectObjects();
    await click({ x: 4, y: 4 });
    assert.deepEqual((await editor()).selection, [builtIn.id]);
    await page.locator(".dn-group-rail").getByRole("button", { name: "Inhalte", exact: true }).click();
    await page.locator(".dn-tool-rail").getByRole("button", { name: "Dungeon-Inhalte", exact: true }).click();
    await page.locator(".modal-container .modal").last()
      .getByRole("button", { name: "Vorkommen anlegen", exact: true }).first().click();
    const modal = page.locator(".modal-container .modal").last();
    await modal.locator("textarea").fill(TEXT);
    await modal.getByRole("button", { name: "Vorkommen anlegen", exact: true }).click();
    const linked = await editor(), feature = occurrence(linked);
    assert.equal(feature.entityId, builtIn.id);
    assert.equal(feature.roomId, rooms(built)[0].id);
    assert.equal(feature.marker, "A");
    const markdown = section(linked, feature.roomId, feature.sectionId)?.markdown;
    assert(markdown?.includes(TEXT));
    await snapshot("p7-linked-feature");
    checks.push("Selected built-in object links to feature A and exact V4 Markdown section");

    await page.keyboard.press("Escape");
    await chooseTool("Auswahl");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await selectObjects();
    await drag({ x: 4, y: 4 }, { x: 17, y: 4 });
    const moved = await editor();
    assert.equal(object(moved, builtIn.id).roomId, rooms(built)[1].id);
    assert.equal(occurrence(moved).roomId, rooms(built)[1].id);
    assert.equal(occurrence(moved).sectionId, feature.sectionId);
    assert.equal(section(moved, rooms(built)[1].id, feature.sectionId)?.markdown, markdown);
    assert.equal(section(moved, rooms(built)[0].id, feature.sectionId), undefined);
    await snapshot("p7-moved-feature");
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await editor()).document, linked.document);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.deepEqual((await editor()).document, moved.document);
    checks.push("Room-crossing drag and one Undo/Redo atomically preserve object, feature and exact key text");

    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => {
      const e = (app.workspace.getLeavesOfType("dungeon-native-map")[0] ??
        app.workspace.getLeavesOfType("dungeon-native-pending")[0])?.view?.editor;
      return !!e && !e.saving && !e.session.dirty;
    }, null, { timeout: 30000 });
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(saved, moved.document);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(vault, MAP))).digest("hex");
    fs.writeFileSync(savedPath, JSON.stringify({ hash, document: saved,
      firstRoomId: rooms(built)[0].id, secondRoomId: rooms(built)[1].id,
      objectId: builtIn.id, packageId: packageObject.id, sectionId: feature.sectionId,
      markdown }, null, 2));
    await page.evaluate(async ({ mapPath, roomId, sectionId }) =>
      app.plugins.getPlugin("dungeon-editor").openRoomKey(mapPath, roomId, sectionId),
    { mapPath: MAP, roomId: rooms(built)[1].id, sectionId: feature.sectionId });
    await page.locator(".dn-room-view .dn-structured-key").waitFor();
    assert.match(await page.locator(".dn-room-view .dn-key-content").innerText(),
      /Wortlaut der Phase-7-Probe/);
    await snapshot("p7-saved-key");
    checks.push("Saved map opens the moved feature's exact section in the right room view");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(savedPath, "utf8"));
    await open();
    const current = await editor();
    assert.deepEqual(current.document, prior.document);
    assert.equal(current.dirty, false);
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(vault, MAP)))
      .digest("hex"), prior.hash);
    assert.equal(object(current, prior.objectId).roomId, prior.secondRoomId);
    assert.equal(object(current, prior.packageId).rotation, Math.PI / 4);
    assert.equal(section(current, prior.secondRoomId, prior.sectionId)?.markdown, prior.markdown);
    await page.evaluate(async ({ mapPath, roomId }) =>
      app.plugins.getPlugin("dungeon-editor").openRoomKey(mapPath, roomId),
    { mapPath: MAP, roomId: prior.secondRoomId });
    await page.locator(".dn-room-view .dn-structured-key").waitFor();
    const cardPosition = await page.evaluate((objectId) => {
      const card = app.workspace.getLeavesOfType("dungeon-native-room")[0].view.card;
      const e = card.map.session.entities.get(objectId), r = card.renderer;
      const box = r.canvas.getBoundingClientRect();
      return { x: box.x + r.camera.x + e.x * r.camera.scale,
        y: box.y + r.camera.y + e.y * r.camera.scale };
    }, prior.objectId);
    await page.mouse.click(cardPosition.x, cardPosition.y);
    await page.waitForFunction((sectionId) =>
      app.workspace.getLeavesOfType("dungeon-native-room")[0]?.view?.sectionId === sectionId,
    prior.sectionId, { timeout: 12000 });
    await snapshot("p7-reopened-click-key");
    checks.push("Fresh process keeps all entities and exact Markdown; map click opens the linked key section");
  }
  return { edit, reopen };
};
