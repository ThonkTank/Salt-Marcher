const PCK = "/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64/Dungeondraft.pck";
const PCK_SHA = "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60";
const MAP = "Dungeons/Parity/Object-Placement.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks, chooseTool, waitForFileAbsent }) => {
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    return { entities: editor.session.document().entities.filter((e) => e.kind === "object"),
      order: [...editor.session.entities.keys()], history: editor.session.historySize,
      tool: editor.tool, defaults: editor.settings.object,
      sorting: editor.settings.objectSorting, scale: editor.settings.objectScale };
  });
  const world = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const rect = renderer.canvas.getBoundingClientRect();
    return { x: rect.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: rect.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const clickWorld = async (point) => {
    const pos = await world(point);
    await page.mouse.move(pos.x, pos.y);
    await page.mouse.click(pos.x, pos.y);
  };
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  };
  async function edit() {
    const bytes = fs.readFileSync(PCK);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), PCK_SHA);
    await page.evaluate(async (pck) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pck), PCK);
    await page.evaluate(async (name) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase5-objects",
        settings: { name: "Object Placement", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await open();
    const initial = await state();
    const asset = await page.evaluate(() => {
      const editor = app.workspace.activeLeaf.view.editor;
      return app.plugins.getPlugin("dungeon-editor").listAssets([], true)
        .find((item) => item.id === editor.settings.object.assetId);
    });
    assert.match(asset.name, /Atlas Globe 01/);
    assert.deepEqual(asset.objectSizeFields, { width: 87 / 256, height: 88 / 256 });
    assert.equal(initial.defaults.layer, 100);
    assert.equal(initial.sorting, "over");
    assert.equal(initial.scale, 1);
    assert.equal(initial.defaults.width, asset.objectSizeFields.width);
    await page.getByRole("button", { name: "Objektfarbe #809dab" }).click();
    await clickWorld({ x: 3, y: 3 });
    const first = (await state()).entities[0];
    assert.equal(first.color, 0x809dab);
    assert.equal(first.width, 87 / 256);
    await page.locator(".dn-object-sorting button").nth(1).click();
    await clickWorld({ x: 3, y: 3 });
    let current = await state();
    assert.deepEqual(current.order, [current.entities[0].id, first.id]);
    assert.equal(current.entities[1].color, first.color);
    checks.push("Natural size, blue preset and Under preserve prior object and stack order");

    await page.getByRole("combobox", { name: "Layer" }).selectOption("400");
    await page.getByRole("spinbutton", { name: "Rotation", exact: true }).fill("45");
    await page.getByRole("spinbutton", { name: "Rotation", exact: true }).press("Tab");
    await page.getByRole("spinbutton", { name: "Scale", exact: true }).fill("1.99");
    await page.getByRole("spinbutton", { name: "Scale", exact: true }).press("Tab");
    await page.getByRole("checkbox", { name: "Shadow" }).uncheck();
    await page.getByRole("checkbox", { name: "Block Light" }).check();
    await clickWorld({ x: 5, y: 4 });
    current = await state();
    const transformed = current.entities.find((e) => e.layer === 400);
    assert(transformed);
    assert.equal(transformed.rotation, Math.PI / 4);
    assert.equal(transformed.width, 87 / 256 * 1.99);
    assert.equal(transformed.height, 88 / 256 * 1.99);
    assert.equal(transformed.shadow, false);
    assert.equal(transformed.blocksLight, true);
    assert.equal(current.entities.find((e) => e.id === first.id).layer, 100);
    await page.keyboard.press("Escape");
    assert.equal((await state()).tool, "object");
    checks.push("Layer, rotation, uniform scale, shadow, Block Light and resting Escape affect the next instance");

    const pickerButton = page.getByRole("button", { name: "Objektfarbe RGBA öffnen" });
    await pickerButton.click();
    const hex = page.getByRole("textbox", { name: "Hex ARGB" });
    const initialHex = await hex.inputValue();
    await page.locator(".dn-object-rgba-field").click({ position: { x: 120, y: 35 } });
    assert.notEqual(await hex.inputValue(), initialHex);
    const afterField = await hex.inputValue();
    await page.locator(".dn-object-rgba-picker input[aria-label='Objektfarbe Farbton']")
      .click({ position: { x: 14, y: 105 } });
    assert.notEqual(await hex.inputValue(), afterField);
    for (const [channel, value] of [["R", "64"], ["G", "128"], ["B", "192"], ["A", "125"]]) {
      await page.getByRole("spinbutton", { name: channel, exact: true }).fill(value);
    }
    assert.equal(await hex.inputValue(), "7d4080c0");
    await hex.fill("xyz");
    await hex.press("Tab");
    assert.equal(await hex.inputValue(), "7d4080c0");
    checks.push("Color field, hue, RGBA channels and invalid Hex preserve one coherent live value");
    await hex.fill("804080c0");
    await hex.press("Tab");
    assert.equal(await page.getByRole("spinbutton", { name: "A", exact: true }).inputValue(), "128");
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await pickerButton.click();
    await hex.fill("ff0000");
    await hex.press("Tab");
    assert.equal(await page.getByRole("spinbutton", { name: "A", exact: true }).inputValue(), "255");
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await clickWorld({ x: 6, y: 5 });
    current = await state();
    assert.equal(current.entities.find((e) => e.color === 0xff0000).alpha, 255);
    assert.equal(current.entities.find((e) => e.id === first.id).color, 0x809dab);
    checks.push("Eight-digit Hex retains alpha; six-digit Hex becomes opaque and later placements leave older color intact");

    await pickerButton.click();
    await hex.fill("4080c0");
    await hex.press("Tab");
    await page.keyboard.press("Escape");
    assert.equal((await state()).defaults.color, 0x4080c0);
    assert.equal((await state()).tool, "object");
    checks.push("Picker Escape retains edited color and keeps the Object Tool active");

    await pickerButton.click();
    await page.getByRole("button", { name: "Objektfarbe Pipette" }).click();
    const sample = await world({ x: 1, y: 1 });
    await page.mouse.move(sample.x, sample.y);
    const hovered = await hex.inputValue();
    assert.notEqual(hovered.toLowerCase(), "ff0000");
    const count = (await state()).entities.length;
    await page.mouse.click(sample.x, sample.y);
    assert.equal((await state()).entities.length, count);
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    checks.push("Inner pipette updates on hover and samples on click without placing an object");

    await clickWorld({ x: 6, y: 2 });
    const beforeUndo = await state();
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.equal((await state()).entities.length, beforeUndo.entities.length - 1);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.deepEqual((await state()).entities, beforeUndo.entities);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    fs.writeFileSync(path.join(out, "object-state.json"), JSON.stringify(await state(), null, 2));
    await page.screenshot({ path: path.join(out, "object-placement.png") });
    checks.push("Repeated placement is undoable and redoable with exact saved object values");
  }
  async function reopen() {
    await open();
    const current = await state();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, "Dungeons/Parity/Object-Placement.dungeon")));
    assert.deepEqual(current.entities, saved.entities.filter((e) => e.kind === "object"));
    assert.equal(current.entities.length, 5);
    await page.screenshot({ path: path.join(out, "object-reopen.png") });
    checks.push("Fresh Obsidian process loads five objects, dimensions, layer and color unchanged");
  }
  return { edit, reopen };
};
