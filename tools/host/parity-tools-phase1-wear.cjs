const NAME = "Phase1-Wear";
const MAP = "Dungeons/" + NAME + "/Karte.dungeon";
const MODES = ["none", "dust", "grime", "noise", "scratched"];
const FLOOR = "pack:dungeondraft-builtin-1.2.0.1:tileset:res%3A%2F%2Ftextures%2Ftilesets%2Fsmart%2Ftileset_wood_vertical.png";
const WALL = "pack:dungeondraft-builtin-1.2.0.1:wall:res%3A%2F%2Ftextures%2Fwalls%2Fbattlements.png";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const baseline = path.join(qa, "phase1-wear-baseline.json");
  const mapFile = path.join(vault, MAP);
  const hash = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
  const current = () => page.evaluate(() =>
    app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
      ?.view.editor.session.document());
  const gallery = () => page.locator(".dungeon-native-editor:visible")
    .last().locator(".dn-wear-gallery");
  const document = {
    format: "dungeon-map", version: 4, id: "phase1-wear-map",
    settings: { name: NAME, width: 12, height: 12, feetPerField: 5,
      builtInAssets: true, assetPacks: [], wallShadows: true,
      objectShadows: true, buildingWear: 0, nativeBuildingWear: true,
      buildingWearMode: "grime" },
    floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0 }],
    entities: [{ id: "wear-building", kind: "building", floorId: "floor-1",
      polygons: [{ outer: [
        { x: 2, y: 2 }, { x: 10, y: 2 }, { x: 10, y: 10 }, { x: 2, y: 10 },
      ], holes: [] }],
      layer: 200, fill: 0xb2a28f, floorAlpha: 255,
      wall: 0xffffff, wallAlpha: 255, wallWidth: 0.2,
      wallAssetId: WALL,
      material: { assetId: FLOOR, assetPart: "image",
        tileSize: 8, tint: 0xb2a28f, rotation: 0 } }],
    content: { definitions: [], occurrences: [], routes: [], archive: [] },
  };
  async function open() {
    await page.evaluate(async ({ file, value }) => {
      if (!app.vault.getAbstractFileByPath("Dungeons"))
        await app.vault.createFolder("Dungeons");
      if (!app.vault.getAbstractFileByPath("Dungeons/Phase1-Wear"))
        await app.vault.createFolder("Dungeons/Phase1-Wear");
      const created = await app.vault.create(file, JSON.stringify(value));
      await app.workspace.getLeaf("tab").openFile(created);
    }, { file: MAP, value: document });
    await page.locator(".dn-canvas canvas").last().waitFor({ state: "visible" });
  }
  async function showGallery() {
    await page.locator(".dn-group-rail")
      .getByRole("button", { name: "Einstellungen", exact: true }).click();
    await page.locator(".dn-tool-rail")
      .getByRole("button", { name: "Karteneinstellungen", exact: true }).click();
    await gallery().waitFor({ state: "visible" });
  }
  async function edit() {
    await open();
    await showGallery();
    const start = await current();
    const initialHistory = await page.evaluate(() =>
      app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        .view.editor.session.historySize);
    assert.equal(start.entities.length, 1);
    assert.deepEqual(await gallery().locator("button").allTextContents(),
      MODES.map((mode) => mode.toUpperCase()));
    const results = [];
    for (const mode of MODES) {
      const button = gallery().getByRole("button",
        { name: "Building Wear: " + mode.toUpperCase() });
      await button.click();
      await page.waitForFunction((selected) => {
        const editor = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
          ?.view.editor;
        return editor?.session.settings.buildingWearMode === selected;
      }, mode);
      assert.equal(await button.getAttribute("aria-pressed"), "true");
      const chosen = await current();
      assert.equal(await page.evaluate(() =>
        app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
          .view.editor.session.historySize), initialHistory);
      assert.deepEqual(chosen.entities, start.entities);
      assert.equal(chosen.settings.nativeBuildingWear, mode !== "none");
      await page.waitForTimeout(450);
      const image = path.join(out, "wear-" + mode + ".png");
      await page.locator(".dn-canvas canvas").last().screenshot({ path: image });
      await page.locator(".dungeon-native-editor:visible").last()
        .getByRole("button", { name: "Speichern", exact: true }).click();
      await page.waitForFunction(() =>
        !app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
          ?.view.editor.session.dirty);
      const saved = JSON.parse(fs.readFileSync(mapFile, "utf8"));
      assert.equal(saved.settings.buildingWearMode, mode);
      assert.deepEqual(saved.entities, start.entities);
      const raw = fs.readFileSync(mapFile);
      fs.writeFileSync(path.join(out, "wear-" + mode + ".dungeon"), raw);
      results.push({ mode, mapHash: hash(raw),
        imageHash: hash(fs.readFileSync(image)) });
    }
    assert.equal(new Set(results.map((row) => row.imageHash)).size, MODES.length,
      "every wear mode must change the rendered canvas");
    fs.writeFileSync(baseline, JSON.stringify({ document: JSON.parse(
      fs.readFileSync(mapFile, "utf8")), results }, null, 2));
    checks.push("DD-008 five side-panel choices immediately change the stored mode and map rendering without Undo entries");
    checks.push("DD-008 each choice saves the same Building geometry with a distinct mode");
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(baseline, "utf8"));
    await page.evaluate(async (file) =>
      app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(file)),
    MAP);
    await page.locator(".dn-canvas canvas").last().waitFor({ state: "visible" });
    await showGallery();
    assert.deepEqual(await current(), saved.document);
    assert.equal(hash(fs.readFileSync(mapFile)),
      saved.results.at(-1).mapHash);
    assert.equal(await gallery().getByRole("button",
      { name: "Building Wear: SCRATCHED" }).getAttribute("aria-pressed"), "true");
    checks.push("DD-008 fresh host process reopens SCRATCHED selected with byte-identical V4 map");
  }
  return { edit, reopen };
};
