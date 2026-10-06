module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const mapPath = "Dungeons/Parity/Punkte.dungeon";
  const notePath = "Dungeons/Parity/Räume/01 Punktraum.md";
  const savedState = path.join(qa, "parity-phase2-points-saved.json");
  const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    return editor && { document: editor.session.document(),
      dirty: editor.session.dirty, history: editor.session.historySize,
      tool: editor.tool, selected: editor.selected,
      preview: editor.renderer.buildingPreview && {
        id: editor.renderer.buildingPreview.sourceId,
        polygons: editor.renderer.buildingPreview.entity.polygons,
        portalCount: editor.renderer.buildingPreview.portals.length,
        sourceHidden: !editor.renderer.visuals.get(
          editor.renderer.buildingPreview.sourceId).container.visible,
      } };
  });
  const building = async (id) => (await state()).document.entities.find(
    entity => entity.id === id);
  const world = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer,
      box = renderer.canvas.getBoundingClientRect(),
      screen = { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
        y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
    if (screen.x < box.x || screen.x >= box.right ||
        screen.y < box.y || screen.y >= box.bottom)
      throw new Error("Point outside canvas: " + JSON.stringify(point));
    return screen;
  }, point);
  async function open() {
    await page.evaluate(async (file) => {
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file));
    }, mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
  }
  async function select(point, id) {
    const at = await world(point);
    await page.mouse.click(at.x, at.y);
    await page.waitForFunction(id =>
      app.workspace.activeLeaf?.view?.editor?.selected === id, id);
  }
  async function hover(point, contour, index, kind = "vertex") {
    const at = await world(point);
    await page.mouse.move(at.x + 10, at.y + 10);
    await page.mouse.move(at.x, at.y);
    await page.waitForFunction(({ contour, index, kind }) => {
      const editor = app.workspace.activeLeaf?.view?.editor;
      return editor?.renderer.buildingPointHover?.contour === contour &&
        editor.renderer.buildingPointHover.index === index &&
        editor.renderer.buildingPointHover.kind === kind;
    }, { contour, index, kind });
  }
  async function drag(from, to, id, label, cancel = false) {
    const a = await world(from), b = await world(to), before = await state();
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.waitForFunction(id =>
      app.workspace.activeLeaf?.view?.editor?.renderer?.buildingPreview?.sourceId === id,
    id);
    const held = await state();
    assert.equal(held.preview.id, id);
    assert.equal(held.preview.sourceHidden, true);
    assert.deepEqual(held.document, before.document);
    assert.equal(held.history, before.history);
    assert.equal(held.dirty, before.dirty);
    await page.screenshot({ path: path.join(out, label + "-held.png") });
    if (cancel) {
      await page.keyboard.press("Escape");
      await page.mouse.up();
      assert.deepEqual((await state()).document, before.document);
    } else {
      await page.mouse.up();
      await page.waitForFunction(id =>
        !app.workspace.activeLeaf?.view?.editor?.renderer?.buildingPreview &&
        !!app.workspace.activeLeaf?.view?.editor?.session.entities.get(id), id);
      assert.equal((await state()).history, before.history + 1);
    }
    await page.screenshot({ path: path.join(out, label + "-after.png") });
  }
  async function undoRedo(id, before, after) {
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    assert.deepEqual(await building(id), before);
    await page.keyboard.press("Control+y");
    assert.deepEqual(await building(id), after);
  }
  async function edit() {
    await open();
    await chooseTool("Punkte");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    assert.equal((await state()).tool, "edit-points");
    const keyHash = digest(fs.readFileSync(path.join(vault, notePath)));

    await select({ x: 4, y: 4 }, "rect");
    await hover({ x: 2, y: 2 }, 0, 0);
    const rectBefore = await building("rect");
    await drag({ x: 2, y: 2 }, { x: 1, y: 1 }, "rect", "rectangle-point");
    const rectAfter = await building("rect");
    assert.deepEqual(rectAfter.polygons[0].outer[0], { x: 1, y: 1 });
    assert.equal(rectAfter.number, rectBefore.number);
    assert.equal(rectAfter.note.path, rectBefore.note.path);
    await undoRedo("rect", rectBefore, rectAfter);
    await select({ x: 4, y: 4 }, "rect");
    await drag({ x: 6, y: 6 }, { x: 7, y: 7 }, "rect", "rectangle-cancel", true);
    assert.deepEqual(await building("rect"), rectAfter);
    checks.push("Building mode moves one rectangle grip with transient floor/wall preview and one undo step");

    await select({ x: 12, y: 4 }, "ellipse");
    const ellipseBefore = await building("ellipse"),
      point = ellipseBefore.polygons[0].outer[16];
    assert.equal(ellipseBefore.polygons[0].outer.length, 32);
    await hover(point, 0, 16);
    await drag(point, { x: point.x - 1, y: point.y }, "ellipse", "ellipse-point");
    const ellipseAfter = await building("ellipse");
    assert.equal(ellipseAfter.polygons[0].outer.length, 32);
    assert.deepEqual(ellipseAfter.polygons[0].outer[16],
      { x: point.x - 1, y: point.y });
    await undoRedo("ellipse", ellipseBefore, ellipseAfter);
    checks.push("32-point ellipse changes exactly one grip, with held preview, undo and redo");

    await select({ x: 5, y: 11 }, "triangle");
    await hover({ x: 4, y: 10 }, 0, 0, "edge");
    const triangleBefore = await building("triangle"),
      portalBefore = (await state()).document.entities.find(e => e.id === "triangle-door");
    await drag({ x: 4, y: 10 }, { x: 4, y: 9 }, "triangle", "edge-insert");
    const triangleAfter = await building("triangle"),
      portalAfter = (await state()).document.entities.find(e => e.id === "triangle-door");
    assert.equal(triangleAfter.polygons[0].outer.length, 4);
    assert.equal(portalAfter.anchor.boundaryId, "triangle");
    await undoRedo("triangle", triangleBefore, triangleAfter);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    assert.deepEqual((await state()).document.entities.find(e => e.id === "triangle-door"), portalBefore);
    await page.keyboard.press("Control+y");
    assert.deepEqual((await state()).document.entities.find(e => e.id === "triangle-door"), portalAfter);
    await select({ x: 5, y: 11 }, "triangle");
    await hover({ x: 3, y: 9.5 }, 0, 0, "edge");
    await drag({ x: 3, y: 9.5 }, { x: 3, y: 8.5 }, "triangle", "edge-cancel", true);
    checks.push("Edge-midpoint insertion previews and commits floor, wall and bound portal atomically");

    await select({ x: 4, y: 4 }, "rect");
    await hover({ x: 6, y: 2 }, 0, 1);
    await page.keyboard.press("Backspace");
    const rectThree = await building("rect");
    assert.equal(rectThree.polygons[0].outer.length, 3);
    await hover(rectThree.polygons[0].outer[0], 0, 0);
    const beforeMinimum = await state();
    await page.keyboard.press("Backspace");
    assert.deepEqual((await state()).document, beforeMinimum.document);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    assert.deepEqual(await building("rect"), rectAfter);
    await select({ x: 4, y: 4 }, "rect");
    await hover({ x: 6, y: 2 }, 0, 1);
    await page.keyboard.press("Delete");
    assert.deepEqual(await building("rect"), rectThree);
    await hover(rectThree.polygons[0].outer[0], 0, 0);
    const beforeDeleteMinimum = await state();
    await page.keyboard.press("Delete");
    assert.deepEqual((await state()).document, beforeDeleteMinimum.document);
    assert.deepEqual((await state()).document, beforeMinimum.document);
    checks.push("Backspace and Delete each remove one hovered point; three-point keys preserve the Building");

    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, mapPath + ".draft"));
    await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor?.session.dirty === false);
    assert.equal(digest(fs.readFileSync(path.join(vault, notePath))), keyHash);
    const final = (await state()).document,
      mapHash = digest(fs.readFileSync(path.join(vault, mapPath)));
    fs.writeFileSync(savedState, JSON.stringify({ final, mapHash, keyHash,
      rect: rectThree, ellipse: ellipseAfter,
      triangle: triangleAfter, portal: portalAfter }, null, 2));
    checks.push("Phase-2 point map saves with unchanged room-key bytes");
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(savedState));
    assert.equal(digest(fs.readFileSync(path.join(vault, mapPath))), saved.mapHash);
    assert.equal(digest(fs.readFileSync(path.join(vault, notePath))), saved.keyHash);
    await open();
    const current = await state();
    assert.deepEqual(current.document, saved.final);
    assert.deepEqual(await building("rect"), saved.rect);
    assert.deepEqual(await building("ellipse"), saved.ellipse);
    assert.deepEqual(await building("triangle"), saved.triangle);
    assert.deepEqual(current.document.entities.find(e => e.id === "triangle-door"), saved.portal);
    await chooseTool("Punkte");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await select({ x: 4, y: 4 }, "rect");
    await hover(saved.rect.polygons[0].outer[0], 0, 0);
    await page.screenshot({ path: path.join(out, "fresh-points.png") });
    checks.push("Fresh Obsidian process restores edited contours, portal and unchanged room key");
  }
  return { edit, reopen };
};
