const OPTIONS = [
  { name: "both-on", wall: true, object: true },
  { name: "wall-off", wall: false, object: true },
  { name: "object-off", wall: true, object: false },
  { name: "both-off", wall: false, object: false },
];
const folder = "Dungeons/Phase1-Shadow-Matrix";
const file = (name) => `${folder}/${name}.dungeon`;

module.exports = ({ page, fs, path, assert, crypto, root, qa, vault, out, checks,
  chooseTool }) => {
  const baseline = path.join(qa, "phase1-shadow-matrix-baseline.json");
  const hash = (name) => crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(vault, file(name)))).digest("hex");
  const editor = () => page.locator(".dungeon-native-editor:visible").last();
  const state = () => page.evaluate(() => {
    const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)?.view.editor;
    return e && { document: e.session.document(), history: e.session.historySize,
      dirty: e.session.dirty };
  });
  async function open(name) {
    await page.evaluate(async (target) => app.workspace.getLeaf("tab").openFile(
      app.vault.getAbstractFileByPath(target)), file(name));
    await editor().locator(".dn-canvas canvas").waitFor({ state: "visible" });
    if (!(await editor().evaluate((el) => el.classList.contains("dn-maximized"))))
      await editor().getByRole("button", { name: "Maximieren", exact: true }).click();
    await editor().getByRole("button", { name: "Einpassen", exact: true }).click();
    await page.waitForTimeout(400);
  }
  async function capture(name, prefix) {
    await open(name);
    const current = await state();
    assert.equal(current.dirty, false);
    assert.equal(current.history, 0);
    assert.equal(current.document.entities.length, 3);
    await editor().locator(".dn-canvas canvas").screenshot({ path: path.join(out,
      `${prefix}-${name}.png`) });
    return { document: current.document, hash: hash(name) };
  }
  async function edit() {
    await page.evaluate(async ({ folder, options }) => {
      if (!app.vault.getAbstractFileByPath("Dungeons"))
        await app.vault.createFolder("Dungeons");
      await app.vault.createFolder(folder);
      for (const option of options) {
        const doc = {
          format: "dungeon-map", version: 4, id: `phase1-shadow-${option.name}`,
          settings: { name: `Phase1 Shadow ${option.name}`, width: 8, height: 8,
            feetPerField: 5, wallShadows: true, objectShadows: true,
            buildingWear: 0, nativeBuildingWear: false,
            buildingWearMode: "none", assetPacks: [] },
          floors: [{ id: "floor-1", name: "Ground", elevation: 0 }],
          entities: [
            { id: "floor", kind: "building", floorId: "floor-1", layer: 100,
              polygons: [{ outer: [{ x: 0, y: 0 }, { x: 6, y: 0 },
                { x: 6, y: 6 }, { x: 0, y: 6 }], holes: [] }],
              fill: 0xb2a28f, wall: 0xffffff, wallWidth: 0 },
            { id: "wall", kind: "wall", floorId: "floor-1", layer: 700,
              points: [{ x: 0, y: 0 }, { x: 6, y: 0 },
                { x: 6, y: 6 }, { x: 0, y: 6 }], closed: true,
              smooth: false, color: 0xffffff, width: 0.2,
              shadow: option.wall },
            { id: "object", kind: "object", floorId: "floor-1", layer: 200,
              x: 3, y: 3, rotation: 0, width: 0.7, height: 0.7,
              color: 0x61788d, label: "", flip: false,
              shadow: option.object },
          ],
          content: { definitions: [], occurrences: [], routes: [], archive: [] },
        };
        await app.vault.create(`${folder}/${option.name}.dungeon`,
          JSON.stringify(doc));
      }
    }, { folder, options: OPTIONS });
    const rows = [];
    for (const option of OPTIONS) rows.push({ name: option.name,
      ...await capture(option.name, "edit") });
    fs.writeFileSync(baseline, JSON.stringify(rows, null, 2));
    fs.writeFileSync(path.join(out, "shadow-matrix.json"), JSON.stringify(
      rows.map(({ name, hash }) => ({ name, hash })), null, 2));
    checks.push("DD-006 four per-entity shadow combinations render in isolated V4 maps");
  }
  async function reopen() {
    const prior = JSON.parse(fs.readFileSync(baseline, "utf8"));
    for (const expected of prior) {
      const actual = await capture(expected.name, "reopen");
      assert.deepEqual(actual.document, expected.document);
      assert.equal(actual.hash, expected.hash);
    }
    checks.push("DD-006 four shadow maps reopen with identical documents and file hashes");
  }
  const uiMap = "ui-choice";
  async function at(point) {
    return page.evaluate((position) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")
        .at(-1).view.editor.renderer;
      const bounds = renderer.canvas.getBoundingClientRect();
      return { x: bounds.x + renderer.camera.x + position.x * renderer.camera.scale,
        y: bounds.y + renderer.camera.y + position.y * renderer.camera.scale };
    }, point);
  }
  async function click(point) {
    const position = await at(point);
    await page.mouse.click(position.x, position.y);
  }
  async function uiEdit() {
    await require("./phase3-fixtures.cjs")({ fs, crypto, assert })
      .load(page, { qaWall: false });
    await page.evaluate(async ({ target, folder }) => {
      if (!app.vault.getAbstractFileByPath("Dungeons"))
        await app.vault.createFolder("Dungeons");
      await app.vault.createFolder(folder);
      const doc = {
        format: "dungeon-map", version: 4, id: "phase1-shadow-ui",
        settings: { name: "Phase1 Shadow UI", width: 8, height: 8,
          feetPerField: 5, wallShadows: true, objectShadows: true,
          buildingWear: 0, nativeBuildingWear: false,
          buildingWearMode: "none", assetPacks: [] },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0 }],
        entities: [{ id: "floor", kind: "building", floorId: "floor-1",
          layer: 100, polygons: [{ outer: [{ x: 0, y: 0 }, { x: 7, y: 0 },
            { x: 7, y: 7 }, { x: 0, y: 7 }], holes: [] }],
          fill: 0xb2a28f, wall: 0xffffff, wallWidth: 0 }],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      };
      await app.vault.create(target, JSON.stringify(doc));
    }, { target: file(uiMap), folder });
    await open(uiMap);
    await chooseTool("Wand");
    await page.getByRole("checkbox", { name: "Schatten" }).check();
    await click({ x: 1, y: 1 });
    await click({ x: 3, y: 1 });
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.document()
      .entities.filter((v) => v.kind === "wall").length === 1);
    assert.equal((await state()).document.entities.find((v) => v.kind === "wall")
      .shadow, true);
    await chooseTool("Wand");
    await page.getByRole("checkbox", { name: "Schatten" }).uncheck();
    await click({ x: 1, y: 5 });
    await click({ x: 3, y: 5 });
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.document()
      .entities.filter((v) => v.kind === "wall").length === 2);
    let current = await state();
    assert.deepEqual(current.document.entities.filter((v) => v.kind === "wall")
      .map((v) => v.shadow), [true, false]);
    const packPath = path.resolve(root, "../dungeon-auswertung/tests/fixtures/" +
      "colorable-object-alpha-solid-probe/own-object-color.dungeondraft_pack");
    const packBytes = fs.readFileSync(packPath);
    assert.equal(crypto.createHash("sha256").update(packBytes).digest("hex"),
      "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088");
    await page.evaluate(async (encoded) => {
      const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
      const plugin = app.plugins.getPlugin("dungeon-editor");
      const [record] = await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
      const session = app.workspace.getLeavesOfType("dungeon-native-map")
        .at(-1).view.editor.session;
      const before = session.settings;
      session.execute({ label: "QA-Objektpaket aktivieren", settings: {
        before, after: { ...before, assetPacks: [record.metadata.id] } } });
    }, packBytes.toString("base64"));
    await chooseTool("Möbel");
    const asset = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
      .listAssets().find((item) => item.kind === "object" &&
        item.name === "QA Object Color")?.id);
    assert.ok(asset, "An object asset must be available for the UI probe");
    const search = page.getByRole("textbox", { name: "Objektbibliothek durchsuchen" });
    await search.fill("QA Object Color");
    await search.press("Enter");
    await page.locator(".dn-object-library")
      .getByRole("button", { name: "QA Object Color" }).click();
    await page.getByRole("checkbox", { name: "Shadow" }).check();
    await click({ x: 2, y: 2 });
    await chooseTool("Möbel");
    await page.getByRole("checkbox", { name: "Shadow" }).uncheck();
    await click({ x: 2, y: 4 });
    current = await state();
    assert.deepEqual(current.document.entities.filter((v) => v.kind === "object")
      .map((v) => v.shadow), [true, false]);
    const beforeUndo = current.document;
    await editor().getByRole("button", { name: "Rückgängig" }).click();
    await page.waitForFunction(() => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.document()
      .entities.filter((v) => v.kind === "object").length === 1);
    await editor().getByRole("button", { name: "Wiederholen" }).click();
    await page.waitForFunction(() => app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.document()
      .entities.filter((v) => v.kind === "object").length === 2);
    assert.deepEqual((await state()).document, beforeUndo);
    await editor().getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.getLeavesOfType(
      "dungeon-native-map").at(-1)?.view.editor.session.dirty);
    await editor().locator(".dn-canvas canvas").screenshot({ path: path.join(out,
      "ui-choice-edit.png") });
    fs.writeFileSync(path.join(qa, "phase1-shadow-ui-baseline.json"), JSON.stringify({
      document: (await state()).document, hash: hash(uiMap), asset }, null, 2));
    checks.push("DD-006 UI shadow choices apply independently to new walls and objects; undo redo and save preserve the result");
  }
  async function uiReopen() {
    const before = JSON.parse(fs.readFileSync(path.join(qa,
      "phase1-shadow-ui-baseline.json"), "utf8"));
    await open(uiMap);
    assert.deepEqual((await state()).document, before.document);
    assert.equal(hash(uiMap), before.hash);
    await editor().locator(".dn-canvas canvas").screenshot({ path: path.join(out,
      "ui-choice-reopen.png") });
    checks.push("DD-006 UI-created shadow values reopen with identical document and file hash");
  }
  return { edit, reopen, uiEdit, uiReopen };
};
