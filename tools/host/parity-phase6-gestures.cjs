const MAP = "Dungeons/Parity/Object-Gestures.dungeon";
const GRIP_MAP = "Dungeons/Parity/Selection-Grips.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    const { x, y, scale } = editor.renderer.camera;
    return { objects: editor.session.document().entities.filter((e) => e.kind === "object"),
      lights: editor.session.document().entities.filter((e) => e.kind === "light"),
      selection: [...editor.selection], history: editor.session.historySize,
      dirty: editor.session.dirty, rotation: editor.settings.object.rotation,
      scale: editor.settings.objectScale, assetId: editor.settings.object.assetId,
      mirrorHeld: editor.objectMirrorHeld, camera: { x, y, scale } };
  });
  const screen = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer;
    const rect = renderer.canvas.getBoundingClientRect();
    return { x: rect.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: rect.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const at = async (point) => {
    const pos = await screen(point);
    await page.mouse.move(pos.x, pos.y);
    return pos;
  };
  const place = async (point) => {
    const pos = await at(point);
    await page.mouse.click(pos.x, pos.y);
    return (await state()).objects.at(-1);
  };
  const wheel = async (point, deltaY, modifier) => {
    await at(point);
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.wheel(0, deltaY);
    if (modifier) await page.keyboard.up(modifier);
  };
  const drag = async (from, to) => {
    const start = await screen(from), end = await screen(to);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
  };
  const snapshot = async (name) => {
    fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(await state(), null, 2));
    await page.screenshot({ path: path.join(out, name + ".png") });
  };
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  };
  async function edit() {
    const pck = fixtures.verifyPck();
    await page.evaluate(async (pck) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pck), pck);
    await page.evaluate(async (name) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase6-object-gestures",
        settings: { name: "Object Gestures", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [
          { id: "light-1", kind: "light", floorId: "floor-1", x: 6, y: 6,
            radius: 1, intensity: 1, color: 0xffffff, shadows: false },
          { id: "locked-1", kind: "object", floorId: "floor-1", x: 2, y: 6,
            rotation: 0, width: 0.6, height: 0.6, color: 0x6688aa,
            label: "", layer: 100, flip: false, locked: true },
        ], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await open();
    const start = await state();
    assert.equal(start.rotation, 0);
    assert.equal(start.scale, 1);
    const native = await page.evaluate(() => {
      const editor = app.workspace.activeLeaf.view.editor;
      return app.plugins.getPlugin("dungeon-editor").listAssets([], true)
        .find((asset) => asset.id === editor.settings.object.assetId);
    });
    assert.match(native.name, /Atlas Globe 01/);
    const unchanged = async (before) => {
      const after = await state();
      assert.deepEqual(after.camera, before.camera);
      assert.equal(after.history, before.history);
      assert.equal(after.objects.length, before.objects.length);
    };
    await wheel({ x: 2, y: 2 }, -120);
    assert.equal(Math.round((await state()).rotation * 180 / Math.PI), 15);
    await unchanged(start);
    await snapshot("wheel-15-preview");
    const rotated = await place({ x: 2, y: 2 });
    assert.equal(Math.round(rotated.rotation * 180 / Math.PI), 15);
    await wheel({ x: 3, y: 2 }, 120);
    assert.equal(Math.round((await state()).rotation * 180 / Math.PI), 0);
    let before = await state();
    await wheel({ x: 3, y: 2 }, -120, "Alt");
    assert.equal((await state()).scale, 1.1);
    await unchanged(before);
    await snapshot("alt-wheel-1.1-preview");
    const scaled = await place({ x: 3, y: 2 });
    assert.equal(scaled.width, native.objectSizeFields.width * 1.1);
    assert.equal(scaled.height, native.objectSizeFields.height * 1.1);
    checks.push("One wheel tick rotates 15 degrees; Alt wheel scales 0.1 without moving camera or history");

    before = await state();
    await wheel({ x: 4, y: 2 }, 120, "Shift");
    const cycled = await state();
    assert.notEqual(cycled.assetId, before.assetId);
    await unchanged(before);
    const nextAsset = await page.evaluate((id) =>
      app.plugins.getPlugin("dungeon-editor").listAssets([], true)
        .find((asset) => asset.id === id), cycled.assetId);
    assert.match(nextAsset.name, /Atlas Globe 02/);
    const picked = await place({ x: 4, y: 2 });
    assert.equal(picked.assetId, cycled.assetId);
    checks.push("Shift wheel cycles the actual library tile and the next object uses that asset");

    const mirrorPos = await at({ x: 2, y: 3 });
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.down("a");
    assert.equal((await state()).mirrorHeld, true);
    await snapshot("mirror-held-preview");
    await page.mouse.click(mirrorPos.x, mirrorPos.y);
    await page.keyboard.up("a");
    assert.equal((await state()).mirrorHeld, false);
    await snapshot("mirror-released-preview");
    assert.equal((await state()).objects.at(-1).flip, true);
    const normal = await place({ x: 3, y: 3 });
    assert.equal(normal.flip, false);
    assert.equal((await state()).objects.at(-2).flip, true);
    checks.push("Held A mirrors exactly the clicked instance and release restores the next preview");

    before = await state();
    const right = await at({ x: 4, y: 3 });
    await page.mouse.click(right.x, right.y, { button: "right" });
    assert.equal(Math.round((await state()).rotation * 180 / Math.PI), 90);
    await unchanged(before);
    assert.equal(Math.round((await place({ x: 4, y: 3 })).rotation * 180 / Math.PI), 90);
    await at({ x: 5, y: 3 });
    await page.keyboard.down("Alt");
    await page.mouse.click((await screen({ x: 5, y: 3 })).x,
      (await screen({ x: 5, y: 3 })).y, { button: "right" });
    await page.keyboard.up("Alt");
    assert.equal(Math.round((await state()).rotation * 180 / Math.PI), 0);
    before = await state();
    await wheel({ x: 5, y: 3 }, -120, "z");
    assert.equal(Math.round((await state()).rotation * 180 / Math.PI), 5);
    await unchanged(before);
    assert.equal(Math.round((await place({ x: 5, y: 3 })).rotation * 180 / Math.PI), 5);
    checks.push("Right/Alt-right turns 90 degrees and held Z makes a five-degree wheel step");

    const search = page.getByRole("textbox", { name: "Objektbibliothek durchsuchen" });
    await page.locator('input[aria-label="Fuzzy/Exact"]').evaluate((slider) => {
      slider.value = "1";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await search.fill("Atlas Globe");
    await search.press("Enter");
    assert.equal(await page.locator(".dn-object-library-tile").count(), 3);
    assert.equal(await page.evaluate(() =>
      app.workspace.activeLeaf.view.editor.objectLibrary.state.selectedId), "");
    before = await state();
    await wheel({ x: 6, y: 4 }, 120, "Shift");
    assert.equal((await state()).assetId, before.assetId);
    await page.locator(".dn-object-library-tile").nth(1).click();
    const selectedForCycle = (await state()).assetId;
    await wheel({ x: 6, y: 4 }, 120, "Shift");
    const afterExact = await state();
    assert.notEqual(afterExact.assetId, selectedForCycle);
    assert.match(await page.locator('.dn-object-library-tile[aria-pressed="true"]')
      .getAttribute("aria-label"), /Atlas Globe Gigant 03/);
    before = await state();
    await at({ x: 6, y: 4 });
    await page.keyboard.down("Alt");
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, -120);
    await page.keyboard.up("Shift");
    await page.keyboard.up("Alt");
    assert.equal((await state()).scale, 1.2);
    assert.equal((await state()).assetId, before.assetId);
    await snapshot("exact-search-alt-shift");
    checks.push("Exact search cycles only its three tiles; empty selection is inert and Alt wins over Shift");

    const scaleInput = page.getByRole("spinbutton", { name: "Scale", exact: true });
    await scaleInput.fill("0.1");
    await scaleInput.press("Tab");
    await wheel({ x: 6, y: 4 }, 120, "Alt");
    assert.equal((await state()).scale, 0.1);
    await scaleInput.fill("4");
    await scaleInput.press("Tab");
    await wheel({ x: 6, y: 4 }, -120, "Alt");
    assert.equal((await state()).scale, 4);
    await scaleInput.fill("1.1");
    await scaleInput.press("Tab");
    checks.push("Alt wheel respects measured native scale bounds 0.1 and 4");

    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.down("a");
    assert.equal((await state()).mirrorHeld, true);
    await search.focus();
    await page.keyboard.up("a");
    assert.equal((await state()).mirrorHeld, false);
    await page.locator(".dn-canvas canvas").focus();
    checks.push("Object mirror key release clears the held state after focus changes");

    await chooseTool("Auswahl");
    let pos = await screen({ x: 2, y: 2 });
    await page.mouse.click(pos.x, pos.y);
    assert.deepEqual((await state()).selection, [rotated.id]);
    pos = await screen({ x: 6, y: 6 });
    await page.keyboard.down("Shift");
    await page.mouse.click(pos.x, pos.y);
    await page.keyboard.up("Shift");
    assert.deepEqual(new Set((await state()).selection), new Set([rotated.id, "light-1"]));
    const from = await screen({ x: 4, y: 4 }), to = await screen({ x: 5, y: 4 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    const moved = await state();
    assert.equal(moved.objects.find((o) => o.id === rotated.id).x, 3);
    assert.equal(moved.lights.find((l) => l.id === "light-1").x, 7);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.equal((await state()).objects.find((o) => o.id === rotated.id).x, 2);
    assert.equal((await state()).lights.find((l) => l.id === "light-1").x, 6);
    assert.deepEqual((await state()).selection, []);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.equal((await state()).objects.find((o) => o.id === rotated.id).x, 3);
    checks.push("Object and light move together in one history command; undo clears selection");

    pos = await screen({ x: 2, y: 6 });
    await page.mouse.click(pos.x, pos.y);
    assert.deepEqual((await state()).selection, []);
    await page.keyboard.down("Alt");
    await page.mouse.click(pos.x, pos.y);
    await page.keyboard.up("Alt");
    assert.deepEqual((await state()).selection, ["locked-1"]);
    checks.push("Locked object requires Alt for direct selection");

    pos = await screen({ x: 3, y: 3 });
    await page.mouse.click(pos.x, pos.y);
    assert.deepEqual((await state()).selection, [normal.id]);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("a");
    assert.equal((await state()).objects.find((o) => o.id === normal.id).flip, true);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.equal((await state()).objects.find((o) => o.id === normal.id).flip, false);
    assert.deepEqual((await state()).selection, []);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.equal((await state()).objects.find((o) => o.id === normal.id).flip, true);
    checks.push("Selection A mirrors a placed object; undo/redo restore geometry and clear selection");

    const marqueeStart = await screen({ x: 1.3, y: 1.3 });
    const marqueeEnd = await screen({ x: 4.5, y: 2.5 });
    await page.mouse.move(marqueeStart.x, marqueeStart.y);
    await page.mouse.down();
    await page.mouse.move(marqueeEnd.x, marqueeEnd.y, { steps: 10 });
    await page.mouse.up();
    const framed = new Set((await state()).selection);
    assert(framed.has(rotated.id));
    assert(framed.has(scaled.id));
    assert(framed.has(picked.id));
    assert(!framed.has(normal.id));
    assert(!framed.has("light-1"));
    checks.push("Marquee takes contained object anchors and excludes objects and light outside the box");

    pos = await screen({ x: 1, y: 1 });
    await page.mouse.click(pos.x, pos.y);
    pos = await screen({ x: 4, y: 2 });
    await page.mouse.click(pos.x, pos.y);
    assert.deepEqual((await state()).selection, [picked.id]);
    const objectFilter = page.locator('input[aria-label="Objektarten: Objekte"]');
    await objectFilter.evaluate((input) => {
      input.checked = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    assert.deepEqual((await state()).selection, [picked.id]);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("a");
    assert.equal((await state()).objects.find((o) => o.id === picked.id).flip, true);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.equal((await state()).objects.find((o) => o.id === picked.id).flip, false);
    assert.deepEqual((await state()).selection, []);
    await objectFilter.evaluate((input) => {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    checks.push("An existing object selection survives a filter change and mirrors with one undo step");

    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.equal(saved.entities.filter((e) => e.kind === "object").length, 8);
    fs.copyFileSync(path.join(vault, MAP), path.join(out, "saved-map.dungeon"));
    fs.writeFileSync(path.join(out, "object-gesture-state.json"), JSON.stringify(await state(), null, 2));
    await page.screenshot({ path: path.join(out, "object-gestures.png") });

    await page.evaluate(async (name) => { await app.vault.create(name, JSON.stringify({
      format: "dungeon-map", version: 3, id: "parity-phase6-selection-grips",
      settings: { name: "Selection Grips", width: 12, height: 8,
        feetPerField: 5, assetPacks: [], builtInAssets: true,
        wallShadows: false, objectShadows: false, buildingWear: 0 },
      floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
      entities: [{ id: "grip-object", kind: "object", floorId: "floor-1",
        x: 3, y: 3, rotation: 0, width: 2, height: 1.5,
        color: 0x6688aa, label: "", layer: 100, flip: false }],
      content: { definitions: [], occurrences: [], routes: [], archive: [] },
    }, null, 2)); }, GRIP_MAP);
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), GRIP_MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Auswahl");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    let grip = (await state()).objects[0];
    pos = await screen({ x: 3, y: 3 });
    await page.mouse.click(pos.x, pos.y);
    assert.deepEqual((await state()).selection, ["grip-object"]);
    await drag({ x: 3.9, y: 3.65 }, { x: 4.4, y: 4.15 });
    let transformed = (await state()).objects[0];
    assert(transformed.width > grip.width && transformed.height > grip.height);
    assert.equal(transformed.rotation, 0);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state()).objects[0], grip);
    assert.deepEqual((await state()).selection, []);
    pos = await screen({ x: 3, y: 3 });
    await page.mouse.click(pos.x, pos.y);
    await drag({ x: 4.2, y: 3.95 }, { x: 4.7, y: 4.45 });
    transformed = (await state()).objects[0];
    assert(transformed.width > grip.width && transformed.height > grip.height);
    assert.equal(transformed.width / grip.width, transformed.height / grip.height);
    await drag({ x: 6, y: 6 }, { x: 6, y: 7 });
    const rotatedGrip = (await state()).objects[0];
    assert.notEqual(rotatedGrip.rotation, 0);
    assert.equal(rotatedGrip.width, transformed.width);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, GRIP_MAP + ".draft"));
    fs.copyFileSync(path.join(vault, GRIP_MAP), path.join(out, "saved-selection-grips.dungeon"));
    await snapshot("selection-grips-rotated");
    checks.push("Object corner scale and outer rotation use separate undo steps and persist");
  }
  async function reopen() {
    await open();
    const current = await state();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(current.objects, saved.entities.filter((e) => e.kind === "object"));
    assert.deepEqual(current.lights, saved.entities.filter((e) => e.kind === "light"));
    assert.equal(current.objects.filter((o) => o.flip).length, 2);
    assert.equal(current.objects.find((o) => o.id === "locked-1").locked, true);
    assert.deepEqual(current.selection, []);
    await page.screenshot({ path: path.join(out, "object-gestures-reopen.png") });
    checks.push("Fresh process reloads gesture objects, mirror and joint movement unchanged");
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), GRIP_MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    const gripSaved = JSON.parse(fs.readFileSync(path.join(vault, GRIP_MAP), "utf8"));
    assert.deepEqual((await state()).objects, gripSaved.entities.filter((e) => e.kind === "object"));
    assert.notEqual((await state()).objects[0].rotation, 0);
    checks.push("Fresh process reloads the scaled and rotated object frame");
  }
  return { edit, reopen };
};
