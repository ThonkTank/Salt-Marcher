const ROOT = "Dungeons/Phase1-BuildingFloor";
const FILE = `${ROOT}/draw-resize.dungeon`;
const CROP = `${ROOT}/draw-resize-crop.dungeon`;
const ERASED = `${ROOT}/draw-erase.dungeon`;

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks, chooseTool }) => {
  const { pckPath } = require("./phase3-fixtures.cjs")({ fs, crypto, assert });
  const file = (name) => path.join(vault, name);
  const hash = (name) => crypto.createHash("sha256")
    .update(fs.readFileSync(file(name))).digest("hex");
  const editor = () => page.evaluate(() => {
    const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)?.view.editor;
    return e && { document: e.session.document(), activeCells: e.session.smartTiles?.length,
      dirty: e.session.dirty, history: e.session.historySize,
      renderCount: e.renderer.renderCount,
      meshes: [...e.renderer.visuals.values()].filter((v) => v.entity.kind === "building")
        .map((v) => ({ id: v.entity.id, floor: !!v.floorMesh })) };
  });
  async function open(name) {
    await page.evaluate(async (name) => app.workspace.getLeaf("tab").openFile(
      app.vault.getAbstractFileByPath(name)), name);
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().waitFor({ state: "visible" });
    await page.waitForFunction(() =>
      !!app.workspace.getLeavesOfType("dungeon-native-map").at(-1)?.view.editor);
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Einpassen", exact: true }).click();
  }
  const world = (point) => page.evaluate((point) => {
    const r = app.workspace.getLeavesOfType("dungeon-native-map").at(-1).view.editor.renderer;
    const box = r.canvas.getBoundingClientRect();
    return { x: box.x + r.camera.x + point.x * r.camera.scale,
      y: box.y + r.camera.y + point.y * r.camera.scale };
  }, point);
  async function draw(a, b, expected) {
    const first = await world(a), second = await world(b);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(second.x, second.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction(expected =>
      app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session?.entities?.size === expected,
    expected, { timeout: 45000 });
  }
  async function resize(left) {
    const menu = page.locator(".dungeon-native-editor:visible").last()
      .locator(".dn-popover-menu");
    await menu.locator("summary").click();
    await menu.getByRole("button", { name: "Kartengröße ändern" }).click();
    const dialog = page.locator(".modal:visible")
      .filter({ hasText: "Kartengröße ändern" }).last();
    await dialog.waitFor({ state: "visible" });
    const input = dialog.locator(".setting-item")
      .filter({ has: page.locator(".setting-item-name", { hasText: "Links in Feldern" }) })
      .locator("input");
    await input.fill(String(left));
    await input.press("Tab");
    await dialog.getByRole("button", { name: "Übernehmen" }).click();
  }
  async function save(name) {
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.dirty);
    return JSON.parse(fs.readFileSync(file(name), "utf8"));
  }
  const occupied = (doc) => doc.smartTiles.map((c) => [c.x, c.y]);
  const polygons = (doc) => doc.entities.map((e) => e.polygons);
  async function edit() {
    await page.evaluate(async ({ file, pckPath }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.useNativeAssetArchive(pckPath);
      for (const folder of ["Dungeons", "Dungeons/Phase1-BuildingFloor"])
        if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
      await app.vault.create(file, JSON.stringify({
        format: "dungeon-map", version: 4, id: "building-floor-resize",
        settings: { name: "Building Floor Resize", width: 18, height: 12,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2) + "\n");
    }, { file: FILE, pckPath });
    await open(FILE);
    await chooseTool("Raum");
    await page.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "Keine Wand", exact: true }).click();
    const catalog = await page.evaluate(() => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      return plugin.listAssets([], true).filter((a) => a.kind === "tileset")
        .map((a) => ({ name: a.name, image: a.files.image }));
    });
    for (const [index, style] of ["tileset_wood_vertical", "tileset_diamond"].entries()) {
      const asset = catalog.find((item) => item.image?.endsWith(`/${style}.png`));
      assert.ok(asset, style);
      await page.getByRole("group", { name: "Bodenstil" })
        .getByRole("button", { name: asset.name, exact: true }).click();
      await draw({ x: 0, y: index * 3 }, { x: 2, y: index * 3 + 2 }, index + 1);
      await page.waitForFunction(count =>
        app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
          ?.view.editor?.session.smartTiles?.length === count, (index + 1) * 4);
    }
    const before = await editor();
    assert.equal(before.document.smartTiles.length, 8);
    assert.ok(before.document.entities.every((e) => e.floorTileRaster));
    assert.ok(before.document.smartTiles.every((c) => c.buildingId));
    assert.deepEqual(occupied(before.document), [[0, 0], [1, 0], [0, 1], [1, 1],
      [0, 3], [1, 3], [0, 4], [1, 4]]);
    const savedBefore = await save(FILE);
    assert.deepEqual(occupied(savedBefore), occupied(before.document));
    await page.screenshot({ path: path.join(out, "before-crop.png") });
    const wood = catalog.find((item) => item.image?.endsWith("/tileset_wood_vertical.png"));
    await page.getByRole("group", { name: "Bodenstil" })
      .getByRole("button", { name: wood.name, exact: true }).click();
    await page.keyboard.down("Alt");
    try {
      await draw({ x: 0, y: 0 }, { x: 1, y: 2 }, 2);
    } finally {
      await page.keyboard.up("Alt");
    }
    await page.waitForFunction(() =>
      app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.smartTiles?.length === 6);
    const erased = await editor();
    assert.deepEqual(occupied(erased.document), [[1, 0], [1, 1],
      [0, 3], [1, 3], [0, 4], [1, 4]]);
    assert.deepEqual(occupied(await save(FILE)), occupied(erased.document));
    fs.copyFileSync(file(FILE), file(ERASED));
    await page.screenshot({ path: path.join(out, "erased.png") });
    assert.ok((await editor()).history > 0);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    await page.waitForFunction(() =>
      app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.smartTiles?.length === 8);
    assert.deepEqual(occupied(await save(FILE)), occupied(before.document));
    await resize(-1);
    const crop = await editor();
    assert.deepEqual([crop.document.settings.width, crop.document.settings.height], [17, 12]);
    assert.deepEqual(occupied(crop.document), [[0, 0], [0, 1], [0, 3], [0, 4]]);
    assert.equal(crop.history, 0);
    assert.deepEqual(occupied(await save(FILE)), occupied(crop.document));
    fs.copyFileSync(file(FILE), file(CROP));
    fs.writeFileSync(path.join(qa, "building-floor-crop-hash.txt"), hash(CROP));
    fs.copyFileSync(file(FILE), path.join(out, "crop.dungeon"));
    await resize(1);
    const restored = await editor();
    assert.deepEqual(occupied(restored.document), [[1, 0], [1, 1], [1, 3], [1, 4]]);
    assert.deepEqual(polygons(restored.document), polygons(before.document));
    assert.deepEqual(occupied(await save(FILE)), occupied(restored.document));
    await page.screenshot({ path: path.join(out, "restored.png") });
    fs.writeFileSync(path.join(out, "building-floor-result.json"), JSON.stringify({
      mode: "edit", before: occupied(before.document), erased: occupied(erased.document),
      crop: occupied(crop.document),
      restored: occupied(restored.document), cropHash: hash(CROP),
      eraseHash: hash(ERASED),
      sourceStyles: before.document.entities.map((e) => e.material?.assetId),
      afterStyles: restored.document.entities.map((e) => e.material?.assetId),
    }, null, 2));
    checks.push("DD-038 Building floor UI draw: 8→4→4 cells, two retained polygons, save");
    checks.push("DD-038 Building floor Alt erase: 8→6 cells, Undo restores eight, save");
  }
  async function reopen() {
    await open(ERASED);
    const erased = await editor();
    assert.deepEqual(occupied(erased.document), [[1, 0], [1, 1],
      [0, 3], [1, 3], [0, 4], [1, 4]]);
    await page.screenshot({ path: path.join(out, "fresh-erased.png") });
    const cropHash = hash(CROP);
    assert.equal(cropHash, fs.readFileSync(path.join(qa, "building-floor-crop-hash.txt"), "utf8"));
    await open(CROP);
    assert.deepEqual(occupied((await editor()).document), [[0, 0], [0, 1], [0, 3], [0, 4]]);
    await resize(1);
    const restored = await editor();
    assert.deepEqual(occupied(restored.document), [[1, 0], [1, 1], [1, 3], [1, 4]]);
    assert.deepEqual(occupied(await save(CROP)), occupied(restored.document));
    await page.screenshot({ path: path.join(out, "fresh-restored.png") });
    fs.writeFileSync(path.join(out, "building-floor-result.json"), JSON.stringify({
      mode: "reopen", eraseHash: hash(ERASED),
      erased: occupied(erased.document), cropHash,
      restored: occupied(restored.document),
      styles: restored.document.entities.map((e) => e.material?.assetId),
    }, null, 2));
    checks.push("DD-038 Building floor fresh crop opens and expands with four cells");
    checks.push("DD-038 Building floor fresh erased map keeps six cells");
  }
  return { edit, reopen };
};
