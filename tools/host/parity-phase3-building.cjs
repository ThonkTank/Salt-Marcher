module.exports = ({ page, fs, path, assert, crypto, PNG, qa, vault, out, checks,
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
  return { edit, reopen, combined, verifyCombined, visualMatch,
    floorVariant, floorMosaic };
};
