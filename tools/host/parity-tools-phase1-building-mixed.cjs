const MAP = "Dungeons/Phase1-BuildingMixed/wood-stone.dungeon";
const OVERPAINT = "Dungeons/Phase1-BuildingMixed/wood-stone-overpaint.dungeon";
const ERASED = "Dungeons/Phase1-BuildingMixed/wood-stone-erased.dungeon";
const LARGE_OVERPAINT = "Dungeons/Phase1-BuildingMixed/wood-stone-overpaint-large.dungeon";

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out,
  checks, chooseTool }) => {
  const mapFile = path.join(vault, MAP);
  const baseline = path.join(qa, "mixed-floor-baseline.json");
  const paintedBaseline = path.join(qa, "overpaint-baseline.json");
  const erasedBaseline = path.join(qa, "mixed-erase-baseline.json");
  const largePaintBaseline = path.join(qa, "overpaint-large-baseline.json");
  const hash = (name = MAP) => crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(vault, name))).digest("hex");
  const state = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
      ?.view.editor;
    return editor && { document: editor.session.document(),
      history: editor.session.historySize, dirty: editor.session.dirty,
      renderCount: editor.renderer.renderCount,
      floorMesh: [...editor.renderer.visuals.values()]
        .filter((visual) => visual.entity.kind === "building")
        .map((visual) => ({ id: visual.entity.id,
          base: !!visual.floorMesh,
          extras: visual.floorExtraGeometries?.length ?? 0 })) };
  });
  async function open(name = MAP) {
    await page.evaluate(async (name) => app.workspace.getLeaf("tab").openFile(
      app.vault.getAbstractFileByPath(name)), name);
    await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
      .last().waitFor({ state: "visible" });
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Einpassen", exact: true }).click();
  }
  async function world(point) {
    return page.evaluate((point) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        .view.editor.renderer;
      const bounds = renderer.canvas.getBoundingClientRect();
      return { x: bounds.x + renderer.camera.x + point.x * renderer.camera.scale,
        y: bounds.y + renderer.camera.y + point.y * renderer.camera.scale };
    }, point);
  }
  async function draw(a, b, cells) {
    const first = await world(a), last = await world(b);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(last.x, last.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction((cells) =>
      app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.smartTiles?.length === cells, cells);
  }
  function verify(doc, woodId, stoneId, woodCount = 9, stoneCount = 9) {
    assert.equal(doc.settings.width, 8);
    assert.equal(doc.settings.height, 8);
    assert.equal(doc.entities.length, 1);
    const building = doc.entities[0];
    assert.equal(building.kind, "building");
    assert.equal(building.polygons.length, 1);
    assert.deepEqual(new Set(building.polygons[0].outer.map((p) => `${p.x}:${p.y}`)),
      new Set(["1:1", "7:1", "7:4", "1:4"]));
    assert.equal(doc.smartTiles.length, 18);
    assert.equal(doc.smartTiles.filter((cell) => cell.assetId === woodId).length, woodCount);
    assert.equal(doc.smartTiles.filter((cell) => cell.assetId === stoneId).length, stoneCount);
    assert.ok(doc.smartTiles.every((cell) => cell.buildingId === building.id));
    assert.ok(doc.smartTiles.filter((cell) => cell.assetId === woodId)
      .every((cell) => cell.x >= 1 && cell.x < 4 && cell.y >= 1 && cell.y < 4));
    assert.ok(doc.smartTiles.filter((cell) => cell.assetId === stoneId)
      .every((cell) => (cell.x >= 4 && cell.x < 7 && cell.y >= 1 && cell.y < 4) ||
        (stoneCount === 10 && cell.x === 1 && cell.y === 1)));
  }
  function verifyErased(doc, woodId, stoneId) {
    assert.equal(doc.settings.width, 8);
    assert.equal(doc.settings.height, 8);
    assert.equal(doc.entities.length, 1);
    assert.equal(doc.entities[0].kind, "building");
    assert.equal(doc.entities[0].polygons.length, 1);
    assert.deepEqual(new Set(doc.entities[0].polygons[0].outer
      .map((point) => `${point.x}:${point.y}`)),
    new Set(["1:1", "3:1", "3:2", "5:2", "5:1", "7:1", "7:4", "1:4"]));
    assert.equal(doc.smartTiles.length, 16);
    assert.equal(doc.smartTiles.filter((cell) => cell.assetId === woodId).length, 8);
    assert.equal(doc.smartTiles.filter((cell) => cell.assetId === stoneId).length, 8);
    assert.ok(doc.smartTiles.every((cell) => cell.buildingId === doc.entities[0].id));
    assert.ok(!doc.smartTiles.some((cell) => cell.y === 1 &&
      (cell.x === 3 || cell.x === 4)));
  }
  function verifyLargePaint(doc, woodId, stoneId) {
    assert.equal(doc.settings.width, 8);
    assert.equal(doc.settings.height, 8);
    assert.equal(doc.entities.length, 1);
    assert.equal(doc.entities[0].kind, "building");
    assert.equal(doc.entities[0].polygons.length, 1);
    assert.deepEqual(new Set(doc.entities[0].polygons[0].outer
      .map((point) => `${point.x}:${point.y}`)),
    new Set(["1:1", "7:1", "7:4", "1:4"]));
    assert.equal(doc.smartTiles.length, 18);
    const expectedStone = new Set();
    for (let y = 1; y < 4; y++) for (let x = 4; x < 7; x++)
      expectedStone.add(`${x}:${y}`);
    for (let y = 1; y < 3; y++) for (let x = 2; x < 4; x++)
      expectedStone.add(`${x}:${y}`);
    assert.equal(doc.smartTiles.filter((cell) => cell.assetId === woodId).length, 5);
    assert.equal(doc.smartTiles.filter((cell) => cell.assetId === stoneId).length, 13);
    assert.deepEqual(new Set(doc.smartTiles.filter((cell) => cell.assetId === stoneId)
      .map((cell) => `${cell.x}:${cell.y}`)), expectedStone);
    assert.ok(doc.smartTiles.every((cell) => cell.buildingId === doc.entities[0].id));
  }
  async function edit() {
    const { pckPath } = require("./phase3-fixtures.cjs")({ fs, crypto, assert });
    await page.evaluate(async ({ map, pckPath }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.useNativeAssetArchive(pckPath);
      for (const folder of ["Dungeons", "Dungeons/Phase1-BuildingMixed"])
        if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
      await app.vault.create(map, JSON.stringify({
        format: "dungeon-map", version: 4, id: "phase1-building-mixed",
        settings: { name: "Building Mixed", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2) + "\n");
    }, { map: MAP, pckPath });
    await open();
    await chooseTool("Raum");
    await page.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "Keine Wand", exact: true }).click();
    const catalog = await page.evaluate(() => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      return plugin.listAssets([], true).filter((item) => item.kind === "tileset")
        .map((item) => ({ id: item.id, name: item.name,
          image: item.files.image }));
    });
    const wood = catalog.find((item) => item.image?.endsWith("/tileset_wood_vertical.png"));
    const stone = catalog.find((item) => item.image?.endsWith("/tileset_stone.png"));
    assert.ok(wood && stone);
    await page.getByRole("group", { name: "Bodenstil" })
      .getByRole("button", { name: wood.name, exact: true }).click();
    await draw({ x: 1, y: 1 }, { x: 4, y: 4 }, 9);
    await page.getByRole("group", { name: "Bodenstil" })
      .getByRole("button", { name: stone.name, exact: true }).click();
    await draw({ x: 4, y: 1 }, { x: 7, y: 4 }, 18);
    const after = await state();
    verify(after.document, wood.id, stone.id);
    assert.equal(after.history, 2);
    await page.waitForFunction(() => {
      const visual = [...app.workspace.getLeavesOfType("dungeon-native-map")
        .at(-1).view.editor.renderer.visuals.values()]
        .find((item) => item.entity.kind === "building");
      return visual?.floorExtraGeometries?.length === 1;
    });
    await page.screenshot({ path: path.join(out, "wood-stone-edit.png") });
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor.session.dirty);
    const saved = JSON.parse(fs.readFileSync(mapFile, "utf8"));
    verify(saved, wood.id, stone.id);
    assert.deepEqual(saved, after.document);
    fs.writeFileSync(baseline, JSON.stringify({ document: saved,
      hash: hash(), woodId: wood.id, stoneId: stone.id }, null, 2));
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.equal((await state()).document.smartTiles.length, 9);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    verify((await state()).document, wood.id, stone.id);
    checks.push("DD-038 adjacent Wood/Stone UI gestures store one contour and 9+9 styled cells; Undo/Redo preserves both");
    await page.evaluate(async ({ name, content }) => {
      await app.vault.create(name, content);
    }, { name: OVERPAINT, content: fs.readFileSync(mapFile, "utf8") });
    await open(OVERPAINT);
    const active = page.locator(".dungeon-native-editor:visible").last();
    await active.locator(".dn-group-rail")
      .getByRole("button", { name: "Bauwerk", exact: true }).click();
    await active.locator(".dn-tool-rail")
      .getByRole("button", { name: "Rechteck", exact: true }).click();
    await active
      .getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "Keine Wand", exact: true }).click();
    await active
      .getByRole("group", { name: "Bodenstil" })
      .getByRole("button", { name: stone.name, exact: true }).click();
    await draw({ x: 1, y: 1 }, { x: 2, y: 2 }, 18);
    await page.waitForFunction((stoneId) =>
      app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.smartTiles?.find((cell) =>
          cell.x === 1 && cell.y === 1)?.assetId === stoneId, stone.id);
    const painted = await state();
    verify(painted.document, wood.id, stone.id, 8, 10);
    assert.equal(painted.history, 1);
    await page.screenshot({ path: path.join(out, "wood-stone-overpaint-edit.png") });
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor.session.dirty);
    const paintedSaved = JSON.parse(fs.readFileSync(path.join(vault, OVERPAINT), "utf8"));
    assert.deepEqual(paintedSaved, painted.document);
    fs.writeFileSync(paintedBaseline, JSON.stringify({ document: paintedSaved,
      hash: hash(OVERPAINT), woodId: wood.id, stoneId: stone.id }, null, 2));
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Rückgängig", exact: true }).click();
    verify((await state()).document, wood.id, stone.id);
    await page.locator(".dungeon-native-editor:visible").last()
      .getByRole("button", { name: "Wiederholen", exact: true }).click();
    verify((await state()).document, wood.id, stone.id, 8, 10);
    checks.push("DD-038 Stone overpaint changes exactly one Wood cell in one Undo step without splitting the contour");
    await page.evaluate(async ({ name, content }) => {
      await app.vault.create(name, content);
    }, { name: ERASED, content: fs.readFileSync(mapFile, "utf8") });
    await open(ERASED);
    const eraseEditor = page.locator(".dungeon-native-editor:visible").last();
    await eraseEditor.locator(".dn-group-rail")
      .getByRole("button", { name: "Bauwerk", exact: true }).click();
    await eraseEditor.locator(".dn-tool-rail")
      .getByRole("button", { name: "Rechteck", exact: true }).click();
    await eraseEditor.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "Keine Wand", exact: true }).click();
    await page.keyboard.down("Alt");
    try {
      await draw({ x: 3, y: 1 }, { x: 5, y: 2 }, 16);
    } finally {
      await page.keyboard.up("Alt");
    }
    const erased = await state();
    verifyErased(erased.document, wood.id, stone.id);
    assert.equal(erased.history, 1);
    await page.screenshot({ path: path.join(out, "wood-stone-erased-edit.png") });
    await eraseEditor.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor.session.dirty);
    const erasedSaved = JSON.parse(fs.readFileSync(path.join(vault, ERASED), "utf8"));
    assert.deepEqual(erasedSaved, erased.document);
    fs.writeFileSync(erasedBaseline, JSON.stringify({ document: erasedSaved,
      hash: hash(ERASED), woodId: wood.id, stoneId: stone.id }, null, 2));
    await eraseEditor.getByRole("button", { name: "Rückgängig", exact: true }).click();
    verify((await state()).document, wood.id, stone.id);
    await eraseEditor.getByRole("button", { name: "Wiederholen", exact: true }).click();
    verifyErased((await state()).document, wood.id, stone.id);
    checks.push("DD-038 Alt erases Wood and Stone together at their shared boundary in one Undo step");
    await page.evaluate(async ({ name, content }) => {
      await app.vault.create(name, content);
    }, { name: LARGE_OVERPAINT, content: fs.readFileSync(mapFile, "utf8") });
    await open(LARGE_OVERPAINT);
    const largePaintEditor = page.locator(".dungeon-native-editor:visible").last();
    await largePaintEditor.locator(".dn-group-rail")
      .getByRole("button", { name: "Bauwerk", exact: true }).click();
    await largePaintEditor.locator(".dn-tool-rail")
      .getByRole("button", { name: "Rechteck", exact: true }).click();
    await largePaintEditor.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "Keine Wand", exact: true }).click();
    await largePaintEditor.getByRole("group", { name: "Bodenstil" })
      .getByRole("button", { name: stone.name, exact: true }).click();
    await draw({ x: 2, y: 1 }, { x: 5, y: 3 }, 18);
    await page.waitForFunction((stoneId) =>
      app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.smartTiles?.find((cell) =>
          cell.x === 2 && cell.y === 2)?.assetId === stoneId, stone.id);
    const largePaint = await state();
    verifyLargePaint(largePaint.document, wood.id, stone.id);
    assert.equal(largePaint.history, 1);
    await page.screenshot({ path: path.join(out, "wood-stone-overpaint-large-edit.png") });
    await largePaintEditor.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() =>
      !app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor.session.dirty);
    const largePaintSaved = JSON.parse(fs.readFileSync(path.join(vault, LARGE_OVERPAINT), "utf8"));
    assert.deepEqual(largePaintSaved, largePaint.document);
    fs.writeFileSync(largePaintBaseline, JSON.stringify({ document: largePaintSaved,
      hash: hash(LARGE_OVERPAINT), woodId: wood.id, stoneId: stone.id }, null, 2));
    await largePaintEditor.getByRole("button", { name: "Rückgängig", exact: true }).click();
    verify((await state()).document, wood.id, stone.id);
    await largePaintEditor.getByRole("button", { name: "Wiederholen", exact: true }).click();
    verifyLargePaint((await state()).document, wood.id, stone.id);
    checks.push("DD-038 Stone overpaints four Wood cells across a 3×2 gesture in one Undo step");
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(baseline, "utf8"));
    await open();
    const fresh = await state();
    assert.deepEqual(fresh.document, saved.document);
    assert.equal(hash(), saved.hash);
    verify(fresh.document, saved.woodId, saved.stoneId);
    await page.waitForFunction(() => {
      const visual = [...app.workspace.getLeavesOfType("dungeon-native-map")
        .at(-1).view.editor.renderer.visuals.values()]
        .find((item) => item.entity.kind === "building");
      return visual?.floorExtraGeometries?.length === 1;
    });
    await page.screenshot({ path: path.join(out, "wood-stone-fresh.png") });
    checks.push("DD-038 fresh Host keeps one contour, 9+9 styled cells, and separate floor textures");
    const painted = JSON.parse(fs.readFileSync(paintedBaseline, "utf8"));
    await open(OVERPAINT);
    const paintedFresh = await state();
    assert.deepEqual(paintedFresh.document, painted.document);
    assert.equal(hash(OVERPAINT), painted.hash);
    verify(paintedFresh.document, painted.woodId, painted.stoneId, 8, 10);
    await page.waitForFunction(() => {
      const visual = [...app.workspace.getLeavesOfType("dungeon-native-map")
        .at(-1).view.editor.renderer.visuals.values()]
        .find((item) => item.entity.kind === "building");
      return visual?.floorExtraGeometries?.length === 1;
    });
    await page.screenshot({ path: path.join(out, "wood-stone-overpaint-fresh.png") });
    checks.push("DD-038 fresh Host keeps one contour and 8+10 cells after Stone overpaint");
    const erased = JSON.parse(fs.readFileSync(erasedBaseline, "utf8"));
    await open(ERASED);
    const erasedFresh = await state();
    assert.deepEqual(erasedFresh.document, erased.document);
    assert.equal(hash(ERASED), erased.hash);
    verifyErased(erasedFresh.document, erased.woodId, erased.stoneId);
    await page.waitForFunction(() => {
      const visual = [...app.workspace.getLeavesOfType("dungeon-native-map")
        .at(-1).view.editor.renderer.visuals.values()]
        .find((item) => item.entity.kind === "building");
      return visual?.floorExtraGeometries?.length === 1;
    });
    await page.screenshot({ path: path.join(out, "wood-stone-erased-fresh.png") });
    checks.push("DD-038 fresh Host keeps 8+8 mixed-style cells and the notched contour");
    const largePaint = JSON.parse(fs.readFileSync(largePaintBaseline, "utf8"));
    await open(LARGE_OVERPAINT);
    const largePaintFresh = await state();
    assert.deepEqual(largePaintFresh.document, largePaint.document);
    assert.equal(hash(LARGE_OVERPAINT), largePaint.hash);
    verifyLargePaint(largePaintFresh.document, largePaint.woodId, largePaint.stoneId);
    await page.waitForFunction(() => {
      const visual = [...app.workspace.getLeavesOfType("dungeon-native-map")
        .at(-1).view.editor.renderer.visuals.values()]
        .find((item) => item.entity.kind === "building");
      return visual?.floorExtraGeometries?.length === 1;
    });
    await page.screenshot({ path: path.join(out, "wood-stone-overpaint-large-fresh.png") });
    checks.push("DD-038 fresh Host keeps one contour and 5+13 cells after larger Stone overpaint");
  }
  return { edit, reopen };
};
