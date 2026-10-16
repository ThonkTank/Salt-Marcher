const MAP = "Dungeons/GM-UX-N-001/Karte.dungeon";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const baseline = path.join(qa, "gm-ux-n001-baseline.json");
  const state = () => page.evaluate(() => {
    const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)?.view.editor;
    return e && { document: e.session.document(), history: e.session.historySize,
      dirty: e.session.dirty, settings: app.plugins.getPlugin("dungeon-editor")
        .toolDefaults().room };
  });
  const rooms = (snapshot) => snapshot.document.entities.filter((entity) =>
    entity.kind === "building" && entity.key);
  const world = (point) => page.evaluate((point) => {
    const r = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
      .view.editor.renderer;
    const box = r.canvas.getBoundingClientRect();
    return { x: box.x + r.camera.x + point.x * r.camera.scale,
      y: box.y + r.camera.y + point.y * r.camera.scale };
  }, point);
  async function drag(a, b) {
    const first = await world(a), last = await world(b);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(last.x, last.y, { steps: 6 });
    await page.mouse.up();
  }
  async function open() {
    await page.evaluate(async (file) => app.workspace.getLeaf("tab").openFile(
      app.vault.getAbstractFileByPath(file)), MAP);
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().waitFor({ state: "visible" });
    await chooseRoom();
  }
  async function chooseRoom() {
    const surface = page.locator(".dungeon-native-editor:visible").last();
    if (!(await surface.evaluate((element) => element.classList.contains("dn-maximized"))))
      await surface.getByRole("button", { name: "Maximieren", exact: true }).click();
    await surface.locator(".dn-group-rail")
      .getByRole("button", { name: "Bauwerk", exact: true }).click();
    await surface.locator(".dn-tool-rail")
      .getByRole("button", { name: "Rechteck", exact: true }).click();
    await surface
      .getByRole("button", { name: "Einpassen", exact: true }).click();
  }
  async function save() {
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.dirty);
  }
  async function edit() {
    await page.evaluate(async (file) => {
      if (!app.vault.getAbstractFileByPath("Dungeons"))
        await app.vault.createFolder("Dungeons");
      await app.vault.createFolder("Dungeons/GM-UX-N-001");
      const plugin = app.plugins.getPlugin("dungeon-editor");
      const doc = {
        format: "dungeon-map", version: 4, id: "gm-ux-n001",
        settings: { name: "GM-UX-N-001", width: 32, height: 20,
          feetPerField: 5, wallShadows: true, objectShadows: true,
          buildingWear: 0, nativeBuildingWear: true,
          buildingWearMode: "grime", assetPacks: [] },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      };
      const created = await app.vault.create(file, JSON.stringify(doc));
      await app.workspace.getLeaf("tab").openFile(created);
      if (plugin.toolDefaults().room.autoCreateOnRectangle)
        throw new Error("Schnellmodus muss anfangs ausgeschaltet sein");
    }, MAP);
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().waitFor({ state: "visible" });
    await chooseRoom();
    const toggle = page.getByRole("checkbox", {
      name: "Raum-Key beim Zeichnen anlegen" }).last();
    await toggle.check();
    assert.equal((await state()).settings.autoCreateOnRectangle, true);
    for (let index = 0; index < 6; index++) {
      const x = 1 + index * 5;
      await drag({ x, y: 2 }, { x: x + 4, y: 7 });
    }
    await page.waitForFunction(() => {
      const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)?.view.editor;
      return [...(e?.session.entities.values() ?? [])]
        .filter((entity) => entity.kind === "building" && entity.key).length === 6;
    }, null, { timeout: 45000 });
    const made = await state();
    assert.deepEqual(rooms(made).map((room) => room.number),
      ["1", "2", "3", "4", "5", "6"]);
    assert.equal(made.document.entities.length, 6);
    assert.equal(made.history, 6);
    await page.screenshot({ path: path.join(out, "six-quick-rooms.png") });
    const toolbar = page.locator(".dungeon-native-editor:visible").last();
    await toolbar.getByRole("button", { name: "Rückgängig" }).click();
    await page.waitForFunction(() => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.entities.size === 5);
    await toolbar.getByRole("button", { name: "Wiederholen" }).click();
    await page.waitForFunction(() => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.entities.size === 6);
    assert.deepEqual((await state()).document, made.document);
    await save();
    const saved = await state();
    const hash = crypto.createHash("sha256").update(fs.readFileSync(
      path.join(vault, MAP))).digest("hex");
    fs.writeFileSync(baseline, JSON.stringify({ document: saved.document, hash }, null, 2));
    checks.push("Six visible rectangle drags create six distinct V4 room keys; Undo/Redo is atomic");
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(baseline, "utf8"));
    await open();
    const reopened = await state();
    assert.deepEqual(reopened.document, saved.document);
    assert.equal(reopened.settings.autoCreateOnRectangle, true);
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(
      path.join(vault, MAP))).digest("hex"), saved.hash);
    assert.equal(await page.getByRole("checkbox", {
      name: "Raum-Key beim Zeichnen anlegen" }).last().isChecked(), true);
    await page.screenshot({ path: path.join(out, "six-quick-rooms-fresh.png") });
    await page.getByRole("checkbox", {
      name: "Raum-Key beim Zeichnen anlegen" }).last().uncheck();
    await drag({ x: 1, y: 10 }, { x: 5, y: 15 });
    await page.waitForFunction(() => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.entities.size === 7);
    const free = await state();
    assert.equal(rooms(free).length, 6);
    assert.equal(free.document.entities.filter((e) => e.kind === "building" && !e.key).length, 1);
    await page.screenshot({ path: path.join(out, "free-floor-when-off.png") });
    await page.getByRole("button", { name: "Raum anlegen", exact: true }).last().click();
    await page.waitForFunction(() => [...app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.entities.values() ?? []]
      .filter((entity) => entity.kind === "building" && entity.key).length === 7);
    assert.equal(rooms(await state()).length, 7);
    checks.push("Fresh Obsidian process keeps quick mode; off restores free floor and manual room adoption");
  }
  return { edit, reopen };
};
