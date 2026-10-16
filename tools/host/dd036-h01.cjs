// DD-036-H01: one visible terrain command through the shared Atlas history.
module.exports = ({ page, fs, path, assert, crypto, vault, out, checks }) => async () => {
  const world = "Atlanten/H01 Welt.overworld", worldId = "dd036-h01-world";
  const hash = () => crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(vault, world))).digest("hex");
  const beforeHash = hash();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    const calls = [], coverage = [];
    const relevant = (value) => {
      const name = typeof value === "string" ? value : value?.path;
      return typeof name === "string" &&
        (/^Atlanten(?:\/|$)/.test(name) || /^Atlasdaten(?:\/|$)/.test(name));
    };
    for (const [label, owner] of [["vault", app.vault], ["adapter", app.vault.adapter]]) {
      const names = new Set();
      for (let proto = owner; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto))
        for (const name of Reflect.ownKeys(proto))
          if (typeof name === "string" && /^(create|modify|process|append|write|copy|rename|remove|delete|trash|mkdir|rmdir)/i.test(name)) names.add(name);
      for (const name of names) {
        const original = owner[name];
        if (typeof original !== "function") continue;
        const wrapped = function (...args) {
          if (args.some(relevant)) calls.push({ api: label, method: name, target: String(args[0]?.path ?? args[0]) });
          return original.apply(this, args);
        };
        owner[name] = wrapped;
        if (owner[name] !== wrapped) throw new Error("Write monitor missing " + label + "." + name);
        coverage.push(label + "." + name);
      }
    }
    for (const required of ["vault.create", "vault.createBinary", "vault.modify", "vault.process", "vault.append", "vault.trash", "adapter.write", "adapter.writeBinary", "adapter.mkdir", "adapter.rmdir"])
      if (!coverage.includes(required)) throw new Error("Write monitor missing " + required);
    window.__dd036H01Writes = calls;
    window.__dd036H01Coverage = coverage.sort();
  });
  await page.evaluate(async (name) => {
    const file = app.vault.getAbstractFileByPath(name);
    if (!file) throw new Error("Missing H01 fixture");
    await app.workspace.getLeaf(false).openFile(file);
  }, world);
  const viewport = page.locator(".dn-atlas-viewport:visible").last();
  await viewport.locator("canvas").waitFor({ state: "visible", timeout: 30000 });
  const state = () => page.evaluate(() => {
    const view = app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1)?.view;
    const editor = view?.editor, history = editor?.terrain?.history;
    return { path: view?.file?.path, worldId: editor?.renderer?.world?.id,
      cells: editor?.terrain?.cells(), camera: editor?.renderer?.camera,
      depth: history?.undoDepth, canUndo: history?.canUndo, canRedo: history?.canRedo,
      commandOwners: history?.undoStack?.at(-1)?.changes?.map((c) => c.ownerId) ?? [] };
  });
  const before = await state();
  assert.equal(before.path, world);
  assert.equal(before.worldId, worldId);
  assert.deepEqual(before.cells, []);
  assert.equal(before.depth, 0);
  await page.locator(".dn-atlas-toolbar:visible")
    .getByRole("button", { name: "Land malen", exact: true }).click();
  const rect = await viewport.boundingBox();
  assert(rect && rect.width > 100 && rect.height > 100);
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1)?.view?.editor?.terrain?.history?.undoDepth === 1);
  const afterDraw = await state();
  assert.deepEqual(afterDraw.cells.map(({ q, r, surface, terrain }) => ({ q, r, surface, terrain })),
    [{ q: 0, r: 0, surface: "land", terrain: "plain" }]);
  assert.deepEqual(afterDraw.commandOwners, [worldId]);
  assert.equal(afterDraw.canUndo, true);
  assert.deepEqual(afterDraw.camera, before.camera);
  await page.screenshot({ path: path.join(out, "01-drawn.png") });
  await page.locator(".dn-atlas-toolbar:visible")
    .getByRole("button", { name: "Atlasänderung rückgängig", exact: true }).click();
  await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1)?.view?.editor?.terrain?.history?.undoDepth === 0);
  const afterUndo = await state();
  assert.deepEqual(afterUndo.cells, before.cells);
  assert.equal(afterUndo.canRedo, true);
  assert.deepEqual(afterUndo.camera, before.camera);
  await page.screenshot({ path: path.join(out, "02-undone.png") });
  await page.locator(".dn-atlas-toolbar:visible")
    .getByRole("button", { name: "Atlasänderung wiederholen", exact: true }).click();
  await page.waitForFunction(() => app.workspace.getLeavesOfType("dungeon-native-atlas").at(-1)?.view?.editor?.terrain?.history?.undoDepth === 1);
  const afterRedo = await state();
  assert.deepEqual(afterRedo.cells, afterDraw.cells);
  assert.deepEqual(afterRedo.camera, before.camera);
  await page.screenshot({ path: path.join(out, "03-redone.png") });
  await page.evaluate(() => {
    for (const leaf of app.workspace.getLeavesOfType("dungeon-native-atlas")) leaf.detach();
  });
  await viewport.waitFor({ state: "detached" });
  const { writes, coverage } = await page.evaluate(() => ({
    writes: window.__dd036H01Writes, coverage: window.__dd036H01Coverage,
  }));
  assert.deepEqual(writes, []);
  const afterHash = hash();
  assert.equal(afterHash, beforeHash, "History does not persist terrain");
  assert(!fs.existsSync(path.join(vault, "Atlasdaten")), "History does not allocate child data");
  fs.writeFileSync(path.join(out, "h01-result.json"), JSON.stringify({ beforeHash, afterHash,
    before, afterDraw, afterUndo, afterRedo, writes, coverage }, null, 2));
  checks.push("DD-036-H01 one owner-bound terrain command, exact visible Undo/Redo, stable camera and file bytes");
};
