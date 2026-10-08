const MAP = "Dungeons/Parity/Cloth-Grips.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    const camera = editor.renderer.camera;
    return { object: editor.session.document().entities.find((e) => e.id === "cloth-1"),
      selection: [...editor.selection], history: editor.session.historySize,
      snap: editor.snapEnabled, camera: { x: camera.x, y: camera.y, scale: camera.scale } };
  });
  const screen = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const rect = renderer.canvas.getBoundingClientRect();
    return { x: rect.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: rect.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const dragPixels = async (start, dx, dy) => {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
    await page.mouse.up();
  };
  const snapshot = async (name) => {
    fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(await state(), null, 2));
    await page.screenshot({ path: path.join(out, name + ".png") });
  };
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Auswahl");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await page.evaluate(() => {
      const renderer = app.workspace.activeLeaf.view.editor.renderer;
      renderer.zoom(64 / renderer.camera.scale);
    });
    assert.equal((await state()).camera.scale, 64);
  };
  const select = async () => {
    const pos = await screen({ x: 3.5, y: 3.5 });
    await page.mouse.click(pos.x, pos.y);
    assert.deepEqual((await state()).selection, ["cloth-1"]);
  };
  const corner = async (object) => {
    const pos = await screen({ x: object.x + (object.width + 0.75) / 2,
      y: object.y + (object.height + 0.7578125) / 2 });
    return { x: pos.x - 1, y: pos.y - 1 };
  };
  async function edit() {
    const pck = fixtures.verifyPck();
    await page.evaluate(async (pck) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pck), pck);
    const cloth = await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").listAssets([], true)
        .find((asset) => asset.kind === "object" &&
          asset.files.image?.endsWith("/textures/objects/activities/administration/cloth_01.png")));
    assert(cloth?.objectSizeFields);
    fs.writeFileSync(path.join(out, "cloth-asset.json"), JSON.stringify(cloth, null, 2));
    await page.evaluate(async () => {
      if (!app.vault.getAbstractFileByPath("Dungeons/Parity"))
        await app.vault.createFolder("Dungeons/Parity");
    });
    await page.evaluate(async ({ name, cloth }) => {
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase6-cloth-grips",
        settings: { name: "Cloth Grips", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [{ id: "cloth-1", kind: "object", floorId: "floor-1",
          x: 3.5, y: 3.5, rotation: 0, width: cloth.objectSizeFields.width * 4,
          height: cloth.objectSizeFields.height * 4, color: 0x61788d,
          label: "", layer: 100, flip: false, assetId: cloth.id }],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, { name: MAP, cloth });
    await open();
    const initial = await state();
    assert.equal(initial.snap, true);
    assert.equal(initial.history, 0);
    await select();
    await snapshot("dd-030-25-cloth-before");
    await dragPixels(await corner(initial.object), 20, 20);
    const scaled = await state();
    assert(scaled.object.width > initial.object.width);
    assert(scaled.object.height > initial.object.height);
    assert(scaled.object.x > initial.object.x);
    assert(scaled.object.y > initial.object.y);
    assert.equal(scaled.history, initial.history + 1);
    const nativeScale = 4.49536;
    assert(Math.abs(4 * scaled.object.width / initial.object.width - nativeScale) < 0.02);
    assert(Math.abs(scaled.object.x - 926.341 / 256) < 0.01);
    assert(Math.abs(scaled.object.y - 936.248 / 256) < 0.01);
    await snapshot("dd-030-25-cloth-diagonal");
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state()).object, initial.object);
    assert.deepEqual((await state()).selection, []);
    await select();
    const beforeHorizontal = await state();
    await dragPixels(await corner(beforeHorizontal.object), 20, 0);
    assert.deepEqual((await state()).object, beforeHorizontal.object);
    await snapshot("dd-030-25-cloth-horizontal");
    checks.push("DD-030.25 Cloth scale at 64 pixels per field grows diagonally and ignores a horizontal corner drag");
    const center = await screen({ x: 3.5, y: 3.5 });
    await dragPixels({ x: center.x + 102, y: center.y }, -102, 102);
    const rotated = await state();
    assert(Math.abs(rotated.object.rotation - 1.421652) < 0.02);
    assert(Math.abs(rotated.object.x - 894 / 256) < 0.01);
    assert(Math.abs(rotated.object.y - 894.029 / 256) < 0.01);
    assert.equal(rotated.object.width, initial.object.width);
    assert.equal(rotated.object.height, initial.object.height);
    assert.equal(rotated.history, beforeHorizontal.history + 1);
    await snapshot("dd-030-24-cloth-outer-rotation");
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state()).object, initial.object);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.deepEqual((await state()).object, rotated.object);
    checks.push("DD-030.24 Cloth outer rotation is one reversible drag at native zoom and Snap");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(saved.entities.find((e) => e.id === "cloth-1"), rotated.object);
    fs.writeFileSync(path.join(out, "cloth-grips-saved.json"), JSON.stringify(saved, null, 2));
  }
  async function reopen() {
    await open();
    const current = await state();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(current.object, saved.entities.find((e) => e.id === "cloth-1"));
    assert.deepEqual(current.selection, []);
    await snapshot("cloth-grips-reopened");
    checks.push("Fresh Obsidian process reloads the Cloth grip map unchanged");
  }
  return { edit, reopen };
};
