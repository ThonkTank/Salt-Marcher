const ROOT = "Dungeons/Phase1-BuildingPoint";
const BASE = ROOT + "/mixed-base.dungeon";
const CASES = [
  { name: "stone-no-wall", floor: "stone", wall: "Keine Wand" },
  { name: "wood-no-wall", floor: "wood", wall: "Keine Wand" },
  { name: "wood-battlements", floor: "wood", wall: "Battlements" },
  { name: "stone-insert", floor: "stone", wall: "Keine Wand", kind: "insert" },
  { name: "stone-remove", floor: "stone", wall: "Keine Wand", kind: "remove" },
];

module.exports = ({ page, fs, path, assert, crypto, qa, vault, out,
  checks, chooseTool }) => {
  const baseline = path.join(qa, "building-point-baseline.json");
  const mapPath = (name) => `${ROOT}/${name}.dungeon`;
  const hash = (name) => crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(vault, mapPath(name)))).digest("hex");
  const state = () => page.evaluate(() => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
      ?.view.editor;
    return editor && { document: editor.session.document(),
      history: editor.session.historySize, dirty: editor.session.dirty,
      selected: editor.selected };
  });
  async function open(name) {
    await page.evaluate(async (file) => {
      await app.workspace.getLeaf("tab").openFile(
        app.vault.getAbstractFileByPath(file));
    }, mapPath(name));
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
  async function draw(a, b, count) {
    const first = await world(a), last = await world(b);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(last.x, last.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction((count) =>
      app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.smartTiles?.length === count, count);
  }
  function verifyBase(doc, woodId, stoneId) {
    assert.equal(doc.settings.width, 8);
    assert.equal(doc.settings.height, 8);
    assert.equal(doc.entities.length, 1);
    assert.deepEqual(doc.entities[0].polygons[0].outer,
      [{ x: 1, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 4 }, { x: 1, y: 4 }]);
    assert.equal(doc.smartTiles.length, 18);
    assert.equal(doc.smartTiles.filter((c) => c.assetId === woodId).length, 9);
    assert.equal(doc.smartTiles.filter((c) => c.assetId === stoneId).length, 9);
  }
  function verifyEdited(doc, styleId, wallId, kind) {
    assert.equal(doc.entities.length, 1);
    const building = doc.entities[0];
    assert.deepEqual(building.polygons[0].outer, kind === "remove"
      ? [{ x: 7, y: 1 }, { x: 7, y: 4 }, { x: 1, y: 4 }]
      : kind === "insert"
        ? [{ x: 1, y: 1 }, { x: 4, y: 0.125 }, { x: 7, y: 1 },
          { x: 7, y: 4 }, { x: 1, y: 4 }]
        : [{ x: 1, y: 0 }, { x: 7, y: 1 }, { x: 7, y: 4 }, { x: 1, y: 4 }]);
    assert.equal(building.wallAssetId ?? null, wallId);
    assert.equal(doc.smartTiles.length, kind === "remove" ? 12 : 24);
    assert.ok(doc.smartTiles.every((cell) => cell.assetId === styleId &&
      cell.buildingId === building.id));
    const positions = new Set(doc.smartTiles.map((cell) => `${cell.x}:${cell.y}`));
    assert.deepEqual(positions, kind === "remove"
      ? new Set(["5:1", "6:1", "3:2", "4:2", "5:2", "6:2",
        "1:3", "2:3", "3:3", "4:3", "5:3", "6:3"])
      : new Set(Array.from({ length: 24 }, (_, i) =>
        `${1 + i % 6}:${Math.floor(i / 6)}`)));
  }
  async function movePoint(kind) {
    const insert = kind === "insert";
    const start = await world(insert ? { x: 4, y: 1 } : { x: 1, y: 1 });
    await page.mouse.move(start.x + 10, start.y + 10);
    await page.mouse.move(start.x, start.y);
    await page.waitForFunction((insert) => {
      const hover = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.renderer.buildingPointHover;
      return hover?.kind === (insert ? "edge" : "vertex") &&
        hover.contour === 0 && hover.index === 0;
    }, insert);
    if (kind === "remove") {
      await page.locator(".dungeon-native-editor:visible .dn-canvas canvas")
        .last().focus();
      await page.keyboard.press("Delete");
    } else {
      const end = await world(insert ? { x: 4, y: 0.125 } : { x: 1, y: 0 });
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 8 });
      await page.mouse.up();
    }
    await page.waitForFunction((kind) =>
      app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        ?.view.editor?.session.smartTiles?.length === (kind === "remove" ? 12 : 24), kind);
  }
  async function edit() {
    const { pckPath } = require("./phase3-fixtures.cjs")({ fs, crypto, assert });
    await page.evaluate(async ({ file, root, pckPath }) => {
      await app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pckPath);
      for (const folder of ["Dungeons", root])
        if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
      await app.vault.create(file, JSON.stringify({ format: "dungeon-map", version: 4,
        id: "phase1-building-point", settings: { name: "Building Point", width: 8,
          height: 8, feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2) + "\n");
    }, { file: BASE, root: ROOT, pckPath });
    await open("mixed-base");
    await chooseTool("Raum");
    const panel = page.locator(".dungeon-native-editor:visible").last();
    await panel.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "Keine Wand", exact: true }).click();
    const catalog = await page.evaluate(() => app.plugins.getPlugin("dungeon-editor")
      .listAssets([], true).map((item) => ({ id: item.id, name: item.name,
        image: item.files.image, kind: item.kind })));
    const wood = catalog.find((item) => item.kind === "tileset" &&
      item.image?.endsWith("/tileset_wood_vertical.png"));
    const stone = catalog.find((item) => item.kind === "tileset" &&
      item.image?.endsWith("/tileset_stone.png"));
    const battlements = catalog.find((item) => item.kind === "wall" &&
      item.name === "Battlements");
    assert.ok(wood && stone && battlements);
    await panel.getByRole("group", { name: "Bodenstil" })
      .getByRole("button", { name: wood.name, exact: true }).click();
    await draw({ x: 1, y: 1 }, { x: 4, y: 4 }, 9);
    await panel.getByRole("group", { name: "Bodenstil" })
      .getByRole("button", { name: stone.name, exact: true }).click();
    await draw({ x: 4, y: 1 }, { x: 7, y: 4 }, 18);
    verifyBase((await state()).document, wood.id, stone.id);
    await panel.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")
      .at(-1)?.view.editor.session.dirty);
    const baseBytes = fs.readFileSync(path.join(vault, BASE), "utf8");
    const records = [];
    for (const item of CASES) {
      await page.evaluate(async ({ file, content }) => {
        await app.vault.create(file, content);
      }, { file: mapPath(item.name), content: baseBytes });
      await open(item.name);
      const editor = page.locator(".dungeon-native-editor:visible").last();
      await editor.locator(".dn-group-rail")
        .getByRole("button", { name: "Bauwerk", exact: true }).click();
      await editor.locator(".dn-tool-rail")
        .getByRole("button", { name: "Punkte bearbeiten", exact: true }).click();
      await editor.getByRole("group", { name: "Wandstil" })
        .getByRole("button", { name: item.wall, exact: true }).click();
      const floor = item.floor === "wood" ? wood : stone;
      await editor.getByRole("group", { name: "Bodenstil" })
        .getByRole("button", { name: floor.name, exact: true }).click();
      if (item.kind === "insert") {
        const snap = editor.getByRole("button", { name: "Snap", exact: true });
        if (await snap.getAttribute("aria-pressed") === "true") await snap.click();
      }
      const initial = await state();
      verifyBase(initial.document, wood.id, stone.id);
      const id = initial.document.entities[0].id;
      await page.evaluate((id) => app.workspace.getLeavesOfType("dungeon-native-map")
        .at(-1).view.editor.select(id), id);
      await movePoint(item.kind);
      const moved = await state();
      const wallId = item.wall === "Keine Wand" ? null : battlements.id;
      verifyEdited(moved.document, floor.id, wallId, item.kind);
      assert.equal(moved.history, 1);
      await page.screenshot({ path: path.join(out, item.name + "-edit.png") });
      await editor.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")
        .at(-1)?.view.editor.session.dirty);
      const saved = JSON.parse(fs.readFileSync(path.join(vault, mapPath(item.name)), "utf8"));
      assert.deepEqual(saved, JSON.parse(JSON.stringify(moved.document)));
      await editor.getByRole("button", { name: "Rückgängig", exact: true }).click();
      verifyBase((await state()).document, wood.id, stone.id);
      await editor.getByRole("button", { name: "Wiederholen", exact: true }).click();
      verifyEdited((await state()).document, floor.id, wallId, item.kind);
      records.push({ name: item.name, document: saved, hash: hash(item.name),
        styleId: floor.id, wallId, kind: item.kind });
      checks.push(`DD-038 ${item.name} point edit repaints ` +
        `${item.kind === "remove" ? 12 : 24} cells in one Undo step`);
    }
    fs.writeFileSync(baseline, JSON.stringify({ records, woodId: wood.id,
      stoneId: stone.id }, null, 2));
  }
  async function reopen() {
    const { records } = JSON.parse(fs.readFileSync(baseline, "utf8"));
    for (const record of records) {
      await open(record.name);
      const fresh = await state();
      assert.deepEqual(JSON.parse(JSON.stringify(fresh.document)), record.document);
      assert.equal(hash(record.name), record.hash);
      verifyEdited(fresh.document, record.styleId, record.wallId, record.kind);
      await page.screenshot({ path: path.join(out, record.name + "-fresh.png") });
      checks.push(`DD-038 fresh Host opens ${record.name} byte-identically`);
    }
  }
  return { edit, reopen };
};
