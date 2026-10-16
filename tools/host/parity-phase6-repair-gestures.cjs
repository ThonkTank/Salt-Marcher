const MAP = "Dungeons/Parity/Gesture-Repair.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const fixtures = require("./phase5-fixtures.cjs")({ fs, crypto, assert });
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf.view.editor;
    const camera = editor.renderer.camera;
    return { objects: editor.session.document().entities.filter((e) => e.kind === "object"),
      rotation: editor.settings.object.rotation * 180 / Math.PI,
      scale: editor.settings.objectScale, assetId: editor.settings.object.assetId,
      selectedId: editor.objectLibrary.state.selectedId,
      history: editor.session.historySize, dirty: editor.session.dirty,
      camera: { x: camera.x, y: camera.y, scale: camera.scale } };
  });
  const degrees = (value) => Math.round(value.rotation);
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
  const wheel = async (point, deltaY, modifiers = []) => {
    await at(point);
    for (const key of modifiers) await page.keyboard.down(key);
    await page.mouse.wheel(0, deltaY);
    for (const key of [...modifiers].reverse()) await page.keyboard.up(key);
  };
  const right = async (point, alt = false) => {
    const pos = await at(point);
    if (alt) await page.keyboard.down("Alt");
    await page.mouse.click(pos.x, pos.y, { button: "right" });
    if (alt) await page.keyboard.up("Alt");
  };
  const place = async (point) => {
    const pos = await at(point);
    await page.mouse.click(pos.x, pos.y);
    return (await state()).objects.at(-1);
  };
  const snapshot = async (name) => {
    fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(await state(), null, 2));
    await page.screenshot({ path: path.join(out, name + ".png") });
  };
  const unchanged = async (before) => {
    const after = await state();
    assert.deepEqual(after.camera, before.camera);
    assert.equal(after.history, before.history);
    assert.equal(after.objects.length, before.objects.length);
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
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase6-gesture-repair",
        settings: { name: "Gesture Repair", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: false, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await open();
    const rotationInput = page.getByRole("spinbutton", { name: "Rotation", exact: true });
    const scaleInput = page.getByRole("spinbutton", { name: "Scale", exact: true });
    const setNumber = async (input, value) => {
      await input.fill(String(value));
      await input.press("Tab");
    };
    const initial = await state();
    assert.equal(degrees(initial), 0);
    assert.equal(initial.scale, 1);
    const atlas = await page.evaluate((id) =>
      app.plugins.getPlugin("dungeon-editor").listAssets([], true)
        .find((asset) => asset.id === id), initial.assetId);
    assert.match(atlas.name, /Atlas Globe 01/);
    await wheel({ x: 2, y: 2 }, 120);
    assert.equal(degrees(await state()), -15);
    await unchanged(initial);
    assert.equal(degrees({ rotation: (await place({ x: 2, y: 2 })).rotation * 180 / Math.PI }), -15);
    await snapshot("dd-026-22-wheel-down");
    await wheel({ x: 3, y: 2 }, -120);
    assert.equal(degrees(await state()), 0);
    await setNumber(rotationInput, 175);
    const beforeWrap = await state();
    await wheel({ x: 3, y: 2 }, -120);
    assert.equal(degrees(await state()), -170);
    await unchanged(beforeWrap);
    assert.equal(degrees({ rotation: (await place({ x: 3, y: 2 })).rotation * 180 / Math.PI }), -170);
    await snapshot("dd-026-22-wheel-wrap");
    checks.push("DD-026.22 down wheel and 175-degree wrap match saved native rotations");
    await setNumber(rotationInput, 0);
    await setNumber(scaleInput, 1);
    await wheel({ x: 4, y: 2 }, 120, ["Alt"]);
    assert.equal((await state()).scale, 0.9);
    let placed = await place({ x: 4, y: 2 });
    assert.equal(placed.width, atlas.objectSizeFields.width * 0.9);
    assert.equal(placed.height, atlas.objectSizeFields.height * 0.9);
    await setNumber(scaleInput, 0.1);
    await wheel({ x: 5, y: 2 }, 120, ["Alt"]);
    assert.equal((await state()).scale, 0.1);
    placed = await place({ x: 5, y: 2 });
    assert.equal(placed.width, atlas.objectSizeFields.width * 0.1);
    await setNumber(scaleInput, 4);
    await wheel({ x: 6, y: 2 }, -120, ["Alt"]);
    assert.equal((await state()).scale, 4);
    placed = await place({ x: 6, y: 2 });
    assert.equal(placed.width, atlas.objectSizeFields.width * 4);
    await snapshot("dd-026-23-scale-bounds");
    await setNumber(scaleInput, 1);
    const beforeAltShift = await state();
    await wheel({ x: 2, y: 3 }, -120, ["Alt", "Shift"]);
    assert.equal((await state()).scale, 1.1);
    assert.equal((await state()).assetId, beforeAltShift.assetId);
    placed = await place({ x: 2, y: 3 });
    assert.equal(placed.width, atlas.objectSizeFields.width * 1.1);
    await snapshot("dd-026-23-alt-shift");
    checks.push("DD-026.23 downward scaling, bounds and Alt+Shift precedence match native");
    await setNumber(rotationInput, 0);
    let before = await state();
    await right({ x: 3, y: 3 });
    assert.equal(degrees(await state()), 90);
    await unchanged(before);
    assert.equal(degrees({ rotation: (await place({ x: 3, y: 3 })).rotation * 180 / Math.PI }), 90);
    await right({ x: 4, y: 3 }, true);
    assert.equal(degrees(await state()), 0);
    assert.equal(degrees({ rotation: (await place({ x: 4, y: 3 })).rotation * 180 / Math.PI }), 0);
    before = await state();
    await right({ x: 5, y: 3 });
    await right({ x: 5, y: 3 });
    assert.equal(degrees(await state()), -180);
    await unchanged(before);
    assert.equal(degrees({ rotation: (await place({ x: 5, y: 3 })).rotation * 180 / Math.PI }), -180);
    await right({ x: 6, y: 3 });
    assert.equal(degrees(await state()), -90);
    assert.equal(degrees({ rotation: (await place({ x: 6, y: 3 })).rotation * 180 / Math.PI }), -90);
    await snapshot("dd-026-26-right-turns");
    checks.push("DD-026.26 right and Alt-right turns have no pre-placement history and wrap at 180");
    await setNumber(rotationInput, 90);
    await page.locator(".dn-canvas canvas").focus();
    await wheel({ x: 2, y: 4 }, -120, ["z"]);
    assert.equal(degrees(await state()), 95);
    assert.equal(degrees({ rotation: (await place({ x: 2, y: 4 })).rotation * 180 / Math.PI }), 95);
    await wheel({ x: 3, y: 4 }, -120);
    assert.equal(degrees(await state()), 110);
    assert.equal(degrees({ rotation: (await place({ x: 3, y: 4 })).rotation * 180 / Math.PI }), 110);
    await setNumber(rotationInput, 90);
    await page.locator(".dn-canvas canvas").focus();
    await wheel({ x: 4, y: 4 }, 120, ["z"]);
    assert.equal(degrees(await state()), 85);
    assert.equal(degrees({ rotation: (await place({ x: 4, y: 4 })).rotation * 180 / Math.PI }), 85);
    await snapshot("dd-026-27-z-both-directions");
    checks.push("DD-026.27 Z turns 90 to 95 or 85 degrees; release restores 15-degree steps");
    const search = page.getByRole("textbox", { name: "Objektbibliothek durchsuchen" });
    await page.locator('input[aria-label="Fuzzy/Exact"]').evaluate((slider) => {
      slider.value = "1";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await search.fill("Atlas Globe");
    await search.press("Enter");
    assert.equal(await page.locator(".dn-object-library-tile").count(), 3);
    assert.equal((await state()).selectedId, "");
    before = await state();
    await wheel({ x: 5, y: 4 }, 120, ["Shift"]);
    assert.equal((await state()).assetId, before.assetId);
    await page.locator(".dn-object-library-tile").nth(1).click();
    await wheel({ x: 5, y: 4 }, 120, ["Shift"]);
    let name = await page.locator('.dn-object-library-tile[aria-pressed="true"]')
      .getAttribute("aria-label");
    assert.match(name, /Atlas Globe Gigant 03/);
    await place({ x: 5, y: 4 });
    await wheel({ x: 6, y: 4 }, 120, ["Shift"]);
    name = await page.locator('.dn-object-library-tile[aria-pressed="true"]')
      .getAttribute("aria-label");
    assert.match(name, /Atlas Globe 01/);
    await place({ x: 6, y: 4 });
    await wheel({ x: 2, y: 5 }, -120, ["Shift"]);
    name = await page.locator('.dn-object-library-tile[aria-pressed="true"]')
      .getAttribute("aria-label");
    assert.match(name, /Atlas Globe Gigant 03/);
    await place({ x: 2, y: 5 });
    await snapshot("dd-026-24-exact-wrap");
    checks.push("DD-026.24 Exact search clears selection; three tiles cycle and wrap both ways");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(saved.entities.filter((e) => e.kind === "object"), (await state()).objects);
    fs.writeFileSync(path.join(out, "gesture-repair-saved.json"), JSON.stringify(saved, null, 2));
  }
  async function reopen() {
    await open();
    const current = await state();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP), "utf8"));
    assert.deepEqual(current.objects, saved.entities.filter((e) => e.kind === "object"));
    assert.equal(current.objects.length, 16);
    await snapshot("gesture-repair-reopened");
    checks.push("Fresh Obsidian process reloads all repair gesture objects unchanged");
  }
  return { edit, reopen };
};
