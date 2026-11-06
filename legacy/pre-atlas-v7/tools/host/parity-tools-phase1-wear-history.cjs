const MAP = "Dungeons/Phase1-WearHistory/Karte.dungeon";
const FLOOR = "pack:dungeondraft-builtin-1.2.0.1:tileset:res%3A%2F%2Ftextures%2Ftilesets%2Fsmart%2Ftileset_wood_vertical.png";
const WALL = "pack:dungeondraft-builtin-1.2.0.1:wall:res%3A%2F%2Ftextures%2Fwalls%2Fbattlements.png";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks,
  chooseTool }) => {
  const saved = path.join(qa, "dd008-history-baseline.json");
  const mapFile = path.join(vault, MAP);
  const hash = () => crypto.createHash("sha256")
    .update(fs.readFileSync(mapFile)).digest("hex");
  const state = () => page.evaluate(() => {
    const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)?.view.editor;
    return e && { document: e.session.document(), history: e.session.historySize,
      dirty: e.session.dirty };
  });
  const world = (point) => page.evaluate((point) => {
    const r = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
      .view.editor.renderer;
    const box = r.canvas.getBoundingClientRect();
    return { x: box.x + r.camera.x + point.x * r.camera.scale,
      y: box.y + r.camera.y + point.y * r.camera.scale };
  }, point);
  async function save() {
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.dirty);
  }
  async function gallery() {
    const editor = page.locator(".dungeon-native-editor:visible").last();
    await editor.locator(".dn-group-rail")
      .getByRole("button", { name: "Einstellungen", exact: true }).click();
    await editor.locator(".dn-tool-rail")
      .getByRole("button", { name: "Karteneinstellungen", exact: true }).click();
    return editor.locator(".dn-wear-gallery");
  }
  async function open() {
    await page.evaluate(async (file) => app.workspace.getLeaf("tab").openFile(
      app.vault.getAbstractFileByPath(file)), MAP);
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().waitFor({ state: "visible" });
  }
  async function edit() {
    await require("./phase3-fixtures.cjs")({ fs, crypto, assert })
      .load(page, { qaWall: false });
    await page.evaluate(async ({ file, wall, floor }) => {
      if (!app.vault.getAbstractFileByPath("Dungeons"))
        await app.vault.createFolder("Dungeons");
      await app.vault.createFolder("Dungeons/Phase1-WearHistory");
      const doc = {
        format: "dungeon-map", version: 4, id: "dd008-history-map",
        settings: { name: "Phase1 Wear History", width: 8, height: 8,
          feetPerField: 5, wallShadows: true, objectShadows: true,
          buildingWear: 0, nativeBuildingWear: true,
          buildingWearMode: "scratched", builtInAssets: true, assetPacks: [] },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0 }],
        entities: [{ id: "initial-building", kind: "building", floorId: "floor-1",
          polygons: [{ outer: [{ x: -2, y: 0 }, { x: 6, y: 0 },
            { x: 6, y: 6 }, { x: -2, y: 6 }], holes: [] }],
          layer: 200, fill: 0xb2a28f, floorAlpha: 255,
          wall: 0xffffff, wallAlpha: 255, wallWidth: 0.2,
          wallAssetId: wall,
          material: { assetId: floor, assetPart: "image", tileSize: 8,
            tint: 0xb2a28f, rotation: 0 } }],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      };
      await app.workspace.getLeaf("tab").openFile(
        await app.vault.create(file, JSON.stringify(doc)));
    }, { file: MAP, wall: WALL, floor: FLOOR });
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().waitFor({ state: "visible" });
    await chooseTool("Raum");
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Einpassen", exact: true }).click();
    const a = await world({ x: 6, y: 6 }), b = await world({ x: 8, y: 8 });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x - 2, b.y - 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.entities.size === 2);
    const drawn = await state();
    assert.equal(drawn.history, 1);
    assert.equal(drawn.document.settings.buildingWearMode, "scratched");
    await save();
    fs.copyFileSync(mapFile, path.join(out, "01-building-scratched.dungeon"));
    const wear = await gallery();
    await wear.getByRole("button", { name: "Building Wear: NONE" }).click();
    await page.waitForFunction(() => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.settings.buildingWearMode === "none");
    const none = await state();
    assert.equal(none.history, 1);
    await save();
    const beforeUndo = await state();
    const beforeHash = hash();
    fs.copyFileSync(mapFile, path.join(out, "02-building-none.dungeon"));
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Rückgängig" }).click();
    await page.waitForFunction(() => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.entities.size === 1);
    const undone = await state();
    assert.equal(undone.document.settings.buildingWearMode, "none");
    await save();
    fs.copyFileSync(mapFile, path.join(out, "03-after-undo.dungeon"));
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Wiederholen" }).click();
    await page.waitForFunction(() => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.entities.size === 2);
    assert.deepEqual((await state()).document, beforeUndo.document);
    await save();
    assert.equal(hash(), beforeHash);
    fs.copyFileSync(mapFile, path.join(out, "04-after-redo.dungeon"));
    await page.screenshot({ path: path.join(out, "04-after-redo.png") });
    fs.writeFileSync(saved, JSON.stringify({ document: beforeUndo.document,
      hash: beforeHash }, null, 2));
    checks.push("DD-008 paired geometry: wear choice has no Undo entry; Undo/Redo changes only preceding Building and restores saved bytes");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(saved, "utf8"));
    await open();
    assert.deepEqual((await state()).document, prior.document);
    assert.equal(hash(), prior.hash);
    const wear = await gallery();
    assert.equal(await wear.getByRole("button", { name: "Building Wear: NONE" })
      .getAttribute("aria-pressed"), "true");
    checks.push("DD-008 combined Building and NONE persist after a fresh Obsidian process");
  }
  return { edit, reopen };
};
