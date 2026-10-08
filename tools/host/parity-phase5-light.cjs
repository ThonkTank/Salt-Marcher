const MAP = "Dungeons/Parity/Object-Light-Repair.dungeon";
const PCK = "/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64/Dungeondraft.pck";
const PCK_SHA = "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60";
const OBJECT_ID = "phase5-light-globe";
const ASSET_ID = "pack:dungeondraft-builtin-1.2.0.1:object:res%3A%2F%2Ftextures%2Fobjects%2Factivities%2Fadministration%2Fatlas_globe_01.png";

module.exports = ({ page, fs, path, assert, crypto, PNG, vault, out, checks, chooseTool, sleep, waitForFileAbsent }) => {
  const worldPoint = (x, y) => page.evaluate(({ x, y }) => {
    const r = app.workspace.activeLeaf.view.editor.renderer;
    const b = r.canvas.getBoundingClientRect();
    return { x: Math.round(b.x + r.camera.x + x * r.camera.scale),
      y: Math.round(b.y + r.camera.y + y * r.camera.scale) };
  }, { x, y });
  const settleLight = async () => {
    await page.evaluate(async () => {
      const r = app.workspace.activeLeaf.view.editor.renderer;
      await Promise.all([...r.pendingLights]);
    });
    await sleep(150);
  };
  const shot = async (name) => {
    await settleLight();
    await page.mouse.move(12, 12);
    const behind = await worldPoint(5.25, 4);
    const flank = await worldPoint(5.25, 2.75);
    const file = path.join(out, name + ".png");
    const png = PNG.sync.read(await page.screenshot({ path: file }));
    const pixel = ({ x, y }) => {
      const index = (y * png.width + x) * 4;
      return [...png.data.subarray(index, index + 3)];
    };
    return { behind: pixel(behind), flank: pixel(flank), behindAt: behind,
      flankAt: flank, width: png.width, height: png.height };
  };
  const brightness = (rgb) => rgb.reduce((sum, value) => sum + value, 0) / 3;
  const open = async () => {
    await page.evaluate(async (name) =>
      app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(name)), MAP);
    await page.locator(".dn-canvas canvas").waitFor({ state: "visible", timeout: 60000 });
    await chooseTool("Auswahl");
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  };
  const object = () => page.evaluate(() => app.workspace.activeLeaf.view.editor
    .session.entities.get("phase5-light-globe"));
  async function edit() {
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(PCK)).digest("hex"), PCK_SHA);
    await page.evaluate(async (pck) =>
      app.plugins.getPlugin("dungeon-editor").useNativeAssetArchive(pck), PCK);
    await page.evaluate(async ({ name, assetId, objectId }) => {
      await app.vault.createFolder("Dungeons/Parity").catch(() => {});
      await app.vault.create(name, JSON.stringify({
        format: "dungeon-map", version: 3, id: "parity-phase5-repair-light",
        settings: { name: "Object Light Repair", width: 8, height: 8,
          feetPerField: 5, assetPacks: [], builtInAssets: true,
          wallShadows: true, objectShadows: true, buildingWear: 0 },
        floors: [{ id: "floor-1", name: "Ground", elevation: 0,
          ambient: 0.125 }],
        entities: [
          { id: objectId, kind: "object", floorId: "floor-1", x: 4, y: 4,
            rotation: 0, width: 1.01953125, height: 1.03125,
            color: 0xffffff, alpha: 255, label: "", layer: 100,
            shadow: false, blocksLight: false, assetId },
          { id: "phase5-light-source", kind: "light", floorId: "floor-1",
            x: 2, y: 4, radius: 5, intensity: 1, color: 0xeccd8b,
            shadows: true },
        ],
        content: { definitions: [], occurrences: [], routes: [], archive: [] },
      }, null, 2));
    }, { name: MAP, assetId: ASSET_ID, objectId: OBJECT_ID });
    await open();
    const off = await shot("light-off");
    const center = await worldPoint(4, 4);
    await page.mouse.click(center.x, center.y);
    await page.getByRole("checkbox", { name: "Blockiert Licht" }).check();
    assert.equal((await object()).blocksLight, true);
    const on = await shot("light-on");
    assert.ok(brightness(on.behind) < brightness(off.behind) - 5,
      `Shadow behind object: ${JSON.stringify({ off, on })}`);
    assert.ok(Math.abs(brightness(on.flank) - brightness(off.flank)) < 12,
      `Flank stays lit: ${JSON.stringify({ off, on })}`);
    await page.getByRole("checkbox", { name: "Schatten" }).check();
    const shadowOn = await shot("object-shadow-on");
    assert.ok(brightness(shadowOn.behind) < brightness(off.behind) - 5);
    await page.getByRole("checkbox", { name: "Blockiert Licht" }).uncheck();
    assert.equal((await object()).blocksLight, false);
    const offAgain = await shot("light-off-again");
    assert.ok(Math.abs(brightness(offAgain.behind) - brightness(off.behind)) < 12,
      `Turning Block Light off restores illumination: ${JSON.stringify({ off, offAgain })}`);
    await page.getByRole("checkbox", { name: "Blockiert Licht" }).check();
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    let saved;
    for (let attempt = 0; attempt < 100; attempt++) {
      saved = JSON.parse(fs.readFileSync(path.join(vault, MAP)));
      if (saved.entities[0].blocksLight === true) break;
      await sleep(50);
    }
    assert.equal(saved.entities[0].blocksLight, true);
    await waitForFileAbsent(path.join(vault, MAP + ".draft"));
    fs.writeFileSync(path.join(out, "light-pixels.json"), JSON.stringify({
      off, on, shadowOn, offAgain,
    }, null, 2));
    checks.push("Block Light creates native-direction occlusion, updates both ways and survives Shadow toggle");
  }
  async function reopen() {
    await open();
    assert.equal((await object()).blocksLight, true);
    const on = await shot("light-reopen");
    assert.ok(brightness(on.behind) < brightness(on.flank) - 5);
    checks.push("Fresh process reopens Block Light geometry and renders light");
  }
  return { edit, reopen };
};
