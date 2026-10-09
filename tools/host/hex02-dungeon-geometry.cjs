// Geometry regression independent of unavailable proprietary textures; own test text/files only.
module.exports = ({
  page,
  fs,
  path,
  assert,
  qa,
  vault,
  out,
  checks,
  chooseTool,
}) => {
  const FILE = "Dungeons/Hex02 Geometrie.dungeon",
    baseline = path.join(qa, "hex02-geometry-baseline.json");
  const panel = () => page.locator(".dungeon-native-editor:visible").last();
  const outer = [
      { x: 2, y: 2 },
      { x: 9, y: 2 },
      { x: 9, y: 9 },
      { x: 2, y: 9 },
    ],
    after = [outer[0], { x: 5.5, y: 1 }, ...outer.slice(1)];
  const settle = () =>
    page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  async function state() {
    return page.evaluate(() => {
      const e = app.workspace.getLeavesOfType("dungeon-native-map").at(-1)
        .view.editor;
      return {
        doc: e.session.document(),
        selected: e.selected,
        history: e.session.historySize,
        hover: e.renderer.buildingPointHover,
      };
    });
  }
  async function position(p) {
    return page.evaluate((p) => {
      const r = app.workspace.getLeavesOfType("dungeon-native-map").at(-1).view
          .editor.renderer,
        b = r.canvas.getBoundingClientRect();
      return {
        x: b.x + r.camera.x + p.x * r.camera.scale,
        y: b.y + r.camera.y + p.y * r.camera.scale,
      };
    }, p);
  }
  async function open() {
    await page.evaluate(async (file) => {
      await app.workspace
        .getLeaf(false)
        .openFile(app.vault.getAbstractFileByPath(file));
    }, FILE);
    await panel().locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await panel()
      .getByRole("button", { name: "Einpassen", exact: true })
      .click();
    await settle();
  }
  async function select() {
    await chooseTool("Auswahl");
    const p = await position({ x: 5, y: 5 });
    await page.mouse.click(p.x, p.y);
    await settle();
    assert.equal((await state()).selected, "hex02-geometry-room");
    await chooseTool("Punkte");
    const snap = panel().getByRole("button", { name: "Snap", exact: true });
    if ((await snap.getAttribute("aria-pressed")) === "true")
      await snap.click();
  }
  async function edge(point, index) {
    const p = await position(point);
    await page.mouse.move(p.x + 10, p.y + 10);
    await page.mouse.move(p.x, p.y);
    await page.waitForFunction((index) => {
      const h = app.workspace.getLeavesOfType("dungeon-native-map").at(-1).view
        .editor.renderer.buildingPointHover;
      return h?.kind === "edge" && h.contour === 0 && h.index === index;
    }, index);
    return p;
  }
  async function edit() {
    const doc = {
      format: "dungeon-map",
      version: 4,
      id: "hex02-geometry",
      settings: {
        name: "Hex02 Geometrie",
        width: 20,
        height: 20,
        feetPerField: 5,
        assetPacks: [],
        builtInAssets: false,
        wallShadows: false,
        objectShadows: false,
        buildingWear: 0,
      },
      floors: [{ id: "geometry-floor", name: "Erdgeschoss", elevation: 0 }],
      entities: [
        {
          id: "hex02-geometry-room",
          kind: "building",
          floorId: "geometry-floor",
          polygons: [{ outer, holes: [] }],
          layer: 200,
          fill: 12562586,
          floorAlpha: 255,
          wall: 4210233,
          wallAlpha: 255,
          wallWidth: 0.2,
          number: "1",
          name: "Geometrie",
          key: {
            sections: [
              {
                id: "geometry-text",
                kind: "markdown",
                markdown: "Unveränderter eigener Geometrie-Testtext.",
              },
            ],
          },
        },
      ],
      content: { definitions: [], occurrences: [], routes: [], archive: [] },
    };
    await page.evaluate(
      async ({ file, text }) => {
        if (!app.vault.getAbstractFileByPath("Dungeons"))
          await app.vault.createFolder("Dungeons");
        await app.vault.create(file, text);
      },
      { file: FILE, text: JSON.stringify(doc) },
    );
    await open();
    await select();
    await edge({ x: 5.5, y: 2 }, 0);
    const end = await position({ x: 5.5, y: 1 });
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(
      () =>
        app.workspace.getLeavesOfType("dungeon-native-map").at(-1).view.editor
          .session.historySize === 1,
    );
    const moved = await state();
    assert.deepEqual(moved.doc.entities[0].polygons[0].outer, after);
    assert.deepEqual(moved.doc.entities[0].key, doc.entities[0].key);
    await panel()
      .getByRole("button", { name: "Rückgängig", exact: true })
      .click();
    await settle();
    assert.deepEqual((await state()).doc.entities[0].polygons[0].outer, outer);
    await panel()
      .getByRole("button", { name: "Wiederholen", exact: true })
      .click();
    await settle();
    assert.deepEqual((await state()).doc.entities[0].polygons[0].outer, after);
    await panel()
      .getByRole("button", { name: "Speichern", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        !app.workspace.getLeavesOfType("dungeon-native-map").at(-1).view.editor
          .session.dirty,
    );
    const saved = fs.readFileSync(path.join(vault, FILE), "utf8");
    assert.deepEqual(JSON.parse(saved).entities[0].polygons[0].outer, after);
    fs.writeFileSync(
      baseline,
      JSON.stringify({ saved, key: doc.entities[0].key }, null, 2),
    );
    await page.screenshot({
      path: path.join(out, "geometry-insert-saved.png"),
    });
    checks.push(
      "Asset-independent actual Dungeon edge hover contour0/index0, midpoint insertion/drag, one command, exact undo/redo, stable room key and native Save after shared segment-helper extraction",
    );
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(baseline, "utf8"));
    assert.equal(fs.readFileSync(path.join(vault, FILE), "utf8"), saved.saved);
    await open();
    assert.deepEqual((await state()).doc.entities[0].polygons[0].outer, after);
    assert.deepEqual((await state()).doc.entities[0].key, saved.key);
    await select();
    await edge({ x: 7.25, y: 1.5 }, 1);
    await page.screenshot({
      path: path.join(out, "geometry-fresh-edge-index.png"),
    });
    assert.equal(fs.readFileSync(path.join(vault, FILE), "utf8"), saved.saved);
    checks.push(
      "Separate fresh Dungeon process reopens inserted contour/key; actual new edge hits contour0/index1 and preserves saved bytes; proprietary asset-style matrix remains open",
    );
  }
  return { edit, reopen };
};
