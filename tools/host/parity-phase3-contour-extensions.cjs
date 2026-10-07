module.exports = ({ page, fs, path, assert, crypto, PNG, qa, out, checks,
  chooseTool }) => {
  const source = "/home/aaron/.cache/dungeon-native-qa/parity-phase3-bevel-matrix-aligned-20261008/vault/Dungeons/Parity/Bevel-QA-Ring-Off.dungeon";
  const pckPath = "/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64/Dungeondraft.pck";
  const packPath = "/home/aaron/.cache/dungeon-native-qa/parity-phase3-implementation-20261007/native-package/runs/20261007-025609-1253642/assets/qa-wall-pack.dungeondraft_pack";
  const prefix = "Dungeons/Parity/Contour-";
  const files = {
    bevel: prefix + "Bevel-Selected.dungeon",
    inner: prefix + "Inner-Point.dungeon",
    portal: prefix + "Portal-Erase.dungeon",
    minimum: prefix + "Minimum-Points.dungeon",
    multipart: prefix + "Multipart.dungeon",
  };
  const savedFile = path.join(qa, "parity-phase3-contour-extensions-saved.json");
  const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
  const state = () => page.evaluate(() => {
    const e = app.workspace.activeLeaf?.view?.editor;
    return { document: e.session.document(), history: e.session.historySize,
      dirty: e.session.dirty, selected: e.selected,
      hover: e.renderer.buildingPointHover,
      preview: e.renderer.buildingPreview && {
        id: e.renderer.buildingPreview.sourceId,
        wall: e.renderer.buildingPreview.entity.wallAssetId,
        sprites: e.renderer.buildingPreview.wallLayer.children.length } };
  });
  const world = point => page.evaluate(point => {
    const r = app.workspace.activeLeaf.view.editor.renderer,
      b = r.canvas.getBoundingClientRect();
    return { x: b.x + r.camera.x + point.x * r.camera.scale,
      y: b.y + r.camera.y + point.y * r.camera.scale };
  }, point);
  const buildings = doc => doc.entities.filter(e => e.kind === "building");
  const doors = doc => doc.entities.filter(e => e.kind === "door");
  async function open(file) {
    await page.evaluate(async file => app.workspace.getLeaf(false).openFile(
      app.vault.getAbstractFileByPath(file)), file);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  }
  async function select(id) {
    await page.evaluate(id => app.workspace.activeLeaf.view.editor.select(id), id);
    assert.equal((await state()).selected, id);
  }
  async function hover(point, contour, index) {
    const at = await world(point);
    await page.mouse.move(at.x + 15, at.y + 15);
    await page.mouse.move(at.x, at.y);
    await page.waitForFunction(({ contour, index }) => {
      const h = app.workspace.activeLeaf?.view?.editor?.renderer.buildingPointHover;
      return h?.kind === "vertex" && h.contour === contour && h.index === index;
    }, { contour, index });
  }
  async function movePoint(from, to, id, name) {
    const before = await state();
    const a = await world(from), b = await world(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.waitForFunction(id => app.workspace.activeLeaf?.view?.editor
      ?.renderer.buildingPreview?.sourceId === id, id);
    const held = await state();
    assert.deepEqual(held.document, before.document);
    assert.equal(held.history, before.history);
    assert(held.preview.sprites > 0);
    await page.screenshot({ path: path.join(out, name + "-held.png") });
    await page.mouse.up();
    assert.equal((await state()).history, before.history + 1);
    return { before, after: await state() };
  }
  async function rectangle(a, b) {
    const before = await state();
    const p = await world(a), q = await world(b);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(q.x, q.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(history => app.workspace.activeLeaf?.view?.editor
      ?.session.historySize === history + 1, before.history, { timeout: 45000 });
  }
  async function erase(a, b) {
    await page.keyboard.down("Alt");
    await rectangle(a, b);
    await page.keyboard.up("Alt");
  }
  async function undoRedo(before, after) {
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state()).document, before);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.deepEqual((await state()).document, after);
  }
  async function save(file, name, saved) {
    await page.screenshot({ path: path.join(out, name + "-edit.png") });
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(() => !app.workspace.activeLeaf.view.editor.session.dirty);
    const document = (await state()).document;
    const mapSha256 = hash(fs.readFileSync(path.join(qa, "vault", file)));
    saved.push({ file, name, document, mapSha256 });
    fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(document, null, 2));
  }
  async function edit() {
    const pack = fs.readFileSync(packPath);
    assert.equal(hash(pack),
      "eaad533f4da8880bf8c0339d9d6ae66dd3d8e1c1d60917288ab0a91242d51ad9");
    assert.equal(hash(fs.readFileSync(pckPath)),
      "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60");
    await page.evaluate(async ({ pckPath, pack }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.useNativeAssetArchive(pckPath);
      await plugin.assets.add([new Blob([Uint8Array.from(atob(pack),
        char => char.charCodeAt(0))])]);
      await plugin.reloadAssets();
    }, { pckPath, pack: pack.toString("base64") });
    const sourceBytes = fs.readFileSync(source);
    const sourceHash = hash(sourceBytes);
    assert.equal(sourceHash,
      "8c4c7602954818bc27b10e282cab0c05a624987a601fa86d65440c623b05431e");
    const map = JSON.parse(sourceBytes);
    const ring = buildings(map)[0], door = doors(map)[0];
    assert(ring && door && ring.wallAssetId.includes("QAWall01"));
    await page.evaluate(async ({ files, map }) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      for (const [name, file] of Object.entries(files)) {
        const next = structuredClone(map);
        next.id = file;
        next.settings.name = file.split("/").at(-1);
        if (name === "minimum" || name === "multipart") {
          next.settings.width = 8;
          next.settings.height = 8;
          next.entities = [];
        } else if (name === "bevel") {
          next.entities.find(e => e.kind === "building").wallBevel = true;
        } else if (name === "portal") {
          next.entities.find(e => e.kind === "building")
            .polygons[0].holes[0][0] = { x: 14, y: 6 };
        }
        await app.vault.create(file, JSON.stringify(next));
      }
    }, { files, map });
    const saved = [];

    await open(files.bevel);
    await chooseTool("Punkte");
    await select(ring.id);
    const bevelBefore = await state();
    await page.getByRole("checkbox", { name: "Bevel Corners" }).uncheck();
    assert.deepEqual((await state()).document, bevelBefore.document);
    await chooseTool("Raum");
    await page.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "Battlements", exact: true }).click();
    await rectangle({ x: 12, y: 1 }, { x: 14, y: 3 });
    const bevelAfter = (await state()).document;
    assert.equal(buildings(bevelAfter).find(e => e.id === ring.id).wallBevel, true);
    assert.equal(buildings(bevelAfter).find(e => e.id !== ring.id).wallBevel, false);
    await save(files.bevel, "selected-bevel-next-draw", saved);
    checks.push("Bevel toggle leaves the selected QAWall contour unchanged and applies to the next draw");

    await open(files.inner);
    await chooseTool("Punkte");
    await select(ring.id);
    await hover({ x: 13, y: 6 }, 1, 0);
    const inner = await movePoint({ x: 13, y: 6 }, { x: 14, y: 6 },
      ring.id, "inner-point");
    const innerBuilding = buildings(inner.after.document)[0];
    assert(innerBuilding.polygons[0].holes[0].some(p => p.x === 14 && p.y === 6));
    assert.equal(innerBuilding.wallAssetId, ring.wallAssetId);
    assert.equal(innerBuilding.wallBevel, false);
    assert.deepEqual(doors(inner.after.document), [door]);
    await undoRedo(inner.before.document, inner.after.document);
    await save(files.inner, "inner-point-moved", saved);
    checks.push("QAWall inner point moves with preview, retained door and one undo step");

    await open(files.portal);
    await chooseTool("Raum");
    await page.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "QA Wall", exact: true }).click();
    await page.getByRole("checkbox", { name: "Bevel Corners" }).uncheck();
    const portalBefore = (await state()).document;
    await erase({ x: 13, y: 8 }, { x: 15, y: 10 });
    const portalAfter = (await state()).document;
    assert.equal(doors(portalAfter).length, 0);
    assert.equal(buildings(portalAfter).length, 1);
    assert.equal(buildings(portalAfter)[0].wallAssetId, ring.wallAssetId);
    assert.equal(buildings(portalAfter)[0].wallBevel, false);
    await undoRedo(portalBefore, portalAfter);
    await save(files.portal, "portal-edge-erased", saved);
    checks.push("Alt erase removes QAWall portal edge and its bound door atomically");

    await open(files.minimum);
    await chooseTool("Raum");
    await page.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "QA Wall", exact: true }).click();
    await page.getByRole("checkbox", { name: "Bevel Corners" }).check();
    await rectangle({ x: 1, y: 1 }, { x: 3, y: 3 });
    const four = (await state()).document, square = buildings(four)[0];
    fs.writeFileSync(path.join(out, "four-points.json"), JSON.stringify(four, null, 2));
    await chooseTool("Punkte");
    await select(square.id);
    const vertices = square.polygons[0].outer;
    await hover(vertices[vertices.findIndex(p => p.x === 3 && p.y === 1)], 0,
      vertices.findIndex(p => p.x === 3 && p.y === 1));
    await page.locator(".dn-canvas canvas").focus();
    await page.keyboard.press("Delete");
    const three = (await state()).document;
    fs.writeFileSync(path.join(out, "three-points.json"), JSON.stringify(three, null, 2));
    assert.equal(buildings(three)[0].polygons[0].outer.length, 3);
    assert.equal(buildings(three)[0].wallAssetId, ring.wallAssetId);
    assert.equal(buildings(three)[0].wallBevel, true);
    const remaining = buildings(three)[0].polygons[0].outer[0];
    await hover(remaining, 0, 0);
    await page.keyboard.press("Delete");
    const zero = (await state()).document;
    assert.equal(buildings(zero).length, 0);
    await undoRedo(three, zero);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state()).document, three);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    assert.deepEqual((await state()).document, four);
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
    assert.deepEqual((await state()).document, zero);
    await save(files.minimum, "four-three-zero", saved);
    checks.push("Unnumbered QAWall rectangle goes from four to three to zero points with undo and redo");

    await open(files.multipart);
    await chooseTool("Raum");
    await page.getByRole("group", { name: "Wandstil" })
      .getByRole("button", { name: "QA Wall", exact: true }).click();
    await page.getByRole("checkbox", { name: "Bevel Corners" }).check();
    await rectangle({ x: 1, y: 4 }, { x: 7, y: 7 });
    const whole = (await state()).document;
    await erase({ x: 3, y: 4 }, { x: 4, y: 7 });
    const split = (await state()).document;
    assert.equal(buildings(split).flatMap(e => e.polygons).length, 2);
    assert(buildings(split).every(e => e.wallAssetId === ring.wallAssetId));
    assert(buildings(split).every(e => e.wallBevel === true));
    await undoRedo(whole, split);
    const right = buildings(split).find(e => e.polygons.some(poly =>
      poly.outer.some(p => p.x === 7 && p.y === 4)));
    await chooseTool("Punkte");
    await select(right.id);
    const contour = right.polygons.findIndex(poly =>
      poly.outer.some(p => p.x === 7 && p.y === 4));
    const index = right.polygons[contour].outer.findIndex(p => p.x === 7 && p.y === 4);
    await hover({ x: 7, y: 4 }, contour, index);
    const moved = await movePoint({ x: 7, y: 4 }, { x: 6, y: 4 },
      right.id, "multipart-right-point");
    assert(buildings(moved.after.document).some(e => e.polygons.some(poly =>
      poly.outer.some(p => p.x === 6 && p.y === 4))));
    assert(buildings(moved.after.document).every(e => e.wallAssetId === ring.wallAssetId));
    await undoRedo(moved.before.document, moved.after.document);
    await save(files.multipart, "multipart-right-moved", saved);
    const sample = await world({ x: 6.3, y: 5.9 });
    const screenshot = PNG.sync.read(fs.readFileSync(path.join(out,
      "multipart-right-moved-edit.png")));
    const pixel = 4 * (Math.round(sample.y) * screenshot.width + Math.round(sample.x));
    const rgb = [...screenshot.data.subarray(pixel, pixel + 3)];
    fs.writeFileSync(path.join(out, "multipart-floor-edge-pixel.json"),
      JSON.stringify({ world: { x: 6.3, y: 5.9 }, screen: sample, rgb }, null, 2));
    assert(rgb[0] > 55 && rgb[1] > 35 && rgb[2] > 20,
      "Partial diagonal floor cell must contain the wood texture");
    checks.push("Alt split preserves both QA wall parts and moves only the selected right point");

    fs.writeFileSync(savedFile, JSON.stringify({ sourceHash, saved }, null, 2));
  }
  async function reopen() {
    const { saved } = JSON.parse(fs.readFileSync(savedFile));
    for (const entry of saved) {
      assert.equal(hash(fs.readFileSync(path.join(qa, "vault", entry.file))), entry.mapSha256);
      await open(entry.file);
      assert.deepEqual((await state()).document, entry.document);
      await page.screenshot({ path: path.join(out, entry.name + "-fresh.png") });
      checks.push(entry.name + " survives fresh Host opening");
    }
  }
  return { edit, reopen };
};
