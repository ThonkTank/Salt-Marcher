module.exports = ({ page, fs, path, assert, qa, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const mapPath = "Dungeons/Parity/Karte.dungeon";
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    return editor && { document: editor.session.document(),
      tool: editor.tool,
      draft: editor.pathDraft?.points ?? null,
      curves: editor.pathDraft?.curves ?? [],
      dirty: editor.session.dirty,
      paintActive: !!editor.paintWorker };
  });
  const world = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const count = async (expected, timeout = 15000) => page.waitForFunction((expected) => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    return !!editor && !editor.paintWorker &&
      editor.session.document().entities.filter(e => e.kind === "building").length === expected;
  }, expected, { timeout });
  const buildings = async () => (await state()).document.entities.filter(e => e.kind === "building");
  const click = async (point) => {
    const p = await world(point);
    await page.mouse.click(p.x, p.y);
  };
  const double = async (point) => {
    const p = await world(point);
    await page.mouse.dblclick(p.x, p.y, { delay: 90 });
  };
  const drag = async (a, b, modifier) => {
    const from = await world(a), to = await world(b);
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    if (modifier) await page.keyboard.up(modifier);
  };
  async function open(filePath = mapPath) {
    await page.evaluate(async (path) => {
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
    }, filePath);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
  }
  async function edit() {
    await open();
    await chooseTool("Raum");
    await drag({ x: 2, y: 2 }, { x: 9, y: 9 });
    await count(1, 45000);
    const first = (await buildings())[0];
    assert.equal(first.polygons[0].outer.length, 4);
    assert.ok(first.wallWidth > 0);
    await page.screenshot({ path: path.join(out, "rectangle.png") });
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await count(0);
    await page.keyboard.press("Control+y");
    await count(1);
    assert.deepEqual((await buildings())[0], first);
    checks.push("Rectangle, wall and Ctrl+Y redo match one complete history step");
    await drag({ x: 4, y: 4 }, { x: 7, y: 7 }, "Alt");
    await page.waitForFunction(() => {
      const e = app.workspace.activeLeaf?.view?.editor;
      return !e?.paintWorker && e?.session.document().entities.find(x => x.kind === "building")
        ?.polygons[0]?.holes.length === 1;
    });
    await page.screenshot({ path: path.join(out, "rectangle-alt-hole.png") });
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await page.waitForFunction(() => app.workspace.activeLeaf
      ?.view?.editor?.session.document().entities.find(e => e.kind === "building")
      ?.polygons[0]?.holes.length === 0);
    await page.keyboard.press("Control+y");
    await page.waitForFunction(() => app.workspace.activeLeaf
      ?.view?.editor?.session.document().entities.find(e => e.kind === "building")
      ?.polygons[0]?.holes.length === 1);
    checks.push("Alt rectangle erases an inner hole with reversible wall contour");
    await chooseTool("Ellipsenraum");
    await drag({ x: 12, y: 2 }, { x: 18, y: 8 });
    await count(2);
    assert.equal((await buildings())[1].polygons[0].outer.length, 48);
    await drag({ x: 14, y: 4 }, { x: 16, y: 6 }, "Alt");
    await page.waitForFunction(() => {
      const e = app.workspace.activeLeaf?.view?.editor;
      return !e?.paintWorker && e?.session.document().entities.filter(x => x.kind === "building")[1]
        ?.polygons[0]?.holes.length === 1;
    });
    await page.screenshot({ path: path.join(out, "ellipse-alt-hole.png") });
    checks.push("Ellipse has 48 contour points and Alt ellipse creates an inner hole");
    await chooseTool("Polygonraum");
    for (const point of [{ x: 2, y: 12 }, { x: 9, y: 12 },
      { x: 9, y: 13 }, { x: 2, y: 13 }]) await click(point);
    assert.equal((await state()).draft.length, 4);
    await page.keyboard.press("Backspace");
    assert.equal((await state()).draft.length, 3);
    await click({ x: 2, y: 13 });
    await double({ x: 2, y: 13 });
    await count(3);
    const narrow = (await buildings())[2];
    assert.equal(narrow.polygons[0].outer.length, 4);
    assert.ok(narrow.wallWidth > 0);
    checks.push("Backspace removes one draft point; double click closes a one-field polygon corridor");
    await click({ x: 12, y: 11 });
    await click({ x: 18, y: 11 });
    await drag({ x: 18, y: 16 }, { x: 17, y: 15 }, "Shift");
    assert.equal((await state()).draft.length, 3);
    assert.equal((await state()).curves.length, 1);
    await click({ x: 12, y: 16 });
    await page.screenshot({ path: path.join(out, "shift-curve-draft.png") });
    await double({ x: 12, y: 16 });
    await count(4);
    const curve = (await buildings())[3];
    assert.ok(curve.polygons[0].outer.length >= 20);
    await page.screenshot({ path: path.join(out, "shift-curve-commit.png") });
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await count(3);
    await page.keyboard.press("Control+y");
    await count(4);
    checks.push("Shift drag creates sampled floor and wall curve with Undo and Ctrl+Y");
    await chooseTool("Polygonraum");
    await page.keyboard.down("Alt");
    for (const point of [{ x: 13, y: 12 }, { x: 15, y: 12 },
      { x: 15, y: 14 }, { x: 13, y: 14 }]) await click(point);
    await double({ x: 13, y: 14 });
    await page.keyboard.up("Alt");
    await page.waitForFunction(() => {
      const e = app.workspace.activeLeaf?.view?.editor;
      return !e?.paintWorker && e?.session.document().entities
        .filter(x => x.kind === "building")[3]?.polygons[0]?.holes.length === 1;
    });
    await page.screenshot({ path: path.join(out, "polygon-alt-hole.png") });
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await page.waitForFunction(() => app.workspace.activeLeaf
      ?.view?.editor?.session.document().entities.filter(e => e.kind === "building")[3]
      ?.polygons[0]?.holes.length === 0);
    await page.keyboard.press("Control+y");
    await page.waitForFunction(() => app.workspace.activeLeaf
      ?.view?.editor?.session.document().entities.filter(e => e.kind === "building")[3]
      ?.polygons[0]?.holes.length === 1);
    checks.push("Alt polygon cuts a walled inner hole with Undo and Ctrl+Y");
    await chooseTool("Raum");
    await page.getByRole("button", { name: "Snap", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Snap", exact: true })
      .getAttribute("aria-pressed"), "false");
    await drag({ x: 20.25, y: 2.25 }, { x: 22.75, y: 5.75 });
    await count(5);
    const unsnapped = (await buildings())[4];
    assert.ok(unsnapped.polygons[0].outer.some(p =>
      Math.abs(p.x - Math.round(p.x)) > 0.1));
    checks.push("Snap off stores free Building coordinates");
    await page.getByRole("button", { name: "Snap", exact: true }).click();
    await chooseTool("Polygonraum");
    await click({ x: 2.25, y: 16.25 });
    assert.ok(Number.isInteger((await state()).draft[0].x));
    await page.getByRole("button", { name: "Snap", exact: true }).click();
    await click({ x: 4.25, y: 16.25 });
    assert.ok(Math.abs((await state()).draft[1].x -
      Math.round((await state()).draft[1].x)) > 0.1);
    await page.keyboard.press("Escape");
    assert.equal((await state()).tool, "select");
    checks.push("Snap toggles during a polygon draft without changing earlier points");
    const beforeCancel = (await buildings()).length;
    await chooseTool("Raum");
    const from = await world({ x: 20, y: 12 }), to = await world({ x: 22, y: 15 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    assert.equal((await buildings()).length, beforeCancel);
    assert.equal((await state()).tool, "select");
    await chooseTool("Polygonraum");
    await click({ x: 2, y: 16 });
    await click({ x: 4, y: 16 });
    await page.keyboard.press("Escape");
    assert.equal((await state()).draft, null);
    assert.equal((await state()).tool, "select");
    assert.equal((await buildings()).length, beforeCancel);
    checks.push("Escape cancels rectangle drag and polygon draft without changing the map");
    await chooseTool("Polygonraum");
    await click({ x: 2, y: 17 });
    await page.keyboard.press("Backspace");
    assert.deepEqual((await state()).draft, []);
    await page.keyboard.press("Escape");
    await chooseTool("Polygonraum");
    await click({ x: 12, y: 17 });
    await drag({ x: 18, y: 17 }, { x: 17, y: 16 }, "Shift");
    assert.equal((await state()).curves.length, 1);
    await page.keyboard.press("Backspace");
    assert.equal((await state()).curves.length, 0);
    assert.equal((await state()).draft.length, 1);
    await page.keyboard.press("Escape");
    checks.push("Backspace clears the final point and removes an entire Shift curve step");
    await chooseTool("Ellipsenraum");
    const ellipseFrom = await world({ x: 20, y: 12 }),
      ellipseTo = await world({ x: 22, y: 15 });
    await page.mouse.move(ellipseFrom.x, ellipseFrom.y);
    await page.mouse.down();
    await page.mouse.move(ellipseTo.x, ellipseTo.y, { steps: 8 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    assert.equal((await buildings()).length, beforeCancel);
    assert.equal((await state()).tool, "select");
    checks.push("Escape cancels an ellipse drag without adding a Building");
    const beforeEraseCancel = (await state()).document.entities;
    await chooseTool("Raum");
    const eraseFrom = await world({ x: 2, y: 2 }),
      eraseTo = await world({ x: 4, y: 4 });
    await page.keyboard.down("Alt");
    await page.mouse.move(eraseFrom.x, eraseFrom.y);
    await page.mouse.down();
    await page.mouse.move(eraseTo.x, eraseTo.y, { steps: 8 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await page.keyboard.up("Alt");
    assert.deepEqual((await state()).document.entities, beforeEraseCancel);
    assert.equal((await state()).tool, "select");
    checks.push("Escape cancels a held Alt erase and returns to idle mode");
    await page.evaluate(async () => {
      await app.workspace.activeLeaf.view.editor.save();
    });
    await waitForFileAbsent(path.join(vault, mapPath + ".draft"));
    assert.equal((await state()).dirty, false);
    fs.writeFileSync(path.join(qa, "parity-phase1-saved.json"),
      JSON.stringify((await state()).document, null, 2));
    checks.push("All five Buildings save without dirty state");
    await open("Dungeons/Parity/Portal.dungeon");
    assert.equal((await state()).document.entities.filter(e => e.kind === "door").length, 1);
    await chooseTool("Raum");
    await drag({ x: 3.5, y: 1.5 }, { x: 4.5, y: 3 }, "Alt");
    await page.waitForFunction(() => {
      const e = app.workspace.activeLeaf?.view?.editor;
      return !e?.paintWorker && e?.session.document().entities
        .filter(x => x.kind === "building")[0]?.polygons[0]?.outer.length === 8;
    });
    assert.equal((await state()).document.entities.filter(e => e.kind === "door").length, 1);
    await page.screenshot({ path: path.join(out, "portal-wall-partial-cut.png") });
    checks.push("First native matching Alt cut retains the portal on the remaining wall");
    await drag({ x: 3, y: 1.5 }, { x: 5, y: 3 }, "Alt");
    await page.waitForFunction(() => {
      const e = app.workspace.activeLeaf?.view?.editor;
      return !e?.paintWorker && e?.session.document().entities
        .filter(x => x.kind === "door").length === 0;
    });
    assert.equal((await buildings()).length, 1);
    await page.screenshot({ path: path.join(out, "portal-wall-erased.png") });
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await page.waitForFunction(() => app.workspace.activeLeaf
      ?.view?.editor?.session.document().entities.filter(e => e.kind === "door").length === 1);
    await page.keyboard.press("Control+y");
    await page.waitForFunction(() => app.workspace.activeLeaf
      ?.view?.editor?.session.document().entities.filter(e => e.kind === "door").length === 0);
    await page.evaluate(async () => {
      await app.workspace.activeLeaf.view.editor.save();
    });
    await waitForFileAbsent(path.join(vault, "Dungeons/Parity/Portal.dungeon.draft"));
    fs.writeFileSync(path.join(qa, "parity-phase1-portal-saved.json"),
      JSON.stringify((await state()).document, null, 2));
    checks.push("Native matching Alt cut removes a bound portal atomically with Undo, Ctrl+Y and save");
    await open("Dungeons/Parity/Kurve.dungeon");
    await chooseTool("Polygonraum");
    await click({ x: 1, y: 1 });
    await click({ x: 5, y: 1 });
    await drag({ x: 6, y: 5 }, { x: 5, y: 4 }, "Shift");
    await click({ x: 1, y: 6 });
    await double({ x: 1, y: 6 });
    await count(1);
    const diagonal = (await buildings())[0].polygons[0].outer;
    assert.equal(diagonal.length, 20);
    for (const [x, y] of [[1228, 321], [921, 970], [1471, 1291]])
      assert.ok(diagonal.some(p =>
        Math.abs(p.x * 256 - x) <= 2 && Math.abs(p.y * 256 - y) <= 2));
    await page.screenshot({ path: path.join(out, "diagonal-curve.png") });
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await count(0);
    await page.keyboard.press("Control+y");
    await count(1);
    await page.evaluate(async () => {
      await app.workspace.activeLeaf.view.editor.save();
    });
    await waitForFileAbsent(path.join(vault, "Dungeons/Parity/Kurve.dungeon.draft"));
    fs.writeFileSync(path.join(qa, "parity-phase1-curve-saved.json"),
      JSON.stringify((await state()).document, null, 2));
    checks.push("Diagonal Shift curve matches native samples, Undo/Redo and save");
    await open("Dungeons/Parity/Mehrkurve.dungeon");
    await chooseTool("Polygonraum");
    await click({ x: 1, y: 1 });
    await click({ x: 6, y: 1 });
    await drag({ x: 6, y: 3 }, { x: 5, y: 2 }, "Shift");
    await click({ x: 5, y: 4 });
    await drag({ x: 4, y: 6 }, { x: 3, y: 5 }, "Shift");
    assert.equal((await state()).curves.length, 2);
    await click({ x: 1, y: 6 });
    await double({ x: 1, y: 6 });
    await count(1);
    const multi = (await buildings())[0];
    assert.ok(multi.wallWidth > 0);
    assert.equal(multi.polygons.length, 1);
    assert.equal(multi.polygons[0].outer.length, 39);
    assert.ok(!multi.polygons[0].outer.some(p => p.x === 5 && p.y === 4));
    for (const [x, y] of [[1523, 295], [811, 1424]])
      assert.ok(multi.polygons[0].outer.some(p =>
        Math.abs(p.x * 256 - x) <= 3 && Math.abs(p.y * 256 - y) <= 3));
    await page.screenshot({ path: path.join(out, "multi-curve.png") });
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await count(0);
    await page.keyboard.press("Control+y");
    await count(1);
    await page.evaluate(async () => {
      await app.workspace.activeLeaf.view.editor.save();
    });
    await waitForFileAbsent(path.join(vault, "Dungeons/Parity/Mehrkurve.dungeon.draft"));
    fs.writeFileSync(path.join(qa, "parity-phase1-multi-curve-saved.json"),
      JSON.stringify((await state()).document, null, 2));
    checks.push("Two separated Shift curves create one walled Building with native contour samples, history and save");
  }
  async function reopen() {
    await open();
    const saved = JSON.parse(fs.readFileSync(path.join(qa, "parity-phase1-saved.json"), "utf8"));
    const fresh = await state();
    assert.deepEqual(fresh.document.entities, saved.entities);
    assert.equal(fresh.document.entities.filter(e => e.kind === "building").length, 5);
    assert.equal(fresh.dirty, false);
    await page.screenshot({ path: path.join(out, "phase1-reopen.png") });
    checks.push("Fresh Obsidian process restores all five Building effects and stored contours");
    await open("Dungeons/Parity/Portal.dungeon");
    const portalSaved = JSON.parse(fs.readFileSync(
      path.join(qa, "parity-phase1-portal-saved.json"), "utf8"));
    const portalFresh = await state();
    assert.deepEqual(portalFresh.document.entities, portalSaved.entities);
    assert.equal(portalFresh.document.entities.filter(e => e.kind === "door").length, 0);
    assert.equal(portalFresh.dirty, false);
    await page.screenshot({ path: path.join(out, "portal-wall-reopen.png") });
    checks.push("Fresh Obsidian process keeps the cut contour and removed portal");
    await open("Dungeons/Parity/Kurve.dungeon");
    const curveSaved = JSON.parse(fs.readFileSync(
      path.join(qa, "parity-phase1-curve-saved.json"), "utf8"));
    const curveFresh = await state();
    assert.deepEqual(curveFresh.document.entities, curveSaved.entities);
    assert.equal(curveFresh.document.entities.filter(e => e.kind === "building").length, 1);
    assert.equal(curveFresh.dirty, false);
    await page.screenshot({ path: path.join(out, "diagonal-curve-reopen.png") });
    checks.push("Fresh Obsidian process keeps the diagonal Building contour");
    await open("Dungeons/Parity/Mehrkurve.dungeon");
    const multiSaved = JSON.parse(fs.readFileSync(
      path.join(qa, "parity-phase1-multi-curve-saved.json"), "utf8"));
    const multiFresh = await state();
    assert.deepEqual(multiFresh.document.entities, multiSaved.entities);
    assert.equal(multiFresh.document.entities.filter(e => e.kind === "building").length, 1);
    assert.equal(multiFresh.dirty, false);
    await page.screenshot({ path: path.join(out, "multi-curve-reopen.png") });
    checks.push("Fresh Obsidian process keeps both Shift curves and their wall");
  }
  return { edit, reopen };
};
