const MAP = "Dungeons/Parity/Room-Boundary.dungeon";
const TEXT = "Wortlaut für den Raumgrenzzug.";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    const document = editor.session.document();
    return { document, selection: [...editor.selection],
      history: editor.session.historySize, dirty: editor.session.dirty,
      camera: { x: editor.renderer.camera.x, y: editor.renderer.camera.y,
        scale: editor.renderer.camera.scale } };
  });
  const screen = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const rect = renderer.canvas.getBoundingClientRect();
    return { x: rect.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: rect.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const drag = async (from, to) => {
    const start = await screen(from), end = await screen(to);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
  };
  const object = (current) => current.document.entities.find((e) => e.id === "object-1");
  const locked = (current) => current.document.entities.find((e) => e.id === "locked-1");
  const room = (current, id) => current.document.entities.find((e) => e.id === id);
  const occurrence = (current) => current.document.content.occurrences[0];
  const snapshot = async (name) => {
    fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(await state(), null, 2));
    await page.screenshot({ path: path.join(out, name + ".png") });
  };
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Auswahl");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  };
  async function edit() {
    await page.evaluate(async ({ name, text }) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      const building = (id, number, left) => ({
        id, kind: "building", floorId: "floor-1", layer: 200,
        polygons: [{ outer: [{ x: left, y: 1 }, { x: left + 3, y: 1 },
          { x: left + 3, y: 6 }, { x: left, y: 6 }], holes: [] }],
        number, name: "Raum " + number,
        key: { sections: id === "room-1" ? [{ id: "section-1", kind: "markdown",
          markdown: `## A · Zeichen:\n<!-- dungeon-feature:occurrence-1:start -->\n${text}\n<!-- dungeon-feature:occurrence-1:end -->` }] : [],
          nextFeatureOrdinal: id === "room-1" ? 2 : 1 },
        fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
      });
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 4, id: "parity-phase6-room-boundary",
        settings: { name: "Room Boundary", width: 12, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [building("room-1", "1", 1), building("room-2", "2", 7),
          { id: "object-1", kind: "object", floorId: "floor-1", roomId: "room-1",
            x: 2, y: 3, rotation: 0, width: 1.2, height: 1.2,
            color: 0x6688aa, label: "", layer: 100, flip: false },
          { id: "locked-1", kind: "object", floorId: "floor-1",
            x: 5.5, y: 6.5, rotation: 0, width: 1.2, height: 1.2,
            color: 0xaa8866, label: "", layer: 100, flip: false, locked: true }],
        content: { definitions: [{ id: "definition-1", name: "Zeichen", kind: "feature",
          xp: 0, lootValue: 0 }],
          occurrences: [{ id: "occurrence-1", definitionId: "definition-1",
            roomId: "room-1", entityId: "object-1", marker: "A", quantity: 1,
            sectionId: "section-1" }], routes: [], archive: [] },
      }, null, 2));
    }, { name: MAP, text: TEXT });
    await open();
    const initial = await state();
    assert.equal(initial.history, 0);
    assert.equal(object(initial).roomId, "room-1");
    await snapshot("room-boundary-initial");
    await drag({ x: 2, y: 3 }, { x: 8, y: 3 });
    const inSecond = await state();
    assert.equal(object(inSecond).roomId, "room-2");
    assert.equal(object(inSecond).x, 8);
    assert.equal(occurrence(inSecond).roomId, "room-2");
    assert.equal(occurrence(inSecond).sectionId, "section-1");
    assert.equal(inSecond.history, initial.history + 1);
    assert.deepEqual(inSecond.selection, ["object-1"]);
    assert.equal(room(inSecond, "room-1").key.sections.length, 0);
    assert(room(inSecond, "room-2").key.sections[0].markdown.includes(TEXT));
    await snapshot("room-boundary-to-second");
    await drag({ x: 8, y: 3 }, { x: 2, y: 3 });
    const returned = await state();
    assert.equal(object(returned).roomId, "room-1");
    assert.equal(object(returned).x, 2);
    assert.equal(occurrence(returned).roomId, "room-1");
    assert.equal(occurrence(returned).sectionId, "section-1");
    assert.equal(returned.history, inSecond.history + 1);
    assert(room(returned, "room-1").key.sections[0].markdown.includes(TEXT));
    assert.equal(room(returned, "room-2").key.sections.length, 0);
    await snapshot("room-boundary-returned");
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state()).document, inSecond.document);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.deepEqual((await state()).document, returned.document);
    checks.push("Room-boundary drags and Undo/Redo keep object, feature and key section together");
    const lockedPos = await screen({ x: 5.5, y: 6.5 });
    await page.mouse.click(lockedPos.x, lockedPos.y);
    assert.deepEqual((await state()).selection, []);
    await page.keyboard.down("Alt");
    await page.mouse.click(lockedPos.x, lockedPos.y);
    await page.keyboard.up("Alt");
    assert.deepEqual((await state()).selection, ["locked-1"]);
    const beforeUnlock = await state();
    await page.getByRole("button", { name: "Entsperren", exact: true }).click();
    const unlocked = await state();
    assert.equal(locked(unlocked).locked, false);
    assert.equal(unlocked.history, beforeUnlock.history);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    const afterUndo = await state();
    assert.equal(object(afterUndo).roomId, "room-2");
    assert.equal(locked(afterUndo).locked, false);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.deepEqual((await state()).document, unlocked.document);
    await snapshot("locked-object-unlocked");
    checks.push("Normal click excludes locked furniture; Alt selects it and Unlock persists outside Undo history");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => {
      const editor = app.workspace.activeLeaf.view.editor;
      return !editor.saving && !editor.session.dirty;
    });
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(saved, unlocked.document);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(vault, MAP))).digest("hex");
    fs.writeFileSync(path.join(out, "room-boundary-saved.json"), JSON.stringify({ hash, saved }, null, 2));
    checks.push("Room-boundary map persists returned object and unchanged feature text");
  }
  async function reopen() {
    await open();
    const current = await state();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(current.document, saved);
    assert.equal(object(current).roomId, "room-1");
    assert.equal(occurrence(current).roomId, "room-1");
    assert.equal(locked(current).locked, false);
    assert(room(current, "room-1").key.sections[0].markdown.includes(TEXT));
    assert.deepEqual(current.selection, []);
    await snapshot("room-boundary-reopened");
    checks.push("Fresh Obsidian process opens the returned room-boundary map unchanged");
  }
  return { edit, reopen };
};
