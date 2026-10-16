const MAP = "Dungeons/Phase1-WearLevels/Karte.dungeon";
const MODES = ["none", "dust", "grime", "noise", "scratched"];
const FLOOR = "pack:dungeondraft-builtin-1.2.0.1:tileset:res%3A%2F%2Ftextures%2Ftilesets%2Fsmart%2Ftileset_wood_vertical.png";
const WALL = "pack:dungeondraft-builtin-1.2.0.1:wall:res%3A%2F%2Ftextures%2Fwalls%2Fbattlements.png";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const baseline = path.join(qa, "dd008-levels-baseline.json");
  const mapFile = path.join(vault, MAP);
  const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
  const editor = () => page.locator(".dungeon-native-editor:visible").last();
  const state = () => page.evaluate(() => {
    const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)?.view.editor;
    return e && { document: e.session.document(), history: e.session.historySize,
      floorId: e.renderer.floorId };
  });
  async function open() {
    await page.evaluate(async (file) => app.workspace.getLeaf("tab").openFile(
      app.vault.getAbstractFileByPath(file)), MAP);
    await editor().locator(".dn-canvas canvas").waitFor({ state: "visible" });
  }
  async function settings() {
    await editor().locator(".dn-group-rail")
      .getByRole("button", { name: "Einstellungen", exact: true }).click();
    await editor().locator(".dn-tool-rail")
      .getByRole("button", { name: "Karteneinstellungen", exact: true }).click();
    return editor().locator(".dn-wear-gallery");
  }
  async function floor(id) {
    await editor().locator(".dn-group-rail")
      .getByRole("button", { name: "Dungeon", exact: true }).click();
    await editor().locator(".dn-tool-rail")
      .getByRole("button", { name: "Geschosse", exact: true }).click();
    await editor().locator('select[aria-label="Geschoss"]').selectOption(id);
    await page.waitForFunction((id) => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.renderer.floorId === id, id);
  }
  async function save() {
    await editor().getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.dirty);
  }
  async function edit() {
    await require("./phase3-fixtures.cjs")({ fs, crypto, assert })
      .load(page, { qaWall: false });
    await page.evaluate(async ({ file, floor, wall }) => {
      if (!app.vault.getAbstractFileByPath("Dungeons"))
        await app.vault.createFolder("Dungeons");
      await app.vault.createFolder("Dungeons/Phase1-WearLevels");
      const building = (id, floorId, outer) => ({
        id, kind: "building", floorId, polygons: [{ outer, holes: [] }],
        layer: 200, fill: 0xb2a28f, floorAlpha: 255,
        wall: 0xffffff, wallAlpha: 255, wallWidth: 0.2,
        wallAssetId: wall, material: { assetId: floor, assetPart: "image",
          tileSize: 8, tint: 0xb2a28f, rotation: 0 },
      });
      const doc = {
        format: "dungeon-map", version: 4, id: "dd008-levels-map",
        settings: { name: "Phase1 Wear Levels", width: 8, height: 8,
          feetPerField: 5, wallShadows: true, objectShadows: true,
          buildingWear: 0, nativeBuildingWear: false,
          buildingWearMode: "none", builtInAssets: true, assetPacks: [] },
        floors: [{ id: "floor-ground", name: "Ground", elevation: 0 },
          { id: "floor-upper", name: "NEW_LEVEL", elevation: 1 }],
        entities: [
          building("ground-building", "floor-ground", [
            { x: -2, y: 0 }, { x: 6, y: 0 },
            { x: 6, y: 6 }, { x: -2, y: 6 }]),
          building("upper-building", "floor-upper", [
            { x: 1, y: 1 }, { x: 4, y: 1 },
            { x: 4, y: 4 }, { x: 1, y: 4 }]),
        ],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      };
      await app.workspace.getLeaf("tab").openFile(
        await app.vault.create(file, JSON.stringify(doc)));
    }, { file: MAP, floor: FLOOR, wall: WALL });
    await editor().locator(".dn-canvas canvas").waitFor({ state: "visible" });
    if (!(await editor().evaluate((element) => element.classList.contains("dn-maximized"))))
      await editor().getByRole("button", { name: "Maximieren", exact: true }).click();
    await editor().getByRole("button", { name: "Einpassen", exact: true }).click();
    const start = await state();
    assert.equal(start.document.entities.length, 2);
    for (const mode of MODES) {
      await floor("floor-ground");
      let gallery = await settings();
      await gallery.getByRole("button", { name: "Building Wear: " + mode.toUpperCase() }).click();
      await page.waitForFunction((mode) => app.workspace.getLeavesOfType(
        "dungeon-native-map").at(-1)?.view.editor.session.settings.buildingWearMode === mode,
      mode);
      assert.equal(await gallery.getByRole("button", {
        name: "Building Wear: " + mode.toUpperCase() }).getAttribute("aria-pressed"), "true");
      await page.waitForTimeout(450);
      await editor().locator(".dn-canvas canvas").screenshot({ path: path.join(out,
        `wear-${mode}-ground.png`) });
      await floor("floor-upper");
      gallery = await settings();
      assert.equal(await gallery.getByRole("button", {
        name: "Building Wear: " + mode.toUpperCase() }).getAttribute("aria-pressed"), "true");
      await page.waitForTimeout(450);
      await editor().locator(".dn-canvas canvas").screenshot({ path: path.join(out,
        `wear-${mode}-upper.png`) });
      const chosen = await state();
      assert.deepEqual(chosen.document.entities, start.document.entities);
      assert.equal(chosen.history, start.history);
      assert.equal(chosen.document.settings.nativeBuildingWear, mode !== "none");
      await save();
      const bytes = fs.readFileSync(mapFile);
      assert.equal(JSON.parse(bytes).settings.buildingWearMode, mode);
      fs.writeFileSync(path.join(out, `wear-${mode}.dungeon`), bytes);
    }
    const saved = fs.readFileSync(mapFile);
    fs.writeFileSync(baseline, JSON.stringify({ document: (await state()).document,
      hash: hash(saved) }, null, 2));
    checks.push("DD-008 five wear modes change both drawn floors while leaving two Building records and History unchanged");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(baseline, "utf8"));
    await open();
    assert.deepEqual((await state()).document, prior.document);
    assert.equal(hash(fs.readFileSync(mapFile)), prior.hash);
    await floor("floor-ground");
    let gallery = await settings();
    assert.equal(await gallery.getByRole("button", {
      name: "Building Wear: SCRATCHED" }).getAttribute("aria-pressed"), "true");
    await floor("floor-upper");
    gallery = await settings();
    assert.equal(await gallery.getByRole("button", {
      name: "Building Wear: SCRATCHED" }).getAttribute("aria-pressed"), "true");
    checks.push("DD-008 fresh Obsidian process keeps two-floor SCRATCHED selection and byte-identical map");
  }
  return { edit, reopen };
};
