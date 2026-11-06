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
  async function heldShape(a, b, label, screenshot, expected = 1) {
    const from = await world(a), to = await world(b);
    if (expected === 1 && screenshot === "rectangle-4x3-preview.png") {
      const before = await page.evaluate(({ from, to }) => {
        const editor = app.workspace.activeLeaf?.view?.editor;
        const canvas = editor?.renderer?.canvas;
        return { tool: editor?.tool, from, to, canvas: canvas?.getBoundingClientRect().toJSON(),
          hitFrom: document.elementFromPoint(from.x, from.y)?.outerHTML.slice(0, 200),
          hitTo: document.elementFromPoint(to.x, to.y)?.outerHTML.slice(0, 200),
          active: document.activeElement?.outerHTML.slice(0, 200) };
      }, { from, to });
      fs.writeFileSync(path.join(out, "rectangle-before-input.json"), JSON.stringify(before, null, 2));
      await page.evaluate(() => {
        window.__phase1RectangleAbort?.abort();
        const abort = new AbortController();
        window.__phase1RectangleAbort = abort;
        window.__phase1RectangleEvents = [];
        const canvas = app.workspace.activeLeaf.view.editor.renderer.canvas;
        const record = (where) => (event) => {
          const editor = app.workspace.activeLeaf?.view?.editor;
          if (window.__phase1RectangleEvents.length >= 512) return;
          window.__phase1RectangleEvents.push({ time: Math.round(performance.now() * 10) / 10,
            where, type: event.type, pointer: event.pointerId,
            target: event.target?.tagName, active: document.activeElement?.tagName,
            capture: canvas.hasPointerCapture(event.pointerId),
            gesture: editor?.gesture && { pointer: editor.gesture.pointer,
              tool: editor.gesture.tool, moved: editor.gesture.moved },
            paint: !!editor?.paintWorker,
            buildings: editor?.session.document().entities.filter(e => e.kind === "building").length });
        };
        for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel",
          "gotpointercapture", "lostpointercapture"]) {
          window.addEventListener(type, record("window-capture"),
            { capture: true, signal: abort.signal });
          canvas.addEventListener(type, record("canvas-bubble"),
            { signal: abort.signal });
        }
      });
    }
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    if (expected === 1 && screenshot === "rectangle-4x3-preview.png") {
      const after = await page.evaluate(() => {
        const editor = app.workspace.activeLeaf?.view?.editor;
        return { tool: editor?.tool, gesture: editor?.gesture,
          active: document.activeElement?.outerHTML.slice(0, 200) };
      });
      fs.writeFileSync(path.join(out, "rectangle-after-down.json"), JSON.stringify(after, null, 2));
    }
    await page.mouse.move(to.x, to.y, { steps: 8 });
    try {
      await page.waitForFunction((label) => {
        const editor = app.workspace.activeLeaf?.view?.editor;
        return editor?.renderer.previewSize?.visible &&
          editor.renderer.previewSize.text === label;
      }, label);
    } catch (error) {
      if (expected === 1 && screenshot === "rectangle-4x3-preview.png")
        fs.writeFileSync(path.join(out, "rectangle-preview-failure.json"),
          JSON.stringify(await page.evaluate(() => {
            const editor = app.workspace.activeLeaf?.view?.editor;
            window.__phase1RectangleAbort?.abort();
            return { events: window.__phase1RectangleEvents,
              gesture: editor?.gesture, preview: editor?.renderer.previewSize?.text,
              buildings: editor?.session.document().entities
                .filter((e) => e.kind === "building").length };
          }), null, 2));
      throw error;
    }
    await page.screenshot({ path: path.join(out, screenshot) });
    await page.mouse.up();
    if (expected === 1 && screenshot === "rectangle-4x3-preview.png") {
      const after = await page.evaluate(() => {
        const editor = app.workspace.activeLeaf?.view?.editor;
        window.__phase1RectangleAbort?.abort();
        return { events: window.__phase1RectangleEvents,
          gesture: editor?.gesture, paint: !!editor?.paintWorker,
          buildings: editor?.session.document().entities
            .filter((e) => e.kind === "building").length };
      });
      fs.writeFileSync(path.join(out, "rectangle-after-up.json"), JSON.stringify(after, null, 2));
    }
    await count(expected);
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
  async function shiftDrag(a, b) {
    const from = await world(a), to = await world(b);
    await page.keyboard.down("Shift");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
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

    await open("Kreuzung");
    await chooseTool("Polygonraum");
    await click({ x: 1, y: 1 });
    await click({ x: 6, y: 1 });
    await shiftDrag({ x: 6, y: 4 }, { x: 5, y: 3 });
    await shiftDrag({ x: 4, y: 6 }, { x: 3, y: 5 });
    await click({ x: 1, y: 6 });
    await double({ x: 1, y: 6 });
    await count(1);
    const crossing = await building();
    assert.deepEqual(crossing.polygons.map(p => p.outer.length), [14, 8]);
    assert.ok(crossing.wallWidth > 0);
    assert.ok(Math.abs(crossing.polygons[0].outer[0].x * 256 - 1510) <= 1);
    await page.screenshot({ path: path.join(out, "consecutive-shift-crossing.png") });
    await undoRedo();
    await save("Kreuzung");
    checks.push("Consecutive Shift gestures store the native two crossing contours and walls");

    await open("Snap");
    await chooseTool("Raum");
    assert.equal(await page.evaluate(() =>
      app.workspace.activeLeaf.view.editor.snapEnabled), true);
    await heldShape({ x: 1.46875, y: 1.46875 },
      { x: 2.46875, y: 2.46875 }, "(1, 1)", "snap-below-half.png");
    await heldShape({ x: 4.5, y: 4.5 }, { x: 5.5, y: 5.5 },
      "(1, 1)", "snap-at-half.png", 2);
    const snapped = (await state()).document.entities
      .filter(e => e.kind === "building").map(e => e.polygons[0].outer);
    assert.deepEqual(snapped, [
      [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }],
      [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }],
    ]);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await count(1);
    await page.keyboard.press("Control+y");
    await count(2);
    await save("Snap");
    checks.push("Positive Snap rounds to the nearest field, including the native half-field tie");
  }
  async function reopen() {
    for (const name of ["Rechteck", "Ellipse", "Gang", "Kreuzung", "Snap"]) {
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
