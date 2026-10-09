const MAP = "Dungeons/Phase1-Resize/Karte.dungeon";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const baseline = path.join(qa, "phase1-resize-baseline.json");
  const mapFile = path.join(vault, MAP);
  const hash = () => crypto.createHash("sha256")
    .update(fs.readFileSync(mapFile)).digest("hex");
  const editor = () => page.evaluate(() => {
    const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
      ?.view.editor;
    return e && { document: e.session.document(),
      history: e.session.historySize, canUndo: e.session.canUndo,
      canRedo: e.session.canRedo, dirty: e.session.dirty };
  });
  const modal = () => page.locator(".modal:visible")
    .filter({ hasText: "Kartengröße ändern" }).last();
  const setting = (dialog, label) => dialog.locator(".setting-item")
    .filter({ has: page.locator(".setting-item-name", { hasText: label }) });
  async function openDialog() {
    const menu = page.locator(".dungeon-native-editor:visible").last()
      .locator(".dn-popover-menu");
    await menu.locator("summary").click();
    await menu.getByRole("button", { name: "Kartengröße ändern" }).click();
    fs.writeFileSync(path.join(out, "resize-modal-debug.json"), JSON.stringify(
      await page.evaluate(() => ({
        activeWindow: !!window.activeWindow,
        modalCount: document.querySelectorAll(".modal").length,
        modals: [...document.querySelectorAll(".modal")]
          .map((node) => ({ text: node.textContent?.slice(0, 400),
            width: node.getBoundingClientRect().width })),
        menuOpen: !!document.querySelector(".dn-popover-menu[open]"),
      })), null, 2));
    await modal().waitFor({ state: "visible" });
    return modal();
  }
  async function edit() {
    await page.evaluate(async (file) => {
      if (!app.vault.getAbstractFileByPath("Dungeons"))
        await app.vault.createFolder("Dungeons");
      await app.vault.createFolder("Dungeons/Phase1-Resize");
      const created = await app.vault.create(file, JSON.stringify({
        format: "dungeon-map", version: 4, id: "phase1-resize-map",
        settings: { name: "Phase1 Resize", width: 8, height: 8,
          feetPerField: 5, wallShadows: true, objectShadows: true,
          buildingWear: 0, nativeBuildingWear: true,
          buildingWearMode: "grime" },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0 }],
        entities: [
          { id: "building", kind: "building", floorId: "floor-1",
            polygons: [{ outer: [
              { x: 2, y: 2 }, { x: 4, y: 2 },
              { x: 4, y: 4 }, { x: 2, y: 4 },
            ], holes: [] }],
            layer: 200, fill: 0xb2a28f, wall: 0x505050, wallWidth: 0.2 },
          { id: "object", kind: "object", floorId: "floor-1",
            x: 5, y: 5, rotation: 0, width: 1, height: 1,
            color: 0x6688aa, label: "", layer: 100, flip: false },
        ],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }));
      await app.workspace.getLeaf("tab").openFile(created);
    }, MAP);
    await page.locator(".dn-canvas canvas").last().waitFor({ state: "visible" });
    await page.evaluate(() => {
      const session = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        .view.editor.session;
      const before = session.settings;
      session.execute({ label: "Vorherige Aktion", settings: { before,
        after: { ...before, wallShadows: false } } });
    });
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor.session.dirty);
    const before = await editor();
    assert.equal(before.history, 1);
    const beforeHash = hash();
    let dialog = await openDialog();
    assert.match(await dialog.innerText(), /nicht rückgängig gemacht/);
    await dialog.getByRole("button", { name: "Abbrechen" }).click();
    assert.deepEqual(await editor(), before);
    assert.equal(hash(), beforeHash);
    dialog = await openDialog();
    const bounds = await dialog.boundingBox();
    assert.ok(bounds);
    await page.mouse.click(bounds.x + bounds.width - 37, bounds.y + 21);
    assert.deepEqual(await editor(), before);
    assert.equal(hash(), beforeHash);
    dialog = await openDialog();
    await setting(dialog, "Oben in Feldern").locator("input").fill("1");
    await page.screenshot({ path: path.join(out, "resize-dialog.png") });
    await dialog.getByRole("button", { name: "Übernehmen" }).click();
    const after = await editor();
    assert.equal(after.document.settings.width, 8);
    assert.equal(after.document.settings.height, 9);
    assert.equal(after.document.entities.find((x) => x.id === "object").y, 6);
    assert.equal(after.document.entities.find((x) => x.id === "building")
      .polygons[0].outer[0].y, 3);
    assert.equal(after.history, 0);
    assert.equal(after.canUndo, false);
    assert.equal(after.canRedo, false);
    assert.equal(after.dirty, true);
    assert.equal(hash(), beforeHash);
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor.session.dirty);
    const saved = JSON.parse(fs.readFileSync(mapFile, "utf8"));
    assert.deepEqual(saved, after.document);
    fs.writeFileSync(baseline, JSON.stringify({ document: saved, hash: hash() }, null, 2));
    await page.screenshot({ path: path.join(out, "resize-saved.png") });
    checks.push("DD-038 Menu opens four-margin dialog with non-Undo warning; Cancel and X preserve map and history");
    checks.push("DD-038 Top +1 moves Building and object, saves 8×9, and clears older Undo/Redo");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(baseline, "utf8"));
    await page.evaluate(async (file) =>
      app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(file)),
    MAP);
    await page.locator(".dn-canvas canvas").last().waitFor({ state: "visible" });
    assert.deepEqual((await editor()).document, prior.document);
    assert.equal(hash(), prior.hash);
    checks.push("DD-038 fresh host process reopens the shifted 8×9 V4 map byte unchanged");
  }
  return { edit, reopen };
};
