const MAP = "Dungeons/Parity/Repair2-Library.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const nativePath = process.env.DUNGEON_NATIVE_OBJECT_ORDER;
  assert(nativePath, "DUNGEON_NATIVE_OBJECT_ORDER is required");
  const native = JSON.parse(fs.readFileSync(nativePath, "utf8"));
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    return { assetId: editor.settings.object.assetId,
      selectedId: editor.objectLibrary.state.selectedId,
      objects: editor.session.document().entities.filter((e) => e.kind === "object"),
      history: editor.session.historySize };
  });
  const screen = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const rect = renderer.canvas.getBoundingClientRect();
    return { x: rect.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: rect.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const place = async (point) => {
    const pos = await screen(point);
    await page.mouse.move(pos.x, pos.y);
    await page.mouse.click(pos.x, pos.y);
    return (await state()).objects.at(-1);
  };
  const wheel = async (point, deltaY) => {
    const pos = await screen(point);
    await page.mouse.move(pos.x, pos.y);
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, deltaY);
    await page.keyboard.up("Shift");
  };
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  };
  async function edit() {
    const pck = fixtures.verifyPck();
    await page.evaluate(async (pck) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pck), pck);
    await page.evaluate(async (name) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase6-repair2-library",
        settings: { name: "Repair2 Library", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await open();
    const tileIds = await page.locator(".dn-object-library-tile")
      .evaluateAll((tiles) => tiles.map((tile) => tile.dataset.assetId));
    const assets = await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").listAssets([], true)
        .filter((asset) => asset.kind === "object")
        .map((asset) => ({ id: asset.id, path: asset.files.image })));
    const pathById = new Map(assets.map((asset) => [asset.id, asset.path]));
    const paths = tileIds.map((id) => pathById.get(id));
    assert.equal(paths.length, native.count);
    assert(paths.every((value) => typeof value === "string"));
    const hash = crypto.createHash("sha256").update(paths.join("\n") + "\n").digest("hex");
    const firstMismatch = paths.findIndex((value, index) => value !== native.items[index]);
    fs.writeFileSync(path.join(out, "host-all-order.json"), JSON.stringify({
      count: paths.length, sha256Newline: hash, nativeSha256Newline: native.sha256Newline,
      firstMismatch, paths, catalogPaths: assets.map((asset) => asset.path),
    }, null, 2));
    assert.equal(firstMismatch, -1,
      `All order differs at ${firstMismatch}: ${paths[firstMismatch]} vs ${native.items[firstMismatch]}`);
    assert.equal(hash, native.sha256Newline);
    checks.push("DD-026.24 complete 1792-item host All order matches native ItemList metadata and SHA-256");

    const tile = (index) => page.locator(".dn-object-library-tile").nth(index);
    const choice = async (index) => {
      await tile(index).click();
      const current = await state();
      assert.equal(pathById.get(current.assetId), native.items[index]);
    };
    const cycled = async (start, deltaY, expected, point) => {
      await choice(start);
      await wheel(point, deltaY);
      const current = await state();
      assert.equal(pathById.get(current.assetId), native.items[expected]);
      const object = await place(point);
      assert.equal(pathById.get(object.assetId), native.items[expected]);
      return { start, deltaY, expected, source: native.items[expected], object };
    };
    const results = [];
    results.push(await cycled(0, -120, 1791, { x: 2, y: 2 }));
    results.push(await cycled(0, 120, 1, { x: 3, y: 2 }));
    results.push(await cycled(1791, 120, 0, { x: 4, y: 2 }));
    results.push(await cycled(1791, -120, 1790, { x: 5, y: 2 }));
    await choice(896);
    const middle = await place({ x: 2, y: 4 });
    assert.equal(pathById.get(middle.assetId), native.items[896]);
    results.push({ start: 896, expected: 896, source: native.items[896], object: middle });
    results.push(await cycled(896, 120, 897, { x: 3, y: 4 }));
    results.push(await cycled(896, -120, 895, { x: 4, y: 4 }));
    await choice(896);
    const repeated = await place({ x: 5, y: 4 });
    assert.equal(pathById.get(repeated.assetId), native.items[896]);
    results.push({ start: 896, expected: 896, source: native.items[896], object: repeated });
    fs.writeFileSync(path.join(out, "library-cycle-pair.json"), JSON.stringify(results, null, 2));
    await page.screenshot({ path: path.join(out, "library-cycle-pair.png") });
    checks.push("DD-026.24 first, middle, last and both Shift-wheel boundary directions place matching textures");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => {
      const editor = app.workspace.activeLeaf.view.editor;
      return !editor.saving && !editor.session.dirty;
    });
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    fs.copyFileSync(path.join(vault, MAP), path.join(out, "saved-repair2-library.dungeon"));
  }
  async function reopen() {
    await open();
    const current = await state();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(current.objects, saved.entities.filter((entity) => entity.kind === "object"));
    assert.equal(current.objects.length, 8);
    await page.screenshot({ path: path.join(out, "library-reopened.png") });
    checks.push("DD-026.24 fresh process reloads eight boundary and middle object textures");
  }
  return { edit, reopen };
};
