module.exports = ({ page, fs, path, assert, qa, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const prefix = "Dungeons/Parity/Form-";
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    return editor && { document: editor.session.document(), dirty: editor.session.dirty,
      preview: editor.renderer.previewSize?.visible
        ? editor.renderer.previewSize.text : null };
  });
  const world = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const count = async (expected) => page.waitForFunction((expected) => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    return !!editor && !editor.paintWorker &&
      editor.session.document().entities.filter(e => e.kind === "building").length === expected;
  }, expected, { timeout: 45000 });
  const building = async () => (await state()).document.entities.find(e => e.kind === "building");
  async function open(name) {
    await page.evaluate(async (file) => {
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file));
    }, prefix + name + ".dungeon");
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
  }
  async function heldShape(a, b, label, screenshot) {
    const from = await world(a), to = await world(b);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.waitForFunction((label) => {
      const editor = app.workspace.activeLeaf?.view?.editor;
      return editor?.renderer.previewSize?.visible &&
        editor.renderer.previewSize.text === label;
    }, label);
    await page.screenshot({ path: path.join(out, screenshot) });
    await page.mouse.up();
    await count(1);
    assert.equal((await state()).preview, null);
  }
  async function click(point) {
    const p = await world(point);
    await page.mouse.click(p.x, p.y);
  }
  async function double(point) {
    const p = await world(point);
    await page.mouse.dblclick(p.x, p.y, { delay: 90 });
  }
  async function save(name) {
    await page.evaluate(async () => {
      await app.workspace.activeLeaf.view.editor.save();
    });
    await waitForFileAbsent(path.join(vault, prefix + name + ".dungeon.draft"));
    const current = await state();
    assert.equal(current.dirty, false);
    fs.writeFileSync(path.join(qa, "phase1-form-" + name + "-saved.json"),
      JSON.stringify(current.document, null, 2));
  }
  async function undoRedo() {
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await count(0);
    await page.keyboard.press("Control+y");
    await count(1);
  }
  async function edit() {
    await open("Rechteck");
    await chooseTool("Raum");
    await heldShape({ x: 2, y: 2 }, { x: 6, y: 5 }, "(4, 3)", "rectangle-4x3-preview.png");
    assert.deepEqual((await building()).polygons[0].outer,
      [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 2, y: 5 }]);
    assert.ok((await building()).wallWidth > 0);
    await undoRedo();
    await save("Rechteck");
    checks.push("Rectangle preview shows native 4×3 fields; floor and wall contour, history and save match");

    await open("Ellipse");
    await chooseTool("Ellipsenraum");
    await heldShape({ x: 1, y: 1 }, { x: 4, y: 3 }, "(3, 2)", "ellipse-3x2-preview.png");
    const ring = (await building()).polygons[0].outer;
    assert.equal(ring.length, 28);
    assert.ok(ring.some(p => Math.abs(p.x * 256 - 725) <= 1.5 &&
      Math.abs(p.y * 256 - 262) <= 1.5));
    assert.ok((await building()).wallWidth > 0);
    await undoRedo();
    await save("Ellipse");
    checks.push("Ellipse preview shows native 3×2 fields and commits 28 native sampled points with wall");

    await open("Gang");
    await chooseTool("Polygonraum");
    for (const point of [{ x: 2, y: 2 }, { x: 3, y: 2 },
      { x: 3, y: 5 }, { x: 2, y: 5 }]) await click(point);
    await double({ x: 2, y: 5 });
    await count(1);
    assert.deepEqual((await building()).polygons[0].outer,
      [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 5 }, { x: 2, y: 5 }]);
    assert.ok((await building()).wallWidth > 0);
    await page.screenshot({ path: path.join(out, "polygon-corridor-1x3.png") });
    await undoRedo();
    await save("Gang");
    checks.push("Native 1×3 polygon corridor closes as one walled, reversible Building");
  }
  async function reopen() {
    for (const name of ["Rechteck", "Ellipse", "Gang"]) {
      await open(name);
      const saved = JSON.parse(fs.readFileSync(
        path.join(qa, "phase1-form-" + name + "-saved.json"), "utf8"));
      const fresh = await state();
      assert.deepEqual(fresh.document.entities, saved.entities);
      assert.equal(fresh.dirty, false);
      await page.screenshot({ path: path.join(out, "reopen-" + name + ".png") });
      checks.push("Fresh process restores " + name + " contour and wall");
    }
  }
  return { edit, reopen };
};
