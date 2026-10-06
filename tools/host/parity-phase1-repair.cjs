module.exports = ({ page, fs, path, assert, crypto, qa, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const prefix = "Dungeons/Parity/Repair-";
  const savedPath = path.join(qa, "phase1-repair-saved.json");
  const editorState = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    return editor && { document: editor.session.document(), dirty: editor.session.dirty,
      snap: editor.snapEnabled, tool: editor.tool, draft: editor.pathDraft?.points ?? null,
      preview: editor.renderer.previewSize?.visible };
  });
  const at = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    const screen = { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
    if (screen.x < box.x || screen.x >= box.right ||
        screen.y < box.y || screen.y >= box.bottom)
      throw new Error("Test point outside canvas: " + JSON.stringify(point));
    return screen;
  }, point);
  const count = (expected) => page.waitForFunction((expected) => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    return !!editor && !editor.paintWorker && editor.session.document().entities
      .filter((entity) => entity.kind === "building").length === expected;
  }, expected, { timeout: 45000 });
  const buildings = async () => (await editorState()).document.entities
    .filter((entity) => entity.kind === "building");
  const keyBytes = (relative) => fs.readFileSync(path.join(vault, relative));
  const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
  async function open(name) {
    await page.evaluate(async (file) => {
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file));
    }, prefix + name + ".dungeon");
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
  }
  async function click(point) {
    const screen = await at(point);
    await page.mouse.click(screen.x, screen.y);
  }
  async function double(point) {
    const screen = await at(point);
    await page.mouse.dblclick(screen.x, screen.y, { delay: 90 });
  }
  async function drag(a, b, modifier) {
    const from = await at(a), to = await at(b);
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    if (modifier) await page.keyboard.up(modifier);
  }
  async function save(name) {
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, prefix + name + ".dungeon.draft"));
    await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor?.session.dirty === false);
  }
  async function preview() {
    await open("Preview");
    const contours = [];
    const handles = [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 3 }];
    for (let index = 0; index < handles.length; index++) {
      await chooseTool("Polygonraum");
      await click({ x: 1, y: 2 });
      await click({ x: 6, y: 2 });
      const vertex = await at({ x: 6, y: 5 });
      const handle = await at(handles[index]);
      await page.keyboard.down("Shift");
      await page.mouse.move(vertex.x, vertex.y);
      await page.mouse.down();
      await page.mouse.move(handle.x, handle.y, { steps: 8 });
      assert.equal((await editorState()).draft.length, 2);
      await page.screenshot({ path: path.join(out, `held-handle-${index + 1}.png`) });
      await page.mouse.up();
      await page.keyboard.up("Shift");
      await click({ x: 1, y: 5 });
      await double({ x: 1, y: 5 });
      await count(1);
      const contour = (await buildings())[0].polygons[0].outer;
      contours.push(contour);
      assert.equal(contour.length, 20);
      await page.locator(".dn-canvas canvas").focus();
      await page.keyboard.press("Control+z");
      await count(0);
    }
    assert.deepEqual(contours[1], contours[0]);
    assert.deepEqual(contours[2], contours[0]);
    fs.writeFileSync(path.join(out, "held-contours.json"), JSON.stringify(contours, null, 2));
    checks.push("Three held Shift handles captured before release; each commits the same 20-point contour");
  }
  async function snap() {
    await open("Snap");
    await chooseTool("Raum");
    const button = page.getByRole("button", { name: "Snap", exact: true });
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    const pressSaveKey = async () => {
      await page.locator(".dn-canvas canvas").focus();
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), "CANVAS");
      await page.keyboard.down("Control");
      await page.keyboard.press("s", { delay: 80 });
      await page.keyboard.up("Control");
      await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor?.saving === false);
    };
    await pressSaveKey();
    assert.equal((await editorState()).snap, false);
    assert.equal(await button.getAttribute("aria-pressed"), "false");
    await drag({ x: 1.25, y: 1.25 }, { x: 3.75, y: 3.75 });
    await count(1);
    const outer = (await buildings())[0].polygons[0].outer;
    assert.ok(outer.some((point) => Math.abs(point.x - Math.round(point.x)) > 0.1));
    await pressSaveKey();
    assert.equal((await editorState()).snap, true);
    await save("Snap");
    assert.equal((await editorState()).snap, true);
    fs.writeFileSync(path.join(out, "snap-contour.json"), JSON.stringify(outer, null, 2));
    checks.push("Ctrl+S toggles Snap both ways; toolbar Save preserves it; off stores free coordinates");
  }
  async function room() {
    await open("Room");
    await chooseTool("Raum");
    await drag({ x: 2, y: 2 }, { x: 6, y: 6 });
    await count(1);
    const building = (await buildings())[0];
    await page.evaluate(async (id) => {
      await app.workspace.activeLeaf.view.editor.select(id);
    }, building.id);
    await page.getByRole("button", { name: "Raum anlegen", exact: true }).click();
    const room = (await buildings())[0];
    assert.equal(room.id, building.id);
    assert.ok(room.number && room.note?.path);
    await save("Room");
    const originalKey = keyBytes(room.note.path);
    let keyBaseline = originalKey;
    const assertRoom = async (holes, expectedDoor) => {
      const state = await editorState();
      const current = state.document.entities.find((entity) => entity.id === room.id);
      assert.equal(current?.number, room.number);
      assert.equal(current?.note?.path, room.note.path);
      assert.equal(current?.polygons[0]?.holes.length, holes);
      assert.ok(current.wallWidth > 0);
      assert.equal(state.document.entities.filter((entity) =>
        entity.kind === "door" && entity.anchor?.boundaryId === room.id).length, expectedDoor);
      assert.deepEqual(keyBytes(room.note.path), keyBaseline);
      return current;
    };
    await assertRoom(0, 0);
    await drag({ x: 5, y: 3 }, { x: 7, y: 5 });
    await page.waitForFunction((id) => {
      const editor = app.workspace.activeLeaf?.view?.editor;
      return !editor?.paintWorker && editor?.session.document().entities
        .find((entity) => entity.id === id)?.polygons[0].outer
        .some((point) => point.x === 7);
    }, room.id);
    await assertRoom(0, 0);
    await drag({ x: 3, y: 4 }, { x: 4, y: 5 }, "Alt");
    await page.waitForFunction((id) => {
      const editor = app.workspace.activeLeaf?.view?.editor;
      return !editor?.paintWorker && editor?.session.document().entities
        .find((entity) => entity.id === id)?.polygons[0].holes.length === 1;
    }, room.id);
    const withHole = await assertRoom(1, 0);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await page.waitForFunction((id) => app.workspace.activeLeaf?.view?.editor
      ?.session.document().entities.find((entity) => entity.id === id)
      ?.polygons[0].holes.length === 0, room.id);
    await assertRoom(0, 0);
    await page.keyboard.press("Control+y");
    await page.waitForFunction((id) => app.workspace.activeLeaf?.view?.editor
      ?.session.document().entities.find((entity) => entity.id === id)
      ?.polygons[0].holes.length === 1, room.id);
    assert.deepEqual(await assertRoom(1, 0), withHole);
    await save("Room");
    await chooseTool("Tür");
    await click({ x: 4, y: 2 });
    await page.waitForFunction((id) => app.workspace.activeLeaf?.view?.editor
      ?.session.document().entities.some((entity) =>
        entity.kind === "door" && entity.anchor?.boundaryId === id), room.id);
    await save("Room");
    keyBaseline = keyBytes(room.note.path);
    assert.ok(keyBaseline.length > originalKey.length);
    await assertRoom(1, 1);
    await chooseTool("Raum");
    await drag({ x: 3.5, y: 1.5 }, { x: 4.5, y: 3 }, "Alt");
    await page.waitForFunction((id) => {
      const editor = app.workspace.activeLeaf?.view?.editor;
      return !editor?.paintWorker && editor.session.document().entities
        .find((entity) => entity.id === id)?.polygons[0].outer.length > 8;
    }, room.id);
    await assertRoom(1, 1);
    await drag({ x: 3, y: 1.5 }, { x: 5, y: 3 }, "Alt");
    await page.waitForFunction(() => {
      const editor = app.workspace.activeLeaf?.view?.editor;
      return !editor?.paintWorker && !editor.session.document().entities
        .some((entity) => entity.kind === "door");
    });
    await assertRoom(1, 0);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor
      ?.session.document().entities.some((entity) => entity.kind === "door"));
    await assertRoom(1, 1);
    await page.keyboard.press("Control+y");
    await page.waitForFunction(() => !app.workspace.activeLeaf?.view?.editor
      ?.session.document().entities.some((entity) => entity.kind === "door"));
    await assertRoom(1, 0);
    await save("Room");
    assert.deepEqual(keyBytes(room.note.path), keyBaseline);
    const saved = await editorState();
    assert.equal(saved.dirty, false);
    fs.writeFileSync(savedPath, JSON.stringify({ document: saved.document,
      roomId: room.id, roomNumber: room.number, keyPath: room.note.path,
      initialKeySha256: digest(originalKey), keySha256: digest(keyBaseline) }, null, 2));
    await page.screenshot({ path: path.join(out, "room-final.png") });
    checks.push("Numbered room retains ID and exact key bytes through overlap, Alt hole, portal cuts, history and save");
  }
  async function edit() {
    if (process.env.DUNGEON_PHASE1_REPAIR_ONLY === "snap") return snap();
    await preview();
    await snap();
    await room();
  }
  async function reopen() {
    const saved = JSON.parse(fs.readFileSync(savedPath, "utf8"));
    await open("Room");
    const state = await editorState();
    assert.deepEqual(state.document.entities, saved.document.entities);
    assert.equal(state.dirty, false);
    assert.equal(digest(keyBytes(saved.keyPath)), saved.keySha256);
    assert.equal(state.document.entities.find((entity) => entity.id === saved.roomId)?.number,
      saved.roomNumber);
    await page.screenshot({ path: path.join(out, "room-reopen.png") });
    await open("Snap");
    assert.ok((await buildings())[0].polygons[0].outer.some((point) =>
      Math.abs(point.x - Math.round(point.x)) > 0.1));
    checks.push("Fresh process restores numbered room, key bytes and fractional Snap-off contour");
  }
  return { edit, reopen };
};
