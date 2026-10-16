module.exports = ({ page, fs, path, assert, crypto, qa, out, checks,
  chooseTool }) => {
  const fixtures = require("./phase3-fixtures.cjs")({ fs, crypto, assert });
  const { pckPath, hash } = fixtures;
  const prefix = "Dungeons/Parity/Bevel-";
  const files = {
    battlements: prefix + "Battlements.dungeon",
    exterior: prefix + "QA-Exterior.dungeon",
    ringOn: prefix + "QA-Ring-On.dungeon",
    ringOff: prefix + "QA-Ring-Off.dungeon",
    ellipseOn: prefix + "QA-Ellipse-On.dungeon",
    ellipseOff: prefix + "QA-Ellipse-Off.dungeon",
  };
  const savedPath = path.join(qa, "parity-phase3-bevel-matrix-saved.json");
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    return editor && { document: editor.session.document(),
      history: editor.session.historySize, dirty: editor.session.dirty,
      camera: editor.renderer.camera };
  });
  const world = point => page.evaluate(point => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer,
      box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  async function open(file) {
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(
      app.vault.getAbstractFileByPath(file)), file);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  }
  async function selectWall(name) {
    const gallery = page.getByRole("group", { name: "Wandstil" });
    await gallery.getByRole("button", { name, exact: true }).click();
    assert.equal(await gallery.getByRole("button", { name, exact: true })
      .getAttribute("aria-pressed"), "true");
  }
  async function setBevel(on) {
    const checkbox = page.getByRole("checkbox", { name: "Bevel Corners" });
    if (on) await checkbox.check();
    else await checkbox.uncheck();
  }
  async function waitBuildings(count) {
    await page.waitForFunction(count => {
      const renderer = app.workspace.activeLeaf?.view?.editor?.renderer;
      if (!renderer) return false;
      const visuals = [...renderer.visuals.values()].filter(
        visual => visual.entity.kind === "building");
      return visuals.length === count && visuals.every(visual => !!visual.floorLayer);
    }, count, { timeout: 45000 });
    await page.evaluate(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  async function capture(name, buildingCount) {
    await waitBuildings(buildingCount);
    await page.mouse.move(20, 20);
    await page.getByRole("button", { name: "Raster", exact: true }).click();
    await page.screenshot({ path: path.join(out, name + "-grid-off.png") });
    await page.getByRole("button", { name: "Raster", exact: true }).click();
  }
  async function rectangle(a, b, count) {
    const first = await world(a), second = await world(b);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(second.x, second.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(count => app.workspace.activeLeaf?.view?.editor
      ?.session.entities.size === count, count, { timeout: 45000 });
  }
  async function polygon(points, count) {
    for (const point of points.slice(0, -1)) {
      const at = await world(point);
      await page.mouse.click(at.x, at.y);
    }
    const last = await world(points.at(-1));
    await page.mouse.dblclick(last.x, last.y, { delay: 90 });
    await page.waitForFunction(count => app.workspace.activeLeaf?.view?.editor
      ?.session.entities.size === count, count, { timeout: 45000 });
  }
  async function erase(a, b) {
    const before = await state(), first = await world(a), second = await world(b);
    await page.keyboard.down("Alt");
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(second.x, second.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    await page.waitForFunction(history => app.workspace.activeLeaf?.view?.editor
      ?.session.historySize === history + 1, before.history, { timeout: 45000 });
  }
  async function save(file, name, count, records) {
    await capture(name, count);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    const document = (await state()).document;
    records.push({ file, name, document,
      mapSha256: hash(fs.readFileSync(path.join(qa, "vault", file))) });
    fs.writeFileSync(path.join(out, name + ".json"),
      JSON.stringify(document, null, 2));
  }
  async function edit() {
    const pack = await fixtures.load(page);
    const assets = await page.evaluate(async ({ files }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      const catalog = plugin.listAssets(["QAWall01"], true),
        qa = catalog.find(asset => asset.kind === "wall" && asset.name === "QA Wall"),
        battlements = catalog.find(asset => asset.kind === "wall" &&
          asset.files.image?.endsWith("/battlements.png"));
      if (!qa || !battlements) throw new Error("Bevel wall assets missing");
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      for (const file of Object.values(files)) await app.vault.create(file,
        JSON.stringify({ format: "dungeon-map", version: 3, id: file,
          settings: { name: file.split("/").at(-1), width: 18, height: 12,
            feetPerField: 5, assetPacks: ["QAWall01"], builtInAssets: true,
            wallShadows: true, objectShadows: false,
            buildingWear: 0, nativeBuildingWear: true },
          floors: [{ id: "floor-1", name: "Erdgeschoss",
            elevation: 0, ambient: 1 }],
          entities: [], content: { definitions: [], occurrences: [],
            routes: [], archive: [] } }));
      return { qa: qa.id, battlements: battlements.id };
    }, { files });
    fs.writeFileSync(path.join(out, "assets.json"), JSON.stringify({ ...assets,
      pckSha256: hash(fs.readFileSync(pckPath)), packSha256: hash(pack) }, null, 2));
    const records = [];
    await open(files.battlements);
    await chooseTool("Raum");
    await selectWall("Battlements");
    await setBevel(true);
    await rectangle({ x: 1, y: 1 }, { x: 3, y: 3 }, 1);
    await rectangle({ x: 5, y: 1 }, { x: 7, y: 3 }, 2);
    await setBevel(false);
    await rectangle({ x: 1, y: 4 }, { x: 3, y: 6 }, 3);
    assert.deepEqual((await state()).document.entities.map(e => e.wallBevel),
      [true, true, false]);
    await save(files.battlements, "battlements-on-off", 3, records);
    checks.push("Three native-position Battlements rectangles show and store Bevel on/off");

    await open(files.exterior);
    await chooseTool("Raum");
    await selectWall("QA Wall");
    await setBevel(true);
    await rectangle({ x: 4, y: 1 }, { x: 6, y: 3 }, 1);
    await setBevel(false);
    await rectangle({ x: 8, y: 1 }, { x: 10, y: 3 }, 2);
    await chooseTool("Polygonraum");
    await polygon([{ x: 2, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 6 },
      { x: 4, y: 6 }, { x: 4, y: 8 }, { x: 2, y: 8 }], 3);
    await setBevel(true);
    await polygon([{ x: 7, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 6 },
      { x: 9, y: 6 }, { x: 9, y: 8 }, { x: 7, y: 8 }], 4);
    assert.deepEqual((await state()).document.entities.map(e => e.wallBevel),
      [true, false, false, true]);
    assert((await state()).document.entities.every(e => e.wallAssetId === assets.qa));
    await save(files.exterior, "qa-exterior-rect-l", 4, records);
    checks.push("QAWall rectangles and concave L pairs show and store Bevel on/off");

    for (const [on, file, name] of [
      [true, files.ringOn, "qa-ring-on"],
      [false, files.ringOff, "qa-ring-off-portal"],
    ]) {
      await open(file);
      await chooseTool("Raum");
      await selectWall("QA Wall");
      await setBevel(on);
      await rectangle({ x: 12, y: 5 }, { x: 16, y: 9 }, 1);
      await erase({ x: 13, y: 6 }, { x: 15, y: 8 });
      let current = (await state()).document;
      assert.equal(current.entities.length, 1);
      assert.equal(current.entities[0].wallAssetId, assets.qa);
      assert.equal(current.entities[0].wallBevel, on);
      assert(current.entities[0].polygons[0].holes.length > 0);
      if (!on) {
        await chooseTool("Tür");
        const at = await world({ x: 14, y: 9 });
        await page.mouse.click(at.x, at.y);
        await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor
          ?.session.document().entities.some(e => e.kind === "door"));
        current = (await state()).document;
        assert(current.entities.some(e => e.kind === "door" &&
          e.anchor?.boundaryId === current.entities[0].id));
      }
      await save(file, name, 1, records);
      checks.push("QAWall inner ring Bevel " + (on ? "on" : "off with bound door"));
    }
    for (const [on, file, name] of [
      [false, files.ellipseOff, "qa-ellipse-off"],
      [true, files.ellipseOn, "qa-ellipse-on"],
    ]) {
      await open(file);
      await chooseTool("Ellipsenraum");
      await selectWall("QA Wall");
      await setBevel(on);
      await rectangle({ x: 12, y: 0 }, { x: 16, y: 4 }, 1);
      const ellipse = (await state()).document.entities[0];
      assert.equal(ellipse.wallAssetId, assets.qa);
      assert.equal(ellipse.wallBevel, on);
      assert.equal(ellipse.polygons[0].outer.length, 32);
      await save(file, name, 1, records);
      checks.push("QAWall ellipse Bevel " + (on ? "on" : "off"));
    }
    fs.writeFileSync(savedPath, JSON.stringify({ assets, records }, null, 2));
  }
  async function reopen() {
    const { records } = JSON.parse(fs.readFileSync(savedPath));
    for (const record of records) {
      assert.equal(hash(fs.readFileSync(path.join(qa, "vault", record.file))),
        record.mapSha256);
      await open(record.file);
      assert.deepEqual((await state()).document, record.document);
      await capture(record.name + "-fresh", record.document.entities
        .filter(entity => entity.kind === "building").length);
      checks.push(record.name + " survives fresh Host opening");
    }
  }
  return { edit, reopen };
};
