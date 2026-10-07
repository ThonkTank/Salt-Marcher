module.exports = ({ page, fs, path, assert, crypto, root, qa, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const mapPath = "Dungeons/Parity/Punkte.dungeon";
  const portalPath = "Dungeons/Parity/Punkte-Portal.dungeon";
  const contoursPath = "Dungeons/Parity/Punkte-Konturen.dungeon";
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
        wallSprites: editor.renderer.buildingPreview.wallLayer.children.length,
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
  async function open(file = mapPath) {
    await page.evaluate(async (file) => {
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file));
    }, file);
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
    if (before.document.entities.find(e => e.id === id)?.wallAssetId)
      await page.waitForFunction(() =>
        app.workspace.activeLeaf?.view?.editor?.renderer?.buildingPreview?.wallLayer.children.length > 0);
    const held = await state();
    assert.equal(held.preview.id, id);
    assert.equal(held.preview.sourceHidden, true);
    if (before.document.entities.find(e => e.id === id)?.wallAssetId)
      assert.ok(held.preview.wallSprites > 0, "package wall preview");
    assert.deepEqual(held.document, before.document);
    assert.equal(held.history, before.history);
    assert.equal(held.dirty, before.dirty);
    await page.screenshot({ path: path.join(out, label + "-held.png") });
    if (cancel) {
      if (cancel === "pointercancel")
        await page.locator(".dn-canvas canvas").evaluate(canvas =>
          canvas.dispatchEvent(new PointerEvent("pointercancel", {
            bubbles: true, pointerId: 1, pointerType: "mouse" })));
      else await page.keyboard.press("Escape");
      await page.mouse.up();
      if (cancel === "pointercancel") {
        assert.deepEqual((await state()).document, before.document);
        assert.equal((await state()).history, before.history);
      } else {
        assert.notDeepEqual((await state()).document, before.document);
        assert.equal((await state()).history, before.history + 1);
        assert.equal((await state()).tool, "select");
      }
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
  async function measuredGripHit() {
    await select({ x: 4, y: 4 }, "rect");
    for (const scale of [64, 48]) {
      await page.evaluate(scale => {
        const renderer = app.workspace.activeLeaf.view.editor.renderer,
          box = renderer.canvas.getBoundingClientRect();
        renderer.camera.scale = scale;
        renderer.camera.x = box.width / 2 - 4 * scale;
        renderer.camera.y = box.height / 2 - 4 * scale;
        renderer.zoom(1);
      }, scale);
      for (const [kind, point, index] of [
        ["vertex", { x: 2, y: 2 }, 0],
        ["edge", { x: 4, y: 2 }, 0],
      ]) {
        const at = await world(point);
        await page.mouse.move(at.x + 32, at.y - 32);
        await page.mouse.move(at.x, at.y - 15);
        await page.waitForFunction(({ kind, index }) => {
          const hover = app.workspace.activeLeaf?.view?.editor?.renderer?.buildingPointHover;
          return hover?.kind === kind && hover.index === index;
        }, { kind, index });
        await page.mouse.move(at.x, at.y - 17);
        await page.waitForFunction(() =>
          !app.workspace.activeLeaf?.view?.editor?.renderer?.buildingPointHover);
      }
      await page.screenshot({ path: path.join(out, "grips-" + scale + ".png") });
    }
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    checks.push("Native-sized vertex and edge hit zones hold at 100 and 75 percent zoom");
  }
  async function edit() {
    await open();
    const packPath = root + "/../dungeon-auswertung/tests/fixtures/wall-texture-probe/own-walls.dungeondraft_pack";
    const pack = fs.readFileSync(packPath);
    assert.equal(digest(pack), "eaad533f4da8880bf8c0339d9d6ae66dd3d8e1c1d60917288ab0a91242d51ad9");
    await page.evaluate(async (encoded) => {
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
      const editor = app.workspace.activeLeaf.view.editor;
      const asset = plugin.listAssets(["QAWall01"]).find(item => item.kind === "wall");
      if (!asset) throw new Error("QA package wall missing");
      const ids = ["rect", "ellipse", "triangle"];
      editor.session.execute({ label: "QA-Paketwand aktivieren",
        settings: { before: editor.session.settings,
          after: { ...editor.session.settings, assetPacks: ["QAWall01"] } },
        entities: ids.map(id => { const before = editor.session.entities.get(id);
          return { id, before, after: { ...before, wallAssetId: asset.id } }; }) });
    }, pack.toString("base64"));
    await chooseTool("Punkte");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    assert.equal((await state()).tool, "edit-points");
    const keyHash = digest(fs.readFileSync(path.join(vault, notePath)));
    await measuredGripHit();

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
    await drag({ x: 6, y: 6 }, { x: 7, y: 7 }, "rect", "rectangle-escape", "escape");
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    assert.deepEqual(await building("rect"), rectAfter);
    await chooseTool("Punkte");
    await select({ x: 4, y: 4 }, "rect");
    await drag({ x: 2, y: 6 }, { x: 1, y: 7 }, "rect", "rectangle-pointercancel", "pointercancel");
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
      portalBefore = (await state()).document.entities.filter(e => e.id.startsWith("triangle-door"));
    await drag({ x: 4, y: 10 }, { x: 4, y: 9 }, "triangle", "edge-insert");
    const triangleAfter = await building("triangle"),
      portalAfter = (await state()).document.entities.filter(e => e.id.startsWith("triangle-door"));
    assert.equal(triangleAfter.polygons[0].outer.length, 4);
    assert.deepEqual(portalAfter.map(portal => portal.id), ["triangle-door-2"]);
    assert.equal(portalAfter[0].anchor.boundaryId, "triangle");
    await undoRedo("triangle", triangleBefore, triangleAfter);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    assert.deepEqual((await state()).document.entities.filter(e => e.id.startsWith("triangle-door")), portalBefore);
    await page.keyboard.press("Control+y");
    assert.deepEqual((await state()).document.entities.filter(e => e.id.startsWith("triangle-door")), portalAfter);
    const portalSnapshot = (await state()).document;
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, mapPath + ".draft"));
    await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor?.session.dirty === false);
    fs.copyFileSync(path.join(vault, mapPath), path.join(vault, portalPath));
    const portalHash = digest(fs.readFileSync(path.join(vault, portalPath)));
    await select({ x: 5, y: 11 }, "triangle");
    await hover({ x: 3, y: 9.5 }, 0, 0, "edge");
    await drag({ x: 3, y: 9.5 }, { x: 3, y: 8.5 }, "triangle", "edge-escape", "escape");
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    assert.deepEqual(await building("triangle"), triangleAfter);
    await chooseTool("Punkte");
    checks.push("Edge-midpoint insertion keeps the distant portal and removes the one on its replaced wall atomically");

    await select({ x: 5, y: 11 }, "triangle");
    await hover({ x: 4, y: 9 }, 0, 1);
    await page.keyboard.press("Backspace");
    const triangleThree = await building("triangle"),
      portalsThree = (await state()).document.entities.filter(e => e.id.startsWith("triangle-door"));
    assert.equal(triangleThree.polygons[0].outer.length, 3);
    await hover({ x: 2, y: 10 }, 0, 0);
    const beforeOutline = await state();
    await page.keyboard.press("Delete");
    assert.equal(await building("triangle"), undefined);
    assert.equal((await state()).document.entities.filter(e => e.id.startsWith("triangle-door")).length, 0);
    assert.equal((await state()).history, beforeOutline.history + 1);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    assert.deepEqual(await building("triangle"), triangleThree);
    assert.deepEqual((await state()).document.entities.filter(e => e.id.startsWith("triangle-door")), portalsThree);
    await page.keyboard.press("Control+y");
    assert.equal(await building("triangle"), undefined);
    checks.push("Backspace removes one point, Delete removes the final non-room outline and its remaining portal in one undo step");

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
      triangle: null, portals: [], portalSnapshot, portalHash, portalAfter }, null, 2));
    checks.push("Phase-2 point map saves with unchanged room-key bytes");

    await open(contoursPath);
    await chooseTool("Punkte");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await select({ x: 7, y: 2.7 }, "multipart");
    await hover({ x: 6, y: 2 }, 1, 0);
    const multiBefore = await building("multipart");
    await page.keyboard.press("Backspace");
    const multiAfter = await building("multipart");
    assert.equal(multiAfter.polygons.length, 1);
    assert.deepEqual(multiAfter.polygons[0], multiBefore.polygons[0]);
    await undoRedo("multipart", multiBefore, multiAfter);
    await select({ x: 12, y: 3 }, "hole");
    await hover({ x: 13, y: 4 }, 1, 0);
    const holeBefore = await building("hole");
    await page.keyboard.press("Delete");
    const holeAfter = await building("hole");
    assert.deepEqual(holeAfter.polygons[0].outer, holeBefore.polygons[0].outer);
    assert.deepEqual(holeAfter.polygons[0].holes, []);
    await undoRedo("hole", holeBefore, holeAfter);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, contoursPath + ".draft"));
    await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor?.session.dirty === false);
    const contoursFinal = (await state()).document;
    const contoursHash = digest(fs.readFileSync(path.join(vault, contoursPath)));
    const persisted = JSON.parse(fs.readFileSync(savedState));
    fs.writeFileSync(savedState, JSON.stringify({ ...persisted,
      contoursFinal, contoursHash, multiAfter, holeAfter }, null, 2));
    checks.push("Three-point Backspace removes only the selected multipart ring; Delete removes only the selected hole");
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
    assert.equal(await building("triangle"), undefined);
    assert.deepEqual(current.document.entities.filter(e => e.id.startsWith("triangle-door")), []);
    assert.equal(digest(fs.readFileSync(path.join(vault, portalPath))), saved.portalHash);
    await open(portalPath);
    assert.deepEqual((await state()).document, saved.portalSnapshot);
    assert.deepEqual((await state()).document.entities.filter(e => e.id.startsWith("triangle-door")), saved.portalAfter);
    checks.push("Fresh Obsidian process restores the distant surviving portal after edge insertion");
    assert.equal(digest(fs.readFileSync(path.join(vault, contoursPath))), saved.contoursHash);
    await open(contoursPath);
    assert.deepEqual((await state()).document, saved.contoursFinal);
    assert.deepEqual(await building("multipart"), saved.multiAfter);
    assert.deepEqual(await building("hole"), saved.holeAfter);
    checks.push("Fresh Obsidian process restores selected multipart and hole removal");
    await open();
    await chooseTool("Punkte");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await select({ x: 4, y: 4 }, "rect");
    await hover(saved.rect.polygons[0].outer[0], 0, 0);
    await page.screenshot({ path: path.join(out, "fresh-points.png") });
    checks.push("Fresh Obsidian process restores edited contours, portal and unchanged room key");
  }
  return { edit, reopen };
};
