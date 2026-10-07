module.exports = ({ page, fs, path, assert, crypto, qa, out, checks,
  chooseTool }) => {
  const pckPath = "/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64/Dungeondraft.pck";
  const packPath = "/home/aaron/.cache/dungeon-native-qa/parity-phase3-implementation-20261007/native-package/runs/20261007-025609-1253642/assets/qa-wall-pack.dungeondraft_pack";
  const files = ["Dungeons/Parity/Point-Style-QA.dungeon",
    "Dungeons/Parity/Point-Style-Battlements.dungeon"];
  const insertFile = "Dungeons/Parity/Point-Style-Insert.dungeon";
  const ellipseFile = "Dungeons/Parity/Point-Style-Ellipse.dungeon";
  const savedPath = path.join(qa, "parity-phase3-point-style-saved.json");
  const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    return editor && { document: editor.session.document(),
      history: editor.session.historySize, dirty: editor.session.dirty,
      selected: editor.selected };
  });
  const world = point => page.evaluate(point => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer,
      box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  async function open(file) {
    await page.evaluate(async file =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file)),
    file);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  }
  async function edit() {
    assert.equal(hash(fs.readFileSync(pckPath)),
      "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60");
    const pack = fs.readFileSync(packPath);
    assert.equal(hash(pack),
      "eaad533f4da8880bf8c0339d9d6ae66dd3d8e1c1d60917288ab0a91242d51ad9");
    const assets = await page.evaluate(async ({ pckPath, pack, files }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.useNativeAssetArchive(pckPath);
      await plugin.assets.add([new Blob([Uint8Array.from(atob(pack),
        char => char.charCodeAt(0))])]);
      await plugin.reloadAssets();
      const catalog = plugin.listAssets(["QAWall01"], true),
        qa = catalog.find(asset => asset.kind === "wall" && asset.name === "QA Wall"),
        battlements = catalog.find(asset => asset.kind === "wall" &&
          asset.files.image?.endsWith("/battlements.png")),
        wood = catalog.find(asset => asset.kind === "tileset" &&
          asset.files.image?.endsWith("/tileset_wood_vertical.png"));
      if (!qa || !battlements || !wood) throw new Error("Building assets missing");
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      for (const file of files) await app.vault.create(file, JSON.stringify({
        format: "dungeon-map", version: 3, id: file,
        settings: { name: "Point Style", width: 8, height: 8,
          feetPerField: 5, assetPacks: ["QAWall01"], builtInAssets: true,
          wallShadows: true, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
        entities: [{ id: "qa-building", kind: "building", floorId: "floor-1",
          polygons: [{ outer: [
            { x: 3, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 1 },
            { x: 3, y: 1 }, { x: 4, y: 1 },
          ], holes: [] }],
          layer: 200, fill: 0xb28f6f, floorAlpha: 255,
          wall: 0xffffff, wallAlpha: 255, wallBevel: true,
          wallWidth: 0.2, wallAssetId: qa.id,
          material: { assetId: wood.id, assetPart: "image",
            tileSize: wood.nativeTileSizeFields ?? 4, tint: 0xb28f6f, rotation: 0 } }],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }));
      return { qa: qa.id, battlements: battlements.id, wood: wood.id };
    }, { pckPath, pack: pack.toString("base64"), files });
    fs.writeFileSync(path.join(out, "assets.json"), JSON.stringify({
      ...assets, pckSha256: hash(fs.readFileSync(pckPath)),
      packSha256: hash(pack) }, null, 2));
    const saved = [];
    for (const [index, file] of files.entries()) {
      await open(file);
      await chooseTool("Punkte");
      await page.evaluate(async () =>
        app.workspace.activeLeaf.view.editor.select("qa-building"));
      const wallName = index ? "Battlements" : "QA Wall",
        wallId = index ? assets.battlements : assets.qa,
        gallery = page.getByRole("group", { name: "Wandstil" });
      await gallery.getByRole("button", { name: wallName, exact: true }).click();
      assert.equal(await gallery.getByRole("button", {
        name: wallName, exact: true }).getAttribute("aria-pressed"), "true");
      const before = await state();
      assert.equal(before.document.entities[0].wallAssetId, assets.qa);
      await page.locator(".dn-canvas canvas").focus();
      const point = await world({ x: 3, y: 1 });
      await page.mouse.move(point.x + 10, point.y + 10);
      await page.mouse.move(point.x, point.y);
      await page.waitForFunction(() => {
        const hover = app.workspace.activeLeaf?.view?.editor?.renderer?.buildingPointHover;
        return hover?.kind === "vertex" && hover.contour === 0 && hover.index === 3;
      });
      await page.screenshot({ path: path.join(out, wallName + "-hover.png") });
      await page.keyboard.press("Backspace");
      const after = await state();
      assert.equal(after.document.entities[0].polygons[0].outer.length, 4);
      assert.equal(after.document.entities[0].wallAssetId, wallId);
      assert.equal(after.history, before.history + 1);
      await page.screenshot({ path: path.join(out, wallName + "-removed.png") });
      await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
      assert.deepEqual((await state()).document, before.document);
      await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
      assert.deepEqual((await state()).document, after.document);
      await page.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
      saved.push({ file, document: (await state()).document, wallName,
        mapSha256: hash(fs.readFileSync(path.join(qa, "vault", file))) });
      checks.push("Point Backspace applies " + wallName +
        " to the QA contour in one undoable step");
    }
    await page.evaluate(async ({ source, target }) => {
      const map = JSON.parse(await app.vault.read(
        app.vault.getAbstractFileByPath(source)));
      map.id = target;
      map.entities[0].id = "qa-building-insert";
      await app.vault.create(target, JSON.stringify(map));
    }, { source: files[0], target: insertFile });
    await open(insertFile);
    await chooseTool("Punkte");
    await page.evaluate(async () => app.workspace.activeLeaf.view.editor
      .select("qa-building-insert"));
    await page.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "Battlements", exact: true }).click();
    await page.locator(".dn-canvas canvas").focus();
    const insertBefore = await state(),
      insertStart = await world({ x: 2.5, y: 1 }),
      insertEnd = await world({ x: 3, y: 0.75 });
    await page.mouse.move(insertStart.x + 10, insertStart.y + 10);
    await page.mouse.move(insertStart.x, insertStart.y);
    await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor
      ?.renderer.buildingPointHover?.kind === "edge");
    await page.mouse.down();
    await page.mouse.move(insertEnd.x, insertEnd.y, { steps: 8 });
    await page.waitForFunction(id => app.workspace.activeLeaf?.view?.editor
      ?.renderer.buildingPreview?.entity.wallAssetId === id,
    assets.battlements);
    assert.deepEqual((await state()).document, insertBefore.document);
    await page.screenshot({ path: path.join(out, "insert-battlements-held.png") });
    await page.mouse.up();
    const insertAfter = await state(), inserted = insertAfter.document.entities[0];
    assert.equal(inserted.polygons[0].outer.length, 5);
    assert.equal(inserted.wallAssetId, assets.battlements);
    assert.equal(insertAfter.history, insertBefore.history + 1);
    await page.screenshot({ path: path.join(out, "insert-battlements-after.png") });
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state()).document, insertBefore.document);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.deepEqual((await state()).document, insertAfter.document);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    saved.push({ file: insertFile, document: (await state()).document,
      wallName: "Battlements Insert", mapSha256: hash(fs.readFileSync(
        path.join(qa, "vault", insertFile))) });
    checks.push("Edge insertion previews and stores the current Battlements wall");
    await page.evaluate(async file => { await app.vault.create(file, JSON.stringify({
      format: "dungeon-map", version: 3, id: file,
      settings: { name: "QAWall Ellipse", width: 18, height: 12,
        feetPerField: 5, assetPacks: ["QAWall01"], builtInAssets: true,
        wallShadows: true, objectShadows: false, buildingWear: 0 },
      floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
      entities: [], content: { definitions: [], occurrences: [],
        routes: [], archive: [] },
    })); }, ellipseFile);
    await open(ellipseFile);
    await chooseTool("Ellipsenraum");
    await page.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "QA Wall", exact: true }).click();
    await page.getByRole("checkbox", { name: "Bevel Corners" }).check();
    const start = await world({ x: 12, y: 0 }), end = await world({ x: 16, y: 4 });
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor
      ?.session.entities.size === 1);
    const ellipseBefore = await state(), ellipse = ellipseBefore.document.entities[0];
    assert.equal(ellipse.polygons[0].outer.length, 32);
    assert.equal(ellipse.wallAssetId, assets.qa);
    assert.equal(ellipse.wallBevel, true);
    await page.screenshot({ path: path.join(out, "ellipse-on-before.png") });
    await chooseTool("Punkte");
    await page.evaluate(async id => app.workspace.activeLeaf.view.editor.select(id),
      ellipse.id);
    await page.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "QA Wall", exact: true }).click();
    await page.locator(".dn-canvas canvas").focus();
    const rightmost = ellipse.polygons[0].outer.reduce((best, point) =>
      point.x > best.x ? point : best),
      from = await world(rightmost),
      to = await world({ x: rightmost.x + 1, y: rightmost.y });
    await page.mouse.move(from.x + 10, from.y + 10);
    await page.mouse.move(from.x, from.y);
    await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor
      ?.renderer.buildingPointHover?.kind === "vertex");
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    const ellipseAfter = await state(), moved = ellipseAfter.document.entities[0];
    assert.equal(moved.polygons[0].outer.length, 32);
    assert.equal(moved.wallAssetId, assets.qa);
    assert.equal(moved.wallBevel, true);
    assert(ellipseAfter.history === ellipseBefore.history + 1);
    assert(moved.polygons[0].outer.some(point =>
      Math.abs(point.x - rightmost.x - 1) < 1e-6 &&
      Math.abs(point.y - rightmost.y) < 1e-6));
    await page.screenshot({ path: path.join(out, "ellipse-on-point-moved.png") });
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state()).document, ellipseBefore.document);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.deepEqual((await state()).document, ellipseAfter.document);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    saved.push({ file: ellipseFile, document: (await state()).document,
      wallName: "QA Ellipse", mapSha256: hash(fs.readFileSync(
        path.join(qa, "vault", ellipseFile))) });
    checks.push("QAWall ellipse point follows the wall through edit, undo and redo");
    fs.writeFileSync(savedPath, JSON.stringify({ assets, saved }, null, 2));
  }
  async function reopen() {
    const { saved } = JSON.parse(fs.readFileSync(savedPath));
    for (const item of saved) {
      assert.equal(hash(fs.readFileSync(path.join(qa, "vault", item.file))),
        item.mapSha256);
      await open(item.file);
      assert.deepEqual((await state()).document, item.document);
      await page.screenshot({ path: path.join(out,
        item.wallName + "-fresh.png") });
      checks.push(item.wallName + " point edit survives a fresh Host process");
    }
  }
  return { edit, reopen };
};
