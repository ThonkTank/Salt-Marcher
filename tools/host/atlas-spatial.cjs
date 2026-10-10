// Isolated native Obsidian host proof; synthetic gestures, never physical-input acceptance.
module.exports = ({ page, fs, path, assert, qa, out, vault, root, checks }) => {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(root, "tests/fixtures/atlas-e2e-spatial-v2/manifest.json"),
      "utf8",
    ),
  );
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const panel = () => page.locator(".dn-atlas:visible").last(),
    viewport = () => panel().locator(".dn-atlas-viewport");
  const button = (name) => panel().locator(".dn-atlas-toolbar").getByRole("button", { name, exact: true });
  const settle = () =>
    page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  const state = () =>
    page.evaluate(() => {
      const v = app.workspace
        .getLeavesOfType("dungeon-native-atlas")
        .at(-1).view;
      return {
        camera: v.editor.renderer.camera,
        depth: v.editor.terrain.history.undoDepth,
        dirty: v.repository.dirty,
        draft: v.repository.hasDraft,
        city: v.repository
          .detail("city", "00000000-0000-4000-8000-000000000100")
          .read(),
        dungeon: v.repository
          .detail("dungeon", "00000000-0000-4000-8000-000000000030")
          .read().document,
        cells: v.editor.terrain.cells(),
        placements: v.editor.terrain.placements(),
        pending: v.editor.pendingKey,
      };
    });
  const record = async (name) => {
    checks.push(name);
    fs.writeFileSync(
      path.join(out, "state-" + checks.length + ".json"),
      JSON.stringify(await state(), null, 2),
    );
  };
  async function open() {
    await page.evaluate(
      async (file) =>
        app.workspace
          .getLeaf(false)
          .openFile(app.vault.getAbstractFileByPath(file)),
      manifest.input[0].path,
    );
    await viewport().locator("canvas").waitFor({ state: "visible" });
    await settle();
  }
  async function screen(p) {
    const s = await state(),
      b = await viewport().boundingBox();
    return {
      x:
        b.x + b.width / 2 + (p.x - s.camera.center.x) / s.camera.metersPerPixel,
      y:
        b.y +
        b.height / 2 +
        (p.y - s.camera.center.y) / s.camera.metersPerPixel,
    };
  }
  async function zoom(scale) {
    for (let i = 0; i < 30; i++) {
      const s = await state();
      if (Math.abs(Math.log(s.camera.metersPerPixel / scale)) < 1e-9) break;
      const p = await screen({ x: 0, y: 0 });
      await viewport().dispatchEvent("wheel", {
        clientX: p.x,
        clientY: p.y,
        ctrlKey: true,
        deltaY: Math.max(
          -500,
          Math.min(500, Math.log(scale / s.camera.metersPerPixel) / 0.002),
        ),
        bubbles: true,
        cancelable: true,
      });
      await settle();
    }
    assert(Math.abs((await state()).camera.metersPerPixel - scale) < 1e-8);
  }
  async function drag(p, dx, dy, cancel) {
    const s = await state(),
      point = await screen(p);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(
      point.x + dx / s.camera.metersPerPixel,
      point.y + dy / s.camera.metersPerPixel,
      { steps: 5 },
    );
    await settle();
    if (cancel === "escape") await page.keyboard.press("Escape");
    else if (cancel === "pointercancel")
      await viewport().dispatchEvent("pointercancel", {
        pointerId: 1,
        bubbles: true,
      });
    await page.mouse.up();
    await settle();
  }
  const house = (s) => s.city.buildings.find((b) => b.id === id(105));
  async function undo() {
    await button("Atlasänderung rückgängig").click();
    await settle();
  }
  async function redo() {
    await button("Atlasänderung wiederholen").click();
    await settle();
  }
  async function exact(group) {
    for (const row of manifest[group])
      assert.equal(
        fs.readFileSync(path.join(vault, row.path), "utf8"),
        fs.readFileSync(
          path.join(
            root,
            "tests/fixtures/atlas-e2e-spatial-v2",
            row.fixtureFile,
          ),
          "utf8",
        ),
        row.path,
      );
  }
  async function save() {
    await button("Atlas speichern").click();
    await page.waitForFunction(() => {
      const v = app.workspace
        .getLeavesOfType("dungeon-native-atlas")
        .at(-1).view;
      return (
        !v.repository.dirty && !v.repository.hasDraft && !v.editor.pendingKey
      );
    });
    await settle();
  }
  async function edit() {
    await open();
    await exact("input");
    const initial = await state();
    assert.equal(initial.depth, 0);
    await zoom(0.25);
    assert.equal(await viewport().getAttribute("data-visible-cities"), "1");
    assert.equal(await viewport().getAttribute("data-visible-rooms"), "0");
    await record("City roof visible in same viewport without mode change");
    const center = { x: -10.38, y: 14.096 };
    for (const cancel of ["escape", "pointercancel"]) {
      await drag(center, 4, -2, cancel);
      assert.deepEqual(house(await state()), house(initial));
      assert.equal((await state()).depth, 0);
    }
    await drag(center, 4, -2);
    const moved = await state();
    assert.equal(moved.depth, 1);
    assert(Math.abs(house(moved).position.x + 14) < 1e-8);
    assert(Math.abs(house(moved).position.y - 6) < 1e-8);
    await record(
      "House move applies once; Escape and pointercancel leave geometry/history unchanged",
    );
    await undo();
    assert.deepEqual(house(await state()), house(initial));
    await redo();
    assert.deepEqual(house(await state()), house(moved));
    await zoom(0.1);
    assert.equal(await viewport().getAttribute("data-visible-rooms"), "1");
    const inside = await screen({ x: -14 + 6.096, y: 6 + 6.096 });
    await page.mouse.click(inside.x, inside.y);
    const key = panel().locator(".dn-atlas-room-key");
    await key.waitFor({ state: "visible" });
    assert.equal(await key.getAttribute("data-room-id"), id(31));
    await key
      .getByRole("textbox", { name: "Raumtext 1", exact: true })
      .fill(manifest.oracle.roomText);
    assert.equal((await state()).depth, 1);
    await key.getByRole("button", { name: "Übernehmen", exact: true }).click();
    await settle();
    assert.equal((await state()).depth, 2);
    // Same field remains usable after an Apply; a second draft must reach the current source.
    await key
      .getByRole("textbox", { name: "Raumname", exact: true })
      .fill("Zweiter Textentwurf");
    await key.getByRole("button", { name: "Übernehmen", exact: true }).click();
    await settle();
    assert.equal((await state()).depth, 3);
    await undo();
    assert.equal((await state()).dungeon.entities[0].name, "Torraum");
    await page.screenshot({ path: path.join(out, "city-house-room-key.png") });
    await record(
      "Zoom reveals actual native room; Key edits retain sections, geometry and shared history",
    );
    await zoom(40);
    assert.equal(await viewport().getAttribute("data-visible-rooms"), "0");
    await button("Wald malen").click();
    const point = await screen({ x: 0, y: 0 });
    await page.mouse.click(point.x, point.y);
    await settle();
    await page.waitForFunction(
      (depth) =>
        app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1).view.editor
          .terrain.history.undoDepth ===
        depth + 1,
      2,
    );
    await undo();
    await redo();
    await undo();
    assert.deepEqual((await state()).cells, initial.cells);
    // Explicit new Atlas cancellation rule also applies to unfinished terrain.
    const depth = (await state()).depth;
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await settle();
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await settle();
    assert.equal((await state()).depth, depth);
    assert.deepEqual((await state()).cells, initial.cells);
    await button("Hex auswählen").click();
    await save();
    await exact("expected");
    await record(
      "Hex/room/house share Undo/Redo and Save writes exact native seven-file oracle",
    );
    fs.writeFileSync(
      path.join(qa, "spatial-baseline.json"),
      JSON.stringify(
        {
          manifest,
          city: (await state()).city,
          dungeon: (await state()).dungeon,
        },
        null,
        2,
      ),
    );
    await page.screenshot({ path: path.join(out, "atlas-after-save.png") });
  }
  async function reopen() {
    await open();
    await exact("expected");
    const s = await state();
    assert.equal(s.depth, 0);
    assert.equal(s.dirty, false);
    assert.equal(s.draft, false);
    assert.deepEqual(house(s).position, manifest.oracle.expectedPosition);
    assert.equal(
      s.dungeon.entities[0].key.sections[0].markdown,
      manifest.oracle.roomText,
    );
    await zoom(0.1);
    assert.equal(await viewport().getAttribute("data-visible-rooms"), "1");
    const p = await screen({ x: -14 + 6.096, y: 6 + 6.096 });
    await page.mouse.click(p.x, p.y);
    await panel().locator(".dn-atlas-room-key").waitFor({ state: "visible" });
    await record(
      "Fresh native process restores exact files, geometry and reachable room Key",
    );
    await page.screenshot({
      path: path.join(out, "fresh-process-room-key.png"),
    });
  }
  return { edit, reopen };
};
