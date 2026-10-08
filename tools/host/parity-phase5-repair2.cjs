const PCK = "/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64/Dungeondraft.pck";
const PACK = "/home/aaron/.cache/dungeon-native-qa/audit-20261004/objekte-bearbeitung/native-dd028/assets/own-object-color.dungeondraft_pack";
const PCK_SHA = "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60";
const PACK_SHA = "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088";
const MAP = "Dungeons/Parity/Object-Repair2.dungeon";
const PALETTE_A = "Dungeons/Parity/Palette-A.dungeon";
const PALETTE_B = "Dungeons/Parity/Palette-B.dungeon";

module.exports = ({ page, fs, path, assert, crypto, vault, out, checks,
  chooseTool, waitForFileAbsent }) => {
  const state = () => page.evaluate(() => {
    const e = app.workspace.activeLeaf.view.editor;
    return { objects: e.session.document().entities.filter((v) => v.kind === "object"),
      order: [...e.session.entities.keys()], history: e.session.historySize,
      defaults: e.settings.object, scale: e.settings.objectScale,
      palette: e.session.settings.objectPalette, dirty: e.session.dirty };
  });
  const screen = (x, y) => page.evaluate(({ x, y }) => {
    const r = app.workspace.activeLeaf.view.editor.renderer;
    const box = r.canvas.getBoundingClientRect();
    return { x: box.x + r.camera.x + x * r.camera.scale,
      y: box.y + r.camera.y + y * r.camera.scale };
  }, { x, y });
  const place = async (x, y, previewLabel) => {
    const p = await screen(x, y);
    await page.mouse.move(p.x, p.y);
    if (previewLabel) {
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(out, previewLabel + ".png") });
    }
    await page.mouse.click(p.x, p.y);
  };
  const verify = (file, expected) => assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    expected, `Fixture hash mismatch: ${file}`);
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  };
  const numeric = async (label, value) => {
    const input = page.getByRole("spinbutton", { name: label, exact: true });
    await input.fill(String(value));
    await input.press("Tab");
  };
  const picker = () => page.getByRole("button", { name: "Objektfarbe RGBA öffnen" });
  const hex = () => page.getByRole("textbox", { name: "Hex ARGB" });
  const setHex = async (argb) => {
    await hex().fill(argb);
    await hex().press("Tab");
  };
  const accept = async () =>
    page.getByRole("button", { name: "Accept", exact: true }).click();
  const saveState = async (label) => {
    const current = await state();
    fs.writeFileSync(path.join(out, label + ".json"), JSON.stringify(current, null, 2));
    await page.screenshot({ path: path.join(out, label + ".png") });
    return current;
  };
  async function edit() {
    verify(PCK, PCK_SHA);
    verify(PACK, PACK_SHA);
    await page.evaluate(async (pck) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pck), PCK);
    await page.evaluate(async (encoded) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
      await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
    }, fs.readFileSync(PACK).toString("base64"));
    await page.evaluate(async (name) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase5-repair2",
        settings: { name: "Object Repair 2", width: 8, height: 8,
          feetPerField: 5, assetPacks: ["QAObjASl"], builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, MAP);
    await open();
    const zero = await state();
    assert.equal(zero.objects.length, 0);
    assert.equal(zero.palette, undefined);
    assert.equal(zero.defaults.layer, 100);
    const rotationSlider = page.getByRole("slider", { name: "Rotation-Regler" });
    const rotationBox = await rotationSlider.boundingBox();
    assert(rotationBox);
    await page.mouse.move(rotationBox.x + rotationBox.width / 2,
      rotationBox.y + rotationBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(rotationBox.x + rotationBox.width * .75,
      rotationBox.y + rotationBox.height / 2, { steps: 5 });
    let live = await state();
    assert.notEqual(live.defaults.rotation, 0);
    assert.notEqual(await page.getByRole("spinbutton", { name: "Rotation", exact: true }).inputValue(), "0");
    assert.equal(live.history, zero.history);
    await saveState("rotation-held");
    await page.mouse.up();
    await numeric("Rotation", 0);
    const scaleSlider = page.getByRole("slider", { name: "Scale-Regler" });
    const scaleBox = await scaleSlider.boundingBox();
    assert(scaleBox);
    await page.mouse.move(scaleBox.x + scaleBox.width * .2,
      scaleBox.y + scaleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(scaleBox.x + scaleBox.width * .65,
      scaleBox.y + scaleBox.height / 2, { steps: 5 });
    live = await state();
    assert.notEqual(live.scale, 1);
    assert.notEqual(await page.getByRole("spinbutton", { name: "Scale", exact: true }).inputValue(), "1");
    assert.equal(live.history, zero.history);
    await saveState("scale-held");
    await page.mouse.up();
    await numeric("Scale", 1);
    checks.push("Rotation and Scale update next-object defaults while the pointer is held");

    const initialHistory = (await state()).history;
    await page.getByRole("button", { name: "Atlas Globe 01", exact: true }).click();
    await place(4, 4, "atlas-step1-preview");
    const first = await saveState("atlas-step1");
    assert.equal(first.objects.length, 1);
    assert.equal(first.history, initialHistory + 1);
    assert.deepEqual([first.objects[0].x, first.objects[0].y], [4, 4]);
    assert.equal(first.objects[0].layer, 100);
    await page.getByRole("combobox", { name: "Layer" }).selectOption("400");
    await numeric("Rotation", 45);
    await numeric("Scale", 1.99);
    await page.getByRole("checkbox", { name: "Shadow" }).uncheck();
    await page.getByRole("checkbox", { name: "Block Light" }).check();
    await place(5.5, 4, "atlas-step2-preview");
    const second = await saveState("atlas-step2");
    assert.equal(second.objects.length, 2);
    assert.equal(second.history, initialHistory + 2);
    assert.deepEqual(second.objects.find((v) => v.id === first.objects[0].id), first.objects[0]);
    const transformed = second.objects.find((v) => v.id !== first.objects[0].id);
    assert(transformed);
    assert.deepEqual([transformed.x, transformed.y, transformed.layer,
      transformed.rotation, transformed.shadow, transformed.blocksLight],
      [5.5, 4, 400, Math.PI / 4, false, true]);
    await page.getByRole("button", { name: "Atlas Globe 02", exact: true }).click();
    await page.getByRole("combobox", { name: "Layer" }).selectOption("200");
    await numeric("Rotation", -30);
    await numeric("Scale", .75);
    await page.getByRole("checkbox", { name: "Shadow" }).check();
    await page.getByRole("checkbox", { name: "Block Light" }).uncheck();
    await place(2.5, 5.5, "atlas-step3-preview");
    const third = await saveState("atlas-step3");
    assert.equal(third.objects.length, 3);
    assert.equal(third.history, initialHistory + 3);
    for (const old of second.objects)
      assert.deepEqual(third.objects.find((v) => v.id === old.id), old);
    const thirdAdded = third.objects.find((v) => !second.objects.some((old) => old.id === v.id));
    assert(thirdAdded);
    assert.match(thirdAdded.assetId, /atlas_globe_02/i);
    assert.deepEqual([thirdAdded.x, thirdAdded.y,
      thirdAdded.layer, thirdAdded.rotation],
      [2.5, 5.5, 200, -Math.PI / 6]);
    await page.getByRole("button", { name: "Atlas Globe 01", exact: true }).click();
    await page.getByRole("combobox", { name: "Layer" }).selectOption("100");
    await numeric("Rotation", 0);
    await numeric("Scale", 1);
    await place(5.5, 5.5, "atlas-step4-preview");
    const fourth = await saveState("atlas-step4");
    assert.equal(fourth.objects.length, 4);
    assert.equal(fourth.history, initialHistory + 4);
    for (const old of third.objects)
      assert.deepEqual(fourth.objects.find((v) => v.id === old.id), old);
    const fourthAdded = fourth.objects.find((v) => !third.objects.some((old) => old.id === v.id));
    assert(fourthAdded);
    assert.deepEqual([fourthAdded.x, fourthAdded.y,
      fourthAdded.layer, fourthAdded.rotation], [5.5, 5.5, 100, 0]);
    assert.equal(fourthAdded.assetId, first.objects[0].assetId);
    for (let count = 3; count >= 0; count--) {
      await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
      const s = await saveState("atlas-undo" + (4 - count));
      assert.equal(s.objects.length, count);
    }
    for (let count = 1; count <= 4; count++) {
      await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
      const s = await saveState("atlas-redo" + count);
      assert.equal(s.objects.length, count);
    }
    assert.deepEqual((await state()).objects, fourth.objects);
    checks.push("Four Atlas placements, asset changes, exact options, and four-step Undo/Redo");

    await page.getByRole("button", { name: "QA Object Color", exact: true }).click();
    const colorSteps = [];
    const colored = async (label, expected, x, y) => {
      const prior = (await state()).objects;
      assert.equal((await state()).defaults.color,
        Number.parseInt(expected.slice(2), 16));
      await place(x, y, label + "-preview");
      const current = await saveState(label);
      const added = current.objects.find((v) => !prior.some((old) => old.id === v.id));
      assert(added);
      for (const old of prior)
        assert.deepEqual(current.objects.find((v) => v.id === old.id), old);
      assert.match(added.assetId, /^pack:QAObjASl:object:/);
      assert.equal(added.color, Number.parseInt(expected.slice(2), 16));
      assert.equal(added.alpha, Number.parseInt(expected.slice(0, 2), 16));
      colorSteps.push({ label, expected, object: added });
    };
    await picker().click();
    await setHex("ff6b3834");
    await numeric("R", 64);
    assert.equal(await hex().inputValue(), "403834");
    await accept();
    await colored("color-R64", "ff403834", 2.5, 2);
    await picker().click();
    await numeric("G", 128);
    assert.equal(await hex().inputValue(), "408034");
    await accept();
    await colored("color-G128", "ff408034", 4, 2);
    await picker().click();
    await numeric("B", 192);
    assert.equal(await hex().inputValue(), "4080c0");
    await accept();
    await colored("color-B192", "ff4080c0", 5.5, 2);
    const colorBeforeGestures = (await state()).objects.slice();
    await picker().click();
    await setHex("ff4080c0");
    const field = page.locator(".dn-object-rgba-field");
    const fieldBox = await field.boundingBox();
    assert(fieldBox);
    let fieldOffset;
    for (const dy of [-2, -1, 0, 1, 2]) {
      for (const dx of [-2, -1, 0, 1, 2]) {
        await setHex("ff4080c0");
        await field.click({ position: {
          x: fieldBox.width * .59375 + dx,
          y: fieldBox.height * .25 + dy,
        } });
        if (await hex().inputValue() === "4e87bf") {
          fieldOffset = { dx, dy };
          break;
        }
      }
      if (fieldOffset) break;
    }
    assert(fieldOffset, "Host field did not reach the directly observed native 4e87bf");
    await saveState("color-field-picker");
    await accept();
    await colored("color-field-object", "ff4e87bf", 2.5, 5.5);
    await picker().click();
    await setHex("ff4e86bf");
    const hue = page.locator(".dn-object-rgba-picker input[aria-label='Objektfarbe Farbton']");
    const hueBox = await hue.boundingBox();
    assert(hueBox);
    let hueOffset;
    for (const dy of [-1, -0.5, -0.25, 0, 0.1, 0.125, 0.15,
      0.2, 0.25, 0.3, 0.5, 1]) {
      await setHex("ff4e86bf");
      await hue.click({ position: {
        x: hueBox.width / 2, y: hueBox.height * .359375 + dy,
      } });
      if (await hex().inputValue() === "4ebf60") {
        hueOffset = dy;
        break;
      }
    }
    assert.notEqual(hueOffset, undefined,
      "Host hue did not reach the directly observed native 4ebf60");
    await saveState("color-hue-picker");
    await accept();
    await colored("color-hue-object", "ff4ebf60", 4, 5.5);
    for (const old of colorBeforeGestures)
      assert.deepEqual((await state()).objects.find((v) => v.id === old.id), old);
    fs.writeFileSync(path.join(out, "color-gesture-calibration.json"),
      JSON.stringify({ fieldOffset, hueOffset, fieldBox, hueBox, colorSteps }, null, 2));
    checks.push("Native R/G/B, field and hue picker values transfer exactly to new Colorable objects");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP)));
    assert.deepEqual(saved.entities.filter((v) => v.kind === "object"), (await state()).objects);
    await saveState("final-edit");

    await page.evaluate(async ([a, b]) => {
      for (const [name, packs] of [[a, ["QAObjASl"]], [b, []]])
        await app.vault.create(name, JSON.stringify({
          format: "dungeon-map", version: 3, id: name,
          settings: { name, width: 8, height: 8, feetPerField: 5,
            assetPacks: packs, builtInAssets: true, wallShadows: true,
            objectShadows: true, buildingWear: 0 },
          floors: [{ id: "floor-1", name: "Ground", elevation: 0, ambient: 1 }],
          entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
        }, null, 2));
    }, [PALETTE_A, PALETTE_B]);
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), PALETTE_A);
    await chooseTool("Möbel");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    assert.equal(await page.locator(".dn-object-palette button").count(), 31);
    await page.getByRole("button", { name: "Objektfarbe zur Palette hinzufügen" }).click();
    await setHex("8012ab34");
    await accept();
    assert.deepEqual((await state()).palette.slice(-1), ["8012ab34"]);
    await page.getByRole("button", { name: "Objektfarbe #8012ab34" }).click();
    await page.getByRole("button", { name: "QA Object Color", exact: true }).click();
    await place(4, 4);
    const aState = await saveState("palette-A-object");
    assert.equal(aState.objects.length, 1);
    assert.equal(aState.objects[0].color, 0x12ab34);
    assert.equal(aState.objects[0].alpha, 128);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await waitForFileAbsent(path.join(vault, PALETTE_A + ".draft"));
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), PALETTE_B);
    await chooseTool("Möbel");
    assert.equal((await state()).palette, undefined);
    assert.equal(await page.locator(".dn-object-palette button").count(), 31);
    await saveState("palette-B-empty");
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), PALETTE_A);
    await chooseTool("Möbel");
    const aAgain = await saveState("palette-A-return");
    assert.deepEqual(aAgain.palette.slice(-1), ["8012ab34"]);
    assert.deepEqual(aAgain.objects, aState.objects);
    checks.push("A→B→A keeps the new swatch and tinted Colorable object map-local");
  }
  async function reopen() {
    await open();
    const current = await state();
    const saved = JSON.parse(fs.readFileSync(path.join(vault, MAP)));
    assert.deepEqual(current.objects, saved.entities.filter((v) => v.kind === "object"));
    assert.equal(current.objects.length, 9);
    assert.equal(current.dirty, false);
    await saveState("final-reopen");
    checks.push("Fresh process reopens all four Atlas and five Colorable objects unchanged");
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), PALETTE_A);
    await chooseTool("Möbel");
    const a = await saveState("palette-A-fresh-reopen");
    const savedA = JSON.parse(fs.readFileSync(path.join(vault, PALETTE_A)));
    assert.deepEqual(a.palette, savedA.settings.objectPalette);
    assert.deepEqual(a.objects, savedA.entities.filter((v) => v.kind === "object"));
    assert.deepEqual(a.palette.slice(-1), ["8012ab34"]);
    assert.equal(a.objects[0].color, 0x12ab34);
    assert.equal(a.objects[0].alpha, 128);
    checks.push("Fresh process reopens palette A with the same ARGB swatch and object");
  }
  return { edit, reopen };
};
