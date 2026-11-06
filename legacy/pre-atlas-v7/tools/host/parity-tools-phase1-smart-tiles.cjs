const ROOT = "Dungeons/Phase1-SmartTiles";
const CASES = [
  { edge: "left", width: 12, height: 8, rows: [1, 7],
    columns: [1, 2, 3, 4, 5], value: -3, expand: 3, remaining: 6, live: 6,
    label: "Links in Feldern" },
  { edge: "right", width: 12, height: 8, rows: [1, 7],
    columns: [7, 8, 9, 10, 11], value: -3, expand: 3, remaining: 4, live: 10,
    label: "Rechts in Feldern" },
  { edge: "top", width: 12, height: 10, rows: [0, 6],
    columns: [7, 8, 9, 10, 11], value: -2, expand: 2, remaining: 5, live: 5,
    label: "Oben in Feldern" },
  { edge: "bottom", width: 12, height: 10, rows: [3, 9],
    columns: [7, 8, 9, 10, 11], value: -2, expand: 2, remaining: 5, live: 10,
    label: "Unten in Feldern" },
];

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const baselineFile = path.join(qa, "phase1-smart-tiles-baseline.json");
  const mapPath = (item, crop = false) =>
    `${ROOT}/${item.edge}${crop ? "-crop" : ""}.dungeon`;
  const mapFile = (item, crop = false) => path.join(vault, mapPath(item, crop));
  const hash = (file) => crypto.createHash("sha256")
    .update(fs.readFileSync(file)).digest("hex");
  const editor = () => page.evaluate(() => {
    const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
      ?.view.editor;
    return e && { document: e.session.document(),
      activeCells: e.session.smartTiles?.length, dirty: e.session.dirty,
      history: e.session.historySize, renderCount: e.renderer.renderCount };
  });
  async function openMap(item, crop) {
    await page.evaluate(async ({ file, item, crop }) => {
      if (!app.vault.getAbstractFileByPath("Dungeons"))
        await app.vault.createFolder("Dungeons");
      if (!app.vault.getAbstractFileByPath("Dungeons/Phase1-SmartTiles"))
        await app.vault.createFolder("Dungeons/Phase1-SmartTiles");
      let target = app.vault.getAbstractFileByPath(file);
      if (!target && !crop) {
        const cells = item.rows.flatMap((y) => item.columns.map((x) => ({
          floorId: "floor-1", x, y, assetId: "pack:QASmart1/smart",
          color: 0x78644d,
        })));
        target = await app.vault.create(file, JSON.stringify({
          format: "dungeon-map", version: 4, id: `smart-${item.edge}`,
          settings: { name: `Smart ${item.edge}`, width: item.width,
            height: item.height, feetPerField: 5, wallShadows: true,
            objectShadows: true, buildingWear: 0, nativeBuildingWear: true,
            buildingWearMode: "grime" },
          floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0 }],
          entities: [],
          content: { definitions: [], occurrences: [], routes: [], archive: [] },
          smartTiles: cells,
        }, null, 2) + "\n");
      }
      if (!target) throw new Error("Crop-Karte im Vault nicht gefunden: " + file);
      await app.workspace.getLeaf("tab").openFile(target);
    }, { file: mapPath(item, crop), item, crop });
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().waitFor({ state: "visible" });
    await page.waitForFunction(() =>
      !!app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.smartTiles);
  }
  async function resize(item, value) {
    const menu = page.locator(".dungeon-native-editor:visible").last()
      .locator(".dn-popover-menu");
    await menu.locator("summary").click();
    await menu.getByRole("button", { name: "Kartengröße ändern" }).click();
    const dialog = page.locator(".modal:visible")
      .filter({ hasText: "Kartengröße ändern" }).last();
    await dialog.waitFor({ state: "visible" });
    const input = dialog.locator(".setting-item")
      .filter({ has: page.locator(".setting-item-name", { hasText: item.label }) })
      .locator("input");
    await input.fill(String(value));
    await input.press("Tab");
    await dialog.getByRole("button", { name: "Übernehmen" }).click();
  }
  async function save() {
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.dirty);
  }
  async function edit() {
    const results = [];
    for (const item of CASES) {
      await openMap(item, false);
      const before = await editor();
      assert.equal(before.document.smartTiles.length, 10);
      assert.equal(before.activeCells, 10);
      await resize(item, item.value);
      const cropped = await editor();
      assert.equal(cropped.document.smartTiles.length, item.remaining);
      assert.equal(cropped.activeCells, item.live);
      assert.equal(cropped.history, 0);
      await save();
      const savedCrop = JSON.parse(fs.readFileSync(mapFile(item), "utf8"));
      assert.equal(savedCrop.smartTiles.length, item.remaining);
      fs.copyFileSync(mapFile(item), mapFile(item, true));
      fs.copyFileSync(mapFile(item), path.join(out, `${item.edge}-crop-saved.dungeon`));
      await page.screenshot({ path: path.join(out, `${item.edge}-cropped.png`) });
      const cropHash = hash(mapFile(item, true));
      await resize(item, item.expand);
      const restored = await editor();
      assert.equal(restored.document.smartTiles.length, item.live);
      await save();
      fs.copyFileSync(mapFile(item), path.join(out, `${item.edge}-live-saved.dungeon`));
      const liveHash = hash(mapFile(item));
      results.push({ edge: item.edge, source: 10, crop: item.remaining,
        live: item.live, cropHash, liveHash,
        cropCells: savedCrop.smartTiles.map(({ x, y }) => [x, y]),
        liveCells: restored.document.smartTiles.map(({ x, y }) => [x, y]),
        restoredSize: [restored.document.settings.width,
          restored.document.settings.height] });
      await page.screenshot({ path: path.join(out, `${item.edge}-restored.png`) });
      checks.push(`DD-038 ${item.edge} GUI crop/save/re-expand ${10}→${item.remaining}→${item.live}`);
    }
    fs.writeFileSync(baselineFile, JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(out, "smart-tiles-result.json"),
      JSON.stringify({ mode: "edit", results }, null, 2));
  }
  async function reopen() {
    const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
    const results = [];
    for (const item of CASES) {
      const original = baseline.find((entry) => entry.edge === item.edge);
      assert.ok(original);
      assert.equal(hash(mapFile(item, true)), original.cropHash);
      await openMap(item, true);
      const before = await editor();
      assert.equal(before.document.smartTiles.length, item.remaining);
      assert.equal(before.activeCells, item.remaining);
      await resize(item, item.expand);
      const restored = await editor();
      assert.equal(restored.document.smartTiles.length, item.remaining);
      assert.equal(restored.activeCells, item.remaining);
      await save();
      fs.copyFileSync(mapFile(item, true),
        path.join(out, `${item.edge}-fresh-saved.dungeon`));
      results.push({ edge: item.edge, crop: item.remaining,
        fresh: restored.document.smartTiles.length,
        freshCells: restored.document.smartTiles.map(({ x, y }) => [x, y]),
        restoredSize: [restored.document.settings.width,
          restored.document.settings.height], hash: hash(mapFile(item, true)) });
      checks.push(`DD-038 ${item.edge} fresh crop re-open and expansion keeps ${item.remaining} cells`);
    }
    fs.writeFileSync(path.join(out, "smart-tiles-result.json"),
      JSON.stringify({ mode: "reopen", results }, null, 2));
  }
  return { edit, reopen };
};
