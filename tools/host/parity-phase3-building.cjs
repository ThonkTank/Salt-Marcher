module.exports = ({ page, fs, path, assert, crypto, PNG, qa, vault, out, checks,
  restart,
  chooseTool }) => {
  const mapPath = "Dungeons/Parity/Building-Styles.dungeon";
  const savedState = path.join(qa, "parity-phase3-building-saved.json");
  const combinedState = path.join(qa, "parity-phase3-combined-saved.json");
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
    assert(catalog.floors.some(item => item.id === building.material.assetId));
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
      const local = renderer.local({ clientX: point.x, clientY: point.y });
      return renderer.sampleRenderedPixel({ x: local.x, y: local.y - 1 });
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
    assert.equal(await page.getByRole("spinbutton", { name: "Bodenfarbe A" }).inputValue(), "128");
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await page.getByRole("button", { name: "Bodenfarbe RGBA", exact: true }).click();
    assert.equal(await page.getByRole("spinbutton", { name: "Bodenfarbe A" }).inputValue(), "255");
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await page.getByRole("button", { name: "Wandfarbe RGBA", exact: true }).click();
    await page.getByRole("spinbutton", { name: "Wandfarbe A" }).fill("128");
    await page.getByRole("textbox", { name: "Wandfarbe Hex ARGB" }).fill("abcdef");
    assert.equal(await page.getByRole("spinbutton", { name: "Wandfarbe A" }).inputValue(), "128");
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await page.getByRole("button", { name: "Wandfarbe RGBA", exact: true }).click();
    assert.equal(await page.getByRole("spinbutton", { name: "Wandfarbe A" }).inputValue(), "255");
    await page.getByRole("spinbutton", { name: "Wandfarbe A" }).fill("96");
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await draw({ x: 14, y: 6 }, { x: 16, y: 8 }, 7);
    const numeric = (await state()).document.entities[6];
    assert.equal(numeric.fill, 0x3366cc);
    assert.equal(numeric.floorAlpha, 255);
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
    assert.equal(picked.floorAlpha, 255);
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
  async function combined() {
    await reopen();
    const first = (await state()).document.entities[0];
    assert(first.wallAssetId?.includes("QAWall01"));
    await page.evaluate(async id => {
      await app.workspace.activeLeaf.view.editor.select(id);
    }, first.id);
    await page.getByRole("button", { name: "Raum anlegen", exact: true }).click();
    const room = (await state()).document.entities.find(entity => entity.id === first.id);
    assert(room.number && room.note?.path);
    assert.equal(room.wallAssetId, first.wallAssetId);
    assert.equal(room.floorAlpha, first.floorAlpha);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    await chooseTool("Tür");
    const portalPoint = await world({ x: 3, y: 4 });
    await page.mouse.click(portalPoint.x, portalPoint.y);
    await page.waitForFunction(id => app.workspace.activeLeaf.view.editor.session
      .document().entities.some(entity => entity.kind === "door" &&
        entity.anchor?.boundaryId === id), first.id);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    const keyBefore = fs.readFileSync(path.join(vault, room.note.path));
    const doorBefore = (await state()).document.entities.find(entity =>
      entity.kind === "door" && entity.anchor?.boundaryId === first.id);
    await chooseTool("Raum");
    const from = await world({ x: 3.5, y: 1.5 }),
      to = await world({ x: 4.5, y: 2.5 });
    await page.keyboard.down("Alt");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    await page.waitForFunction(id => {
      const editor = app.workspace.activeLeaf?.view?.editor;
      return !!editor && !editor.paintWorker &&
        editor.session.entities.get(id)?.polygons[0].outer.length > 4;
    }, first.id, { timeout: 45000 });
    const erased = (await state()).document.entities.find(entity => entity.id === first.id);
    assert.equal(erased.wallAssetId, first.wallAssetId);
    assert((await state()).document.entities.some(entity => entity.id === doorBefore.id));
    await chooseTool("Punkte");
    await page.evaluate(async id => {
      await app.workspace.activeLeaf.view.editor.select(id);
    }, first.id);
    const point = await world({ x: 2, y: 2 });
    await page.mouse.move(point.x + 10, point.y + 10);
    await page.mouse.move(point.x, point.y);
    await page.waitForFunction(() => {
      const hover = app.workspace.activeLeaf?.view?.editor?.renderer?.buildingPointHover;
      return hover?.kind === "vertex" && hover.contour === 0 && hover.index === 0;
    });
    const target = await world({ x: 1, y: 1 });
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(id => app.workspace.activeLeaf.view.editor.session
      .entities.get(id)?.polygons[0].outer[0].x === 1, first.id);
    const edited = (await state()).document.entities.find(entity => entity.id === first.id);
    assert.equal(edited.wallAssetId, first.wallAssetId);
    assert((await state()).document.entities.some(entity => entity.id === doorBefore.id));
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    assert.deepEqual((await state()).document.entities.find(entity => entity.id === first.id), erased);
    await page.keyboard.press("Control+y");
    assert.deepEqual((await state()).document.entities.find(entity => entity.id === first.id), edited);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    const keyAfter = fs.readFileSync(path.join(vault, room.note.path));
    assert.deepEqual(keyAfter, keyBefore);
    const document = (await state()).document;
    fs.writeFileSync(combinedState, JSON.stringify({ document, keyPath: room.note.path,
      keySha256: hash(keyAfter) }, null, 2));
    await page.screenshot({ path: path.join(out, "combined-room-portal-erase-point.png") });
    checks.push("QAWall01 room, portal, Alt erasure and point drag preserve wall style and exact room-key bytes");
  }
  async function verifyCombined() {
    await open();
    const expected = JSON.parse(fs.readFileSync(combinedState, "utf8"));
    assert.deepEqual((await state()).document, expected.document);
    assert.equal(hash(fs.readFileSync(path.join(vault, expected.keyPath))), expected.keySha256);
    await page.screenshot({ path: path.join(out, "combined-fresh-reopen.png") });
    checks.push("Fresh Obsidian process reopens combined wall, portal and edited contour with exact room key");
  }
  async function visualMatch(wallTintPair = false, wallAlphaZero = false,
    wallNoShadow = false, wallBlendProbe = false, bevelMaskProbe = false,
    wallGlProbe = false) {
    if (wallBlendProbe) assert(wallTintPair);
    if (bevelMaskProbe) assert(!wallBlendProbe);
    if (wallGlProbe) assert(wallBlendProbe);
    const pack = fs.readFileSync(packPath);
    assert.equal(hash(pack),
      "eaad533f4da8880bf8c0339d9d6ae66dd3d8e1c1d60917288ab0a91242d51ad9");
    assert.equal(hash(fs.readFileSync(pckPath)),
      "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60");
    await page.evaluate(async ({ pckPath, pack }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.useNativeAssetArchive(pckPath);
      if (!plugin.listAssets(["QAWall01"], true)
        .some(asset => asset.kind === "wall" && asset.name === "QA Wall")) {
        const bytes = Uint8Array.from(atob(pack), char => char.charCodeAt(0));
        await plugin.assets.add([new Blob([bytes])]);
        await plugin.reloadAssets();
      }
    }, { pckPath, pack: pack.toString("base64") });
    const file = "Dungeons/Parity/Visual-Match.dungeon";
    const bytes = fs.readFileSync(path.join(__dirname,
      "../fixtures/phase3-qawall-visual-match.dungeon"));
    assert.equal(hash(bytes), "65d8f9e5c2a7658c2fbb2fb3ff4935e8cbff9eff05a550bcb95d55bc88e45a0d");
    const content = JSON.parse(bytes.toString("utf8"));
    if (wallNoShadow) content.settings.wallShadows = false;
    if (wallTintPair) {
      for (const entity of content.entities) {
        entity.wall = 0xff0000;
        entity.wallAlpha = entity.wallBevel ? (wallAlphaZero ? 0 : 128) : 255;
        for (const polygon of entity.polygons)
          for (const point of polygon.outer) {
            point.x -= 1;
            point.y += 2;
          }
      }
    }
    await page.evaluate(async ({ file, content }) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      const existing = app.vault.getAbstractFileByPath(file);
      if (existing) await app.vault.modify(existing, content);
      else await app.vault.create(file, content);
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file));
    }, { file, content: JSON.stringify(content) });
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Raum");
    const grid = page.getByRole("button", { name: "Raster", exact: true });
    if (await grid.getAttribute("aria-pressed") === "true") await grid.click();
    const layout = await page.evaluate((wallTintPair) => {
      const editor = app.workspace.activeLeaf.view.editor,
        renderer = editor.renderer,
        box = renderer.canvas.getBoundingClientRect();
      renderer.camera.scale = 64;
      renderer.camera.x = box.width / 2 - (wallTintPair ? 3.5 : 4.5) * 64;
      renderer.camera.y = box.height / 2 - (wallTintPair ? 5 : 3) * 64;
      renderer.zoom(1);
      return {
        box: box.toJSON(), camera: { ...renderer.camera },
        wallShadows: editor.session.settings.wallShadows,
        entities: editor.session.document().entities.map(entity => ({
          id: entity.id, fill: entity.fill, floorAlpha: entity.floorAlpha,
          wall: entity.wall, wallAlpha: entity.wallAlpha, wallWidth: entity.wallWidth,
          wallAssetId: entity.wallAssetId, wallBevel: entity.wallBevel,
          material: entity.material, polygons: entity.polygons,
        })),
      };
    }, wallTintPair);
    assert.equal(layout.entities.length, 2);
    assert(layout.entities.every(entity => entity.wallAssetId?.includes("QAWall01")));
    assert.deepEqual(layout.entities.map(entity => entity.wallBevel), [false, true]);
    fs.writeFileSync(path.join(out, "visual-match-layout.json"), JSON.stringify(layout, null, 2));
    await page.waitForFunction(() => {
      const renderer = app.workspace.activeLeaf?.view?.editor?.renderer;
      return renderer?.visuals.size === 2 &&
        [...renderer.visuals.values()].every(visual =>
          visual.wallGeometries?.length > 0);
    });
    const screenshot = !wallTintPair ? "visual-match-64px.png"
      : wallNoShadow ? "wall-tint-no-shadow-64px.png"
      : wallAlphaZero ? "wall-tint-zero-64px.png"
      : "wall-tint-pair-64px.png";
    await page.screenshot({ path: path.join(out, screenshot) });
    if (bevelMaskProbe) {
      const geometry = await page.evaluate(() => {
        const renderer = app.workspace.activeLeaf.view.editor.renderer;
        const visual = renderer.visuals.get("visual-on");
        const layer = visual.container.children.find(child =>
          child.children?.some(item => item.geometry === visual.wallGeometries[0]));
        const value = {
          positions: [...visual.wallGeometries[0].positions],
          uvs: [...visual.wallGeometries[0].uvs],
          indices: [...visual.wallGeometries[0].indices],
        };
        const mask = layer.mask;
        layer.mask = null;
        mask.visible = false;
        renderer.invalidate();
        return value;
      });
      fs.writeFileSync(path.join(out, "bevel-wall-geometry.json"),
        JSON.stringify(geometry));
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(out, "bevel-unmasked-64px.png") });
      checks.push("Bevel wall was captured with and without its mask in one scene");
    }
    if (wallBlendProbe) {
      const layers = await page.evaluate(() => {
        const renderer = app.workspace.activeLeaf.view.editor.renderer;
        const visual = renderer.visuals.get("visual-on");
        return visual.container.children.map(child => ({
          type: child.constructor.name,
          alpha: child.alpha,
          visible: child.visible,
          children: child.children?.map(item => ({
            type: item.constructor.name, alpha: item.alpha,
            visible: item.visible,
            blendMode: item.state?.blendMode,
          })),
        }));
      });
      fs.writeFileSync(path.join(out, "wall-blend-layers.json"),
        JSON.stringify(layers, null, 2));
      for (const [name, alpha] of [["zero", 0], ["half", 0.5], ["full", 1]]) {
        await page.evaluate(value => {
          const renderer = app.workspace.activeLeaf.view.editor.renderer;
          const visual = renderer.visuals.get("visual-on");
          const mesh = visual.container.children.flatMap(child => child.children ?? [])
            .find(child => child.geometry === visual.wallGeometries[0]);
          mesh.alpha = value;
          renderer.invalidate();
        }, alpha);
        await page.waitForTimeout(100);
        if (wallGlProbe) {
          const glState = await page.evaluate(() => {
            const renderer = app.workspace.activeLeaf.view.editor.renderer;
            const visual = renderer.visuals.get("visual-on");
            const mesh = visual.container.children.flatMap(child => child.children ?? [])
              .find(child => child.geometry === visual.wallGeometries[0]);
            renderer.app.render();
            const pixi = renderer.app.renderer;
            const gl = pixi.gl;
            if (!gl) throw new Error("WebGL context missing");
            const box = renderer.canvas.getBoundingClientRect();
            const read = (globalX, globalY) => {
              const x = Math.floor((globalX - box.left) * gl.drawingBufferWidth / box.width);
              const y = gl.drawingBufferHeight - 1 -
                Math.floor((globalY - box.top) * gl.drawingBufferHeight / box.height);
              const rgba = new Uint8Array(4);
              gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
              return [...rgba];
            };
            return {
              meshAlpha: mesh.alpha,
              groupColorAlpha: mesh.groupColorAlpha,
              textureAlphaMode: mesh.texture.source.alphaMode,
              blendMode: mesh.state.blendMode,
              gl: {
                blend: gl.getParameter(gl.BLEND),
                srcRgb: gl.getParameter(gl.BLEND_SRC_RGB),
                dstRgb: gl.getParameter(gl.BLEND_DST_RGB),
                srcAlpha: gl.getParameter(gl.BLEND_SRC_ALPHA),
                dstAlpha: gl.getParameter(gl.BLEND_DST_ALPHA),
                framebuffer: !!gl.getParameter(gl.FRAMEBUFFER_BINDING),
                size: [gl.drawingBufferWidth, gl.drawingBufferHeight],
              },
              pixels: {
                outside: read(800, 300),
                outer: read(864, 355),
                inner: read(864, 363),
              },
            };
          });
          fs.writeFileSync(path.join(out, `wall-gl-${name}.json`),
            JSON.stringify(glState, null, 2));
        }
        await page.screenshot({ path: path.join(out, `wall-blend-${name}.png`) });
      }
      await page.evaluate(() => {
        const renderer = app.workspace.activeLeaf.view.editor.renderer;
        const visual = renderer.visuals.get("visual-on");
        const layer = visual.container.children.find(child =>
          child.children?.some(item => item.geometry === visual.wallGeometries[0]));
        const mask = layer.mask;
        layer.mask = null;
        mask.visible = false;
        layer.children[0].alpha = 0.5;
        renderer.invalidate();
      });
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(out, "wall-blend-half-unmasked.png") });
      checks.push("One loaded wall mesh was sampled at zero, half and full alpha in one process");
    }
    checks.push(wallTintPair
      ? `Two QAWall01 rooms render red at full and ${wallAlphaZero ? "zero" : "half"} wall opacity with bevel off and on${wallNoShadow ? ", without wall shadow" : ""}`
      : "Two equal QAWall01 rooms render at 64 screen pixels per field with bevel off and on");
  }
  async function portalVisual(twoDoors = false, layerProbe = false,
    bevelOff = false) {
    const pack = fs.readFileSync(packPath);
    assert.equal(hash(pack),
      "eaad533f4da8880bf8c0339d9d6ae66dd3d8e1c1d60917288ab0a91242d51ad9");
    assert.equal(hash(fs.readFileSync(pckPath)),
      "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60");
    const file = twoDoors
      ? "Dungeons/Parity/QAWall-Two-Portals.dungeon"
      : "Dungeons/Parity/QAWall-Portal-Visual.dungeon";
    const savedPortal = path.join(qa, twoDoors
      ? "parity-phase3-two-portals-saved.json" : "parity-phase3-portal-saved.json");
    const content = {
      format: "dungeon-map", version: 3, id: "phase3-qawall-portal-visual",
      settings: { name: "QAWall Portal Visual", width: 12, height: 9,
        feetPerField: 5, assetPacks: ["QAWall01"], builtInAssets: true,
        wallShadows: true, objectShadows: false, buildingWear: 0 },
      floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
      entities: [
        { id: "portal-room", kind: "building", floorId: "floor-1",
          polygons: [{ outer: [{ x: 2, y: 2 }, { x: 7, y: 2 },
            { x: 7, y: 5 }, { x: 2, y: 5 }], holes: [] }],
          layer: 200, fill: 0xb28f6f, floorAlpha: 255,
          wall: 0xffffff, wallAlpha: 255, wallBevel: !bevelOff, wallWidth: 0.2,
          wallAssetId: "pack:QAWall01:wall:data%2Fwalls%2FQA%20Wall.dungeondraft_wall",
          material: { assetId: "pack:dungeondraft-builtin-1.2.0.1:tileset:" +
            encodeURIComponent("res://textures/tilesets/smart/tileset_wood_vertical.png"),
            assetPart: "image", tileSize: 8, tint: 0xb28f6f, rotation: 0 } },
        { id: "portal-door", kind: "door", floorId: "floor-1", width: 1,
          variant: "door", assetId: "pack:dungeondraft-builtin-1.2.0.1:portal:" +
            encodeURIComponent("res://textures/portals/door_00.png"),
          anchor: { boundaryId: "portal-room", contour: 0,
            at: 0.15625 } },
        ...(twoDoors ? [{ id: "portal-door-bottom", kind: "door",
          floorId: "floor-1", width: 1, variant: "door",
          assetId: "pack:dungeondraft-builtin-1.2.0.1:portal:" +
            encodeURIComponent("res://textures/portals/door_00.png"),
          anchor: { boundaryId: "portal-room", contour: 0,
            at: 0.65625 } }] : []),
      ],
      content: { definitions: [], occurrences: [], routes: [], archive: [] },
    };
    await page.evaluate(async ({ file, content, pckPath, pack, restart }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.useNativeAssetArchive(pckPath);
      if (!plugin.listAssets(["QAWall01"], true)
        .some(asset => asset.kind === "wall" && asset.name === "QA Wall")) {
        const bytes = Uint8Array.from(atob(pack), char => char.charCodeAt(0));
        await plugin.assets.add([new Blob([bytes])]);
        await plugin.reloadAssets();
      }
      if (!restart) {
        await app.vault.createFolder("Dungeons/Parity").catch(() => {});
        const existing = app.vault.getAbstractFileByPath(file);
        if (existing) await app.vault.modify(existing, JSON.stringify(content));
        else await app.vault.create(file, JSON.stringify(content));
      }
      await app.workspace.getLeaf(false).openFile(
        app.vault.getAbstractFileByPath(file));
    }, { file, content, pckPath, pack: pack.toString("base64"), restart });
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await chooseTool("Raum");
    const grid = page.getByRole("button", { name: "Raster", exact: true });
    if (await grid.getAttribute("aria-pressed") === "true") await grid.click();
    await page.waitForFunction((twoDoors) => {
      const visuals = app.workspace.activeLeaf?.view?.editor?.renderer?.visuals;
      const room = visuals?.get("portal-room");
      return visuals?.size === (twoDoors ? 3 : 2) &&
        room?.wallGeometries?.length > 0 &&
        room?.floorGeometry?.positions.length > 0 &&
        visuals.get("portal-door")?.container.children.length > 1 &&
        (!twoDoors || visuals.get("portal-door-bottom")?.container.children.length > 1);
    }, twoDoors);
    const catalog = await page.evaluate(() => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      return plugin.listAssets(["QAWall01"], true).filter(asset =>
        asset.kind === "portal" && asset.name === "Standard Door");
    });
    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].id, content.entities[1].assetId);
    const layout = await page.evaluate(() => {
      const editor = app.workspace.activeLeaf.view.editor,
        renderer = editor.renderer, box = renderer.canvas.getBoundingClientRect();
      renderer.camera.scale = 64;
      renderer.camera.x = 0;
      renderer.camera.y = 176;
      renderer.zoom(1);
      return { box: box.toJSON(), camera: { ...renderer.camera },
        entities: editor.session.document().entities };
    });
    if (restart)
      assert.deepEqual(layout.entities, JSON.parse(fs.readFileSync(savedPortal, "utf8")));
    else
      fs.writeFileSync(savedPortal, JSON.stringify(layout.entities, null, 2));
    fs.writeFileSync(path.join(out, "portal-valid-style-layout.json"),
      JSON.stringify(layout, null, 2));
    await page.screenshot({ path: path.join(out, "portal-valid-style-64px.png") });
    if (layerProbe) {
      const hierarchy = await page.evaluate((twoDoors) => {
        const renderer = app.workspace.activeLeaf.view.editor.renderer,
          visuals = renderer.visuals,
          room = visuals.get("portal-room"),
          wall = room.container.children.find(child => child.children?.some(
            mesh => room.wallGeometries.includes(mesh.geometry)));
        if (!wall) throw new Error("Wandebene fehlt.");
        const before = room.container.children.map(child => ({
          type: child.constructor.name,
          children: child.children?.length ?? 0,
          wall: child === wall,
        }));
        const ids = twoDoors ? ["portal-door", "portal-door-bottom"] : ["portal-door"];
        for (const id of ids)
          room.container.addChildAt(visuals.get(id).container,
            room.container.getChildIndex(wall));
        renderer.invalidate();
        return { before, after: room.container.children.map(child => ({
          type: child.constructor.name,
          children: child.children?.length ?? 0,
          wall: child === wall,
        })) };
      }, twoDoors);
      fs.writeFileSync(path.join(out, "portal-layer-hierarchy.json"),
        JSON.stringify(hierarchy, null, 2));
      await page.waitForTimeout(120);
      await page.screenshot({ path: path.join(out, "portal-under-wall.png") });
      checks.push("Portal sprite layering was probed without changing the saved map");
    }
    if (!restart) {
      await page.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.waitForFunction(() =>
        !app.workspace.activeLeaf.view.editor.session.dirty);
    }
    checks.push("QAWall01 5×3 room and " + (twoDoors ? "two bound" : "one bound") +
      " one-field original door texture render at 64 screen pixels per field" +
      (restart ? " after a fresh process" : " and save"));
  }
  async function floorVariant(restart) {
    const file = "Dungeons/Parity/Floor-Variants.dungeon";
    assert.equal(hash(fs.readFileSync(pckPath)),
      "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60");
    await page.evaluate(async ({ file, pckPath, restart }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.useNativeAssetArchive(pckPath);
      if (!restart) {
        await app.vault.createFolder("Dungeons/Parity").catch(() => {});
        const building = (id, x0, x1, fill, assetId) => ({
          id, kind: "building", floorId: "floor-1",
          polygons: [{ outer: [
            { x: x0, y: 1 }, { x: x1, y: 1 },
            { x: x1, y: 4 }, { x: x0, y: 4 },
          ], holes: [] }], layer: 200, fill, floorAlpha: 255,
          wall: 0xffffff, wallAlpha: 255, wallWidth: 0,
          material: { assetId, assetPart: "image", tileSize: 8,
            tint: fill, rotation: 0 },
        });
        const document = {
          format: "dungeon-map", version: 3, id: "phase3-floor-variants",
          settings: { name: "Floor Variants", width: 8, height: 8,
            feetPerField: 5, assetPacks: [], builtInAssets: true,
            wallShadows: false, objectShadows: false, buildingWear: 0 },
          floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0,
            ambient: 1 }],
          entities: [
            building("wood", 1, 4, 0xb28f6f,
              "pack:dungeondraft-builtin-1.2.0.1:tileset:res%3A%2F%2Ftextures%2Ftilesets%2Fsmart%2Ftileset_wood_vertical.png"),
            building("stone", 4, 7, 0x7f7e71,
              "pack:dungeondraft-builtin-1.2.0.1:tileset:res%3A%2F%2Ftextures%2Ftilesets%2Fsmart_double%2Ftileset_stone.png"),
          ], content: { definitions: [], occurrences: [], routes: [], archive: [] },
        };
        const existing = app.vault.getAbstractFileByPath(file);
        if (existing) await app.vault.modify(existing, JSON.stringify(document));
        else await app.vault.create(file, JSON.stringify(document));
      }
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file));
    }, { file, pckPath, restart });
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const visuals = app.workspace.activeLeaf?.view?.editor?.renderer?.visuals;
      return visuals?.size === 2 && [...visuals.values()]
        .every((visual) => visual.floorGeometry?.positions.length === 72);
    }, null, { timeout: 30000 });
    const actual = await page.evaluate(() => {
      const renderer = app.workspace.activeLeaf.view.editor.renderer,
        box = renderer.canvas.getBoundingClientRect();
      renderer.camera.scale = 64;
      renderer.camera.x = box.width / 2 - 4 * 64;
      renderer.camera.y = box.height / 2 - 4 * 64;
      renderer.zoom(1);
      return Object.fromEntries([...renderer.visuals].map(([id, visual]) => {
        const geometry = visual.floorGeometry,
          columns = id === "stone" ? 8 : 4,
          width = columns * 256,
          height = visual.floorLayer.children[0].texture.height,
          indices = [];
        for (let offset = 0; offset < geometry.positions.length; offset += 8) {
          const x = geometry.positions[offset], y = geometry.positions[offset + 1],
            u = geometry.uvs[offset], v = geometry.uvs[offset + 1];
          indices.push({ x, y,
            atlas: Math.floor(v * height / 256) * columns +
              Math.floor(u * width / 256) });
        }
        return [id, indices];
      }));
    });
    assert.deepEqual(actual.wood.map(({ atlas }) => atlas),
      [4, 1, 4, 3, 1, 11, 14, 2, 12]);
    assert.deepEqual(actual.stone.map(({ atlas }) => atlas),
      [29, 15, 18, 10, 25, 14, 7, 21, 0]);
    fs.writeFileSync(path.join(out, "floor-variants.json"),
      JSON.stringify(actual, null, 2));
    const colors = await page.evaluate(() => Object.fromEntries(
      [...app.workspace.activeLeaf.view.editor.renderer.visuals]
        .map(([id, visual]) => {
          const mesh = visual.floorLayer.children[0];
          return [id, {
            fill: visual.entity.fill,
            meshTint: mesh.tint,
            meshGroupColorAlpha: mesh.groupColorAlpha,
            containerTint: visual.container.tint,
            grimeWidth: visual.floorShader?.resources.uGrime?.width,
          }];
        }),
    ));
    assert(Object.values(colors).every(material =>
      material.meshTint === material.fill &&
      material.containerTint === 0xffffff &&
      material.grimeWidth === 2048));
    fs.writeFileSync(path.join(out, "floor-material.json"),
      JSON.stringify(colors, null, 2));
    await page.screenshot({ path: path.join(out, "floor-variants-64px.png") });
    await page.evaluate(() => {
      const renderer = app.workspace.activeLeaf.view.editor.renderer;
      for (const visual of renderer.visuals.values())
        visual.floorLayer.visible = false;
      renderer.invalidate();
    });
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(out, "floor-background-64px.png") });
    checks.push("Native saved wood/stone map uses the exact 18 atlas cells in a fresh Obsidian process");
  }
  async function floorMosaic(restart, defaultTint = false) {
    const file = "Dungeons/Parity/Floor-Mosaic" +
      (defaultTint ? "-Defaults" : "") + ".dungeon";
    const names = [
      "smart/tileset_wood_vertical", "smart_double/tileset_stone",
      "simple/tileset_brick_running", "simple/tileset_diamond_2",
      "simple/tileset_brick_worn", "simple/tileset_cut_stone",
      "simple/tileset_carpet", "simple/tileset_concrete_slab",
      "simple/tileset_diamond", "simple/tileset_brick_basketweave",
      "simple/tileset_cave", "simple/tileset_cobble",
      "simple/tileset_concrete_large", "simple/tileset_concrete",
      "simple/tileset_roman_worn", "simple/tileset_ornate",
      "simple/tileset_roman_tiles", "simple/tileset_herringbone",
      "simple/tileset_straw", "simple/tileset_sewers",
      "simple/tileset_wood_damaged", "simple/tileset_plank_45",
      "simple/tileset_wood_interlaced", "simple/tileset_worn_cobble",
    ];
    assert.equal(hash(fs.readFileSync(pckPath)),
      "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60");
    await page.evaluate(async ({ file, pckPath, restart, names, defaultTint }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.useNativeAssetArchive(pckPath);
      if (!restart) {
        await app.vault.createFolder("Dungeons/Parity").catch(() => {});
        const entities = names.map((name, index) => {
          const x = index % 6 * 3, y = Math.floor(index / 6) * 3;
          const source = `res://textures/tilesets/${name}.png`;
          const assetId = "pack:dungeondraft-builtin-1.2.0.1:tileset:" +
            encodeURIComponent(source);
          const design = plugin.nativePathCatalog.floors.find(
            floor => floor.files.image === source);
          if (!design) throw new Error("Bodenstil fehlt: " + source);
          const fill = defaultTint ? Number.parseInt(design.color, 16) : 0xffffff;
          return {
            id: `style-${index}`, kind: "building", floorId: "floor-1",
            polygons: [{ outer: [
              { x, y }, { x: x + 2, y },
              { x: x + 2, y: y + 2 }, { x, y: y + 2 },
            ], holes: [] }],
            layer: 200, fill, floorAlpha: 255,
            wall: 0xffffff, wallAlpha: 255, wallWidth: 0,
            material: { assetId, assetPart: "image", tileSize: 8,
              tint: fill, rotation: 0 },
          };
        });
        const document = {
          format: "dungeon-map", version: 3, id: "phase3-floor-mosaic",
          settings: { name: "Floor Mosaic", width: 18, height: 12,
            feetPerField: 5, assetPacks: [], builtInAssets: true,
            wallShadows: false, objectShadows: false, buildingWear: 0 },
          floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0,
            ambient: 1 }],
          entities, content: { definitions: [], occurrences: [],
            routes: [], archive: [] },
        };
        const existing = app.vault.getAbstractFileByPath(file);
        if (existing) await app.vault.modify(existing, JSON.stringify(document));
        else await app.vault.create(file, JSON.stringify(document));
      }
      await app.workspace.getLeaf(false).openFile(
        app.vault.getAbstractFileByPath(file));
    }, { file, pckPath, restart, names, defaultTint });
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const visuals = app.workspace.activeLeaf?.view?.editor?.renderer?.visuals;
      return visuals?.size === 24 && [...visuals.values()]
        .every(visual => visual.floorGeometry?.positions.length === 32);
    }, null, { timeout: 30000 });
    const variants = await page.evaluate(() => Object.fromEntries(
      [...app.workspace.activeLeaf.view.editor.renderer.visuals]
        .map(([id, visual]) => {
          const mesh = visual.floorLayer.children[0],
            geometry = visual.floorGeometry,
            columns = mesh.texture.width / 256;
          const cells = [];
          for (let offset = 0; offset < geometry.positions.length; offset += 8)
            cells.push({
              x: geometry.positions[offset], y: geometry.positions[offset + 1],
              atlas: Math.floor(geometry.uvs[offset + 1] *
                mesh.texture.height / 256) * columns +
                Math.floor(geometry.uvs[offset] *
                  mesh.texture.width / 256),
            });
          return [id, cells];
        }),
    ));
    fs.writeFileSync(path.join(out, "floor-mosaic-variants.json"),
      JSON.stringify(variants, null, 2));
    await page.evaluate(() => {
      const renderer = app.workspace.activeLeaf.view.editor.renderer,
        box = renderer.canvas.getBoundingClientRect();
      renderer.camera.scale = 32;
      renderer.camera.x = box.width / 2 - 9 * 32;
      renderer.camera.y = box.height / 2 - 6 * 32;
      renderer.zoom(1);
    });
    await page.screenshot({ path: path.join(out, "floor-mosaic-32px.png") });
    fs.writeFileSync(path.join(out, "floor-mosaic-order.json"),
      JSON.stringify(names, null, 2));
    checks.push("All 24 native floor styles render in original saved-map order");
  }
  async function pickerPair(restart) {
    const file = "Dungeons/Parity/Building-Picker-Pair.dungeon";
    const saved = path.join(qa, "parity-phase3-picker-pair-saved.json");
    if (!restart) {
      await page.evaluate(async ({ file, pckPath }) => {
        const plugin = app.plugins.getPlugin("dungeon-editor");
        await plugin.useNativeAssetArchive(pckPath);
        await app.vault.createFolder("Dungeons/Parity").catch(() => {});
        await app.vault.create(file, JSON.stringify({
          format: "dungeon-map", version: 3, id: "phase3-picker-pair",
          settings: { name: "Building Picker Pair", width: 20, height: 12,
            feetPerField: 5, assetPacks: [], builtInAssets: true,
            wallShadows: true, objectShadows: false, buildingWear: 0 },
          floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0,
            ambient: 1 }],
          entities: [], content: { definitions: [], occurrences: [],
            routes: [], archive: [] },
        }));
      }, { file, pckPath });
    }
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(
      app.vault.getAbstractFileByPath(file)), file);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    if (restart) {
      const actual = (await state()).document;
      const expected = JSON.parse(fs.readFileSync(saved, "utf8"));
      assert.deepEqual(actual, expected);
      checks.push("The seven Building picker comparison rooms reopen byte-equivalent");
      return;
    }
    await chooseTool("Raum");
    const snapshot = async label => {
      const current = await state();
      fs.writeFileSync(path.join(out, label + ".json"),
        JSON.stringify({ document: current.document,
          settings: await page.evaluate(() => app.workspace.activeLeaf.view.editor.settings) }, null, 2));
      await page.screenshot({ path: path.join(out, label + ".png") });
      return current.document.entities;
    };
    const openPicker = kind => page.getByRole("button", {
      name: kind === "floor" ? "Bodenfarbe RGBA" : "Wandfarbe RGBA",
      exact: true,
    }).click();
    const label = kind => kind === "floor" ? "Bodenfarbe" : "Wandfarbe";
    const setHex = async (kind, hex) => {
      await openPicker(kind);
      await page.getByRole("textbox", { name: label(kind) + " Hex ARGB" }).fill(hex);
      await page.getByRole("button", { name: "Accept", exact: true }).click();
    };
    const drawNext = async (index, a, b, name) => {
      await draw(a, b, index);
      const entities = await snapshot(name);
      return entities.at(-1);
    };
    for (const [kind, values] of [["floor", [17, 34, 51, 128]],
      ["wall", [68, 85, 102, 128]]]) {
      await openPicker(kind);
      for (const [channel, value] of ["R", "G", "B", "A"].map((c, i) =>
        [c, values[i]]))
        await page.getByRole("spinbutton", { name: label(kind) + " " + channel })
          .fill(String(value));
      await page.getByRole("button", { name: "Accept", exact: true }).click();
    }
    const numeric = await drawNext(1, { x: 2, y: 2 }, { x: 4, y: 4 }, "01-numeric");
    assert.equal(numeric.fill, 0x112233);
    assert.equal(numeric.floorAlpha, 128);
    assert.equal(numeric.wall, 0x445566);
    assert.equal(numeric.wallAlpha, 128);
    await setHex("floor", "a1b2c3");
    await setHex("wall", "d4e5f6");
    const six = await drawNext(2, { x: 6, y: 2 }, { x: 8, y: 4 }, "02-six-hex");
    assert.equal(six.fill, 0xa1b2c3);
    assert.equal(six.floorAlpha, 255);
    assert.equal(six.wall, 0xd4e5f6);
    assert.equal(six.wallAlpha, 255);
    await setHex("floor", "7f102030");
    await setHex("wall", "40112233");
    const eight = await drawNext(3, { x: 10, y: 2 }, { x: 12, y: 4 }, "03-eight-hex");
    assert.equal(eight.fill, 0x102030);
    assert.equal(eight.floorAlpha, 127);
    assert.equal(eight.wall, 0x112233);
    assert.equal(eight.wallAlpha, 64);
    await openPicker("floor");
    await page.getByRole("textbox", { name: "Bodenfarbe Hex ARGB" })
      .fill("7f88a0b8");
    await page.locator(".dn-tool-rail").click({ position: { x: 5, y: 5 } });
    assert.equal(await page.getByRole("dialog", { name: "Bodenfarbe" }).count(), 0);
    await openPicker("floor");
    assert.equal(await page.getByRole("textbox", { name: "Bodenfarbe Hex ARGB" })
      .inputValue(), "7f88a0b8");
    await page.getByRole("dialog", { name: "Bodenfarbe" }).press("Escape");
    await openPicker("wall");
    await page.getByRole("textbox", { name: "Wandfarbe Hex ARGB" })
      .fill("408fa9c2");
    await page.locator(".dn-tool-rail").click({ position: { x: 5, y: 5 } });
    assert.equal(await page.getByRole("dialog", { name: "Wandfarbe" }).count(), 0);
    await openPicker("wall");
    assert.equal(await page.getByRole("textbox", { name: "Wandfarbe Hex ARGB" })
      .inputValue(), "408fa9c2");
    await page.getByRole("dialog", { name: "Wandfarbe" }).press("Escape");
    const outside = await drawNext(4, { x: 14, y: 2 }, { x: 16, y: 4 },
      "04-outside-escape");
    assert.equal(outside.fill, 0x88a0b8);
    assert.equal(outside.floorAlpha, 127);
    assert.equal(outside.wall, 0x8fa9c2);
    assert.equal(outside.wallAlpha, 64);
    await setHex("floor", "b89f88");
    await setHex("wall", "726e65");
    for (const [kind, y] of [["floor", .273], ["wall", .238]]) {
      await openPicker(kind);
      const field = page.locator(".dn-building-color-field");
      const box = await field.boundingBox();
      assert(box);
      await page.mouse.click(box.x + box.width * .262, box.y + box.height * y);
      await page.getByRole("button", { name: "Accept", exact: true }).click();
    }
    const field = await drawNext(5, { x: 2, y: 6 }, { x: 4, y: 8 },
      "05-field");
    assert.notEqual(field.fill, 0xb89f88);
    assert.notEqual(field.wall, 0x726e65);
    await setHex("floor", "b89f88");
    await setHex("wall", "c2b38f");
    for (const [kind, fraction] of [["floor", .569], ["wall", .637]]) {
      await openPicker(kind);
      const hue = page.getByRole("slider", { name: label(kind) + " Farbton" });
      const box = await hue.boundingBox();
      assert(box);
      await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
      await page.getByRole("button", { name: "Accept", exact: true }).click();
    }
    const hue = await drawNext(6, { x: 6, y: 6 }, { x: 8, y: 8 }, "06-hue");
    assert.equal(hue.fill, 0x88a4b8);
    assert.equal(hue.wall, 0x8f98c2);
    const samplePoint = await world({ x: 3, y: 3 });
    const expectedSample = await page.evaluate(point => {
      const renderer = app.workspace.activeLeaf.view.editor.renderer;
      const local = renderer.local({ clientX: point.x, clientY: point.y });
      return renderer.sampleRenderedPixel({ x: local.x, y: local.y - 1 });
    }, samplePoint);
    assert(expectedSample);
    for (const kind of ["floor", "wall"]) {
      await openPicker(kind);
      await page.getByRole("button", { name: "Pipette", exact: true }).click();
      await page.mouse.click(samplePoint.x, samplePoint.y);
      const actualHex = await page.getByRole("textbox", {
        name: label(kind) + " Hex ARGB",
      }).inputValue();
      const expectedHex = (expectedSample.alphaByte === 255 ? "" :
        expectedSample.alphaByte.toString(16).padStart(2, "0")) +
        expectedSample.color.toString(16).padStart(6, "0");
      assert.equal(actualHex, expectedHex);
      await page.getByRole("button", { name: "Accept", exact: true }).click();
    }
    fs.writeFileSync(path.join(out, "07-pipette-sample.json"),
      JSON.stringify({ screenPoint: samplePoint, expectedSample }, null, 2));
    const pipette = await drawNext(7, { x: 10, y: 6 }, { x: 12, y: 8 },
      "07-pipette");
    assert.equal(pipette.fill, expectedSample.color);
    assert.equal(pipette.wall, expectedSample.color);
    assert.equal(pipette.floorAlpha, expectedSample.alphaByte);
    assert.equal(pipette.wallAlpha, expectedSample.alphaByte);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    const document = (await state()).document;
    fs.writeFileSync(saved, JSON.stringify(document));
    checks.push("Numeric, six/eight-digit Hex, outside/Escape, field, Hue and sampled floor/wall pixels persist as seven separate Buildings");
  }
  async function fieldKnownStart(restart) {
    const file = "Dungeons/Parity/Building-Field-Known-Start.dungeon";
    const saved = path.join(qa, "parity-phase3-field-known-start-saved.json");
    if (!restart) {
      await page.evaluate(async ({ file, pckPath }) => {
        const plugin = app.plugins.getPlugin("dungeon-editor");
        await plugin.useNativeAssetArchive(pckPath);
        await app.vault.createFolder("Dungeons/Parity").catch(() => {});
        await app.vault.create(file, JSON.stringify({
          format: "dungeon-map", version: 3, id: "phase3-field-known-start",
          settings: { name: "Building Field Known Start", width: 8, height: 8,
            feetPerField: 5, assetPacks: [], builtInAssets: true,
            wallShadows: true, objectShadows: false, buildingWear: 0 },
          floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
          entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
        }));
      }, { file, pckPath });
    }
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(
      app.vault.getAbstractFileByPath(file)), file);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    if (restart) {
      const expected = JSON.parse(fs.readFileSync(saved, "utf8"));
      assert.deepEqual((await state()).document, expected);
      checks.push("Known-start Floor/Wall field Buildings reopen byte-equivalent");
      return;
    }
    await chooseTool("Raum");
    const setHex = async (kind, value) => {
      const label = kind === "floor" ? "Bodenfarbe" : "Wandfarbe";
      await page.getByRole("button", { name: label + " RGBA", exact: true }).click();
      await page.getByRole("textbox", { name: label + " Hex ARGB" }).fill(value);
      await page.getByRole("button", { name: "Accept", exact: true }).click();
    };
    const clickField = async (kind, initial) => {
      const label = kind === "floor" ? "Bodenfarbe" : "Wandfarbe";
      await setHex(kind, initial);
      await page.getByRole("button", { name: label + " RGBA", exact: true }).click();
      const input = page.getByRole("textbox", { name: label + " Hex ARGB" });
      const before = await input.inputValue();
      assert.equal(before, initial.slice(2));
      const field = page.locator(".dn-building-color-field");
      const box = await field.boundingBox();
      assert(box);
      const yFraction = kind === "floor" ? 141 / 256 : 140 / 256;
      await page.mouse.click(box.x + box.width * .75,
        box.y + box.height * yFraction);
      const after = await input.inputValue();
      await page.screenshot({ path: path.join(out, kind + "-field-known-start.png") });
      await page.getByRole("button", { name: "Accept", exact: true }).click();
      return { before, after, fieldBox: box, fraction: [.75, yFraction] };
    };
    const floor = await clickField("floor", "ffb28f6f");
    assert.equal(floor.after, "73461d");
    await draw({ x: 1, y: 1 }, { x: 2, y: 2 }, 1);
    const first = (await state()).document.entities[0];
    const wall = await clickField("wall", "ff726e65");
    assert.equal(wall.after, "74591d");
    await draw({ x: 3, y: 1 }, { x: 4, y: 2 }, 2);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    const document = (await state()).document;
    fs.writeFileSync(saved, JSON.stringify(document));
    fs.writeFileSync(path.join(out, "field-known-start.json"),
      JSON.stringify({ floor, wall, first: { fill: first.fill, wall: first.wall },
        buildings: document.entities.filter(entity => entity.kind === "building")
          .map(entity => ({ fill: entity.fill, floorAlpha: entity.floorAlpha,
            wall: entity.wall, wallAlpha: entity.wallAlpha })) }, null, 2));
    checks.push("Known ARGB starts and matched field fractions persist on two Buildings");
  }
  async function fieldMatrix(restart) {
    const file = "Dungeons/Parity/Building-Field-Matrix.dungeon";
    const saved = path.join(qa, "parity-phase3-field-matrix-saved.json");
    const referencePath = process.env.DUNGEON_FIELD_MATRIX_ORIGINAL;
    assert(referencePath, "DUNGEON_FIELD_MATRIX_ORIGINAL is required");
    const reference = JSON.parse(fs.readFileSync(referencePath, "utf8"));
    assert.equal(reference.rows.length, 14);
    if (!restart) {
      await page.evaluate(async ({ file, pckPath }) => {
        const plugin = app.plugins.getPlugin("dungeon-editor");
        await plugin.useNativeAssetArchive(pckPath);
        await app.vault.createFolder("Dungeons/Parity").catch(() => {});
        await app.vault.create(file, JSON.stringify({
          format: "dungeon-map", version: 3, id: "phase3-field-matrix",
          settings: { name: "Building Field Matrix", width: 8, height: 8,
            feetPerField: 5, assetPacks: [], builtInAssets: true,
            wallShadows: true, objectShadows: false, buildingWear: 0 },
          floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
          entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
        }));
      }, { file, pckPath });
    }
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(
      app.vault.getAbstractFileByPath(file)), file);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    if (restart) {
      assert.deepEqual((await state()).document,
        JSON.parse(fs.readFileSync(saved, "utf8")));
      checks.push("Fourteen field-value Buildings reopen byte-equivalent");
      return;
    }
    await chooseTool("Raum");
    await page.getByRole("button", { name: "Keine Wand", exact: true }).click();
    const rows = [];
    for (const original of reference.rows) {
      if (original.kind === "wall" && original.index === 0)
        await page.getByRole("button", { name: "Battlements", exact: true }).click();
      const label = original.kind === "floor" ? "Bodenfarbe" : "Wandfarbe";
      await page.getByRole("button", { name: label + " RGBA", exact: true }).click();
      const input = page.getByRole("textbox", { name: label + " Hex ARGB" });
      await input.fill(original.startArgb);
      await page.getByRole("button", { name: "Accept", exact: true }).click();
      await page.getByRole("button", { name: label + " RGBA", exact: true }).click();
      const before = await input.inputValue();
      const field = page.locator(".dn-building-color-field");
      const box = await field.boundingBox();
      assert(box);
      await page.mouse.click(box.x + box.width * original.fraction[0],
        box.y + box.height * original.fraction[1]);
      const after = await input.inputValue();
      await page.screenshot({ path: path.join(out,
        original.kind + "-" + original.index + "-field.png") });
      await page.getByRole("button", { name: "Accept", exact: true }).click();
      // The fitted 8x8 map begins four screen pixels left of the canvas.
      const col = 1 + (original.index % 4) * 2;
      const row = (original.kind === "floor" ? 0 : 4) +
        Math.floor(original.index / 4) * 2;
      await draw({ x: col, y: row }, { x: col + 1, y: row + 1 }, rows.length + 1);
      const building = (await state()).document.entities.at(-1);
      const stored = original.kind === "floor" ? building.fill : building.wall;
      const expected = parseInt(original.observedHex, 16);
      rows.push({ kind: original.kind, index: original.index,
        originalHex: original.observedHex, before, after, stored,
        expected, equal: before === original.startArgb.slice(2) &&
          after === original.observedHex && stored === expected,
        fieldBox: box, fraction: original.fraction, cell: [col, row] });
    }
    fs.writeFileSync(path.join(out, "field-matrix.json"),
      JSON.stringify({ referencePath, rows }, null, 2));
    assert(rows.every(item => item.equal), "Field matrix differs from Original; see field-matrix.json");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    fs.writeFileSync(saved, JSON.stringify((await state()).document));
    checks.push("Fourteen direct Building field clicks match native displayed Hex and stored RGB");
  }
  async function floorGallery24(restart) {
    const file = "Dungeons/Parity/Floor-Gallery-24.dungeon";
    const saved = path.join(qa, "parity-phase3-floor-gallery-24-saved.json");
    const names = [
      "tileset_wood_vertical", "tileset_stone", "tileset_brick_running",
      "tileset_brick_worn", "tileset_concrete_large", "tileset_brick_basketweave",
      "tileset_diamond", "tileset_concrete_slab", "tileset_carpet",
      "tileset_cave", "tileset_diamond_2", "tileset_concrete",
      "tileset_straw", "tileset_cobble", "tileset_cut_stone",
      "tileset_plank_45", "tileset_wood_damaged", "tileset_ornate",
      "tileset_sewers", "tileset_herringbone", "tileset_roman_worn",
      "tileset_roman_tiles", "tileset_wood_interlaced", "tileset_worn_cobble",
    ];
    if (!restart) {
      await page.evaluate(async ({ file, pckPath }) => {
        const plugin = app.plugins.getPlugin("dungeon-editor");
        await plugin.useNativeAssetArchive(pckPath);
        await app.vault.createFolder("Dungeons/Parity").catch(() => {});
        await app.vault.create(file, JSON.stringify({
          format: "dungeon-map", version: 3, id: "phase3-floor-gallery-24",
          settings: { name: "Floor Gallery 24", width: 18, height: 12,
            feetPerField: 5, assetPacks: [], builtInAssets: true,
            wallShadows: false, objectShadows: false, buildingWear: 0 },
          floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0, ambient: 1 }],
          entities: [], content: { definitions: [], occurrences: [], routes: [], archive: [] },
        }));
      }, { file, pckPath });
    }
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(
      app.vault.getAbstractFileByPath(file)), file);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    if (restart) {
      const expected = JSON.parse(fs.readFileSync(saved, "utf8"));
      const actual = (await state()).document;
      assert.deepEqual(actual, expected);
      assert.equal(actual.entities.length, 24);
      await page.screenshot({ path: path.join(out, "gallery24-reopen.png") });
      checks.push("All 24 UI-chosen floor styles and colors reopen byte-equivalent");
      return;
    }
    await chooseTool("Raum");
    await page.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "Keine Wand", exact: true }).click();
    const catalog = await page.evaluate(() => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      return plugin.listAssets([], true)
        .filter(asset => asset.kind === "tileset")
        .map(asset => ({ id: asset.id, name: asset.name, image: asset.files.image,
          color: plugin.nativePathCatalog.floors.find(
            style => style.files.image === asset.files.image)?.color }));
    });
    const rows = [];
    for (let index = 0; index < names.length; index++) {
      const asset = catalog.find(item => item.image?.endsWith("/" + names[index] + ".png"));
      assert(asset, "Bodenstil fehlt: " + names[index]);
      const gallery = page.getByRole("group", { name: "Bodenstil" });
      await gallery.getByRole("button", { name: asset.name, exact: true }).click();
      assert.equal(await gallery.getByRole("button", {
        name: asset.name, exact: true }).getAttribute("aria-pressed"), "true");
      const x = index % 6 * 3, y = Math.floor(index / 6) * 3;
      await draw({ x, y }, { x: x + 2, y: y + 2 }, index + 1);
      const building = (await state()).document.entities[index];
      assert.equal(building.material.assetId, asset.id);
      assert.equal(building.fill, Number.parseInt(asset.color, 16));
      assert.equal(building.floorAlpha, 255);
      assert.equal(building.wallWidth, 0);
      rows.push({ index, image: asset.image, color: asset.color,
        storedColor: building.fill.toString(16).padStart(6, "0") });
      await page.screenshot({ path: path.join(out,
        "gallery24-" + String(index).padStart(2, "0") + ".png") });
    }
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    const document = (await state()).document;
    fs.writeFileSync(saved, JSON.stringify(document));
    fs.writeFileSync(path.join(out, "gallery24.json"), JSON.stringify(rows, null, 2));
    checks.push("All 24 floor styles were chosen through the Host gallery and drawn separately");
  }
  async function wallGallery10(restart) {
    const file = "Dungeons/Parity/Wall-Gallery-10.dungeon";
    const saved = path.join(qa, "parity-phase3-wall-gallery-10-saved.json");
    const nativeMap = process.env.DUNGEON_WALL_GALLERY_NATIVE;
    assert(nativeMap, "DUNGEON_WALL_GALLERY_NATIVE is required");
    const native = JSON.parse(fs.readFileSync(nativeMap, "utf8"));
    const reference = native.world.levels["0"].walls.map(wall => ({
      image: wall.texture, color: Number.parseInt(wall.color.slice(2), 16),
      alpha: Number.parseInt(wall.color.slice(0, 2), 16),
      bevel: wall.joint === 1, shadow: wall.shadow,
    }));
    assert.equal(reference.length, 10);
    assert.equal(new Set(reference.map(item => item.image)).size, 10);
    if (!restart) {
      await page.evaluate(async ({ file, pckPath }) => {
        const plugin = app.plugins.getPlugin("dungeon-editor");
        await plugin.useNativeAssetArchive(pckPath);
        await app.vault.createFolder("Dungeons/Parity").catch(() => {});
        await app.vault.create(file, JSON.stringify({
          format: "dungeon-map", version: 3, id: "phase3-wall-gallery-10",
          settings: { name: "Wall Gallery 10", width: 18, height: 12,
            feetPerField: 5, assetPacks: [], builtInAssets: true,
            wallShadows: true, objectShadows: false, buildingWear: 0 },
          floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0,
            ambient: 1 }],
          entities: [], content: { definitions: [], occurrences: [],
            routes: [], archive: [] },
        }));
      }, { file, pckPath });
    }
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(
      app.vault.getAbstractFileByPath(file)), file);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    if (restart) {
      const expected = JSON.parse(fs.readFileSync(saved, "utf8"));
      assert.deepEqual((await state()).document, expected);
      await page.getByRole("button", { name: "Raster", exact: true }).click();
      await page.screenshot({ path: path.join(out, "wall-gallery10-reopen.png") });
      checks.push("Ten UI-chosen built-in wall styles reopen byte-equivalent");
      return;
    }
    await chooseTool("Raum");
    const catalog = await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").listAssets([], true)
        .filter(asset => asset.kind === "wall")
        .map(asset => ({ id: asset.id, name: asset.name,
          image: asset.files.image })));
    const gallery = page.getByRole("group", { name: "Wandstil" });
    const rows = [];
    for (let index = 0; index < reference.length; index++) {
      const item = reference[index];
      const asset = catalog.find(candidate => candidate.image === item.image);
      assert(asset, "Wandstil fehlt: " + item.image);
      await gallery.getByRole("button", { name: asset.name, exact: true }).click();
      assert.equal(await gallery.getByRole("button", {
        name: asset.name, exact: true }).getAttribute("aria-pressed"), "true");
      const x = index % 6 * 3, y = Math.floor(index / 6) * 3;
      await draw({ x, y }, { x: x + 2, y: y + 2 }, index + 1);
      const building = (await state()).document.entities[index];
      assert.equal(building.wallAssetId, asset.id);
      assert.equal(building.wall, item.color);
      assert.equal(building.wallAlpha, item.alpha);
      assert.equal(building.wallBevel, item.bevel);
      assert.equal(building.wallWidth, .2);
      assert.equal(building.fill, 0xb28f6f);
      rows.push({ index, image: item.image, nativeColor: item.color,
        hostWall: building.wall, hostAssetId: building.wallAssetId });
      await page.screenshot({ path: path.join(out,
        "wall-gallery10-" + String(index).padStart(2, "0") + ".png") });
    }
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    fs.writeFileSync(saved, JSON.stringify((await state()).document));
    fs.writeFileSync(path.join(out, "wall-gallery10.json"),
      JSON.stringify(rows, null, 2));
    await page.getByRole("button", { name: "Raster", exact: true }).click();
    await page.screenshot({ path: path.join(out, "wall-gallery10-grid-off.png") });
    checks.push("Ten native built-in wall paths and colors were selected and drawn through the Host gallery");
  }
  async function floorTintMatrix(restart) {
    const file = "Dungeons/Parity/Floor-Tint-Matrix.dungeon";
    const saved = path.join(qa, "parity-phase3-floor-tint-matrix-saved.json");
    const nativeMap = process.env.DUNGEON_FLOOR_TINT_NATIVE;
    assert(nativeMap, "DUNGEON_FLOOR_TINT_NATIVE is required");
    const native = JSON.parse(fs.readFileSync(nativeMap, "utf8"));
    const tiles = native.world.levels["0"].tiles;
    const ids = (tiles.cells.match(/-?\d+/g) ?? []).map(Number);
    const reference = Array.from({ length: 18 }, (_, index) => {
      const x = index % 6 * 3, y = Math.floor(index / 6) * 3;
      const cell = y * 18 + x, argb = tiles.colors[cell];
      return { index, x, y, argb,
        image: tiles.lookup[String(ids[cell])] };
    });
    assert(reference.slice(0, 9).every(item =>
      item.image === "res://textures/tilesets/smart/tileset_wood_vertical.png"));
    assert(reference.slice(9).every(item =>
      item.image === "res://textures/tilesets/simple/tileset_diamond_2.png"));
    if (!restart) {
      await page.evaluate(async ({ file, pckPath, reference }) => {
        const plugin = app.plugins.getPlugin("dungeon-editor");
        await plugin.useNativeAssetArchive(pckPath);
        await app.vault.createFolder("Dungeons/Parity").catch(() => {});
        const entities = reference.map(item => {
          const fill = Number.parseInt(item.argb.slice(2), 16);
          return {
            id: `tint-${item.index}`, kind: "building", floorId: "floor-1",
            polygons: [{ outer: [
              { x: item.x, y: item.y }, { x: item.x + 2, y: item.y },
              { x: item.x + 2, y: item.y + 2 }, { x: item.x, y: item.y + 2 },
            ], holes: [] }],
            layer: 200, fill,
            floorAlpha: Number.parseInt(item.argb.slice(0, 2), 16),
            wall: 0xffffff, wallAlpha: 255, wallWidth: 0,
            material: { assetId: "pack:dungeondraft-builtin-1.2.0.1:tileset:" +
              encodeURIComponent(item.image), assetPart: "image",
              tileSize: 4, tint: fill, rotation: 0 },
          };
        });
        await app.vault.create(file, JSON.stringify({
          format: "dungeon-map", version: 3, id: "phase3-floor-tint-matrix",
          settings: { name: "Floor Tint Matrix", width: 18, height: 12,
            feetPerField: 5, assetPacks: [], builtInAssets: true,
            wallShadows: false, objectShadows: false, buildingWear: 0 },
          floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0,
            ambient: 1 }],
          entities, content: { definitions: [], occurrences: [],
            routes: [], archive: [] },
        }));
      }, { file, pckPath, reference });
    }
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(
      app.vault.getAbstractFileByPath(file)), file);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await page.waitForFunction(() => {
      const visuals = app.workspace.activeLeaf.view.editor.renderer.visuals;
      return visuals.size === 18 && [...visuals.values()]
        .every(visual => !!visual.floorLayer);
    }, null, { timeout: 30000 });
    const document = (await state()).document;
    assert.equal(document.entities.length, 18);
    for (const item of reference) {
      const entity = document.entities[item.index];
      assert.equal(entity.fill, Number.parseInt(item.argb.slice(2), 16));
      assert.equal(entity.floorAlpha,
        Number.parseInt(item.argb.slice(0, 2), 16));
      assert(entity.material.assetId.includes(encodeURIComponent(item.image)));
    }
    if (restart)
      assert.deepEqual(document, JSON.parse(fs.readFileSync(saved, "utf8")));
    else fs.writeFileSync(saved, JSON.stringify(document));
    await page.getByRole("button", { name: "Raster", exact: true }).click();
    const renderedSamples = [];
    for (let index = 0; index < 18; index++) {
      const point = await world({ x: index % 6 * 3 + 1,
        y: Math.floor(index / 6) * 3 + 1 });
      const sample = await page.evaluate(point => {
        const renderer = app.workspace.activeLeaf.view.editor.renderer;
        return renderer.sampleRenderedPixel(renderer.local({
          clientX: point.x, clientY: point.y }));
      }, point);
      if (index % 3 === 0) assert.equal(sample.color, 0x252525);
      renderedSamples.push({ index, point, color: sample.color });
    }
    const shot = PNG.sync.read(await page.screenshot({
      path: path.join(out, "floor-tint-grid-off.png") }));
    for (const item of renderedSamples) {
      const offset = (Math.floor(item.point.y) * shot.width +
        Math.floor(item.point.x)) * 4;
      item.pngRgb = [...shot.data.slice(offset, offset + 3)];
    }
    fs.writeFileSync(path.join(out, "floor-tint-rendered-samples.json"),
      JSON.stringify(renderedSamples, null, 2));
    await page.evaluate(() => {
      const renderer = app.workspace.activeLeaf.view.editor.renderer;
      for (const visual of renderer.visuals.values())
        visual.floorLayer.visible = false;
      renderer.invalidate();
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, "floor-tint-background.png") });
    checks.push("Eighteen exact native Wood/Diamond 2 ARGB values render with a separate background sample" +
      (restart ? " after fresh reopen" : ""));
  }
  async function galleryPipette() {
    const file = "Dungeons/Parity/Floor-Gallery-24.dungeon";
    await page.evaluate(async ({ file, pckPath }) => {
      await app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pckPath);
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(file));
    }, { file, pckPath });
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await chooseTool("Raum");
    const rows = [];
    for (const kind of ["floor", "wall"])
      for (const sample of [
        { name: "concrete", point: { x: 3 + 12 / 32, y: 3 + 12 / 32 } },
        { name: "wood", point: { x: 17 / 32, y: 21 / 32 } },
        { name: "concrete-edge", point: { x: 3 + 15 / 32, y: 3 + 13 / 32 } },
        { name: "wood-edge", point: { x: 18 / 32, y: 21 / 32 } },
      ]) {
        const label = kind === "floor" ? "Bodenfarbe" : "Wandfarbe";
        const at = await world(sample.point);
        const shot = PNG.sync.read(await page.screenshot());
        const offset = (Math.floor(at.y) * shot.width + Math.floor(at.x)) * 4;
        const screenshotRgb = [shot.data[offset], shot.data[offset + 1],
          shot.data[offset + 2]].map(value => value.toString(16).padStart(2, "0")).join("");
        const rendered = await page.evaluate(point => {
          const renderer = app.workspace.activeLeaf.view.editor.renderer;
          const local = renderer.local({ clientX: point.x, clientY: point.y });
          return { at: renderer.sampleRenderedPixel(local),
            above: renderer.sampleRenderedPixel({ x: local.x, y: local.y - 1 }) };
        }, at);
        await page.getByRole("button", { name: label + " RGBA", exact: true }).click();
        await page.getByRole("button", { name: "Pipette", exact: true }).click();
        await page.mouse.click(at.x, at.y);
        const pickerHex = await page.getByRole("textbox", {
          name: label + " Hex ARGB" }).inputValue();
        assert.equal(pickerHex,
          rendered.above.color.toString(16).padStart(6, "0"));
        if (sample.name === "concrete" || sample.name === "concrete-edge")
          assert.equal(pickerHex, "7f7d79");
        if (sample.name === "wood") assert.equal(pickerHex, "937457");
        await page.screenshot({ path: path.join(out,
          `gallery-pipette-${kind}-${sample.name}.png`) });
        rows.push({ kind, sample: sample.name, point: sample.point,
          screen: at, screenshotRgb, rendered, pickerHex });
        await page.getByRole("button", { name: "Accept", exact: true }).click();
      }
    fs.writeFileSync(path.join(out, "gallery-pipette.json"),
      JSON.stringify(rows, null, 2));
    checks.push("Floor and Wall eyedroppers sampled concrete and wood UI pixels");
  }
  async function sameCard(restart) {
    const file = "Dungeons/Parity/Native-Options-Card.dungeon",
      saved = path.join(qa, "parity-phase3-native-options-card-saved.json");
    assert.equal(hash(fs.readFileSync(pckPath)),
      "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60");
    await page.evaluate(async ({ file, pckPath, restart }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.useNativeAssetArchive(pckPath);
      if (!restart) {
        await app.vault.createFolder("Dungeons/Parity").catch(() => {});
        await app.vault.create(file, JSON.stringify({
          format: "dungeon-map", version: 3, id: "native-options-card",
          settings: { name: "Native Options Card", width: 18, height: 12,
            feetPerField: 5, assetPacks: [], builtInAssets: true,
            wallShadows: true, objectShadows: false, buildingWear: 0 },
          floors: [{ id: "floor-1", name: "Erdgeschoss", elevation: 0,
            ambient: 1 }],
          entities: [], content: { definitions: [], occurrences: [],
            routes: [], archive: [] },
        }));
      }
      await app.workspace.getLeaf(false).openFile(
        app.vault.getAbstractFileByPath(file));
    }, { file, pckPath, restart });
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    if (restart) {
      const expected = JSON.parse(fs.readFileSync(saved, "utf8")),
        actual = (await state()).document;
      assert.deepEqual(actual, expected);
      assert.equal(actual.entities.filter(entity => entity.kind === "building").length, 9);
      assert.equal(actual.entities.filter(entity => entity.kind === "door").length, 1);
      await page.screenshot({ path: path.join(out, "fresh-options-card.png") });
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.getByRole("button", { name: "Raster", exact: true }).click();
      await page.evaluate(() => {
        const renderer = app.workspace.activeLeaf.view.editor.renderer,
          box = renderer.canvas.getBoundingClientRect();
        renderer.camera.scale = 64;
        renderer.camera.x = box.width / 2 - 9 * 64;
        renderer.camera.y = box.height / 2 - 6 * 64;
        renderer.zoom(1);
      });
      await page.screenshot({ path: path.join(out, "fresh-options-card-64px-grid-off.png") });
      checks.push("The original nine-option card and bound door survive a fresh Host process");
      return;
    }
    const assets = await page.evaluate(() => app.plugins
      .getPlugin("dungeon-editor").listAssets([], true)
      .filter(asset => asset.kind === "tileset" || asset.kind === "wall")
      .map(({ id, kind, name, files }) => ({ id, kind, name,
        image: files.image })));
    fs.writeFileSync(path.join(out, "native-gallery.json"),
      JSON.stringify(assets, null, 2));
    const pick = async (kind, suffix) => {
      const asset = assets.find(item => item.kind === kind &&
        item.image?.endsWith("/" + suffix + ".png"));
      assert(asset, "Native style missing: " + suffix);
      const gallery = page.getByRole("group", {
        name: kind === "tileset" ? "Bodenstil" : "Wandstil" });
      await gallery.getByRole("button", { name: asset.name, exact: true }).click();
      assert.equal(await gallery.getByRole("button", {
        name: asset.name, exact: true }).getAttribute("aria-pressed"), "true");
      return asset;
    };
    const setHex = async (kind, hex) => {
      const label = kind === "floor" ? "Bodenfarbe" : "Wandfarbe";
      await page.getByRole("button", { name: label + " RGBA", exact: true }).click();
      await page.getByRole("textbox", { name: label + " Hex ARGB" }).fill(hex);
      await page.getByRole("button", { name: "Accept", exact: true }).click();
    };
    const capture = async name => {
      const current = await state();
      fs.writeFileSync(path.join(out, name + ".json"),
        JSON.stringify(current, null, 2));
      await page.screenshot({ path: path.join(out, name + ".png") });
      return current;
    };
    await chooseTool("Raum");
    const slots = [
      { floor: "tileset_wood_vertical", wall: "battlements",
        fill: "b28f6f", tint: "726e65", a: [7, 2], b: [9, 4] },
      { floor: "tileset_stone", wall: null,
        fill: "7f7e71", a: [11, 2], b: [13, 4] },
      { floor: "tileset_brick_running", wall: "cobble",
        fill: "965f50", tint: "7c7c7c", a: [15, 2], b: [17, 4] },
      { floor: "tileset_diamond_2", wall: "cobble",
        fill: "80ff0000", tint: "7c7c7c", bevel: false,
        a: [7, 6], b: [9, 8] },
      { floor: "tileset_carpet", wall: "wood_03",
        fill: "7993ab", tint: "80445566", bevel: true,
        a: [11, 6], b: [13, 8] },
      { floor: "tileset_wood_vertical", wall: "wood_04",
        fill: "b28f6f", tint: "705e4b", a: [15, 6], b: [17, 8] },
      { floor: "tileset_wood_vertical", wall: "wood_04",
        fill: "b28f6f", tint: "705e4b", a: [7, 10], b: [9, 12] },
      { floor: "tileset_stone", wall: "wood_04",
        fill: "7f7e71", tint: "705e4b", a: [11, 10], b: [13, 12] },
      { floor: "tileset_stone", wall: "wood_04",
        fill: "7f7e71", tint: "705e4b", a: [15, 10], b: [17, 12] },
    ];
    for (let index = 0; index < 7; index++) {
      const item = slots[index];
      const floor = await pick("tileset", item.floor);
      const wall = item.wall ? await pick("wall", item.wall) : null;
      if (!wall)
        await page.getByRole("group", { name: "Wandstil" })
          .getByRole("button", { name: "Keine Wand", exact: true }).click();
      await setHex("floor", item.fill);
      if (item.tint) await setHex("wall", item.tint);
      if (item.bevel === false)
        await page.getByRole("checkbox", { name: "Bevel Corners" }).uncheck();
      if (item.bevel === true)
        await page.getByRole("checkbox", { name: "Bevel Corners" }).check();
      await draw({ x: item.a[0], y: item.a[1] },
        { x: item.b[0], y: item.b[1] }, index + 1);
      const current = await capture(String(index + 1).padStart(2, "0") + "-room");
      const building = current.document.entities[index];
      assert.equal(building.material.assetId, floor.id);
      assert.equal(building.wallWidth > 0, !!wall);
      if (wall) assert.equal(building.wallAssetId, wall.id);
      if (index === 1) {
        assert.equal(current.document.entities.filter(e => e.kind === "building").length, 2);
        assert.equal(current.document.entities.filter(e => e.kind === "building" &&
          e.wallWidth > 0).length, 1);
        checks.push("Original room 2 uses the selected Smart Stone and X/None controls");
      }
    }
    const beforeErase = await capture("08-before-erase");
    const room2 = beforeErase.document.entities[1], room7 = beforeErase.document.entities[6];
    const from = await world({ x: 7, y: 10 }),
      to = await world({ x: 8, y: 11 });
    await page.keyboard.down("Alt");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    await page.waitForFunction(history => {
      const editor = app.workspace.activeLeaf?.view?.editor;
      return editor && !editor.paintWorker && editor.session.historySize === history + 1;
    }, beforeErase.history, { timeout: 45000 });
    const erased = await capture("09-after-erase");
    assert.equal(erased.document.entities.length, 7);
    assert.equal(erased.document.entities[1].wallAssetId,
      erased.document.entities[6].wallAssetId);
    assert.equal(erased.document.entities[1].wall, 0x705e4b);
    assert.equal(erased.document.entities[1].wallWidth, 0.2);
    assert.equal(erased.document.entities[1].fill, room2.fill);
    assert.equal(erased.document.entities[6].polygons[0].outer.length, 6);
    for (const index of [0, 2, 3, 4, 5])
      assert.deepEqual(erased.document.entities[index], beforeErase.document.entities[index]);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    assert.deepEqual((await state()).document, beforeErase.document);
    await page.keyboard.press("Control+y");
    assert.deepEqual((await state()).document, erased.document);
    checks.push("One Alt erase revives X/None room 2 and restyles room 7 in one undoable command");
    for (let index = 7; index < 9; index++) {
      const item = slots[index];
      await pick("tileset", item.floor);
      await pick("wall", item.wall);
      await setHex("floor", item.fill);
      await setHex("wall", item.tint);
      if (index === 7) {
        await chooseTool("Ellipsenraum");
        await draw({ x: item.a[0], y: item.a[1] },
          { x: item.b[0], y: item.b[1] }, 8);
        assert.equal((await state()).document.entities[7].polygons[0].outer.length, 28);
      } else {
        await chooseTool("Polygonraum");
        for (const point of [[15, 10], [17, 10], [17, 12]]) {
          const at = await world({ x: point[0], y: point[1] });
          await page.mouse.click(at.x, at.y);
        }
        const last = await world({ x: 15, y: 12 });
        await page.mouse.dblclick(last.x, last.y, { delay: 90 });
        await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor
          ?.session.entities.size === 9, null, { timeout: 45000 });
      }
      await capture(String(index + 3).padStart(2, "0") + "-shape");
    }
    await chooseTool("Tür");
    const doorAsset = await page.evaluate(() => app.plugins
      .getPlugin("dungeon-editor").listAssets([], true)
      .find(asset => asset.kind === "portal" &&
        asset.files.image?.endsWith("/door_00.png"))?.id);
    assert(doorAsset);
    await page.getByRole("combobox", { name: "Paketportal" })
      .selectOption(doorAsset);
    const portal = await world({ x: 9, y: 3 });
    await page.mouse.click(portal.x, portal.y);
    await page.waitForFunction(() => app.workspace.activeLeaf?.view?.editor
      ?.session.entities.size === 10, null, { timeout: 45000 });
    await capture("12-door");
    await chooseTool("Punkte");
    await page.getByRole("button", { name: "Snap", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Snap", exact: true })
      .getAttribute("aria-pressed"), "false");
    const lastBuilding = (await state()).document.entities[8];
    await page.evaluate(async id => {
      await app.workspace.activeLeaf.view.editor.select(id);
    }, lastBuilding.id);
    const oldPoint = await world({ x: 17, y: 10 }),
      newPoint = await world({ x: 17.5, y: 9.5 });
    await page.mouse.move(oldPoint.x + 10, oldPoint.y + 10);
    await page.mouse.move(oldPoint.x, oldPoint.y);
    await page.waitForFunction(() => {
      const hover = app.workspace.activeLeaf?.view?.editor?.renderer?.buildingPointHover;
      return hover?.kind === "vertex" && hover.contour === 0 && hover.index === 1;
    });
    await page.mouse.down();
    await page.mouse.move(newPoint.x, newPoint.y, { steps: 8 });
    await page.mouse.up();
    await capture("13-point-probe");
    await page.waitForFunction(id => app.workspace.activeLeaf?.view?.editor
      ?.session.entities.get(id)?.polygons[0].outer[1].x === 17.5,
    lastBuilding.id, { timeout: 45000 });
    const final = await capture("13-point-final");
    const door = final.document.entities.find(entity => entity.kind === "door");
    assert.equal(door.anchor.boundaryId, final.document.entities[0].id);
    assert.equal(door.assetId, doorAsset);
    assert.equal(final.document.entities[6].wallAssetId,
      final.document.entities[1].wallAssetId);
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Control+z");
    await capture("14-undo-point");
    await page.keyboard.press("Control+y");
    assert.deepEqual((await state()).document, final.document);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    const persisted = (await state()).document;
    fs.writeFileSync(saved, JSON.stringify(persisted, null, 2));
    await capture("15-saved");
    checks.push("All nine native positions, styles, colors, ellipse, polygon point and bound door persist");
  }
  return { edit, reopen, combined, verifyCombined, visualMatch, portalVisual,
    floorVariant, floorMosaic, pickerPair, fieldKnownStart, fieldMatrix, floorGallery24,
    wallGallery10, floorTintMatrix,
    galleryPipette, sameCard };
};
