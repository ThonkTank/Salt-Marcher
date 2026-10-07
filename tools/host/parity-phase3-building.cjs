module.exports = ({ page, fs, path, assert, crypto, PNG, qa, out, checks,
  chooseTool }) => {
  const mapPath = "Dungeons/Parity/Building-Styles.dungeon";
  const savedState = path.join(qa, "parity-phase3-building-saved.json");
  const pckPath = "/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64/Dungeondraft.pck";
  const packPath = "/home/aaron/.cache/dungeon-native-qa/parity-phase3-implementation-20261007/native-package/runs/20261007-025609-1253642/assets/qa-wall-pack.dungeondraft_pack";
  const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
  const state = () => page.evaluate(() => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    return editor && {
      document: editor.session.document(),
      dirty: editor.session.dirty,
      history: editor.session.historySize,
      tool: editor.tool,
      selected: editor.selected,
      visuals: [...editor.renderer.visuals.entries()]
        .filter(([, visual]) => visual.entity.kind === "building")
        .map(([id, visual]) => ({ id, shadow: !!visual.shadow,
          wallSprites: visual.container.children
            .reduce((sum, child) => sum + (child.children?.length ?? 0), 0) })),
    };
  });
  const world = (point) => page.evaluate((point) => {
    const renderer = app.workspace.activeLeaf.view.editor.renderer,
      box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + point.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + point.y * renderer.camera.scale };
  }, point);
  const draw = async (a, b, expected) => {
    const first = await world(a), second = await world(b);
    fs.writeFileSync(path.join(out, "draw-" + expected + "-before.json"),
      JSON.stringify(await page.evaluate(({ first, second }) => {
        const editor = app.workspace.activeLeaf.view.editor,
          box = editor.renderer.canvas.getBoundingClientRect();
        return { first, second, box: box.toJSON(), camera: editor.renderer.camera,
          settings: editor.settings, floorMode: editor.settings.floorMode,
          tool: editor.tool, history: editor.session.historySize };
      }, { first, second }), null, 2));
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(second.x, second.y, { steps: 6 });
    await page.mouse.up();
    fs.writeFileSync(path.join(out, "draw-" + expected + "-after.json"),
      JSON.stringify(await page.evaluate(() => {
        const editor = app.workspace.activeLeaf.view.editor;
        return { gesture: editor.gesture, worker: !!editor.paintWorker,
          entities: editor.session.entities.size, dirty: editor.session.dirty,
          status: editor.status?.textContent };
      }), null, 2));
    await page.waitForFunction(expected =>
      app.workspace.activeLeaf?.view?.editor?.session?.entities?.size === expected,
    expected, { timeout: 45000 });
  };
  async function open() {
    await page.evaluate(async (mapPath) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(mapPath)),
    mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  }
  async function edit() {
    const pack = fs.readFileSync(packPath);
    assert.equal(hash(pack), "eaad533f4da8880bf8c0339d9d6ae66dd3d8e1c1d60917288ab0a91242d51ad9");
    assert.equal(hash(fs.readFileSync(pckPath)),
      "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60");
    await page.evaluate(async ({ mapPath, pckPath, pack }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.useNativeAssetArchive(pckPath);
      const bytes = Uint8Array.from(atob(pack), char => char.charCodeAt(0));
      await plugin.assets.add([new Blob([bytes])]);
      await plugin.reloadAssets();
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      const document = {
        format: "dungeon-map", version: 3, id: "parity-phase3-building",
        settings: { name: "Building Styles", width: 20, height: 12,
          feetPerField: 5, assetPacks: ["QAWall01"], builtInAssets: true,
          wallShadows: true, objectShadows: false, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
        entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
      };
      await app.vault.create(mapPath, JSON.stringify(document, null, 2));
    }, { mapPath, pckPath, pack: pack.toString("base64") });
    await open();
    await chooseTool("Raum");
    assert.equal(await page.getByRole("checkbox", { name: "Bevel Corners" }).isChecked(), true);
    assert.equal(await page.getByText("Paketwand für Räume").count(), 0);
    const catalog = await page.evaluate(() => {
      const plugin = app.plugins.getPlugin("dungeon-editor"),
        assets = plugin.listAssets(["QAWall01"], true);
      return { floors: assets.filter(item => item.kind === "tileset"),
        walls: assets.filter(item => item.kind === "wall") };
    });
    assert.equal(catalog.floors.filter(item => item.packId.startsWith("dungeondraft")).length, 24);
    assert.equal(catalog.walls.filter(item => item.packId.startsWith("dungeondraft")).length, 10);
    assert(catalog.walls.some(item => item.name === "QA Wall"));
    checks.push("24 original floors, 10 original walls and QAWall01 are loaded together");
    await page.getByRole("button", { name: "QA Wall", exact: true }).click();
    await page.getByRole("button", { name: "Bodenfarbe RGBA", exact: true }).click();
    await page.getByRole("textbox", { name: "Bodenfarbe Hex ARGB" }).fill("80ff0000");
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    const before = await state();
    assert.equal(before.document.entities.length, 0);
    assert.equal(before.history, 0);
    await draw({ x: 2, y: 2 }, { x: 4, y: 4 }, 1);
    const first = await state();
    assert.equal(first.document.entities.length, 1);
    const building = first.document.entities[0];
    assert.equal(building.fill, 0xff0000);
    assert.equal(building.floorAlpha, 128);
    assert.equal(building.wallAssetId, catalog.walls.find(item => item.name === "QA Wall").id);
    assert.equal(building.wallAlpha, 255);
    assert.equal(building.wallBevel, true);
    assert.equal(building.material.assetId, catalog.floors[0].id);
    await page.screenshot({ path: path.join(out, "qa-wall-first.png") });
    checks.push("The first Building stores ARGB floor tint and the selected QAWall01 path");
    await page.getByRole("button", { name: "Keine Wand", exact: true }).click();
    assert.deepEqual((await state()).document.entities[0], building);
    await draw({ x: 6, y: 2 }, { x: 8, y: 4 }, 2);
    const second = await state();
    assert.equal(second.document.entities.length, 2);
    assert.equal(second.document.entities[1].wallWidth, 0);
    assert.equal(second.visuals.find(item => item.id === second.document.entities[1].id)?.shadow, false);
    checks.push("Wall None affects only the next Building and omits its shadow");
    await page.getByRole("button", { name: "Smart Stone", exact: true }).click();
    await page.getByRole("button", { name: "Battlements", exact: true }).click();
    await page.getByRole("checkbox", { name: "Bevel Corners" }).uncheck();
    await page.getByRole("button", { name: "Wandfarbe RGBA", exact: true }).click();
    await page.getByRole("textbox", { name: "Wandfarbe Hex ARGB" }).fill("80ff00ff");
    await page.getByRole("dialog", { name: "Wandfarbe" }).press("Escape");
    await draw({ x: 10, y: 2 }, { x: 12, y: 4 }, 3);
    const third = await state();
    assert.equal(third.document.entities.length, 3);
    assert.equal(third.document.entities[2].material.assetId,
      catalog.floors.find(item => item.name === "Smart Stone").id);
    assert.equal(third.document.entities[2].fill, 0x7f7e71);
    assert.equal(third.document.entities[2].floorAlpha, 255);
    assert.equal(third.document.entities[2].wall, 0xff00ff);
    assert.equal(third.document.entities[2].wallAlpha, 128);
    assert.deepEqual(third.document.entities[0], building);
    checks.push("Style changes and Escape-retained wall color affect future Buildings only");
    await page.getByRole("checkbox", { name: "Bevel Corners" }).check();
    await draw({ x: 14, y: 2 }, { x: 16, y: 4 }, 4);
    const fourth = await state();
    assert.equal(fourth.document.entities[3].wallBevel, true);
    assert.equal(fourth.document.entities[2].wallBevel, false);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.equal((await state()).document.entities.length, 3);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.equal((await state()).document.entities.length, 4);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    const saved = await state();
    fs.writeFileSync(savedState, JSON.stringify(saved, null, 2));
    await page.screenshot({ path: path.join(out, "all-four.png") });
    checks.push("Bevel, undo, redo and save preserve four distinct Building options");
    await page.getByRole("button", { name: "Bodenfarbe RGBA", exact: true }).click();
    await page.getByRole("button", { name: "Pipette", exact: true }).click();
    const samplePoint = await world({ x: 3, y: 3 });
    const expectedSample = await page.evaluate((point) => {
      const renderer = app.workspace.activeLeaf.view.editor.renderer;
      return renderer.sampleRenderedPixel(renderer.local({
        clientX: point.x, clientY: point.y,
      }));
    }, samplePoint);
    assert(expectedSample);
    await page.mouse.click(samplePoint.x, samplePoint.y);
    const sampledHex = await page.getByRole("textbox", { name: "Bodenfarbe Hex ARGB" }).inputValue();
    const expectedHex = (expectedSample.alphaByte === 255 ? "" :
      expectedSample.alphaByte.toString(16).padStart(2, "0")) +
      expectedSample.color.toString(16).padStart(6, "0");
    assert.equal(sampledHex, expectedHex);
    await page.getByRole("dialog", { name: "Bodenfarbe" }).press("Escape");
    assert.deepEqual((await state()).document, saved.document);
    checks.push("The Building pipette samples the displayed map pixel and Escape retains the live tool color without editing existing Buildings");
    await page.getByRole("button", { name: "Bodenfarbe zurücksetzen", exact: true }).click();
    await page.getByRole("button", { name: "QA Wall", exact: true }).click();
    await page.getByRole("button", { name: "Wandfarbe zurücksetzen", exact: true }).click();
    const reset = await page.evaluate(() => app.workspace.activeLeaf.view.editor.settings);
    assert.equal(reset.surfaces.floor.color, 0x7f7e71);
    assert.equal(reset.surfaces.floor.opacity, 1);
    assert.equal(reset.surfaces.floor.wallColor, 0xffffff);
    assert.equal(reset.room.wallAlpha, 255);
    assert.deepEqual((await state()).document, saved.document);
    checks.push("Both color resets restore the selected style defaults without changing saved Buildings");
    await chooseTool("Ellipsenraum");
    await draw({ x: 2, y: 6 }, { x: 5, y: 9 }, 5);
    const ellipse = (await state()).document.entities[4];
    assert.equal(ellipse.polygons[0].outer.length, 28);
    assert.equal(ellipse.wallAssetId, building.wallAssetId);
    assert.equal(ellipse.wallBevel, true);
    assert.deepEqual((await state()).document.entities[0], building);
    await chooseTool("Polygonraum");
    for (const point of [{ x: 8, y: 6 }, { x: 12, y: 6 }]) {
      const at = await world(point);
      await page.mouse.click(at.x, at.y);
    }
    const curved = await world({ x: 12, y: 9 });
    const handle = await world({ x: 11, y: 8 });
    await page.keyboard.down("Shift");
    await page.mouse.move(curved.x, curved.y);
    await page.mouse.down();
    await page.mouse.move(handle.x, handle.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    const finalPoint = await world({ x: 8, y: 9 });
    await page.mouse.click(finalPoint.x, finalPoint.y);
    await page.mouse.dblclick(finalPoint.x, finalPoint.y, { delay: 90 });
    await page.waitForFunction(() =>
      app.workspace.activeLeaf.view.editor.session.entities.size === 6,
    null, { timeout: 45000 });
    const polygon = (await state()).document.entities[5];
    assert(polygon.polygons[0].outer.length > 4);
    assert.equal(polygon.wallAssetId, building.wallAssetId);
    await chooseTool("Raum");
    await page.getByRole("button", { name: "Bodenfarbe RGBA", exact: true }).click();
    for (const [channel, value] of [["R", "17"], ["G", "34"],
      ["B", "51"], ["A", "128"]])
      await page.getByRole("spinbutton", { name: "Bodenfarbe " + channel }).fill(value);
    assert.equal(await page.getByRole("textbox", { name: "Bodenfarbe Hex ARGB" }).inputValue(), "80112233");
    await page.getByRole("textbox", { name: "Bodenfarbe Hex ARGB" }).fill("3366cc");
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await page.getByRole("button", { name: "Wandfarbe RGBA", exact: true }).click();
    await page.getByRole("textbox", { name: "Wandfarbe Hex ARGB" }).fill("abcdef");
    await page.getByRole("spinbutton", { name: "Wandfarbe A" }).fill("96");
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await draw({ x: 14, y: 6 }, { x: 16, y: 8 }, 7);
    const numeric = (await state()).document.entities[6];
    assert.equal(numeric.fill, 0x3366cc);
    assert.equal(numeric.floorAlpha, 128);
    assert.equal(numeric.wall, 0xabcdef);
    assert.equal(numeric.wallAlpha, 96);
    checks.push("Building floor and wall numeric RGBA, six-digit Hex and Accept are stored together");
    const afterNumeric = await state();
    await page.getByRole("button", { name: "Wandfarbe RGBA", exact: true }).click();
    await page.getByRole("textbox", { name: "Wandfarbe Hex ARGB" }).fill("60224466");
    await page.getByRole("button", { name: "Bauwerk", exact: true }).first().click();
    assert.deepEqual((await state()).document, afterNumeric.document);
    assert.equal((await page.evaluate(() => app.workspace.activeLeaf.view.editor.settings)).surfaces.floor.wallColor, 0x224466);
    await page.getByRole("button", { name: "Bodenfarbe RGBA", exact: true }).click();
    const hue = page.getByRole("slider", { name: "Bodenfarbe Farbton" });
    const hueBox = await hue.boundingBox();
    assert(hueBox);
    await page.mouse.click(hueBox.x + hueBox.width * .7, hueBox.y + hueBox.height / 2);
    const colorField = page.locator(".dn-building-color-field");
    const fieldBox = await colorField.boundingBox();
    assert(fieldBox);
    await page.mouse.click(fieldBox.x + fieldBox.width * .7,
      fieldBox.y + fieldBox.height * .4);
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await draw({ x: 17, y: 6 }, { x: 19, y: 8 }, 8);
    const picked = (await state()).document.entities[7];
    assert.notEqual(picked.fill, numeric.fill);
    assert.equal(picked.floorAlpha, 128);
    assert.equal(picked.wall, 0x224466);
    checks.push("Hue and color-field gestures change a later Building; outside click retains the wall draft");
    await page.getByRole("button", { name: "Wandfarbe RGBA", exact: true }).click();
    await page.getByRole("button", { name: "Pipette", exact: true }).click();
    const wallSamplePoint = await world({ x: 5.25, y: 5.25 });
    const sampleImage = path.join(out, "wall-pipette-source.png");
    await page.screenshot({ path: sampleImage });
    const pixels = PNG.sync.read(fs.readFileSync(sampleImage));
    const offset = (Math.round(wallSamplePoint.y) * pixels.width +
      Math.round(wallSamplePoint.x)) * 4;
    const sampledRgb = (pixels.data[offset] << 16) |
      (pixels.data[offset + 1] << 8) | pixels.data[offset + 2];
    await page.mouse.click(wallSamplePoint.x, wallSamplePoint.y);
    const wallSampleHex = await page.getByRole("textbox", { name: "Wandfarbe Hex ARGB" }).inputValue();
    const pipetteRgb = parseInt(wallSampleHex.slice(-6), 16);
    const channelDifference = [16, 8, 0].map(shift =>
      Math.abs(((pipetteRgb >> shift) & 255) - ((sampledRgb >> shift) & 255)));
    fs.writeFileSync(path.join(out, "wall-pipette-pixel.json"), JSON.stringify({
      point: wallSamplePoint, screenshotRgb: sampledRgb, pipetteRgb,
      channelDifference,
    }, null, 2));
    assert(channelDifference.every(delta => delta <= 2));
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await draw({ x: 14, y: 9 }, { x: 16, y: 11 }, 9);
    assert.equal((await state()).document.entities[8].wall, pipetteRgb);
    checks.push("Wall pipette reads an independently captured map pixel and stores it on the next Building");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    const allShapes = await state();
    fs.writeFileSync(savedState, JSON.stringify(allShapes, null, 2));
    await page.screenshot({ path: path.join(out, "six-building-options.png") });
    checks.push("The same QAWall01 style follows ellipse and sampled Shift polygon contours through save");
  }
  async function reopen() {
    await open();
    const expected = JSON.parse(fs.readFileSync(savedState, "utf8"));
    const actual = await state();
    assert.deepEqual(actual.document, expected.document);
    assert.equal(actual.document.entities.length, 9);
    await page.screenshot({ path: path.join(out, "fresh-reopen.png") });
    checks.push("A fresh Obsidian process reopens all nine Building style and color records");
  }
  return { edit, reopen };
};
