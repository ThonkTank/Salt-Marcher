const MAP = "Dungeons/Phase1-Map-Info/Karte.dungeon";
const EMPTY_PACK_MAP = "Dungeons/Phase1-Map-Info/Karte-ohne-Paket.dungeon";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks }) => {
  const baseline = path.join(qa, "phase1-map-info-baseline.json");
  const selectedBaseline = path.join(qa, "phase1-map-info-selected-pack.json");
  const mapFile = path.join(vault, MAP);
  const hash = (file = MAP) => crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(vault, file))).digest("hex");
  const state = () => page.evaluate(() => {
    const session = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
      ?.view.editor.session;
    return session && { document: session.document(),
      history: session.historySize, canUndo: session.canUndo,
      canRedo: session.canRedo, dirty: session.dirty };
  });
  async function openInfo() {
    const menu = page.locator(".dungeon-native-editor:visible").last()
      .locator(".dn-popover-menu");
    await menu.locator("summary").click();
    await menu.getByRole("button", { name: "Karteninformationen" }).click();
    const info = page.locator(".modal:visible")
      .filter({ hasText: "Karteninformationen" }).last();
    await info.waitFor({ state: "visible" });
    return info;
  }
  async function save() {
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor.session.dirty);
  }
  async function checkInfo(expectedPath, expectedPack) {
    const info = await openInfo();
    const text = await info.innerText();
    assert.match(text, /8 × 8 Felder/);
    assert.ok(text.includes(expectedPath));
    if (expectedPack) assert.match(text, /1\. QA Wall Pack · Independent QA/);
    else await info.getByText("keine", { exact: true })
      .waitFor({ state: "visible" });
    return info;
  }
  async function edit() {
    await page.evaluate(async (file) => {
      if (!app.vault.getAbstractFileByPath("Dungeons"))
        await app.vault.createFolder("Dungeons");
      await app.vault.createFolder("Dungeons/Phase1-Map-Info");
      const created = await app.vault.create(file, JSON.stringify({
        format: "dungeon-map", version: 4, id: "phase1-map-info-map",
        settings: { name: "Phase1 Map Info", width: 8, height: 8,
          feetPerField: 5, wallShadows: true, objectShadows: true,
          buildingWear: 0, nativeBuildingWear: true,
          buildingWearMode: "grime", assetPacks: [] },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0 }],
        entities: [{ id: "object", kind: "object", floorId: "floor-1",
          x: 5, y: 5, rotation: 0, width: 1, height: 1,
          color: 0x6688aa, label: "", layer: 100, flip: false }],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }));
      await app.workspace.getLeaf("tab").openFile(created);
    }, MAP);
    await page.locator(".dn-canvas canvas").last()
      .waitFor({ state: "visible" });
    await page.evaluate(() => {
      const session = app.workspace.getLeavesOfType("dungeon-native-map")
        .at(-1).view.editor.session;
      const before = session.settings;
      session.execute({ label: "Vorherige Aktion", settings: { before,
        after: { ...before, wallShadows: false } } });
    });
    await save();
    const before = await state(), beforeHash = hash();
    assert.equal(before.history, 1);
    assert.equal(before.canUndo, true);
    let info = await checkInfo(mapFile, false);
    await page.screenshot({ path: path.join(out, "map-info-empty-pack.png") });
    await info.getByRole("button", { name: "Schließen" }).click();
    assert.deepEqual(await state(), before);
    assert.equal(hash(), beforeHash);
    info = await checkInfo(mapFile, false);
    const bounds = await info.boundingBox();
    assert.ok(bounds);
    await page.mouse.click(bounds.x + bounds.width - 37, bounds.y + 21);
    assert.deepEqual(await state(), before);
    assert.equal(hash(), beforeHash);
    fs.copyFileSync(mapFile, path.join(vault, EMPTY_PACK_MAP));
    fs.writeFileSync(baseline, JSON.stringify({ document: before.document,
      hash: beforeHash }, null, 2));

    const { load } = require("./phase3-fixtures.cjs")({ fs, crypto, assert });
    await load(page, { qaWall: true });
    await page.evaluate(() => {
      const session = app.workspace.getLeavesOfType("dungeon-native-map")
        .at(-1).view.editor.session;
      const before = session.settings;
      session.execute({ label: "Paket wählen", settings: { before,
        after: { ...before, assetPacks: ["QAWall01"] } } });
    });
    await save();
    const selected = await state(), selectedHash = hash();
    assert.deepEqual(selected.document.settings.assetPacks, ["QAWall01"]);
    info = await checkInfo(mapFile, true);
    await page.screenshot({ path: path.join(out, "map-info-selected-pack.png") });
    await info.getByRole("button", { name: "Schließen" }).click();
    assert.deepEqual(await state(), selected);
    assert.equal(hash(), selectedHash);
    fs.writeFileSync(selectedBaseline, JSON.stringify({
      document: selected.document, hash: selectedHash }, null, 2));
    checks.push("DD-039 8×8 Map Information shows size, path, empty pack and selected pack without resize");
    checks.push("DD-039 Close and X preserve saved map and prior Undo state");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(baseline, "utf8"));
    await page.evaluate(async (file) =>
      app.workspace.getLeaf("tab")
        .openFile(app.vault.getAbstractFileByPath(file)), EMPTY_PACK_MAP);
    await page.locator(".dn-canvas canvas").last()
      .waitFor({ state: "visible" });
    assert.deepEqual((await state()).document, prior.document);
    assert.equal(hash(EMPTY_PACK_MAP), prior.hash);
    let info = await checkInfo(path.join(vault, EMPTY_PACK_MAP), false);
    await info.getByRole("button", { name: "Schließen" }).click();
    const selected = JSON.parse(fs.readFileSync(selectedBaseline, "utf8"));
    await page.evaluate(async (file) =>
      app.workspace.getLeaf("tab")
        .openFile(app.vault.getAbstractFileByPath(file)), MAP);
    await page.locator(".dn-canvas canvas").last()
      .waitFor({ state: "visible" });
    assert.deepEqual((await state()).document, selected.document);
    assert.equal(hash(), selected.hash);
    info = await checkInfo(mapFile, true);
    await page.screenshot({ path: path.join(out, "map-info-selected-pack-fresh.png") });
    await info.getByRole("button", { name: "Schließen" }).click();
    checks.push("DD-039 fresh host process reads both pack states without resize");
  }
  return { edit, reopen };
};
